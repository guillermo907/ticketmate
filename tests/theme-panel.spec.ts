import { expect, test, type Locator, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveAdminSession } from "../src/lib/admin-access";
import { normalizeSiteTheme } from "../src/lib/theme-contrast";
import type { SiteTheme } from "../src/lib/types";

const repoRoot = path.resolve(__dirname, "..");
const siteContentPath = path.join(repoRoot, "data", "site-content.json");
const uploadsRoot = path.join(repoRoot, "public", "uploads");
const uploadFixturePath = path.join(repoRoot, "public", "events", "casino1.jpg");

const themeA = {
  accent: "#ff3366",
  accentAlt: "#33c7ff",
  background: "#101f44",
  contrast: "high",
  lightAccent: "#0f8b6d",
  lightAccentAlt: "#a14a14",
  lightBackground: "#f5efe2",
  lightContrast: "balanced",
  bannerStyle: "floating",
  surface: {
    wallpaperVisibility: 64,
    surfaceVisibility: 52,
    strongScrim: 91,
    mediumScrim: 43,
    borderRadius: 22,
    borderWidth: 3,
    blurStrength: 14
  }
} as const;

const themeB = {
  accent: "#8f4dff",
  accentAlt: "#ffb020",
  background: "#261238",
  contrast: "editorial",
  lightAccent: "#1b7fdb",
  lightAccentAlt: "#c15d11",
  lightBackground: "#eef6ff",
  lightContrast: "soft",
  bannerStyle: "editorial",
  surface: {
    wallpaperVisibility: 41,
    surfaceVisibility: 68,
    strongScrim: 84,
    mediumScrim: 58,
    borderRadius: 12,
    borderWidth: 2,
    blurStrength: 8
  }
} as const;

let originalContentText = "";
let originalContent: Awaited<ReturnType<typeof readSiteContent>>;
let originalUploads = new Set<string>();

async function listFilesRecursive(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(root, entry.name);
        return entry.isDirectory() ? listFilesRecursive(fullPath) : [fullPath];
      })
    );
    return nested.flat();
  } catch {
    return [];
  }
}

async function readSiteContent() {
  return JSON.parse(await fs.readFile(siteContentPath, "utf8"));
}

async function cssVar(locator: Locator, name: string) {
  return await locator.evaluate(
    (element: HTMLElement, propertyName: string) => element.style.getPropertyValue(propertyName).trim(),
    name
  );
}

async function computedBodyVar(page: Page, name: string) {
  return await page.evaluate((propertyName) => getComputedStyle(document.body).getPropertyValue(propertyName).trim(), name);
}

function colorInput(page: Page, name: string) {
  return page.locator(`input[name="${name}"]`);
}

function rangeInput(page: Page, name: string) {
  return page.locator(`input[name="${name}"]`);
}

async function readInputValue(page: Page, name: string) {
  return await page.locator(`input[name="${name}"]`).inputValue();
}

async function setColor(page: Page, label: string, value: string) {
  const fieldNameByLabel: Record<string, string> = {
    Accent: "accent",
    "Accent Alt": "accentAlt",
    Background: "background",
    "Light Accent": "lightAccent",
    "Light Accent Alt": "lightAccentAlt",
    "Light Background": "lightBackground"
  };
  const input = colorInput(page, fieldNameByLabel[label]);

  await input.evaluate(
    (input, nextValue) => {
      const element = input as HTMLInputElement;
      element.value = nextValue;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value
  );
  await expect(input).toHaveValue(value);
}

async function setRange(page: Page, label: string, value: number) {
  const fieldNameByLabel: Record<string, string> = {
    "Wallpaper visibility": "surface.wallpaperVisibility",
    "Surface visibility": "surface.surfaceVisibility",
    "Strong scrim": "surface.strongScrim",
    "Medium scrim": "surface.mediumScrim",
    "Border radius": "surface.borderRadius",
    "Border width": "surface.borderWidth",
    "Blur strength": "surface.blurStrength"
  };
  const input = rangeInput(page, fieldNameByLabel[label]);

  await input.evaluate(
    (input, nextValue) => {
      const element = input as HTMLInputElement;
      element.value = String(nextValue);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value
  );
  await expect(input).toHaveValue(String(value));
}

test.describe.serial("theme panel tests", () => {
  test.beforeAll(async () => {
    originalContentText = await fs.readFile(siteContentPath, "utf8");
    originalContent = JSON.parse(originalContentText);
    originalUploads = new Set(await listFilesRecursive(uploadsRoot));
  });

  test.afterAll(async () => {
    await fs.writeFile(siteContentPath, originalContentText, "utf8");

    const currentUploads = await listFilesRecursive(uploadsRoot);
    const createdUploads = currentUploads.filter((filePath) => !originalUploads.has(filePath));
    await Promise.all(createdUploads.map((filePath) => fs.rm(filePath, { force: true })));
  });

  test("covers previews, persistence, revisions, and public rendering @theme-panel", async ({ page }) => {
    await page.goto("/admin");

    const adminPage = page.getByTestId("admin-theme-page");
    const livePreview = page.getByTestId("live-theme-preview");
    const desktopPreview = page.getByTestId("preview-shell-desktop");
    const tabletCard = page.getByTestId("viewport-tablet");
    const mobileCard = page.getByTestId("viewport-mobile");

    await expect(page.getByRole("heading", { name: "Theme Controls" })).toBeVisible();
    await expect(livePreview).toBeVisible();
    await expect(desktopPreview).toBeVisible();
    await expect(tabletCard).toBeVisible();
    await expect(mobileCard).toBeVisible();

    await page.locator("#themeImage").setInputFiles(uploadFixturePath);
    await expect(page.getByText(path.basename(uploadFixturePath))).toBeVisible();

    const darkPaletteGroup = page.getByTestId("dark-palette-group");
    const lightPaletteGroup = page.getByTestId("light-palette-group");
    await expect(darkPaletteGroup).toBeVisible();
    await expect(lightPaletteGroup).toBeVisible();
    await expect(darkPaletteGroup.getByRole("button")).toHaveCount(6);
    await expect(lightPaletteGroup.getByRole("button")).toHaveCount(6);

    await darkPaletteGroup.getByRole("button").nth(1).click();
    await lightPaletteGroup.getByRole("button").nth(2).click();
    await expect(colorInput(page, "accent")).not.toHaveValue(originalContent.theme.accent);
    await expect(colorInput(page, "lightAccent")).not.toHaveValue(originalContent.theme.light.accent);

    const expectedTheme: SiteTheme = structuredClone(originalContent.theme);
    expectedTheme.accent = await readInputValue(page, "accent");
    expectedTheme.accentAlt = await readInputValue(page, "accentAlt");
    expectedTheme.background = await readInputValue(page, "background");
    expectedTheme.light.accent = await readInputValue(page, "lightAccent");
    expectedTheme.light.accentAlt = await readInputValue(page, "lightAccentAlt");
    expectedTheme.light.background = await readInputValue(page, "lightBackground");

    for (const control of [
      {
        label: "Accent",
        value: themeA.accent,
        variableName: "--preview-accent",
        apply: (theme: SiteTheme, nextValue: string) => {
          theme.accent = nextValue;
        },
        expected: (theme: SiteTheme) => normalizeSiteTheme(theme).accent
      },
      {
        label: "Accent Alt",
        value: themeA.accentAlt,
        variableName: "--preview-accent-alt",
        apply: (theme: SiteTheme, nextValue: string) => {
          theme.accentAlt = nextValue;
        },
        expected: (theme: SiteTheme) => normalizeSiteTheme(theme).accentAlt
      },
      {
        label: "Background",
        value: themeA.background,
        variableName: "--preview-background",
        apply: (theme: SiteTheme, nextValue: string) => {
          theme.background = nextValue;
        },
        expected: (theme: SiteTheme) => normalizeSiteTheme(theme).background
      },
      {
        label: "Light Accent",
        value: themeA.lightAccent,
        variableName: "--preview-light-accent",
        apply: (theme: SiteTheme, nextValue: string) => {
          theme.light.accent = nextValue;
        },
        expected: (theme: SiteTheme) => normalizeSiteTheme(theme).light.accent
      },
      {
        label: "Light Accent Alt",
        value: themeA.lightAccentAlt,
        variableName: "--preview-light-accent-alt",
        apply: (theme: SiteTheme, nextValue: string) => {
          theme.light.accentAlt = nextValue;
        },
        expected: (theme: SiteTheme) => normalizeSiteTheme(theme).light.accentAlt
      },
      {
        label: "Light Background",
        value: themeA.lightBackground,
        variableName: "--preview-light-background",
        apply: (theme: SiteTheme, nextValue: string) => {
          theme.light.background = nextValue;
        },
        expected: (theme: SiteTheme) => normalizeSiteTheme(theme).light.background
      }
    ] as const) {
      await setColor(page, control.label, control.value);
      control.apply(expectedTheme, control.value);
      await expect.poll(() => cssVar(livePreview, control.variableName)).toBe(control.expected(expectedTheme));
    }

    const darkContrastPicker = page.getByTestId("contrast-picker-contrast");
    const lightContrastPicker = page.getByTestId("contrast-picker-light-contrast");

    for (const [title, value] of [
      ["Soft", "soft"],
      ["Balanced", "balanced"],
      ["High", "high"],
      ["Editorial", "editorial"]
    ] as const) {
      await darkContrastPicker.getByRole("button", { name: new RegExp(`^${title}`) }).click();
      await expect(page.locator('input[name="contrast"]')).toHaveValue(value);
      await expect.poll(() => page.locator('[data-mode="dark"] b').textContent()).toBe(value);
    }

    await darkContrastPicker.getByRole("button", { name: /^High/ }).click();
    await expect(page.locator('input[name="contrast"]')).toHaveValue(themeA.contrast);

    for (const [title, value] of [
      ["Soft", "soft"],
      ["Balanced", "balanced"],
      ["High", "high"],
      ["Editorial", "editorial"]
    ] as const) {
      await lightContrastPicker.getByRole("button", { name: new RegExp(`^${title}`) }).click();
      await expect(page.locator('input[name="lightContrast"]')).toHaveValue(value);
      await expect.poll(() => page.locator('[data-mode="light"] b').textContent()).toBe(value);
    }

    await lightContrastPicker.getByRole("button", { name: /^Balanced/ }).click();
    await expect(page.locator('input[name="lightContrast"]')).toHaveValue(themeA.lightContrast);

    for (const [title, value] of [
      ["Editorial Frame", "editorial"],
      ["Blurred Atmosphere", "blurred"],
      ["Gradient Veil", "split"],
      ["Floating Text", "floating"]
    ] as const) {
      await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
      await expect(page.locator('input[name="bannerStyle"]')).toHaveValue(value);
      await expect(desktopPreview).toHaveAttribute("data-banner-style", value);
    }

    for (const [label, value, variableName, unit] of [
      ["Wallpaper visibility", themeA.surface.wallpaperVisibility, "--theme-wallpaper-visibility", "%"],
      ["Surface visibility", themeA.surface.surfaceVisibility, "--theme-surface-visibility", "%"],
      ["Strong scrim", themeA.surface.strongScrim, "--theme-strong-scrim", "%"],
      ["Medium scrim", themeA.surface.mediumScrim, "--theme-medium-scrim", "%"],
      ["Border radius", themeA.surface.borderRadius, "--theme-border-radius", "px"],
      ["Border width", themeA.surface.borderWidth, "--theme-border-width", "px"],
      ["Blur strength", themeA.surface.blurStrength, "--theme-blur-strength", "px"]
    ] as const) {
      await setRange(page, label, value);
      await expect.poll(() => cssVar(livePreview, variableName)).toBe(`${value}${unit}`);
    }

    await page.getByRole("checkbox").check();
    await expect(adminPage).toHaveAttribute("data-global-preview", "true");
    await expect.poll(() => cssVar(adminPage, "--admin-preview-wallpaper-visibility")).toBe(`${themeA.surface.wallpaperVisibility}%`);
    await expect.poll(() => cssVar(adminPage, "--admin-preview-surface-visibility")).toBe(`${themeA.surface.surfaceVisibility}%`);

    await page.getByRole("button", { name: "Save Theme" }).click();
    await expect(page.getByText("Theme settings saved and applied.")).toBeVisible();

    await expect.poll(async () => {
      const content = await readSiteContent();
      return {
        accent: content.theme.accent,
        accentAlt: content.theme.accentAlt,
        background: content.theme.background,
        contrast: content.theme.contrast,
        bannerStyle: content.theme.bannerStyle,
        history: content.themeHistory?.length ?? 0
      };
    }).toEqual({
      accent: themeA.accent,
      accentAlt: themeA.accentAlt,
      background: themeA.background,
      contrast: themeA.contrast,
      bannerStyle: themeA.bannerStyle,
      history: Math.min((originalContent.themeHistory?.length ?? 0) + 1, 2)
    });

    await expect.poll(async () => {
      const content = await readSiteContent();
      return content.theme.backgroundImage;
    }).toContain("/uploads/");

    const normalizedThemeA = normalizeSiteTheme((await readSiteContent()).theme);

    await page.goto("/");
    const publicMain = page.locator('main[data-theme-scope]').first();
    await expect(publicMain).toHaveAttribute("data-banner", themeA.bannerStyle);
    await expect.poll(() => page.locator("html").evaluate((element) => element.style.getPropertyValue("--accent").trim())).toBe(normalizedThemeA.accent);
    await expect.poll(() => page.locator("html").evaluate((element) => element.style.getPropertyValue("--light-accent").trim())).toBe(normalizedThemeA.light.accent);
    await expect.poll(() => computedBodyVar(page, "--background")).toBe(normalizedThemeA.background);

    await page.getByRole("button", { name: /Switch to light theme/i }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    await expect.poll(() => computedBodyVar(page, "--background")).toBe(normalizedThemeA.light.background);

    await page.goto("/admin");

    for (const [label, value] of [
      ["Accent", themeB.accent],
      ["Accent Alt", themeB.accentAlt],
      ["Background", themeB.background],
      ["Light Accent", themeB.lightAccent],
      ["Light Accent Alt", themeB.lightAccentAlt],
      ["Light Background", themeB.lightBackground]
    ] as const) {
      await setColor(page, label, value);
    }

    await darkContrastPicker.getByRole("button", { name: /^Editorial/ }).click();
    await lightContrastPicker.getByRole("button", { name: /^Soft/ }).click();
    await page.getByRole("button", { name: /^Editorial Frame/ }).click();

    for (const [label, value] of [
      ["Wallpaper visibility", themeB.surface.wallpaperVisibility],
      ["Surface visibility", themeB.surface.surfaceVisibility],
      ["Strong scrim", themeB.surface.strongScrim],
      ["Medium scrim", themeB.surface.mediumScrim],
      ["Border radius", themeB.surface.borderRadius],
      ["Border width", themeB.surface.borderWidth],
      ["Blur strength", themeB.surface.blurStrength]
    ] as const) {
      await setRange(page, label, value);
    }

    await page.getByRole("button", { name: "Save Theme" }).click();
    await expect(page.getByText("Theme settings saved and applied.")).toBeVisible();

    await expect.poll(async () => {
      const content = await readSiteContent();
      return {
        accent: content.theme.accent,
        bannerStyle: content.theme.bannerStyle,
        contrast: content.theme.contrast,
        history: content.themeHistory?.length ?? 0
      };
    }).toEqual({
      accent: themeB.accent,
      bannerStyle: themeB.bannerStyle,
      contrast: themeB.contrast,
      history: 2
    });

    await page.getByRole("button", { name: "Restore revision 1" }).click();
    await expect(page.getByText("Theme revision restored.")).toBeVisible();
    await expect.poll(async () => {
      const content = await readSiteContent();
      return {
        accent: content.theme.accent,
        bannerStyle: content.theme.bannerStyle,
        contrast: content.theme.contrast
      };
    }).toEqual({
      accent: themeA.accent,
      bannerStyle: themeA.bannerStyle,
      contrast: themeA.contrast
    });

    await page.goto("/");
    await expect(publicMain).toHaveAttribute("data-banner", themeA.bannerStyle);
    await expect.poll(() => computedBodyVar(page, "--background")).toBe(normalizedThemeA.light.background);

    await page.goto("/admin");
    await page.getByRole("button", { name: "Restore revision 2" }).click();
    await expect(page.getByText("Theme revision restored.")).toBeVisible();

    await expect.poll(async () => {
      const content = await readSiteContent();
      return {
        accent: content.theme.accent,
        accentAlt: content.theme.accentAlt,
        background: content.theme.background,
        contrast: content.theme.contrast,
        bannerStyle: content.theme.bannerStyle ?? "editorial",
        lightAccent: content.theme.light.accent,
        lightAccentAlt: content.theme.light.accentAlt,
        lightBackground: content.theme.light.background,
        lightContrast: content.theme.light.contrast
      };
    }).toEqual({
      accent: originalContent.theme.accent,
      accentAlt: originalContent.theme.accentAlt,
      background: originalContent.theme.background,
      contrast: originalContent.theme.contrast,
      bannerStyle: originalContent.theme.bannerStyle ?? "editorial",
      lightAccent: originalContent.theme.light.accent,
      lightAccentAlt: originalContent.theme.light.accentAlt,
      lightBackground: originalContent.theme.light.background,
      lightContrast: originalContent.theme.light.contrast
    });

    await page.goto("/");
    await expect(publicMain).toHaveAttribute("data-banner", originalContent.theme.bannerStyle ?? "editorial");
  });
});

test("non-admin users cannot access /admin @security", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByText(/Continue with Google/i)).toBeVisible();
});

test("theme save still requires admin permission unless local preview is enabled @security", async () => {
  expect(() => resolveAdminSession(null, false)).toThrow("Unauthorized admin action.");

  const localPreviewSession = resolveAdminSession(null, true);
  expect(localPreviewSession.user?.role).toBe("ADMIN");
  expect(localPreviewSession.user?.email).toBe("local-preview@admin.dev");
});
