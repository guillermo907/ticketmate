"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteEventAction, saveEventAction, type EventSaveState } from "@/app/actions/events";
import { renderPosterPage } from "@/components/events/poster-page-renderers";
import {
  buildPosterDesign,
  posterTemplateIds,
  type PosterTemplateId,
} from "@/lib/poster-designer";
import {
  eventVisualMotifs,
  getEventInviteStyle,
  type EventInviteStyleId,
  type EventOperationalMoment,
  type EventVisualMotifId,
  type PosterVisibleFieldId,
  type VenueEventRecord,
} from "@/lib/event-types";
import styles from "./venue-workspace.module.scss";

type VenueWorkspaceProps = {
  initialEvents: VenueEventRecord[];
};

type VenueEventDraft = VenueEventRecord;
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

function formatDesignerEventDate(dateValue: string) {
  return new Date(dateValue).toLocaleString("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
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
    designMotifs: event.designMotifs ?? [],
    posterVisibleFields: event.posterVisibleFields ?? posterFieldOptions.map((field) => field.id),
    posterArtDirection: event.posterArtDirection ?? "",
    posterReferenceUrls: event.posterReferenceUrls ?? [],
    posterAssetMode: event.posterAssetMode ?? "graphic-only",
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
    designMotifs: ["wave-lines", "ticket-stamp"],
    posterVisibleFields: posterFieldOptions.map((field) => field.id),
    posterArtDirection: "",
    posterReferenceUrls: [],
    posterAssetMode: "graphic-only",
    doorTime: doorTime.toISOString(),
    soundcheckTime: soundcheckTime.toISOString(),
    operationalMoments: [],
    ticketPriceMXN: 280,
    ticketFeeMXN: 15,
    artistPayoutRate: 0.7,
    capacity: 320,
    soldCount: 0,
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

export function VenueWorkspace({ initialEvents }: VenueWorkspaceProps) {
  const safeEvents = useMemo(() => (Array.isArray(initialEvents) ? initialEvents : []), [initialEvents]);
  const router = useRouter();
  const [emptyDraft] = useState(() => createEmptyDraft());
  const [selectedId, setSelectedId] = useState(safeEvents[0]?.id ?? "new");
  const [draft, setDraft] = useState<VenueEventDraft>(() =>
    safeEvents[0] ? normalizeDraftRecord(safeEvents[0]) : emptyDraft,
  );
  const [pendingHeroPreview, setPendingHeroPreview] = useState("");
  const [pendingHeroFileName, setPendingHeroFileName] = useState("");
  const [previewScreen, setPreviewScreen] = useState<"preview" | "story" | "ticket">("preview");
  const [designWizardStep, setDesignWizardStep] = useState<0 | 1 | 2>(0);
  const [maxUnlockedWizardStep, setMaxUnlockedWizardStep] = useState<0 | 1 | 2>(0);
  const [designSourceMode, setDesignSourceMode] = useState<"local" | "ai">("local");
  const [selectedIdeaPreset, setSelectedIdeaPreset] = useState<(typeof posterIdeaPresets)[number]["id"]>(
    posterIdeaPresets[0].id,
  );
  const [aiDirectionNote, setAiDirectionNote] = useState("");
  const [aiProposals, setAiProposals] = useState<PosterAiProposal[]>([]);
  const [aiGenerationId, setAiGenerationId] = useState("");
  const [selectedAiProposalId, setSelectedAiProposalId] = useState<number | null>(null);
  const [appliedAiProposalId, setAppliedAiProposalId] = useState<number | null>(null);
  const [lastAiGenerationSignature, setLastAiGenerationSignature] = useState("");
  const [aiStatus, setAiStatus] = useState<{ loading: boolean; error: string }>({
    loading: false,
    error: "",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [saveState, saveAction, isSaving] = useActionState(saveEventAction, initialState);
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteEventAction, deleteInitialState);
  const transientAiUrlsRef = useRef<string[]>([]);
  const baselineDraft = useMemo(
    () => (selectedId === "new" ? emptyDraft : safeEvents.find((event) => event.id === selectedId) ?? emptyDraft),
    [emptyDraft, safeEvents, selectedId],
  );
  const hasUnsavedChanges =
    buildDraftFingerprint(draft) !== buildDraftFingerprint(baselineDraft) || Boolean(pendingHeroPreview);
  const previewDraft = useMemo(
    () => (pendingHeroPreview ? { ...draft, heroImage: pendingHeroPreview } : draft),
    [draft, pendingHeroPreview],
  );
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
  }, [cleanupAiPosterUrls, router, saveState.ok, saveState.savedEvent]);

  useEffect(() => {
    if (!deleteState.ok || !deleteState.deletedEventId) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(publicFeedCacheKey);
    }

    const timeoutId = window.setTimeout(() => {
      setDeleteConfirmation("");
      setSelectedId("new");
      setDraft(emptyDraft);
      setPendingHeroPreview("");
      setPendingHeroFileName("");
      setPreviewScreen("preview");
      setDesignWizardStep(0);
      setMaxUnlockedWizardStep(0);
      setDesignSourceMode("local");
      setAiDirectionNote("");
      setAiProposals([]);
      setSelectedAiProposalId(null);
      setAppliedAiProposalId(null);
      setLastAiGenerationSignature("");
      setAiStatus({ loading: false, error: "" });
    }, 0);

    router.refresh();
    return () => window.clearTimeout(timeoutId);
  }, [deleteState.deletedEventId, deleteState.ok, emptyDraft, router]);

  useEffect(() => {
    if (!saveState.ok) {
      return;
    }

    const persisted = saveState.savedEvent ?? safeEvents.find((event) => event.slug === saveState.slug);

    if (!persisted) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(persisted.id);
    setDraft(normalizeDraftRecord(persisted));
    setPendingHeroPreview("");
    setPendingHeroFileName("");
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(normalizeDraftRecord(refreshed));
    }
  }, [draft, hasUnsavedChanges, safeEvents, selectedId]);

  useEffect(() => {
    return () => {
      if (pendingHeroPreview) {
        URL.revokeObjectURL(pendingHeroPreview);
      }

      void cleanupAiPosterUrls(transientAiUrlsRef.current);
    };
  }, [cleanupAiPosterUrls, pendingHeroPreview]);

  const generatedDesign = useMemo(() => buildPosterDesign(previewDraft), [previewDraft]);
  const selectedStyle = useMemo(() => getEventInviteStyle(generatedDesign.variant), [generatedDesign.variant]);
  const visiblePosterFields = useMemo(
    () => (draft.posterVisibleFields?.length ? draft.posterVisibleFields : posterFieldOptions.map((field) => field.id)),
    [draft.posterVisibleFields],
  );
  const previewRelatedEvents = useMemo(
    () =>
      safeEvents
        .filter((event) => event.id !== draft.id && event.slug !== draft.slug)
        .slice(0, 3)
        .map((event) => ({ slug: event.slug, title: event.title })),
    [draft.id, draft.slug, safeEvents],
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
  const selectedPreset = useMemo(
    () => posterIdeaPresets.find((item) => item.id === selectedIdeaPreset) ?? posterIdeaPresets[0],
    [selectedIdeaPreset],
  );
  const deleteFormId = draft.id ? `delete-event-${draft.id}` : "delete-event";
  const stepMeta = wizardSteps[designWizardStep];
  const isFirstWizardStep = designWizardStep === 0;
  const isLastWizardStep = designWizardStep === wizardSteps.length - 1;
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
  const canAdvanceFromStep0 = Boolean(
    draft.title.trim() &&
      draft.summary.trim() &&
      draft.description.trim() &&
      draft.venueName.trim() &&
      draft.venueAddress.trim() &&
      (draft.lineup ?? []).length > 0 &&
      visiblePosterFields.length > 0,
  );
  const canAdvanceFromStep1 =
    designSourceMode === "local"
      ? Boolean(selectedPreset && (draft.designTemplateId ?? generatedDesign.templateId))
      : Boolean(hasAppliedSelectedAiProposal && aiProposalsAreCurrent && !aiStatus.loading);
  const canOpenReviewTabs = designWizardStep === 2;

  useEffect(() => {
    transientAiUrlsRef.current = aiProposals.map((proposal) => proposal.poster_url);
  }, [aiProposals]);

  function applyEvent(event: VenueEventRecord | null) {
    setDraft(event ? normalizeDraftRecord(event) : emptyDraft);
    setPendingHeroPreview("");
    setPendingHeroFileName("");
    setPreviewScreen("preview");
    setDesignWizardStep(0);
    setMaxUnlockedWizardStep(0);
    setDesignSourceMode("local");
    setAiDirectionNote("");
    setAiProposals([]);
    setAiGenerationId("");
    setSelectedAiProposalId(null);
    setAppliedAiProposalId(null);
    setLastAiGenerationSignature("");
    setAiStatus({ loading: false, error: "" });
  }

  function selectEvent(id: string) {
    void clearTransientAiWorkspace();
    setSelectedId(id);

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

  function updateLocalPhotoUsage(enabled: boolean) {
    updateDraft("posterAssetMode", enabled ? "uploaded-hero" : "graphic-only");
  }

  function switchDesignSourceMode(mode: "local" | "ai") {
    if (mode === "local" && designSourceMode === "ai") {
      void clearTransientAiWorkspace();
    }

    setDesignSourceMode(mode);
    setPreviewScreen("preview");
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

    if ((step === 1 || step === 2) && !canAdvanceFromStep0) {
      return;
    }

    if (step === 2 && !canAdvanceFromStep1) {
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

  function isWizardStepLocked(stepId: 0 | 1 | 2) {
    if (stepId > maxUnlockedWizardStep) {
      return true;
    }

    if (stepId === 0) {
      return false;
    }

    if (stepId === 1) {
      return !canAdvanceFromStep0;
    }

    return !canAdvanceFromStep0 || !canAdvanceFromStep1;
  }

  const resolvedSlug = saveState.slug ?? draft.slug;
  const publicHref = resolvedSlug ? `/events/${resolvedSlug}` : "";

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <p>Venue Console</p>
            <h1>Crea el evento y deja que el poster designer entregue la página lista al renderer.</h1>
            <span>
              Aquí el venue define contenido y operación. El sistema termina la dirección visual, la persiste como
              handoff y el sitio la traduce programáticamente cada vez que guardas un evento.
            </span>
          </div>
          <div className={styles.heroStats}>
            <article>
              <span>Eventos guardados</span>
              <strong>{safeEvents.length}</strong>
            </article>
            <article>
              <span>Designer states</span>
              <strong>Auto</strong>
            </article>
            <article>
              <span>Payout fee</span>
              <strong>1.5%</strong>
            </article>
          </div>
        </header>

        <section className={styles.workspaceLayout}>
          <aside className={styles.libraryPanel}>
            <div className={styles.panelHeader}>
              <p>Biblioteca</p>
              <h2>Eventos del venue</h2>
            </div>
            <button type="button" className={styles.createButton} onClick={() => selectEvent("new")}>
              Crear nuevo evento
            </button>
            <div className={styles.eventList}>
              {safeEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={selectedId === event.id ? styles.eventCardActive : styles.eventCard}
                  onClick={() => selectEvent(event.id)}
                >
                  <small className={styles.styleBadge}>{getEventInviteStyle(event.designVariant).shortLabel}</small>
                  <strong>{event.title}</strong>
                  <span>{new Date(event.startsAt).toLocaleString("es-MX", { dateStyle: "medium" })}</span>
                  <small>{event.isPublished ? "Publicado" : "Draft"}</small>
                </button>
              ))}
            </div>
          </aside>

          <div className={styles.editorColumn}>
            <form action={saveAction} className={styles.panel}>
              <div className={styles.panelHeader}>
                <p>Editor</p>
                <h2>{draft.id ? "Editar evento existente" : "Crear primer evento"}</h2>
              </div>

              <input type="hidden" name="id" value={draft.id} />
              <input type="hidden" name="slug" value={draft.slug} />
              <input type="hidden" name="heroImage" value={draft.heroImage} />
              <input type="hidden" name="designVariant" value={draft.designVariant ?? ""} />
              <input type="hidden" name="designMotifs" value={(draft.designMotifs ?? []).join(",")} />
              <input type="hidden" name="posterVisibleFields" value={visiblePosterFields.join(",")} />
              <input type="hidden" name="posterArtDirection" value={draft.posterArtDirection ?? ""} />
              <input type="hidden" name="posterReferenceUrls" value={(draft.posterReferenceUrls ?? []).join("\n")} />
              <input type="hidden" name="posterAssetMode" value={draft.posterAssetMode ?? "graphic-only"} />
              <input type="hidden" name="operationalMoments" value={JSON.stringify(draft.operationalMoments ?? [])} />

              <div className={styles.formSections}>
                <details className={styles.formSection} open>
                  <summary>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">◫</span>
                      <span>Datos base del evento</span>
                    </span>
                  </summary>
                  <div className={styles.sectionHintRibbon}>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">✎</span>
                      <strong>Identidad</strong>
                    </article>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">⌘</span>
                      <strong>Contexto</strong>
                    </article>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">◔</span>
                      <strong>SEO + poster</strong>
                    </article>
                  </div>
                  <div className={styles.formGrid}>
                    <label className={`${styles.fullWidth} ${styles.fieldCard} ${styles.fieldCardHero}`}>
                      <span className={styles.fieldLabel}>
                        <strong>Título</strong>
                        <small>Nombre principal que dominará la página y el poster.</small>
                      </span>
                      <input name="title" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.fieldCard}`}>
                      <span className={styles.fieldLabel}>
                        <strong>≈ Resumen corto</strong>
                        <small>Hook rápido para listings, previews y lectura inmediata.</small>
                      </span>
                      <input name="summary" value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.fieldCard} ${styles.fieldCardEditorial}`}>
                      <span className={styles.fieldLabel}>
                        <strong>¶ Descripción pública</strong>
                        <small>Contexto editorial para sitio, share cards y brief creativo.</small>
                      </span>
                      <textarea name="description" rows={5} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardVenue}`}>
                      <span className={styles.fieldLabel}>
                        <strong>⌂ Venue</strong>
                        <small>Lugar principal visible al público.</small>
                      </span>
                      <input name="venueName" value={draft.venueName} onChange={(event) => updateDraft("venueName", event.target.value)} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMeta}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◷ Timezone</strong>
                        <small>Controla fechas, horarios y consistencia de publicación.</small>
                      </span>
                      <input name="timezone" value={draft.timezone} onChange={(event) => updateDraft("timezone", event.target.value)} />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.fieldCard} ${styles.fieldCardVenue}`}>
                      <span className={styles.fieldLabel}>
                        <strong>⌖ Dirección</strong>
                        <small>Ubicación completa para mapa, CTA y texto obligatorio.</small>
                      </span>
                      <input name="venueAddress" value={draft.venueAddress} onChange={(event) => updateDraft("venueAddress", event.target.value)} />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.fieldCard} ${styles.fieldCardCast}`}>
                      <span className={styles.fieldLabel}>
                        <strong>♫ Lineup</strong>
                        <small>Separado por comas. Alimenta poster, landing y brief del diseñador.</small>
                      </span>
                      <input name="lineup" value={draft.lineup.join(", ")} onChange={(event) => updateDraft("lineup", splitCommaList(event.target.value))} />
                    </label>
                    <label className={`${styles.fullWidth} ${styles.fieldCard} ${styles.fieldCardMood}`}>
                      <span className={styles.fieldLabel}>
                        <strong>♬ Géneros</strong>
                        <small>Separado por comas. Ayuda a inferir mood, paleta y dirección visual.</small>
                      </span>
                      <input name="genre" value={draft.genre.join(", ")} onChange={(event) => updateDraft("genre", splitCommaList(event.target.value))} />
                    </label>
                  </div>
                </details>

                <details className={styles.formSection}>
                  <summary>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">◷</span>
                      <span>Horario y operación</span>
                    </span>
                  </summary>
                  <div className={styles.formGrid}>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMeta}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◷ Inicio</strong>
                        <small>Hora oficial de arranque visible en listing, poster y landing.</small>
                      </span>
                      <input type="datetime-local" name="startsAt" value={toDateTimeLocalValue(draft.startsAt)} onChange={(event) => updateDraft("startsAt", new Date(event.target.value).toISOString())} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardMeta}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◴ Fin</strong>
                        <small>Cierre programado del evento para operación y comunicación.</small>
                      </span>
                      <input type="datetime-local" name="endsAt" value={toDateTimeLocalValue(draft.endsAt)} onChange={(event) => updateDraft("endsAt", new Date(event.target.value).toISOString())} />
                    </label>
                    <div className={`${styles.fullWidth} ${styles.inlineSectionNote}`}>
                      <strong>Doors</strong>
                      <small>Sepáralo como momento operativo: define desde cuándo puede entrar la gente, aunque el show empiece después.</small>
                    </div>
                    <label className={`${styles.fieldCard} ${styles.fieldCardDoors}`}>
                      <span className={styles.fieldLabel}>
                        <strong>⟐ Doors</strong>
                        <small>Apertura de puertas. Úsalo para acceso, filas y timing de consumo.</small>
                      </span>
                      <input type="datetime-local" name="doorTime" value={toDateTimeLocalValue(draft.doorTime)} onChange={(event) => updateDraft("doorTime", new Date(event.target.value).toISOString())} />
                    </label>
                    <label className={`${styles.fieldCard} ${styles.fieldCardOps}`}>
                      <span className={styles.fieldLabel}>
                        <strong>◌ Soundcheck</strong>
                        <small>Referencia interna para producción, staff y coordinación del venue.</small>
                      </span>
                      <input type="datetime-local" name="soundcheckTime" value={toDateTimeLocalValue(draft.soundcheckTime)} onChange={(event) => updateDraft("soundcheckTime", new Date(event.target.value).toISOString())} />
                    </label>
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

                <details className={`${styles.formSection} ${styles.revenueSection}`}>
                  <summary>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">¤</span>
                      <span>Ticketing y publicación</span>
                    </span>
                  </summary>
                  <div className={styles.sectionHintRibbon}>
                    <article className={styles.infoChip}>
                      <span aria-hidden="true">$</span>
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
                        <strong>Publicar landing del evento</strong>
                        <small>Activa la versión pública del evento para que ya pueda circular y vender boletos.</small>
                      </span>
                    </label>
                  </div>
                </details>

                <details
                  className={`${styles.formSection} ${styles.designSection} ${
                    designSourceMode === "ai" ? styles.designSectionAiMode : styles.designSectionLocalMode
                  }`}
                  open
                >
                  <summary>
                    <span className={styles.summaryLabel}>
                      <span className={styles.summaryIcon} aria-hidden="true">✦</span>
                      <span>Dirección visual</span>
                    </span>
                  </summary>
                  <div className={styles.wizardHeader}>
                    {wizardSteps.map((step) => {
                      const isCurrent = designWizardStep === step.id;
                      const isComplete = !isCurrent && maxUnlockedWizardStep > step.id;

                      return (
                        <button
                          key={step.id}
                          type="button"
                          className={isCurrent ? styles.wizardStepActive : isComplete ? styles.wizardStepComplete : styles.wizardStep}
                          onClick={() => goToWizardStep(step.id)}
                          disabled={isWizardStepLocked(step.id)}
                          aria-current={isCurrent ? "step" : undefined}
                        >
                          <span>{step.eyebrow}</span>
                          <strong>{step.title}</strong>
                          <small className={isCurrent ? styles.wizardStateCurrent : isComplete ? styles.wizardStateComplete : styles.wizardStatePending}>
                            {isCurrent ? "Actual" : isComplete ? "Completo" : "Pendiente"}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.wizardStepTitle}>
                    <span>{stepMeta.eyebrow}</span>
                    <strong>{stepMeta.title}</strong>
                    <small>{designWizardStep + 1} de {wizardSteps.length}</small>
                  </div>

                  {designWizardStep === 0 ? (
                    <div className={styles.wizardSlide}>
                      <div className={styles.sectionHeading}>
                        <span>Pantalla 1</span>
                        <strong>Define el contenido base que el poster puede mostrar</strong>
                        <small>Desde aquí puedes editar datos y ocultar partes del evento para que no entren al poster.</small>
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
                      <div className={styles.formGrid}>
                        <label className={styles.fullWidth}>
                          <span>Título del evento</span>
                          <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
                        </label>
                        <label className={styles.fullWidth}>
                          <span>Resumen para poster</span>
                          <input value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} />
                        </label>
                        <label className={styles.fullWidth}>
                          <span>Descripción editorial</span>
                          <textarea rows={4} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
                        </label>
                        <label>
                          <span>Fecha y hora</span>
                          <input
                            type="datetime-local"
                            value={toDateTimeLocalValue(draft.startsAt)}
                            onChange={(event) => updateDraft("startsAt", new Date(event.target.value).toISOString())}
                          />
                        </label>
                        <label>
                          <span>Venue</span>
                          <input value={draft.venueName} onChange={(event) => updateDraft("venueName", event.target.value)} />
                        </label>
                        <label className={styles.fullWidth}>
                          <span>Dirección</span>
                          <input value={draft.venueAddress} onChange={(event) => updateDraft("venueAddress", event.target.value)} />
                        </label>
                        <label className={styles.fullWidth}>
                          <span>Lineup</span>
                          <input
                            value={(draft.lineup ?? []).join(", ")}
                            onChange={(event) => updateDraft("lineup", splitCommaList(event.target.value))}
                          />
                        </label>
                        <label className={styles.fullWidth}>
                          <span>Genero o mood</span>
                          <input
                            value={(draft.genre ?? []).join(", ")}
                            onChange={(event) => updateDraft("genre", splitCommaList(event.target.value))}
                          />
                        </label>
                      </div>
                      <div className={styles.selectionHint}>
                        <strong>Bloques del poster</strong>
                        <p>Haz click para encender o apagar cada bloque. Cuando está activo, ese dato sí puede entrar en el diseño del poster.</p>
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
                            >
                              <span className={styles.toggleState}>{active ? "ON" : "OFF"}</span>
                              <strong>{field.label}</strong>
                              <small>{field.hint}</small>
                            </button>
                          );
                        })}
                      </div>
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
                      <div className={styles.sectionHeading}>
                        <span>Pantalla 2</span>
                        <strong>Escoge cómo generar la dirección visual del poster</strong>
                        <small>Local configura el sistema interno del sitio; IA redacta un brief y genera propuestas editoriales externas.</small>
                      </div>
                      <div className={styles.wizardOverview}>
                        <article>
                          <span>Modo</span>
                          <strong>{designSourceMode === "local" ? "Local" : "IA"}</strong>
                        </article>
                        <article>
                          <span>{designSourceMode === "local" ? "Ruta local" : "Brief editorial"}</span>
                          <strong>{designSourceMode === "local" ? selectedPreset.title : `${aiProposals.length || 0} propuestas recibidas`}</strong>
                        </article>
                        <article>
                          <span>Qué hace esto</span>
                          <strong>{designSourceMode === "local" ? "Configura el renderer interno del poster" : "Envía un brief al diseñador externo para generar propuestas"}</strong>
                        </article>
                      </div>
                      <div className={styles.wizardPrompt}>
                        <strong>Pregunta guía</strong>
                        <p>¿Qué tipo de historia debería contar este poster y quién la va a producir?</p>
                      </div>
                      <div className={styles.sourceModeSwitch}>
                        <button type="button" className={designSourceMode === "local" ? styles.sourceModeActive : styles.sourceModeButton} onClick={() => switchDesignSourceMode("local")}>
                          <span>Local</span>
                          <strong>Sistema interno del sitio</strong>
                        </button>
                        <button type="button" className={designSourceMode === "ai" ? styles.sourceModeActive : styles.sourceModeButton} onClick={() => switchDesignSourceMode("ai")}>
                          <span>IA</span>
                          <strong>Consulta al diseñador externo</strong>
                        </button>
                      </div>

                      {designSourceMode === "local" ? (
                        <div className={styles.generatedBody}>
                          <div className={styles.selectionHint}>
                            <strong>Ruta local</strong>
                            <p>Selecciona una dirección del sistema interno. Esto cambia el tono, el renderer y la composición base del poster local.</p>
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
                          <p>La ruta local genera una sola dirección consistente desde la idea elegida. Aquí solo decides si el poster usa sistema gráfico puro o si incorpora foto del venue.</p>
                          <label className={styles.photoToggleCard}>
                            <input
                              type="checkbox"
                              checked={(draft.posterAssetMode ?? "graphic-only") === "uploaded-hero"}
                              onChange={(event) => updateLocalPhotoUsage(event.target.checked)}
                            />
                            <div>
                              <strong>Incluir foto en el poster local</strong>
                              <p>
                                Si activas esta opción, el sistema usará la imagen subida por el usuario y la recortará/normalizará para integrarla al layout del poster.
                              </p>
                            </div>
                          </label>
                          {(draft.posterAssetMode ?? "graphic-only") === "uploaded-hero" ? (
                            <label className={styles.fullWidth}>
                              <span>Foto propia para el poster local</span>
                              <input type="file" name="heroImageFile" accept="image/*" onChange={handleHeroFileChange} />
                              <small className={styles.inlineHint}>
                                La imagen se ajusta y recorta automáticamente para la composición local del poster.
                              </small>
                            </label>
                          ) : null}
                        </div>
                      ) : (
                        <div className={styles.generatedBody}>
                          <div className={styles.selectionHint}>
                            <strong>Flujo guiado IA</strong>
                            <p>Primero escribe una sola frase. Luego el sistema la convierte en un brief editorial estructurado, arma un prompt maestro y con ese mismo prompt genera todas las propuestas que devuelva el diseñador para que elijas una.</p>
                          </div>
                          <div className={styles.formGrid}>
                            <label className={styles.fullWidth}>
                              <span>Frase del usuario para orientar a la IA</span>
                              <textarea
                                rows={3}
                                value={aiDirectionNote}
                                onChange={(event) => setAiDirectionNote(event.target.value)}
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
                      )}

                      <div className={styles.wizardActions}>
                        <button type="button" className={styles.previewLink} onClick={goToPreviousWizardStep}>
                          Atrás
                        </button>
                        <button type="button" className={styles.saveButton} onClick={goToNextWizardStep} disabled={!canAdvanceFromStep1}>
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {designWizardStep === 2 ? (
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
                </details>

                <details className={styles.formSection}>
                  <summary>
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
              </div>

              <div className={styles.editorFooter}>
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
                  {publicHref && draft.isPublished ? (
                    <Link href={publicHref} className={styles.previewLink}>
                      Ver sitio publicado
                    </Link>
                  ) : null}
                  <button type="submit" className={styles.saveButton} disabled={isSaving}>
                    {isSaving ? "Guardando..." : draft.isPublished ? "Guardar y publicar" : "Guardar draft"}
                  </button>
                </div>
                {draft.id && deleteState.ok === false && deleteState.message ? (
                  <small className={styles.deleteHint}>{deleteState.message}</small>
                ) : null}
              </div>
            </form>
            {draft.id ? (
              <form id={deleteFormId} action={deleteAction} className={styles.hiddenDeleteForm}>
                <input type="hidden" name="id" value={draft.id} />
                <input type="hidden" name="slug" value={draft.slug} />
                <input type="hidden" name="title" value={draft.title} />
                <input type="hidden" name="deleteConfirmation" value={deleteConfirmation} />
              </form>
            ) : null}

            <section className={styles.previewPanel}>
              <div className={styles.panelHeader}>
                <p>Preview</p>
                <h2>Preview lateral fijo del flujo y del poster</h2>
              </div>

              <div className={styles.previewToolbar}>
                <div className={styles.previewSwitch}>
                  <button type="button" className={previewScreen === "preview" ? styles.previewTabActive : styles.previewTab} onClick={() => setPreviewScreen("preview")}>
                    Preview
                  </button>
                  <button
                    type="button"
                    className={previewScreen === "story" ? styles.previewTabActive : styles.previewTab}
                    onClick={() => setPreviewScreen("story")}
                    disabled={!canOpenReviewTabs}
                  >
                    Story
                  </button>
                  <button
                    type="button"
                    className={previewScreen === "ticket" ? styles.previewTabActive : styles.previewTab}
                    onClick={() => setPreviewScreen("ticket")}
                    disabled={!canOpenReviewTabs}
                  >
                    Ticket
                  </button>
                </div>
              </div>

              <div className={styles.previewBody}>
                {previewScreen === "preview" ? (
                  designWizardStep === 0 ? (
                    <div className={styles.previewPlaceholder}>
                      <strong>El poster se desbloquea en el paso de dirección.</strong>
                      <p>Primero define el contenido del evento. Cuando avances al paso 2, aquí aparecerán las opciones del poster local o las propuestas generadas por IA.</p>
                    </div>
                  ) : designSourceMode === "ai" ? (
                    aiStatus.loading ? (
                      <div className={styles.previewPlaceholder}>
                        <strong>Generando propuestas IA...</strong>
                        <p>El diseñador externo está construyendo opciones editoriales. Cuando termine, verás aquí todas las propuestas devueltas por el servicio para compararlas y elegir una.</p>
                        <div className={styles.progressBarTrack}>
                          <div className={styles.progressBarFill} />
                        </div>
                      </div>
                    ) : aiProposals.length === 0 ? (
                      <div className={styles.previewPlaceholder}>
                        <strong>Aún no hay posters IA cargados.</strong>
                        <p>Configura el brief y usa “Generar propuestas IA”. Después podrás revisar aquí todas las propuestas devueltas por el diseñador y decidir cuál aplicar.</p>
                      </div>
                    ) : (
                      <div className={styles.aiPreviewStage}>
                        <div className={styles.aiPreviewOptionGrid}>
                          {aiProposals.map((proposal, index) => {
                            const active = proposal.proposal_id === selectedAiProposal?.proposal_id;
                            return (
                              <button
                                key={proposal.proposal_id}
                                type="button"
                                className={active ? styles.aiPreviewOptionActive : styles.aiPreviewOption}
                                onClick={() => setSelectedAiProposalId(proposal.proposal_id)}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={proposal.poster_url} alt={proposal.style_title} className={styles.aiPreviewOptionImage} />
                                <span>Opción {index + 1}</span>
                                <strong>{proposal.style_title}</strong>
                                {typeof proposal.total_score === "number" ? <small>{proposal.total_score.toFixed(1)}/10</small> : null}
                              </button>
                            );
                          })}
                        </div>
                        {selectedAiProposal ? (
                          <>
                            <div className={styles.aiPosterFrame}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={selectedAiProposal.poster_url}
                                alt={selectedAiProposal.style_title}
                                className={styles.aiPosterImage}
                              />
                            </div>
                            <div className={styles.generatedBody}>
                              <strong>{selectedAiProposal.style_title}</strong>
                              <div className={styles.aiSelectedMeta}>
                                {selectedAiProposal.rank ? <span className={styles.aiProposalRank}>#{selectedAiProposal.rank}</span> : null}
                                {selectedAiProposal.recommendation_label ? <span className={styles.aiProposalBadge}>{selectedAiProposal.recommendation_label}</span> : null}
                                {typeof selectedAiProposal.total_score === "number" ? <span className={styles.aiProposalScore}>{selectedAiProposal.total_score.toFixed(1)}/10</span> : null}
                              </div>
                              <p>{selectedAiProposal.design_storytelling}</p>
                              {selectedAiProposal.summary ? <small className={styles.aiSelectedSummary}>{selectedAiProposal.summary}</small> : null}
                              {selectedAiProposal.target_genres?.length ? (
                                <div className={styles.aiTagRow}>
                                  {selectedAiProposal.target_genres.map((genre) => (
                                    <span key={genre} className={styles.aiTag}>
                                      {genre}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {selectedAiProposal.warnings?.length ? (
                                <div className={styles.aiWarningList}>
                                  {selectedAiProposal.warnings.map((warning) => (
                                    <small key={warning}>{warning}</small>
                                  ))}
                                </div>
                              ) : null}
                              <small>{hasAppliedSelectedAiProposal ? "Esta propuesta ya fue aplicada al handoff del evento." : "Selecciona y aplica esta propuesta para desbloquear el siguiente paso."}</small>
                            </div>
                            <div className={styles.wizardActions}>
                              <button type="button" className={styles.saveButton} onClick={applySelectedAiProposal}>
                                Usar esta propuesta
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )
                  ) : (
                    <div className={styles.viewportPreviewGrid}>
                      {[
                        { label: "Desktop", width: "1120px", height: "720px", scale: 0.24 },
                        { label: "Tablet", width: "820px", height: "1024px", scale: 0.22 },
                        { label: "Mobile", width: "420px", height: "860px", scale: 0.32 },
                      ].map((viewport) => (
                        <article key={viewport.label} className={styles.viewportCard}>
                          <div className={styles.viewportCardHeader}>
                            <span>{viewport.label}</span>
                            <strong>
                              {viewport.width.replace("px", "")} × {viewport.height.replace("px", "")}
                            </strong>
                          </div>
                          <div
                            className={styles.viewportStage}
                            style={
                              {
                                "--preview-width": viewport.width,
                                "--preview-height": viewport.height,
                                "--preview-scale": String(viewport.scale),
                              } as CSSProperties
                            }
                          >
                            <div className={styles.viewportFrame}>
                              <div className={styles.livePosterCanvasViewport}>
                                {renderPosterPage(previewDraft, generatedDesign, previewRelatedEvents)}
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )
                ) : null}

                {previewScreen === "story" ? (
                  <>
                    <div className={styles.generatedMeta}>
                      <article>
                        <span>Variante</span>
                        <strong>{selectedStyle.label}</strong>
                      </article>
                      <article>
                        <span>Template</span>
                        <strong>{generatedDesign.templateId}</strong>
                      </article>
                      <article>
                        <span>Slug</span>
                        <strong>{resolvedSlug || "(se genera al guardar)"}</strong>
                      </article>
                      <article>
                        <span>Renderer</span>
                        <strong>{generatedDesign.rendererId}</strong>
                      </article>
                    </div>
                    <div className={styles.generatedBody}>
                      <p>{generatedDesign.narrative.manifesto}</p>
                      <div className={styles.generatedTags}>
                        {generatedDesign.motifs.map((motifId) => {
                          const motif = eventVisualMotifs.find((item) => item.id === motifId);
                          return <span key={motifId}>{motif?.label ?? motifId}</span>;
                        })}
                      </div>
                      <div className={styles.generatedTags}>
                        {generatedDesign.handoff.assetPlan.map((asset) => (
                          <span key={`${asset.sourceId}-${asset.role}`}>{asset.sourceId}: {asset.role}</span>
                        ))}
                      </div>
                      {aiProposals.length > 0 ? (
                        <div className={styles.aiPreviewLinks}>
                          {aiProposals.map((proposal) => (
                            <a key={proposal.proposal_id} href={proposal.poster_url} target="_blank" rel="noreferrer">
                              {proposal.style_title}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {previewScreen === "ticket" ? (
                  <div className={styles.financePreview}>
                    <article>
                      <span>Info visible</span>
                      <strong>{visiblePosterFields.map((field) => posterFieldOptions.find((item) => item.id === field)?.label).filter(Boolean).join(", ")}</strong>
                    </article>
                    <article>
                      <span>Gross cobrado</span>
                      <strong>{formatMoney(financialModel.soldGross)}</strong>
                    </article>
                    <article>
                      <span>Fee plataforma</span>
                      <strong>{formatMoney(financialModel.platformFees)}</strong>
                    </article>
                    <article>
                      <span>Neto artista</span>
                      <strong>{formatMoney(financialModel.artistNet)}</strong>
                    </article>
                    <article>
                      <span>Neto venue</span>
                      <strong>{formatMoney(financialModel.venueNetBeforeProcessor)}</strong>
                    </article>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
