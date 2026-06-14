import type { EventPosterDesign } from "./poster-designer";
import { buildPosterDesign } from "./poster-designer";
import { normalizeRenderShellTheme } from "./design-accessibility";
import {
  getEventInviteStyle,
  ticketTemplateIds,
  type EventInviteStyleId,
  type EventTicketDesign,
  type TicketTemplateId,
  type VenueEventRecord,
} from "./event-types";

type TicketDesignInput = Pick<
  VenueEventRecord,
  | "title"
  | "summary"
  | "description"
  | "startsAt"
  | "venueName"
  | "lineup"
  | "genre"
  | "ticketPriceMXN"
  | "ticketFeeMXN"
  | "designVariant"
  | "designTemplateId"
  | "ticketTemplateId"
>;

function hashSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function createSeed(event: TicketDesignInput) {
  return `${event.title}|${event.venueName}|${event.startsAt}|${event.ticketPriceMXN}|${event.ticketFeeMXN}|${event.ticketTemplateId ?? ""}|${event.designTemplateId ?? ""}`;
}

function inferVariant(event: TicketDesignInput) {
  return getEventInviteStyle(event.designVariant).id;
}

function selectTemplate(event: TicketDesignInput, variant: EventInviteStyleId): TicketTemplateId {
  if (event.ticketTemplateId && ticketTemplateIds.includes(event.ticketTemplateId)) {
    return event.ticketTemplateId;
  }

  if (event.designTemplateId === "festival-ticket") {
    return "glass-banner";
  }

  if (event.designTemplateId === "midnight-flyer" || variant === "club-grid") {
    return "night-band";
  }

  const pools: Record<EventInviteStyleId, TicketTemplateId[]> = {
    "jazz-poster": ["glass-banner", "festival-pass", "ledger-stub", "night-band"],
    "club-grid": ["night-band", "glass-banner", "festival-pass", "ledger-stub"],
    "festival-sunset": ["ledger-stub", "glass-banner", "festival-pass", "night-band"],
  };

  const pool = pools[variant];
  return pool[hashSeed(createSeed(event)) % pool.length];
}

function selectRenderer(templateId: TicketTemplateId): EventTicketDesign["rendererId"] {
  if (templateId === "glass-banner") {
    return "glass-banner-card";
  }

  if (templateId === "festival-pass") {
    return "festival-pass-card";
  }

  if (templateId === "ledger-stub") {
    return "ledger-stub-card";
  }

  return "night-band-card";
}

function buildTicketTheme(templateId: TicketTemplateId, posterDesign: EventPosterDesign): EventTicketDesign["shellTheme"] {
  const base = posterDesign.shellTheme;

  if (templateId === "glass-banner") {
    return normalizeRenderShellTheme({
      background: "#121923",
      foreground: "#fff9ec",
      accent: "#ff5bbd",
      accentAlt: "#8bd8ff",
      panel: "#2a3547",
      panelStrong: "#1a2434",
      line: "#5b6677",
      ink: "#080b11",
      muted: posterDesign.shellTheme.muted,
    });
  }

  if (templateId === "night-band") {
    return normalizeRenderShellTheme({
      background: "#071018",
      foreground: "#f9f3e8",
      accent: base.accentAlt,
      accentAlt: base.accent,
      panel: "#0b1521",
      panelStrong: "#122131",
      line: base.line,
      ink: "#05070c",
      muted: base.muted,
    });
  }

  if (templateId === "ledger-stub") {
    return normalizeRenderShellTheme({
      background: "#f4ead3",
      foreground: "#152845",
      accent: base.accent,
      accentAlt: base.accentAlt,
      panel: "#fff7eb",
      panelStrong: "#f0e3ca",
      line: "#d2b98b",
      ink: "#142238",
      muted: base.muted,
    });
  }

  return normalizeRenderShellTheme({
    background: base.panelStrong,
    foreground: base.foreground,
    accent: base.accent,
    accentAlt: base.accentAlt,
    muted: base.muted,
    panel: base.panel,
    panelStrong: base.panelStrong,
    line: base.line,
    ink: base.ink,
  });
}

export function buildTicketDesign(
  event: TicketDesignInput,
  posterDesign?: EventPosterDesign,
  generatedAt = new Date().toISOString(),
): EventTicketDesign {
  const variant = inferVariant(event);
  const poster = posterDesign ?? buildPosterDesign(event, generatedAt);
  const templateId = selectTemplate(event, variant);
  const rendererId = selectRenderer(templateId);
  const shellTheme = buildTicketTheme(templateId, poster);

  return {
    version: 1,
    status: "completed",
    generatedAt,
    designer: "ticket-designer-core",
    templateId,
    rendererId,
    variant,
    shellTheme,
    layout: {
      orientation: templateId === "night-band" ? "vertical" : "horizontal",
      density: templateId === "festival-pass" || templateId === "glass-banner" ? "balanced" : "compact",
      qrPlacement: templateId === "night-band" ? "bottom" : "right",
    },
    handoff: {
      componentId: "event-ticket-card",
      summary: `Ticket design for ${event.title} using ${templateId} aligned to the ${poster.templateId} poster system.`,
      developerNotes: [
        "Keep the ticket visually tied to the event poster but optimized for scanning and compact information density.",
        "Prioritize title, date, venue, price, purchase reference, and a clear QR zone.",
        "Do not let the decorative background reduce legibility of the operational details.",
      ],
    },
  };
}
