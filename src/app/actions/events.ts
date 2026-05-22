"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  posterVisibleFieldIds,
  type EventInviteStyleId,
  type EventOperationalMoment,
  type EventVisualMotifId,
  type PosterVisibleFieldId,
  type VenueEventRecord,
} from "@/lib/event-types";
import type { PosterTemplateId } from "@/lib/poster-designer";
import { savePublicAsset } from "@/lib/storage";
import { deleteEventRecord, upsertEventRecord } from "@/lib/events";

export type EventSaveState = {
  ok: boolean;
  message: string;
  slug?: string;
  eventId?: string;
  savedEvent?: VenueEventRecord;
  deletedEventId?: string;
};

function ok(message: string, savedEvent?: VenueEventRecord): EventSaveState {
  return { ok: true, message, slug: savedEvent?.slug, eventId: savedEvent?.id, savedEvent };
}

function fail(message: string): EventSaveState {
  return { ok: false, message };
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOperationalMoments(raw: string): EventOperationalMoment[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is EventOperationalMoment => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const candidate = item as Record<string, unknown>;
        return (
          typeof candidate.id === "string" &&
          typeof candidate.label === "string" &&
          typeof candidate.time === "string"
        );
      })
      .map((item) => ({
        id: item.id.trim(),
        label: item.label.trim(),
        time: item.time.trim(),
      }))
      .filter((item) => item.id && item.label && item.time && !Number.isNaN(new Date(item.time).getTime()));
  } catch {
    return [];
  }
}

async function saveEventHeroAsset(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `event-hero-${randomUUID()}.${extension}`;

  return savePublicAsset({
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || "image/jpeg",
    localPath: `uploads/${fileName}`,
    pathname: `events/${fileName}`
  });
}

function revalidateEvents(slug: string) {
  revalidatePath("/");
  revalidatePath("/venue");
  revalidatePath("/como-funciona");
  revalidatePath(`/events/${slug}`);
  revalidatePath("/api/public/events");
}

function destroyOk(message: string, deletedEventId: string): EventSaveState {
  return { ok: true, message, deletedEventId };
}

export async function saveEventAction(
  _previousState: EventSaveState,
  formData: FormData,
): Promise<EventSaveState> {
  try {
    const title = getString(formData, "title");
    const summary = getString(formData, "summary");
    const description = getString(formData, "description");
    const startsAt = getString(formData, "startsAt");
    const endsAt = getString(formData, "endsAt");
    const doorTime = getString(formData, "doorTime");
    const soundcheckTime = getString(formData, "soundcheckTime");
    const operationalMoments = parseOperationalMoments(getString(formData, "operationalMoments"));
    const venueName = getString(formData, "venueName");
    const venueAddress = getString(formData, "venueAddress");

    if (!title || !summary || !description || !startsAt || !endsAt || !venueName || !venueAddress) {
      return fail("Completa título, resumen, descripción, venue y fechas clave.");
    }

    const capacity = Math.max(1, getNumber(formData, "capacity", 320));
    const soldCount = Math.max(0, getNumber(formData, "soldCount", 0));
    const startsAtMs = new Date(startsAt).getTime();
    const endsAtMs = new Date(endsAt).getTime();
    const doorTimeValue = doorTime || startsAt;
    const soundcheckTimeValue = soundcheckTime || startsAt;
    const doorTimeMs = new Date(doorTimeValue).getTime();
    const soundcheckTimeMs = new Date(soundcheckTimeValue).getTime();

    if (Number.isNaN(startsAtMs) || Number.isNaN(endsAtMs) || Number.isNaN(doorTimeMs) || Number.isNaN(soundcheckTimeMs)) {
      return fail("Revisa las fechas y horas del evento.");
    }

    if (endsAtMs <= startsAtMs) {
      return fail("La hora de fin debe ser posterior al inicio.");
    }

    if (doorTimeMs > startsAtMs) {
      return fail("La hora de puertas no puede ser después del inicio del show.");
    }

    if (soundcheckTimeMs > doorTimeMs) {
      return fail("El soundcheck no puede quedar después de puertas.");
    }

    if (soldCount > capacity) {
      return fail("Los boletos vendidos no pueden superar la capacidad.");
    }

    const existingHeroImage = getString(formData, "heroImage");
    const heroImageFile = formData.get("heroImageFile");
    const uploadedHero =
      heroImageFile instanceof File && heroImageFile.size > 0 ? await saveEventHeroAsset(heroImageFile) : "";

    const saved = await upsertEventRecord({
      id: getString(formData, "id") || undefined,
      slug: getString(formData, "slug") || title,
      title,
      summary,
      description,
      startsAt,
      endsAt,
      timezone: getString(formData, "timezone") || "America/Mexico_City",
      venueName,
      venueAddress,
      heroImage: uploadedHero || existingHeroImage || "/events/stage1.jpg",
      designVariant: (getString(formData, "designVariant") || undefined) as EventInviteStyleId | undefined,
      designTemplateId: (getString(formData, "designTemplateId") || undefined) as PosterTemplateId | undefined,
      designMotifs: splitList(getString(formData, "designMotifs")) as EventVisualMotifId[],
      posterVisibleFields: splitList(getString(formData, "posterVisibleFields")).filter(
        (field): field is PosterVisibleFieldId => posterVisibleFieldIds.includes(field as PosterVisibleFieldId),
      ),
      posterArtDirection: getString(formData, "posterArtDirection"),
      posterReferenceUrls: splitList(getString(formData, "posterReferenceUrls")),
      posterAssetMode: (getString(formData, "posterAssetMode") || "graphic-only") as VenueEventRecord["posterAssetMode"],
      doorTime: doorTimeValue,
      soundcheckTime: soundcheckTimeValue,
      operationalMoments,
      ticketPriceMXN: Math.max(0, getNumber(formData, "ticketPriceMXN", 280)),
      ticketFeeMXN: Math.max(0, getNumber(formData, "ticketFeeMXN", 15)),
      artistPayoutRate: Math.max(0, Math.min(1, getNumber(formData, "artistPayoutRate", 0.7))),
      capacity,
      soldCount,
      lineup: splitList(getString(formData, "lineup")),
      genre: splitList(getString(formData, "genre")),
      isPublished: formData.get("isPublished") === "on"
    });

    revalidateEvents(saved.slug);
    return ok(`Evento ${saved.isPublished ? "guardado y publicado" : "guardado como draft"}.`, saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo guardar el evento.");
  }
}

export async function deleteEventAction(
  _previousState: EventSaveState,
  formData: FormData,
): Promise<EventSaveState> {
  try {
    const id = getString(formData, "id");
    const slug = getString(formData, "slug");
    const title = getString(formData, "title");
    const confirmation = getString(formData, "deleteConfirmation");
    const expectedPhrase = `BORRAR ${title}`;

    if (!id || !slug || !title) {
      return fail("No se pudo identificar el evento a borrar.");
    }

    if (confirmation !== expectedPhrase) {
      return fail(`Escribe exactamente "${expectedPhrase}" para borrar este evento.`);
    }

    const deleted = await deleteEventRecord(id);

    if (!deleted) {
      return fail("El evento ya no existe o no pudo encontrarse.");
    }

    revalidateEvents(slug);
    return destroyOk("Evento borrado correctamente.", id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo borrar el evento.");
  }
}
