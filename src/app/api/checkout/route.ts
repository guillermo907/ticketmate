import { createHash, randomUUID } from "node:crypto";
import { CheckoutStatus, PaymentProvider, Prisma, TicketState } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { executeProviderCheckout } from "@/lib/payments/providers";

type CheckoutPayload = {
  eventId: string;
  quantity: number;
  provider: "MERCADO_PAGO" | "PAYPAL" | "STRIPE_CONNECT_MX";
  customer?: {
    email?: string;
    fullName?: string;
  };
};

function hashPayload(payload: CheckoutPayload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  const payload = (await request.json()) as Partial<CheckoutPayload>;
  const idempotencyKey =
    request.headers.get("idempotency-key")?.trim() ||
    request.headers.get("x-idempotency-key")?.trim() ||
    randomUUID();

  if (!payload.eventId || !payload.quantity || !payload.provider) {
    return jsonError("Missing eventId, quantity, or provider.", 400);
  }

  if (!["MERCADO_PAGO", "PAYPAL", "STRIPE_CONNECT_MX"].includes(payload.provider)) {
    return jsonError("Unsupported provider.", 400);
  }

  if (!Number.isInteger(payload.quantity) || payload.quantity < 1 || payload.quantity > 8) {
    return jsonError("Quantity must be an integer between 1 and 8.", 400);
  }

  const normalizedPayload: CheckoutPayload = {
    eventId: payload.eventId,
    quantity: payload.quantity,
    provider: payload.provider,
    customer: {
      email: payload.customer?.email?.trim().toLowerCase(),
      fullName: payload.customer?.fullName?.trim()
    }
  };

  const requestHash = hashPayload(normalizedPayload);
  const existingRequest = await prisma.checkoutRequest.findUnique({
    where: {
      idempotencyKey
    }
  });

  if (existingRequest) {
    if (existingRequest.requestHash !== requestHash) {
      return jsonError("Idempotency key already used with a different payload.", 409);
    }

    if (existingRequest.status === CheckoutStatus.COMPLETED && existingRequest.responsePayload) {
      return NextResponse.json(existingRequest.responsePayload as Prisma.JsonObject);
    }

    if (existingRequest.status === CheckoutStatus.PROCESSING) {
      return jsonError("Checkout is already processing for this idempotency key.", 409);
    }
  }

  const event = await prisma.event.findUnique({
    where: {
      id: normalizedPayload.eventId
    },
    include: {
      venue: true,
      headlinerArtist: {
        select: {
          id: true
        }
      }
    }
  });

  if (!event || !event.isPublished || event.status === "CANCELLED") {
    return jsonError("This event is not available for checkout.", 404);
  }

  const faceValueAmount = roundCurrency(Number(event.baseTicketPrice) * normalizedPayload.quantity);
  const consumerFeePerTicket = Number(event.consumerProcessingFeeFixed ?? event.venue.ticketConsumerFeeFixed);
  const platformFeeAmount = roundCurrency(consumerFeePerTicket * normalizedPayload.quantity);
  const grossAmount = roundCurrency(faceValueAmount + platformFeeAmount);

  const upsertedRequest = await prisma.checkoutRequest.upsert({
    where: {
      idempotencyKey
    },
    create: {
      idempotencyKey,
      requestHash,
      status: CheckoutStatus.PROCESSING,
      provider: normalizedPayload.provider as PaymentProvider,
      eventId: event.id,
      customerUserId: session?.user?.id ?? null,
      quantity: normalizedPayload.quantity,
      grossAmount,
      platformFeeAmount,
      lastAttemptedAt: new Date()
    },
    update: {
      status: CheckoutStatus.PROCESSING,
      failureReason: null,
      lastAttemptedAt: new Date()
    }
  });

  const providerResult = await executeProviderCheckout({
    provider: normalizedPayload.provider,
    idempotencyKey,
    amountMXN: grossAmount,
    description: `${event.title} x${normalizedPayload.quantity}`,
    payerEmail: normalizedPayload.customer?.email ?? session?.user?.email ?? undefined,
    metadata: {
      eventId: event.id,
      checkoutRequestId: upsertedRequest.id
    }
  });

  if (providerResult.status !== "APPROVED") {
    await prisma.checkoutRequest.update({
      where: {
        idempotencyKey
      },
      data: {
        status: CheckoutStatus.FAILED,
        providerReference: providerResult.providerReference,
        processorFeeAmount: providerResult.processorFeeAmount,
        failureReason: `Provider status: ${providerResult.status}`,
        responsePayload: providerResult.rawResponse as Prisma.InputJsonValue
      }
    });

    return jsonError("Payment provider did not approve the transaction.", 402);
  }

  try {
    const responsePayload = await prisma.$transaction(
      async (tx) => {
        const lockedRows = await tx.$queryRaw<
          Array<{
            id: string;
            totalTicketInventory: number;
            soldTicketInventory: number;
            inventoryVersion: number;
          }>
        >`SELECT id, "totalTicketInventory", "soldTicketInventory", "inventoryVersion" FROM "Event" WHERE id = ${event.id} FOR UPDATE`;

        const lockedEvent = lockedRows[0];

        if (!lockedEvent) {
          throw new Error("Event inventory row could not be locked.");
        }

        const remainingInventory = lockedEvent.totalTicketInventory - lockedEvent.soldTicketInventory;

        if (remainingInventory < normalizedPayload.quantity) {
          throw new Error("Not enough inventory available.");
        }

        const processorFeeAmount = roundCurrency(providerResult.processorFeeAmount);
        const bandGrossShare = event.headlinerArtistUserId
          ? roundCurrency(faceValueAmount * Number(event.artistPayoutRate))
          : 0;
        const automatedBandPayoutFeeAmount = roundCurrency(
          bandGrossShare * Number(event.venue.automatedBandPayoutFeeRate),
        );
        const netToBandAmount = roundCurrency(Math.max(0, bandGrossShare - automatedBandPayoutFeeAmount));
        const netToVenueAmount = roundCurrency(
          Math.max(0, grossAmount - platformFeeAmount - processorFeeAmount - netToBandAmount),
        );

        const purchaseReference = `${event.slug.slice(0, 6).toUpperCase()}-${lockedEvent.soldTicketInventory + 1}-${idempotencyKey.slice(-6).toUpperCase()}`;
        const secureHash = createHash("sha256")
          .update(`${purchaseReference}:${providerResult.providerChargeId}:${idempotencyKey}`)
          .digest("hex");

        const ticket = await tx.ticket.create({
          data: {
            eventId: event.id,
            customerUserId: session?.user?.id ?? null,
            ticketNumber: lockedEvent.soldTicketInventory + 1,
            purchaseReference,
            secureHash,
            state: TicketState.PAID,
            quantity: normalizedPayload.quantity,
            faceValueAmount,
            consumerFeeAmount: platformFeeAmount,
            grossAmount,
            purchasedAt: new Date(),
            paidAt: new Date(),
            sourceIpHash: createHash("sha256")
              .update(request.headers.get("x-forwarded-for") ?? "local-request")
              .digest("hex")
          }
        });

        await tx.event.update({
          where: {
            id: event.id
          },
          data: {
            soldTicketInventory: {
              increment: normalizedPayload.quantity
            },
            inventoryVersion: {
              increment: 1
            }
          }
        });

        await tx.financialLedger.create({
          data: {
            venueId: event.venueId,
            eventId: event.id,
            ticketId: ticket.id,
            bandUserId: event.headlinerArtistUserId ?? null,
            entryType: "TICKET_CHARGE",
            currencyCode: event.venue.currencyCode,
            providerName: providerResult.provider,
            providerReference: providerResult.providerReference,
            grossPaidAmount: grossAmount,
            platformTicketFeeAmount: platformFeeAmount,
            paymentProcessorFeeAmount: processorFeeAmount,
            automatedBandPayoutFeeAmount,
            automatedBandPayoutFeeRate: event.venue.automatedBandPayoutFeeRate,
            taxWithheldAmount: 0,
            netToVenueAmount,
            netToBandAmount,
            occurredAt: new Date(),
            metadata: {
              idempotencyKey,
              quantity: normalizedPayload.quantity,
              providerChargeId: providerResult.providerChargeId
            }
          }
        });

        const completedResponse = {
          ok: true,
          checkoutRequestId: upsertedRequest.id,
          ticketId: ticket.id,
          purchaseReference,
          ticketState: ticket.state,
          amounts: {
            faceValueAmount,
            platformFeeAmount,
            processorFeeAmount,
            grossAmount,
            netToVenueAmount,
            netToBandAmount
          },
          provider: {
            name: providerResult.provider,
            reference: providerResult.providerReference
          }
        };

        await tx.checkoutRequest.update({
          where: {
            idempotencyKey
          },
          data: {
            status: CheckoutStatus.COMPLETED,
            ticketId: ticket.id,
            providerReference: providerResult.providerReference,
            processorFeeAmount,
            responsePayload: completedResponse as Prisma.InputJsonValue
          }
        });

        return completedResponse;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      },
    );

    return NextResponse.json(responsePayload, {
      status: 201
    });
  } catch (error) {
    await prisma.checkoutRequest.update({
      where: {
        idempotencyKey
      },
      data: {
        status: CheckoutStatus.FAILED,
        providerReference: providerResult.providerReference,
        processorFeeAmount: providerResult.processorFeeAmount,
        failureReason: error instanceof Error ? error.message : "Unknown transaction failure."
      }
    });

    return jsonError(
      error instanceof Error ? error.message : "Checkout transaction failed after provider approval.",
      409,
    );
  }
}
