import type { SiteContent, ThemeSettings } from "./types";

export type ContrastMode = ThemeSettings["contrast"];

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Hsl = {
  h: number;
  s: number;
  l: number;
};

export type ThemeTokens = {
  foreground: string;
  muted: string;
  line: string;
  panel: string;
  panelStrong: string;
};

export type NormalizedPalette = ThemeSettings & ThemeTokens & {
  ink: string;
};

export type NormalizedSiteTheme = NormalizedPalette & {
  light: NormalizedPalette;
};

const darkFallback = "#120f0d";
const lightFallback = "#f3ead7";
const lightText = "#fffaf0";
const darkText = "#120f0d";
const lightForeground = "#17110c";
const lightMuted = "#544838";

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((channel) => clamp(channel).toString(16).padStart(2, "0")).join("")}`;
}

function clampPercent(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

export function normalizeHex(hex: string | undefined, fallback = darkFallback) {
  const raw = String(hex ?? "").trim().replace(/^#/, "");
  const value =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return fallback;
  }

  return `#${value.toLowerCase()}`;
}

export function getRgb(hex: string | undefined) {
  const normalized = normalizeHex(hex);
  const number = Number.parseInt(normalized.slice(1), 16);

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255
  };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: normalizeHue(hue),
    s: saturation * 100,
    l: lightness * 100
  };
}

function hexToHsl(hex: string) {
  return rgbToHsl(getRgb(hex));
}

function hslToHex({ h, s, l }: Hsl) {
  const hue = normalizeHue(h);
  const saturation = clampPercent(s) / 100;
  const lightness = clampPercent(l) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return toHex({
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255
  });
}

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string | undefined) {
  const { r, g, b } = getRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string | undefined, b: string | undefined) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));

  return (lighter + 0.05) / (darker + 0.05);
}

function mix(a: string, b: string, amount: number) {
  const from = getRgb(a);
  const to = getRgb(b);

  return toHex({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount
  });
}

function ensureContrast(color: string, background: string, minimum: number, target: string) {
  let next = normalizeHex(color);

  for (let step = 0; step <= 18; step += 1) {
    if (contrastRatio(next, background) >= minimum) {
      return next;
    }

    next = mix(next, target, 0.22);
  }

  return contrastRatio(lightText, background) >= contrastRatio(darkText, background)
    ? lightText
    : darkText;
}

function darkenForContrast(color: string, background: string, minimum: number, minimumLightness: number) {
  let next = hexToHsl(normalizeHex(color));

  for (let step = 0; step <= 100; step += 1) {
    const nextHex = hslToHex(next);

    if (contrastRatio(nextHex, background) >= minimum) {
      return nextHex;
    }

    if (next.l <= minimumLightness) {
      return nextHex;
    }

    next = { ...next, l: Math.max(minimumLightness, next.l - 2) };
  }

  return hslToHex(next);
}

function lightenForContrast(color: string, background: string, minimum: number, maximumLightness: number) {
  let next = hexToHsl(normalizeHex(color));

  for (let step = 0; step <= 100; step += 1) {
    const nextHex = hslToHex(next);

    if (contrastRatio(nextHex, background) >= minimum) {
      return nextHex;
    }

    if (next.l >= maximumLightness) {
      return nextHex;
    }

    next = { ...next, l: Math.min(maximumLightness, next.l + 2) };
  }

  return hslToHex(next);
}

export function readableTextColor(background: string | undefined) {
  const safeBackground = normalizeHex(background);

  return contrastRatio(safeBackground, lightText) >= contrastRatio(safeBackground, darkText)
    ? lightText
    : darkText;
}

export function mutedTextColor(background: string | undefined) {
  const safeBackground = normalizeHex(background);
  const isLight = luminance(safeBackground) > 0.45;
  const candidate = isLight ? "#5e5242" : "#cdbfaa";

  return ensureContrast(candidate, safeBackground, 4.5, readableTextColor(safeBackground));
}

export function lineColor(background: string | undefined) {
  return luminance(background) > 0.45 ? "rgba(18, 15, 13, 0.24)" : "rgba(255, 250, 240, 0.22)";
}

export function panelColor(background: string | undefined) {
  return luminance(background) > 0.45 ? "rgba(255, 255, 255, 0.82)" : "rgba(255, 250, 240, 0.1)";
}

export function panelStrongColor(background: string | undefined) {
  return luminance(background) > 0.45 ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 250, 240, 0.18)";
}

export function contrastTokens(background: string, contrast: ContrastMode = "balanced"): ThemeTokens {
  const safeBackground = normalizeHex(background);
  const isLight = luminance(safeBackground) > 0.45;
  const baseForeground = readableTextColor(safeBackground);

  if (isLight) {
    if (contrast === "soft") {
      return {
        foreground: lightForeground,
        muted: darkenForContrast(lightMuted, safeBackground, 3, 25),
        line: "rgba(23, 17, 12, 0.18)",
        panel: "rgba(255, 252, 245, 0.72)",
        panelStrong: "rgba(255, 252, 245, 0.88)"
      };
    }

    if (contrast === "high") {
      return {
        foreground: "#070504",
        muted: "#211a14",
        line: "rgba(7, 5, 4, 0.34)",
        panel: "rgba(255, 255, 255, 0.94)",
        panelStrong: "rgba(255, 255, 255, 0.99)"
      };
    }

    return {
      foreground: lightForeground,
      muted: darkenForContrast(lightMuted, safeBackground, 3, 25),
      line: "rgba(23, 17, 12, 0.24)",
      panel: "rgba(255, 252, 245, 0.84)",
      panelStrong: "rgba(255, 252, 245, 0.96)"
    };
  }

  if (contrast === "soft") {
    return {
      foreground: baseForeground,
      muted: ensureContrast(isLight ? "#665b4c" : "#d9cbb8", safeBackground, 4.5, baseForeground),
      line: isLight ? "rgba(18, 15, 13, 0.18)" : "rgba(255, 250, 240, 0.16)",
      panel: isLight ? "rgba(255, 255, 255, 0.7)" : "rgba(255, 250, 240, 0.08)",
      panelStrong: isLight ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 250, 240, 0.14)"
    };
  }

  if (contrast === "high") {
    return {
      foreground: isLight ? "#070504" : "#fffdf8",
      muted: isLight ? "#211a14" : "#f4ead9",
      line: isLight ? "rgba(7, 5, 4, 0.34)" : "rgba(255, 253, 248, 0.34)",
      panel: isLight ? "rgba(255, 255, 255, 0.94)" : "rgba(255, 250, 240, 0.16)",
      panelStrong: isLight ? "rgba(255, 255, 255, 0.99)" : "rgba(255, 250, 240, 0.24)"
    };
  }

  if (contrast === "editorial") {
    const foreground = ensureContrast(isLight ? "#17110c" : "#fffaf0", safeBackground, 4.5, baseForeground);

    return {
      foreground,
      muted: ensureContrast(isLight ? "#544838" : "#e7d9c4", safeBackground, 4.5, foreground),
      line: isLight ? "rgba(23, 17, 12, 0.22)" : "rgba(255, 250, 240, 0.26)",
      panel: isLight ? "rgba(255, 252, 245, 0.84)" : "rgba(18, 15, 13, 0.72)",
      panelStrong: isLight ? "rgba(255, 252, 245, 0.96)" : "rgba(18, 15, 13, 0.88)"
    };
  }

  // Balanced mode (default)
  return {
    foreground: baseForeground,
    muted: ensureContrast(
      isLight ? "#665b4c" : "#d9cbb8",
      safeBackground,
      4.5,
      baseForeground
    ),
    line: isLight ? "rgba(18, 15, 13, 0.28)" : "rgba(255, 250, 240, 0.2)",
    panel: isLight ? "rgba(255, 255, 255, 0.88)" : "rgba(255, 250, 240, 0.1)",
    panelStrong: isLight ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 250, 240, 0.16)"
  };
}

export function normalizeThemePalette(
  palette: ThemeSettings,
  fallbackBackground = darkFallback,
  mode: "dark" | "light" = "dark"
): NormalizedPalette {
  let background = normalizeHex(palette.background, fallbackBackground);

  if (mode === "light") {
    const backgroundHsl = hexToHsl(background);
    background = hslToHex({
      ...backgroundHsl,
      s: Math.min(backgroundHsl.s, 18),
      l: clampPercent(backgroundHsl.l, 92, 97)
    });
  }

  const tokens = contrastTokens(background, palette.contrast);
  let foreground = tokens.foreground;
  let muted = tokens.muted;
  let accent = normalizeHex(palette.accent, "#d9a441");
  let accentAlt = normalizeHex(palette.accentAlt, "#46b7a9");
  let ink = readableTextColor(accent);

  if (mode === "light") {
    foreground = lightForeground;
    muted = darkenForContrast(lightMuted, background, 3, 25);
    accent = darkenForContrast(accent, background, 3, 18);
    accentAlt = darkenForContrast(accentAlt, background, 3, 18);

    ink = readableTextColor(accent);

    if (contrastRatio(ink, accent) < 4.5) {
      const accentHsl = hexToHsl(accent);
      accent =
        contrastRatio(lightForeground, accent) >= contrastRatio(lightText, accent)
          ? lightenForContrast(accent, lightForeground, 4.5, 88)
          : darkenForContrast(accent, lightText, 4.5, 18);
      ink = readableTextColor(accent);

      if (contrastRatio(ink, accent) < 4.5) {
        ink = accentHsl.l > 50 ? lightForeground : lightText;
      }
    }
  } else {
    accent = ensureContrast(accent, background, 4.5, foreground);
    accentAlt = ensureContrast(accentAlt, background, 4.5, foreground);
    ink = readableTextColor(accent);

    // Ensure button text has sufficient contrast with accent background
    if (contrastRatio(ink, accent) < 4.5) {
      const accentHsl = hexToHsl(accent);
      // If luminance is high (light accent), use dark text; if low (dark accent), use light text
      ink = accentHsl.l > 50 ? darkText : lightText;

      // If still not sufficient, adjust further
      if (contrastRatio(ink, accent) < 4.5) {
        ink = luminance(accent) > 0.5 ? darkText : lightText;
      }
    }
  }

  return {
    ...palette,
    accent,
    accentAlt,
    background,
    backgroundImage: palette.backgroundImage ?? "",
    contrast: palette.contrast ?? "balanced",
    ...tokens,
    foreground,
    muted,
    ink
  };
}

export function normalizeThemeForStorage(theme: SiteContent["theme"]): SiteContent["theme"] {
  const surface = theme.surface ?? {
    wallpaperVisibility: 30,
    surfaceVisibility: 30,
    strongScrim: 88,
    mediumScrim: 56,
    borderRadius: 16,
    borderWidth: 1,
    blurStrength: 10
  };
  const clampStoredNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
  };

  return {
    accent: normalizeHex(theme.accent, "#d9a441"),
    accentAlt: normalizeHex(theme.accentAlt, "#46b7a9"),
    background: normalizeHex(theme.background, darkFallback),
    backgroundImage: theme.backgroundImage ?? "",
    contrast: theme.contrast ?? "balanced",
    bannerStyle: theme.bannerStyle ?? "editorial",
    surface: {
      wallpaperVisibility: clampStoredNumber(surface.wallpaperVisibility, 30, 0, 100),
      surfaceVisibility: clampStoredNumber(surface.surfaceVisibility, 30, 0, 100),
      strongScrim: clampStoredNumber(surface.strongScrim, 88, 0, 100),
      mediumScrim: clampStoredNumber(surface.mediumScrim, 56, 0, 100),
      borderRadius: clampStoredNumber(surface.borderRadius, 16, 0, 40),
      borderWidth: clampStoredNumber(surface.borderWidth, 1, 0, 6),
      blurStrength: clampStoredNumber(surface.blurStrength, 10, 0, 40)
    },
    light: {
      accent: normalizeHex(theme.light?.accent, "#4ea003"),
      accentAlt: normalizeHex(theme.light?.accentAlt, "#0ba32c"),
      background: normalizeHex(theme.light?.background, lightFallback),
      backgroundImage: theme.light?.backgroundImage ?? "",
      contrast: theme.light?.contrast ?? "balanced"
    }
  };
}

export function normalizeSiteTheme(theme: SiteContent["theme"]): NormalizedSiteTheme {
  return {
    ...normalizeThemePalette(theme, darkFallback, "dark"),
    light: normalizeThemePalette(theme.light, lightFallback, "light")
  };
}

export function themeCssVariables(theme: SiteContent["theme"]) {
  const normalized = normalizeSiteTheme(theme);
  const surface = theme.surface ?? {
    wallpaperVisibility: 30,
    surfaceVisibility: 30,
    strongScrim: 88,
    mediumScrim: 56,
    borderRadius: 16,
    borderWidth: 1,
    blurStrength: 10
  };

  return {
    "--accent": normalized.accent,
    "--accent-alt": normalized.accentAlt,
    "--background": normalized.background,
    "--foreground": normalized.foreground,
    "--muted": normalized.muted,
    "--line": normalized.line,
    "--panel": normalized.panel,
    "--panel-strong": normalized.panelStrong,
    "--ink": normalized.ink,
    "--light-accent": normalized.light.accent,
    "--light-accent-alt": normalized.light.accentAlt,
    "--light-background": normalized.light.background,
    "--light-foreground": normalized.light.foreground,
    "--light-muted": normalized.light.muted,
    "--light-line": normalized.light.line,
    "--light-panel": normalized.light.panel,
    "--light-panel-strong": normalized.light.panelStrong,
    "--light-ink": normalized.light.ink,
    "--theme-wallpaper-visibility": `${surface.wallpaperVisibility}%`,
    "--theme-surface-visibility": `${surface.surfaceVisibility}%`,
    "--theme-strong-scrim": `${surface.strongScrim}%`,
    "--theme-medium-scrim": `${surface.mediumScrim}%`,
    "--theme-border-radius": `${surface.borderRadius}px`,
    "--theme-border-width": `${surface.borderWidth}px`,
    "--theme-blur-strength": `${surface.blurStrength}px`
  };
}

export function contrastGrade(ratio: number) {
  if (ratio >= 7) {
    return "AAA";
  }

  if (ratio >= 4.5) {
    return "AA";
  }

  if (ratio >= 3) {
    return "Large text only";
  }

  return "Needs adjustment";
}
