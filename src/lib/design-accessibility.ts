import {
  contrastRatio,
  normalizeHex,
  normalizeThemePalette,
  readableTextColor,
} from "./theme-contrast";

type RenderShellThemeInput = {
  background: string;
  foreground: string;
  accent: string;
  accentAlt: string;
  muted?: string;
  line?: string;
  panel?: string;
  panelStrong?: string;
  ink?: string;
};

function chooseReadableColor(color: string | undefined, background: string, fallback?: string) {
  const normalized = normalizeHex(color, fallback ?? readableTextColor(background));

  if (contrastRatio(normalized, background) >= 4.5) {
    return normalized;
  }

  return readableTextColor(background);
}

function readableAccent(color: string | undefined, background: string, fallback: string) {
  const normalized = normalizeHex(color, fallback);

  if (contrastRatio(normalized, background) >= 3) {
    return normalized;
  }

  return contrastRatio("#fffaf0", background) >= contrastRatio("#120f0d", background) ? "#fffaf0" : "#120f0d";
}

export function normalizeRenderShellTheme(theme: RenderShellThemeInput) {
  const background = normalizeHex(theme.background, "#120f0d");
  const foreground = chooseReadableColor(theme.foreground, background);
  const muted = chooseReadableColor(theme.muted, background, foreground);
  const panel = normalizeHex(theme.panel, background);
  const panelStrong = normalizeHex(theme.panelStrong, panel);
  const accent = readableAccent(theme.accent, background, "#efb460");
  const accentAlt = readableAccent(theme.accentAlt, background, accent);

  return {
    background,
    foreground,
    accent,
    accentAlt,
    muted,
    line: theme.line ?? "rgba(255, 255, 255, 0.18)",
    panel,
    panelStrong,
    ink: normalizeHex(theme.ink, readableTextColor(accent)),
  };
}

export function buildPosterPreviewAccessibleTheme({
  accent,
  lightForeground,
}: {
  accent: string;
  lightForeground: boolean;
}) {
  const background = lightForeground ? "#f7efe1" : "#090b12";
  const palette = normalizeThemePalette({
    accent,
    accentAlt: lightForeground ? "#945e1d" : "#8bd8ff",
    background,
    backgroundImage: "",
    contrast: lightForeground ? "editorial" : "high",
  });
  const buttonBase = palette.accent;

  return {
    overlayText: palette.foreground,
    overlayMuted: palette.muted,
    cardText: palette.foreground,
    cardMuted: palette.muted,
    cardBgStart: palette.panelStrong,
    cardBgEnd: palette.panel,
    cardShell: palette.panelStrong,
    cardBorder: palette.line,
    scrimDark: lightForeground ? "rgba(255, 252, 245, 0.74)" : "rgba(0, 0, 0, 0.68)",
    scrimSoft: lightForeground ? "rgba(255, 252, 245, 0.46)" : "rgba(0, 0, 0, 0.36)",
    scrimMid: lightForeground ? "rgba(255, 252, 245, 0.58)" : "rgba(0, 0, 0, 0.52)",
    scrimClear: lightForeground ? "rgba(255, 252, 245, 0.08)" : "rgba(0, 0, 0, 0.08)",
    buttonBase,
    buttonFg: readableTextColor(buttonBase),
  };
}
