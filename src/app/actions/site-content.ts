"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { deletePublicAsset, savePublicAsset } from "@/lib/storage";
import { normalizeThemeForStorage } from "@/lib/theme-contrast";
import { createWallpaperBuffer, extractThemeFromImageBuffer } from "@/lib/theme-image";
import type { CvEducationItem, CvExperienceItem, CvProjectItem, SiteTheme, ThemeRevision } from "@/lib/types";

export type SaveState = {
  ok: boolean;
  message: string;
};

function ok(message: string): SaveState {
  return { ok: true, message };
}

function fail(message: string): SaveState {
  return { ok: false, message };
}

function themesMatch(a: SiteTheme, b: SiteTheme) {
  return JSON.stringify(normalizeThemeForStorage(a)) === JSON.stringify(normalizeThemeForStorage(b));
}

function buildThemeHistory(history: ThemeRevision[] | undefined, previousTheme: SiteTheme, nextTheme: SiteTheme) {
  if (themesMatch(previousTheme, nextTheme)) {
    return history ?? [];
  }

  const snapshot: ThemeRevision = {
    id: randomUUID(),
    savedAt: new Date().toISOString(),
    theme: normalizeThemeForStorage(previousTheme)
  };

  return [snapshot, ...(history ?? []).filter((entry) => !themesMatch(entry.theme, snapshot.theme))].slice(0, 2);
}

function revalidateSiteContent() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/cv-export/themed");
  revalidatePath("/cv-export/executive");
}

export async function uploadCvAction(_previousState: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdmin();

  const file = formData.get("cvFile");

  if (!(file instanceof File)) return fail("Please select a PDF file.");

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return fail("Only PDF files are supported in this version.");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const cvFileUrl = await saveCvPdfAsset(buffer, file.name);

    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      sourceFileName: file.name,
      cvFileUrl,
      cvUploadedAt: new Date().toISOString()
    });

    revalidateSiteContent();
    return ok("CV PDF uploaded and stored for homepage download.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not process CV PDF.");
  }
}

export async function removeCvPdfAction(_previousState: SaveState): Promise<SaveState> {
  void _previousState;
  await requireAdmin();

  try {
    const current = await getSiteContent();

    if (current.cvFileUrl) {
      await deletePublicAsset(current.cvFileUrl);
    }

    await saveSiteContent({
      ...current,
      sourceFileName: undefined,
      cvFileUrl: undefined,
      cvUploadedAt: undefined
    });

    revalidateSiteContent();
    return ok("Attached CV PDF removed from the site.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not remove attached CV PDF.");
  }
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
function getNumber(formData: FormData, key: string, fallback: number, min: number, max: number) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function splitTextarea(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitMultilinePreservingSpacing(value: string) {
  const lines = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();

  return lines;
}

function readExperience(formData: FormData): CvExperienceItem[] {
  const count = Number.parseInt(getString(formData, "experienceCount"), 10);
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.min(count, 12)) : 0;

  return Array.from({ length: safeCount }, (_, index) => ({
    role: getString(formData, `experience.${index}.role`),
    company: getString(formData, `experience.${index}.company`),
    period: getString(formData, `experience.${index}.period`),
    highlights: splitMultilinePreservingSpacing(String(formData.get(`experience.${index}.highlights`) ?? ""))
  })).filter((item) => item.role || item.company || item.period || item.highlights.length > 0);
}

function readEducation(formData: FormData): CvEducationItem[] {
  const count = Number.parseInt(getString(formData, "educationCount"), 10);
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.min(count, 10)) : 0;

  return Array.from({ length: safeCount }, (_, index) => ({
    title: getString(formData, `education.${index}.title`),
    institution: getString(formData, `education.${index}.institution`),
    period: getString(formData, `education.${index}.period`)
  })).filter((item) => item.title || item.institution || item.period);
}

function readProjects(formData: FormData): CvProjectItem[] {
  const count = Number.parseInt(getString(formData, "projectCount"), 10);
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.min(count, 12)) : 0;

  return Array.from({ length: safeCount }, (_, index) => ({
    title: getString(formData, `project.${index}.title`),
    url: getString(formData, `project.${index}.url`),
    description: String(formData.get(`project.${index}.description`) ?? "").trim()
  })).filter((item) => item.title || item.url || item.description);
}

async function saveWallpaperAsset(buffer: Buffer) {
  const wallpaper = await createWallpaperBuffer(buffer);
  const assetName = `cv-wallpaper-${randomUUID()}.jpg`;

  return savePublicAsset({
    body: wallpaper,
    contentType: "image/jpeg",
    localPath: `uploads/${assetName}`,
    pathname: `assets/${assetName}`
  });
}

async function saveCvPdfAsset(buffer: Buffer, fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "uploaded-cv";
  const assetName = `${safeName}-${randomUUID()}.pdf`;

  return savePublicAsset({
    body: buffer,
    contentType: "application/pdf",
    localPath: `uploads/${assetName}`,
    pathname: `cv/${assetName}`
  });
}

export async function saveCvContentAction(_previousState: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdmin();

  try {
    const current = await getSiteContent();

    await saveSiteContent({
      ...current,
      siteTitle: getString(formData, "siteTitle") || current.siteTitle,
      homeText: {
        ...current.homeText,
        builtByLabel: getString(formData, "builtByLabel") || current.homeText?.builtByLabel || "Built by",
        downloadCvLabel: getString(formData, "downloadCvLabel") || current.homeText?.downloadCvLabel || "Download CV",
        generatePdfLabel: getString(formData, "generatePdfLabel") || current.homeText?.generatePdfLabel || "Generate PDF from this page",
        generatePdfButtonLabel: getString(formData, "generatePdfButtonLabel") || current.homeText?.generatePdfButtonLabel || "Generate PDF file",
        experienceTitle: getString(formData, "experienceTitle") || current.homeText?.experienceTitle || "Experience",
        skillsTitle: getString(formData, "skillsTitle") || current.homeText?.skillsTitle || "Skills",
        educationTitle: getString(formData, "educationTitle") || current.homeText?.educationTitle || "Education",
        projectsTitle: getString(formData, "projectsTitle") || current.homeText?.projectsTitle || "Projects",
        locationLabel: getString(formData, "locationLabel") || current.homeText?.locationLabel || "Location",
        contactLabel: getString(formData, "contactLabel") || current.homeText?.contactLabel || "Contact"
      },
      cv: {
        fullName: getString(formData, "fullName"),
        headline: getString(formData, "headline"),
        location: getString(formData, "location"),
        address: getString(formData, "address"),
        email: getString(formData, "email"),
        phone: getString(formData, "phone"),
        summary: String(formData.get("summary") ?? "").replace(/\r\n/g, "\n"),
        skills: splitTextarea(getString(formData, "skills")),
        experience: readExperience(formData),
        education: readEducation(formData),
        showProjects: formData.get("showProjects") === "on",
        projects: readProjects(formData)
      }
    });

    revalidateSiteContent();
    return ok("CV sections saved.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save CV sections.");
  }
}

export async function saveThemeSettingsAction(_previousState: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdmin();

  try {
    const current = await getSiteContent();
    const themeImage = formData.get("themeImage");
    const hasThemeImage =
      themeImage instanceof File &&
      themeImage.size > 0 &&
      themeImage.type.startsWith("image/");
    const wallpaper = hasThemeImage
      ? await saveWallpaperAsset(Buffer.from(await themeImage.arrayBuffer()))
      : "";

    const nextTheme = normalizeThemeForStorage({
      ...current.theme,
      accent: String(formData.get("accent") ?? current.theme.accent),
      accentAlt: String(formData.get("accentAlt") ?? current.theme.accentAlt),
      background: String(formData.get("background") ?? current.theme.background),
      backgroundImage: wallpaper || String(formData.get("backgroundImage") ?? current.theme.backgroundImage),
      contrast: (String(formData.get("contrast") ?? current.theme.contrast) as typeof current.theme.contrast),
      bannerStyle: (String(formData.get("bannerStyle") ?? current.theme.bannerStyle ?? "editorial") as typeof current.theme.bannerStyle),
      surface: {
        wallpaperVisibility: getNumber(formData, "surface.wallpaperVisibility", current.theme.surface?.wallpaperVisibility ?? 30, 0, 100),
        surfaceVisibility: getNumber(formData, "surface.surfaceVisibility", current.theme.surface?.surfaceVisibility ?? 30, 0, 100),
        strongScrim: getNumber(formData, "surface.strongScrim", current.theme.surface?.strongScrim ?? 88, 0, 100),
        mediumScrim: getNumber(formData, "surface.mediumScrim", current.theme.surface?.mediumScrim ?? 56, 0, 100),
        borderRadius: getNumber(formData, "surface.borderRadius", current.theme.surface?.borderRadius ?? 16, 0, 40),
        borderWidth: getNumber(formData, "surface.borderWidth", current.theme.surface?.borderWidth ?? 1, 0, 6),
        blurStrength: getNumber(formData, "surface.blurStrength", current.theme.surface?.blurStrength ?? 10, 0, 40)
      },
      light: {
        ...current.theme.light,
        accent: String(formData.get("lightAccent") ?? current.theme.light.accent),
        accentAlt: String(formData.get("lightAccentAlt") ?? current.theme.light.accentAlt),
        background: String(formData.get("lightBackground") ?? current.theme.light.background),
        backgroundImage: wallpaper || String(formData.get("lightBackgroundImage") ?? current.theme.light.backgroundImage),
        contrast: (String(formData.get("lightContrast") ?? current.theme.light.contrast) as typeof current.theme.light.contrast)
      }
    });

    await saveSiteContent({
      ...current,
      theme: nextTheme,
      themeHistory: buildThemeHistory(current.themeHistory, current.theme, nextTheme)
    });

    revalidateSiteContent();
    return ok("Theme settings saved and applied.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save theme settings.");
  }
}

export async function restoreThemeRevisionAction(_previousState: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdmin();

  try {
    const revisionId = String(formData.get("revisionId") ?? "");
    const current = await getSiteContent();
    const revision = current.themeHistory?.find((entry) => entry.id === revisionId);

    if (!revision) {
      return fail("The selected theme revision is no longer available.");
    }

    const restoredTheme = normalizeThemeForStorage(revision.theme);
    const nextHistory = buildThemeHistory(
      current.themeHistory?.filter((entry) => entry.id !== revisionId),
      current.theme,
      restoredTheme
    );

    await saveSiteContent({
      ...current,
      theme: restoredTheme,
      themeHistory: nextHistory
    });

    revalidateSiteContent();
    return ok("Theme revision restored.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not restore the saved theme revision.");
  }
}

export async function extractThemeFromImageAction(_previousState: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdmin();

  const file = formData.get("themeImage");

  if (!(file instanceof File)) return fail("Please upload an image file.");

  const isImage = file.type.startsWith("image/");
  if (!isImage) return fail("Only image files are allowed for palette extraction.");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractThemeFromImageBuffer(buffer);
    const wallpaper = await saveWallpaperAsset(buffer);
    const current = await getSiteContent();
    const accent = getString(formData, "suggestedAccent") || extracted.accent;
    const accentAlt = getString(formData, "suggestedAccentAlt") || extracted.accentAlt;
    const background = getString(formData, "suggestedBackground") || extracted.background;
    const lightAccent = getString(formData, "suggestedLightAccent") || accent;
    const lightAccentAlt = getString(formData, "suggestedLightAccentAlt") || accentAlt;
    const lightBackground = getString(formData, "suggestedLightBackground") || extracted.lightBackground;

    await saveSiteContent({
      ...current,
      theme: normalizeThemeForStorage({
        ...current.theme,
        accent,
        accentAlt,
        background,
        backgroundImage: wallpaper,
        light: {
          ...current.theme.light,
          accent: lightAccent,
          accentAlt: lightAccentAlt,
          background: lightBackground,
          backgroundImage: wallpaper
        }
      })
    });

    revalidateSiteContent();
    return ok("Palette extracted from image and applied to theme.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not extract palette from image.");
  }
}
