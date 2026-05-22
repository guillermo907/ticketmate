import type { EventPosterDesign, PosterTemplateId } from "./poster-designer";

export const eventInviteStyleIds = ["jazz-poster", "club-grid", "festival-sunset"] as const;

export type EventInviteStyleId = (typeof eventInviteStyleIds)[number];

export const eventVisualMotifIds = [
  "music-notes",
  "paper-cuts",
  "equalizer-bars",
  "constellation-dots",
  "ticket-stamp",
  "wave-lines"
] as const;

export type EventVisualMotifId = (typeof eventVisualMotifIds)[number];

export const posterVisibleFieldIds = [
  "venue",
  "date",
  "address",
  "summary",
  "description",
  "schedule",
  "lineup",
  "genre",
  "pricing",
  "cta",
  "related",
] as const;

export type PosterVisibleFieldId = (typeof posterVisibleFieldIds)[number];

export type EventOperationalMoment = {
  id: string;
  label: string;
  time: string;
};

export type EventInviteStyleDefinition = {
  id: EventInviteStyleId;
  label: string;
  shortLabel: string;
  description: string;
  tone: string;
  recommendedMotifs: EventVisualMotifId[];
};

export const eventInviteStyles: EventInviteStyleDefinition[] = [
  {
    id: "jazz-poster",
    label: "Jazz Poster",
    shortLabel: "Jazz",
    description: "Cartel editorial con bloques tipograficos, curvas de papel y atmosfera de festival cultural.",
    tone: "Elegante, cultural, nocturno",
    recommendedMotifs: ["music-notes", "paper-cuts", "wave-lines", "ticket-stamp"]
  },
  {
    id: "club-grid",
    label: "Club Grid",
    shortLabel: "Club",
    description: "Invite de club con grid digital, glow controlado y energia de after con check-in rapido.",
    tone: "Nocturno, digital, high-energy",
    recommendedMotifs: ["equalizer-bars", "constellation-dots", "ticket-stamp", "wave-lines"]
  },
  {
    id: "festival-sunset",
    label: "Festival Sunset",
    shortLabel: "Festival",
    description: "Composicion amplia con bloques solares, capas calidas y presencia de lineup al frente.",
    tone: "Masivo, calido, celebratorio",
    recommendedMotifs: ["paper-cuts", "constellation-dots", "music-notes", "ticket-stamp"]
  }
];

export const eventVisualMotifs: Array<{
  id: EventVisualMotifId;
  label: string;
  description: string;
}> = [
  {
    id: "music-notes",
    label: "Notas flotantes",
    description: "Marca un tono musical y cultural en el invite."
  },
  {
    id: "paper-cuts",
    label: "Recortes organicos",
    description: "Agrega siluetas y formas mas editoriales."
  },
  {
    id: "equalizer-bars",
    label: "Barras ritmicas",
    description: "Introduce energia de club y visualizacion sonora."
  },
  {
    id: "constellation-dots",
    label: "Constelacion de puntos",
    description: "Crea textura ambiental ligera para fondos oscuros."
  },
  {
    id: "ticket-stamp",
    label: "Sellos de acceso",
    description: "Refuerza el caracter de invite y ticket premium."
  },
  {
    id: "wave-lines",
    label: "Lineas de onda",
    description: "Sugiere movimiento, audio y continuidad visual."
  }
];

export function getEventInviteStyle(styleId: string | null | undefined): EventInviteStyleDefinition {
  return eventInviteStyles.find((style) => style.id === styleId) ?? eventInviteStyles[0];
}

export function normalizeEventMotifs(
  motifs: readonly string[] | null | undefined,
  fallbackStyleId?: string | null,
) {
  if (Array.isArray(motifs)) {
    return [...new Set(
      motifs.filter((motif): motif is EventVisualMotifId =>
        eventVisualMotifIds.includes(motif as EventVisualMotifId),
      ),
    )];
  }

  return getEventInviteStyle(fallbackStyleId).recommendedMotifs.slice(0, 3);
}

export type VenueEventRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
  heroImage: string;
  designVariant?: EventInviteStyleId;
  designTemplateId?: PosterTemplateId;
  designMotifs?: EventVisualMotifId[];
  posterVisibleFields?: PosterVisibleFieldId[];
  posterArtDirection?: string;
  posterReferenceUrls?: string[];
  posterAssetMode?: "graphic-only" | "uploaded-hero" | "banana-pro" | "pexels-editorial" | "mixed-collage";
  doorTime: string;
  soundcheckTime: string;
  operationalMoments: EventOperationalMoment[];
  ticketPriceMXN: number;
  ticketFeeMXN: number;
  artistPayoutRate: number;
  capacity: number;
  soldCount: number;
  lineup: string[];
  genre: string[];
  isPublished: boolean;
  posterDesign?: EventPosterDesign;
  draftPoster?: EventPosterDesign;
  publishedPoster?: EventPosterDesign;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicEventCard = {
  slug: string;
  title: string;
  startsAt: string;
  venueName: string;
  ticketPriceMXN: number;
  availability: number;
};
