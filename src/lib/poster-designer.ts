import {
  eventVisualMotifs,
  getEventInviteStyle,
  normalizeEventMotifs,
  type EventInviteStyleId,
  type EventVisualMotifId,
  type VenueEventRecord,
} from "./event-types";
import { normalizeRenderShellTheme } from "./design-accessibility";

export type EventPosterDesign = {
  version: 1;
  status: "completed";
  generatedAt: string;
  designer: "poster-designer-core";
  templateId: PosterTemplateId;
  rendererId: PosterRendererId;
  variant: EventInviteStyleId;
  motifs: EventVisualMotifId[];
  narrative: {
    inviteLabel: string;
    kicker: string;
    manifesto: string;
    panelLabel: string;
    motionLabel: string;
  };
  layout: {
    titleRows: string[];
    monogram: string;
    density: "tight" | "balanced" | "expanded";
    focusArea: "lineup" | "genre" | "timing";
  };
  shellTheme: {
    background: string;
    foreground: string;
    accent: string;
    accentAlt: string;
    muted: string;
    line: string;
    panel: string;
    panelStrong: string;
    ink: string;
  };
  handoff: {
    componentId: "event-poster-page";
    summary: string;
    developerNotes: string[];
    usesPhotography: boolean;
    assetPlan: Array<{
      sourceId: "uploaded-hero" | "local-graphics-pack" | "pexels-editorial" | "banana-pro-composite";
      role: "hero" | "background" | "ornament" | "texture";
      query: string;
      notes: string;
    }>;
  };
};

export const posterTemplateIds = [
  "festival-ticket",
  "midnight-flyer",
  "sunburst-billboard",
  "velvet-program",
  "signal-grid",
  "paper-cut-stage",
  "afterglow-columns",
  "rooftop-blueprint",
  "brass-badge",
  "analog-wave",
  "monolith-dateblock",
  "kinetic-ribbon",
  "city-light-stamp",
  "nocturne-frame",
  "electric-mosaic",
] as const;

export type PosterTemplateId = (typeof posterTemplateIds)[number];
export const posterRendererIds = [
  "festival-ticket-site",
  "midnight-flyer-site",
  "sunburst-billboard-site",
  "brass-marquee-site",
  "paper-cut-collage-site",
  "signal-matrix-site",
] as const;
export type PosterRendererId = (typeof posterRendererIds)[number];

type PosterDesignInput = Pick<
  VenueEventRecord,
  | "title"
  | "summary"
  | "description"
  | "startsAt"
  | "venueName"
  | "lineup"
  | "genre"
  | "designVariant"
  | "designTemplateId"
  | "designMotifs"
  | "posterArtDirection"
  | "posterReferenceUrls"
  | "posterAssetMode"
>;

export function inferPosterVariant(event: PosterDesignInput): EventInviteStyleId {
  if (event.designVariant) {
    return getEventInviteStyle(event.designVariant).id;
  }

  const haystack = `${event.title} ${event.summary} ${event.description} ${event.genre.join(" ")}`.toLowerCase();

  if (/(jazz|soul|brass|quartet|trio|improvised|neo|listening|rooftop)/.test(haystack)) {
    return "jazz-poster";
  }

  if (/(cumbia|club|bass|dj|selector|after|techno|house|digital|electro|midnight)/.test(haystack)) {
    return "club-grid";
  }

  return "festival-sunset";
}

function buildTitleRows(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 2) {
    return [title];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function buildMonogram(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function inferFocusArea(event: PosterDesignInput): EventPosterDesign["layout"]["focusArea"] {
  if (event.lineup.length >= 3) {
    return "lineup";
  }

  if (event.genre.length >= 2) {
    return "genre";
  }

  return "timing";
}

function inferDensity(title: string): EventPosterDesign["layout"]["density"] {
  const words = title.trim().split(/\s+/).filter(Boolean).length;

  if (words >= 5) {
    return "tight";
  }

  if (words <= 2) {
    return "expanded";
  }

  return "balanced";
}

function pickMotifs(event: PosterDesignInput, variant: EventInviteStyleId) {
  const explicitMotifs = normalizeEventMotifs(event.designMotifs, variant);

  if (explicitMotifs.length > 0) {
    return explicitMotifs.slice(0, 3);
  }

  const haystack = `${event.title} ${event.summary} ${event.description} ${event.genre.join(" ")}`.toLowerCase();
  const priority: EventVisualMotifId[] = [];

  if (/(jazz|soul|brass|quartet|vocal|listening)/.test(haystack)) {
    priority.push("wave-lines", "constellation-dots");
  }

  if (/(club|midnight|dj|after|techno|house|digital|bass)/.test(haystack)) {
    priority.push("equalizer-bars", "ticket-stamp");
  }

  if (/(festival|open air|sunset|patio|cumbia|celebration)/.test(haystack)) {
    priority.push("paper-cuts", "music-notes");
  }

  return [...new Set([...priority, ...getEventInviteStyle(variant).recommendedMotifs])].slice(0, 3);
}

function resolveNarrative(variant: EventInviteStyleId, event: PosterDesignInput): EventPosterDesign["narrative"] {
  const genreLabel = event.genre.slice(0, 2).join(" / ") || "live culture";

  switch (variant) {
    case "club-grid":
      return {
        inviteLabel: "Club Grid",
        kicker: "After-hours transmission",
        manifesto: `Una direccion visual cinetica para noches de ${genreLabel.toLowerCase()}, con lectura inmediata y energia de cartel digital.`,
        panelLabel: "Pulse system",
        motionLabel: "Grid motion",
      };
    case "festival-sunset":
      return {
        inviteLabel: "Festival Sunset",
        kicker: "Street poster release",
        manifesto: `Una composicion amplia para empujar venta rapida, presencia de lineup y atmosfera celebratoria alrededor de ${genreLabel.toLowerCase()}.`,
        panelLabel: "Ciudad en vivo",
        motionLabel: "Solar drift",
      };
    case "jazz-poster":
    default:
      return {
        inviteLabel: "Jazz Poster",
        kicker: "Listening room invite",
        manifesto: `Una pieza editorial mas elegante para presentar ${genreLabel.toLowerCase()} con tension entre fotografia, tipografia y atmosfera nocturna.`,
        panelLabel: "Late session",
        motionLabel: "Velvet motion",
      };
  }
}

function createSeed(event: PosterDesignInput) {
  return `${event.title}|${event.venueName}|${event.startsAt}|${event.genre.join("|")}|${event.posterArtDirection ?? ""}|${(event.posterReferenceUrls ?? []).join("|")}|${event.designTemplateId ?? ""}`;
}

function hashSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function selectTemplate(event: PosterDesignInput, variant: EventInviteStyleId): PosterTemplateId {
  if (event.designTemplateId && posterTemplateIds.includes(event.designTemplateId)) {
    return event.designTemplateId;
  }

  const haystack = `${event.title} ${event.summary} ${event.description} ${event.genre.join(" ")}`.toLowerCase();

  if (variant === "jazz-poster" && /(jazz|neo soul|improvised|quartet|rooftop|session)/.test(haystack)) {
    return "festival-ticket";
  }

  if (variant === "club-grid" && /(cumbia|midnight|brass|selector)/.test(haystack)) {
    return "midnight-flyer";
  }

  const variantPools: Record<EventInviteStyleId, PosterTemplateId[]> = {
    "jazz-poster": ["festival-ticket", "velvet-program", "brass-badge", "nocturne-frame", "analog-wave"],
    "club-grid": ["midnight-flyer", "signal-grid", "electric-mosaic", "kinetic-ribbon", "city-light-stamp"],
    "festival-sunset": ["sunburst-billboard", "paper-cut-stage", "afterglow-columns", "rooftop-blueprint", "monolith-dateblock"],
  };

  const pool = variantPools[variant];
  return pool[hashSeed(createSeed(event)) % pool.length];
}

function selectRenderer(templateId: PosterTemplateId, variant: EventInviteStyleId): PosterRendererId {
  if (templateId === "festival-ticket") {
    return "festival-ticket-site";
  }

  if (templateId === "midnight-flyer") {
    return "midnight-flyer-site";
  }

  if (["signal-grid", "electric-mosaic", "city-light-stamp"].includes(templateId)) {
    return "signal-matrix-site";
  }

  if (["velvet-program", "brass-badge", "nocturne-frame", "analog-wave"].includes(templateId)) {
    return "brass-marquee-site";
  }

  if (["paper-cut-stage", "afterglow-columns", "rooftop-blueprint", "monolith-dateblock"].includes(templateId)) {
    return "paper-cut-collage-site";
  }

  if (templateId === "kinetic-ribbon" && variant === "club-grid") {
    return "signal-matrix-site";
  }

  return "sunburst-billboard-site";
}

function buildPosterShellTheme(
  templateId: PosterTemplateId,
  rendererId: PosterRendererId,
  variant: EventInviteStyleId,
): EventPosterDesign["shellTheme"] {
  if (templateId === "festival-ticket") {
    return normalizeRenderShellTheme({
      background: "#143463",
      foreground: "#ffd78e",
      accent: "#f0c265",
      accentAlt: "#e49f33",
      muted: "#d9bc86",
      line: "#36588e",
      panel: "#183865",
      panelStrong: "#1d4277",
      ink: "#122c58",
    });
  }

  if (rendererId === "midnight-flyer-site" || variant === "club-grid") {
    return normalizeRenderShellTheme({
      background: "#070911",
      foreground: "#f6f3ff",
      accent: "#62f4ff",
      accentAlt: "#ff4aa0",
      muted: "#b9c2df",
      line: "#243252",
      panel: "#0d1322",
      panelStrong: "#121a2f",
      ink: "#060611",
    });
  }

  if (rendererId === "paper-cut-collage-site") {
    return normalizeRenderShellTheme({
      background: "#f5ddaf",
      foreground: "#18304c",
      accent: "#dfad5b",
      accentAlt: "#e8862b",
      muted: "#5b4c37",
      line: "#d8b276",
      panel: "#f7ead0",
      panelStrong: "#f3dfbc",
      ink: "#18304c",
    });
  }

  if (rendererId === "brass-marquee-site") {
    return normalizeRenderShellTheme({
      background: "#120f1a",
      foreground: "#f4dfbb",
      accent: "#eab657",
      accentAlt: "#ff7e5f",
      muted: "#b9a78b",
      line: "#3a3147",
      panel: "#1a1523",
      panelStrong: "#241d31",
      ink: "#120f1a",
    });
  }

  if (rendererId === "signal-matrix-site") {
    return normalizeRenderShellTheme({
      background: "#090f1f",
      foreground: "#f6f9ff",
      accent: "#66efff",
      accentAlt: "#ff58b8",
      muted: "#b9c8de",
      line: "#22344c",
      panel: "#10192c",
      panelStrong: "#15213a",
      ink: "#070911",
    });
  }

  return normalizeRenderShellTheme({
    background: "#5b2a18",
    foreground: "#fff3de",
    accent: "#efb460",
    accentAlt: "#ffc560",
    muted: "#f2ddbf",
    line: "#915335",
    panel: "#824124",
    panelStrong: "#a2522c",
    ink: "#2e160d",
  });
}

function buildDeveloperNotes(
  variant: EventInviteStyleId,
  motifs: EventVisualMotifId[],
  focusArea: EventPosterDesign["layout"]["focusArea"],
) {
  const motifLabels = motifs
    .map((motifId) => eventVisualMotifs.find((motif) => motif.id === motifId)?.label ?? motifId)
    .join(", ");

  return [
    `Render the ${getEventInviteStyle(variant).label} system as the fixed page shell, not as ad-hoc per-component styling.`,
    `Keep the poster hierarchy focused on ${focusArea} and preserve the title stack exactly as delivered by the designer.`,
    `Use ${motifLabels} only as supporting layers so the CTA, schedule, and venue facts stay readable.`,
  ];
}

function buildAssetPlan(
  event: PosterDesignInput,
  variant: EventInviteStyleId,
  templateId: PosterTemplateId,
): EventPosterDesign["handoff"]["assetPlan"] {
  const referenceHint = event.posterReferenceUrls?.[0] ?? event.title;
  const artDirection = event.posterArtDirection?.trim() || `${event.title} ${event.genre.join(" ")}`.trim();
  const heroQuery = `${event.title} ${event.genre.join(" ")} live portrait`;
  const pexelsQuery = `${event.genre.join(" ")} concert portrait dramatic light`;

  const mode = event.posterAssetMode ?? "graphic-only";

  if (mode === "graphic-only") {
    return [
      {
        sourceId: "local-graphics-pack",
        role: "background",
        query: `${templateId} graphic field typography blocks`,
        notes: "Build the composition with local geometry, halftones, notes, ribbons, and bold type instead of photography.",
      },
      {
        sourceId: "local-graphics-pack",
        role: "ornament",
        query: `${variant} ornamental vector pack`,
        notes: "Use reusable vector ornaments, grain, dots, tickets, and editorial marks from the local poster pack.",
      },
    ];
  }

  if (mode === "uploaded-hero") {
    return [
      {
        sourceId: "uploaded-hero",
        role: "hero",
        query: heroQuery,
        notes: "Use the uploaded hero as the base cutout, then recolor, crop, and silhouette-treat it for the selected renderer.",
      },
      {
        sourceId: "local-graphics-pack",
        role: "ornament",
        query: `${templateId} ${variant} decorative overlays`,
        notes: "Decorative ornaments should come from the local poster graphics pack so the page keeps contrast and deploys deterministically.",
      },
    ];
  }

  if (mode === "banana-pro") {
    return [
      {
        sourceId: "banana-pro-composite",
        role: "hero",
        query: artDirection,
        notes: "Generate or edit the hero composition in Banana Pro, matching poster typography and silhouette logic before developer implementation.",
      },
      {
        sourceId: "local-graphics-pack",
        role: "texture",
        query: `${templateId} paper grain duotone overlays`,
        notes: "Keep reusable textures local so production renderers are stable after the designer handoff.",
      },
    ];
  }

  if (mode === "pexels-editorial") {
    return [
      {
        sourceId: "pexels-editorial",
        role: "hero",
        query: pexelsQuery,
        notes: "Pull an editorial source image, then transform it substantially before use so the final poster is not an unaltered stock asset.",
      },
      {
        sourceId: "local-graphics-pack",
        role: "ornament",
        query: `${variant} notes ribbons badge overlays`,
        notes: "Accent shapes and notes should be layered locally to avoid dependence on third-party availability at runtime.",
      },
    ];
  }

  return [
    {
      sourceId: "uploaded-hero",
      role: "hero",
      query: heroQuery,
      notes: "Start from the venue-supplied hero whenever available and push it through duotone, masking, or collage treatment.",
    },
    {
      sourceId: "banana-pro-composite",
      role: "background",
      query: artDirection || referenceHint,
      notes: "Designer can generate an editorial background plate or enhanced figure treatment when local uploads are not enough.",
    },
    {
      sourceId: "local-graphics-pack",
      role: "ornament",
      query: `${templateId} poster support graphics`,
      notes: "Renderer should assemble repeatable ornaments, textures, and badges from local assets rather than ad-hoc shapes.",
    },
  ];
}

function shouldUsePhotography(event: PosterDesignInput) {
  return ["uploaded-hero", "banana-pro", "pexels-editorial", "mixed-collage"].includes(
    event.posterAssetMode ?? "graphic-only",
  );
}

export function buildPosterDesign(
  event: PosterDesignInput,
  generatedAt = new Date().toISOString(),
): EventPosterDesign {
  const variant = inferPosterVariant(event);
  const motifs = pickMotifs(event, variant);
  const titleRows = buildTitleRows(event.title);
  const focusArea = inferFocusArea(event);
  const templateId = selectTemplate(event, variant);
  const rendererId = selectRenderer(templateId, variant);
  const shellTheme = buildPosterShellTheme(templateId, rendererId, variant);
  const developerNotes = buildDeveloperNotes(variant, motifs, focusArea);
  const assetPlan = buildAssetPlan(event, variant, templateId);

  return {
    version: 1,
    status: "completed",
    generatedAt,
    designer: "poster-designer-core",
    templateId,
    rendererId,
    variant,
    motifs,
    narrative: resolveNarrative(variant, event),
    layout: {
      titleRows,
      monogram: buildMonogram(event.title),
      density: inferDensity(event.title),
      focusArea,
    },
    shellTheme,
    handoff: {
      componentId: "event-poster-page",
      summary: `Completed poster direction for ${event.venueName} using the ${templateId} template and ${rendererId} renderer with a ${getEventInviteStyle(variant).label} shell ready for programmatic rendering.`,
      developerNotes,
      usesPhotography: shouldUsePhotography(event),
      assetPlan,
    },
  };
}

export function buildPosterDesignOptions(event: PosterDesignInput, generatedAt = new Date().toISOString()) {
  const variant = inferPosterVariant(event);
  const motifs = pickMotifs(event, variant);
  const titleRows = buildTitleRows(event.title);
  const focusArea = inferFocusArea(event);
  const developerNotes = buildDeveloperNotes(variant, motifs, focusArea);
  const variantPools: Record<EventInviteStyleId, PosterTemplateId[]> = {
    "jazz-poster": ["festival-ticket", "velvet-program", "brass-badge", "nocturne-frame", "analog-wave"],
    "club-grid": ["midnight-flyer", "signal-grid", "electric-mosaic", "kinetic-ribbon", "city-light-stamp"],
    "festival-sunset": ["sunburst-billboard", "paper-cut-stage", "afterglow-columns", "rooftop-blueprint", "monolith-dateblock"],
  };

  return variantPools[variant].slice(0, 3).map((templateId) => {
    const rendererId = selectRenderer(templateId, variant);
    const shellTheme = buildPosterShellTheme(templateId, rendererId, variant);
    const assetPlan = buildAssetPlan({ ...event, designTemplateId: templateId }, variant, templateId);

    return {
      version: 1,
      status: "completed",
      generatedAt,
      designer: "poster-designer-core",
      templateId,
      rendererId,
      variant,
      motifs,
      narrative: resolveNarrative(variant, event),
      layout: {
        titleRows,
        monogram: buildMonogram(event.title),
        density: inferDensity(event.title),
        focusArea,
      },
      shellTheme,
      handoff: {
        componentId: "event-poster-page" as const,
        summary: `Option ${templateId} for ${event.venueName}, ready for renderer ${rendererId}.`,
        developerNotes,
        usesPhotography: shouldUsePhotography(event),
        assetPlan,
      },
    } satisfies EventPosterDesign;
  });
}
