"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  posterVisibleFieldIds,
  type EventOperationMode,
  type EventInviteStyleId,
  type EventOperationalMoment,
  type EventPosterAsset,
  type EventPosterAssetSnapshot,
  type EventPosterOriginMode,
  type PosterOverlayLayoutConfig,
  type EventVisualMotifId,
  type PosterAssetMode,
  type PosterVisibleFieldId,
  type PosterTextOverlayMode,
  type VenueEventRecord,
} from "@/lib/event-types";
import type { PosterTemplateId } from "@/lib/poster-designer";
import { deletePublicAsset, savePublicAsset } from "@/lib/storage";
import { deleteEventRecord, getAllEvents, upsertEventRecord } from "@/lib/events";

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

function parsePosterAssetsPayload(raw: string): EventPosterAsset[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((asset): asset is EventPosterAsset => {
      if (!asset || typeof asset !== "object") {
        return false;
      }

      const candidate = asset as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.url === "string" &&
        typeof candidate.label === "string" &&
        typeof candidate.source === "string"
      );
    });
  } catch {
    return [];
  }
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

async function saveEventPosterUploadAsset(file: File, eventTitle: string, artDirection: string): Promise<EventPosterAsset> {
  const now = new Date().toISOString();
  const contentType = file.type || "image/jpeg";
  const extension = file.name.split(".").pop()?.toLowerCase() || extensionFromContentType(contentType);
  const safeFolder = slugifyAssetFolder(eventTitle);
  const assetName = `poster-upload-${randomUUID()}.${extension}`;
  const storedUrl = await savePublicAsset({
    body: Buffer.from(await file.arrayBuffer()),
    contentType,
    localPath: `uploads/events/${safeFolder}/posters/${assetName}`,
    pathname: `assets/events/${safeFolder}/posters/${assetName}`,
  });

  return {
    id: `poster-${randomUUID()}`,
    kind: "poster",
    url: storedUrl,
    source: "uploaded",
    label: "Poster subido",
    status: "draft",
    revision: 1,
    provider: "user-upload",
    prompt: artDirection,
    createdAt: now,
    updatedAt: now,
  };
}

async function saveEventPosterUploadIfPresent(formData: FormData, eventTitle: string, artDirection: string) {
  const file = formData.get("posterUploadFile");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  return saveEventPosterUploadAsset(file, eventTitle, artDirection);
}

function slugifyAssetFolder(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "event";
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  if (contentType.includes("gif")) {
    return "gif";
  }

  return "jpg";
}

function isStoredAssetUrl(url: string) {
  return (
    url.startsWith("/uploads/") ||
    url.startsWith("/api/blob/") ||
    url.startsWith("/events/") ||
    url.startsWith("/gallery/")
  );
}

function inferPosterProvider(url: string) {
  if (url.includes("pollinations.ai")) {
    return "pollinations";
  }

  if (url.includes("huggingface.co")) {
    return "huggingface";
  }

  if (url.includes("together")) {
    return "together";
  }

  return "external";
}

async function materializePosterAsset(url: string, eventTitle: string, artDirection: string): Promise<EventPosterAsset> {
  const now = new Date().toISOString();

  if (isStoredAssetUrl(url)) {
    return {
      id: `poster-${randomUUID()}`,
      kind: "poster",
      url,
      source: url.startsWith("/uploads/") || url.startsWith("/api/blob/") ? "materialized" : "legacy",
      label: "Poster guardado",
      status: "draft",
      revision: 1,
      provider: url.startsWith("/uploads/") || url.startsWith("/api/blob/") ? "foro-storage" : "local-public",
      prompt: artDirection,
      createdAt: now,
      updatedAt: now,
    };
  }

  const parsed = new URL(url);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("El poster generado no se pudo guardar como asset persistente.");
  }

  const response = await fetch(parsed, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error("No se pudo descargar el poster generado para guardarlo.");
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error("El asset generado no parece ser una imagen valida.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const maxPosterBytes = 15 * 1024 * 1024;

  if (bytes.length > maxPosterBytes) {
    throw new Error("El poster generado es demasiado grande para guardarlo.");
  }

  const safeFolder = slugifyAssetFolder(eventTitle);
  const extension = extensionFromContentType(contentType);
  const assetName = `poster-${randomUUID()}.${extension}`;
  const storedUrl = await savePublicAsset({
    body: bytes,
    contentType,
    localPath: `uploads/events/${safeFolder}/posters/${assetName}`,
    pathname: `assets/events/${safeFolder}/posters/${assetName}`,
  });

  return {
    id: `poster-${randomUUID()}`,
    kind: "poster",
    url: storedUrl,
    source: "materialized",
    label: "Poster generado",
    status: "draft",
    revision: 1,
    provider: inferPosterProvider(url),
    prompt: artDirection,
    createdAt: now,
    updatedAt: now,
  };
}

async function materializePosterAssets(urls: string[], eventTitle: string, artDirection: string) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  const assets = await Promise.all(
    uniqueUrls.map((url) => materializePosterAsset(url, eventTitle, artDirection)),
  );

  return {
    urls: assets.map((asset) => asset.url),
    assets,
  };
}

function inferPosterOriginMode(
  requestedOriginMode: EventPosterOriginMode | undefined,
  posterAssetMode: PosterAssetMode | undefined,
  source: EventPosterAsset["source"],
): EventPosterOriginMode {
  if (requestedOriginMode === "ai" || requestedOriginMode === "upload" || requestedOriginMode === "local") {
    return requestedOriginMode;
  }

  if (source === "uploaded" || posterAssetMode === "uploaded-hero") {
    return "upload";
  }

  return "local";
}

function buildPosterAssetSnapshotFromForm(input: {
  title: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  heroImage: string;
  lineup: string[];
  genre: string[];
  designVariant?: EventInviteStyleId;
  designTemplateId?: PosterTemplateId;
  designMotifs: EventVisualMotifId[];
  posterVisibleFields: PosterVisibleFieldId[];
  posterArtDirection: string;
  posterReferenceUrls: string[];
  posterAssetMode?: PosterAssetMode;
  posterTextOverlayMode?: PosterTextOverlayMode;
  posterOverlayLayout?: PosterOverlayLayoutConfig;
}): EventPosterAssetSnapshot {
  return {
    title: input.title,
    summary: input.summary,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    heroImage: input.heroImage,
    lineup: input.lineup,
    genre: input.genre,
    designVariant: input.designVariant,
    designTemplateId: input.designTemplateId,
    designMotifs: input.designMotifs,
    posterVisibleFields: input.posterVisibleFields,
    posterArtDirection: input.posterArtDirection,
    posterReferenceUrls: input.posterReferenceUrls,
    posterAssetMode: input.posterAssetMode,
    posterTextOverlayMode: input.posterTextOverlayMode,
    posterOverlayLayout: input.posterOverlayLayout,
  };
}

function nextPosterRevision(existingAssets: EventPosterAsset[]) {
  return existingAssets.reduce((maxRevision, asset) => Math.max(maxRevision, asset.revision || 0), 0) + 1;
}

function sortPosterAssets(assets: EventPosterAsset[]) {
  return [...assets].sort((left, right) => {
    const rightDate = new Date(right.updatedAt || right.createdAt).getTime();
    const leftDate = new Date(left.updatedAt || left.createdAt).getTime();

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return (right.revision || 0) - (left.revision || 0);
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
    const operationMode = ((getString(formData, "operationMode") || "auto") as EventOperationMode);

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

    const posterArtDirection = getString(formData, "posterArtDirection");
    const designVariant = (getString(formData, "designVariant") || undefined) as EventInviteStyleId | undefined;
    const designTemplateId = (getString(formData, "designTemplateId") || undefined) as PosterTemplateId | undefined;
    const ticketTemplateId = (getString(formData, "ticketTemplateId") || undefined) as VenueEventRecord["ticketTemplateId"];
    const designMotifs = splitList(getString(formData, "designMotifs")) as EventVisualMotifId[];
    const posterVisibleFields = splitList(getString(formData, "posterVisibleFields")).filter(
      (field): field is PosterVisibleFieldId => posterVisibleFieldIds.includes(field as PosterVisibleFieldId),
    );
    const posterAssetMode = (getString(formData, "posterAssetMode") || "graphic-only") as PosterAssetMode;
    const requestedPosterOriginMode = (getString(formData, "posterOriginMode") || undefined) as EventPosterOriginMode | undefined;
    const posterTextOverlayMode = (getString(formData, "posterTextOverlayMode") || "editorial-band") as PosterTextOverlayMode;
    const posterOverlayLayout = (() => {
      const raw = getString(formData, "posterOverlayLayout");
      if (!raw) {
        return undefined;
      }
      try {
        return JSON.parse(raw) as PosterOverlayLayoutConfig;
      } catch {
        return undefined;
      }
    })();
    const existingPosterAssets = sortPosterAssets(parsePosterAssetsPayload(getString(formData, "posterAssetsPayload")));
    const requestedActivePosterAssetId = getString(formData, "activePosterAssetId") || undefined;
    const currentPosterUrls = splitList(getString(formData, "posterReferenceUrls"));
    const uploadedPosterAsset = await saveEventPosterUploadIfPresent(formData, title, posterArtDirection);
    const currentActiveAsset = requestedActivePosterAssetId
      ? existingPosterAssets.find((asset) => asset.id === requestedActivePosterAssetId)
      : undefined;

    let currentPosterAsset: EventPosterAsset | null = null;
    let persistedPosterUrls = currentPosterUrls;

    if (uploadedPosterAsset) {
      currentPosterAsset = uploadedPosterAsset;
      persistedPosterUrls = [uploadedPosterAsset.url];
    } else if (currentPosterUrls[0] && currentActiveAsset?.url === currentPosterUrls[0]) {
      currentPosterAsset = {
        ...currentActiveAsset,
        updatedAt: new Date().toISOString(),
      };
      persistedPosterUrls = [currentActiveAsset.url];
    } else if (currentPosterUrls.length > 0) {
      const materializedPosters = await materializePosterAssets(currentPosterUrls, title, posterArtDirection);
      currentPosterAsset = materializedPosters.assets[0] ?? null;
      persistedPosterUrls = materializedPosters.urls;
    } else if (currentActiveAsset?.url) {
      currentPosterAsset = currentActiveAsset;
      persistedPosterUrls = [currentActiveAsset.url];
    }

    const isPublished = formData
      .getAll("isPublished")
      .some((value) => String(value).trim().toLowerCase() === "on");
    const currentHeroImage = uploadedHero || existingHeroImage || "/events/stage1.jpg";
    const existingEventId = getString(formData, "id");
    const existingEventSlug = getString(formData, "slug");
    const allEvents = existingEventId || existingEventSlug ? await getAllEvents() : [];
    const persistedEvent = existingEventId || existingEventSlug
      ? allEvents.find((event) => event.id === existingEventId || event.slug === existingEventSlug)
      : null;
    const posterSnapshot = buildPosterAssetSnapshotFromForm({
      title,
      summary,
      description,
      startsAt,
      endsAt,
      venueName,
      venueAddress,
      heroImage: currentHeroImage,
      lineup: splitList(getString(formData, "lineup")),
      genre: splitList(getString(formData, "genre")),
      designVariant,
      designTemplateId,
      designMotifs,
      posterVisibleFields,
      posterArtDirection,
      posterReferenceUrls: persistedPosterUrls,
      posterAssetMode,
      posterTextOverlayMode,
      posterOverlayLayout,
    });

    let nextPosterAssets = existingPosterAssets;
    let activePosterAssetId = requestedActivePosterAssetId;

    if (currentPosterAsset?.url) {
      const now = new Date().toISOString();
      const existingRevision = existingPosterAssets.find((asset) => asset.id === currentPosterAsset.id);
      const nextRevision = existingRevision?.revision ?? nextPosterRevision(existingPosterAssets);
      const nextAsset: EventPosterAsset = {
        ...existingRevision,
        ...currentPosterAsset,
        kind: "poster",
        label:
          existingRevision?.label ??
          (currentPosterAsset.source === "uploaded"
            ? "Poster subido"
            : currentPosterAsset.source === "materialized"
              ? "Poster generado"
              : "Poster guardado"),
        status: isPublished ? "published" : "draft",
        revision: nextRevision,
        originMode:
          existingRevision?.originMode ??
          inferPosterOriginMode(requestedPosterOriginMode, posterAssetMode, currentPosterAsset.source),
        artDirection: posterArtDirection,
        assetMode: posterAssetMode,
        overlayMode: posterTextOverlayMode,
        templateId: designTemplateId,
        prompt: posterArtDirection,
        snapshot: posterSnapshot,
        selectedAt: now,
        publishedAt: isPublished ? now : existingRevision?.publishedAt,
        archivedAt: existingRevision?.archivedAt,
        createdAt: existingRevision?.createdAt ?? currentPosterAsset.createdAt ?? now,
        updatedAt: now,
      };

      nextPosterAssets = existingPosterAssets
        .filter((asset) => asset.id !== nextAsset.id)
        .map((asset) =>
          isPublished && asset.status === "published"
            ? {
                ...asset,
                status: "archived",
                archivedAt: asset.archivedAt ?? now,
                updatedAt: now,
              }
            : asset,
        );
      nextPosterAssets = sortPosterAssets([nextAsset, ...nextPosterAssets]);
      activePosterAssetId = nextAsset.id;
      persistedPosterUrls = [nextAsset.url];
    } else {
      nextPosterAssets = sortPosterAssets(existingPosterAssets);
      const selectedAsset = activePosterAssetId
        ? nextPosterAssets.find((asset) => asset.id === activePosterAssetId)
        : nextPosterAssets[0];
      persistedPosterUrls = selectedAsset?.url ? [selectedAsset.url] : [];
      activePosterAssetId = selectedAsset?.id;
    }

    const removedPosterAssets = (persistedEvent?.posterAssets ?? []).filter(
      (asset) => !nextPosterAssets.some((candidate) => candidate.id === asset.id),
    );

    await Promise.all(
      removedPosterAssets.map(async (asset) => {
        const stillReferenced = nextPosterAssets.some((candidate) => candidate.url === asset.url);
        const referencedElsewhere = allEvents.some((event) =>
          event.id !== persistedEvent?.id &&
          (event.posterAssets ?? []).some((candidate) => candidate.url === asset.url),
        );

        if (!stillReferenced && !referencedElsewhere) {
          await deletePublicAsset(asset.url);
        }
      }),
    );

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
      heroImage: currentHeroImage,
      designVariant,
      designTemplateId,
      ticketTemplateId,
      designMotifs,
      posterVisibleFields,
      posterArtDirection,
      posterReferenceUrls: persistedPosterUrls,
      posterAssetMode,
      posterTextOverlayMode,
      posterOverlayLayout,
      posterAssets: nextPosterAssets,
      activePosterAssetId,
      doorTime: doorTimeValue,
      soundcheckTime: soundcheckTimeValue,
      operationalMoments,
      ticketPriceMXN: Math.max(0, getNumber(formData, "ticketPriceMXN", 280)),
      ticketFeeMXN: Math.max(0, getNumber(formData, "ticketFeeMXN", 15)),
      artistPayoutRate: Math.max(0, Math.min(1, getNumber(formData, "artistPayoutRate", 0.7))),
      capacity,
      soldCount,
      operationMode,
      lineup: posterSnapshot.lineup,
      genre: posterSnapshot.genre,
      isPublished
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
