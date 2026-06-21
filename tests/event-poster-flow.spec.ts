import { expect, test, type Locator, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const eventsPath = path.join(repoRoot, "data", "events.json");
const uploadsRoot = path.join(repoRoot, "public", "uploads");
const uploadFixturePath = path.join(repoRoot, "public", "events", "casino1.jpg");

type StoredEvent = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  venueName: string;
  venueAddress: string;
  startsAt: string;
  lineup: string[];
  genre: string[];
  posterVisibleFields?: string[];
  posterTextOverlayMode?: string;
  posterOverlayLayout?: Record<string, unknown>;
  posterReferenceUrls?: string[];
  posterAssets?: Array<{
    id: string;
    url: string;
    snapshot?: {
      lineup?: string[];
      posterTextOverlayMode?: string;
      posterVisibleFields?: string[];
      posterOverlayLayout?: Record<string, unknown>;
    };
  }>;
  ticketTemplateId?: string;
  isPublished: boolean;
};

const createdEvent = {
  title: `Codex QA Flow ${Date.now()}`,
  venue: "Foro QA Poster Lab",
  startsAtLocal: "2027-01-15T20:30",
  lineupCsv: "La Sonora Pixel, DJ Nopal, Brass After Dark",
  lineup: ["La Sonora Pixel", "DJ Nopal", "Brass After Dark"],
};

const posterFields = [
  {
    id: "venue",
    assertOn: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-meta-preview-desktop")).toContainText(event.venueName);
      await expect(studioDesktop.getByTestId("generated-poster-meta-preview-desktop")).toContainText(event.venueName);
    },
    assertOff: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-meta-preview-desktop")).not.toContainText(event.venueName);
      await expect(studioDesktop.getByTestId("generated-poster-meta-preview-desktop")).not.toContainText(event.venueName);
    },
  },
  {
    id: "date",
    assertOn: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-meta-preview-desktop")).toContainText("JAN");
      await expect(studioDesktop.getByTestId("generated-poster-meta-preview-desktop")).toContainText("JAN");
    },
    assertOff: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-meta-preview-desktop")).not.toContainText("JAN");
      await expect(studioDesktop.getByTestId("generated-poster-meta-preview-desktop")).not.toContainText("JAN");
    },
  },
  {
    id: "address",
    assertOn: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-action-preview-desktop")).toContainText(event.venueAddress);
      await expect(studioDesktop.getByTestId("generated-poster-action-preview-desktop")).toContainText(event.venueAddress);
    },
    assertOff: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-action-preview-desktop")).not.toContainText(event.venueAddress);
      await expect(studioDesktop.getByTestId("generated-poster-action-preview-desktop")).not.toContainText(event.venueAddress);
    },
  },
  {
    id: "summary",
    assertOn: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-hero-preview-desktop")).toContainText(event.summary);
      await expect(studioDesktop.getByTestId("generated-poster-hero-preview-desktop")).toContainText(event.summary);
    },
    assertOff: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-hero-preview-desktop")).not.toContainText(event.summary);
      await expect(studioDesktop.getByTestId("generated-poster-hero-preview-desktop")).not.toContainText(event.summary);
    },
  },
  {
    id: "description",
    assertOn: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-story-preview-desktop")).toContainText(event.description);
      await expect(studioDesktop.getByTestId("generated-poster-story-preview-desktop")).toContainText(event.description);
    },
    assertOff: async ({ generalDesktop, studioDesktop, event }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-story-preview-desktop")).not.toBeVisible();
      await expect(studioDesktop.getByTestId("generated-poster-story-preview-desktop")).not.toBeVisible();
      await expect(generalDesktop).not.toContainText(event.description);
      await expect(studioDesktop).not.toContainText(event.description);
    },
  },
  {
    id: "schedule",
    assertOn: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-action-preview-desktop")).toContainText("Doors");
      await expect(studioDesktop.getByTestId("generated-poster-action-preview-desktop")).toContainText("Doors");
    },
    assertOff: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-action-preview-desktop")).not.toContainText("Doors");
      await expect(studioDesktop.getByTestId("generated-poster-action-preview-desktop")).not.toContainText("Doors");
    },
  },
  {
    id: "lineup",
    assertOn: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-lineup-preview-desktop")).toContainText(createdEvent.lineup[0]);
      await expect(studioDesktop.getByTestId("generated-poster-lineup-preview-desktop")).toContainText(createdEvent.lineup[0]);
    },
    assertOff: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-lineup-preview-desktop")).not.toBeVisible();
      await expect(studioDesktop.getByTestId("generated-poster-lineup-preview-desktop")).not.toBeVisible();
    },
  },
  {
    id: "genre",
    assertOn: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-hero-preview-desktop")).toContainText("LIVE MUSIC, NIGHTLIFE");
      await expect(studioDesktop.getByTestId("generated-poster-hero-preview-desktop")).toContainText("LIVE MUSIC, NIGHTLIFE");
    },
    assertOff: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-hero-preview-desktop")).not.toContainText("LIVE MUSIC, NIGHTLIFE");
      await expect(studioDesktop.getByTestId("generated-poster-hero-preview-desktop")).not.toContainText("LIVE MUSIC, NIGHTLIFE");
    },
  },
  {
    id: "pricing",
    assertOn: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-meta-preview-desktop")).toContainText("Entradas:");
      await expect(studioDesktop.getByTestId("generated-poster-meta-preview-desktop")).toContainText("Entradas:");
    },
    assertOff: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-meta-preview-desktop")).not.toContainText("Entradas:");
      await expect(studioDesktop.getByTestId("generated-poster-meta-preview-desktop")).not.toContainText("Entradas:");
    },
  },
  {
    id: "cta",
    assertOn: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-cta-preview-desktop")).toContainText("Comprar boleto");
      await expect(studioDesktop.getByTestId("generated-poster-cta-preview-desktop")).toContainText("Comprar boleto");
    },
    assertOff: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-cta-preview-desktop")).not.toBeVisible();
      await expect(studioDesktop.getByTestId("generated-poster-cta-preview-desktop")).not.toBeVisible();
    },
  },
  {
    id: "related",
    assertOn: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-related-preview-desktop")).toBeVisible();
      await expect(studioDesktop.getByTestId("generated-poster-related-preview-desktop")).toBeVisible();
    },
    assertOff: async ({ generalDesktop, studioDesktop }: AssertionContext) => {
      await expect(generalDesktop.getByTestId("generated-poster-related-preview-desktop")).not.toBeVisible();
      await expect(studioDesktop.getByTestId("generated-poster-related-preview-desktop")).not.toBeVisible();
    },
  },
] as const;

type AssertionContext = {
  generalDesktop: Locator;
  studioDesktop: Locator;
  event: StoredEvent;
};

let originalEventsText = "";
let originalUploads = new Set<string>();
let createdEventId = "";
let createdEventSlug = "";

async function listFilesRecursive(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(root, entry.name);
        return entry.isDirectory() ? listFilesRecursive(fullPath) : [fullPath];
      }),
    );
    return nested.flat();
  } catch {
    return [];
  }
}

async function readEvents() {
  return JSON.parse(await fs.readFile(eventsPath, "utf8")) as StoredEvent[];
}

function hiddenField(page: Page, name: string) {
  return page.locator(`[name="${name}"]`);
}

function generalDesktopPoster(page: Page) {
  return page.getByTestId("general-preview-viewport-desktop").getByTestId("generated-poster-preview-desktop");
}

function studioDesktopPoster(page: Page) {
  return page.getByTestId("poster-studio-viewport-desktop").getByTestId("generated-poster-preview-desktop");
}

function generalViewportPoster(page: Page, viewport: "desktop" | "tablet" | "mobile") {
  return page.getByTestId(`general-preview-viewport-${viewport}`).getByTestId(`generated-poster-preview-${viewport}`);
}

function studioViewportPoster(page: Page, viewport: "desktop" | "tablet" | "mobile") {
  return page.getByTestId(`poster-studio-viewport-${viewport}`).getByTestId(`generated-poster-preview-${viewport}`);
}

function eventCardByTitle(page: Page, title: string) {
  return page.getByTestId("venue-event-list").getByRole("button", { name: new RegExp(title, "i") });
}

function eventCardPosterPreview(page: Page, title: string) {
  return eventCardByTitle(page, title)
    .getByTestId("venue-event-card-poster-preview")
    .getByTestId("generated-poster-preview-mobile");
}

function uploadVisualFlow(page: Page) {
  return page.locator('details[data-visual-surface="upload"]');
}

function overlayModeOption(page: Page, mode: "none" | "editorial-band" | "corner-stamp" | "ticket-strip" | "full-frame") {
  return page
    .getByTestId(`upload-overlay-option-${mode}`)
    .or(page.getByTestId(`wizard-upload-overlay-option-${mode}`))
    .first();
}

async function saveDraft(page: Page) {
  await page.getByRole("button", { name: /Guardar borrador|Guardar evento|Publicar evento/i }).last().click();
}

async function openVisualWorkbench(page: Page) {
  await page.getByRole("tab", { name: /Dirección visual/i }).click();
  await page.locator('[data-visual-tab="upload"]').click();
  await expect(page.getByTestId("poster-upload-input")).toBeAttached();
}

async function overlayVisibleCount(shell: Locator) {
  return await shell.evaluate((node) => {
    const ids = ["hero", "story", "lineup", "action", "meta"];
    return ids.reduce((count, id) => {
      const element = node.querySelector(`[data-testid^="generated-poster-${id}-"]`) as HTMLElement | null;
      if (!element) {
        return count;
      }
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" ? count + 1 : count;
    }, 0);
  });
}

async function readOverlayLayout(page: Page) {
  const raw = await page.locator('textarea[name="posterOverlayLayout"]').inputValue();
  return JSON.parse(raw) as Record<string, Record<string, string | number>>;
}

async function readOverlapRatio(overlay: Locator, artwork: Locator) {
  const [overlayBox, artworkBox] = await Promise.all([overlay.boundingBox(), artwork.boundingBox()]);

  if (!overlayBox || !artworkBox) {
    return 0;
  }

  const overlapWidth = Math.max(
    0,
    Math.min(overlayBox.x + overlayBox.width, artworkBox.x + artworkBox.width) - Math.max(overlayBox.x, artworkBox.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(overlayBox.y + overlayBox.height, artworkBox.y + artworkBox.height) - Math.max(overlayBox.y, artworkBox.y),
  );
  const overlapArea = overlapWidth * overlapHeight;
  const overlayArea = overlayBox.width * overlayBox.height;

  return overlayArea > 0 ? overlapArea / overlayArea : 0;
}

test.describe.serial("event creation and poster upload flow tests", () => {
  test.beforeAll(async () => {
    originalEventsText = await fs.readFile(eventsPath, "utf8");
    originalUploads = new Set(await listFilesRecursive(uploadsRoot));
  });

  test.afterAll(async () => {
    await fs.writeFile(eventsPath, originalEventsText, "utf8");

    const currentUploads = await listFilesRecursive(uploadsRoot);
    const createdUploads = currentUploads.filter((filePath) => !originalUploads.has(filePath));
    await Promise.all(createdUploads.map((filePath) => fs.rm(filePath, { force: true })));
  });

  test("creates a new event from the wizard without losing lineup data or overwriting another event @event-poster-flow", async ({ page }) => {
    const beforeEvents = await readEvents();
    const originalFirstEvent = beforeEvents[0];

    await page.goto("/venue");
    await expect(page.getByTestId("create-new-event-button")).toBeVisible();

    await page.getByTestId("create-new-event-button").click();
    await expect(page.getByTestId("quick-start-card")).toBeVisible();

    await page.getByTestId("quick-start-title-input").fill(createdEvent.title);
    await page.getByTestId("quick-start-next-button").click();
    await page.getByTestId("quick-start-starts-at-input").fill(createdEvent.startsAtLocal);
    await page.getByTestId("quick-start-venue-input").fill(createdEvent.venue);
    await page.getByTestId("quick-start-next-button").click();
    await page.getByTestId("quick-start-lineup-input").fill(createdEvent.lineupCsv);
    await page.getByTestId("quick-start-next-button").click();

    await expect(page.getByTestId("quick-start-card")).not.toBeVisible();
    await expect(page.getByTestId("event-lineup-input")).toHaveValue(createdEvent.lineupCsv);
    await expect(page.getByTestId("hidden-lineup-input")).toHaveValue(createdEvent.lineupCsv);

    await openVisualWorkbench(page);
    await page.getByTestId("poster-upload-input").setInputFiles(uploadFixturePath);
    await expect(page.getByAltText("Poster subido")).toBeVisible();
    await uploadVisualFlow(page).getByRole("button", { name: /^Siguiente$/ }).click();
    await uploadVisualFlow(page).getByRole("button", { name: /^Siguiente$/ }).click();
    await expect(page.getByTestId("wizard-upload-overlay-option-editorial-band")).toBeVisible();

    await expect(page.getByTestId("general-preview-grid")).toBeVisible();
    await expect(generalDesktopPoster(page).getByTestId("generated-poster-artwork-preview-desktop")).toBeVisible();
    await expect(generalDesktopPoster(page).getByTestId("generated-poster-lineup-preview-desktop")).toContainText(createdEvent.lineup[0]);

    await saveDraft(page);

    await expect
      .poll(async () => Boolean((await readEvents()).find((event) => event.title === createdEvent.title)))
      .toBe(true);

    const persisted = (await readEvents()).find((event) => event.title === createdEvent.title)!;
    createdEventId = persisted.id;
    createdEventSlug = persisted.slug;

    expect((await readEvents()).length).toBe(beforeEvents.length + 1);
    expect(persisted.id).toBeTruthy();
    expect(persisted.lineup).toEqual(createdEvent.lineup);
    expect(persisted.posterAssets?.[0]?.snapshot?.lineup).toEqual(createdEvent.lineup);
    expect(persisted.posterReferenceUrls?.[0]).toMatch(/^\/uploads\/events\//);
    expect(beforeEvents.find((event) => event.id === originalFirstEvent.id)?.title).toBe(originalFirstEvent.title);

    await expect(eventCardByTitle(page, createdEvent.title)).toBeVisible();
    await expect(eventCardPosterPreview(page, createdEvent.title)).toBeVisible();
    await expect(eventCardPosterPreview(page, createdEvent.title)).toContainText("Codex QA");
    await eventCardByTitle(page, createdEvent.title).click();
    await expect(page.getByTestId("event-lineup-input")).toHaveValue(createdEvent.lineupCsv);
    await expect(page.getByTestId("hidden-lineup-input")).toHaveValue(createdEvent.lineupCsv);
  });

  test("covers upload overlays, visible-field toggles, viewport layout independence, ticket preview, and public visibility @event-poster-flow", async ({
    page,
    request,
  }) => {
    await page.goto("/venue");
    await eventCardByTitle(page, createdEvent.title).click();

    await openVisualWorkbench(page);

    const generalDesktop = generalDesktopPoster(page);
    const studioDesktopCandidate = studioDesktopPoster(page);
    const hasStudioDesktop = (await studioDesktopCandidate.count()) > 0;
    const studioDesktop = hasStudioDesktop ? studioDesktopCandidate : generalDesktop;
    const previewSurfaces: Array<{ label: string; shell: Locator }> = [
      { label: "general desktop", shell: generalViewportPoster(page, "desktop") },
      { label: "general tablet", shell: generalViewportPoster(page, "tablet") },
      { label: "general mobile", shell: generalViewportPoster(page, "mobile") },
    ];

    if (hasStudioDesktop) {
      previewSurfaces.push(
        { label: "studio desktop", shell: studioViewportPoster(page, "desktop") },
        { label: "studio tablet", shell: studioViewportPoster(page, "tablet") },
        { label: "studio mobile", shell: studioViewportPoster(page, "mobile") },
      );
    }

    for (const mode of ["none", "editorial-band", "corner-stamp", "ticket-strip", "full-frame"] as const) {
      await overlayModeOption(page, mode).click();
      await expect(hiddenField(page, "posterTextOverlayMode")).toHaveValue(mode);
      const expectedFit = mode === "none" ? "contain" : "cover";

      for (const surface of previewSurfaces) {
        await expect(surface.shell, `${surface.label} should keep the selected overlay mode`).toHaveAttribute(
          "data-overlay-mode",
          mode,
        );
        await expect(surface.shell, `${surface.label} should use the expected uploaded-artwork fit`).toHaveAttribute(
          "data-artwork-fit",
          expectedFit,
        );

        const visibleCount = await overlayVisibleCount(surface.shell);

        if (mode === "none") {
          expect(visibleCount, `${surface.label} should intentionally hide overlays in none mode`).toBe(0);
        } else {
          expect(
            visibleCount,
            `${surface.label} should render editorial overlays instead of showing only the uploaded artwork`,
          ).toBeGreaterThan(0);
        }
      }

      if (mode !== "none") {
        await expect(generalDesktop.getByTestId("generated-poster-hero-preview-desktop")).toContainText("Codex QA");

        const generalHeroOverlap = await readOverlapRatio(
          generalDesktop.getByTestId("generated-poster-hero-preview-desktop"),
          generalDesktop.getByTestId("generated-poster-artwork-preview-desktop"),
        );

        expect(generalHeroOverlap).toBeGreaterThan(0.8);

        if (hasStudioDesktop) {
          await expect(studioDesktop.getByTestId("generated-poster-hero-preview-desktop")).toContainText("Codex QA");

          const studioHeroOverlap = await readOverlapRatio(
            studioDesktop.getByTestId("generated-poster-hero-preview-desktop"),
            studioDesktop.getByTestId("generated-poster-artwork-preview-desktop"),
          );

          expect(studioHeroOverlap).toBeGreaterThan(0.8);
        }
      }
    }

    await overlayModeOption(page, "editorial-band").click();
    await expect(generalDesktop).toHaveAttribute("data-overlay-mode", "editorial-band");

    const currentEvent = (await readEvents()).find((event) => event.id === createdEventId);
    expect(currentEvent).toBeTruthy();
    const venueToggle = page.getByTestId("poster-field-toggle-venue");

    if ((await venueToggle.count()) === 0) {
      await uploadVisualFlow(page).getByRole("button", { name: /^Atrás$/ }).click();
    }

    await expect(venueToggle).toBeVisible();

    for (const field of posterFields) {
      const toggle = page.getByTestId(`poster-field-toggle-${field.id}`);
      await toggle.click();
      await expect(hiddenField(page, "posterVisibleFields")).not.toHaveValue(new RegExp(`(^|,)${field.id}(,|$)`));
      await field.assertOff({ generalDesktop, studioDesktop, event: currentEvent! });

      await toggle.click();
      await expect(hiddenField(page, "posterVisibleFields")).toHaveValue(new RegExp(`(^|,)${field.id}(,|$)`));
      await field.assertOn({ generalDesktop, studioDesktop, event: currentEvent! });
    }

    await uploadVisualFlow(page).getByRole("button", { name: /^Siguiente$/ }).click();
    await page.getByTestId("open-overlay-editor-button").click();
    await expect(page.getByTestId("overlay-editor-modal")).toBeVisible();

    const overlayModal = page.getByTestId("overlay-editor-modal");
    const viewportButtons = overlayModal.getByRole("button");
    const anchorPanels = overlayModal.locator('[class*="overlayAnchorCard"]');
    const desktopHeadlinePanel = anchorPanels.nth(0);

    await viewportButtons.filter({ hasText: "Desktop" }).click();
    await desktopHeadlinePanel.getByRole("button", { name: "Inferior derecha" }).click();
    await expect.poll(async () => (await readOverlayLayout(page)).desktop.heroAnchor).toBe("bottom-right");

    await viewportButtons.filter({ hasText: "Mobile" }).click();
    await expect.poll(async () => (await readOverlayLayout(page)).mobile.heroAnchor).toBe("bottom-left");
    await desktopHeadlinePanel.getByRole("button", { name: "Superior centro" }).click();
    await expect.poll(async () => (await readOverlayLayout(page)).mobile.heroAnchor).toBe("top-center");

    await viewportButtons.filter({ hasText: "Desktop" }).click();
    await expect.poll(async () => (await readOverlayLayout(page)).desktop.heroAnchor).toBe("bottom-right");

    await overlayModal.locator('[class*="overlayControlCard"]').filter({ hasText: "Elemento seleccionado" }).getByRole("button", { name: "Headline" }).click();
    await overlayModal.locator('[class*="overlayControlCard"]').filter({ hasText: "Capa en edición" }).getByRole("button", { name: "Elemento completo" }).click();
    await overlayModal.locator('[class*="overlayControlCard"]').filter({ hasText: "Alineación del texto" }).getByRole("button", { name: "Centro" }).click();
    await overlayModal.locator('[class*="overlayControlCard"]').filter({ hasText: "Tipografía" }).getByRole("button", { name: "Editorial" }).click();
    await overlayModal.locator('[class*="overlayControlCard"]').filter({ hasText: "Densidad" }).getByRole("button", { name: "Aireada" }).click();
    await overlayModal.locator('[class*="overlayControlCard"]').filter({ hasText: "Estilo de tarjeta" }).getByRole("button", { name: "Solid" }).click();

    const sliderCards = overlayModal.locator('[class*="overlaySliderCard"] input[type="range"]');
    await sliderCards.nth(0).fill("1.18");
    await sliderCards.nth(1).fill("0.72");
    await sliderCards.nth(2).fill("1.1");
    await sliderCards.nth(3).fill("1.08");
    await sliderCards.nth(4).fill("1.06");

    await expect(generalDesktop).toHaveAttribute("data-text-align", "center");
    await expect(generalDesktop).toHaveAttribute("data-typography-style", "editorial");
    await expect(generalDesktop).toHaveAttribute("data-overlay-density", "airy");
    await expect(generalDesktop).toHaveAttribute("data-card-style", "solid");
    await expect(studioDesktop).toHaveAttribute("data-text-align", "center");
    await expect(studioDesktop).toHaveAttribute("data-typography-style", "editorial");
    await expect(studioDesktop).toHaveAttribute("data-overlay-density", "airy");
    await expect(studioDesktop).toHaveAttribute("data-card-style", "solid");

    const overlayLayoutBeforeSave = await readOverlayLayout(page);
    expect(overlayLayoutBeforeSave.desktop.heroScale).toBeCloseTo(1.18, 2);
    expect(overlayLayoutBeforeSave.desktop.heroOpacity).toBeCloseTo(0.72, 2);
    expect(overlayLayoutBeforeSave.desktop.fontScale).toBeCloseTo(1.1, 2);
    expect(overlayLayoutBeforeSave.desktop.elementScale).toBeCloseTo(1.08, 2);
    expect(overlayLayoutBeforeSave.desktop.cardScale).toBeCloseTo(1.06, 2);

    await page.getByRole("tab", { name: /Ticketing y publicación/i }).click();
    await page.getByRole("button", { name: /Night Band/i }).click();
    await expect(hiddenField(page, "ticketTemplateId")).toHaveValue("night-band");
    await page.getByRole("button", { name: "Ticket" }).click();
    await expect(page.getByTestId("generated-ticket-desktop")).toHaveAttribute("data-template-id", "night-band");
    await page.getByRole("button", { name: "Poster" }).click();

    const privateResponse = await request.get("/api/public/events");
    expect(privateResponse.ok()).toBeTruthy();
    const privateEvents = (await privateResponse.json()) as Array<{ slug: string }>;
    expect(privateEvents.some((event) => event.slug === createdEventSlug)).toBe(false);
    expect((await request.get(`/events/${createdEventSlug}`)).status()).toBe(404);

    await saveDraft(page);

    await expect
      .poll(async () => (await readEvents()).find((event) => event.id === createdEventId)?.posterTextOverlayMode)
      .toBe("editorial-band");

    const savedPrivateEvent = (await readEvents()).find((event) => event.id === createdEventId)!;
    expect(savedPrivateEvent.posterAssets?.[0]?.snapshot?.posterTextOverlayMode).toBe("editorial-band");
    expect(savedPrivateEvent.posterAssets?.[0]?.snapshot?.posterVisibleFields).toEqual(savedPrivateEvent.posterVisibleFields);
    expect(savedPrivateEvent.posterAssets?.[0]?.snapshot?.posterOverlayLayout).toEqual(savedPrivateEvent.posterOverlayLayout);
    expect(savedPrivateEvent.ticketTemplateId).toBe("night-band");
    expect(savedPrivateEvent.isPublished).toBe(false);

    await eventCardByTitle(page, createdEvent.title).click();
    await expect(hiddenField(page, "posterTextOverlayMode")).toHaveValue("editorial-band");
    await expect(hiddenField(page, "ticketTemplateId")).toHaveValue("night-band");
    await expect(generalDesktop).toHaveAttribute("data-text-align", "center");
    await expect(generalDesktop).toHaveAttribute("data-typography-style", "editorial");
    await expect(generalDesktop).toHaveAttribute("data-overlay-density", "airy");
    await expect(generalDesktop).toHaveAttribute("data-card-style", "solid");

    if (hasStudioDesktop) {
      await expect(studioDesktop).toHaveAttribute("data-overlay-mode", "editorial-band");
      await expect(studioDesktop).toHaveAttribute("data-artwork-fit", "cover");
    }
    await expect(eventCardPosterPreview(page, createdEvent.title)).toHaveAttribute("data-overlay-mode", "editorial-band");
    await expect(eventCardPosterPreview(page, createdEvent.title)).toHaveAttribute("data-artwork-fit", "cover");
    expect(
      await overlayVisibleCount(eventCardPosterPreview(page, createdEvent.title)),
      "event list mini preview should render a composed poster instead of only raw artwork",
    ).toBeGreaterThan(0);

    await page.getByRole("tab", { name: /Ticketing y publicación/i }).click();
    await page.getByLabel(/Hacer evento público/i).check();
    await saveDraft(page);

    await expect.poll(async () => (await readEvents()).find((event) => event.id === createdEventId)?.isPublished).toBe(true);

    const publicResponse = await request.get("/api/public/events");
    const publicEvents = (await publicResponse.json()) as Array<{ slug: string; title: string }>;
    expect(publicEvents.some((event) => event.slug === createdEventSlug && event.title === createdEvent.title)).toBe(true);

    await page.goto(`/events/${createdEventSlug}`);
    const publicPoster = page.getByTestId("generated-poster-page-desktop");
    await expect(publicPoster).toBeVisible();
    await expect(publicPoster).toHaveAttribute("data-overlay-mode", "editorial-band");
    await expect(publicPoster).toHaveAttribute("data-artwork-fit", "cover");
    expect(
      await overlayVisibleCount(publicPoster),
      "public event page should preserve the composed uploaded-poster overlay state",
    ).toBeGreaterThan(0);
    await expect(page.getByTestId("generated-poster-lineup-page-desktop")).toContainText(createdEvent.lineup[0]);
    await expect(page.getByTestId("generated-poster-cta-page-desktop")).toContainText("Comprar boleto");

    await page.goto("/venue");
    await eventCardByTitle(page, createdEvent.title).click();
    await page.getByRole("tab", { name: /Ticketing y publicación/i }).click();
    await page.getByLabel(/Hacer evento público/i).uncheck();
    await saveDraft(page);

    await expect.poll(async () => (await readEvents()).find((event) => event.id === createdEventId)?.isPublished).toBe(false);
    expect(await (await request.get(`/events/${createdEventSlug}`)).status()).toBe(404);
    const unpublishedEvents = (await (await request.get("/api/public/events")).json()) as Array<{ slug: string }>;
    expect(unpublishedEvents.some((event) => event.slug === createdEventSlug)).toBe(false);
  });
});
