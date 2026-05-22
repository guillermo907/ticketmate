import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaultEventSeeds } from "./mock-events";
import { buildPosterDesign, inferPosterVariant } from "./poster-designer";
import {
  getEventInviteStyle,
  normalizeEventMotifs,
  posterVisibleFieldIds,
  type PublicEventCard,
  type VenueEventRecord,
} from "./event-types";

const eventsPath = path.join(process.cwd(), "data", "events.json");

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

function normalizeEventRecord(event: Partial<VenueEventRecord>): VenueEventRecord {
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
    designMotifs,
    posterVisibleFields: Array.isArray(event.posterVisibleFields)
      ? event.posterVisibleFields.filter((field): field is (typeof posterVisibleFieldIds)[number] =>
          posterVisibleFieldIds.includes(field as (typeof posterVisibleFieldIds)[number]),
        )
      : [...posterVisibleFieldIds],
    posterArtDirection: event.posterArtDirection ?? "",
    posterReferenceUrls: Array.isArray(event.posterReferenceUrls) ? event.posterReferenceUrls.filter(Boolean) : [],
    posterAssetMode: event.posterAssetMode ?? "graphic-only",
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
    lineup: Array.isArray(event.lineup) ? event.lineup : [],
    genre: Array.isArray(event.genre) ? event.genre : [],
    isPublished: event.isPublished ?? false,
    publishedAt: event.publishedAt,
    createdAt: event.createdAt ?? new Date().toISOString(),
    updatedAt: event.updatedAt ?? new Date().toISOString()
  };

  const draftPoster = hydratePosterDesign(
    normalizedEvent,
    event.draftPoster ?? event.posterDesign ?? event.publishedPoster,
  );
  const publishedPoster = normalizedEvent.isPublished
    ? hydratePosterDesign(normalizedEvent, event.publishedPoster ?? event.posterDesign ?? draftPoster)
    : undefined;

  return {
    ...normalizedEvent,
    draftPoster,
    publishedPoster,
    posterDesign: publishedPoster ?? draftPoster,
  };
}

async function ensureSeedFile() {
  try {
    await fs.access(eventsPath);
  } catch {
    await fs.mkdir(path.dirname(eventsPath), { recursive: true });
    await fs.writeFile(eventsPath, `${JSON.stringify(defaultEventSeeds, null, 2)}\n`, "utf8");
  }
}

export async function getAllEvents(): Promise<VenueEventRecord[]> {
  await ensureSeedFile();

  try {
    const raw = await fs.readFile(eventsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<VenueEventRecord>[];
    return sortByStartDate(parsed.map(normalizeEventRecord));
  } catch {
    return sortByStartDate(defaultEventSeeds.map(normalizeEventRecord));
  }
}

export async function saveAllEvents(events: VenueEventRecord[]) {
  await fs.mkdir(path.dirname(eventsPath), { recursive: true });
  await fs.writeFile(
    eventsPath,
    `${JSON.stringify(sortByStartDate(events.map(normalizeEventRecord)), null, 2)}\n`,
    "utf8",
  );
}

export async function getEventBySlug(slug: string) {
  const events = await getAllEvents();
  return events.find((event) => event.slug === slug) ?? null;
}

export async function getUpcomingPublicEvents() {
  const events = await getAllEvents();
  return events.filter((event) => event.isPublished).map(withAvailability);
}

export async function upsertEventRecord(
  incoming: Omit<VenueEventRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
) {
  const events = await getAllEvents();
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
    designMotifs,
    posterVisibleFields:
      incoming.posterVisibleFields?.filter((field): field is (typeof posterVisibleFieldIds)[number] =>
        posterVisibleFieldIds.includes(field as (typeof posterVisibleFieldIds)[number]),
      ) ?? [...posterVisibleFieldIds],
    posterArtDirection: incoming.posterArtDirection,
    posterReferenceUrls: incoming.posterReferenceUrls,
    posterAssetMode: incoming.posterAssetMode,
    doorTime: incoming.doorTime,
    soundcheckTime: incoming.soundcheckTime,
    operationalMoments: incoming.operationalMoments,
    ticketPriceMXN: incoming.ticketPriceMXN,
    ticketFeeMXN: incoming.ticketFeeMXN,
    artistPayoutRate: incoming.artistPayoutRate,
    capacity: incoming.capacity,
    soldCount: incoming.soldCount,
    lineup: incoming.lineup,
    genre: incoming.genre,
    isPublished: incoming.isPublished,
    publishedAt: current?.publishedAt,
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };
  const draftPoster = buildPosterDesign(nextEventBase, now);
  const nextEvent: VenueEventRecord = {
    ...nextEventBase,
    draftPoster,
    publishedPoster: incoming.isPublished ? draftPoster : current?.publishedPoster,
    publishedAt: incoming.isPublished ? now : current?.publishedAt,
    posterDesign: incoming.isPublished ? draftPoster : current?.publishedPoster ?? draftPoster,
  };

  const nextEvents = current
    ? events.map((event) => (event.id === current.id ? nextEvent : event))
    : [...events, nextEvent];

  await saveAllEvents(nextEvents);

  return nextEvent;
}

export async function deleteEventRecord(id: string) {
  const events = await getAllEvents();
  const target = events.find((event) => event.id === id);

  if (!target) {
    return null;
  }

  const nextEvents = events.filter((event) => event.id !== id);
  await saveAllEvents(nextEvents);
  return target;
}
