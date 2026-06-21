"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteEventAction, saveEventAction, type EventSaveState } from "@/app/actions/events";
import {
  buildPosterDesign,
  posterTemplateIds,
  type PosterTemplateId,
} from "@/lib/poster-designer";
import { buildTicketDesign } from "@/lib/ticket-designer";
import {
  eventVisualMotifs,
  type EventPosterAsset,
  getEventInviteStyle,
  ticketTemplateIds,
  type EventInviteStyleId,
  type EventOperationalMoment,
  type PosterOverlayAnchor,
  type PosterOverlayCardStyle,
  type PosterOverlayDensity,
  type PosterOverlayLayout,
  type PosterOverlayLayoutByViewport,
  type PosterOverlayTypographyStyle,
  type PosterOverlayViewport,
  type EventVisualMotifId,
  type PosterVisibleFieldId,
  type PosterTextOverlayMode,
  type TicketTemplateId,
  type VenueEventRecord,
} from "@/lib/event-types";
import {
  resolvePosterCompositeRenderModel,
  resolveTicketCompositeRenderModel,
} from "@/lib/event-presentation";
import { buildFlowStepPresentation } from "@/lib/flow-progress";
import {
  usePosterGeneration,
  type PosterGenerationProvider,
} from "./use-poster-generation";
import { useConsoleSounds } from "./use-console-sounds";
import {
  GeneratedPosterComposite,
  defaultPosterOverlayLayout as posterOverlayLayoutDefaults,
  clampPosterControl,
  type PosterBlockRole,
  type PosterEditorSelectionLayer,
  type PosterViewport,
} from "@/components/events/generated-poster-composite";
import { GeneratedTicketComposite } from "@/components/events/generated-ticket-composite";
import { buildPosterPreviewTheme } from "@/components/events/poster-theme";
import styles from "./venue-workspace.module.scss";

type VenueWorkspaceProps = {
  initialEvents: VenueEventRecord[];
  siteWallpaper?: string;
  applyConsoleWallpaper?: boolean;
  applyEventPosterWallpaper?: boolean;
};

type VenueEventDraft = VenueEventRecord;
type DesignSourceMode = "local" | "ai" | "upload";
type ProductWizardStep = 0 | 1 | 2 | 3;
type PosterAiProposal = {
  proposal_id: number;
  concept_id?: string;
  asset_id?: string;
  style_title: string;
  design_storytelling: string;
  poster_url: string;
  total_score?: number | null;
  rank?: number | null;
  recommendation_label?: string | null;
  summary?: string;
  warnings?: string[];
  target_genres?: string[];
  target_subfamilies?: string[];
};

type PosterAiSelectionResult = {
  ok: boolean;
  saved_asset?: {
    poster_url?: string | null;
    relative_url?: string;
  } | null;
};

type EditorialBrief = {
  titulo: string;
  subtitulo: string;
  descripcion_visual: string;
  fecha: string;
  lugar: string;
  ciudad: string;
  genero_o_mood: string;
  protagonista_visual: string;
  estilo_recomendado: "illustrated" | "editorial" | "photo-first";
  paleta_recomendada: string[];
  texto_obligatorio: string[];
  formato: string;
  nivel_de_realismo: string;
  referencias_esteticas: string[];
  restricciones: string[];
};

const wizardSteps = [
  { id: 0, eyebrow: "Paso 1", title: "Contenido" },
  { id: 1, eyebrow: "Paso 2", title: "Dirección" },
  { id: 2, eyebrow: "Paso 3", title: "Review" },
] as const;

const posterOverlayScaleMin = 0.4;
const posterOverlayScaleMax = 3.2;
const posterOverlayOffsetMin = -120;
const posterOverlayOffsetMax = 120;

const uploadWizardSteps = [
  { id: 0, eyebrow: "Paso 1", title: "Poster base" },
  { id: 1, eyebrow: "Paso 2", title: "Información" },
  { id: 2, eyebrow: "Paso 3", title: "Formato" },
] as const;

const productWizardSteps = [
  {
    id: 0,
    title: "Esencia",
    eyebrow: "Paso 1",
    description: "Captura la voz del evento y la materia prima del storytelling.",
    cta: "Continuar a Logística",
    icon: "✦",
    tone: "essence",
  },
  {
    id: 1,
    title: "Logística",
    eyebrow: "Paso 2",
    description: "Consolida cuándo, dónde y con qué tono visual se presentará.",
    cta: "Continuar a Economía",
    icon: "◌",
    tone: "logistics",
  },
  {
    id: 2,
    title: "Galería de Arte",
    eyebrow: "Paso 3",
    description: "Define el sistema visual, compara variantes y elige el poster principal antes de cerrar operación.",
    cta: "Continuar a Economía",
    icon: "▣",
    tone: "gallery",
  },
  {
    id: 3,
    title: "Economía",
    eyebrow: "Paso 4",
    description: "Cierra ticketing, capacidad y publicación con la pieza visual ya resuelta.",
    cta: "Publicar evento",
    icon: "$",
    tone: "economy",
  },
] as const;

const uploadOverlayOptions: Array<{
  id: PosterTextOverlayMode;
  title: string;
  detail: string;
}> = [
  {
    id: "none",
    title: "Sin texto encima",
    detail: "Usa el poster tal cual lo subiste.",
  },
  {
    id: "editorial-band",
    title: "Banda editorial",
    detail: "Título grande y datos en una franja limpia.",
  },
  {
    id: "corner-stamp",
    title: "Sello de esquina",
    detail: "Fecha, venue y precio como etiqueta compacta.",
  },
  {
    id: "ticket-strip",
    title: "Franja de boleto",
    detail: "CTA y horarios como pase de acceso.",
  },
  {
    id: "full-frame",
    title: "Marco completo",
    detail: "Información alrededor del poster sin tapar el centro.",
  },
];

const posterOverlayAnchorOptions: Array<{ id: PosterOverlayAnchor; label: string }> = [
  { id: "top-left", label: "Superior izquierda" },
  { id: "top-center", label: "Superior centro" },
  { id: "top-right", label: "Superior derecha" },
  { id: "middle-left", label: "Centro izquierda" },
  { id: "middle-center", label: "Centro" },
  { id: "middle-right", label: "Centro derecha" },
  { id: "bottom-left", label: "Inferior izquierda" },
  { id: "bottom-center", label: "Inferior centro" },
  { id: "bottom-right", label: "Inferior derecha" },
] as const;

const posterOverlayDensityOptions: Array<{ id: PosterOverlayDensity; label: string; detail: string }> = [
  { id: "compact", label: "Compacta", detail: "Más información en menos espacio." },
  { id: "balanced", label: "Balanceada", detail: "Ritmo editorial estándar." },
  { id: "airy", label: "Aireada", detail: "Más respiro y protagonismo del arte." },
] as const;

const posterOverlayCardStyleOptions: Array<{ id: PosterOverlayCardStyle; label: string; detail: string }> = [
  { id: "glass", label: "Glass", detail: "Translúcido y premium." },
  { id: "solid", label: "Solid", detail: "Panel claro, más editorial y muy legible." },
  { id: "soft", label: "Soft", detail: "Casi invisible, deja respirar mucho más el arte." },
] as const;

const posterOverlayTypographyOptions: Array<{ id: PosterOverlayTypographyStyle; label: string; detail: string }> = [
  { id: "display", label: "Display", detail: "Titular grande y contundente." },
  { id: "editorial", label: "Editorial", detail: "Más refinada, con tono de revista." },
  { id: "mono", label: "Mono", detail: "Más técnica y geométrica." },
] as const;

const defaultPosterOverlayLayout: PosterOverlayLayout = posterOverlayLayoutDefaults;
const overlayViewports: PosterOverlayViewport[] = ["desktop", "tablet", "mobile"];

function isViewportOverlayLayout(
  layout: VenueEventRecord["posterOverlayLayout"],
): layout is PosterOverlayLayoutByViewport {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return false;
  }

  return overlayViewports.some((viewport) => {
    const candidate = (layout as Record<string, unknown>)[viewport];
    return Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate));
  });
}

function resolveViewportOverlayLayouts(layout: VenueEventRecord["posterOverlayLayout"]): Record<PosterOverlayViewport, PosterOverlayLayout> {
  if (isViewportOverlayLayout(layout)) {
    return {
      desktop: { ...defaultPosterOverlayLayout, ...(layout.desktop ?? {}) },
      tablet: { ...defaultPosterOverlayLayout, ...(layout.tablet ?? {}) },
      mobile: { ...defaultPosterOverlayLayout, ...(layout.mobile ?? {}) },
    };
  }

  const shared = { ...defaultPosterOverlayLayout, ...(layout ?? {}) };
  return {
    desktop: { ...shared },
    tablet: { ...shared },
    mobile: { ...shared },
  };
}

type EditorSectionId = "essentials" | "story" | "visual" | "operations" | "ticketing" | "assets";
type VenueConsoleTabId = "essentials" | "story" | "visual" | "operations" | "ticketing";
type VisualWorkbenchTabId = "upload" | "local" | "library";

const providerOptions = [
  {
    id: "pollinations",
    title: "Pollinations",
    subtitle: "Gratis · Sin registro",
    detail: "Instant, no key needed",
    setupKey: null,
    setupHref: "",
  },
  {
    id: "pollinations-alt",
    title: "Pollinations · Noir",
    subtitle: "Gratis · Sin registro",
    detail: "Free alt mood, no key needed",
    setupKey: null,
    setupHref: "",
  },
  {
    id: "huggingface",
    title: "Hugging Face · FLUX Schnell",
    subtitle: "Gratis · API key requerida",
    detail: "Free key at hf.co",
    setupKey: "foro_hf_key",
    setupHref: "https://huggingface.co/settings/tokens",
  },
  {
    id: "together",
    title: "Together AI · FLUX Turbo",
    subtitle: "$25 créditos gratis al registrarse",
    detail: "Best quality",
    setupKey: "foro_together_key",
    setupHref: "https://api.together.xyz/settings/api-keys",
  },
] as const satisfies ReadonlyArray<{
  id: PosterGenerationProvider;
  title: string;
  subtitle: string;
  detail: string;
  setupKey: string | null;
  setupHref: string;
}>;

const defaultSectionState: Record<EditorSectionId, boolean> = {
  essentials: true,
  story: false,
  visual: false,
  operations: false,
  ticketing: false,
  assets: false,
};

const venueConsoleTabs: Array<{ id: VenueConsoleTabId; label: string; detail: string }> = [
  { id: "essentials", label: "Lo esencial", detail: "Título, fecha, venue y lineup." },
  { id: "story", label: "La historia", detail: "Hook, narrativa y géneros." },
  { id: "operations", label: "Operación", detail: "Timing, puertas y checkpoints." },
  { id: "visual", label: "Dirección visual", detail: "Poster, overlays y variantes." },
  { id: "ticketing", label: "Ticketing y publicación", detail: "Precios, aforo y estado público." },
];

const visualWorkbenchTabs: Array<{ id: VisualWorkbenchTabId; label: string; detail: string }> = [
  { id: "upload", label: "Subir mi propio poster", detail: "Usa tu arte y arma overlays adaptativos." },
  { id: "local", label: "Generar con motor local", detail: "Explora varias direcciones con el motor local." },
  { id: "library", label: "Biblioteca", detail: "Recupera, duplica y activa variantes guardadas." },
];

const posterFieldOptions: Array<{ id: PosterVisibleFieldId; label: string; hint: string }> = [
  { id: "venue", label: "Venue", hint: "Nombre principal del lugar" },
  { id: "date", label: "Fecha", hint: "Día, mes o año del evento" },
  { id: "address", label: "Dirección", hint: "Ubicación detallada" },
  { id: "summary", label: "Resumen corto", hint: "Hook o frase breve del evento" },
  { id: "description", label: "Descripción larga", hint: "Texto editorial más desarrollado" },
  { id: "schedule", label: "Horarios", hint: "Doors, show y soundcheck" },
  { id: "lineup", label: "Lineup", hint: "Artistas o participantes" },
  { id: "genre", label: "Géneros", hint: "Textura o familia musical" },
  { id: "pricing", label: "Precios", hint: "Costo y lugares disponibles" },
  { id: "cta", label: "CTA compra", hint: "Botón o llamado a compra" },
  { id: "related", label: "Otras fechas", hint: "Links a eventos relacionados" },
];

const posterIdeaPresets = [
  {
    id: "editorial-jazz",
    title: "Editorial jazz",
    localVariant: "jazz-poster" as EventInviteStyleId,
    localTemplate: "festival-ticket" as PosterTemplateId,
    motifs: ["wave-lines", "ticket-stamp"] as EventVisualMotifId[],
    prompt:
      "Poster editorial sofisticado, con tensión tipográfica, ritmo nocturno, formas orgánicas y una sensación cultural premium.",
  },
  {
    id: "club-digital",
    title: "Club digital",
    localVariant: "club-grid" as EventInviteStyleId,
    localTemplate: "signal-grid" as PosterTemplateId,
    motifs: ["equalizer-bars", "constellation-dots"] as EventVisualMotifId[],
    prompt:
      "Poster de club con energía cinética, contraste alto, luz digital controlada, sensación de after y jerarquía contundente.",
  },
  {
    id: "festival-solar",
    title: "Festival solar",
    localVariant: "festival-sunset" as EventInviteStyleId,
    localTemplate: "paper-cut-stage" as PosterTemplateId,
    motifs: ["paper-cuts", "music-notes"] as EventVisualMotifId[],
    prompt:
      "Poster cálido y celebratorio, con carácter de festival, capas amplias, presencia de lineup y una atmósfera abierta y memorable.",
  },
  {
    id: "cinematic-prestige",
    title: "Cinemático",
    localVariant: "jazz-poster" as EventInviteStyleId,
    localTemplate: "nocturne-frame" as PosterTemplateId,
    motifs: ["constellation-dots", "wave-lines"] as EventVisualMotifId[],
    prompt:
      "Poster con dramatismo cinematográfico, grano, luz dirigida, profundidad y una sensación de evento irrepetible con prestigio visual.",
  },
] as const;

const payoutAutomationRate = 0.015;
const initialState: EventSaveState = { ok: false, message: "" };
const publicFeedCacheKey = "foro-gdl-public-events-feed";
const deleteInitialState: EventSaveState = { ok: false, message: "" };

const templateLabelMap: Record<PosterTemplateId, string> = {
  "festival-ticket": "Festival Ticket",
  "midnight-flyer": "Midnight Flyer",
  "sunburst-billboard": "Sunburst Billboard",
  "velvet-program": "Velvet Program",
  "signal-grid": "Signal Grid",
  "paper-cut-stage": "Paper Cut Stage",
  "afterglow-columns": "Afterglow Columns",
  "rooftop-blueprint": "Rooftop Blueprint",
  "brass-badge": "Brass Badge",
  "analog-wave": "Analog Wave",
  "monolith-dateblock": "Monolith Dateblock",
  "kinetic-ribbon": "Kinetic Ribbon",
  "city-light-stamp": "City Light Stamp",
  "nocturne-frame": "Nocturne Frame",
  "electric-mosaic": "Electric Mosaic",
};

const ticketTemplateMeta: Record<
  TicketTemplateId,
  { title: string; detail: string; description: string }
> = {
  "glass-banner": {
    title: "Glass Banner",
    detail: "Hero · vivo",
    description: "Boleto amplio tipo banner con vidrio, fondo visual y módulos claros de acceso.",
  },
  "festival-pass": {
    title: "Festival Pass",
    detail: "Horizontal · premium",
    description: "Boleto editorial amplio con área principal para título y stub lateral para acceso.",
  },
  "ledger-stub": {
    title: "Ledger Stub",
    detail: "Horizontal · control",
    description: "Formato de talón elegante con lectura limpia para operación, venue y venta rápida.",
  },
  "night-band": {
    title: "Night Band",
    detail: "Vertical · collector",
    description: "Pase vertical más coleccionable, ideal para tickets visuales con presencia fuerte del arte.",
  },
};

const assetModeOptions: Array<{
  id: NonNullable<VenueEventRecord["posterAssetMode"]>;
  label: string;
  description: string;
}> = [
  {
    id: "graphic-only",
    label: "Graphic only",
    description: "No usa fotografía en el poster; construye la composición con tipografía, formas y ornamentos.",
  },
  {
    id: "uploaded-hero",
    label: "Uploaded hero",
    description: "Prioriza la imagen subida por el venue y la transforma para el poster.",
  },
  {
    id: "banana-pro",
    label: "Banana Pro pass",
    description: "El diseñador prepara composición o plate editorial con edición/generación asistida.",
  },
  {
    id: "pexels-editorial",
    label: "Pexels editorial",
    description: "Busca una base editorial y la reinterpreta con tratamiento fuerte antes de publicar.",
  },
  {
    id: "mixed-collage",
    label: "Mixed collage",
    description: "Empuja una mezcla más agresiva de recortes, texturas y tratamiento de figura.",
  },
];

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function splitCommaList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function nextPosterRevision(existingAssets: EventPosterAsset[]) {
  return existingAssets.reduce((maxRevision, asset) => Math.max(maxRevision, asset.revision ?? 0), 0) + 1;
}

function sortPosterLibraryAssets(assets: EventPosterAsset[]) {
  return [...assets].sort((left, right) => {
    const rightDate = new Date(right.updatedAt || right.createdAt).getTime();
    const leftDate = new Date(left.updatedAt || left.createdAt).getTime();

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return (right.revision || 0) - (left.revision || 0);
  });
}

function getPrimaryPosterUrl(event: Partial<VenueEventRecord> | null | undefined) {
  if (!event) {
    return "";
  }

  const activePoster = (event.posterAssets ?? []).find((asset) => asset.id === event.activePosterAssetId && asset.url);
  if (activePoster?.url) {
    return activePoster.url;
  }

  const firstPosterAsset = (event.posterAssets ?? []).find((asset) => asset.url);
  if (firstPosterAsset?.url) {
    return firstPosterAsset.url;
  }

  return event.posterReferenceUrls?.find(Boolean) ?? "";
}

function getEventPosterThumbnailUrl(event: VenueEventRecord) {
  return getPrimaryPosterUrl(event);
}

function getPosterAssetStatusLabel(asset: EventPosterAsset) {
  if (asset.status === "published") {
    return "Publicado";
  }

  if (asset.status === "archived") {
    return "Archivado";
  }

  return "Draft";
}

function getPosterAssetOriginLabel(asset: EventPosterAsset) {
  if (asset.originMode === "upload") {
    return "Upload";
  }

  if (asset.originMode === "ai") {
    return "IA";
  }

  return "Local";
}

function formatPosterAssetDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function inferDesignSourceModeFromEvent(event: VenueEventRecord | null) {
  if (!event) {
    return "local" as DesignSourceMode;
  }

  const activePosterAsset = (event.posterAssets ?? []).find((asset) => asset.id === event.activePosterAssetId);
  const posterOriginMode = activePosterAsset?.originMode;
  const posterAssetMode = activePosterAsset?.assetMode ?? event.posterAssetMode ?? "graphic-only";

  if (posterOriginMode === "upload" || posterAssetMode === "uploaded-hero") {
    return "upload" as DesignSourceMode;
  }

  if (posterOriginMode === "ai") {
    return "ai" as DesignSourceMode;
  }

  return "local" as DesignSourceMode;
}

function inferDesignSourceModeFromPosterAsset(asset: EventPosterAsset | null | undefined) {
  if (!asset) {
    return "local" as DesignSourceMode;
  }

  if (asset.originMode === "upload" || asset.assetMode === "uploaded-hero") {
    return "upload" as DesignSourceMode;
  }

  if (asset.originMode === "ai") {
    return "ai" as DesignSourceMode;
  }

  return "local" as DesignSourceMode;
}

function inferSelectedPresetIdFromEvent(event: VenueEventRecord | null) {
  if (!event) {
    return posterIdeaPresets[0].id;
  }

  const exactMatch = posterIdeaPresets.find(
    (preset) => preset.localVariant === event.designVariant && preset.localTemplate === event.designTemplateId,
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  const variantMatch = posterIdeaPresets.find((preset) => preset.localVariant === event.designVariant);
  return variantMatch?.id ?? posterIdeaPresets[0].id;
}

function formatDesignerEventDate(dateValue: string) {
  return new Date(dateValue).toLocaleString("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function formatEventTime(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function inferEventMoment(dateValue: string) {
  const hour = new Date(dateValue).getHours();

  if (hour < 12) {
    return "matinal y luminosa";
  }

  if (hour < 18) {
    return "vespertina y abierta";
  }

  if (hour < 22) {
    return "nocturna, vibrante y social";
  }

  return "tardia, intensa y de culto";
}

function inferAudienceSignal(draft: VenueEventDraft) {
  const genres = (draft.genre ?? []).join(" ").toLowerCase();
  const title = draft.title.toLowerCase();

  if (draft.ticketPriceMXN >= 450) {
    return "audiencia premium con expectativa editorial alta";
  }

  if (genres.includes("jazz") || title.includes("jazz")) {
    return "audiencia cultural exigente que valora sofisticacion visual";
  }

  if (genres.includes("club") || genres.includes("elect") || genres.includes("nightlife")) {
    return "audiencia nocturna que responde a piezas energicas y memorables";
  }

  if (draft.capacity >= 500) {
    return "audiencia amplia que necesita impacto inmediato y jerarquia clara";
  }

  return "audiencia joven-adulta que espera una pieza contemporanea y compartible";
}

function inferCityFromAddress(address: string) {
  if (address.toLowerCase().includes("guadalajara")) {
    return "Guadalajara";
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.at(-2) || parts.at(-1) || "Ciudad por definir";
}

function inferRecommendedStyle(draft: VenueEventDraft, directionNote: string): EditorialBrief["estilo_recomendado"] {
  const note = directionNote.toLowerCase();
  const genres = (draft.genre ?? []).join(" ").toLowerCase();

  if ((draft.posterAssetMode ?? "graphic-only") === "uploaded-hero" || note.includes("foto") || note.includes("phot")) {
    return "photo-first";
  }

  if (genres.includes("jazz") || genres.includes("festival") || note.includes("ilustr")) {
    return "illustrated";
  }

  return "editorial";
}

function inferVisualLead(draft: VenueEventDraft, style: EditorialBrief["estilo_recomendado"]) {
  const genreText = (draft.genre ?? []).join(" ").toLowerCase();
  const firstLineup = draft.lineup?.[0]?.trim();

  if (genreText.includes("jazz")) {
    return "figura humana musical en primer plano, gesto expresivo e instrumento protagonista";
  }

  if (style === "photo-first") {
    return firstLineup
      ? `retrato principal de ${firstLineup} con presencia humana dominante y recorte editorial`
      : "retrato humano dominante con gesto fuerte y recorte editorial";
  }

  if (genreText.includes("nightlife") || genreText.includes("elect")) {
    return "figura humana nocturna, energia de club y tension entre luz y tipografia";
  }

  return "protagonista humano claro, composicion editorial y storytelling visual inmediato";
}

function inferPalette(draft: VenueEventDraft, style: EditorialBrief["estilo_recomendado"]) {
  const genres = (draft.genre ?? []).join(" ").toLowerCase();

  if (genres.includes("jazz")) {
    return ["navy profundo", "mostaza calida", "marfil", "tinta oscura"];
  }

  if (style === "photo-first") {
    return ["carbon", "hueso", "cobre", "acento neon controlado"];
  }

  if (genres.includes("nightlife") || genres.includes("elect")) {
    return ["negro humo", "verde acido", "gris grafito", "blanco duro"];
  }

  return ["azul medianoche", "arena calida", "rojo editorial", "negro suave"];
}

function inferReferences(draft: VenueEventDraft, style: EditorialBrief["estilo_recomendado"]) {
  const genres = (draft.genre ?? []).join(" ").toLowerCase();

  if (genres.includes("jazz")) {
    return ["Blue Note posters", "litografia cultural mexicana", "Swiss editorial rhythm"];
  }

  if (style === "photo-first") {
    return ["fashion editorial posters", "cinematic key art", "gallery-grade portrait crops"];
  }

  if (genres.includes("nightlife") || genres.includes("elect")) {
    return ["Bauhaus nightlife flyers", "acid graphics", "club identity systems"];
  }

  return ["premium cultural posters", "editorial typography", "contemporary festival graphics"];
}

function buildEditorialBrief(draft: VenueEventDraft, directionNote: string): EditorialBrief {
  const style = inferRecommendedStyle(draft, directionNote);
  const subtitle = draft.summary.trim() || `${draft.venueName} · ${formatDesignerEventDate(draft.startsAt)}`;
  const genres = (draft.genre ?? []).filter(Boolean).join(" / ") || "evento en vivo";
  const lineup = (draft.lineup ?? []).filter(Boolean).join(" / ");
  const audience = inferAudienceSignal(draft);
  const eventMoment = inferEventMoment(draft.startsAt);
  const userDirection = directionNote.trim();
  const protagonist = inferVisualLead(draft, style);
  const mandatoryText = [
    draft.title,
    formatDesignerEventDate(draft.startsAt),
    draft.venueName,
    draft.venueAddress,
    lineup,
    `${formatMoney(draft.ticketPriceMXN)} MXN`,
  ].filter(Boolean);

  return {
    titulo: draft.title,
    subtitulo: subtitle,
    descripcion_visual: userDirection
      ? `${userDirection}. Mantener una lectura ${eventMoment}, con jerarquia tipografica fuerte y un tono pensado para ${audience}.`
      : `Construir un poster premium para ${draft.title} con atmosfera ${eventMoment}, alto contraste, narrativa humana clara y una lectura pensada para ${audience}.`,
    fecha: formatDesignerEventDate(draft.startsAt),
    lugar: draft.venueName,
    ciudad: inferCityFromAddress(draft.venueAddress),
    genero_o_mood: `${genres}; clima ${eventMoment}`,
    protagonista_visual: protagonist,
    estilo_recomendado: style,
    paleta_recomendada: inferPalette(draft, style),
    texto_obligatorio: mandatoryText,
    formato: "poster premium responsive con variantes desktop, tablet y mobile",
    nivel_de_realismo:
      style === "photo-first" ? "alto realismo editorial" : style === "illustrated" ? "ilustrado premium con figura humana clara" : "editorial grafico con realismo controlado",
    referencias_esteticas: inferReferences(draft, style),
    restricciones: [
      "Mantener contraste alto y legibilidad web/mobile",
      "Evitar look generico o templateado",
      "Priorizar jerarquia tipografica, composicion humana y storytelling visual",
      "Generar 3 propuestas radicalmente distintas usando este mismo brief",
    ],
  };
}

function buildAiPromptSeed(brief: EditorialBrief) {
  return `Poster premium para "${brief.titulo}" con enfoque ${brief.estilo_recomendado}, mood ${brief.genero_o_mood} y protagonista ${brief.protagonista_visual}.`;
}

function buildAiDesignContext(brief: EditorialBrief) {
  return [
    `Titulo: ${brief.titulo}.`,
    `Subtitulo: ${brief.subtitulo}.`,
    `Descripcion visual: ${brief.descripcion_visual}.`,
    `Fecha: ${brief.fecha}.`,
    `Lugar: ${brief.lugar}.`,
    `Ciudad: ${brief.ciudad}.`,
    `Genero o mood: ${brief.genero_o_mood}.`,
    `Protagonista visual: ${brief.protagonista_visual}.`,
    `Estilo recomendado: ${brief.estilo_recomendado}.`,
    `Paleta recomendada: ${brief.paleta_recomendada.join(" / ")}.`,
    `Texto obligatorio: ${brief.texto_obligatorio.join(" | ")}.`,
    `Formato: ${brief.formato}.`,
    `Nivel de realismo: ${brief.nivel_de_realismo}.`,
    `Referencias esteticas: ${brief.referencias_esteticas.join(" / ")}.`,
    `Restricciones: ${brief.restricciones.join(" / ")}.`,
  ].join(" ");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function createOperationalMoment(time: string, label = "Recepción"): EventOperationalMoment {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `moment-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    label,
    time,
  };
}

function buildDraftFingerprint(event: VenueEventDraft) {
  return JSON.stringify({
    title: event.title,
    summary: event.summary,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    heroImage: event.heroImage,
    designVariant: event.designVariant ?? "",
    designTemplateId: event.designTemplateId ?? "",
    ticketTemplateId: event.ticketTemplateId ?? "",
    designMotifs: event.designMotifs ?? [],
    posterVisibleFields: event.posterVisibleFields ?? posterFieldOptions.map((field) => field.id),
    posterArtDirection: event.posterArtDirection ?? "",
    posterReferenceUrls: event.posterReferenceUrls ?? [],
    posterAssetMode: event.posterAssetMode ?? "graphic-only",
    posterTextOverlayMode: event.posterTextOverlayMode ?? "editorial-band",
    posterOverlayLayout: event.posterOverlayLayout ?? defaultPosterOverlayLayout,
    posterAssets: event.posterAssets ?? [],
    activePosterAssetId: event.activePosterAssetId ?? "",
    ticketAssets: event.ticketAssets ?? [],
    activeTicketAssetId: event.activeTicketAssetId ?? "",
    doorTime: event.doorTime,
    soundcheckTime: event.soundcheckTime,
    operationalMoments: event.operationalMoments ?? [],
    ticketPriceMXN: event.ticketPriceMXN,
    ticketFeeMXN: event.ticketFeeMXN,
    artistPayoutRate: event.artistPayoutRate,
    capacity: event.capacity,
    soldCount: event.soldCount,
    lineup: event.lineup,
    genre: event.genre,
    isPublished: event.isPublished,
  });
}

function createEmptyDraft(): VenueEventDraft {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 7);
  startsAt.setHours(21, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setHours(23, 45, 0, 0);
  const doorTime = new Date(startsAt);
  doorTime.setHours(20, 0, 0, 0);
  const soundcheckTime = new Date(startsAt);
  soundcheckTime.setHours(18, 30, 0, 0);

  return {
    id: "",
    slug: "",
    title: "Nuevo evento Foro GDL",
    summary: "Una fecha nueva lista para venta móvil, invite premium y control operativo.",
    description:
      "Crea aquí la página pública del evento, elige una dirección visual distinta y publica cuando el venue esté listo.",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timezone: "America/Mexico_City",
    venueName: "Foro GDL",
    venueAddress: "Av. Chapultepec Sur 180, Americana, Guadalajara, Jalisco",
    heroImage: "/events/stage1.jpg",
    designVariant: "jazz-poster",
    designTemplateId: "festival-ticket",
    ticketTemplateId: "glass-banner",
    designMotifs: ["wave-lines", "ticket-stamp"],
    posterVisibleFields: posterFieldOptions.map((field) => field.id),
    posterArtDirection: "",
    posterReferenceUrls: [],
    posterAssetMode: "graphic-only",
    posterTextOverlayMode: "editorial-band",
    posterOverlayLayout: defaultPosterOverlayLayout,
    posterAssets: [],
    activePosterAssetId: undefined,
    ticketAssets: [],
    activeTicketAssetId: undefined,
    doorTime: doorTime.toISOString(),
    soundcheckTime: soundcheckTime.toISOString(),
    operationalMoments: [],
    ticketPriceMXN: 280,
    ticketFeeMXN: 15,
    artistPayoutRate: 0.7,
    capacity: 320,
    soldCount: 0,
    operationMode: "auto",
    lineup: ["Headliner", "Support"],
    genre: ["Live Music", "Nightlife"],
    isPublished: false,
    createdAt: "",
    updatedAt: "",
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeDraftRecord(event: VenueEventRecord): VenueEventDraft {
  return { ...event };
}

function buildEventTimingFromStart(startsAt: string) {
  const start = new Date(startsAt);
  const endsAt = new Date(start);
  endsAt.setHours(start.getHours() + 2, 45, 0, 0);
  const doorTime = new Date(start);
  doorTime.setHours(start.getHours() - 1, 0, 0, 0);
  const soundcheckTime = new Date(start);
  soundcheckTime.setHours(start.getHours() - 2, 30, 0, 0);

  return {
    startsAt: start.toISOString(),
    endsAt: endsAt.toISOString(),
    doorTime: doorTime.toISOString(),
    soundcheckTime: soundcheckTime.toISOString(),
  };
}

function getProviderLabel(provider: PosterGenerationProvider) {
  const option = providerOptions.find((item) => item.id === provider);
  return option?.title ?? provider;
}

const venueSelectionStorageKey = "foro_venue_selected_event_id";

export function VenueWorkspace({
  initialEvents,
  siteWallpaper = "",
  applyConsoleWallpaper = false,
  applyEventPosterWallpaper = false,
}: VenueWorkspaceProps) {
  const safeEvents = useMemo(() => (Array.isArray(initialEvents) ? initialEvents : []), [initialEvents]);
  const router = useRouter();
  const initialSelectedEvent = safeEvents[0] ?? null;
  const initialPosterUrl = getPrimaryPosterUrl(initialSelectedEvent);
  const initialDesignSourceMode = inferDesignSourceModeFromEvent(initialSelectedEvent);
  const initialSelectedPresetId = inferSelectedPresetIdFromEvent(initialSelectedEvent);
  const initialUploadOverlayMode = initialSelectedEvent?.posterTextOverlayMode ?? "none";
  const initialHasPoster = Boolean(initialPosterUrl);
  const visualSectionRef = useRef<HTMLDetailsElement | null>(null);
  const providerSectionRef = useRef<HTMLDivElement | null>(null);
  const [emptyDraft] = useState(() => createEmptyDraft());
  const [selectedId, setSelectedId] = useState(safeEvents[0]?.id ?? "new");
  const [draft, setDraft] = useState<VenueEventDraft>(() =>
    safeEvents[0] ? normalizeDraftRecord(safeEvents[0]) : emptyDraft,
  );
  const [activeConsoleTab, setActiveConsoleTab] = useState<VenueConsoleTabId>("essentials");
  const [activeVisualTab, setActiveVisualTab] = useState<VisualWorkbenchTabId>(
    initialDesignSourceMode === "upload" ? "upload" : initialDesignSourceMode === "ai" ? "library" : "local",
  );
  const [openSections, setOpenSections] = useState<Record<EditorSectionId, boolean>>(defaultSectionState);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartStep, setQuickStartStep] = useState<0 | 1 | 2>(0);
  const [quickStartTitle, setQuickStartTitle] = useState("");
  const [quickStartStartsAt, setQuickStartStartsAt] = useState(toDateTimeLocalValue(emptyDraft.startsAt));
  const [quickStartVenue, setQuickStartVenue] = useState("");
  const [quickStartLineup, setQuickStartLineup] = useState("");
  const [lineupText, setLineupText] = useState("");
  const [genreText, setGenreText] = useState("");
  const [copyAssistLoadingField, setCopyAssistLoadingField] = useState<"summary" | "description" | "genre" | null>(
    null,
  );
  const [pendingHeroPreview, setPendingHeroPreview] = useState("");
  const [pendingHeroFileName, setPendingHeroFileName] = useState("");
  const [previewScreen, setPreviewScreen] = useState<"preview" | "story" | "ticket">("preview");
  const [activeProductStep, setActiveProductStep] = useState<ProductWizardStep>(0);
  const [designWizardStep, setDesignWizardStep] = useState<0 | 1 | 2>(initialHasPoster ? 2 : 0);
  const [maxUnlockedWizardStep, setMaxUnlockedWizardStep] = useState<0 | 1 | 2>(initialHasPoster ? 2 : 0);
  const [designSourceMode, setDesignSourceMode] = useState<DesignSourceMode>(initialDesignSourceMode);
  const [uploadedPosterPreview, setUploadedPosterPreview] = useState(
    initialDesignSourceMode === "upload" ? initialPosterUrl : "",
  );
  const [uploadedPosterFileName, setUploadedPosterFileName] = useState(
    initialPosterUrl ? initialPosterUrl.split("/").pop()?.split("?")[0] ?? "" : "",
  );
  const [uploadTextOverlayMode, setUploadTextOverlayMode] = useState<PosterTextOverlayMode>(initialUploadOverlayMode);
  const [overlayEditorOpen, setOverlayEditorOpen] = useState(false);
  const [overlayEditorViewport, setOverlayEditorViewport] = useState<PosterViewport>("desktop");
  const [overlayEditorRole, setOverlayEditorRole] = useState<PosterBlockRole>("hero");
  const [overlayEditorLayer, setOverlayEditorLayer] = useState<PosterEditorSelectionLayer>("inner");
  const [selectedIdeaPreset, setSelectedIdeaPreset] = useState<(typeof posterIdeaPresets)[number]["id"]>(
    initialSelectedPresetId,
  );
  const [localPosterProvider, setLocalPosterProvider] = useState<PosterGenerationProvider>("pollinations");
  const [providerKeys, setProviderKeys] = useState(() => {
    if (typeof window === "undefined") {
      return { huggingface: "", together: "" };
    }

    return {
      huggingface: window.localStorage.getItem("foro_hf_key") ?? "",
      together: window.localStorage.getItem("foro_together_key") ?? "",
    };
  });
  const [providerKeyDrafts, setProviderKeyDrafts] = useState(() => {
    if (typeof window === "undefined") {
      return { huggingface: "", together: "" };
    }

    return {
      huggingface: window.localStorage.getItem("foro_hf_key") ?? "",
      together: window.localStorage.getItem("foro_together_key") ?? "",
    };
  });
  const [expandedProviderSetup, setExpandedProviderSetup] = useState<Exclude<PosterGenerationProvider, "pollinations" | "pollinations-alt"> | null>(null);
  const [loadedPosterUrl, setLoadedPosterUrl] = useState(initialPosterUrl);
  const [previewPosterThemeVars, setPreviewPosterThemeVars] = useState<CSSProperties | undefined>(undefined);
  const [aiDirectionNote, setAiDirectionNote] = useState(initialSelectedEvent?.posterArtDirection ?? "");
  const [aiProposals, setAiProposals] = useState<PosterAiProposal[]>([]);
  const [aiGenerationId, setAiGenerationId] = useState("");
  const [selectedAiProposalId, setSelectedAiProposalId] = useState<number | null>(null);
  const [appliedAiProposalId, setAppliedAiProposalId] = useState<number | null>(null);
  const [lastAiGenerationSignature, setLastAiGenerationSignature] = useState("");
  const [aiStatus, setAiStatus] = useState<{ loading: boolean; error: string }>({
    loading: false,
    error: "",
  });
  const [posterDeleteTarget, setPosterDeleteTarget] = useState<EventPosterAsset | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [saveState, saveAction, isSaving] = useActionState(saveEventAction, initialState);
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteEventAction, deleteInitialState);
  const { enabled: consoleSoundsEnabled, setEnabled: setConsoleSoundsEnabled, playCue } = useConsoleSounds();
  const transientAiUrlsRef = useRef<string[]>([]);
  const lastSaveFeedbackRef = useRef("");
  const lastDeleteFeedbackRef = useRef("");
  const lastPosterReadySignalRef = useRef("");
  const overlayEditorPreviewRef = useRef<HTMLDivElement | null>(null);
  const baselineDraft = useMemo(
    () => (selectedId === "new" ? emptyDraft : safeEvents.find((event) => event.id === selectedId) ?? emptyDraft),
    [emptyDraft, safeEvents, selectedId],
  );
  const persistedBaselineDraft = useMemo(
    () => (saveState.savedEvent?.id && saveState.savedEvent.id === draft.id ? saveState.savedEvent : baselineDraft),
    [baselineDraft, draft.id, saveState.savedEvent],
  );
  const previewDraft = useMemo(
    () => (pendingHeroPreview ? { ...draft, heroImage: pendingHeroPreview } : draft),
    [draft, pendingHeroPreview],
  );
  const persistedEventPosterWallpaper = useMemo(
    () => getPrimaryPosterUrl(persistedBaselineDraft),
    [persistedBaselineDraft],
  );
  const getLocalProviderKey = useCallback(
    (provider: Exclude<PosterGenerationProvider, "pollinations" | "pollinations-alt">) => providerKeys[provider],
    [providerKeys],
  );
  const localPosterGeneration = usePosterGeneration(getLocalProviderKey);
  const templateOptions = useMemo(
    () =>
      posterTemplateIds.filter((templateId) => {
        if (draft.designVariant === "jazz-poster") {
          return ["festival-ticket", "velvet-program", "brass-badge", "nocturne-frame", "analog-wave"].includes(templateId);
        }

        if (draft.designVariant === "club-grid") {
          return ["midnight-flyer", "signal-grid", "electric-mosaic", "kinetic-ribbon", "city-light-stamp"].includes(templateId);
        }

        return ["sunburst-billboard", "paper-cut-stage", "afterglow-columns", "rooftop-blueprint", "monolith-dateblock"].includes(templateId);
      }),
    [draft.designVariant],
  );
  const localPosterProviderConnected =
    localPosterProvider === "pollinations" || localPosterProvider === "pollinations-alt"
      ? true
      : Boolean(providerKeys[localPosterProvider]);
  const selectedPreset = useMemo(
    () => posterIdeaPresets.find((item) => item.id === selectedIdeaPreset) ?? posterIdeaPresets[0],
    [selectedIdeaPreset],
  );
  const localGeneratedPosterUrl = localPosterGeneration.imageUrl ?? "";
  const localGeneratedPosterArtDirection = localGeneratedPosterUrl
    ? `${selectedPreset.prompt} via ${getProviderLabel(localPosterGeneration.provider)}`
    : "";
  const localGeneratedPosterNeedsSave = Boolean(
    localGeneratedPosterUrl &&
      (
        persistedBaselineDraft.posterReferenceUrls?.[0] !== localGeneratedPosterUrl ||
        (persistedBaselineDraft.posterAssetMode ?? "graphic-only") !== "banana-pro" ||
        (persistedBaselineDraft.posterArtDirection ?? "") !== localGeneratedPosterArtDirection
      ),
  );
  const hasUnsavedChanges =
    buildDraftFingerprint(draft) !== buildDraftFingerprint(persistedBaselineDraft) ||
    Boolean(pendingHeroPreview) ||
    localGeneratedPosterNeedsSave;

  const cleanupAiPosterUrls = useCallback(async (urls: string[], keepUrl?: string) => {
    const posterUrls = uniqueStrings(urls).filter((url) => url !== keepUrl);

    if (posterUrls.length === 0) {
      return;
    }

    try {
      await fetch("/api/poster-designer/generate", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ poster_urls: posterUrls }),
      });
    } catch {
      // Cleanup is best-effort; no-op if the designer service is unavailable.
    }
  }, []);

  const clearTransientAiWorkspace = useCallback(async (options?: { keepSelectedUrl?: string }) => {
    const generatedUrls = aiProposals.map((proposal) => proposal.poster_url);
    const keepSelectedUrl = options?.keepSelectedUrl;
    const currentPosterUrl = draft.posterReferenceUrls?.[0] ?? "";
    const currentPosterIsTransient = generatedUrls.includes(currentPosterUrl) && currentPosterUrl !== keepSelectedUrl;

    await cleanupAiPosterUrls(generatedUrls, keepSelectedUrl);
    setAiProposals([]);
    setAiGenerationId("");
    setSelectedAiProposalId(null);
    setAppliedAiProposalId(null);
    setLastAiGenerationSignature("");
    setAiStatus({ loading: false, error: "" });

    if (currentPosterIsTransient) {
      setDraft((current) => ({
        ...current,
        posterReferenceUrls: [],
        posterArtDirection: "",
        posterAssetMode: current.posterAssetMode === "banana-pro" ? "graphic-only" : current.posterAssetMode,
      }));
    }
  }, [aiProposals, cleanupAiPosterUrls, draft.posterReferenceUrls]);

  useEffect(() => {
    if (saveState.ok) {
      const saveSignal = `${saveState.savedEvent?.id ?? saveState.slug ?? "event"}:${saveState.savedEvent?.updatedAt ?? saveState.message}`;

      if (lastSaveFeedbackRef.current !== saveSignal) {
        playCue(saveState.savedEvent?.isPublished ? "published" : "saved");
        lastSaveFeedbackRef.current = saveSignal;
      }

      void cleanupAiPosterUrls(
        transientAiUrlsRef.current,
        saveState.savedEvent?.posterReferenceUrls?.[0] || undefined,
      );

      const timeoutId = window.setTimeout(() => {
        setAiProposals([]);
        setAiGenerationId("");
        setSelectedAiProposalId(null);
        setAppliedAiProposalId(null);
        setLastAiGenerationSignature("");
        setAiStatus({ loading: false, error: "" });
      }, 0);

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(publicFeedCacheKey);
      }

      router.refresh();
      return () => window.clearTimeout(timeoutId);
    }
  }, [cleanupAiPosterUrls, playCue, router, saveState.message, saveState.ok, saveState.savedEvent, saveState.slug]);

  useEffect(() => {
    if (!deleteState.ok || !deleteState.deletedEventId) {
      return;
    }

    if (lastDeleteFeedbackRef.current !== deleteState.deletedEventId) {
      playCue("deleted");
      lastDeleteFeedbackRef.current = deleteState.deletedEventId;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(publicFeedCacheKey);
    }

    const timeoutId = window.setTimeout(() => {
      setDeleteConfirmation("");
      setSelectedId("new");
      setDraft(emptyDraft);
      setOpenSections(defaultSectionState);
      setQuickStartOpen(false);
      setQuickStartStep(0);
      setPendingHeroPreview("");
      setPendingHeroFileName("");
      setPreviewScreen("preview");
      setActiveProductStep(0);
      setDesignWizardStep(0);
      setMaxUnlockedWizardStep(0);
      setDesignSourceMode("local");
      setLocalPosterProvider("pollinations");
      setExpandedProviderSetup(null);
      setLoadedPosterUrl("");
      setAiDirectionNote("");
      setAiProposals([]);
      setSelectedAiProposalId(null);
      setAppliedAiProposalId(null);
      setLastAiGenerationSignature("");
      setAiStatus({ loading: false, error: "" });
      localPosterGeneration.reset();
      updateSelectionLocation("new", "replace");
    }, 0);

    router.refresh();
    return () => window.clearTimeout(timeoutId);
  }, [deleteState.deletedEventId, deleteState.ok, emptyDraft, localPosterGeneration, playCue, router]);

  useEffect(() => {
    if (!saveState.ok) {
      return;
    }

    const persisted = saveState.savedEvent ?? safeEvents.find((event) => event.slug === saveState.slug);

    if (!persisted) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setSelectedId(persisted.id);
      updateSelectionLocation(persisted.id, "replace");
      setDraft(normalizeDraftRecord(persisted));
      setPendingHeroPreview("");
      setPendingHeroFileName("");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [safeEvents, saveState.ok, saveState.savedEvent, saveState.slug]);

  useEffect(() => {
    if (selectedId === "new") {
      return;
    }

    const refreshed = safeEvents.find((event) => event.id === selectedId);

    if (!refreshed) {
      return;
    }

    if (!hasUnsavedChanges && buildDraftFingerprint(refreshed) !== buildDraftFingerprint(draft)) {
      const frame = window.requestAnimationFrame(() => {
        setDraft(normalizeDraftRecord(refreshed));
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [draft, hasUnsavedChanges, safeEvents, selectedId]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncSelectionFromLocation = () => {
      const url = new URL(window.location.href);
      const queryId = url.searchParams.get("event");
      const storedId = window.localStorage.getItem(venueSelectionStorageKey);
      const preferredId =
        (queryId && safeEvents.some((event) => event.id === queryId) && queryId) ||
        (storedId && safeEvents.some((event) => event.id === storedId) && storedId) ||
        (selectedId === "new" ? "new" : "") ||
        safeEvents[0]?.id ||
        "new";

      if (preferredId !== selectedId) {
        void clearTransientAiWorkspace();
        setSelectedId(preferredId);

        if (queryId) {
          const existing = safeEvents.find((event) => event.id === preferredId) ?? null;
          applyEvent(preferredId === "new" ? null : existing);
          return;
        }

        updateSelectionLocation(preferredId, "replace");
        const existing = safeEvents.find((event) => event.id === preferredId) ?? null;
        applyEvent(preferredId === "new" ? null : existing);
      }
    };

    syncSelectionFromLocation();
    window.addEventListener("popstate", syncSelectionFromLocation);
    return () => window.removeEventListener("popstate", syncSelectionFromLocation);
  }, [clearTransientAiWorkspace, safeEvents, selectedId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    return () => {
      if (pendingHeroPreview) {
        URL.revokeObjectURL(pendingHeroPreview);
      }

      if (uploadedPosterPreview) {
        URL.revokeObjectURL(uploadedPosterPreview);
      }

      void cleanupAiPosterUrls(transientAiUrlsRef.current);
    };
  }, [cleanupAiPosterUrls, pendingHeroPreview, uploadedPosterPreview]);

  const generatedDesign = useMemo(() => buildPosterDesign(previewDraft), [previewDraft]);
  const generatedTicketDesign = useMemo(
    () => buildTicketDesign(previewDraft, generatedDesign),
    [generatedDesign, previewDraft],
  );
  const visiblePosterFields = useMemo(
    () => (draft.posterVisibleFields?.length ? draft.posterVisibleFields : posterFieldOptions.map((field) => field.id)),
    [draft.posterVisibleFields],
  );
  const posterOverlayLayoutsByViewport = useMemo<Record<PosterOverlayViewport, PosterOverlayLayout>>(
    () => resolveViewportOverlayLayouts(draft.posterOverlayLayout),
    [draft.posterOverlayLayout],
  );
  const currentPosterOverlayLayout = useMemo<Required<PosterOverlayLayout>>(
    () =>
      ({
        ...defaultPosterOverlayLayout,
        ...posterOverlayLayoutsByViewport[overlayEditorViewport],
      }) as Required<PosterOverlayLayout>,
    [overlayEditorViewport, posterOverlayLayoutsByViewport],
  );

  const financialModel = useMemo(() => {
    const grossTicket = draft.ticketPriceMXN + draft.ticketFeeMXN;
    const soldGross = draft.soldCount * grossTicket;
    const faceValue = draft.soldCount * draft.ticketPriceMXN;
    const platformFees = draft.soldCount * draft.ticketFeeMXN;
    const artistGross = faceValue * draft.artistPayoutRate;
    const payoutFee = artistGross * payoutAutomationRate;
    const artistNet = artistGross - payoutFee;
    const venueNetBeforeProcessor = soldGross - platformFees - artistNet;

    return {
      remaining: Math.max(0, draft.capacity - draft.soldCount),
      grossTicket,
      soldGross,
      platformFees,
      artistNet,
      venueNetBeforeProcessor,
    };
  }, [draft]);
  const visibleFieldCount = visiblePosterFields.length;
  const hiddenFieldCount = posterFieldOptions.length - visibleFieldCount;
  const posterLibrary = useMemo(
    () => sortPosterLibraryAssets(draft.posterAssets ?? []),
    [draft.posterAssets],
  );
  const activePosterLibraryAsset = useMemo(
    () => posterLibrary.find((asset) => asset.id === draft.activePosterAssetId) ?? posterLibrary[0] ?? null,
    [draft.activePosterAssetId, posterLibrary],
  );
  const deleteFormId = draft.id ? `delete-event-${draft.id}` : "delete-event";
  const activeWizardSteps = designSourceMode === "upload" ? uploadWizardSteps : wizardSteps;
  const stepMeta = activeWizardSteps[designWizardStep];
  const isFirstWizardStep = designWizardStep === 0;
  const isLastWizardStep = designWizardStep === activeWizardSteps.length - 1;
  const selectedAiProposal = useMemo(
    () => aiProposals.find((proposal) => proposal.proposal_id === selectedAiProposalId) ?? aiProposals[0] ?? null,
    [aiProposals, selectedAiProposalId],
  );
  const hasAppliedSelectedAiProposal = Boolean(
    selectedAiProposal && appliedAiProposalId === selectedAiProposal.proposal_id,
  );
  const generatedEditorialBrief = useMemo(() => buildEditorialBrief(draft, aiDirectionNote), [aiDirectionNote, draft]);
  const generatedEditorialBriefJson = useMemo(() => JSON.stringify(generatedEditorialBrief, null, 2), [generatedEditorialBrief]);
  const generatedAiPrompt = useMemo(() => buildAiPromptSeed(generatedEditorialBrief), [generatedEditorialBrief]);
  const generatedAiContext = useMemo(() => buildAiDesignContext(generatedEditorialBrief), [generatedEditorialBrief]);
  const currentAiSignature = useMemo(
    () => JSON.stringify({ prompt: generatedAiPrompt, context: generatedAiContext }),
    [generatedAiContext, generatedAiPrompt],
  );
  const aiProposalsAreCurrent = Boolean(aiProposals.length > 0 && lastAiGenerationSignature === currentAiSignature);
  const designSourceLabel =
    designSourceMode === "local" ? "Local" : designSourceMode === "upload" ? "Upload" : "IA";
  const designSourceDetail =
    designSourceMode === "local"
      ? selectedPreset.title
      : designSourceMode === "upload"
        ? uploadOverlayOptions.find((option) => option.id === uploadTextOverlayMode)?.title ?? "Poster propio"
        : `${aiProposals.length || 0} propuestas recibidas`;
  const designSourceAction =
    designSourceMode === "local"
      ? "Genera un poster nuevo con el motor interno"
      : designSourceMode === "upload"
        ? "Usa tu poster final y decide el acomodo de texto"
        : "Envía un brief al diseñador externo para generar propuestas";
  const essentialsComplete = Boolean(
    draft.title.trim() &&
      draft.startsAt &&
      draft.venueName.trim() &&
      draft.venueAddress.trim() &&
      (draft.lineup ?? []).length > 0,
  );
  const storyHasContent = Boolean(
    draft.summary.trim() || draft.description.trim() || (draft.genre ?? []).length > 0,
  );
  const operationReady = Boolean(draft.doorTime && draft.soundcheckTime);
  const visualFoundationsReady = Boolean(
    essentialsComplete && draft.summary.trim() && draft.description.trim() && operationReady,
  );
  const hasUploadedPosterAsset = Boolean(uploadedPosterPreview || draft.posterReferenceUrls?.[0]);
  const hasPosterFieldsSelected = visibleFieldCount > 0;
  const canAdvanceFromStep0 =
    designSourceMode === "upload" ? Boolean(hasUploadedPosterAsset && visualFoundationsReady) : visualFoundationsReady;
  const canAdvanceFromStep1 =
    designSourceMode === "local"
      ? Boolean(selectedPreset && localPosterProviderConnected)
      : designSourceMode === "upload"
        ? hasPosterFieldsSelected
        : Boolean(hasAppliedSelectedAiProposal && aiProposalsAreCurrent && !aiStatus.loading);
  const canAdvanceEssence = Boolean(draft.title.trim() && splitCommaList(lineupText).length > 0 && draft.description.trim());
  const canAdvanceLogistics = Boolean(draft.startsAt && draft.venueName.trim() && draft.venueAddress.trim());
  const canAdvanceEconomy = Boolean(draft.capacity > 0 && draft.ticketPriceMXN >= 0);
  const currentProductStepMeta = productWizardSteps[activeProductStep];
  const isProductFirstStep = activeProductStep === 0;
  const isProductLastStep = activeProductStep === productWizardSteps.length - 1;
  const generatedPosterProviderLabel = getProviderLabel(localPosterGeneration.provider);
  const effectivePosterReferenceUrls =
    designSourceMode === "local" && localPosterGeneration.imageUrl
      ? [localPosterGeneration.imageUrl]
      : designSourceMode === "upload" && uploadedPosterPreview
        ? [uploadedPosterPreview]
      : draft.posterReferenceUrls ?? [];
  const effectivePosterAssetMode =
    designSourceMode === "local" && localPosterGeneration.imageUrl
      ? ("banana-pro" as NonNullable<VenueEventRecord["posterAssetMode"]>)
      : designSourceMode === "upload" && uploadedPosterPreview
        ? ("uploaded-hero" as NonNullable<VenueEventRecord["posterAssetMode"]>)
      : (draft.posterAssetMode ?? "graphic-only");
  const effectivePosterOriginMode =
    designSourceMode === "upload"
      ? "upload"
      : designSourceMode === "ai"
        ? "ai"
        : "local";
  const effectivePosterArtDirection =
    designSourceMode === "local" && localPosterGeneration.imageUrl
      ? `${selectedPreset.prompt} via ${generatedPosterProviderLabel}`
      : designSourceMode === "upload" && uploadedPosterPreview
        ? `Uploaded poster with ${uploadTextOverlayMode} overlay`
      : draft.posterArtDirection ?? "";
  const effectivePosterTextOverlayMode =
    designSourceMode === "upload"
      ? uploadTextOverlayMode
      : (draft.posterTextOverlayMode ?? "editorial-band");
  const canAdvanceGallery = Boolean(effectivePosterReferenceUrls[0] || posterLibrary.length > 0);
  const canAdvanceProductStep =
    activeProductStep === 0
      ? canAdvanceEssence
      : activeProductStep === 1
        ? canAdvanceLogistics
        : activeProductStep === 2
          ? canAdvanceGallery
          : canAdvanceEconomy;
  const designWizardErrorStepIds = [
    localPosterGeneration.status === "error" ? 1 : null,
    aiStatus.error ? 1 : null,
  ].filter((stepId): stepId is number => stepId !== null);
  const productWizardErrorStepIds = [
    !canAdvanceEssence && activeProductStep >= 0 ? 0 : null,
    !canAdvanceLogistics && activeProductStep >= 1 ? 1 : null,
    !canAdvanceGallery && activeProductStep >= 2 ? 2 : null,
    !canAdvanceEconomy && activeProductStep >= 3 ? 3 : null,
  ].filter((stepId): stepId is number => stepId !== null);
  const designFlowSteps = useMemo(
    () =>
      buildFlowStepPresentation(activeWizardSteps, {
        activeStepId: designWizardStep,
        unlockedStepId: maxUnlockedWizardStep,
        errorStepIds: designWizardErrorStepIds,
        goalStepId: activeWizardSteps[activeWizardSteps.length - 1]?.id,
      }),
    [activeWizardSteps, designWizardErrorStepIds, designWizardStep, maxUnlockedWizardStep],
  );
  const productFlowSteps = useMemo(
    () =>
      buildFlowStepPresentation(productWizardSteps, {
        activeStepId: activeProductStep,
        unlockedStepId: productWizardSteps[productWizardSteps.length - 1]?.id ?? activeProductStep,
        errorStepIds: productWizardErrorStepIds,
        goalStepId: productWizardSteps[productWizardSteps.length - 1]?.id,
      }),
    [activeProductStep, productWizardErrorStepIds],
  );
  const activeProviderSetup =
    expandedProviderSetup === "huggingface" || expandedProviderSetup === "together" ? expandedProviderSetup : null;
  const ticketPreviewArtworkUrl = effectivePosterReferenceUrls[0] || previewDraft.heroImage;
  const localPreviewPosterUrl =
    designSourceMode === "local"
      ? localPosterGeneration.imageUrl || effectivePosterReferenceUrls[0] || ""
      : "";
  const previewPosterUrlForTheme =
    designSourceMode === "local"
      ? localPreviewPosterUrl
      : designSourceMode === "upload"
        ? effectivePosterReferenceUrls[0] || ""
        : selectedAiProposal?.poster_url ?? effectivePosterReferenceUrls[0] ?? "";
  const activeConsoleTabMeta =
    venueConsoleTabs.find((tab) => tab.id === activeConsoleTab) ?? venueConsoleTabs[0];
  const renderedPreviewPosterUrl =
    designSourceMode === "ai"
      ? selectedAiProposal?.poster_url ?? effectivePosterReferenceUrls[0] ?? ""
      : localPreviewPosterUrl || effectivePosterReferenceUrls[0] || "";
  const overlayEditorViewportMeta = {
    desktop: { label: "Desktop", width: "1200px", height: "760px", scale: 0.46 },
    tablet: { label: "Tablet", width: "1024px", height: "768px", scale: 0.44 },
    mobile: { label: "Mobile", width: "390px", height: "844px", scale: 0.68 },
  } satisfies Record<PosterViewport, { label: string; width: string; height: string; scale: number }>;
  const selectedOverlayViewportMeta = overlayEditorViewportMeta[overlayEditorViewport];
  const activePreviewPosterUrl = renderedPreviewPosterUrl || effectivePosterReferenceUrls[0] || previewDraft.heroImage || "";
  const previewPosterArtworkFit =
    designSourceMode === "upload" && effectivePosterTextOverlayMode === "none" ? "contain" : "cover";
  const previewTicketModel = useMemo(
    () =>
      resolveTicketCompositeRenderModel(previewDraft, {
        ticketDesign: generatedTicketDesign,
        posterDesign: generatedDesign,
        artworkUrl: ticketPreviewArtworkUrl,
        preferLiveEditorState: true,
      }),
    [generatedDesign, generatedTicketDesign, previewDraft, ticketPreviewArtworkUrl],
  );
  const previewRelatedEvents = useMemo(
    () =>
      safeEvents
        .filter((event) => event.id !== draft.id)
        .slice(0, 3)
        .map((event) => ({ slug: event.slug, title: event.title })),
    [draft.id, safeEvents],
  );
  const overlayEditorGuideBlocks = [
    visiblePosterFields.includes("lineup") && previewDraft.lineup.length > 0
      ? ({ role: "lineup", label: "Lineup" } as const)
      : null,
    { role: "hero", label: "Headline" } as const,
    visiblePosterFields.includes("description") && previewDraft.description.trim()
      ? ({ role: "story", label: "Historia" } as const)
      : null,
    (visiblePosterFields.includes("schedule") ||
      visiblePosterFields.includes("address") ||
      visiblePosterFields.includes("cta") ||
      visiblePosterFields.includes("related"))
      ? ({ role: "action", label: "Acción" } as const)
      : null,
  ].filter(Boolean) as Array<{ role: PosterBlockRole; label: string }>;
  const activeOverlayRole = overlayEditorGuideBlocks.find((block) => block.role === overlayEditorRole)?.role ?? overlayEditorGuideBlocks[0]?.role ?? "hero";
  const activeOverlayLayer = overlayEditorLayer;

  useEffect(() => {
    transientAiUrlsRef.current = aiProposals.map((proposal) => proposal.poster_url);
  }, [aiProposals]);

  useEffect(() => {
    if (designSourceMode !== "local" || localPosterGeneration.status !== "success" || !localPosterGeneration.imageUrl) {
      return;
    }

    const posterSignal = `${localPosterGeneration.provider}:${localPosterGeneration.imageUrl}`;

    if (lastPosterReadySignalRef.current === posterSignal) {
      return;
    }

    playCue("poster-ready");
    lastPosterReadySignalRef.current = posterSignal;
  }, [designSourceMode, localPosterGeneration.imageUrl, localPosterGeneration.provider, localPosterGeneration.status, playCue]);

  useEffect(() => {
    let cancelled = false;

    if (!previewPosterUrlForTheme) {
      const timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          setPreviewPosterThemeVars(undefined);
        }
      }, 0);

      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }

    void buildPosterPreviewTheme(previewPosterUrlForTheme)
      .then((nextThemeVars) => {
        if (!cancelled) {
          setPreviewPosterThemeVars(nextThemeVars ?? undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewPosterThemeVars(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewPosterUrlForTheme]);

  function updateSelectionLocation(id: string, mode: "push" | "replace" = "push") {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (!id || id === "new") {
      url.searchParams.delete("event");
      window.localStorage.removeItem(venueSelectionStorageKey);
    } else {
      url.searchParams.set("event", id);
      window.localStorage.setItem(venueSelectionStorageKey, id);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (mode === "replace") {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
  }

  function applyEvent(event: VenueEventRecord | null) {
    const newDraft = createEmptyDraft();
    const persistedPosterUrl = getPrimaryPosterUrl(event);
    const inferredMode = inferDesignSourceModeFromEvent(event);
    const inferredPresetId = inferSelectedPresetIdFromEvent(event);
    const nextOverlayMode = event?.posterTextOverlayMode ?? "none";
    const hasPoster = Boolean(persistedPosterUrl);

    setDraft(event ? normalizeDraftRecord(event) : newDraft);
    setActiveConsoleTab("essentials");
    setActiveVisualTab(inferredMode === "upload" ? "upload" : inferredMode === "ai" ? "library" : "local");
    setOpenSections(defaultSectionState);
    setQuickStartOpen(false);
    setQuickStartStep(0);
    setQuickStartTitle(event?.title ?? newDraft.title);
    setQuickStartStartsAt(toDateTimeLocalValue(event?.startsAt ?? newDraft.startsAt));
    setQuickStartVenue(event?.venueName ?? newDraft.venueName);
    setQuickStartLineup((event?.lineup ?? newDraft.lineup).join(", "));
    setLineupText((event?.lineup ?? newDraft.lineup).join(", "));
    setGenreText((event?.genre ?? newDraft.genre).join(", "));
    setPendingHeroPreview("");
    setPendingHeroFileName("");
    setUploadedPosterPreview(inferredMode === "upload" ? persistedPosterUrl : "");
    setUploadedPosterFileName(persistedPosterUrl ? persistedPosterUrl.split("/").pop()?.split("?")[0] ?? "" : "");
    setUploadTextOverlayMode(nextOverlayMode);
    setPreviewScreen("preview");
    setActiveProductStep(0);
    setDesignWizardStep(hasPoster ? 2 : 0);
    setMaxUnlockedWizardStep(hasPoster ? 2 : 0);
    setDesignSourceMode(inferredMode);
    setSelectedIdeaPreset(inferredPresetId);
    setLocalPosterProvider("pollinations");
    setExpandedProviderSetup(null);
    setLoadedPosterUrl(persistedPosterUrl);
    setAiDirectionNote(event?.posterArtDirection ?? "");
    setAiProposals([]);
    setAiGenerationId("");
    setSelectedAiProposalId(null);
    setAppliedAiProposalId(null);
    setLastAiGenerationSignature("");
    setAiStatus({ loading: false, error: "" });
    localPosterGeneration.reset();
  }

  function loadPosterRevision(asset: EventPosterAsset) {
    const snapshot = asset.snapshot;
    const nextPosterUrls = snapshot?.posterReferenceUrls?.length ? snapshot.posterReferenceUrls : [asset.url];
    const nextAssetMode = snapshot?.posterAssetMode ?? asset.assetMode ?? "graphic-only";
    const nextOverlayMode = snapshot?.posterTextOverlayMode ?? asset.overlayMode ?? "editorial-band";
    const nextLineup = snapshot?.lineup ?? draft.lineup;
    const nextGenre = snapshot?.genre ?? draft.genre;

    void clearTransientAiWorkspace({ keepSelectedUrl: asset.url });
    localPosterGeneration.reset();

    setDraft((current) => ({
      ...current,
      title: snapshot?.title ?? current.title,
      summary: snapshot?.summary ?? current.summary,
      description: snapshot?.description ?? current.description,
      startsAt: snapshot?.startsAt ?? current.startsAt,
      endsAt: snapshot?.endsAt ?? current.endsAt,
      venueName: snapshot?.venueName ?? current.venueName,
      venueAddress: snapshot?.venueAddress ?? current.venueAddress,
      heroImage: snapshot?.heroImage ?? current.heroImage,
      lineup: nextLineup,
      genre: nextGenre,
      designVariant: snapshot?.designVariant ?? current.designVariant,
      designTemplateId: snapshot?.designTemplateId ?? current.designTemplateId,
      designMotifs: snapshot?.designMotifs ?? current.designMotifs,
      posterVisibleFields: snapshot?.posterVisibleFields ?? current.posterVisibleFields,
      posterArtDirection: snapshot?.posterArtDirection ?? asset.artDirection ?? current.posterArtDirection,
      posterReferenceUrls: nextPosterUrls,
      posterAssetMode: nextAssetMode,
      posterTextOverlayMode: nextOverlayMode,
      posterOverlayLayout: snapshot?.posterOverlayLayout ?? current.posterOverlayLayout,
      activePosterAssetId: asset.id,
    }));
    setLineupText(nextLineup.join(", "));
    setGenreText(nextGenre.join(", "));
    setAiDirectionNote(snapshot?.posterArtDirection ?? asset.artDirection ?? "");
    setLoadedPosterUrl(asset.url);
    setUploadedPosterPreview(nextAssetMode === "uploaded-hero" ? asset.url : "");
    setUploadedPosterFileName(asset.url.split("/").pop()?.split("?")[0] ?? "");
    setUploadTextOverlayMode(nextOverlayMode);
    setDesignSourceMode(inferDesignSourceModeFromPosterAsset(asset));
    setActiveConsoleTab("visual");
    setActiveVisualTab(nextAssetMode === "uploaded-hero" ? "upload" : asset.originMode === "local" ? "local" : "library");
    setActiveProductStep(2);
    setSelectedIdeaPreset(
      inferSelectedPresetIdFromEvent({
        ...draft,
        designVariant: snapshot?.designVariant ?? draft.designVariant,
        designTemplateId: snapshot?.designTemplateId ?? draft.designTemplateId,
      }),
    );
    setDesignWizardStep(2);
    setMaxUnlockedWizardStep(2);
    setPreviewScreen("preview");
    setOpenSections((current) => ({
      ...current,
      visual: true,
      assets: true,
    }));
  }

  function removePosterRevision(assetId: string) {
    const nextAssets = posterLibrary.filter((asset) => asset.id !== assetId);
    const nextActiveAsset =
      nextAssets.find((asset) => asset.id === draft.activePosterAssetId) ??
      nextAssets[0] ??
      null;

    setDraft((current) => ({
      ...current,
      posterAssets: nextAssets,
      activePosterAssetId: nextActiveAsset?.id,
      posterReferenceUrls: nextActiveAsset?.url ? [nextActiveAsset.url] : [],
      posterArtDirection:
        nextActiveAsset?.snapshot?.posterArtDirection ??
        nextActiveAsset?.artDirection ??
        (nextAssets.length === 0 ? "" : current.posterArtDirection),
      posterAssetMode:
        nextActiveAsset?.snapshot?.posterAssetMode ??
        nextActiveAsset?.assetMode ??
        (nextAssets.length === 0 ? "graphic-only" : current.posterAssetMode),
      posterTextOverlayMode:
        nextActiveAsset?.snapshot?.posterTextOverlayMode ??
        nextActiveAsset?.overlayMode ??
        (nextAssets.length === 0 ? "editorial-band" : current.posterTextOverlayMode),
      posterOverlayLayout:
        nextActiveAsset?.snapshot?.posterOverlayLayout ??
        (nextAssets.length === 0 ? defaultPosterOverlayLayout : current.posterOverlayLayout),
    }));
    setLoadedPosterUrl(nextActiveAsset?.url ?? "");
    setUploadedPosterPreview(nextActiveAsset?.assetMode === "uploaded-hero" ? nextActiveAsset.url : "");
    setUploadedPosterFileName(nextActiveAsset?.url?.split("/").pop()?.split("?")[0] ?? "");
    setDesignSourceMode(inferDesignSourceModeFromPosterAsset(nextActiveAsset));
    setUploadTextOverlayMode(
      nextActiveAsset?.snapshot?.posterTextOverlayMode ??
      nextActiveAsset?.overlayMode ??
      "editorial-band",
    );
    localPosterGeneration.reset();
  }

  function duplicatePosterRevision(asset: EventPosterAsset) {
    const now = new Date().toISOString();

    setDraft((current) => {
      const nextRevision = nextPosterRevision(current.posterAssets ?? []);
      const duplicateAsset: EventPosterAsset = {
        ...asset,
        id: `poster-${crypto.randomUUID()}`,
        label: `${asset.label} · Variante`,
        status: "draft",
        revision: nextRevision,
        createdAt: now,
        updatedAt: now,
        selectedAt: now,
        publishedAt: undefined,
        archivedAt: undefined,
      };

      return {
        ...current,
        posterAssets: sortPosterLibraryAssets([duplicateAsset, ...(current.posterAssets ?? [])]),
        activePosterAssetId: duplicateAsset.id,
        posterReferenceUrls: [duplicateAsset.url],
        posterTextOverlayMode:
          duplicateAsset.snapshot?.posterTextOverlayMode ??
          duplicateAsset.overlayMode ??
          current.posterTextOverlayMode,
        posterOverlayLayout:
          duplicateAsset.snapshot?.posterOverlayLayout ??
          current.posterOverlayLayout,
      };
    });

    setLoadedPosterUrl(asset.url);
    setDesignSourceMode(inferDesignSourceModeFromPosterAsset(asset));
    setUploadTextOverlayMode(
      asset.snapshot?.posterTextOverlayMode ??
      asset.overlayMode ??
      "editorial-band",
    );
    setActiveConsoleTab("visual");
    setActiveVisualTab("library");
    setActiveProductStep(2);
    playCue("saved");
  }

  function requestPosterRevisionDelete(asset: EventPosterAsset) {
    setPosterDeleteTarget(asset);
  }

  function confirmPosterRevisionDelete() {
    if (!posterDeleteTarget) {
      return;
    }

    removePosterRevision(posterDeleteTarget.id);
    setPosterDeleteTarget(null);
  }

  function goToProductStep(stepId: ProductWizardStep) {
    setActiveProductStep(stepId);
  }

  function goToPreviousProductStep() {
    setActiveProductStep((current) => (current === 0 ? current : ((current - 1) as ProductWizardStep)));
  }

  function goToNextProductStep() {
    setActiveProductStep((current) => {
      if (current === 0 && !canAdvanceEssence) {
        return current;
      }

      if (current === 1 && !canAdvanceLogistics) {
        return current;
      }

      if (current === 2 && !canAdvanceGallery) {
        return current;
      }

      if (current === 3) {
        return current;
      }

      return (current + 1) as ProductWizardStep;
    });
  }

  function selectEvent(id: string, options?: { historyMode?: "push" | "replace" | "none" }) {
    const historyMode = options?.historyMode ?? "push";

    void clearTransientAiWorkspace();
    setSelectedId(id);

    if (historyMode !== "none") {
      updateSelectionLocation(id, historyMode);
    }

    if (id === "new") {
      applyEvent(null);
      return;
    }

    const existing = safeEvents.find((event) => event.id === id) ?? null;
    applyEvent(existing);
  }

  function updateDraft<Key extends keyof VenueEventDraft>(key: Key, value: VenueEventDraft[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function commitLineupText(value = lineupText) {
    updateDraft("lineup", splitCommaList(value));
  }

  function commitGenreText(value = genreText) {
    updateDraft("genre", splitCommaList(value));
  }

  function toggleSection(sectionId: EditorSectionId) {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  function openQuickStartForNewEvent() {
    const newDraft = createEmptyDraft();

    selectEvent("new");
    setQuickStartTitle("");
    setQuickStartStartsAt(toDateTimeLocalValue(newDraft.startsAt));
    setQuickStartVenue("");
    setQuickStartLineup("");
    setQuickStartStep(0);
    setQuickStartOpen(true);
  }

  function advanceQuickStart() {
    if (quickStartStep === 0 && !quickStartTitle.trim()) {
      return;
    }

    if (quickStartStep === 1 && (!quickStartStartsAt || !quickStartVenue.trim())) {
      return;
    }

    if (quickStartStep === 2 && !quickStartLineup.trim()) {
      return;
    }

    if (quickStartStep < 2) {
      setQuickStartStep((current) => (current + 1) as 0 | 1 | 2);
      return;
    }

    const timing = buildEventTimingFromStart(new Date(quickStartStartsAt).toISOString());
    const lineup = splitCommaList(quickStartLineup);

    setDraft((current) => ({
      ...current,
      title: quickStartTitle.trim(),
      venueName: quickStartVenue.trim(),
      lineup,
      startsAt: timing.startsAt,
      endsAt: timing.endsAt,
      doorTime: timing.doorTime,
      soundcheckTime: timing.soundcheckTime,
    }));
    setLineupText(lineup.join(", "));
    setQuickStartOpen(false);
    setOpenSections({
      ...defaultSectionState,
      visual: true,
    });
    setMaxUnlockedWizardStep(1);
    setDesignWizardStep(1);
    setPreviewScreen("preview");
    window.requestAnimationFrame(() => {
      visualSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function dismissQuickStartToFullEditor() {
    setQuickStartOpen(false);
    setOpenSections((current) => ({
      ...current,
      essentials: true,
    }));
  }

  async function suggestFieldCopy(field: "summary" | "description" | "genre") {
    setCopyAssistLoadingField(field);

    try {
      const response = await fetch("/api/venue-copy-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field,
          title: draft.title,
          lineup: draft.lineup.join(", "),
          venue: draft.venueName,
          genres: draft.genre.join(", "),
        }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { ok?: boolean; text?: string };
      const text = payload.ok ? payload.text?.trim() ?? "" : "";

      if (!text) {
        return;
      }

      if (field === "summary") {
        updateDraft("summary", text);
      } else if (field === "description") {
        updateDraft("description", text);
      } else {
        setGenreText(text);
        updateDraft("genre", splitCommaList(text));
      }
    } catch {
      // Silent failure by design.
    } finally {
      setCopyAssistLoadingField((current) => (current === field ? null : current));
    }
  }

  function persistProviderKey(provider: Exclude<PosterGenerationProvider, "pollinations" | "pollinations-alt">) {
    const storageKey = provider === "huggingface" ? "foro_hf_key" : "foro_together_key";
    const nextValue = providerKeyDrafts[provider].trim();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nextValue);
    }

    setProviderKeys((current) => ({
      ...current,
      [provider]: nextValue,
    }));
    setExpandedProviderSetup(null);
  }

  function selectGenerationProvider(provider: PosterGenerationProvider) {
    setLocalPosterProvider(provider);

    if (provider === "pollinations" || provider === "pollinations-alt") {
      setExpandedProviderSetup(null);
      return;
    }

    if (!providerKeys[provider]) {
      setExpandedProviderSetup(provider);
    } else {
      setExpandedProviderSetup(null);
    }
  }

  async function triggerLocalPosterGeneration() {
    setMaxUnlockedWizardStep(2);
    forceWizardStep(2);
    setPreviewScreen("preview");
    setLoadedPosterUrl("");
    await localPosterGeneration.generate(
      {
        title: draft.title,
        summary: draft.summary,
        lineup: draft.lineup,
        venueName: draft.venueName,
        startsAt: draft.startsAt,
      },
      selectedPreset.id,
      localPosterProvider,
    );
  }

  function regenerateLocalPoster() {
    setLoadedPosterUrl("");
    localPosterGeneration.regenerate();
  }

  function jumpBackToProviderSelector() {
    forceWizardStep(1);
    setOpenSections((current) => ({
      ...current,
      visual: true,
    }));
    window.requestAnimationFrame(() => {
      providerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function downloadGeneratedPoster() {
    if (!localPosterGeneration.imageUrl) {
      return;
    }

    const response = await fetch(localPosterGeneration.imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `poster-${draft.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addOperationalMoment() {
    setDraft((current) => ({
      ...current,
      operationalMoments: [
        ...(current.operationalMoments ?? []),
        createOperationalMoment(current.doorTime || current.startsAt),
      ],
    }));
  }

  function updateOperationalMoment(
    momentId: string,
    key: keyof Pick<EventOperationalMoment, "label" | "time">,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      operationalMoments: (current.operationalMoments ?? []).map((moment) =>
        moment.id === momentId ? { ...moment, [key]: value } : moment,
      ),
    }));
  }

  function removeOperationalMoment(momentId: string) {
    setDraft((current) => ({
      ...current,
      operationalMoments: (current.operationalMoments ?? []).filter((moment) => moment.id !== momentId),
    }));
  }

  function toggleMotif(motifId: EventVisualMotifId) {
    setDraft((current) => {
      const currentMotifs = current.designMotifs ?? [];
      const nextMotifs = currentMotifs.includes(motifId)
        ? currentMotifs.filter((item) => item !== motifId)
        : [...currentMotifs, motifId].slice(0, 4);

      return {
        ...current,
        designMotifs: nextMotifs,
      };
    });
  }

  function togglePosterField(fieldId: PosterVisibleFieldId) {
    setDraft((current) => {
      const fields = current.posterVisibleFields?.length
        ? current.posterVisibleFields
        : posterFieldOptions.map((field) => field.id);
      const nextFields = fields.includes(fieldId)
        ? fields.filter((item) => item !== fieldId)
        : [...fields, fieldId];

      return {
        ...current,
        posterVisibleFields: nextFields,
      };
    });
  }

  function updatePosterOverlayLayout(patch: Partial<PosterOverlayLayout>) {
    setDraft((current) => {
      const currentLayouts = resolveViewportOverlayLayouts(current.posterOverlayLayout);

      return {
        ...current,
        posterOverlayLayout: {
          ...currentLayouts,
          [overlayEditorViewport]: {
            ...currentLayouts[overlayEditorViewport],
            ...patch,
          },
        },
      };
    });
    setPreviewScreen("preview");
  }

  function getOverlayOffsetPatch(role: PosterBlockRole, x: number, y: number): Partial<PosterOverlayLayout> {
    if (role === "hero") {
      return { heroOffsetX: x, heroOffsetY: y };
    }

    if (role === "lineup") {
      return { lineupOffsetX: x, lineupOffsetY: y };
    }

    if (role === "action") {
      return { actionOffsetX: x, actionOffsetY: y };
    }

    return { storyOffsetX: x, storyOffsetY: y };
  }

  function getOverlayOffset(role: PosterBlockRole) {
    if (role === "hero") {
      return { x: currentPosterOverlayLayout.heroOffsetX, y: currentPosterOverlayLayout.heroOffsetY };
    }

    if (role === "lineup") {
      return { x: currentPosterOverlayLayout.lineupOffsetX, y: currentPosterOverlayLayout.lineupOffsetY };
    }

    if (role === "action") {
      return { x: currentPosterOverlayLayout.actionOffsetX, y: currentPosterOverlayLayout.actionOffsetY };
    }

    return { x: currentPosterOverlayLayout.storyOffsetX, y: currentPosterOverlayLayout.storyOffsetY };
  }

  function getOverlayRoleScale(role: PosterBlockRole) {
    const pair = getOverlayRoleScalePair(role);
    return (pair.x + pair.y) / 2;
  }

  function getOverlayRoleBoxScale(role: PosterBlockRole) {
    const pair = getOverlayRoleBoxScalePair(role);
    return (pair.x + pair.y) / 2;
  }

  function formatOverlayScalePairLabel(pair: { x: number; y: number }) {
    const x = Math.round(pair.x * 100);
    const y = Math.round(pair.y * 100);
    return Math.abs(x - y) <= 1 ? `${Math.round((x + y) / 2)}%` : `${x}% × ${y}%`;
  }

  function getOverlayRoleScalePair(role: PosterBlockRole) {
    if (role === "hero") {
      return {
        x: currentPosterOverlayLayout.heroScaleX ?? currentPosterOverlayLayout.heroScale,
        y: currentPosterOverlayLayout.heroScaleY ?? currentPosterOverlayLayout.heroScale,
      };
    }

    if (role === "lineup") {
      return {
        x: currentPosterOverlayLayout.lineupScaleX ?? currentPosterOverlayLayout.lineupScale,
        y: currentPosterOverlayLayout.lineupScaleY ?? currentPosterOverlayLayout.lineupScale,
      };
    }

    if (role === "action") {
      return {
        x: currentPosterOverlayLayout.actionScaleX ?? currentPosterOverlayLayout.actionScale,
        y: currentPosterOverlayLayout.actionScaleY ?? currentPosterOverlayLayout.actionScale,
      };
    }

    return {
      x: currentPosterOverlayLayout.storyScaleX ?? currentPosterOverlayLayout.storyScale,
      y: currentPosterOverlayLayout.storyScaleY ?? currentPosterOverlayLayout.storyScale,
    };
  }

  function getOverlayRoleBoxScalePair(role: PosterBlockRole) {
    if (role === "hero") {
      return {
        x: currentPosterOverlayLayout.heroBoxScaleX ?? currentPosterOverlayLayout.heroBoxScale,
        y: currentPosterOverlayLayout.heroBoxScaleY ?? currentPosterOverlayLayout.heroBoxScale,
      };
    }

    if (role === "lineup") {
      return {
        x: currentPosterOverlayLayout.lineupBoxScaleX ?? currentPosterOverlayLayout.lineupBoxScale,
        y: currentPosterOverlayLayout.lineupBoxScaleY ?? currentPosterOverlayLayout.lineupBoxScale,
      };
    }

    if (role === "action") {
      return {
        x: currentPosterOverlayLayout.actionBoxScaleX ?? currentPosterOverlayLayout.actionBoxScale,
        y: currentPosterOverlayLayout.actionBoxScaleY ?? currentPosterOverlayLayout.actionBoxScale,
      };
    }

    return {
      x: currentPosterOverlayLayout.storyBoxScaleX ?? currentPosterOverlayLayout.storyBoxScale,
      y: currentPosterOverlayLayout.storyBoxScaleY ?? currentPosterOverlayLayout.storyBoxScale,
    };
  }

  function getOverlayRoleRotation(role: PosterBlockRole) {
    if (role === "hero") return currentPosterOverlayLayout.heroRotation;
    if (role === "lineup") return currentPosterOverlayLayout.lineupRotation;
    if (role === "action") return currentPosterOverlayLayout.actionRotation;
    return currentPosterOverlayLayout.storyRotation;
  }

  function getOverlayRoleOpacity(role: PosterBlockRole) {
    if (role === "hero") return currentPosterOverlayLayout.heroOpacity;
    if (role === "lineup") return currentPosterOverlayLayout.lineupOpacity;
    if (role === "action") return currentPosterOverlayLayout.actionOpacity;
    return currentPosterOverlayLayout.storyOpacity;
  }

  function getOverlayRoleScalePatch(role: PosterBlockRole, value: number): Partial<PosterOverlayLayout> {
    return getOverlayRoleScalePairPatch(role, value, value);
  }

  function getOverlayRoleBoxScalePatch(role: PosterBlockRole, value: number): Partial<PosterOverlayLayout> {
    return getOverlayRoleBoxScalePairPatch(role, value, value);
  }

  function getOverlayRoleScalePairPatch(role: PosterBlockRole, x: number, y: number): Partial<PosterOverlayLayout> {
    if (role === "hero") return { heroScale: (x + y) / 2, heroScaleX: x, heroScaleY: y };
    if (role === "lineup") return { lineupScale: (x + y) / 2, lineupScaleX: x, lineupScaleY: y };
    if (role === "action") return { actionScale: (x + y) / 2, actionScaleX: x, actionScaleY: y };
    return { storyScale: (x + y) / 2, storyScaleX: x, storyScaleY: y };
  }

  function getOverlayRoleBoxScalePairPatch(role: PosterBlockRole, x: number, y: number): Partial<PosterOverlayLayout> {
    if (role === "hero") return { heroBoxScale: (x + y) / 2, heroBoxScaleX: x, heroBoxScaleY: y };
    if (role === "lineup") return { lineupBoxScale: (x + y) / 2, lineupBoxScaleX: x, lineupBoxScaleY: y };
    if (role === "action") return { actionBoxScale: (x + y) / 2, actionBoxScaleX: x, actionBoxScaleY: y };
    return { storyBoxScale: (x + y) / 2, storyBoxScaleX: x, storyBoxScaleY: y };
  }

  function getOverlayRoleRotationPatch(role: PosterBlockRole, value: number): Partial<PosterOverlayLayout> {
    if (role === "hero") return { heroRotation: value };
    if (role === "lineup") return { lineupRotation: value };
    if (role === "action") return { actionRotation: value };
    return { storyRotation: value };
  }

  function getOverlayRoleOpacityPatch(role: PosterBlockRole, value: number): Partial<PosterOverlayLayout> {
    if (role === "hero") return { heroOpacity: value };
    if (role === "lineup") return { lineupOpacity: value };
    if (role === "action") return { actionOpacity: value };
    return { storyOpacity: value };
  }

  function handleOverlayGuidePointerDown(
    role: PosterBlockRole,
    layer: PosterEditorSelectionLayer,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const frame = overlayEditorPreviewRef.current;

    if (!frame) {
      return;
    }

    event.preventDefault();
    setOverlayEditorRole(role);
    setOverlayEditorLayer(layer);
    setPreviewScreen("preview");
    event.currentTarget.setPointerCapture(event.pointerId);

    const frameRect = frame.getBoundingClientRect();
    const initial = getOverlayOffset(role);
    const startX = event.clientX;
    const startY = event.clientY;
    let isDragging = false;

    const onMove = (moveEvent: PointerEvent) => {
      const pixelDeltaX = moveEvent.clientX - startX;
      const pixelDeltaY = moveEvent.clientY - startY;
      if (!isDragging && Math.hypot(pixelDeltaX, pixelDeltaY) < 6) {
        return;
      }

      isDragging = true;
      const deltaX = ((moveEvent.clientX - startX) / frameRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / frameRect.height) * 100;
      updatePosterOverlayLayout(
        getOverlayOffsetPatch(
          role,
          clampPosterControl(initial.x + deltaX, posterOverlayOffsetMin, posterOverlayOffsetMax),
          clampPosterControl(initial.y + deltaY, posterOverlayOffsetMin, posterOverlayOffsetMax),
        ),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function handleOverlayResizePointerDown(
    role: PosterBlockRole,
    layer: PosterEditorSelectionLayer,
    corner: "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se",
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const frame = overlayEditorPreviewRef.current;

    if (!frame) {
      return;
    }

    event.preventDefault();
    setOverlayEditorRole(role);
    setOverlayEditorLayer(layer);
    setPreviewScreen("preview");
    event.currentTarget.setPointerCapture(event.pointerId);

    const frameRect = frame.getBoundingClientRect();
    const roleElement = frame.querySelector<HTMLElement>(`[data-editor-role="${role}"]`);
    const roleRect = roleElement?.getBoundingClientRect();
    const resizeBaseWidth = Math.max(roleRect?.width ?? frameRect.width * 0.42, 96);
    const resizeBaseHeight = Math.max(roleRect?.height ?? frameRect.height * 0.28, 96);
    const initialScale = layer === "outer" ? getOverlayRoleScalePair(role) : getOverlayRoleBoxScalePair(role);
    const startX = event.clientX;
    const startY = event.clientY;
    const horizontalDirection = corner.includes("w") ? -1 : corner.includes("e") ? 1 : 0;
    const verticalDirection = corner.includes("n") ? -1 : corner.includes("s") ? 1 : 0;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / resizeBaseWidth) * horizontalDirection * 1.12;
      const deltaY = ((moveEvent.clientY - startY) / resizeBaseHeight) * verticalDirection * 1.12;
      const nextScaleX = clampPosterControl(initialScale.x + deltaX, posterOverlayScaleMin, posterOverlayScaleMax);
      const nextScaleY = clampPosterControl(initialScale.y + deltaY, posterOverlayScaleMin, posterOverlayScaleMax);
      updatePosterOverlayLayout(
        layer === "outer"
          ? getOverlayRoleScalePairPatch(role, nextScaleX, nextScaleY)
          : getOverlayRoleBoxScalePairPatch(role, nextScaleX, nextScaleY),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function handleOverlayRotatePointerDown(role: PosterBlockRole, event: ReactPointerEvent<HTMLElement>) {
    const frame = overlayEditorPreviewRef.current;

    if (!frame) {
      return;
    }

    event.preventDefault();
    setOverlayEditorRole(role);
    setOverlayEditorLayer("outer");
    setPreviewScreen("preview");
    event.currentTarget.setPointerCapture(event.pointerId);

    const frameRect = frame.getBoundingClientRect();
    const initialRotation = getOverlayRoleRotation(role);
    const startX = event.clientX;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / frameRect.width) * 120;
      const nextRotation = clampPosterControl(initialRotation + deltaX, -24, 24);
      updatePosterOverlayLayout(getOverlayRoleRotationPatch(role, nextRotation));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function applyIdeaPreset(presetId: (typeof posterIdeaPresets)[number]["id"]) {
    const preset = posterIdeaPresets.find((item) => item.id === presetId) ?? posterIdeaPresets[0];
    setSelectedIdeaPreset(preset.id);
    setDraft((current) => ({
      ...current,
      designVariant: preset.localVariant,
      designTemplateId: preset.localTemplate,
      designMotifs: preset.motifs,
    }));
    setPreviewScreen("preview");
  }

  function switchDesignSourceMode(mode: DesignSourceMode) {
    if (mode !== "ai" && designSourceMode === "ai") {
      void clearTransientAiWorkspace();
    }

    const baseUnlockedStep = essentialsComplete ? 1 : 0;
    const nextWizardProgress =
      mode === "local"
        ? ({
            step: (localPosterGeneration.imageUrl ? 2 : baseUnlockedStep) as 0 | 1 | 2,
            max: (localPosterGeneration.imageUrl ? 2 : baseUnlockedStep) as 0 | 1 | 2,
          })
        : mode === "upload"
          ? ({
              step: (hasUploadedPosterAsset ? (hasPosterFieldsSelected ? 2 : 1) : 0) as 0 | 1 | 2,
              max: (hasUploadedPosterAsset ? (hasPosterFieldsSelected ? 2 : 1) : 0) as 0 | 1 | 2,
            })
          : ({
              step: (hasAppliedSelectedAiProposal && aiProposalsAreCurrent && !aiStatus.loading ? 2 : baseUnlockedStep) as 0 | 1 | 2,
              max: (hasAppliedSelectedAiProposal && aiProposalsAreCurrent && !aiStatus.loading ? 2 : baseUnlockedStep) as 0 | 1 | 2,
            });

    setDesignSourceMode(mode);
    setActiveVisualTab(mode === "upload" ? "upload" : mode === "local" ? "local" : "library");
    setActiveConsoleTab("visual");
    setMaxUnlockedWizardStep(nextWizardProgress.max);
    setDesignWizardStep(nextWizardProgress.step);
    setPreviewScreen("preview");
  }

  function handleUploadedPosterFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (uploadedPosterPreview) {
      URL.revokeObjectURL(uploadedPosterPreview);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedPosterPreview(objectUrl);
    setUploadedPosterFileName(file.name);
    updateDraft("posterReferenceUrls", [objectUrl]);
    updateDraft("posterAssetMode", "uploaded-hero");
    updateDraft("posterTextOverlayMode", uploadTextOverlayMode);
    updateDraft("posterArtDirection", `Uploaded poster with ${uploadTextOverlayMode} overlay`);
  }

  async function generateAiPosterDirections() {
    setAiStatus({ loading: true, error: "" });
    await clearTransientAiWorkspace();
    setAiStatus({ loading: true, error: "" });

    try {
      const response = await fetch("/api/poster-designer/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: generatedAiPrompt,
          design_context: generatedAiContext,
          event_name: draft.title,
          lineup: draft.lineup,
          event_date: formatDesignerEventDate(draft.startsAt),
          venue: `${draft.venueName} · ${draft.venueAddress}`,
          purchase_link: `https://foro-gdl.local/events/${draft.slug || "preview"}`,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.detail || "No fue posible generar propuestas IA.");
      }

      const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
      setAiProposals(proposals);
      setAiGenerationId(typeof payload.generation_id === "string" ? payload.generation_id : "");
      setSelectedAiProposalId(proposals[0]?.proposal_id ?? null);
      setAppliedAiProposalId(null);
      setLastAiGenerationSignature(currentAiSignature);
      setPreviewScreen("preview");
    } catch (error) {
      setAiStatus({
        loading: false,
        error: error instanceof Error ? error.message : "No fue posible generar propuestas IA.",
      });
      return;
    }

    setAiStatus({ loading: false, error: "" });
  }

  function handleHeroFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];

    if (pendingHeroPreview) {
      URL.revokeObjectURL(pendingHeroPreview);
    }

    if (!nextFile) {
      setPendingHeroPreview("");
      setPendingHeroFileName("");
      return;
    }

    setPendingHeroPreview(URL.createObjectURL(nextFile));
    setPendingHeroFileName(nextFile.name);
  }

  function resetDraftToSavedState() {
    void clearTransientAiWorkspace();
    applyEvent(selectedId === "new" ? null : safeEvents.find((event) => event.id === selectedId) ?? null);
  }

  function requestDeleteEvent() {
    if (!draft.id) {
      return;
    }

    const expectedPhrase = `BORRAR ${draft.title}`;
    const typed = window.prompt(
      `Esta acción no se puede deshacer.\n\nEscribe exactamente:\n${expectedPhrase}`,
      "",
    );

    if (typed === null) {
      return;
    }

    const normalized = typed.trim();
    setDeleteConfirmation(normalized);
    void clearTransientAiWorkspace();

    window.setTimeout(() => {
      const form = document.getElementById(deleteFormId) as HTMLFormElement | null;
      form?.requestSubmit();
    }, 0);
  }

  async function applySelectedAiProposal() {
    if (!selectedAiProposal) {
      return;
    }

    let finalPosterUrl = selectedAiProposal.poster_url;

    if (aiGenerationId && selectedAiProposal.asset_id) {
      try {
        const response = await fetch("/api/poster-designer/select", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            generation_id: aiGenerationId,
            selected_asset_id: selectedAiProposal.asset_id,
            persist_selected: true,
          }),
        });
        const payload = (await response.json()) as PosterAiSelectionResult;
        if (response.ok && payload.ok && payload.saved_asset?.poster_url) {
          finalPosterUrl = payload.saved_asset.poster_url;
        }
      } catch {
        // Fall back to the temporary URL if persistence is unavailable.
      }
    } else {
      void cleanupAiPosterUrls(
        aiProposals.map((proposal) => proposal.poster_url),
        selectedAiProposal.poster_url,
      );
    }

    updateDraft("posterArtDirection", selectedAiProposal.design_storytelling);
    updateDraft("posterReferenceUrls", [finalPosterUrl]);
    updateDraft("posterAssetMode", "banana-pro");
    setAppliedAiProposalId(selectedAiProposal.proposal_id);
  }

  function goToWizardStep(step: 0 | 1 | 2) {
    if (step > maxUnlockedWizardStep) {
      return;
    }

    setDesignWizardStep(step);
    if (step === 2) {
      setPreviewScreen("preview");
    }
  }

  function forceWizardStep(step: 0 | 1 | 2) {
    setDesignWizardStep(step);
    if (step === 2) {
      setPreviewScreen("preview");
    }
  }

  function goToNextWizardStep() {
    if (designWizardStep === 0 && !canAdvanceFromStep0) {
      return;
    }

    if (designWizardStep === 1 && !canAdvanceFromStep1) {
      return;
    }

    if (!isLastWizardStep) {
      const nextStep = (designWizardStep + 1) as 0 | 1 | 2;
      setMaxUnlockedWizardStep((current) => (current < nextStep ? nextStep : current));
      forceWizardStep(nextStep);
    }
  }

  function goToPreviousWizardStep() {
    if (!isFirstWizardStep) {
      goToWizardStep((designWizardStep - 1) as 0 | 1 | 2);
    }
  }

  const resolvedSlug = saveState.slug ?? draft.slug;
  const publicHref = resolvedSlug ? `/events/${resolvedSlug}` : "";
  const savedPosterUrl =
    saveState.savedEvent?.posterReferenceUrls?.[0] ??
    persistedBaselineDraft.posterReferenceUrls?.[0] ??
    "";
  const persistedPublishedState =
    saveState.savedEvent?.isPublished ?? persistedBaselineDraft.isPublished ?? draft.isPublished;
  const hasPublishedPreview =
    Boolean(savedPosterUrl) ||
    Boolean(saveState.savedEvent && getPrimaryPosterUrl(saveState.savedEvent)) ||
    Boolean(persistedBaselineDraft && getPrimaryPosterUrl(persistedBaselineDraft)) ||
    Boolean(activePreviewPosterUrl);
  const localPosterReadyForPublish =
    localPosterGeneration.status === "success" &&
    Boolean(localPosterGeneration.imageUrl) &&
    loadedPosterUrl === localPosterGeneration.imageUrl;
  const canViewPublishedSite = Boolean(publicHref && persistedPublishedState && hasPublishedPreview);
  const viewPublishedSiteHint = !persistedPublishedState
    ? "Publica el evento para habilitar el sitio."
    : designWizardStep === 2 && designSourceMode === "local" && localPosterGeneration.status === "loading"
      ? "Primero espera a que el poster termine de generarse."
      : designWizardStep === 2 && designSourceMode === "local" && localPosterReadyForPublish && hasUnsavedChanges
        ? "Guarda el borrador para que el sitio publicado use este poster."
        : !hasPublishedPreview
          ? "Genera y guarda un poster antes de abrir el sitio publicado."
          : hasUnsavedChanges
            ? "Abrirá la última versión guardada. Guarda para reflejar estos cambios."
            : "";

  function renderPosterFieldSelector(options?: { title?: string; description?: string; summary?: string }) {
    return (
      <div className={styles.generatedBody}>
        {options?.title || options?.description ? (
          <div className={styles.sectionHeading}>
            {options?.title ? <strong>{options.title}</strong> : null}
            {options?.description ? <small>{options.description}</small> : null}
          </div>
        ) : null}
        <div className={styles.wizardOverview}>
          <article>
            <span>Activos</span>
            <strong>{visibleFieldCount} bloques</strong>
          </article>
          <article>
            <span>Ocultos</span>
            <strong>{hiddenFieldCount} bloques</strong>
          </article>
          <article>
            <span>Qué hará después</span>
            <strong>{options?.summary ?? "Con estos bloques se armarán los overlays y la jerarquía tipográfica"}</strong>
          </article>
        </div>
        <div className={styles.selectionHint}>
          <strong>Bloques del poster</strong>
          <p>Deja encendido solo lo que sí tiene que vivir sobre la pieza. Si el arte ya incluye algún dato, puedes apagarlo aquí para evitar duplicidad.</p>
        </div>
        <div className={styles.fieldToggleGrid}>
          {posterFieldOptions.map((field) => {
            const active = visiblePosterFields.includes(field.id);
            return (
              <button
                key={field.id}
                type="button"
                className={active ? styles.fieldToggleActive : styles.fieldToggle}
                onClick={() => togglePosterField(field.id)}
                aria-pressed={active}
                data-testid={`poster-field-toggle-${field.id}`}
              >
                <span className={styles.toggleState}>{active ? "ON" : "OFF"}</span>
                <strong>{field.label}</strong>
                <small>{field.hint}</small>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPosterViewportComposite(
    viewport: PosterViewport,
    posterUrl: string,
    options?: {
      editorMode?: boolean;
      selectedRole?: PosterBlockRole;
      selectedLayer?: PosterEditorSelectionLayer;
    },
  ) {
    const posterModel = resolvePosterCompositeRenderModel(previewDraft, {
      posterUrl,
      overlayMode: effectivePosterTextOverlayMode,
      artworkFit: previewPosterArtworkFit,
      preferLiveEditorState: true,
    });

    return (
      <GeneratedPosterComposite
        event={posterModel.event}
        posterUrl={posterModel.posterUrl}
        relatedEvents={previewRelatedEvents}
        mode="preview"
        viewport={viewport}
        overlayMode={posterModel.overlayMode}
        artworkFit={posterModel.artworkFit}
        themeVars={previewPosterThemeVars}
        editorMode={options?.editorMode}
        selectedEditorRole={options?.selectedRole}
        selectedEditorLayer={options?.selectedLayer}
        onEditorRoleSelect={
          options?.editorMode
            ? (role, layer) => {
                setOverlayEditorRole(role);
                setOverlayEditorLayer(layer);
              }
            : undefined
        }
        onEditorRolePointerDown={options?.editorMode ? handleOverlayGuidePointerDown : undefined}
        onEditorRoleResizePointerDown={options?.editorMode ? handleOverlayResizePointerDown : undefined}
        onEditorRoleRotatePointerDown={options?.editorMode ? handleOverlayRotatePointerDown : undefined}
      />
    );
  }

  function renderOverlayEditorCallout(options?: { eyebrow?: string; title?: string; detail?: string }) {
    const overlayModeMeta =
      uploadOverlayOptions.find((option) => option.id === effectivePosterTextOverlayMode) ?? uploadOverlayOptions[1];

    return (
      <section className={styles.overlayEditorCallout}>
        <div className={styles.overlayEditorCalloutHeader}>
          <div>
            <span>{options?.eyebrow ?? "Editor visual"}</span>
            <strong>{options?.title ?? "Acomoda el overlay como director de arte"}</strong>
            <p>
              {options?.detail ??
                "Mueve el headline, lineup, horarios y tarjetas por viewport. Cada vista conserva su propio acomodo en desktop, tablet y mobile."}
            </p>
          </div>
          <div className={styles.overlayEditorCalloutActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => {
                setPreviewScreen("preview");
                setOverlayEditorOpen(true);
              }}
              data-testid="open-overlay-editor-button"
            >
              Abrir editor visual
            </button>
            <button
              type="button"
              className={styles.previewLink}
              onClick={() => updatePosterOverlayLayout(defaultPosterOverlayLayout)}
            >
              Restablecer acomodo de esta vista
            </button>
          </div>
        </div>
        <div className={styles.overlayEditorSummaryGrid}>
          <article data-insight="format">
            <span>Formato</span>
            <strong>{overlayModeMeta.title}</strong>
            <small>{overlayModeMeta.detail}</small>
          </article>
          <article data-insight="type">
            <span>Tipografía</span>
            <strong>{Math.round(currentPosterOverlayLayout.fontScale * 100)}%</strong>
            <small>{posterOverlayTypographyOptions.find((item) => item.id === currentPosterOverlayLayout.typographyStyle)?.label}</small>
          </article>
          <article data-insight="cards">
            <span>Tarjetas</span>
            <strong>{Math.round(currentPosterOverlayLayout.cardScale * 100)}%</strong>
            <small>{posterOverlayCardStyleOptions.find((item) => item.id === currentPosterOverlayLayout.cardStyle)?.label}</small>
          </article>
          <article data-insight="elements">
            <span>Elementos</span>
            <strong>{Math.round(currentPosterOverlayLayout.elementScale * 100)}%</strong>
            <small>{currentPosterOverlayLayout.textAlign === "center" ? "Alineación centrada" : "Alineación izquierda"}</small>
          </article>
        </div>
      </section>
    );
  }
  const essentialsSectionClassName = `${styles.formSection} ${
    essentialsComplete ? styles.sectionStatusReady : styles.sectionStatusAlert
  }`;
  const storySectionClassName = `${styles.formSection} ${
    storyHasContent ? styles.sectionStatusStoryReady : styles.sectionStatusAccent
  }`;
  const visualSectionClassName = `${styles.formSection} ${styles.designSection} ${
    designSourceMode === "ai" ? styles.designSectionAiMode : styles.designSectionLocalMode
  } ${styles.sectionStatusAccent}`;
  const operationsSectionClassName = `${styles.formSection} ${styles.sectionStatusNeutral}`;
  const ticketingSectionClassName = `${styles.formSection} ${styles.revenueSection} ${
    openSections.ticketing ? styles.sectionStatusEditing : styles.sectionStatusNeutral
  }`;
  const assetsSectionClassName = `${styles.formSection} ${styles.sectionStatusNeutral}`;
  const consoleBackgroundWallpaper =
    applyEventPosterWallpaper && persistedEventPosterWallpaper
      ? persistedEventPosterWallpaper
      : applyConsoleWallpaper && siteWallpaper
        ? siteWallpaper
        : "";
  const consoleBackgroundSource =
    applyEventPosterWallpaper && persistedEventPosterWallpaper
      ? "event-poster"
      : applyConsoleWallpaper && siteWallpaper
        ? "site-wallpaper"
        : "none";

  return (
    <main
      className={styles.page}
      data-console-wallpaper={consoleBackgroundWallpaper ? "true" : "false"}
      data-console-wallpaper-source={consoleBackgroundSource}
      style={
        consoleBackgroundWallpaper
          ? ({ "--venue-console-wallpaper": `url(${consoleBackgroundWallpaper})` } as CSSProperties)
          : undefined
      }
    >
      <section className={styles.shell}>
        <header className={styles.hero}>
          {siteWallpaper ? (
            <div className={styles.heroWallpaper} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={siteWallpaper} alt="" />
            </div>
          ) : null}
          <div className={styles.heroCopy}>
            <div className={styles.heroTopline}>
              <p className={styles.heroEyebrow}>Venue Console</p>
              <div className={styles.heroControls}>
                <Link href="/" className={styles.heroControlButton}>
                  ← Volver al inicio
                </Link>
                <button
                  type="button"
                  className={consoleSoundsEnabled ? styles.heroControlButtonActive : styles.heroControlButton}
                  onClick={() => setConsoleSoundsEnabled(!consoleSoundsEnabled)}
                  aria-pressed={consoleSoundsEnabled}
                >
                  {consoleSoundsEnabled ? "Sonidos activados" : "Sonidos desactivados"}
                </button>
              </div>
            </div>
            <h1 className={styles.heroTitle}>
              Crea el evento y deja que el <span className={styles.heroNoBreak}>poster designer</span> entregue la
              página lista al renderer.
            </h1>
            <p className={styles.heroDescription}>
              Aquí el venue define contenido y operación. El sistema termina la dirección visual, la persiste como
              handoff y el sitio la traduce programáticamente cada vez que guardas un evento.
            </p>
          </div>
          <div className={styles.heroStats}>
            <article className={styles.heroStatCard}>
              <span className={styles.heroStatLabel}>Eventos guardados</span>
              <strong className={styles.heroStatValue}>{safeEvents.length}</strong>
            </article>
            <article className={styles.heroStatCard}>
              <span className={styles.heroStatLabel}>Designer states</span>
              <div className={styles.heroStatPill}>Auto</div>
            </article>
            <article className={styles.heroStatCard}>
              <span className={styles.heroStatLabel}>Payout fee</span>
              <strong className={styles.heroStatValue}>1.5%</strong>
            </article>
          </div>
        </header>

        <section
          className={styles.workspaceLayout}
          data-event-status={draft.isPublished ? "published" : "draft"}
        >
          <aside className={styles.libraryPanel}>
            <div className={styles.panelHeader}>
              <p>Biblioteca</p>
              <h2>Eventos del venue</h2>
            </div>
            <button
              type="button"
              className={styles.createButton}
              onClick={openQuickStartForNewEvent}
              data-testid="create-new-event-button"
            >
              Crear nuevo evento
            </button>
            <div className={styles.eventList} data-testid="venue-event-list">
              {safeEvents.map((event) => {
                const posterThumbnailUrl = getEventPosterThumbnailUrl(event);
                const posterPreviewModel = posterThumbnailUrl
                  ? resolvePosterCompositeRenderModel(event, { posterUrl: posterThumbnailUrl })
                  : null;

                return (
                  <button
                    key={event.id}
                    type="button"
                    className={selectedId === event.id ? styles.eventCardActive : styles.eventCard}
                    onClick={() => selectEvent(event.id)}
                    data-testid={`venue-event-card-${event.id}`}
                  >
                    <div className={styles.eventCardContent}>
                      <div className={styles.eventCardMeta}>
                        <small className={styles.styleBadge}>{getEventInviteStyle(event.designVariant).shortLabel}</small>
                        <strong>{event.title}</strong>
                        <span>{new Date(event.startsAt).toLocaleString("es-MX", { dateStyle: "medium" })}</span>
                        <small>{event.isPublished ? "Publicado" : "Draft"}</small>
                      </div>
                      <div className={styles.eventPosterThumb} aria-hidden="true">
                        <div className={styles.eventPosterThumbFrame} data-testid="venue-event-card-poster-frame">
                          {posterPreviewModel ? (
                            <div className={styles.eventPosterThumbPreview} data-testid="venue-event-card-poster-preview">
                              <GeneratedPosterComposite
                                event={posterPreviewModel.event}
                                posterUrl={posterPreviewModel.posterUrl}
                                mode="preview"
                                viewport="mobile"
                                overlayMode={posterPreviewModel.overlayMode}
                                artworkFit={posterPreviewModel.artworkFit}
                              />
                            </div>
                          ) : (
                            <div className={styles.eventPosterThumbFallback}>
                              <span>Sin poster</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className={styles.editorColumn}>
            <form
              action={saveAction}
              className={styles.panel}
              data-event-status={draft.isPublished ? "published" : "draft"}
            >
              <div className={styles.panelHeader}>
                <p>Editor</p>
                <h2>{draft.id ? "Editar evento existente" : "Crear primer evento"}</h2>
              </div>
              <div className={styles.consoleSectionTabs} role="tablist" aria-label="Secciones del venue console">
                {venueConsoleTabs.map((tab) => {
                  const active = tab.id === activeConsoleTab;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={active ? styles.consoleSectionTabActive : styles.consoleSectionTab}
                      data-section={tab.id}
                      onClick={() => setActiveConsoleTab(tab.id)}
                    >
                      <strong>{tab.label}</strong>
                      <span>{tab.detail}</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.consoleSectionIntro}>
                <div>
                  <span>{draft.id ? "Evento seleccionado" : "Evento nuevo"}</span>
                  <strong>{draft.title || "Completa los datos del evento"}</strong>
                </div>
                <p>{activeConsoleTabMeta.detail}</p>
              </div>

              <input type="hidden" name="id" value={draft.id} />
              <input type="hidden" name="slug" value={draft.slug} />
              <input type="hidden" name="title" value={draft.title} />
              <input type="hidden" name="summary" value={draft.summary} />
              <input type="hidden" name="description" value={draft.description} />
              <input type="hidden" name="startsAt" value={draft.startsAt} />
              <input type="hidden" name="endsAt" value={draft.endsAt} />
              <input type="hidden" name="doorTime" value={draft.doorTime} />
              <input type="hidden" name="soundcheckTime" value={draft.soundcheckTime} />
              <input type="hidden" name="timezone" value={draft.timezone} />
              <input type="hidden" name="venueName" value={draft.venueName} />
              <input type="hidden" name="venueAddress" value={draft.venueAddress} />
              <input type="hidden" name="heroImage" value={draft.heroImage} />
              <input type="hidden" name="lineup" value={lineupText} data-testid="hidden-lineup-input" />
              <input type="hidden" name="genre" value={genreText} />
              <input type="hidden" name="designVariant" value={draft.designVariant ?? ""} />
              <input type="hidden" name="ticketTemplateId" value={draft.ticketTemplateId ?? ""} />
              <input type="hidden" name="designMotifs" value={(draft.designMotifs ?? []).join(",")} />
              <input type="hidden" name="posterVisibleFields" value={visiblePosterFields.join(",")} />
              <input type="hidden" name="posterArtDirection" value={effectivePosterArtDirection} />
              <input type="hidden" name="posterReferenceUrls" value={effectivePosterReferenceUrls.join("\n")} />
              <input type="hidden" name="posterAssetMode" value={effectivePosterAssetMode} />
              <input type="hidden" name="posterOriginMode" value={effectivePosterOriginMode} />
              <input type="hidden" name="posterTextOverlayMode" value={effectivePosterTextOverlayMode} />
              <textarea hidden readOnly name="posterOverlayLayout" value={JSON.stringify(posterOverlayLayoutsByViewport)} />
              <textarea hidden readOnly name="posterAssetsPayload" value={JSON.stringify(draft.posterAssets ?? [])} />
              <input type="hidden" name="activePosterAssetId" value={draft.activePosterAssetId ?? ""} />
              <input
                id="venue-poster-upload-input"
                className={styles.visuallyHiddenFileInput}
                type="file"
                name="posterUploadFile"
                accept="image/*"
                onChange={handleUploadedPosterFileChange}
                data-testid="poster-upload-input"
              />
              <textarea hidden readOnly name="operationalMoments" value={JSON.stringify(draft.operationalMoments ?? [])} />
              <input type="hidden" name="ticketPriceMXN" value={String(draft.ticketPriceMXN)} />
              <input type="hidden" name="ticketFeeMXN" value={String(draft.ticketFeeMXN)} />
              <input type="hidden" name="artistPayoutRate" value={String(draft.artistPayoutRate)} />
              <input type="hidden" name="capacity" value={String(draft.capacity)} />
              <input type="hidden" name="soldCount" value={String(draft.soldCount)} />
              <input type="hidden" name="operationMode" value={draft.operationMode ?? "auto"} />
              <input type="hidden" name="isPublished" value={draft.isPublished ? "on" : ""} />

              {false ? (
              <div className={styles.productWizard}>
                <div className={styles.productWizardRail}>
                  {productFlowSteps.map((step) => {
                    const isCurrent = step.status === "current";
                    const isComplete = step.status === "complete";

                    return (
                      <button
                        key={step.id}
                        type="button"
                        className={isCurrent ? styles.productWizardStepActive : isComplete ? styles.productWizardStepComplete : styles.productWizardStep}
                        data-tone={productWizardSteps.find((item) => item.id === step.id)?.tone}
                        onClick={() => goToProductStep(step.id as ProductWizardStep)}
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={step.ariaLabel}
                      >
                        <span>{step.eyebrow}</span>
                        <strong><i className={styles.productWizardStepIcon} aria-hidden="true">{productWizardSteps.find((item) => item.id === step.id)?.icon}</i>{`${step.id + 1}. ${step.title}`}</strong>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.productWizardCanvas} data-tone={currentProductStepMeta.tone}>
                  <div className={styles.productWizardHeader}>
                    <div>
                      <span>{currentProductStepMeta.eyebrow}</span>
                      <h3>{currentProductStepMeta.title}</h3>
                      <p>{currentProductStepMeta.description}</p>
                    </div>
                    <div className={styles.productWizardMeta}>
                      <article>
                        <span>Evento</span>
                        <strong>{draft.title || "Nuevo evento"}</strong>
                      </article>
                      <article>
                        <span>Estado</span>
                        <strong>{draft.isPublished ? "Publicado" : "Draft"}</strong>
                      </article>
                    </div>
                  </div>

                  {activeProductStep === 0 ? (
                    <div className={styles.productStepBody}>
                      <div className={styles.productStepLead}>
                        <strong><i className={styles.productStepLeadIcon} aria-hidden="true">✦</i>La historia primero.</strong>
                        <p>Este paso alimenta el copy principal que el sistema y el poster designer usarán para construir la página, el arte y la venta.</p>
                      </div>
                      <div className={styles.formGrid}>
                        <label className={`${styles.span7} ${styles.fieldCard} ${styles.fieldCardHero}`}>
                          <span className={styles.fieldLabel}>
                            <strong>Título</strong>
                            <small>El nombre que debe adueñarse del evento.</small>
                          </span>
                          <input
                            value={draft.title}
                            placeholder="Ej: Neo Jazz Azotea Session"
                            onChange={(event) => updateDraft("title", event.target.value)}
                          />
                        </label>
                        <label className={`${styles.span5} ${styles.fieldCard} ${styles.fieldCardCast}`}>
                          <span className={styles.fieldLabel}>
                            <strong>Lineup</strong>
                            <small>Artistas separados por comas. Mantén la lista limpia y legible.</small>
                          </span>
                          <input
                            value={lineupText}
                            placeholder="Ej: Marea Azul Quartet, Lucía Vega"
                            onChange={(event) => setLineupText(event.target.value)}
                            onBlur={(event) => commitLineupText(event.target.value)}
                          />
                        </label>
                        <label className={`${styles.span4} ${styles.fieldCard}`}>
                          <span className={styles.fieldLabelRow}>
                            <span className={styles.fieldLabel}>
                              <strong>Resumen corto</strong>
                              <small>Una línea que capture el tono general y el gancho comercial.</small>
                            </span>
                            <button
                              type="button"
                              className={styles.assistButton}
                              onClick={() => void suggestFieldCopy("summary")}
                              disabled={copyAssistLoadingField === "summary"}
                            >
                              {copyAssistLoadingField === "summary" ? <span className={styles.assistSpinner} aria-hidden="true" /> : "✦"}
                              <span>Sugerir</span>
                            </button>
                          </span>
                          <input
                            value={draft.summary}
                            placeholder="Ej: Jazz de azotea, bruma cálida y armonía moderna."
                            onChange={(event) => updateDraft("summary", event.target.value)}
                          />
                        </label>
                        <label className={`${styles.span8} ${styles.fieldCard} ${styles.fieldCardEditorial}`}>
                          <span className={styles.fieldLabelRow}>
                            <span className={styles.fieldLabel}>
                              <strong>Historia / Narrativa</strong>
                              <small>Describe la energía, el ambiente y lo que hace memorable a esta fecha.</small>
                            </span>
                            <button
                              type="button"
                              className={styles.assistButton}
                              onClick={() => void suggestFieldCopy("description")}
                              disabled={copyAssistLoadingField === "description"}
                            >
                              {copyAssistLoadingField === "description" ? <span className={styles.assistSpinner} aria-hidden="true" /> : "✦"}
                              <span>Sugerir</span>
                            </button>
                          </span>
                          <textarea
                            rows={7}
                            value={draft.description}
                            placeholder="Ej: Una noche de jazz elegante en rooftop, humo tenue, luz cálida y pulsos analógicos..."
                            onChange={(event) => updateDraft("description", event.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {activeProductStep === 1 ? (
                    <div className={styles.productStepBody}>
                      <div className={styles.productStepLead}>
                        <strong><i className={styles.productStepLeadIcon} aria-hidden="true">◌</i>Tiempo, lugar y lenguaje visual.</strong>
                        <p>Con estas coordenadas el comprador entiende la fecha y el estudio de arte entiende el tono.</p>
                      </div>
                      <div className={styles.formGrid}>
                        <label className={`${styles.span4} ${styles.fieldCard} ${styles.fieldCardMeta}`}>
                          <span className={styles.fieldLabel}>
                            <strong>Fecha y hora</strong>
                            <small>Un picker unificado para fijar la sesión.</small>
                          </span>
                          <input
                            type="datetime-local"
                            value={toDateTimeLocalValue(draft.startsAt)}
                            onChange={(event) => {
                              const nextStart = new Date(event.target.value).toISOString();
                              const nextTiming = buildEventTimingFromStart(nextStart);
                              setDraft((current) => ({
                                ...current,
                                startsAt: nextTiming.startsAt,
                                endsAt: nextTiming.endsAt,
                                doorTime: nextTiming.doorTime,
                                soundcheckTime: nextTiming.soundcheckTime,
                              }));
                            }}
                          />
                        </label>
                        <label className={`${styles.span4} ${styles.fieldCard} ${styles.fieldCardVenue}`}>
                          <span className={styles.fieldLabel}>
                            <strong>Venue</strong>
                            <small>Nombre principal del lugar.</small>
                          </span>
                          <input value={draft.venueName} onChange={(event) => updateDraft("venueName", event.target.value)} />
                        </label>
                        <label className={`${styles.span4} ${styles.fieldCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong>Dirección</strong>
                            <small>La ubicación exacta que verá el comprador.</small>
                          </span>
                          <input value={draft.venueAddress} onChange={(event) => updateDraft("venueAddress", event.target.value)} />
                        </label>
                        <label className={`${styles.span5} ${styles.fieldCard} ${styles.fieldCardMood}`}>
                          <span className={styles.fieldLabelRow}>
                            <span className={styles.fieldLabel}>
                              <strong>Moodboard / estilo</strong>
                              <small>Géneros, texturas o referencias que deben orientar el arte.</small>
                            </span>
                            <button
                              type="button"
                              className={styles.assistButton}
                              onClick={() => void suggestFieldCopy("genre")}
                              disabled={copyAssistLoadingField === "genre"}
                            >
                              {copyAssistLoadingField === "genre" ? <span className={styles.assistSpinner} aria-hidden="true" /> : "✦"}
                              <span>Sugerir</span>
                            </button>
                          </span>
                          <input
                            value={genreText}
                            placeholder="Ej: Jazz, neo soul, listening room, rooftop"
                            onChange={(event) => setGenreText(event.target.value)}
                            onBlur={(event) => commitGenreText(event.target.value)}
                          />
                        </label>
                        <div className={`${styles.fieldCard} ${styles.span7}`}>
                          <span className={styles.fieldLabel}>
                            <strong>Direcciones visuales</strong>
                            <small>Esto fija la familia visual que usará el studio para nuevas variantes.</small>
                          </span>
                          <div className={styles.optionGrid}>
                            {posterIdeaPresets.map((preset) => {
                              const active = preset.id === selectedIdeaPreset;

                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  className={active ? styles.optionCardActive : styles.optionCard}
                                  onClick={() => applyIdeaPreset(preset.id)}
                                >
                                  <strong>{preset.title}</strong>
                                  <span>{templateLabelMap[preset.localTemplate]}</span>
                                  <small>{preset.prompt}</small>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <label className={`${styles.span12} ${styles.fieldCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong>Nota de dirección visual</strong>
                            <small>Una frase más libre para el diseñador o el motor de generación.</small>
                          </span>
                          <textarea
                            rows={4}
                            value={aiDirectionNote}
                            placeholder="Ej: Que se sienta como una noche de jazz elegante en rooftop, humo tenue y luz cálida."
                            onChange={(event) => {
                              setAiDirectionNote(event.target.value);
                              updateDraft("posterArtDirection", event.target.value);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {activeProductStep === 3 ? (
                    <div className={styles.productStepBody}>
                      <div className={styles.productStepLead}>
                        <strong><i className={styles.productStepLeadIcon} aria-hidden="true">$</i>Stripe mode.</strong>
                        <p>Concentra precios, payout, aforo y control operativo en un layout de lectura rápida, sin filas interminables.</p>
                      </div>
                      <div className={styles.economyGrid}>
                        <div className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">◫</i>Template de ticket</strong>
                            <small>Define cómo se verá el acceso dentro del ecosistema del evento.</small>
                          </span>
                          <div className={styles.optionGrid}>
                            {ticketTemplateIds.map((templateId) => {
                              const template = ticketTemplateMeta[templateId];
                              const active = (draft.ticketTemplateId ?? "festival-pass") === templateId;

                              return (
                                <button
                                  key={templateId}
                                  type="button"
                                  className={active ? styles.optionCardActive : styles.optionCard}
                                  onClick={() => updateDraft("ticketTemplateId", templateId)}
                                >
                                  <strong>{template.title}</strong>
                                  <span>{template.detail}</span>
                                  <small>{template.description}</small>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <label className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">$</i>Precio base</strong>
                            <small>Valor visible para el comprador.</small>
                          </span>
                          <input type="number" value={draft.ticketPriceMXN} onChange={(event) => updateDraft("ticketPriceMXN", Number(event.target.value))} />
                        </label>
                        <label className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">%</i>Fee consumidor</strong>
                            <small>Cargo fijo adicional.</small>
                          </span>
                          <input type="number" value={draft.ticketFeeMXN} onChange={(event) => updateDraft("ticketFeeMXN", Number(event.target.value))} />
                        </label>
                        <label className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">↗</i>Payout artista</strong>
                            <small>Porcentaje destinado al artista.</small>
                          </span>
                          <input type="number" min={0} max={1} step={0.01} value={draft.artistPayoutRate} onChange={(event) => updateDraft("artistPayoutRate", Number(event.target.value))} />
                        </label>
                        <article className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">◎</i>Payout fee</strong>
                            <small>Cargo automático de la plataforma.</small>
                          </span>
                          <div className={styles.metricPill}>1.5%</div>
                        </article>
                        <label className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">◌</i>Capacidad</strong>
                            <small>Límite total de boletos.</small>
                          </span>
                          <input type="number" value={draft.capacity} onChange={(event) => updateDraft("capacity", Number(event.target.value))} />
                        </label>
                        <label className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">✓</i>Vendidos</strong>
                            <small>Avance comercial actual.</small>
                          </span>
                          <input type="number" value={draft.soldCount} onChange={(event) => updateDraft("soldCount", Number(event.target.value))} />
                        </label>
                        <div className={`${styles.fieldCard} ${styles.economyCard}`}>
                          <span className={styles.fieldLabel}>
                            <strong><i className={styles.fieldIcon} aria-hidden="true">◇</i>Estado de operación</strong>
                            <small>Controla si la consola asiste o deja decisiones manuales.</small>
                          </span>
                          <div className={styles.modeToggleRow}>
                            <button
                              type="button"
                              className={(draft.operationMode ?? "auto") === "auto" ? styles.modeToggleActive : styles.modeToggle}
                              onClick={() => updateDraft("operationMode", "auto")}
                            >
                              Auto
                            </button>
                            <button
                              type="button"
                              className={(draft.operationMode ?? "auto") === "manual" ? styles.modeToggleActive : styles.modeToggle}
                              onClick={() => updateDraft("operationMode", "manual")}
                            >
                              Manual
                            </button>
                          </div>
                        </div>
                        <label className={`${styles.fieldCard} ${styles.economyCard} ${styles.publishCard}`}>
                          <span className={styles.publishToggle}>
                            <input
                              type="checkbox"
                              checked={draft.isPublished}
                              onChange={(event) => updateDraft("isPublished", event.target.checked)}
                            />
                            <span className={styles.publishToggleIcon} aria-hidden="true">◎</span>
                            <span className={styles.publishToggleCopy}>
                              <strong><i className={styles.fieldIcon} aria-hidden="true">◎</i>Hacer evento público</strong>
                              <small>Muéstralo en la cartelera pública, listados de eventos y página pública para vender boletos.</small>
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {activeProductStep === 2 ? (
                    <div className={styles.productStepBody}>
                      <div className={styles.productStepLead}>
                        <strong><i className={styles.productStepLeadIcon} aria-hidden="true">▣</i>Poster Studio Dashboard.</strong>
                        <p>Administra variantes, navega revisiones guardadas y decide cuál queda como poster principal del evento.</p>
                      </div>

                      <div className={styles.posterLibrarySection}>
                        <div className={styles.posterLibraryHeader}>
                          <div>
                            <span>Galería de arte</span>
                            <strong>Posters guardados para este evento</strong>
                            <p>La tarjeta activa puede actualizarse como poster principal al guardar el evento.</p>
                          </div>
                          <small>{posterLibrary.length} {posterLibrary.length === 1 ? "poster" : "posters"}</small>
                        </div>
                        {posterLibrary.length > 0 ? (
                          <div
                            className={styles.posterGalleryGrid}
                            data-poster-count={posterLibrary.length === 1 ? "single" : posterLibrary.length === 2 ? "pair" : "multi"}
                          >
                            {posterLibrary.map((asset) => {
                              const isActive = asset.id === draft.activePosterAssetId;

                              return (
                                <article key={asset.id} className={isActive ? styles.posterGalleryCardActive : styles.posterGalleryCard}>
                                  <div className={styles.posterGalleryThumb}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={asset.url} alt={asset.label} />
                                  </div>
                                  <div className={styles.posterGalleryBody}>
                                    <div className={styles.posterGalleryMeta}>
                                      <span>{getPosterAssetStatusLabel(asset)}</span>
                                      <strong>Rev. {asset.revision}</strong>
                                    </div>
                                    <h4>{asset.label}</h4>
                                    <p>{asset.snapshot?.posterArtDirection ?? asset.artDirection ?? "Sin nota editorial adicional."}</p>
                                    <div className={styles.posterGalleryActions}>
                                      <button type="button" className={styles.previewLink} onClick={() => loadPosterRevision(asset)}>
                                        Editar en Designer
                                      </button>
                                      <button type="button" className={styles.previewLink} onClick={() => duplicatePosterRevision(asset)}>
                                        Duplicar variante
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.posterRevisionDelete}
                                        onClick={() => requestPosterRevisionDelete(asset)}
                                        disabled={asset.status === "published"}
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.posterLibraryEmpty}>
                            <strong>Aún no hay posters persistidos.</strong>
                            <p>Genera o sube una variante para empezar a poblar la galería de arte del evento.</p>
                          </div>
                        )}
                      </div>

                      <div className={styles.posterStudioLayout}>
                        <div className={styles.posterStudioColumn}>
                          <div className={styles.posterStudioToolbar}>
                            <div className={styles.sourceModeSwitch} role="tablist" aria-label="Tipo de flujo para el poster">
                              <button type="button" role="tab" aria-selected={designSourceMode === "local"} className={designSourceMode === "local" ? styles.sourceModeActive : styles.sourceModeButton} onClick={() => switchDesignSourceMode("local")}>
                                <span>◇ Local</span>
                                <strong>Generar</strong>
                                <small>Motor interno</small>
                              </button>
                              <button type="button" role="tab" aria-selected={designSourceMode === "ai"} className={designSourceMode === "ai" ? styles.sourceModeActive : styles.sourceModeButton} onClick={() => switchDesignSourceMode("ai")}>
                                <span>✦ IA externa</span>
                                <strong>Proponer</strong>
                                <small>Brief editorial</small>
                              </button>
                              <button type="button" role="tab" aria-selected={designSourceMode === "upload"} className={designSourceMode === "upload" ? styles.sourceModeActive : styles.sourceModeButton} onClick={() => switchDesignSourceMode("upload")}>
                                <span>▣ Upload</span>
                                <strong>Subir</strong>
                                <small>Arte final</small>
                              </button>
                            </div>

                            {designSourceMode === "local" ? (
                              <>
                                <div className={styles.optionGrid}>
                                  {providerOptions.map((option) => {
                                    const active = localPosterProvider === option.id;
                                    const connected =
                                      option.id === "pollinations" || option.id === "pollinations-alt"
                                        ? true
                                        : Boolean(providerKeys[option.id]);

                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        className={active ? styles.optionCardActive : styles.optionCard}
                                        onClick={() => selectGenerationProvider(option.id)}
                                      >
                                        <strong>{option.title}</strong>
                                        <span>{option.subtitle}</span>
                                        <small>{connected ? option.detail : "Falta API key para usar este motor."}</small>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className={styles.studioActionRow}>
                                  <button
                                    type="button"
                                    className={styles.saveButton}
                                    onClick={() => void (localPosterGeneration.imageUrl ? regenerateLocalPoster() : triggerLocalPosterGeneration())}
                                    disabled={localPosterGeneration.status === "loading" || !localPosterProviderConnected}
                                  >
                                    {localPosterGeneration.status === "loading"
                                      ? "Generando..."
                                      : localPosterGeneration.imageUrl
                                        ? "Generar nueva variante"
                                        : "Generar primer poster"}
                                  </button>
                                  <button type="button" className={styles.previewLink} onClick={() => void downloadGeneratedPoster()} disabled={!localPosterGeneration.imageUrl}>
                                    Descargar poster
                                  </button>
                                </div>
                                {activeProviderSetup ? (
                                  <div className={`${styles.fieldCard} ${styles.fullWidth}`}>
                                    <span className={styles.fieldLabel}>
                                      <strong>Conectar {getProviderLabel(activeProviderSetup!)}</strong>
                                      <small>Guarda aquí tu API key para que este motor quede habilitado en la consola.</small>
                                    </span>
                                    <div className={styles.formGrid}>
                                      <label className={`${styles.fullWidth} ${styles.fieldCard}`}>
                                        <span className={styles.fieldLabel}>
                                          <strong>API key</strong>
                                          <small>Se guarda localmente en este navegador.</small>
                                        </span>
                                        <input
                                          value={providerKeyDrafts[activeProviderSetup!]}
                                          onChange={(event) =>
                                            setProviderKeyDrafts((current) => ({
                                              ...current,
                                              [activeProviderSetup!]: event.target.value,
                                            }))
                                          }
                                          placeholder="Pega aquí la API key"
                                        />
                                      </label>
                                    </div>
                                    <div className={styles.studioActionRow}>
                                      <button
                                        type="button"
                                        className={styles.saveButton}
                                        onClick={() => persistProviderKey(activeProviderSetup!)}
                                        disabled={!providerKeyDrafts[activeProviderSetup!].trim()}
                                      >
                                        Guardar key
                                      </button>
                                      <a href={providerOptions.find((item) => item.id === activeProviderSetup!)?.setupHref} target="_blank" rel="noreferrer" className={styles.previewLink}>
                                        Abrir setup
                                      </a>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : null}

                            {designSourceMode === "ai" ? (
                              <>
                                <label className={`${styles.fieldCard} ${styles.fullWidth}`}>
                                  <span className={styles.fieldLabel}>
                                    <strong>Brief editorial</strong>
                                    <small>La frase guía que viajará al diseñador externo para producir propuestas.</small>
                                  </span>
                                  <textarea
                                    rows={4}
                                    value={aiDirectionNote}
                                    onChange={(event) => {
                                      setAiDirectionNote(event.target.value);
                                      updateDraft("posterArtDirection", event.target.value);
                                    }}
                                  />
                                </label>
                                <div className={styles.studioActionRow}>
                                  <button type="button" className={styles.saveButton} onClick={generateAiPosterDirections} disabled={aiStatus.loading}>
                                    {aiStatus.loading ? "Generando propuestas..." : "Generar propuestas IA"}
                                  </button>
                                  {selectedAiProposal ? (
                                    <button type="button" className={styles.previewLink} onClick={applySelectedAiProposal}>
                                      Aplicar propuesta
                                    </button>
                                  ) : null}
                                </div>
                              </>
                            ) : null}

                            {designSourceMode === "upload" ? (
                              <label className={`${styles.fieldCard} ${styles.fullWidth}`} htmlFor="venue-poster-upload-input">
                                <span className={styles.fieldLabel}>
                                  <strong>Subir poster</strong>
                                  <small>Usa un poster final existente y decide cómo se monta el texto.</small>
                                </span>
                              </label>
                            ) : null}
                          </div>

                          {designSourceMode === "upload" ? (
                            <div className={styles.overlayOptionGrid}>
                              {uploadOverlayOptions.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={uploadTextOverlayMode === option.id ? styles.optionCardActive : styles.optionCard}
                                  onClick={() => {
                                    setUploadTextOverlayMode(option.id);
                                    updateDraft("posterTextOverlayMode", option.id);
                                  }}
                                  data-testid={`upload-overlay-option-${option.id}`}
                                >
                                  <strong>{option.title}</strong>
                                  <small>{option.detail}</small>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {designSourceMode === "ai" && aiProposals.length > 0 ? (
                            <div className={styles.posterGalleryGrid}>
                              {aiProposals.map((proposal, index) => (
                                <button
                                  key={proposal.proposal_id}
                                  type="button"
                                  className={selectedAiProposalId === proposal.proposal_id ? styles.aiPreviewOptionActive : styles.aiPreviewOption}
                                  onClick={() => setSelectedAiProposalId(proposal.proposal_id)}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={proposal.poster_url} alt={proposal.style_title} className={styles.aiPreviewOptionImage} />
                                  <span>Propuesta {index + 1}</span>
                                  <strong>{proposal.style_title}</strong>
                                  {typeof proposal.total_score === "number" ? <small>{proposal.total_score.toFixed(1)}/10</small> : null}
                                </button>
                              ))}
                            </div>
                          ) : null}

                        </div>

                        <div className={styles.posterStudioPreview}>
                          <div className={styles.previewToolbar}>
                            <div className={styles.previewSwitch}>
                              <button type="button" className={previewScreen === "preview" ? styles.previewTabActive : styles.previewTab} onClick={() => setPreviewScreen("preview")}>
                                Poster
                              </button>
                              <button type="button" className={previewScreen === "story" ? styles.previewTabActive : styles.previewTab} onClick={() => setPreviewScreen("story")}>
                                Story
                              </button>
                              <button type="button" className={previewScreen === "ticket" ? styles.previewTabActive : styles.previewTab} onClick={() => setPreviewScreen("ticket")}>
                                Ticket
                              </button>
                            </div>
                          </div>

                          <div className={styles.previewBody}>
                            {previewScreen === "preview" ? (
                              effectivePosterReferenceUrls[0] ? (
                                <div className={styles.viewportPreviewGrid} data-testid="poster-studio-preview-grid">
                                  {[
                                    { label: "Desktop", width: "1200px", height: "760px", scale: 0.24, mode: "landscape" },
                                    { label: "Tablet", width: "1024px", height: "768px", scale: 0.26, mode: "tablet" },
                                    { label: "Mobile", width: "390px", height: "844px", scale: 0.34, mode: "mobile" },
                                  ].map((viewport) => (
                                    <article
                                      key={viewport.label}
                                      className={styles.viewportCard}
                                      data-testid={`poster-studio-viewport-${viewport.mode === "mobile" ? "mobile" : viewport.mode === "tablet" ? "tablet" : "desktop"}`}
                                    >
                                      <div className={styles.viewportCardHeader}>
                                        <span>{viewport.label}</span>
                                        <strong>{viewport.width.replace("px", "")} × {viewport.height.replace("px", "")}</strong>
                                      </div>
                                      <div
                                        className={styles.generatedViewportStage}
                                        style={
                                          {
                                            "--preview-width": viewport.width,
                                            "--preview-height": viewport.height,
                                            "--preview-scale": String(viewport.scale),
                                          } as CSSProperties
                                        }
                                      >
                                        <div className={`${styles.generatedViewportFrame} ${styles[`generatedViewportFrame${viewport.mode === "mobile" ? "Mobile" : viewport.mode === "tablet" ? "Tablet" : "Desktop"}`]}`}>
                                          <div className={styles.generatedViewportCanvas}>
                                            {renderPosterViewportComposite(
                                              viewport.mode === "mobile" ? "mobile" : viewport.mode === "tablet" ? "tablet" : "desktop",
                                              effectivePosterReferenceUrls[0],
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <div className={styles.previewPlaceholder}>
                                  <strong>Selecciona o genera una variante.</strong>
                                  <p>Cuando haya un poster activo, aquí verás los tres viewports listos para revisión editorial.</p>
                                </div>
                              )
                            ) : null}

                            {previewScreen === "story" ? (
                              <div className={styles.generatedBody}>
                                <strong>{generatedDesign.narrative.kicker}</strong>
                                <p>{generatedDesign.narrative.manifesto}</p>
                                <div className={styles.generatedTags}>
                                  {generatedDesign.motifs.map((motifId) => {
                                    const motif = eventVisualMotifs.find((item) => item.id === motifId);
                                    return <span key={motifId}>{motif?.label ?? motifId}</span>;
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {previewScreen === "ticket" ? (
                              <div className={styles.ticketPreviewStage}>
                                <div className={styles.ticketPreviewHero}>
                                  <GeneratedTicketComposite
                                    event={previewTicketModel.event}
                                    ticketDesign={previewTicketModel.ticketDesign}
                                    artworkUrl={previewTicketModel.artworkUrl}
                                    viewport="desktop"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.productWizardFooter}>
                    <div className={styles.productWizardUtility}>
                      <strong>
                        {saveState.message ||
                          deleteState.message ||
                          (hasUnsavedChanges
                            ? "Hay cambios sin guardar en contenido, logística, economía o arte."
                            : "Todo está sincronizado con el último guardado.")}
                      </strong>
                      <div className={styles.editorActions}>
                        <button type="button" className={styles.previewLink} onClick={resetDraftToSavedState} disabled={!hasUnsavedChanges}>
                          Revertir
                        </button>
                        {draft.id ? (
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={requestDeleteEvent}
                            disabled={isDeleting || isSaving}
                          >
                            {isDeleting ? "Borrando..." : "Borrar evento"}
                          </button>
                        ) : null}
                        {publicHref ? (
                          canViewPublishedSite ? (
                            <Link href={publicHref} className={styles.previewLink} target="_blank" rel="noreferrer">
                              Ver sitio publicado
                            </Link>
                          ) : (
                            <button type="button" className={styles.previewLink} disabled title={viewPublishedSiteHint}>
                              Ver sitio publicado
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.wizardActions}>
                      <button type="button" className={styles.previewLink} onClick={goToPreviousProductStep} disabled={isProductFirstStep}>
                        Atrás
                      </button>
                      {isProductLastStep ? (
                        <button type="submit" className={styles.saveButton} disabled={isSaving || !canAdvanceGallery}>
                          {isSaving ? "Guardando..." : draft.isPublished ? "Publicar evento" : "Guardar evento"}
                        </button>
                      ) : (
                        <button type="button" className={styles.saveButton} onClick={goToNextProductStep} disabled={!canAdvanceProductStep}>
                          {currentProductStepMeta.cta}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              ) : null}

              {true ? (
              <div className={styles.legacyWorkspaceHidden}>
              <div className={styles.formSections}>
                {activeConsoleTab === "essentials" ? (
                <details className={essentialsSectionClassName} open>
                  <summary onClick={(event) => { event.preventDefault(); toggleSection("essentials"); }}>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">🎯</span>
                      <span>Lo esencial</span>
                    </span>
                  </summary>
                  <div className={styles.sectionHintRibbon}>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">✎</span>
                      <strong>Título</strong>
                    </article>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">◷</span>
                      <strong>Fecha</strong>
                    </article>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">♫</span>
                      <strong>Lineup</strong>
                    </article>
                  </div>
                  <div className={styles.formGrid}>
                    <label className={`${styles.fullWidth} ${styles.fieldCard} ${styles.fieldCardHero}`}>
                      <span className={styles.fieldLabel}>
                        <strong>Título</strong>
                        <small>Nombre principal que dominará la página y el poster.</small>
                      </span>
                      <input
                        name="title"
                        value={draft.title}
                        placeholder="Ej: Midnight Cumbia Systems"
                        onChange={(event) => updateDraft("title", event.target.value)}
                      />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMeta}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◷ Inicio</strong>
                        <small>La fecha que activa el resto del storytelling y la operación.</small>
                      </span>
                      <input
                        type="datetime-local"
                        name="startsAt"
                        value={toDateTimeLocalValue(draft.startsAt)}
                        onChange={(event) => {
                          const nextTiming = buildEventTimingFromStart(new Date(event.target.value).toISOString());
                          setDraft((current) => ({
                            ...current,
                            startsAt: nextTiming.startsAt,
                            endsAt: nextTiming.endsAt,
                            doorTime: nextTiming.doorTime,
                            soundcheckTime: nextTiming.soundcheckTime,
                          }));
                        }}
                      />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardVenue}`}>
                      <span className={styles.fieldLabel}>
                        <strong>⌂ Venue</strong>
                        <small>Nombre principal visible al público.</small>
                      </span>
                      <input
                        name="venueName"
                        value={draft.venueName}
                        placeholder="Ej: Foro GDL"
                        onChange={(event) => updateDraft("venueName", event.target.value)}
                      />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.fieldCard}`}>
                      <span className={styles.fieldLabel}>
                        <strong>⌖ Dirección</strong>
                        <small>Ubicación exacta para landing, mapa y overlays del poster.</small>
                      </span>
                      <input
                        name="venueAddress"
                        value={draft.venueAddress}
                        placeholder="Ej: Av. Chapultepec Sur 180, Americana, Guadalajara"
                        onChange={(event) => updateDraft("venueAddress", event.target.value)}
                      />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.fieldCard} ${styles.fieldCardCast}`}>
                      <span className={styles.fieldLabel}>
                        <strong>♫ Lineup</strong>
                        <small>Separado por comas. Alimenta poster, landing y brief del diseñador.</small>
                      </span>
                      <input
                        value={lineupText}
                        placeholder="Ej: La Sonora Pixel, DJ Nopal, invitado sorpresa"
                        onChange={(event) => setLineupText(event.target.value)}
                        onBlur={(event) => commitLineupText(event.target.value)}
                        data-testid="event-lineup-input"
                      />
                    </label>
                  </div>
                </details>
                ) : null}

                {activeConsoleTab === "story" ? (
                <details className={storySectionClassName} open>
                  <summary onClick={(event) => { event.preventDefault(); toggleSection("story"); }}>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">📣</span>
                      <span>La historia</span>
                    </span>
                  </summary>
                  <div className={`${styles.formGrid} ${styles.storyFlow}`}>
                    <label className={`${styles.fullWidth} ${styles.storyField}`}>
                      <span className={styles.fieldLabelRow}>
                        <span className={styles.fieldLabel}>
                          <strong>≈ Resumen corto</strong>
                          <small>Hook rápido para listings, previews y lectura inmediata.</small>
                        </span>
                        <button
                          type="button"
                          className={styles.assistButton}
                          onClick={() => void suggestFieldCopy("summary")}
                          disabled={copyAssistLoadingField === "summary"}
                        >
                          {copyAssistLoadingField === "summary" ? <span className={styles.assistSpinner} aria-hidden="true" /> : "✦"}
                          <span>Sugerir</span>
                        </button>
                      </span>
                      <input
                        name="summary"
                        value={draft.summary}
                        placeholder="Ej: Una noche de cumbia digital en la azotea del Foro"
                        onChange={(event) => updateDraft("summary", event.target.value)}
                      />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.storyField}`}>
                      <span className={styles.fieldLabelRow}>
                        <span className={styles.fieldLabel}>
                          <strong>¶ Descripción pública</strong>
                          <small>Contexto editorial para sitio, share cards y brief creativo.</small>
                        </span>
                        <button
                          type="button"
                          className={styles.assistButton}
                          onClick={() => void suggestFieldCopy("description")}
                          disabled={copyAssistLoadingField === "description"}
                        >
                          {copyAssistLoadingField === "description" ? <span className={styles.assistSpinner} aria-hidden="true" /> : "✦"}
                          <span>Sugerir</span>
                        </button>
                      </span>
                      <textarea
                        name="description"
                        rows={5}
                        value={draft.description}
                        placeholder="Ej: Un drop de boletos mobile-first con seleccionado en vivo..."
                        onChange={(event) => updateDraft("description", event.target.value)}
                      />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.storyField}`}>
                      <span className={styles.fieldLabelRow}>
                        <span className={styles.fieldLabel}>
                          <strong>♬ Géneros</strong>
                          <small>Tags que ayudan a inferir mood, paleta y dirección visual.</small>
                        </span>
                        <button
                          type="button"
                          className={styles.assistButton}
                          onClick={() => void suggestFieldCopy("genre")}
                          disabled={copyAssistLoadingField === "genre"}
                        >
                          {copyAssistLoadingField === "genre" ? <span className={styles.assistSpinner} aria-hidden="true" /> : "✦"}
                          <span>Sugerir</span>
                        </button>
                      </span>
                      <input
                        value={genreText}
                        placeholder="Ej: Cumbia digital, Tropical Jazz, Live Brass"
                        onChange={(event) => setGenreText(event.target.value)}
                        onBlur={(event) => commitGenreText(event.target.value)}
                      />
                    </label>
                  </div>
                </details>
                ) : null}

                {activeConsoleTab === "visual" ? (
                <details
                  ref={visualSectionRef}
                  className={visualSectionClassName}
                  data-visual-surface={activeVisualTab}
                  open
                >
                  <summary onClick={(event) => { event.preventDefault(); toggleSection("visual"); }}>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">✦</span>
                      <span>Dirección visual</span>
                    </span>
                  </summary>
                  <div className={styles.visualWorkbenchTabs} role="tablist" aria-label="Subflujos de dirección visual">
                    {visualWorkbenchTabs.map((tab) => {
                      const active = tab.id === activeVisualTab;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={active ? styles.visualWorkbenchTabActive : styles.visualWorkbenchTab}
                          data-visual-tab={tab.id}
                          onClick={() => {
                            setActiveVisualTab(tab.id);

                            if (tab.id === "upload") {
                              switchDesignSourceMode("upload");
                            } else if (tab.id === "local") {
                              switchDesignSourceMode("local");
                            }
                          }}
                        >
                          <strong>{tab.label}</strong>
                          <span>{tab.detail}</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeVisualTab !== "library" ? (
                  <>
                  <div className={styles.wizardHeader}>
                    {designFlowSteps.map((step) => {
                      const isCurrent = step.status === "current";
                      const isComplete = step.status === "complete";
                      const isError = step.status === "error";

                      return (
                        <button
                          key={step.id}
                          type="button"
                          className={isCurrent ? styles.wizardStepActive : isComplete ? styles.wizardStepComplete : styles.wizardStep}
                          data-step-state={step.status}
                          onClick={() => goToWizardStep(step.id as 0 | 1 | 2)}
                          disabled={step.isLocked}
                          aria-current={isCurrent ? "step" : undefined}
                          aria-label={step.ariaLabel}
                        >
                          <span>{step.eyebrow}</span>
                          <strong>{step.title}</strong>
                          <small
                            className={
                              isError
                                ? styles.wizardStateError
                                : isCurrent
                                  ? styles.wizardStateCurrent
                                  : isComplete
                                    ? styles.wizardStateComplete
                                    : styles.wizardStatePending
                            }
                          >
                            {isError ? "Corrige esto" : isCurrent ? "Estás aquí" : isComplete ? "Hecho" : "Pendiente"}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.wizardStepTitle}>
                    <span>{stepMeta.eyebrow}</span>
                    <strong>{stepMeta.title}</strong>
                    <small>
                      {designWizardStep + 1} de {activeWizardSteps.length}
                      {designSourceMode === "upload"
                        ? designWizardStep === 0
                          ? " · Primero sube el arte base."
                          : designWizardStep === 1
                            ? " · Ahora decide qué información sí entra."
                            : " · Por último acomoda el overlay y guarda."
                        : designWizardStep === 0
                          ? " · Primero define el contenido."
                          : designWizardStep === 1
                            ? " · Después genera la dirección visual."
                            : " · Último paso: guarda y luego abre el sitio publicado."}
                    </small>
                    <small>
                      Meta final: dejar un poster legible, validado en preview y listo para guardarse o publicarse sin inconsistencias.
                    </small>
                  </div>
                  <div className={styles.visualWorkbenchLead}>
                    <strong>
                      {designSourceMode === "upload"
                        ? "Sube tu poster, decide qué información entra y deja que el sistema acomode los datos con contraste y jerarquía."
                        : "Elige una ruta local, genera varias opciones y refina la mejor versión antes de guardar."}
                    </strong>
                    <p>
                      {designSourceMode === "upload"
                        ? "Este flujo prioriza tu arte base y usa overlays programáticos para asegurar legibilidad en mobile, tablet y desktop."
                        : "Este flujo reduce la fricción: dirección editorial, motor y review en un solo recorrido."}
                    </p>
                  </div>

                  {designWizardStep === 0 ? (
                    <div className={styles.wizardSlide}>
                      {designSourceMode === "upload" ? (
                        <>
                          <div className={styles.sectionHeading}>
                            <span>Pantalla 1</span>
                            <strong>Sube el poster base antes de definir el overlay</strong>
                            <small>Primero entra el arte. Después decides qué información del evento aparecerá encima y en qué acomodo.</small>
                          </div>
                          <div className={styles.uploadPosterIntro}>
                            <article>
                              <span>Archivo</span>
                              <strong>{uploadedPosterFileName || "Aún no has elegido un poster"}</strong>
                              <small>Usa JPG, PNG o WEBP. El archivo se mostrará aquí mismo antes de guardarlo.</small>
                            </article>
                            <article>
                              <span>Qué sigue</span>
                              <strong>1. Subir arte 2. Elegir datos 3. Definir formato</strong>
                              <small>La fecha, el venue y el lineup ya salen de las tabs previas. Aquí solo decides cómo vivirán en el poster.</small>
                            </article>
                          </div>
                          <div className={styles.uploadPosterPanel}>
                            <label className={styles.uploadPosterDrop} htmlFor="venue-poster-upload-input">
                              <span>Archivo base</span>
                              <strong>{uploadedPosterFileName || "Selecciona un archivo para subir"}</strong>
                              <em>Seleccionar archivo</em>
                              <small>Haz clic aquí para elegir el poster desde tu computadora.</small>
                            </label>
                            <div className={styles.uploadPosterPreview}>
                              {hasUploadedPosterAsset ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={uploadedPosterPreview || draft.posterReferenceUrls?.[0]} alt="Poster subido" />
                              ) : (
                                <span>Vista previa</span>
                              )}
                            </div>
                          </div>
                          <div className={styles.visualPrepPanel}>
                            <div className={styles.selectionHint}>
                              <strong>Antes de pasar al overlay</strong>
                              <p>Necesitas tener listos los datos base del evento para que los toggles y estilos usen información real, no campos duplicados.</p>
                            </div>
                            <div className={styles.visualPrepLinks}>
                              <button type="button" className={styles.previewLink} onClick={() => setActiveConsoleTab("essentials")}>
                                Abrir Lo esencial
                              </button>
                              <button type="button" className={styles.previewLink} onClick={() => setActiveConsoleTab("story")}>
                                Abrir La historia
                              </button>
                              <button type="button" className={styles.previewLink} onClick={() => setActiveConsoleTab("operations")}>
                                Abrir Operación
                              </button>
                            </div>
                            <div className={styles.visualPrepSummary}>
                              <article>
                                <span>Lo esencial</span>
                                <strong>{essentialsComplete ? "Listo para poster" : "Falta completar datos base"}</strong>
                                <small>
                                  {draft.title.trim() ? draft.title : "Agrega un título"} ·{" "}
                                  {draft.venueName.trim() ? draft.venueName : "Venue pendiente"}
                                </small>
                              </article>
                              <article>
                                <span>La historia</span>
                                <strong>{draft.summary.trim() && draft.description.trim() ? "Copy principal listo" : "Falta completar narrativa"}</strong>
                                <small>{draft.summary.trim() ? draft.summary : "Agrega resumen y descripción para continuar"}</small>
                              </article>
                              <article>
                                <span>Operación</span>
                                <strong>{operationReady ? "Horarios base listos" : "Falta definir operación"}</strong>
                                <small>
                                  {operationReady
                                    ? `Puertas ${formatEventTime(draft.doorTime)} · Show ${formatEventTime(draft.startsAt)}`
                                    : "Configura puertas, soundcheck y checkpoints antes de diseñar el poster"}
                                </small>
                              </article>
                              <article>
                                <span>Estado de avance</span>
                                <strong>{hasUploadedPosterAsset ? "Poster base listo" : "Falta subir el poster base"}</strong>
                                <small>El botón siguiente se activa cuando el arte ya está subido y el contenido editorial ya quedó definido.</small>
                              </article>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.sectionHeading}>
                            <span>Pantalla 1</span>
                            <strong>Decide qué información ya definida puede entrar al poster</strong>
                            <small>Este paso ya no edita contenido. Primero define el evento en las tabs previas y aquí solo curas qué bloques puede usar el sistema.</small>
                          </div>
                          <div className={styles.wizardOverview}>
                            <article>
                              <span>Activos</span>
                              <strong>{visibleFieldCount} bloques</strong>
                            </article>
                            <article>
                              <span>Ocultos</span>
                              <strong>{hiddenFieldCount} bloques</strong>
                            </article>
                            <article>
                              <span>Qué hace esto</span>
                              <strong>Controla la información que puede aparecer en el poster</strong>
                            </article>
                          </div>
                          <div className={styles.visualPrepPanel}>
                            <div className={styles.selectionHint}>
                              <strong>Orden recomendado para un primer uso</strong>
                              <p>1. Lo esencial: título, fecha, venue, dirección y lineup. 2. La historia: resumen, descripción y géneros. 3. Operación: puertas, soundcheck y checkpoints. 4. Dirección visual: decide qué entra, produce el poster y revisa los tres viewports.</p>
                            </div>
                            <div className={styles.visualPrepLinks}>
                              <button type="button" className={styles.previewLink} onClick={() => setActiveConsoleTab("essentials")}>
                                Abrir Lo esencial
                              </button>
                              <button type="button" className={styles.previewLink} onClick={() => setActiveConsoleTab("story")}>
                                Abrir La historia
                              </button>
                              <button type="button" className={styles.previewLink} onClick={() => setActiveConsoleTab("operations")}>
                                Abrir Operación
                              </button>
                            </div>
                            <div className={styles.visualPrepSummary}>
                              <article>
                                <span>Lo esencial</span>
                                <strong>{essentialsComplete ? "Listo para poster" : "Falta completar datos base"}</strong>
                                <small>
                                  {draft.title.trim() ? draft.title : "Agrega un título"} ·{" "}
                                  {draft.venueName.trim() ? draft.venueName : "Venue pendiente"}
                                </small>
                              </article>
                              <article>
                                <span>La historia</span>
                                <strong>{draft.summary.trim() && draft.description.trim() ? "Copy principal listo" : "Falta completar narrativa"}</strong>
                                <small>{draft.summary.trim() ? draft.summary : "Agrega resumen y descripción para continuar"}</small>
                              </article>
                              <article>
                                <span>Operación</span>
                                <strong>{operationReady ? "Horarios base listos" : "Falta definir operación"}</strong>
                                <small>
                                  {operationReady
                                    ? `Puertas ${formatEventTime(draft.doorTime)} · Show ${formatEventTime(draft.startsAt)}`
                                    : "Configura puertas, soundcheck y checkpoints antes de diseñar el poster"}
                                </small>
                              </article>
                              <article>
                                <span>Lo que harás aquí</span>
                                <strong>Preparar la base editorial</strong>
                                <small>En el siguiente paso, cada ruta de poster te dejará decidir qué bloques visibles usar sin duplicar el flujo.</small>
                              </article>
                            </div>
                          </div>
                        </>
                      )}
                      <div className={styles.wizardActions}>
                        <button type="button" className={styles.previewLink} disabled>
                          Atrás
                        </button>
                        <button type="button" className={styles.saveButton} onClick={goToNextWizardStep} disabled={!canAdvanceFromStep0}>
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {designWizardStep === 1 ? (
                    <div className={styles.wizardSlide}>
                      {designSourceMode === "upload" ? null : (
                        <>
                          <div className={styles.sectionHeading}>
                            <span>Pantalla 2</span>
                            <strong>Escoge cómo generar la dirección visual del poster</strong>
                            <small>Local configura el sistema interno del sitio; IA redacta un brief y genera propuestas editoriales externas.</small>
                          </div>
                          <div className={styles.wizardOverview}>
                            <article>
                              <span>Modo</span>
                              <strong>{designSourceLabel}</strong>
                            </article>
                            <article>
                              <span>{designSourceMode === "local" ? "Ruta local" : "Brief editorial"}</span>
                              <strong>{designSourceDetail}</strong>
                            </article>
                            <article>
                              <span>Qué hace esto</span>
                              <strong>{designSourceAction}</strong>
                            </article>
                          </div>
                          <div className={styles.wizardPrompt}>
                            <strong>Pregunta guía</strong>
                            <p>¿Qué tipo de historia debería contar este poster y quién la va a producir?</p>
                          </div>
                        </>
                      )}
                      {designSourceMode === "local" ? (
                        <div className={styles.generatedBody}>
                          <div className={styles.selectionHint}>
                            <strong>◇ Ruta local</strong>
                            <p>Selecciona una dirección editorial. El motor elegido usará esta ruta para construir un poster nuevo a partir del contenido del evento.</p>
                          </div>
                          <div className={styles.styleSelectorGrid}>
                            {posterIdeaPresets.map((preset) => {
                              const active = preset.id === selectedIdeaPreset;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  className={active ? styles.styleCardActive : styles.styleCard}
                                  onClick={() => applyIdeaPreset(preset.id)}
                                  aria-pressed={active}
                                >
                                  <div>
                                    <span className={styles.toggleState}>{active ? "ACTIVA" : "DISPONIBLE"}</span>
                                    <strong>{preset.title}</strong>
                                    <p>{preset.prompt}</p>
                                    <small>{getEventInviteStyle(preset.localVariant).tone}</small>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div ref={providerSectionRef} className={styles.providerSection}>
                            <div className={styles.selectionHint}>
                              <strong>⚡ Motor de generación</strong>
                              <p>Elige desde dónde quieres producir el poster. Los dos modos de Pollinations funcionan sin registro; Hugging Face y Together requieren su propia key y se guardan solo en este navegador.</p>
                            </div>
                            <div className={styles.styleSelectorGrid}>
                              {providerOptions.map((providerOption) => {
                                const active = localPosterProvider === providerOption.id;
                                const connected =
                                  providerOption.id === "pollinations" || providerOption.id === "pollinations-alt"
                                    ? true
                                    : Boolean(providerKeys[providerOption.id]);

                                return (
                                  <button
                                    key={providerOption.id}
                                    type="button"
                                    className={active ? styles.styleCardActive : styles.styleCard}
                                    onClick={() => selectGenerationProvider(providerOption.id)}
                                    aria-pressed={active}
                                  >
                                    <div>
                                      <span className={styles.toggleState}>{active ? "ACTIVO" : "DISPONIBLE"}</span>
                                      <strong>{providerOption.title}</strong>
                                      <p>{providerOption.subtitle}</p>
                                      <small>{providerOption.detail}</small>
                                      {connected ? <span className={styles.connectedBadge}>Conectado ✓</span> : null}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            {expandedProviderSetup ? (
                              <div className={styles.providerSetupCard}>
                                <label className={styles.fullWidth}>
                                  <span>API key</span>
                                  <input
                                    value={activeProviderSetup ? providerKeyDrafts[activeProviderSetup] : ""}
                                    placeholder={activeProviderSetup === "huggingface" ? "hf_..." : "together_..."}
                                    onChange={(event) =>
                                      setProviderKeyDrafts((current) => ({
                                        ...current,
                                        ...(activeProviderSetup ? { [activeProviderSetup]: event.target.value } : {}),
                                      }))
                                    }
                                  />
                                </label>
                                <div className={styles.providerSetupActions}>
                                  <a href={providerOptions.find((item) => item.id === expandedProviderSetup)?.setupHref} target="_blank" rel="noreferrer">
                                    Obtener key
                                  </a>
                                  <button
                                    type="button"
                                    className={styles.saveButton}
                                    onClick={() => activeProviderSetup && persistProviderKey(activeProviderSetup)}
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {renderPosterFieldSelector({
                            title: "Información que sí puede entrar al poster",
                            description:
                              "Ajusta estos toggles antes de generar. Esta ruta local usará solo los bloques activos para construir composición, contraste y jerarquía.",
                          })}
                        </div>
                      ) : designSourceMode === "ai" ? (
                        <div className={styles.generatedBody}>
                          <div className={styles.selectionHint}>
                            <strong>✦ Flujo guiado IA</strong>
                            <p>Primero escribe una sola frase. Luego el sistema la convierte en un brief editorial estructurado, arma un prompt maestro y con ese mismo prompt genera todas las propuestas que devuelva el diseñador para que elijas una.</p>
                          </div>
                          <div className={styles.formGrid}>
                            <label className={styles.fullWidth}>
                              <span>Frase del usuario para orientar a la IA</span>
                              <textarea
                                rows={3}
                                value={aiDirectionNote}
                                onChange={(event) => {
                              setAiDirectionNote(event.target.value);
                              updateDraft("posterArtDirection", event.target.value);
                            }}
                                placeholder="Ej. que se sienta como una noche de jazz elegante pero con energia joven y ganas de comprar el boleto."
                              />
                              <small className={styles.inlineHint}>Si lo dejas vacio, el sistema asume defaults solidos con base en el titulo, la fecha, el venue, el lineup y el genero.</small>
                            </label>
                            <label className={styles.fullWidth}>
                              <span>Brief editorial estructurado</span>
                              <textarea rows={11} value={generatedEditorialBriefJson} readOnly />
                              <small className={styles.inlineHint}>Aqui el sistema extrae lo explicito, infiere lo faltante, completa defaults de arte y decide el estilo recomendado antes de generar.</small>
                            </label>
                            <label className={styles.fullWidth}>
                              <span>Prompt maestro que se enviara</span>
                              <textarea rows={4} value={generatedAiPrompt} readOnly />
                              <small className={styles.inlineHint}>Este es el unico prompt base. Con el se generan tres resultados, no tres prompts distintos.</small>
                            </label>
                          </div>
                          {renderPosterFieldSelector({
                            title: "Información que viajará en el brief y en el poster",
                            description:
                              "Estas selecciones ayudan a que la propuesta editorial no meta bloques innecesarios. Lo activo aquí es lo que la ruta IA debe priorizar.",
                          })}
                          <div className={styles.wizardActions}>
                            <button type="button" className={styles.saveButton} onClick={generateAiPosterDirections} disabled={aiStatus.loading}>
                              {aiStatus.loading ? "Generando..." : "Generar propuestas IA"}
                            </button>
                            {aiProposals.length > 0 ? (
                              <button type="button" className={styles.previewLink} onClick={() => void clearTransientAiWorkspace()}>
                                Borrar propuestas IA
                              </button>
                            ) : null}
                          </div>
                          {aiProposals.length > 0 && !aiProposalsAreCurrent ? (
                            <div className={styles.progressCard}>
                              <small>Los datos del evento cambiaron despues de la ultima generacion. Vuelve a generar para obtener propuestas alineadas con el brief actual.</small>
                            </div>
                          ) : null}
                          {aiStatus.loading ? (
                            <div className={styles.progressCard}>
                              <div className={styles.progressBarTrack}>
                                <div className={styles.progressBarFill} />
                              </div>
                              <small>Consultando al diseñador IA y construyendo propuestas editoriales...</small>
                            </div>
                          ) : null}
                          {aiStatus.error ? <p>{aiStatus.error}</p> : null}
                          {aiProposals.length > 0 ? (
                            <div className={styles.aiProposalGrid}>
                              {aiProposals.map((proposal) => (
                                <button
                                  key={proposal.proposal_id}
                                  type="button"
                                  className={proposal.proposal_id === selectedAiProposalId ? styles.styleCardActive : styles.aiProposalCard}
                                  onClick={() => setSelectedAiProposalId(proposal.proposal_id)}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={proposal.poster_url} alt={proposal.style_title} className={styles.aiProposalThumb} />
                                  <div className={styles.aiProposalMetaRow}>
                                    {proposal.rank ? <span className={styles.aiProposalRank}>#{proposal.rank}</span> : null}
                                    {proposal.recommendation_label ? <span className={styles.aiProposalBadge}>{proposal.recommendation_label}</span> : null}
                                    {typeof proposal.total_score === "number" ? <span className={styles.aiProposalScore}>{proposal.total_score.toFixed(1)}/10</span> : null}
                                  </div>
                                  <strong>{proposal.style_title}</strong>
                                  {proposal.summary ? <span className={styles.aiProposalSummary}>{proposal.summary}</span> : null}
                                  <small>{proposal.design_storytelling}</small>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        renderPosterFieldSelector({
                          title: "Activa o apaga la información que el poster puede usar",
                          description:
                            "Este paso no vuelve a pedir datos. Solo enciende o apaga bloques ya definidos en Lo esencial, La historia y Operación.",
                        })
                      )}

                      <div className={styles.wizardActions}>
                        <button type="button" className={styles.previewLink} onClick={goToPreviousWizardStep}>
                          Atrás
                        </button>
                        <button
                          type="button"
                          className={styles.saveButton}
                          onClick={() => {
                            if (designSourceMode === "local") {
                              void triggerLocalPosterGeneration();
                              return;
                            }

                            goToNextWizardStep();
                          }}
                          disabled={!canAdvanceFromStep1}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {designWizardStep === 2 && (designSourceMode === "local" || designSourceMode === "upload") ? (
                    <div className={styles.wizardSlide}>
                      {designSourceMode === "upload" ? (
                        <>
                          <div className={styles.sectionHeading}>
                            <span>Pantalla 3</span>
                            <strong>Elige el formato del overlay y guarda la versión final</strong>
                            <small>Ahora sí decides el acomodo del texto, validas el preview y publicas si ya está listo.</small>
                          </div>
                          <div className={styles.wizardOverview}>
                            <article>
                              <span>Origen</span>
                              <strong>Poster subido</strong>
                            </article>
                            <article>
                              <span>Bloques visibles</span>
                              <strong>{visibleFieldCount} activos</strong>
                            </article>
                            <article>
                              <span>Estado</span>
                              <strong>{effectivePosterReferenceUrls[0] ? "Listo para guardar" : "Falta subir poster"}</strong>
                            </article>
                          </div>
                          <div className={styles.selectionHint}>
                            <strong>◫ Formato del overlay</strong>
                            <p>Si el poster ya trae toda la información, elige “Sin texto encima”. Si necesita fecha, lugar o CTA, selecciona el acomodo más legible.</p>
                          </div>
                          <div className={styles.optionGrid}>
                            {uploadOverlayOptions.map((option) => {
                              const active = uploadTextOverlayMode === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={active ? styles.optionCardActive : styles.optionCard}
                                  data-overlay-option={option.id}
                                  onClick={() => {
                                    setUploadTextOverlayMode(option.id);
                                    updateDraft("posterTextOverlayMode", option.id);
                                    updateDraft("posterArtDirection", `Uploaded poster with ${option.id} overlay`);
                                  }}
                                  aria-pressed={active}
                                  data-testid={`wizard-upload-overlay-option-${option.id}`}
                                >
                                  <strong>{option.title}</strong>
                                  <small>{option.detail}</small>
                                </button>
                              );
                            })}
                          </div>
                          {renderOverlayEditorCallout({
                            eyebrow: "Mini editor",
                            title: "Afina el acomodo antes de guardar",
                            detail:
                              "Abre el editor visual para mover bloques, compactar tarjetas o darle más aire al arte sin tener que repetir el flujo completo.",
                          })}
                          <div className={styles.generatedBody}>
                            <div className={styles.selectionHint}>
                              <strong>Siguiente paso</strong>
                              <p>El preview lateral muestra el resultado en desktop, tablet y mobile. Si se ve bien, guarda; si además quieres dejarlo público, publica desde aquí mismo.</p>
                            </div>
                            <div className={styles.reviewActionPanel}>
                              <button type="submit" className={`${styles.saveButton} ${styles.reviewDraftButton}`} disabled={isSaving || !effectivePosterReferenceUrls[0]}>
                                {isSaving ? "Guardando..." : "Guardar poster como borrador"}
                              </button>
                              <button
                                type="submit"
                                name="isPublished"
                                value="on"
                                className={styles.reviewPrimaryButton}
                                disabled={isSaving || !effectivePosterReferenceUrls[0]}
                              >
                                {isSaving ? "Publicando..." : "Publicar y guardar"}
                              </button>
                              {effectivePosterReferenceUrls[0] ? (
                                <a className={`${styles.previewLink} ${styles.reviewPosterLink}`} href={effectivePosterReferenceUrls[0]} target="_blank" rel="noreferrer">
                                  Abrir poster en grande
                                </a>
                              ) : (
                                <button type="button" className={`${styles.previewLink} ${styles.reviewPosterLink}`} disabled>
                                  Abrir poster en grande
                                </button>
                              )}
                              {canViewPublishedSite && publicHref ? (
                                <Link
                                  href={publicHref}
                                  className={`${styles.previewLink} ${styles.reviewSiteLink}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ver sitio publicado
                                </Link>
                              ) : (
                                <button type="button" className={`${styles.previewLink} ${styles.reviewSiteLink}`} disabled title={viewPublishedSiteHint}>
                                  Ver sitio publicado
                                </button>
                              )}
                            </div>
                            {viewPublishedSiteHint ? <small className={styles.inlineHint}>{viewPublishedSiteHint}</small> : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.sectionHeading}>
                            <span>Pantalla 3</span>
                            <strong>Revisa el poster y termina la publicación</strong>
                            <small>Cuando se vea bien, guarda. Si quieres que el sitio quede público, usa el botón grande de publicar y guardar.</small>
                          </div>
                          <div className={styles.wizardOverview}>
                            <article>
                              <span>Origen</span>
                              <strong>{generatedPosterProviderLabel}</strong>
                            </article>
                            <article>
                              <span>Ruta</span>
                              <strong>{selectedPreset.title}</strong>
                            </article>
                            <article>
                              <span>Estado</span>
                              <strong>
                                {localPosterGeneration.status === "loading"
                                  ? "Generando..."
                                  : localPosterGeneration.status === "success"
                                    ? "Listo para revisar"
                                    : localPosterGeneration.status === "error"
                                      ? "Necesita reintento"
                                      : "Aún sin generar"}
                              </strong>
                            </article>
                          </div>
                          <div className={styles.generatedBody}>
                            {renderOverlayEditorCallout({
                              eyebrow: "Editor visual",
                              title: "Refina la composición final",
                              detail:
                                "La ruta local ya te dio una pieza base. Aquí solo ajustas dónde viven headline, lineup, CTA e información secundaria en cada viewport.",
                            })}
                            <p>El preview lateral muestra cómo se verá el poster en desktop, tablet y mobile. El siguiente paso real es guardar para que esta versión quede asociada al evento.</p>
                            <div className={styles.selectionHint}>
                              <strong>Siguiente paso</strong>
                              <p>Para publicar, usa el botón rosa. Si solo quieres conservar el avance, usa Guardar poster como borrador.</p>
                            </div>
                            <div className={styles.reviewActionPanel}>
                              <button type="submit" className={`${styles.saveButton} ${styles.reviewDraftButton}`} disabled={isSaving || !effectivePosterReferenceUrls[0]}>
                                {isSaving ? "Guardando..." : "Guardar poster como borrador"}
                              </button>
                              <button
                                type="submit"
                                name="isPublished"
                                value="on"
                                className={styles.reviewPrimaryButton}
                                disabled={isSaving || !effectivePosterReferenceUrls[0]}
                              >
                                {isSaving ? "Publicando..." : "Publicar y guardar"}
                              </button>
                              {effectivePosterReferenceUrls[0] ? (
                                <a className={`${styles.previewLink} ${styles.reviewPosterLink}`} href={effectivePosterReferenceUrls[0]} target="_blank" rel="noreferrer">
                                  Abrir poster en grande
                                </a>
                              ) : (
                                <button type="button" className={`${styles.previewLink} ${styles.reviewPosterLink}`} disabled>
                                  Abrir poster en grande
                                </button>
                              )}
                              {canViewPublishedSite && publicHref ? (
                                <Link
                                  href={publicHref}
                                  className={`${styles.previewLink} ${styles.reviewSiteLink}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ver sitio publicado
                                </Link>
                              ) : (
                                <button type="button" className={`${styles.previewLink} ${styles.reviewSiteLink}`} disabled title={viewPublishedSiteHint}>
                                  Ver sitio publicado
                                </button>
                              )}
                            </div>
                            {viewPublishedSiteHint ? <small className={styles.inlineHint}>{viewPublishedSiteHint}</small> : null}
                          </div>
                        </>
                      )}
                      <div className={styles.wizardActions}>
                        <button type="button" className={styles.previewLink} onClick={goToPreviousWizardStep}>
                          Atrás
                        </button>
                          <button type="button" className={`${styles.saveButton} ${styles.reviewSourceButton}`} onClick={jumpBackToProviderSelector}>
                            {designSourceMode === "upload" ? "Subir o cambiar poster" : "Cambiar motor"}
                          </button>
                      </div>
                    </div>
                  ) : null}

                  {designWizardStep === 2 && designSourceMode === "ai" ? (
                    <div className={styles.wizardSlide}>
                      <div className={styles.sectionHeading}>
                        <span>Pantalla 3</span>
                        <strong>Revisa el resultado y afina detalles visuales</strong>
                        <small>Compara el poster en desktop, tablet y mobile; luego termina de elegir detalles para publicación.</small>
                      </div>
                      <div className={styles.wizardOverview}>
                        <article>
                          <span>Template</span>
                          <strong>{templateLabelMap[generatedDesign.templateId]}</strong>
                        </article>
                        <article>
                          <span>Renderer</span>
                          <strong>{generatedDesign.rendererId}</strong>
                        </article>
                        <article>
                          <span>Viewports</span>
                          <strong>Desktop, tablet y mobile</strong>
                        </article>
                      </div>
                      <div className={styles.selectionHint}>
                        <strong>Motifs y detalles</strong>
                        <p>Estos acentos empujan el look final del poster, pero no cambian el contenido. Actívalos para sumar textura visual.</p>
                      </div>
                      <div className={styles.motifGrid}>
                        {eventVisualMotifs.map((motif) => {
                          const active = (draft.designMotifs ?? []).includes(motif.id);
                          return (
                            <label key={motif.id} className={active ? styles.motifToggleActive : styles.motifToggle}>
                              <input type="checkbox" checked={active} onChange={() => toggleMotif(motif.id)} />
                              <div>
                                <strong>{motif.label}</strong>
                                <p>{motif.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className={styles.generatedBody}>
                        {renderOverlayEditorCallout({
                          eyebrow: "Editor visual",
                          title: "Ajusta el overlay sobre la propuesta IA",
                          detail:
                            "No altera la imagen generada. Solo reposiciona la información del evento para proteger contraste, legibilidad y atracción comercial.",
                        })}
                        <p>Si el poster todavía se siente saturado o pierde legibilidad en mobile, vuelve al paso anterior y cambia ruta, brief o asset mode antes de publicar.</p>
                      </div>
                      <div className={styles.wizardActions}>
                        <button type="button" className={styles.previewLink} onClick={goToPreviousWizardStep}>
                          Atrás
                        </button>
                        <button type="button" className={styles.saveButton} onClick={() => setPreviewScreen("preview")}>
                          Ver preview final
                        </button>
                      </div>
                    </div>
                  ) : null}
                  </>
                  ) : (
                    <div className={styles.posterLibrarySection}>
                      <div className={styles.posterLibraryHeader}>
                        <div>
                          <span>Poster library</span>
                          <strong>Versiones guardadas dentro del evento</strong>
                          <p>Recupera variantes, duplica una línea visual prometedora y vuelve a dejar una revisión como principal del evento.</p>
                        </div>
                        <small>
                          {posterLibrary.length} {posterLibrary.length === 1 ? "poster" : "posters"} guardados
                        </small>
                      </div>
                      {posterLibrary.length > 0 ? (
                        <div className={styles.posterLibraryGrid}>
                          {posterLibrary.map((asset) => {
                            const isActive = asset.id === activePosterLibraryAsset?.id;
                            const canDelete = asset.status !== "published";
                            const assetSummary =
                              asset.snapshot?.posterArtDirection ??
                              asset.artDirection ??
                              asset.prompt ??
                              "Sin nota editorial adicional";
                            const assetModeLabel =
                              assetModeOptions.find((option) => option.id === asset.assetMode)?.label ??
                              asset.assetMode ??
                              "Graphic only";

                            return (
                              <article
                                key={asset.id}
                                className={isActive ? styles.posterRevisionCardActive : styles.posterRevisionCard}
                              >
                                <div className={styles.posterRevisionThumb}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={asset.url} alt="" />
                                </div>
                                <div className={styles.posterRevisionBody}>
                                  <div className={styles.posterRevisionMetaRow}>
                                    <span className={styles.posterRevisionBadge}>{getPosterAssetStatusLabel(asset)}</span>
                                    <small>Rev. {asset.revision}</small>
                                  </div>
                                  <strong>{asset.label}</strong>
                                  <p>{assetSummary}</p>
                                  <div className={styles.posterRevisionFacts}>
                                    <span>{getPosterAssetOriginLabel(asset)}</span>
                                    <span>{formatPosterAssetDate(asset.updatedAt)}</span>
                                    <span>{assetModeLabel}</span>
                                  </div>
                                  <div className={styles.posterRevisionActions}>
                                    <button type="button" className={styles.previewLink} onClick={() => loadPosterRevision(asset)}>
                                      Cargar al editor
                                    </button>
                                    <button type="button" className={styles.previewLink} onClick={() => duplicatePosterRevision(asset)}>
                                      Duplicar variante
                                    </button>
                                    {canDelete ? (
                                      <button
                                        type="button"
                                        className={styles.posterRevisionDelete}
                                        onClick={() => {
                                          if (window.confirm("Este draft se quitará de la biblioteca del evento. ¿Continuar?")) {
                                            removePosterRevision(asset.id);
                                          }
                                        }}
                                      >
                                        Borrar draft
                                      </button>
                                    ) : (
                                      <span className={styles.posterRevisionLocked}>Publicado</span>
                                    )}
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={styles.posterLibraryEmpty}>
                          <strong>Aún no hay posters persistidos en este evento.</strong>
                          <p>Cuando guardes un render o un upload, la variante quedará archivada aquí para reabrirla, duplicarla o reactivarla.</p>
                        </div>
                      )}
                    </div>
                  )}
                </details>
                ) : null}

                {activeConsoleTab === "operations" ? (
                <details className={operationsSectionClassName} open>
                  <summary onClick={(event) => { event.preventDefault(); toggleSection("operations"); }}>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">⚙️</span>
                      <span>Operación</span>
                    </span>
                  </summary>
                  <div className={styles.formGrid}>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMeta}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◴ Fin</strong>
                        <small>Cierre programado del evento para operación y comunicación.</small>
                      </span>
                      <input
                        type="datetime-local"
                        name="endsAt"
                        value={toDateTimeLocalValue(draft.endsAt)}
                        onChange={(event) => updateDraft("endsAt", new Date(event.target.value).toISOString())}
                      />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMeta}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◷ Timezone</strong>
                        <small>Controla fechas, horarios y consistencia de publicación.</small>
                      </span>
                      <input
                        name="timezone"
                        value={draft.timezone}
                        placeholder="Ej: America/Mexico_City"
                        onChange={(event) => updateDraft("timezone", event.target.value)}
                      />
                    </label>
                    <div className={`${styles.fullWidth} ${styles.inlineSectionNote}`}>
                      <strong>Doors y soundcheck</strong>
                      <small>Separa claramente tiempos de acceso y operación interna para que el staff y el poster no se crucen.</small>
                    </div>
                    <label className={`${styles.fieldCard} ${styles.fieldCardDoors}`}>
                      <span className={styles.fieldLabel}>
                        <strong>⟐ Doors</strong>
                        <small>Apertura de puertas. Úsalo para acceso, filas y timing de consumo.</small>
                      </span>
                      <input
                        type="datetime-local"
                        name="doorTime"
                        value={toDateTimeLocalValue(draft.doorTime)}
                        onChange={(event) => updateDraft("doorTime", new Date(event.target.value).toISOString())}
                      />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardOps}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◌ Soundcheck</strong>
                        <small>Referencia interna para producción, staff y coordinación del venue.</small>
                      </span>
                      <input
                        type="datetime-local"
                        name="soundcheckTime"
                        value={toDateTimeLocalValue(draft.soundcheckTime)}
                        onChange={(event) => updateDraft("soundcheckTime", new Date(event.target.value).toISOString())}
                      />
                    </label>
                    <article className={`${styles.fullWidth} ${styles.fieldCard} ${styles.readOnlyContextCard}`}>
                      <span className={styles.fieldLabel}>
                        <strong>⌖ Dirección definida</strong>
                        <small>Se usa en mapa, CTA y bloques del poster, pero se edita solo desde Lo esencial.</small>
                      </span>
                      <strong className={styles.readOnlyContextValue}>
                        {draft.venueAddress.trim() || "Aún no hay dirección capturada."}
                      </strong>
                      <div className={styles.readOnlyContextActions}>
                        <button type="button" className={styles.previewLink} onClick={() => setActiveConsoleTab("essentials")}>
                          Editar en Lo esencial
                        </button>
                      </div>
                    </article>
                    <div className={`${styles.fullWidth} ${styles.inlineSectionNote} ${styles.inlineSectionNoteOps}`}>
                      <strong>Momentos operativos extra</strong>
                      <small>Agrega checkpoints propios del venue como recepción, acceso staff, briefing o cualquier momento importante previo al show.</small>
                    </div>
                    <div className={`${styles.fullWidth} ${styles.operationalMomentsPanel}`}>
                      <div className={styles.operationalMomentsHeader}>
                        <div className={styles.operationalMomentsCopy}>
                          <strong>Timeline custom del evento</strong>
                          <small>Estos momentos viven junto a doors y soundcheck, y se guardan como parte de la operación del evento.</small>
                        </div>
                        <button type="button" className={styles.operationalMomentAddButton} onClick={addOperationalMoment}>
                          <span aria-hidden="true">＋</span>
                          <strong>Agregar momento</strong>
                        </button>
                      </div>
                      {(draft.operationalMoments ?? []).length ? (
                        <div className={styles.operationalMomentList}>
                          {(draft.operationalMoments ?? []).map((moment, index) => (
                            <div key={moment.id} className={styles.operationalMomentRow}>
                              <label className={`${styles.fieldCard} ${styles.fieldCardOps} ${styles.operationalMomentLabelCard}`}>
                                <span className={styles.fieldLabel}>
                                  <strong>✦ Momento {index + 1}</strong>
                                  <small>Nómbralo como lo usa tu equipo: recepción, hospitality, briefing, call de staff, etc.</small>
                                </span>
                                <input
                                  value={moment.label}
                                  placeholder="Recepción"
                                  onChange={(event) => updateOperationalMoment(moment.id, "label", event.target.value)}
                                />
                              </label>
                              <label className={`${styles.fieldCard} ${styles.fieldCardMeta} ${styles.operationalMomentTimeCard}`}>
                                <span className={styles.fieldLabel}>
                                  <strong>◷ Hora</strong>
                                  <small>Momento exacto en el que sucede este checkpoint operativo.</small>
                                </span>
                                <input
                                  type="datetime-local"
                                  value={toDateTimeLocalValue(moment.time)}
                                  onChange={(event) =>
                                    updateOperationalMoment(moment.id, "time", new Date(event.target.value).toISOString())
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                className={styles.operationalMomentRemoveButton}
                                onClick={() => removeOperationalMoment(moment.id)}
                                aria-label={`Borrar ${moment.label || `momento ${index + 1}`}`}
                              >
                                <span aria-hidden="true">✕</span>
                                <strong>Borrar</strong>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.operationalMomentEmpty}>
                          <strong>Aún no hay momentos custom</strong>
                          <small>Si tu operación necesita más que doors y soundcheck, crea aquí los momentos extra con un clic.</small>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
                ) : null}

                {activeConsoleTab === "ticketing" ? (
                <details className={ticketingSectionClassName} open>
                  <summary onClick={(event) => { event.preventDefault(); toggleSection("ticketing"); }}>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">🎟️</span>
                      <span>Ticketing y publicación</span>
                    </span>
                  </summary>
                  <div className={styles.sectionHintRibbon}>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">◍</span>
                      <strong>Monetización</strong>
                    </article>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">◫</span>
                      <strong>Aforo</strong>
                    </article>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">◎</span>
                      <strong>Estado público</strong>
                    </article>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={`${styles.fieldCard} ${styles.fullWidth}`}>
                      <span className={styles.fieldLabel}>
                        <strong>Template del boleto</strong>
                        <small>Define cómo se verá el ticket compartible y el asset de acceso dentro del ecosistema del evento.</small>
                      </span>
                      <div className={styles.optionGrid}>
                        {ticketTemplateIds.map((templateId) => {
                          const template = ticketTemplateMeta[templateId];
                          const active = (draft.ticketTemplateId ?? "festival-pass") === templateId;

                          return (
                            <button
                              key={templateId}
                              type="button"
                              className={active ? styles.optionCardActive : styles.optionCard}
                              onClick={() => updateDraft("ticketTemplateId", templateId)}
                            >
                              <strong>{template.title}</strong>
                              <span>{template.detail}</span>
                              <small>{template.description}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMoneyHero}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◍ Precio base</strong>
                        <small>Precio principal visible al comprador y base de cálculo para ingresos.</small>
                      </span>
                      <input type="number" name="ticketPriceMXN" value={draft.ticketPriceMXN} onChange={(event) => updateDraft("ticketPriceMXN", Number(event.target.value))} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMoney}`}>
                      <span className={styles.fieldLabel}>
                        <strong>＋ Fee consumidor</strong>
                        <small>Cargo adicional para el buyer. Úsalo para separar precio y fee con claridad.</small>
                      </span>
                      <input type="number" name="ticketFeeMXN" value={draft.ticketFeeMXN} onChange={(event) => updateDraft("ticketFeeMXN", Number(event.target.value))} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardFinanceAccent}`}>
                      <span className={styles.fieldLabel}>
                        <strong>↗ % payout artista</strong>
                        <small>Porcentaje del ingreso destinado al artista o proyecto según tu operación.</small>
                      </span>
                      <input type="number" min={0} max={1} step={0.01} name="artistPayoutRate" value={draft.artistPayoutRate} onChange={(event) => updateDraft("artistPayoutRate", Number(event.target.value))} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardCapacity}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◫ Capacidad</strong>
                        <small>Máximo de asistentes disponibles para venta y operación del venue.</small>
                      </span>
                      <input type="number" name="capacity" value={draft.capacity} onChange={(event) => updateDraft("capacity", Number(event.target.value))} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardCapacity}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◉ Vendidos</strong>
                        <small>Boletos ya colocados. Te ayuda a leer avance comercial y urgencia.</small>
                      </span>
                      <input type="number" name="soldCount" value={draft.soldCount} onChange={(event) => updateDraft("soldCount", Number(event.target.value))} />
                    </label>
                    <label className={styles.publishToggle}>
                      <input type="checkbox" name="isPublished" checked={draft.isPublished} onChange={(event) => updateDraft("isPublished", event.target.checked)} />
                      <span className={styles.publishToggleIcon} aria-hidden="true">◎</span>
                      <span className={styles.publishToggleCopy}>
                        <strong><i className={styles.fieldIcon} aria-hidden="true">◎</i>Hacer evento público</strong>
                        <small>Activa la cartelera pública, los listados de eventos y el sitio publicado para vender boletos.</small>
                      </span>
                    </label>
                  </div>
                </details>
                ) : null}

                {false ? (
                <details className={assetsSectionClassName} open={openSections.assets}>
                  <summary onClick={(event) => { event.preventDefault(); toggleSection("assets"); }}>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">⬒</span>
                      <span>Assets y handoff</span>
                    </span>
                  </summary>
                  <div className={styles.formGrid}>
                    <label>
                      <span>Template</span>
                      <select name="designTemplateId" value={draft.designTemplateId ?? ""} onChange={(event) => updateDraft("designTemplateId", (event.target.value || undefined) as PosterTemplateId | undefined)}>
                        <option value="">Auto</option>
                        {templateOptions.map((templateId) => (
                          <option key={templateId} value={templateId}>
                            {templateLabelMap[templateId]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Asset mode</span>
                      <select value={draft.posterAssetMode ?? "graphic-only"} onChange={(event) => updateDraft("posterAssetMode", event.target.value as VenueEventRecord["posterAssetMode"])}>
                        {assetModeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.fullWidth}>
                      <span>Hero image</span>
                      <input type="file" name="heroImageFile" accept="image/*" onChange={handleHeroFileChange} />
                    </label>
                  </div>
                  <div className={styles.assetStatusRow}>
                    <article>
                      <span>Actual</span>
                      <strong>{draft.heroImage.split("/").pop()?.split("?")[0] ?? "Sin imagen"}</strong>
                    </article>
                    <article>
                      <span>Pendiente</span>
                      <strong>{pendingHeroFileName || "Ningún archivo nuevo"}</strong>
                    </article>
                    <article>
                      <span>Asset mode</span>
                      <strong>{assetModeOptions.find((option) => option.id === (draft.posterAssetMode ?? "graphic-only"))?.label}</strong>
                    </article>
                    <article>
                      <span>Poster source</span>
                      <strong>{effectivePosterReferenceUrls[0] ? effectivePosterReferenceUrls[0].slice(0, 48) : "Sin poster generado"}</strong>
                    </article>
                  </div>
                  <div className={styles.posterLibrarySection}>
                    <div className={styles.posterLibraryHeader}>
                      <div>
                        <span>Poster library</span>
                        <strong>Versiones guardadas dentro del evento</strong>
                        <p>Cada poster conserva su snapshot editorial para que puedas reabrirlo, activarlo otra vez o limpiar borradores viejos. Los cambios a esta biblioteca se persisten con el guardado normal del evento.</p>
                      </div>
                      <small>
                        {posterLibrary.length} {posterLibrary.length === 1 ? "poster" : "posters"} guardados
                      </small>
                    </div>
                    {posterLibrary.length > 0 ? (
                      <div className={styles.posterLibraryGrid}>
                        {posterLibrary.map((asset) => {
                          const isActive = asset.id === activePosterLibraryAsset?.id;
                          const canDelete = asset.status !== "published";
                          const assetSummary =
                            asset.snapshot?.posterArtDirection ??
                            asset.artDirection ??
                            asset.prompt ??
                            "Sin nota editorial adicional";
                          const assetModeLabel =
                            assetModeOptions.find((option) => option.id === asset.assetMode)?.label ??
                            asset.assetMode ??
                            "Graphic only";

                          return (
                            <article
                              key={asset.id}
                              className={isActive ? styles.posterRevisionCardActive : styles.posterRevisionCard}
                            >
                              <div className={styles.posterRevisionThumb}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={asset.url} alt="" />
                              </div>
                              <div className={styles.posterRevisionBody}>
                                <div className={styles.posterRevisionMetaRow}>
                                  <span className={styles.posterRevisionBadge}>{getPosterAssetStatusLabel(asset)}</span>
                                  <small>Rev. {asset.revision}</small>
                                </div>
                                <strong>{asset.label}</strong>
                                <p>{assetSummary}</p>
                                <div className={styles.posterRevisionFacts}>
                                  <span>{getPosterAssetOriginLabel(asset)}</span>
                                  <span>{formatPosterAssetDate(asset.updatedAt)}</span>
                                  <span>{assetModeLabel}</span>
                                </div>
                                <div className={styles.posterRevisionActions}>
                                  <button type="button" className={styles.previewLink} onClick={() => loadPosterRevision(asset)}>
                                    Cargar al editor
                                  </button>
                                  <button type="button" className={styles.previewLink} onClick={() => duplicatePosterRevision(asset)}>
                                    Duplicar variante
                                  </button>
                                  {canDelete ? (
                                    <button
                                      type="button"
                                      className={styles.posterRevisionDelete}
                                      onClick={() => {
                                        if (window.confirm("Este draft se quitará de la biblioteca del evento. ¿Continuar?")) {
                                          removePosterRevision(asset.id);
                                        }
                                      }}
                                    >
                                      Borrar draft
                                    </button>
                                  ) : (
                                    <span className={styles.posterRevisionLocked}>Publicado</span>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={styles.posterLibraryEmpty}>
                        <strong>Aún no hay posters persistidos en este evento.</strong>
                        <p>Cuando guardes un render o un upload, se archivará aquí con su contexto visual y editorial completo.</p>
                      </div>
                    )}
                  </div>
                  <div className={styles.motifGrid}>
                    {generatedDesign.handoff.developerNotes.map((note) => (
                      <article key={note} className={styles.motifToggleActive}>
                        <div>
                          <strong>{generatedDesign.rendererId}</strong>
                          <p>{note}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
                ) : null}
              </div>

              <div
                className={styles.editorFooter}
                data-visual-mode={activeConsoleTab === "visual" && activeVisualTab !== "library" ? "compact" : "default"}
              >
                <div>
                  <strong>
                    {saveState.message ||
                      deleteState.message ||
                      (hasUnsavedChanges
                        ? "Tienes cambios sin guardar en contenido, arte o asset sourcing."
                        : "Todo esta sincronizado con el último estado guardado.")}
                  </strong>
                </div>
                <div className={styles.editorActions}>
                  <button type="submit" className={styles.saveButton} disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Guardar borrador"}
                  </button>
                  {draft.id ? (
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={requestDeleteEvent}
                      disabled={isDeleting || isSaving}
                    >
                      {isDeleting ? "Borrando..." : "Borrar evento"}
                    </button>
                  ) : null}
                  <button type="button" className={styles.previewLink} onClick={resetDraftToSavedState} disabled={!hasUnsavedChanges}>
                    Revertir cambios
                  </button>
                  {publicHref ? (
                    canViewPublishedSite ? (
                    <Link href={publicHref} className={styles.previewLink} target="_blank" rel="noreferrer">
                      Ver sitio publicado
                    </Link>
                    ) : (
                      <button type="button" className={styles.previewLink} disabled title={viewPublishedSiteHint}>
                        Ver sitio publicado
                      </button>
                    )
                  ) : null}
                </div>
                {draft.id && deleteState.ok === false && deleteState.message ? (
                  <small className={styles.deleteHint}>{deleteState.message}</small>
                ) : null}
              </div>
              </div>
              ) : null}
            </form>
            {draft.id ? (
              <form id={deleteFormId} action={deleteAction} className={styles.hiddenDeleteForm}>
                <input type="hidden" name="id" value={draft.id} />
                <input type="hidden" name="slug" value={draft.slug} />
                <input type="hidden" name="title" value={draft.title} />
                <input type="hidden" name="deleteConfirmation" value={deleteConfirmation} />
              </form>
            ) : null}

            {true ? (
            <div className={styles.legacyWorkspaceHidden}>
            <section className={styles.previewPanel}>
              <div className={styles.panelHeader}>
                <p>Preview</p>
                <h2>Vista renderizada del evento</h2>
              </div>
              <div className={styles.previewSummaryGrid}>
                <article>
                  <span>Evento</span>
                  <strong>{draft.title || "Sin título"}</strong>
                </article>
                <article>
                  <span>Poster activo</span>
                  <strong>{renderedPreviewPosterUrl ? "Listo para revisar" : "Aún no cargado"}</strong>
                </article>
                <article>
                  <span>Vista actual</span>
                  <strong>{activeConsoleTabMeta.label}</strong>
                </article>
                <article>
                  <span>Estado</span>
                  <strong>{draft.isPublished ? "Publicado" : "Borrador"}</strong>
                </article>
              </div>
              <div className={styles.previewToolbar}>
                <div className={styles.previewSwitch}>
                  <button type="button" className={previewScreen === "preview" ? styles.previewTabActive : styles.previewTab} onClick={() => setPreviewScreen("preview")}>
                    Poster
                  </button>
                  <button type="button" className={previewScreen === "story" ? styles.previewTabActive : styles.previewTab} onClick={() => setPreviewScreen("story")}>
                    Story
                  </button>
                  <button type="button" className={previewScreen === "ticket" ? styles.previewTabActive : styles.previewTab} onClick={() => setPreviewScreen("ticket")}>
                    Ticket
                  </button>
                </div>
              </div>

              <div className={styles.previewBody}>
                {previewScreen === "preview" ? (
                  activePreviewPosterUrl ? (
                    <div className={styles.viewportPreviewGrid} data-testid="general-preview-grid">
                      {[
                        { label: "Desktop", width: "1200px", height: "760px", scale: 0.24, mode: "desktop" },
                        { label: "Tablet", width: "1024px", height: "768px", scale: 0.26, mode: "tablet" },
                        { label: "Mobile", width: "390px", height: "844px", scale: 0.34, mode: "mobile" },
                      ].map((viewport) => (
                        <article
                          key={viewport.label}
                          className={styles.viewportCard}
                          data-testid={`general-preview-viewport-${viewport.mode}`}
                        >
                          <div className={styles.viewportCardHeader}>
                            <span>{viewport.label}</span>
                            <strong>
                              {viewport.width.replace("px", "")} × {viewport.height.replace("px", "")}
                            </strong>
                          </div>
                          <div
                            className={styles.generatedViewportStage}
                            style={
                              {
                                "--preview-width": viewport.width,
                                "--preview-height": viewport.height,
                                "--preview-scale": String(viewport.scale),
                              } as CSSProperties
                            }
                          >
                            <div className={`${styles.generatedViewportFrame} ${styles[`generatedViewportFrame${viewport.mode === "mobile" ? "Mobile" : viewport.mode === "tablet" ? "Tablet" : "Desktop"}`]}`}>
                              <div className={styles.generatedViewportCanvas}>
                                {renderPosterViewportComposite(
                                  viewport.mode === "mobile" ? "mobile" : viewport.mode === "tablet" ? "tablet" : "desktop",
                                  activePreviewPosterUrl,
                                )}
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.previewPlaceholder}>
                      <strong>El preview se activa cuando el evento ya tiene un poster.</strong>
                      <p>Usa la pestaña de Dirección visual para subir uno propio o generar una variante local. En cuanto exista, aquí verás la versión renderizada en desktop, tablet y mobile.</p>
                    </div>
                  )
                ) : null}

                {previewScreen === "story" ? (
                  <div className={styles.generatedBody}>
                    <strong>{generatedDesign.narrative.kicker}</strong>
                    <p>{generatedDesign.narrative.manifesto}</p>
                    <div className={styles.generatedTags}>
                      {generatedDesign.motifs.map((motifId) => {
                        const motif = eventVisualMotifs.find((item) => item.id === motifId);
                        return <span key={motifId}>{motif?.label ?? motifId}</span>;
                      })}
                    </div>
                  </div>
                ) : null}

                {previewScreen === "ticket" ? (
                  <div className={styles.ticketPreviewStage}>
                    <div className={styles.ticketPreviewHero}>
                      <GeneratedTicketComposite
                        event={previewTicketModel.event}
                        ticketDesign={previewTicketModel.ticketDesign}
                        artworkUrl={previewTicketModel.artworkUrl}
                        viewport="desktop"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className={styles.financePreview}>
                <article>
                  <span>Boletos vendidos</span>
                  <strong>{draft.soldCount} / {draft.capacity}</strong>
                </article>
                <article>
                  <span>Gross cobrado</span>
                  <strong>{formatMoney(financialModel.soldGross)}</strong>
                </article>
                <article>
                  <span>Neto venue</span>
                  <strong>{formatMoney(financialModel.venueNetBeforeProcessor)}</strong>
                </article>
                <article>
                  <span>Template ticket</span>
                  <strong>{ticketTemplateMeta[generatedTicketDesign.templateId].title}</strong>
                </article>
              </div>
            </section>
            </div>
            ) : null}
          </div>
        </section>
      </section>
      {posterDeleteTarget ? (
        <div className={styles.posterDeleteModalWrap} role="dialog" aria-modal="true" aria-labelledby="poster-delete-title">
          <div className={styles.posterDeleteModalBackdrop} onClick={() => setPosterDeleteTarget(null)} />
          <section className={styles.posterDeleteModal}>
            <span>Eliminar variante</span>
            <h3 id="poster-delete-title">{posterDeleteTarget.label}</h3>
            <p>Esta acción quita la variante de la galería de arte del evento. Si guardas después, el cambio se persiste y el draft desaparece del estudio.</p>
            <div className={styles.posterDeleteModalActions}>
              <button type="button" className={styles.previewLink} onClick={() => setPosterDeleteTarget(null)}>
                Cancelar
              </button>
              <button type="button" className={styles.deleteButton} onClick={confirmPosterRevisionDelete}>
                Eliminar variante
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {overlayEditorOpen ? (
        <div
          className={styles.overlayEditorModalWrap}
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-editor-title"
          data-testid="overlay-editor-modal"
        >
          <div
            className={styles.overlayEditorModalBackdrop}
            onClick={() => setOverlayEditorOpen(false)}
          />
          <section className={styles.overlayEditorModal}>
            <div className={styles.overlayEditorModalHeader}>
              <div>
                <span>Mini editor de overlay</span>
                <h3 id="overlay-editor-title">Acomoda la información encima del poster</h3>
                <p>
                  Cambia formato, posición, densidad y presencia de las tarjetas. Cada viewport se edita por
                  separado para que mobile, tablet y desktop tengan su propio acomodo.
                </p>
              </div>
              <button type="button" className={styles.previewLink} onClick={() => setOverlayEditorOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className={styles.overlayEditorModalBody}>
              <div className={styles.overlayEditorModalColumn}>
                <section className={styles.overlayEditorPreviewSection}>
                  <div className={styles.sectionHeading}>
                    <strong>Preview visual con drag and drop</strong>
                    <small>Arrastra los bloques sobre la pieza. Cada viewport guarda su propio acomodo real en desktop, tablet y mobile.</small>
                  </div>
                  <div className={styles.overlayEditorViewportSwitch}>
                    {(["desktop", "tablet", "mobile"] as const).map((viewportId) => {
                      const active = overlayEditorViewport === viewportId;
                      const viewportLabel = overlayEditorViewportMeta[viewportId].label;
                      return (
                        <button
                          key={viewportId}
                          type="button"
                          className={active ? styles.overlayInlineButtonActive : styles.overlayInlineButton}
                          onClick={() => setOverlayEditorViewport(viewportId)}
                          aria-pressed={active}
                        >
                          {viewportLabel}
                        </button>
                      );
                    })}
                  </div>
                  {activePreviewPosterUrl ? (
                    <div className={styles.overlayEditorPreviewStage}>
                      <div
                        className={styles.generatedViewportStage}
                        style={
                          {
                            "--preview-width": selectedOverlayViewportMeta.width,
                            "--preview-height": selectedOverlayViewportMeta.height,
                            "--preview-scale": String(selectedOverlayViewportMeta.scale),
                          } as CSSProperties
                        }
                      >
                        <div
                          ref={overlayEditorPreviewRef}
                          data-editor-viewport={overlayEditorViewport}
                          data-testid={`overlay-editor-preview-${overlayEditorViewport}`}
                          className={`${styles.generatedViewportFrame} ${styles.overlayEditorPreviewFrame} ${styles[`generatedViewportFrame${overlayEditorViewport === "mobile" ? "Mobile" : overlayEditorViewport === "tablet" ? "Tablet" : "Desktop"}`]}`}
                        >
                          <div className={styles.generatedViewportCanvas}>
                            {renderPosterViewportComposite(overlayEditorViewport, activePreviewPosterUrl, {
                              editorMode: true,
                              selectedRole: activeOverlayRole,
                              selectedLayer: activeOverlayLayer,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.overlayEditorPreviewEmpty}>
                      <strong>Primero activa un poster real.</strong>
                      <p>Sube uno propio, genera una variante local o carga una revisión desde la biblioteca para editar el overlay visualmente.</p>
                    </div>
                  )}
                </section>

                <section className={styles.overlayEditorSection}>
                  <div className={styles.sectionHeading}>
                    <strong>Formato base del overlay</strong>
                    <small>Escoge cómo se reparte la información sobre la pieza antes de afinar posición o densidad.</small>
                  </div>
                  <div className={styles.optionGrid}>
                    {uploadOverlayOptions.map((option) => {
                      const active = effectivePosterTextOverlayMode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={active ? styles.optionCardActive : styles.optionCard}
                          onClick={() => {
                            if (designSourceMode === "upload") {
                              setUploadTextOverlayMode(option.id);
                              updateDraft("posterArtDirection", `Uploaded poster with ${option.id} overlay`);
                            }

                            updateDraft("posterTextOverlayMode", option.id);
                            setPreviewScreen("preview");
                          }}
                          aria-pressed={active}
                        >
                          <strong>{option.title}</strong>
                          <small>{option.detail}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.overlayEditorSection}>
                  <div className={styles.sectionHeading}>
                    <strong>Posiciona cada bloque</strong>
                    <small>La idea es que el headline, lineup y CTA respiren distinto sin pelearse con el arte.</small>
                  </div>
                  <div className={styles.overlayAnchorPanelGrid}>
                    {[
                      { key: "heroAnchor", label: "Headline", value: currentPosterOverlayLayout.heroAnchor },
                      { key: "lineupAnchor", label: "Lineup", value: currentPosterOverlayLayout.lineupAnchor },
                      { key: "actionAnchor", label: "Acción y horarios", value: currentPosterOverlayLayout.actionAnchor },
                      { key: "storyAnchor", label: "Historia", value: currentPosterOverlayLayout.storyAnchor },
                    ].map((control) => (
                      <article key={control.key} className={styles.overlayAnchorCard}>
                        <span>{control.label}</span>
                        <div className={styles.overlayAnchorGrid}>
                          {posterOverlayAnchorOptions.map((anchor) => {
                            const active = control.value === anchor.id;
                            return (
                              <button
                                key={`${control.key}-${anchor.id}`}
                                type="button"
                                className={active ? styles.overlayAnchorButtonActive : styles.overlayAnchorButton}
                                onClick={() =>
                                  updatePosterOverlayLayout({
                                    [control.key]: anchor.id,
                                  } as Partial<PosterOverlayLayout>)
                                }
                                aria-pressed={active}
                                title={anchor.label}
                              >
                                {anchor.label}
                              </button>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <div className={styles.overlayEditorModalColumn}>
                <section className={styles.overlayEditorSection}>
                  <div className={styles.sectionHeading}>
                    <strong>Ritmo visual</strong>
                    <small>Estos controles ajustan la sensación editorial sin destruir contraste ni legibilidad.</small>
                  </div>
                  <div className={styles.overlayControlStack}>
                    <article className={styles.overlayControlCard}>
                      <span>Elemento seleccionado</span>
                      <div className={styles.overlayInlineButtons}>
                        {overlayEditorGuideBlocks.map((block) => {
                          const active = activeOverlayRole === block.role;
                          return (
                            <button
                              key={block.role}
                              type="button"
                              className={active ? styles.overlayInlineButtonActive : styles.overlayInlineButton}
                              onClick={() => setOverlayEditorRole(block.role)}
                              aria-pressed={active}
                            >
                              {block.label}
                            </button>
                          );
                        })}
                      </div>
                    </article>

                    <article className={styles.overlayControlCard}>
                      <span>Capa en edición</span>
                      <div className={styles.overlayInlineButtons}>
                        {([
                          { id: "inner", label: "Figura / card" },
                          { id: "outer", label: "Elemento completo" },
                        ] as const).map((layer) => {
                          const active = activeOverlayLayer === layer.id;
                          return (
                            <button
                              key={layer.id}
                              type="button"
                              className={active ? styles.overlayInlineButtonActive : styles.overlayInlineButton}
                              onClick={() => setOverlayEditorLayer(layer.id)}
                              aria-pressed={active}
                            >
                              {layer.label}
                            </button>
                          );
                        })}
                      </div>
                    </article>

                    <article className={styles.overlayControlCard}>
                      <span>Alineación del texto</span>
                      <div className={styles.overlayInlineButtons}>
                        {(["left", "center"] as const).map((alignment) => {
                          const active = currentPosterOverlayLayout.textAlign === alignment;
                          return (
                            <button
                              key={alignment}
                              type="button"
                              className={active ? styles.overlayInlineButtonActive : styles.overlayInlineButton}
                              onClick={() => updatePosterOverlayLayout({ textAlign: alignment })}
                              aria-pressed={active}
                            >
                              {alignment === "left" ? "Izquierda" : "Centro"}
                            </button>
                          );
                        })}
                      </div>
                    </article>

                    <article className={styles.overlayControlCard}>
                      <span>Tipografía</span>
                      <div className={styles.overlayTokenGrid}>
                        {posterOverlayTypographyOptions.map((option) => {
                          const active = currentPosterOverlayLayout.typographyStyle === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={active ? styles.overlayTokenActive : styles.overlayToken}
                              onClick={() => updatePosterOverlayLayout({ typographyStyle: option.id })}
                              aria-pressed={active}
                            >
                              <strong>{option.label}</strong>
                              <small>{option.detail}</small>
                            </button>
                          );
                        })}
                      </div>
                    </article>

                    <article className={styles.overlayControlCard}>
                      <span>Densidad</span>
                      <div className={styles.overlayTokenGrid}>
                        {posterOverlayDensityOptions.map((option) => {
                          const active = currentPosterOverlayLayout.density === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={active ? styles.overlayTokenActive : styles.overlayToken}
                              onClick={() => updatePosterOverlayLayout({ density: option.id })}
                              aria-pressed={active}
                            >
                              <strong>{option.label}</strong>
                              <small>{option.detail}</small>
                            </button>
                          );
                        })}
                      </div>
                    </article>

                    <article className={styles.overlayControlCard}>
                      <span>Estilo de tarjeta</span>
                      <div className={styles.overlayTokenGrid}>
                        {posterOverlayCardStyleOptions.map((option) => {
                          const active = currentPosterOverlayLayout.cardStyle === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={active ? styles.overlayTokenActive : styles.overlayToken}
                              onClick={() => updatePosterOverlayLayout({ cardStyle: option.id })}
                              aria-pressed={active}
                            >
                              <strong>{option.label}</strong>
                              <small>{option.detail}</small>
                            </button>
                          );
                        })}
                      </div>
                    </article>

                    <article className={styles.overlaySliderCard}>
                      <label>
                        <span>{activeOverlayLayer === "outer" ? "Escala del elemento completo" : "Escala de la figura o card"}</span>
                        <strong>
                          {formatOverlayScalePairLabel(
                            activeOverlayLayer === "outer"
                              ? getOverlayRoleScalePair(activeOverlayRole)
                              : getOverlayRoleBoxScalePair(activeOverlayRole),
                          )}
                        </strong>
                      </label>
                      <input
                        type="range"
                        min={String(posterOverlayScaleMin)}
                        max={String(posterOverlayScaleMax)}
                        step="0.02"
                        value={
                          activeOverlayLayer === "outer"
                            ? getOverlayRoleScale(activeOverlayRole)
                            : getOverlayRoleBoxScale(activeOverlayRole)
                        }
                        onChange={(event) =>
                          updatePosterOverlayLayout(
                            activeOverlayLayer === "outer"
                              ? getOverlayRoleScalePatch(activeOverlayRole, Number(event.target.value))
                              : getOverlayRoleBoxScalePatch(activeOverlayRole, Number(event.target.value)),
                          )
                        }
                      />
                    </article>

                    <article className={styles.overlaySliderCard}>
                      <label>
                        <span>Opacidad del elemento activo</span>
                        <strong>{Math.round(getOverlayRoleOpacity(activeOverlayRole) * 100)}%</strong>
                      </label>
                      <input
                        type="range"
                        min="0.2"
                        max="1"
                        step="0.02"
                        value={getOverlayRoleOpacity(activeOverlayRole)}
                        onChange={(event) =>
                          updatePosterOverlayLayout(
                            getOverlayRoleOpacityPatch(activeOverlayRole, Number(event.target.value)),
                          )
                        }
                      />
                    </article>

                    <article className={styles.overlaySliderCard}>
                      <label>
                        <span>Escala tipográfica</span>
                        <strong>{Math.round(currentPosterOverlayLayout.fontScale * 100)}%</strong>
                      </label>
                      <input
                        type="range"
                        min="0.84"
                        max="1.22"
                        step="0.02"
                        value={currentPosterOverlayLayout.fontScale}
                        onChange={(event) => updatePosterOverlayLayout({ fontScale: Number(event.target.value) })}
                      />
                    </article>

                    <article className={styles.overlaySliderCard}>
                      <label>
                        <span>Escala de elementos</span>
                        <strong>{Math.round(currentPosterOverlayLayout.elementScale * 100)}%</strong>
                      </label>
                      <input
                        type="range"
                        min="0.8"
                        max="1.22"
                        step="0.02"
                        value={currentPosterOverlayLayout.elementScale}
                        onChange={(event) => updatePosterOverlayLayout({ elementScale: Number(event.target.value) })}
                      />
                    </article>

                    <article className={styles.overlaySliderCard}>
                      <label>
                        <span>Escala de tarjetas</span>
                        <strong>{Math.round(currentPosterOverlayLayout.cardScale * 100)}%</strong>
                      </label>
                      <input
                        type="range"
                        min="0.76"
                        max="1.12"
                        step="0.02"
                        value={currentPosterOverlayLayout.cardScale}
                        onChange={(event) => updatePosterOverlayLayout({ cardScale: Number(event.target.value) })}
                      />
                    </article>
                  </div>
                </section>

                <section className={styles.overlayEditorNote}>
                  <strong>Brief del PM para el renderer</strong>
                  <p>
                    Ningún bloque debe tapar arte por inercia. Si una combinación satura mobile, el sistema debe
                    compactar antes de cortar texto; si el fondo pierde contraste, la tarjeta debe protegerlo sin volverse
                    un rectángulo torpe.
                  </p>
                </section>
              </div>
            </div>

            <div className={styles.overlayEditorModalFooter}>
              <small>Los cambios se guardan junto con la variante activa del evento.</small>
              <div className={styles.overlayEditorCalloutActions}>
                <button
                  type="button"
                  className={styles.previewLink}
                  onClick={() => updatePosterOverlayLayout(defaultPosterOverlayLayout)}
                >
                  Restablecer todo
                </button>
                <button type="button" className={styles.saveButton} onClick={() => setOverlayEditorOpen(false)}>
                  Seguir revisando
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {quickStartOpen ? (
        <div className={styles.quickStartOverlay} data-testid="quick-start-overlay">
          <div className={styles.quickStartBackdrop} />
          <section className={styles.quickStartCard} data-testid="quick-start-card">
            <div className={styles.quickStartHeader}>
              <div>
                <span>Paso {quickStartStep + 1}/3</span>
                <strong>{quickStartStep + 1} de 3</strong>
              </div>
              <button type="button" className={styles.previewLink} onClick={dismissQuickStartToFullEditor}>
                Editar todos los detalles
              </button>
            </div>
            <div className={styles.quickStartProgressTrack}>
              <div
                className={styles.quickStartProgressFill}
                style={{ width: `${((quickStartStep + 1) / 3) * 100}%` }}
              />
            </div>

            {quickStartStep === 0 ? (
              <div className={styles.quickStartBody}>
                <h2>¿Cómo se llama el evento?</h2>
                <input
                  autoFocus
                  className={styles.quickStartInput}
                  value={quickStartTitle}
                  placeholder="Ej: Midnight Cumbia Systems"
                  data-testid="quick-start-title-input"
                  onChange={(event) => setQuickStartTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      advanceQuickStart();
                    }
                  }}
                />
              </div>
            ) : null}

            {quickStartStep === 1 ? (
              <div className={styles.quickStartBody}>
                <h2>¿Cuándo y dónde?</h2>
                <div className={styles.quickStartSplit}>
                  <input
                    autoFocus
                    className={styles.quickStartInput}
                    type="datetime-local"
                    value={quickStartStartsAt}
                    data-testid="quick-start-starts-at-input"
                    onChange={(event) => setQuickStartStartsAt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        advanceQuickStart();
                      }
                    }}
                  />
                  <input
                    className={styles.quickStartInput}
                    value={quickStartVenue}
                    placeholder="Ej: Foro GDL"
                    data-testid="quick-start-venue-input"
                    onChange={(event) => setQuickStartVenue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        advanceQuickStart();
                      }
                    }}
                  />
                </div>
              </div>
            ) : null}

            {quickStartStep === 2 ? (
              <div className={styles.quickStartBody}>
                <h2>¿Quién toca?</h2>
                <input
                  autoFocus
                  className={styles.quickStartInput}
                  value={quickStartLineup}
                  placeholder="Ej: La Sonora Pixel, DJ Nopal, Brass After Dark"
                  data-testid="quick-start-lineup-input"
                  onChange={(event) => setQuickStartLineup(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      advanceQuickStart();
                    }
                  }}
                />
              </div>
            ) : null}

            <div className={styles.quickStartFooter}>
              <button
                type="button"
                className={styles.previewLink}
                onClick={() => setQuickStartStep((current) => (current === 0 ? current : ((current - 1) as 0 | 1 | 2)))}
                disabled={quickStartStep === 0}
              >
                Atrás
              </button>
              <button
                type="button"
                className={styles.saveButton}
                onClick={advanceQuickStart}
                data-testid="quick-start-next-button"
              >
                {quickStartStep === 2 ? "Empezar dirección visual →" : "Siguiente →"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
