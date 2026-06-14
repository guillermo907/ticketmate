import type { CSSProperties } from "react";
import { buildPosterPreviewAccessibleTheme } from "@/lib/design-accessibility";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clampNumber(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function buildPosterPreviewTheme(url: string): Promise<CSSProperties | null> {
  if (typeof window === "undefined" || !url) {
    return null;
  }

  const image = new window.Image();
  image.decoding = "async";
  image.crossOrigin = "anonymous";

  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Poster image failed to load."));
  });

  image.src = url;
  await loaded;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  const sampleWidth = 32;
  const sampleHeight = Math.max(18, Math.round((image.naturalHeight / Math.max(1, image.naturalWidth)) * sampleWidth));
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);

  let pixelCount = 0;
  let luminanceTotal = 0;
  let saturationTotal = 0;
  let luminanceMin = 1;
  let luminanceMax = 0;
  let accentScore = -1;
  let accentRgb = { r: 252, g: 191, b: 106 };

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;

    if (alpha < 0.25) {
      continue;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
    const weight = alpha;
    const accentCandidateScore = saturation * 0.68 + (1 - Math.abs(luminance - 0.52)) * 0.32;

    pixelCount += weight;
    luminanceTotal += luminance * weight;
    saturationTotal += saturation * weight;
    luminanceMin = Math.min(luminanceMin, luminance);
    luminanceMax = Math.max(luminanceMax, luminance);

    if (accentCandidateScore > accentScore) {
      accentScore = accentCandidateScore;
      accentRgb = { r, g, b };
    }
  }

  if (!pixelCount) {
    return null;
  }

  const averageLuminance = luminanceTotal / pixelCount;
  const averageSaturation = saturationTotal / pixelCount;
  const luminanceRange = luminanceMax - luminanceMin;
  const lightForeground = averageLuminance > 0.62;
  const vividPoster = averageSaturation > 0.34;
  const highContrastPoster = luminanceRange > 0.56;
  const accentHex = rgbToHex(accentRgb.r, accentRgb.g, accentRgb.b);
  const accessibleTheme = buildPosterPreviewAccessibleTheme({
    accent: accentHex,
    lightForeground,
  });
  const artworkOpacity = lightForeground ? 0.86 : vividPoster ? 0.8 : 0.9;
  const artworkBrightness = lightForeground ? 0.58 : highContrastPoster ? 0.5 : 0.62;
  const artworkSaturation = vividPoster ? 0.98 : 0.82;
  const artworkBlur = highContrastPoster ? 8 : 5;
  const artworkScale = highContrastPoster ? 1.08 : 1.04;

  return {
    "--poster-text": accessibleTheme.overlayText,
    "--poster-text-muted": accessibleTheme.overlayMuted,
    "--poster-card-text": accessibleTheme.cardText,
    "--poster-card-text-muted": accessibleTheme.cardMuted,
    "--poster-card-bg": `linear-gradient(145deg, ${accessibleTheme.cardBgStart}, ${accessibleTheme.cardBgEnd})`,
    "--poster-card-shell": accessibleTheme.cardShell,
    "--poster-card-border": accessibleTheme.cardBorder,
    "--poster-card-shadow": lightForeground ? "rgba(11, 18, 32, 0.12)" : "rgba(0, 0, 0, 0.18)",
    "--poster-artwork-contrast": String(lightForeground ? 1.02 : 1.08),
    "--poster-artwork-brightness": String(artworkBrightness),
    "--poster-artwork-saturation": String(artworkSaturation),
    "--poster-artwork-opacity": String(artworkOpacity),
    "--poster-artwork-blur": `${artworkBlur}px`,
    "--poster-artwork-scale": String(artworkScale),
    "--poster-scrim-dark": accessibleTheme.scrimDark,
    "--poster-scrim-soft": accessibleTheme.scrimSoft,
    "--poster-scrim-mid": accessibleTheme.scrimMid,
    "--poster-scrim-clear": accessibleTheme.scrimClear,
    "--poster-warm-highlight": lightForeground ? "rgba(255, 255, 255, 0.12)" : "rgba(251, 190, 90, 0.16)",
    "--poster-button-bg": `linear-gradient(135deg, ${accessibleTheme.buttonBase}, color-mix(in srgb, ${accessibleTheme.buttonBase} 52%, white))`,
    "--poster-button-fg": accessibleTheme.buttonFg,
  } as CSSProperties;
}
