import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EventStatus, Prisma } from "@prisma/client";
import { defaultEventSeeds } from "./mock-events";
import { prisma } from "./prisma";
import { buildPosterDesign, inferPosterVariant } from "./poster-designer";
import { buildTicketDesign } from "./ticket-designer";
import {
  type EventVisualMotifId,
  getEventInviteStyle,
  normalizeEventMotifs,
  posterVisibleFieldIds,
  type EventPosterAsset,
  type EventPosterAssetSnapshot,
  type EventTicketAsset,
  type EventPosterOriginMode,
  type PosterOverlayLayoutConfig,
  type PosterAssetMode,
  type PosterTextOverlayMode,
  type PosterVisibleFieldId,
  type PublicEventCard,
  type VenueEventRecord,
} from "./event-types";

const eventsPath = path.join(process.cwd(), "data", "events.json");
const defaultVenueSlug = "foro-gdl";
const defaultVenueAdminEmail = "venue-console@foro-gdl.local";

type EventConsolePayload = {
  summary?: string;
  venueName?: string;
  venueAddress?: string;
  heroImage?: string;
  designVariant?: VenueEventRecord["designVariant"];
  designTemplateId?: VenueEventRecord["designTemplateId"];
  ticketTemplateId?: VenueEventRecord["ticketTemplateId"];
  designMotifs?: VenueEventRecord["designMotifs"];
  posterVisibleFields?: VenueEventRecord["posterVisibleFields"];
  posterArtDirection?: string;
  posterReferenceUrls?: string[];
  posterAssetMode?: VenueEventRecord["posterAssetMode"];
  posterTextOverlayMode?: VenueEventRecord["posterTextOverlayMode"];
  posterOverlayLayout?: VenueEventRecord["posterOverlayLayout"];
  posterAssets?: VenueEventRecord["posterAssets"];
  activePosterAssetId?: string;
  ticketAssets?: VenueEventRecord["ticketAssets"];
  activeTicketAssetId?: string;
  operationalMoments?: VenueEventRecord["operationalMoments"];
  operationMode?: VenueEventRecord["operationMode"];
  lineup?: string[];
  genre?: string[];
  draftPoster?: VenueEventRecord["draftPoster"];
  publishedPoster?: VenueEventRecord["publishedPoster"];
  posterDesign?: VenueEventRecord["posterDesign"];
  draftTicket?: VenueEventRecord["draftTicket"];
  publishedTicket?: VenueEventRecord["publishedTicket"];
  ticketDesign?: VenueEventRecord["ticketDesign"];
};

function shouldUsePrismaEvents() {
  return Boolean(process.env.DATABASE_URL && process.env.FORO_FORCE_FILE_EVENTS !== "true");
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function asObjectArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readConsolePayload(value: Prisma.JsonValue | null | undefined): EventConsolePayload {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as EventConsolePayload) : {};
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function withAvailability(event: VenueEventRecord): PublicEventCard {
  return {
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    venueName: event.venueName,
    ticketPriceMXN: event.ticketPriceMXN,
    availability: Math.max(0, event.capacity - event.soldCount)
  };
}

function sortByStartDate(events: VenueEventRecord[]) {
  return [...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function hashAssetId(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function inferPosterProvider(url: string) {
  if (url.includes("pollinations.ai")) {
    return "pollinations";
  }

  if (url.startsWith("/uploads/") || url.startsWith("/api/blob/")) {
    return "foro-storage";
  }

  return "external";
}

function inferPosterOriginMode(
  asset: Partial<EventPosterAsset>,
  event: Partial<VenueEventRecord>,
): EventPosterOriginMode {
  if (asset.originMode) {
    return asset.originMode;
  }

  const assetMode = asset.assetMode ?? asset.snapshot?.posterAssetMode ?? event.posterAssetMode;

  if (asset.source === "uploaded" || assetMode === "uploaded-hero") {
    return "upload";
  }

  return "local";
}

function buildPosterAssetSnapshot(
  event: Partial<VenueEventRecord>,
  overrides?: {
    url?: string;
    assetMode?: PosterAssetMode;
    overlayMode?: PosterTextOverlayMode;
    artDirection?: string;
  },
): EventPosterAssetSnapshot {
  const posterUrl =
    overrides?.url ??
    event.posterReferenceUrls?.find(Boolean) ??
    event.posterAssets?.find((asset) => asset.id === event.activePosterAssetId)?.url ??
    event.posterAssets?.find((asset) => asset.url)?.url ??
    "";

  return {
    title: event.title ?? "",
    summary: event.summary ?? "",
    description: event.description ?? "",
    startsAt: event.startsAt ?? "",
    endsAt: event.endsAt ?? event.startsAt ?? "",
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    heroImage: event.heroImage ?? "",
    lineup: Array.isArray(event.lineup) ? [...event.lineup] : [],
    genre: Array.isArray(event.genre) ? [...event.genre] : [],
    designVariant: event.designVariant,
    designTemplateId: event.designTemplateId,
    designMotifs: Array.isArray(event.designMotifs) ? [...event.designMotifs] : [],
    posterVisibleFields: Array.isArray(event.posterVisibleFields) ? [...event.posterVisibleFields] : [...posterVisibleFieldIds],
    posterArtDirection: overrides?.artDirection ?? event.posterArtDirection ?? "",
    posterReferenceUrls: posterUrl ? [posterUrl] : [],
    posterAssetMode: overrides?.assetMode ?? event.posterAssetMode,
    posterTextOverlayMode: overrides?.overlayMode ?? event.posterTextOverlayMode,
    posterOverlayLayout: event.posterOverlayLayout,
  };
}

function normalizePosterAssets(
  event: Partial<VenueEventRecord>,
  now: string,
): EventPosterAsset[] {
  const existing = Array.isArray(event.posterAssets) ? event.posterAssets.filter((asset) => asset?.url) : [];
  const normalizedAssets: EventPosterAsset[] = [];
  const seenIds = new Set<string>();

  for (const [index, asset] of existing.entries()) {
    const assetId = asset.id || `poster-${hashAssetId(`${asset.url}|${index}`)}`;

    if (seenIds.has(assetId)) {
      continue;
    }

    const snapshot =
      asset.snapshot ??
      buildPosterAssetSnapshot(
        {
          ...event,
          posterReferenceUrls: asset.url ? [asset.url] : event.posterReferenceUrls,
        },
        {
          url: asset.url,
          assetMode: asset.assetMode,
          overlayMode: asset.overlayMode,
          artDirection: asset.artDirection ?? asset.prompt,
        },
      );

    normalizedAssets.push({
      ...asset,
      id: assetId,
      kind: "poster",
      status: asset.status ?? (event.isPublished && event.activePosterAssetId === assetId ? "published" : "draft"),
      revision: Number.isFinite(asset.revision) && asset.revision > 0 ? asset.revision : index + 1,
      originMode: inferPosterOriginMode(asset, event),
      artDirection: asset.artDirection ?? asset.prompt ?? snapshot.posterArtDirection ?? "",
      assetMode: asset.assetMode ?? snapshot.posterAssetMode ?? event.posterAssetMode,
      overlayMode: asset.overlayMode ?? snapshot.posterTextOverlayMode ?? event.posterTextOverlayMode,
      templateId: asset.templateId ?? snapshot.designTemplateId ?? event.designTemplateId,
      snapshot,
      updatedAt: asset.updatedAt ?? now,
      createdAt: asset.createdAt ?? now,
    });

    seenIds.add(assetId);
  }

  for (const url of Array.isArray(event.posterReferenceUrls) ? event.posterReferenceUrls.filter(Boolean) : []) {
    const existingAsset = normalizedAssets.find((asset) => asset.url === url);

    if (existingAsset) {
      continue;
    }

    normalizedAssets.push({
      id: `poster-${hashAssetId(`${url}|${normalizedAssets.length}`)}`,
      kind: "poster",
      url,
      source: url.startsWith("/uploads/") || url.startsWith("/api/blob/") ? "materialized" : "legacy",
      label: "Poster guardado",
      status: event.isPublished ? "published" : "draft",
      revision: normalizedAssets.length + 1,
      originMode: url.startsWith("/uploads/") || url.startsWith("/api/blob/") ? "upload" : "local",
      provider: inferPosterProvider(url),
      artDirection: event.posterArtDirection ?? "",
      assetMode: event.posterAssetMode,
      overlayMode: event.posterTextOverlayMode,
      templateId: event.designTemplateId,
      snapshot: buildPosterAssetSnapshot(event, {
        url,
        assetMode: event.posterAssetMode,
        overlayMode: event.posterTextOverlayMode,
        artDirection: event.posterArtDirection,
      }),
      createdAt: now,
      updatedAt: now,
    });
  }

  return normalizedAssets;
}

function resolveActivePosterAssetId(event: Partial<VenueEventRecord>, posterAssets: EventPosterAsset[]) {
  if (event.activePosterAssetId && posterAssets.some((asset) => asset.id === event.activePosterAssetId)) {
    return event.activePosterAssetId;
  }

  const activeUrl = event.posterReferenceUrls?.[0];
  return posterAssets.find((asset) => asset.url === activeUrl)?.id ?? posterAssets[0]?.id;
}

function normalizeTicketAssets(
  event: Partial<VenueEventRecord>,
  ticketDesign: VenueEventRecord["ticketDesign"] | VenueEventRecord["draftTicket"] | VenueEventRecord["publishedTicket"],
  activePosterAssetId: string | undefined,
  now: string,
): EventTicketAsset[] {
  const existing = Array.isArray(event.ticketAssets) ? event.ticketAssets : [];
  const hydrated = existing.map((asset) => ({
    ...asset,
    kind: "ticket" as const,
    source: "composite" as const,
    updatedAt: asset.updatedAt ?? now,
    createdAt: asset.createdAt ?? now,
  }));

  if (!ticketDesign) {
    return hydrated;
  }

  const matchingAsset = hydrated.find(
    (asset) =>
      asset.templateId === ticketDesign.templateId &&
      asset.posterAssetId === activePosterAssetId &&
      asset.rendererId === ticketDesign.rendererId,
  );

  if (matchingAsset) {
    return hydrated;
  }

  return [
    ...hydrated,
    {
      id: `ticket-${hashAssetId(`${ticketDesign.templateId}|${activePosterAssetId ?? "no-poster"}|${now}`)}`,
      kind: "ticket",
      source: "composite",
      label: `${ticketDesign.templateId} ticket`,
      posterAssetId: activePosterAssetId,
      templateId: ticketDesign.templateId,
      rendererId: ticketDesign.rendererId,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function resolveActiveTicketAssetId(event: Partial<VenueEventRecord>, ticketAssets: EventTicketAsset[]) {
  if (event.activeTicketAssetId && ticketAssets.some((asset) => asset.id === event.activeTicketAssetId)) {
    return event.activeTicketAssetId;
  }

  return ticketAssets.at(-1)?.id;
}

function hydratePosterDesign(
  event: VenueEventRecord,
  existing: VenueEventRecord["posterDesign"] | VenueEventRecord["draftPoster"] | VenueEventRecord["publishedPoster"],
) {
  const seededEvent = {
    ...event,
    designVariant: existing?.variant ?? event.designVariant,
    designTemplateId: existing?.templateId ?? event.designTemplateId,
    designMotifs: existing?.motifs ?? event.designMotifs,
  };
  const fallback = buildPosterDesign(seededEvent, existing?.generatedAt ?? event.updatedAt);

  return {
    ...fallback,
    ...existing,
    narrative: existing?.narrative ?? fallback.narrative,
    layout: existing?.layout ?? fallback.layout,
    shellTheme: existing?.shellTheme ?? fallback.shellTheme,
    handoff: {
      ...fallback.handoff,
      ...existing?.handoff,
      developerNotes: existing?.handoff?.developerNotes ?? fallback.handoff.developerNotes,
      assetPlan: existing?.handoff?.assetPlan ?? fallback.handoff.assetPlan,
      usesPhotography: existing?.handoff?.usesPhotography ?? fallback.handoff.usesPhotography,
    },
  };
}

function hydrateTicketDesign(
  event: VenueEventRecord,
  existing: VenueEventRecord["ticketDesign"] | VenueEventRecord["draftTicket"] | VenueEventRecord["publishedTicket"],
  posterDesign: VenueEventRecord["posterDesign"] | VenueEventRecord["draftPoster"] | VenueEventRecord["publishedPoster"],
) {
  const fallback = buildTicketDesign(
    {
      ...event,
      ticketTemplateId: existing?.templateId ?? event.ticketTemplateId,
    },
    posterDesign,
    existing?.generatedAt ?? event.updatedAt,
  );

  return {
    ...fallback,
    ...existing,
    shellTheme: existing?.shellTheme ?? fallback.shellTheme,
    layout: existing?.layout ?? fallback.layout,
    handoff: {
      ...fallback.handoff,
      ...existing?.handoff,
      developerNotes: existing?.handoff?.developerNotes ?? fallback.handoff.developerNotes,
    },
  };
}

function normalizeEventRecord(event: Partial<VenueEventRecord>): VenueEventRecord {
  const now = event.updatedAt ?? new Date().toISOString();
  const posterSeed = event.draftPoster ?? event.publishedPoster ?? event.posterDesign;
  const designVariant = getEventInviteStyle(
    event.designVariant ?? posterSeed?.variant ?? inferPosterVariant(event as VenueEventRecord),
  ).id;
  const designMotifs = normalizeEventMotifs(event.designMotifs, designVariant);

  const normalizedEvent: VenueEventRecord = {
    id: event.id ?? randomUUID(),
    slug: event.slug ?? "",
    title: event.title ?? "Nuevo evento Foro GDL",
    summary: event.summary ?? "Evento listo para publicar en mobile ticketing.",
    description: event.description ?? "",
    startsAt: event.startsAt ?? new Date().toISOString(),
    endsAt: event.endsAt ?? event.startsAt ?? new Date().toISOString(),
    timezone: event.timezone ?? "America/Mexico_City",
    venueName: event.venueName ?? "Foro GDL",
    venueAddress: event.venueAddress ?? "Guadalajara, Jalisco",
    heroImage: event.heroImage ?? "/events/stage1.jpg",
    designVariant,
    designTemplateId: event.designTemplateId ?? posterSeed?.templateId,
    ticketTemplateId: event.ticketTemplateId,
    designMotifs,
    posterVisibleFields: Array.isArray(event.posterVisibleFields)
      ? event.posterVisibleFields.filter((field): field is (typeof posterVisibleFieldIds)[number] =>
          posterVisibleFieldIds.includes(field as (typeof posterVisibleFieldIds)[number]),
        )
      : [...posterVisibleFieldIds],
    posterArtDirection: event.posterArtDirection ?? "",
    posterReferenceUrls: Array.isArray(event.posterReferenceUrls) ? event.posterReferenceUrls.filter(Boolean) : [],
    posterAssetMode: event.posterAssetMode ?? "graphic-only",
    posterTextOverlayMode: event.posterTextOverlayMode ?? "editorial-band",
    posterOverlayLayout: event.posterOverlayLayout ?? {
      heroAnchor: "bottom-left",
      lineupAnchor: "top-left",
      actionAnchor: "top-right",
      storyAnchor: "middle-right",
      heroOffsetX: 0,
      heroOffsetY: 0,
      heroScale: 1,
      heroScaleX: 1,
      heroScaleY: 1,
      heroBoxScale: 1,
      heroBoxScaleX: 1,
      heroBoxScaleY: 1,
      heroRotation: 0,
      heroOpacity: 1,
      lineupOffsetX: 0,
      lineupOffsetY: 0,
      lineupScale: 1,
      lineupScaleX: 1,
      lineupScaleY: 1,
      lineupBoxScale: 1,
      lineupBoxScaleX: 1,
      lineupBoxScaleY: 1,
      lineupRotation: 0,
      lineupOpacity: 1,
      actionOffsetX: 0,
      actionOffsetY: 0,
      actionScale: 1,
      actionScaleX: 1,
      actionScaleY: 1,
      actionBoxScale: 1,
      actionBoxScaleX: 1,
      actionBoxScaleY: 1,
      actionRotation: 0,
      actionOpacity: 1,
      storyOffsetX: 0,
      storyOffsetY: 0,
      storyScale: 1,
      storyScaleX: 1,
      storyScaleY: 1,
      storyBoxScale: 1,
      storyBoxScaleX: 1,
      storyBoxScaleY: 1,
      storyRotation: 0,
      storyOpacity: 1,
      textAlign: "left",
      typographyStyle: "display",
      fontScale: 1,
      elementScale: 1,
      cardScale: 1,
      density: "balanced",
      cardStyle: "glass",
    },
    doorTime: event.doorTime ?? event.startsAt ?? new Date().toISOString(),
    soundcheckTime: event.soundcheckTime ?? event.startsAt ?? new Date().toISOString(),
    operationalMoments: Array.isArray(event.operationalMoments)
      ? event.operationalMoments
          .filter(
            (moment): moment is VenueEventRecord["operationalMoments"][number] =>
              Boolean(moment?.id && moment?.label && moment?.time),
          )
          .map((moment) => ({
            id: moment.id,
            label: moment.label.trim(),
            time: moment.time,
          }))
      : [],
    ticketPriceMXN: event.ticketPriceMXN ?? 280,
    ticketFeeMXN: event.ticketFeeMXN ?? 15,
    artistPayoutRate: event.artistPayoutRate ?? 0.7,
    capacity: event.capacity ?? 320,
    soldCount: event.soldCount ?? 0,
    operationMode: event.operationMode ?? "auto",
    lineup: Array.isArray(event.lineup) ? event.lineup : [],
    genre: Array.isArray(event.genre) ? event.genre : [],
    isPublished: event.isPublished ?? false,
    publishedAt: event.publishedAt,
    posterAssets: [],
    activePosterAssetId: undefined,
    ticketAssets: [],
    activeTicketAssetId: undefined,
    createdAt: event.createdAt ?? now,
    updatedAt: now
  };

  const assetSeed = { ...event, ...normalizedEvent };
  const posterAssets = normalizePosterAssets(assetSeed, now);
  const activePosterAssetId = resolveActivePosterAssetId(assetSeed, posterAssets);

  const draftPoster = hydratePosterDesign(
    normalizedEvent,
    event.draftPoster ?? event.posterDesign ?? event.publishedPoster,
  );
  const publishedPoster = normalizedEvent.isPublished
    ? hydratePosterDesign(normalizedEvent, event.publishedPoster ?? event.posterDesign ?? draftPoster)
    : undefined;
  const draftTicket = hydrateTicketDesign(
    normalizedEvent,
    event.draftTicket ?? event.ticketDesign ?? event.publishedTicket,
    draftPoster,
  );
  const publishedTicket = normalizedEvent.isPublished
    ? hydrateTicketDesign(
        normalizedEvent,
        event.publishedTicket ?? event.ticketDesign ?? draftTicket,
        publishedPoster ?? draftPoster,
      )
    : undefined;
  const ticketAssets = normalizeTicketAssets(
    event,
    publishedTicket ?? draftTicket,
    activePosterAssetId,
    now,
  );
  const activeTicketAssetId = resolveActiveTicketAssetId(event, ticketAssets);

  return {
    ...normalizedEvent,
    posterAssets,
    activePosterAssetId,
    ticketAssets,
    activeTicketAssetId,
    draftPoster,
    publishedPoster,
    posterDesign: publishedPoster ?? draftPoster,
    draftTicket,
    publishedTicket,
    ticketDesign: publishedTicket ?? draftTicket,
  };
}

async function ensureVenueConsoleContext() {
  const venue =
    (await prisma.venue.findUnique({ where: { slug: defaultVenueSlug } })) ??
    (await prisma.venue.create({
      data: {
        slug: defaultVenueSlug,
        legalName: "Foro GDL Venue Console",
        displayName: "Foro GDL",
        description: "Venue principal para la consola editorial y de operación.",
      },
    }));

  const organizer =
    (await prisma.user.findUnique({ where: { email: defaultVenueAdminEmail } })) ??
    (await prisma.user.create({
      data: {
        venueId: venue.id,
        role: "ADMIN",
        email: defaultVenueAdminEmail,
        normalizedEmail: defaultVenueAdminEmail,
        fullName: "Venue Console",
      },
    }));

  return { venue, organizer };
}

function toPrismaDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function prismaDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function buildConsolePayload(event: VenueEventRecord): Prisma.InputJsonValue {
  return {
    summary: event.summary,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    heroImage: event.heroImage,
    designVariant: event.designVariant,
    designTemplateId: event.designTemplateId,
    ticketTemplateId: event.ticketTemplateId,
    designMotifs: event.designMotifs ?? [],
    posterVisibleFields: event.posterVisibleFields ?? [],
    posterArtDirection: event.posterArtDirection ?? "",
    posterReferenceUrls: event.posterReferenceUrls ?? [],
    posterAssetMode: event.posterAssetMode,
    posterTextOverlayMode: event.posterTextOverlayMode,
    posterOverlayLayout: event.posterOverlayLayout ?? null,
    posterAssets: event.posterAssets ?? [],
    activePosterAssetId: event.activePosterAssetId,
    ticketAssets: event.ticketAssets ?? [],
    activeTicketAssetId: event.activeTicketAssetId,
    operationalMoments: event.operationalMoments ?? [],
    operationMode: event.operationMode ?? "auto",
    lineup: event.lineup ?? [],
    genre: event.genre ?? [],
    draftPoster: event.draftPoster ?? null,
    publishedPoster: event.publishedPoster ?? null,
    posterDesign: event.posterDesign ?? null,
    draftTicket: event.draftTicket ?? null,
    publishedTicket: event.publishedTicket ?? null,
    ticketDesign: event.ticketDesign ?? null,
  };
}

function mapPrismaEventToVenueRecord(
  event: Awaited<ReturnType<typeof prisma.event.findFirst>> & {
    venue?: { displayName: string | null } | null;
  },
): VenueEventRecord {
  const payload = readConsolePayload(event?.consolePayload);

  return normalizeEventRecord({
    id: event?.id,
    slug: event?.slug,
    title: event?.title,
    summary: payload.summary ?? "",
    description: event?.description ?? "",
    startsAt: event?.startsAt?.toISOString(),
    endsAt: event?.endsAt?.toISOString(),
    timezone: event?.timezone,
    venueName: payload.venueName ?? event?.venue?.displayName ?? "Foro GDL",
    venueAddress: payload.venueAddress ?? "Guadalajara, Jalisco",
    heroImage: payload.heroImage ?? "/events/stage1.jpg",
    designVariant: payload.designVariant,
    designTemplateId: payload.designTemplateId,
    ticketTemplateId: payload.ticketTemplateId,
    designMotifs: asObjectArray<EventVisualMotifId>(payload.designMotifs),
    posterVisibleFields: asObjectArray<PosterVisibleFieldId>(payload.posterVisibleFields),
    posterArtDirection: payload.posterArtDirection ?? "",
    posterReferenceUrls: asStringArray(payload.posterReferenceUrls),
    posterAssetMode: payload.posterAssetMode,
    posterTextOverlayMode: payload.posterTextOverlayMode,
    posterOverlayLayout: (payload.posterOverlayLayout as PosterOverlayLayoutConfig | undefined) ?? undefined,
    posterAssets: asObjectArray(payload.posterAssets),
    activePosterAssetId: payload.activePosterAssetId,
    ticketAssets: asObjectArray(payload.ticketAssets),
    activeTicketAssetId: payload.activeTicketAssetId,
    doorTime: event?.doorsOpenAt?.toISOString() ?? event?.startsAt?.toISOString(),
    soundcheckTime: event?.soundcheckAt?.toISOString() ?? event?.startsAt?.toISOString(),
    operationalMoments: asObjectArray(payload.operationalMoments),
    operationMode: payload.operationMode ?? "auto",
    ticketPriceMXN: Number(event?.baseTicketPrice ?? 0),
    ticketFeeMXN: Number(event?.consumerProcessingFeeFixed ?? 0),
    artistPayoutRate: Number(event?.artistPayoutRate ?? 0.7),
    capacity: event?.totalTicketInventory ?? 0,
    soldCount: event?.soldTicketInventory ?? 0,
    lineup: asStringArray(payload.lineup),
    genre: asStringArray(payload.genre),
    isPublished: event?.isPublished ?? false,
    publishedAt: event?.publishedAt?.toISOString(),
    createdAt: event?.createdAt?.toISOString(),
    updatedAt: event?.updatedAt?.toISOString(),
    draftPoster: payload.draftPoster,
    publishedPoster: payload.publishedPoster,
    posterDesign: payload.posterDesign,
    draftTicket: payload.draftTicket,
    publishedTicket: payload.publishedTicket,
    ticketDesign: payload.ticketDesign,
  });
}

async function ensureSeedFile() {
  try {
    await fs.access(eventsPath);
  } catch {
    await fs.mkdir(path.dirname(eventsPath), { recursive: true });
    await fs.writeFile(eventsPath, `${JSON.stringify(defaultEventSeeds, null, 2)}\n`, "utf8");
  }
}

async function getAllEventsFromFile(): Promise<VenueEventRecord[]> {
  await ensureSeedFile();

  try {
    const raw = await fs.readFile(eventsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<VenueEventRecord>[];
    return sortByStartDate(parsed.map(normalizeEventRecord));
  } catch {
    return sortByStartDate(defaultEventSeeds.map(normalizeEventRecord));
  }
}

async function saveAllEventsToFile(events: VenueEventRecord[]) {
  await fs.mkdir(path.dirname(eventsPath), { recursive: true });
  await fs.writeFile(
    eventsPath,
    `${JSON.stringify(sortByStartDate(events.map(normalizeEventRecord)), null, 2)}\n`,
    "utf8",
  );
}

async function getEventBySlugFromFile(slug: string) {
  const events = await getAllEventsFromFile();
  return events.find((event) => event.slug === slug) ?? null;
}

async function getUpcomingPublicEventsFromFile() {
  const events = await getAllEventsFromFile();
  return events.filter((event) => event.isPublished).map(withAvailability);
}

async function upsertEventRecordToFile(
  incoming: Omit<VenueEventRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
) {
  const events = await getAllEventsFromFile();
  const now = new Date().toISOString();
  const nextSlugBase = normalizeSlug(incoming.slug || incoming.title) || `event-${randomUUID().slice(0, 8)}`;
  const current = events.find((event) => event.id === incoming.id || event.slug === incoming.slug);

  let slug = nextSlugBase;
  let suffix = 2;

  while (events.some((event) => event.slug === slug && event.id !== current?.id)) {
    slug = `${nextSlugBase}-${suffix}`;
    suffix += 1;
  }

  const designVariant = getEventInviteStyle(incoming.designVariant ?? inferPosterVariant(incoming)).id;
  const designMotifs = normalizeEventMotifs(incoming.designMotifs, designVariant);

  const nextEventBase: VenueEventRecord = {
    id: current?.id ?? randomUUID(),
    slug,
    title: incoming.title,
    summary: incoming.summary,
    description: incoming.description,
    startsAt: incoming.startsAt,
    endsAt: incoming.endsAt,
    timezone: incoming.timezone,
    venueName: incoming.venueName,
    venueAddress: incoming.venueAddress,
    heroImage: incoming.heroImage,
    designVariant,
    designTemplateId: incoming.designTemplateId,
    ticketTemplateId: incoming.ticketTemplateId,
    designMotifs,
    posterVisibleFields:
      incoming.posterVisibleFields?.filter((field): field is (typeof posterVisibleFieldIds)[number] =>
        posterVisibleFieldIds.includes(field as (typeof posterVisibleFieldIds)[number]),
      ) ?? [...posterVisibleFieldIds],
    posterArtDirection: incoming.posterArtDirection,
    posterReferenceUrls: incoming.posterReferenceUrls,
    posterAssetMode: incoming.posterAssetMode,
    posterTextOverlayMode: incoming.posterTextOverlayMode,
    posterOverlayLayout: incoming.posterOverlayLayout,
    doorTime: incoming.doorTime,
    soundcheckTime: incoming.soundcheckTime,
    operationalMoments: incoming.operationalMoments,
    ticketPriceMXN: incoming.ticketPriceMXN,
    ticketFeeMXN: incoming.ticketFeeMXN,
    artistPayoutRate: incoming.artistPayoutRate,
    capacity: incoming.capacity,
    soldCount: incoming.soldCount,
    operationMode: incoming.operationMode ?? "auto",
    lineup: incoming.lineup,
    genre: incoming.genre,
    isPublished: incoming.isPublished,
    publishedAt: current?.publishedAt,
    posterAssets: incoming.posterAssets,
    activePosterAssetId: incoming.activePosterAssetId,
    ticketAssets: incoming.ticketAssets,
    activeTicketAssetId: incoming.activeTicketAssetId,
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };
  const draftPoster = buildPosterDesign(nextEventBase, now);
  const draftTicket = buildTicketDesign(nextEventBase, draftPoster, now);
  const posterAssets = normalizePosterAssets(
    {
      ...nextEventBase,
      posterAssets: incoming.posterAssets ?? current?.posterAssets ?? [],
      posterReferenceUrls: incoming.posterReferenceUrls ?? current?.posterReferenceUrls ?? [],
    },
    now,
  );
  const activePosterAssetId = resolveActivePosterAssetId(
    {
      ...nextEventBase,
      activePosterAssetId: incoming.activePosterAssetId,
    },
    posterAssets,
  );
  const ticketAssets = normalizeTicketAssets(
    {
      ...nextEventBase,
      ticketAssets: current?.ticketAssets ?? [],
      activeTicketAssetId: incoming.activeTicketAssetId,
    },
    draftTicket,
    activePosterAssetId,
    now,
  );
  const activeTicketAssetId = resolveActiveTicketAssetId(
    {
      ...nextEventBase,
      activeTicketAssetId: incoming.activeTicketAssetId,
    },
    ticketAssets,
  );
  const nextEvent: VenueEventRecord = {
    ...nextEventBase,
    posterAssets,
    activePosterAssetId,
    ticketAssets,
    activeTicketAssetId,
    draftPoster,
    draftTicket,
    publishedPoster: incoming.isPublished ? draftPoster : current?.publishedPoster,
    publishedTicket: incoming.isPublished ? draftTicket : current?.publishedTicket,
    publishedAt: incoming.isPublished ? now : current?.publishedAt,
    posterDesign: incoming.isPublished ? draftPoster : current?.publishedPoster ?? draftPoster,
    ticketDesign: incoming.isPublished ? draftTicket : current?.publishedTicket ?? draftTicket,
  };

  const nextEvents = current
    ? events.map((event) => (event.id === current.id ? nextEvent : event))
    : [...events, nextEvent];

  await saveAllEventsToFile(nextEvents);

  return nextEvent;
}

async function deleteEventRecordFromFile(id: string) {
  const events = await getAllEventsFromFile();
  const target = events.find((event) => event.id === id);

  if (!target) {
    return null;
  }

  const nextEvents = events.filter((event) => event.id !== id);
  await saveAllEventsToFile(nextEvents);
  return target;
}

async function seedPrismaEventsIfEmpty() {
  const existingCount = await prisma.event.count();

  if (existingCount > 0) {
    return;
  }

  for (const seed of defaultEventSeeds.map(normalizeEventRecord)) {
    await upsertEventRecord(seed);
  }
}

async function getAllEventsFromPrisma(): Promise<VenueEventRecord[]> {
  await seedPrismaEventsIfEmpty();

  const events = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      venue: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return events.map(mapPrismaEventToVenueRecord);
}

async function getEventBySlugFromPrisma(slug: string) {
  await seedPrismaEventsIfEmpty();

  const event = await prisma.event.findFirst({
    where: { slug },
    include: {
      venue: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return event ? mapPrismaEventToVenueRecord(event) : null;
}

async function getUpcomingPublicEventsFromPrisma() {
  const events = await getAllEventsFromPrisma();
  return events.filter((event) => event.isPublished).map(withAvailability);
}

async function upsertEventRecordToPrisma(
  incoming: Omit<VenueEventRecord, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  const now = new Date().toISOString();
  const currentEvents = (
    await prisma.event.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        venue: {
          select: {
            displayName: true,
          },
        },
      },
    })
  ).map(mapPrismaEventToVenueRecord);
  const current = currentEvents.find((event) => event.id === incoming.id || event.slug === incoming.slug);
  const nextSlugBase = normalizeSlug(incoming.slug || incoming.title) || `event-${randomUUID().slice(0, 8)}`;

  let slug = nextSlugBase;
  let suffix = 2;

  while (currentEvents.some((event) => event.slug === slug && event.id !== current?.id)) {
    slug = `${nextSlugBase}-${suffix}`;
    suffix += 1;
  }

  const designVariant = getEventInviteStyle(incoming.designVariant ?? inferPosterVariant(incoming)).id;
  const designMotifs = normalizeEventMotifs(incoming.designMotifs, designVariant);
  const nextEventBase: VenueEventRecord = {
    id: current?.id ?? randomUUID(),
    slug,
    title: incoming.title,
    summary: incoming.summary,
    description: incoming.description,
    startsAt: incoming.startsAt,
    endsAt: incoming.endsAt,
    timezone: incoming.timezone,
    venueName: incoming.venueName,
    venueAddress: incoming.venueAddress,
    heroImage: incoming.heroImage,
    designVariant,
    designTemplateId: incoming.designTemplateId,
    ticketTemplateId: incoming.ticketTemplateId,
    designMotifs,
    posterVisibleFields:
      incoming.posterVisibleFields?.filter((field): field is (typeof posterVisibleFieldIds)[number] =>
        posterVisibleFieldIds.includes(field as (typeof posterVisibleFieldIds)[number]),
      ) ?? [...posterVisibleFieldIds],
    posterArtDirection: incoming.posterArtDirection,
    posterReferenceUrls: incoming.posterReferenceUrls,
    posterAssetMode: incoming.posterAssetMode,
    posterTextOverlayMode: incoming.posterTextOverlayMode,
    posterOverlayLayout: incoming.posterOverlayLayout,
    doorTime: incoming.doorTime,
    soundcheckTime: incoming.soundcheckTime,
    operationalMoments: incoming.operationalMoments,
    ticketPriceMXN: incoming.ticketPriceMXN,
    ticketFeeMXN: incoming.ticketFeeMXN,
    artistPayoutRate: incoming.artistPayoutRate,
    capacity: incoming.capacity,
    soldCount: incoming.soldCount,
    operationMode: incoming.operationMode ?? "auto",
    lineup: incoming.lineup,
    genre: incoming.genre,
    isPublished: incoming.isPublished,
    publishedAt: current?.publishedAt,
    posterAssets: incoming.posterAssets,
    activePosterAssetId: incoming.activePosterAssetId,
    ticketAssets: incoming.ticketAssets,
    activeTicketAssetId: incoming.activeTicketAssetId,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };

  const draftPoster = buildPosterDesign(nextEventBase, now);
  const draftTicket = buildTicketDesign(nextEventBase, draftPoster, now);
  const posterAssets = normalizePosterAssets(
    {
      ...nextEventBase,
      posterAssets: incoming.posterAssets ?? current?.posterAssets ?? [],
      posterReferenceUrls: incoming.posterReferenceUrls ?? current?.posterReferenceUrls ?? [],
    },
    now,
  );
  const activePosterAssetId = resolveActivePosterAssetId(
    {
      ...nextEventBase,
      activePosterAssetId: incoming.activePosterAssetId,
    },
    posterAssets,
  );
  const ticketAssets = normalizeTicketAssets(
    {
      ...nextEventBase,
      ticketAssets: current?.ticketAssets ?? [],
      activeTicketAssetId: incoming.activeTicketAssetId,
    },
    draftTicket,
    activePosterAssetId,
    now,
  );
  const activeTicketAssetId = resolveActiveTicketAssetId(
    {
      ...nextEventBase,
      activeTicketAssetId: incoming.activeTicketAssetId,
    },
    ticketAssets,
  );
  const nextEvent: VenueEventRecord = {
    ...nextEventBase,
    posterAssets,
    activePosterAssetId,
    ticketAssets,
    activeTicketAssetId,
    draftPoster,
    draftTicket,
    publishedPoster: incoming.isPublished ? draftPoster : current?.publishedPoster,
    publishedTicket: incoming.isPublished ? draftTicket : current?.publishedTicket,
    publishedAt: incoming.isPublished ? now : current?.publishedAt,
    posterDesign: incoming.isPublished ? draftPoster : current?.publishedPoster ?? draftPoster,
    ticketDesign: incoming.isPublished ? draftTicket : current?.publishedTicket ?? draftTicket,
  };

  const { venue, organizer } = await ensureVenueConsoleContext();
  const saved = await prisma.event.upsert({
    where: { id: current?.id ?? incoming.id ?? "__new__" },
    create: {
      venueId: venue.id,
      organizerUserId: organizer.id,
      slug: nextEvent.slug,
      title: nextEvent.title,
      description: nextEvent.description,
      status: nextEvent.isPublished ? EventStatus.SCHEDULED : EventStatus.DRAFT,
      startsAt: new Date(nextEvent.startsAt),
      endsAt: new Date(nextEvent.endsAt),
      doorsOpenAt: toPrismaDate(nextEvent.doorTime),
      soundcheckAt: toPrismaDate(nextEvent.soundcheckTime),
      timezone: nextEvent.timezone,
      totalTicketInventory: nextEvent.capacity,
      soldTicketInventory: nextEvent.soldCount,
      baseTicketPrice: prismaDecimal(nextEvent.ticketPriceMXN),
      consumerProcessingFeeFixed: prismaDecimal(nextEvent.ticketFeeMXN),
      artistPayoutRate: prismaDecimal(nextEvent.artistPayoutRate),
      isPublished: nextEvent.isPublished,
      publishedAt: nextEvent.publishedAt ? new Date(nextEvent.publishedAt) : null,
      consolePayload: buildConsolePayload(nextEvent),
    },
    update: {
      slug: nextEvent.slug,
      title: nextEvent.title,
      description: nextEvent.description,
      status: nextEvent.isPublished ? EventStatus.SCHEDULED : EventStatus.DRAFT,
      startsAt: new Date(nextEvent.startsAt),
      endsAt: new Date(nextEvent.endsAt),
      doorsOpenAt: toPrismaDate(nextEvent.doorTime),
      soundcheckAt: toPrismaDate(nextEvent.soundcheckTime),
      timezone: nextEvent.timezone,
      totalTicketInventory: nextEvent.capacity,
      soldTicketInventory: nextEvent.soldCount,
      baseTicketPrice: prismaDecimal(nextEvent.ticketPriceMXN),
      consumerProcessingFeeFixed: prismaDecimal(nextEvent.ticketFeeMXN),
      artistPayoutRate: prismaDecimal(nextEvent.artistPayoutRate),
      isPublished: nextEvent.isPublished,
      publishedAt: nextEvent.publishedAt ? new Date(nextEvent.publishedAt) : null,
      consolePayload: buildConsolePayload(nextEvent),
    },
    include: {
      venue: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return mapPrismaEventToVenueRecord(saved);
}

async function deleteEventRecordFromPrisma(id: string) {
  const existing = await prisma.event.findUnique({
    where: { id },
    include: {
      venue: {
        select: {
          displayName: true,
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  await prisma.event.delete({ where: { id } });
  return mapPrismaEventToVenueRecord(existing);
}

export async function getAllEvents(): Promise<VenueEventRecord[]> {
  if (!shouldUsePrismaEvents()) {
    return getAllEventsFromFile();
  }

  try {
    return await getAllEventsFromPrisma();
  } catch {
    return getAllEventsFromFile();
  }
}

export async function saveAllEvents(events: VenueEventRecord[]) {
  if (!shouldUsePrismaEvents()) {
    return saveAllEventsToFile(events);
  }

  for (const event of events) {
    await upsertEventRecordToPrisma(event);
  }
}

export async function getEventBySlug(slug: string) {
  if (!shouldUsePrismaEvents()) {
    return getEventBySlugFromFile(slug);
  }

  try {
    return await getEventBySlugFromPrisma(slug);
  } catch {
    return getEventBySlugFromFile(slug);
  }
}

export async function getUpcomingPublicEvents() {
  if (!shouldUsePrismaEvents()) {
    return getUpcomingPublicEventsFromFile();
  }

  try {
    return await getUpcomingPublicEventsFromPrisma();
  } catch {
    return getUpcomingPublicEventsFromFile();
  }
}

export async function upsertEventRecord(
  incoming: Omit<VenueEventRecord, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  if (!shouldUsePrismaEvents()) {
    return upsertEventRecordToFile(incoming);
  }

  try {
    return await upsertEventRecordToPrisma(incoming);
  } catch {
    return upsertEventRecordToFile(incoming);
  }
}

export async function deleteEventRecord(id: string) {
  if (!shouldUsePrismaEvents()) {
    return deleteEventRecordFromFile(id);
  }

  try {
    return await deleteEventRecordFromPrisma(id);
  } catch {
    return deleteEventRecordFromFile(id);
  }
}
