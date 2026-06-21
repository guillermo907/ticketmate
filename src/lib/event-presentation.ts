import type {
  EventPosterAsset,
  EventTicketDesign,
  PosterTextOverlayMode,
  VenueEventRecord,
} from "./event-types";
import type { EventPosterDesign } from "./poster-designer";
import { buildPosterDesign } from "./poster-designer";
import { buildTicketDesign } from "./ticket-designer";

export type PosterCompositeRenderModel = {
  event: VenueEventRecord;
  posterUrl: string;
  overlayMode: PosterTextOverlayMode;
  artworkFit: "cover" | "contain";
};

function resolvePosterArtworkFit(
  posterAsset: EventPosterAsset | null,
  overlayMode: PosterTextOverlayMode,
): "cover" | "contain" {
  const isUploadedPoster = posterAsset?.assetMode === "uploaded-hero" || posterAsset?.source === "uploaded";

  if (!isUploadedPoster) {
    return "cover";
  }

  return overlayMode === "none" ? "contain" : "cover";
}

export type TicketCompositeRenderModel = {
  event: VenueEventRecord;
  ticketDesign: EventTicketDesign;
  artworkUrl?: string;
};

export function resolveActivePosterAsset(event: Partial<VenueEventRecord> | null | undefined) {
  if (!event) {
    return undefined;
  }

  return event.posterAssets?.find((asset) => asset.id === event.activePosterAssetId);
}

export function resolvePrimaryPosterUrl(event: Partial<VenueEventRecord> | null | undefined) {
  const activePosterAsset = resolveActivePosterAsset(event);

  return activePosterAsset?.url ?? event?.posterReferenceUrls?.find(Boolean) ?? event?.heroImage ?? "";
}

export function resolvePosterRuntimeEvent(
  event: VenueEventRecord,
  options?: { preferLiveEditorState?: boolean },
): VenueEventRecord {
  if (options?.preferLiveEditorState) {
    return event;
  }

  const activePosterAsset = resolveActivePosterAsset(event);
  const snapshot = activePosterAsset?.snapshot;

  if (!snapshot) {
    return event;
  }

  return {
    ...event,
    title: snapshot.title || event.title,
    summary: snapshot.summary || event.summary,
    description: snapshot.description || event.description,
    startsAt: snapshot.startsAt || event.startsAt,
    endsAt: snapshot.endsAt || event.endsAt,
    venueName: snapshot.venueName || event.venueName,
    venueAddress: snapshot.venueAddress || event.venueAddress,
    heroImage: snapshot.heroImage || event.heroImage,
    lineup: snapshot.lineup?.length ? snapshot.lineup : event.lineup,
    genre: snapshot.genre?.length ? snapshot.genre : event.genre,
    designVariant: snapshot.designVariant ?? event.designVariant,
    designTemplateId: snapshot.designTemplateId ?? event.designTemplateId,
    designMotifs: snapshot.designMotifs?.length ? snapshot.designMotifs : event.designMotifs,
    posterVisibleFields: snapshot.posterVisibleFields?.length ? snapshot.posterVisibleFields : event.posterVisibleFields,
    posterArtDirection: snapshot.posterArtDirection || event.posterArtDirection,
    posterReferenceUrls: snapshot.posterReferenceUrls?.length ? snapshot.posterReferenceUrls : event.posterReferenceUrls,
    posterAssetMode: snapshot.posterAssetMode ?? activePosterAsset?.assetMode ?? event.posterAssetMode,
    posterTextOverlayMode:
      snapshot.posterTextOverlayMode ?? activePosterAsset?.overlayMode ?? event.posterTextOverlayMode,
    posterOverlayLayout: snapshot.posterOverlayLayout ?? event.posterOverlayLayout,
  };
}

export function resolvePosterPageDesign(event: VenueEventRecord) {
  const runtimeEvent = resolvePosterRuntimeEvent(event);
  const posterDesignCandidate =
    (runtimeEvent.isPublished ? runtimeEvent.publishedPoster : undefined) ??
    runtimeEvent.draftPoster ??
    runtimeEvent.posterDesign ??
    buildPosterDesign(runtimeEvent, runtimeEvent.updatedAt);

  const posterDesign = posterDesignCandidate.shellTheme
    ? posterDesignCandidate
    : buildPosterDesign(
        {
          ...runtimeEvent,
          designVariant: posterDesignCandidate.variant,
          designTemplateId: posterDesignCandidate.templateId,
          designMotifs: posterDesignCandidate.motifs,
        },
        posterDesignCandidate.generatedAt,
      );

  return {
    runtimeEvent,
    posterDesign,
  };
}

export function resolvePosterCompositeRenderModel(
  event: VenueEventRecord,
  options?: {
    posterUrl?: string;
    posterAsset?: EventPosterAsset | null;
    overlayMode?: PosterTextOverlayMode;
    artworkFit?: "cover" | "contain";
    preferLiveEditorState?: boolean;
  },
): PosterCompositeRenderModel {
  const runtimeEvent = resolvePosterRuntimeEvent(event, {
    preferLiveEditorState: options?.preferLiveEditorState,
  });
  const posterAsset = options?.posterAsset ?? resolveActivePosterAsset(runtimeEvent) ?? null;
  const posterUrl = options?.posterUrl ?? posterAsset?.url ?? resolvePrimaryPosterUrl(runtimeEvent);
  const overlayMode =
    options?.overlayMode ??
    posterAsset?.snapshot?.posterTextOverlayMode ??
    posterAsset?.overlayMode ??
    runtimeEvent.posterTextOverlayMode ??
    "editorial-band";
  const artworkFit = options?.artworkFit ?? resolvePosterArtworkFit(posterAsset, overlayMode);

  return {
    event: runtimeEvent,
    posterUrl,
    overlayMode,
    artworkFit,
  };
}

export function resolveTicketCompositeRenderModel(
  event: VenueEventRecord,
  options?: {
    ticketDesign?: EventTicketDesign;
    posterDesign?: EventPosterDesign;
    artworkUrl?: string;
    preferLiveEditorState?: boolean;
  },
): TicketCompositeRenderModel {
  const runtimeEvent = resolvePosterRuntimeEvent(event, {
    preferLiveEditorState: options?.preferLiveEditorState,
  });
  const posterDesign =
    options?.posterDesign ??
    runtimeEvent.publishedPoster ??
    runtimeEvent.draftPoster ??
    runtimeEvent.posterDesign ??
    buildPosterDesign(runtimeEvent, runtimeEvent.updatedAt);
  const ticketDesign =
    options?.ticketDesign ??
    runtimeEvent.publishedTicket ??
    runtimeEvent.draftTicket ??
    runtimeEvent.ticketDesign ??
    buildTicketDesign(runtimeEvent, posterDesign, runtimeEvent.updatedAt);

  return {
    event: runtimeEvent,
    ticketDesign,
    artworkUrl: options?.artworkUrl ?? resolvePrimaryPosterUrl(runtimeEvent),
  };
}
