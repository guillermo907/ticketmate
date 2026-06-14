"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { restoreThemeRevisionAction, saveThemeSettingsAction, type SaveState } from "@/app/actions/site-content";
import { HomePagePreview } from "@/components/home/home-page";
import { applyThemeVariables } from "@/lib/apply-theme-variables";
import type { SiteContent, ThemeRevision } from "@/lib/types";
import { contrastGrade, contrastRatio, normalizeSiteTheme, readableTextColor, themeCssVariables } from "@/lib/theme-contrast";
import styles from "./admin-dashboard.module.scss";

type AdminDashboardProps = {
  initialContent: SiteContent;
  userEmail: string;
};

const initialState: SaveState = { ok: false, message: "" };
const defaultSurface = {
  wallpaperVisibility: 30,
  surfaceVisibility: 30,
  strongScrim: 88,
  mediumScrim: 56,
  borderRadius: 16,
  borderWidth: 1,
  blurStrength: 10
};
const bannerStyles = [
  {
    value: "editorial",
    title: "Editorial Frame",
    description: "Current strong glass hero with a visible image panel."
  },
  {
    value: "blurred",
    title: "Blurred Atmosphere",
    description: "Mostly blurred wallpaper, minimal image frame, and a softer overall presence."
  },
  {
    value: "split",
    title: "Gradient Veil",
    description: "Blurred image veil fading from visible to transparent."
  },
  {
    value: "floating",
    title: "Floating Text",
    description: "Almost no card structure; text floats over tinted wallpaper."
  }
] as const;

const contrastModes = [
  {
    value: "soft",
    title: "Soft",
    description: "Glass más suave y contraste menos agresivo."
  },
  {
    value: "balanced",
    title: "Balanced",
    description: "Equilibrio general entre legibilidad y atmósfera."
  },
  {
    value: "high",
    title: "High",
    description: "Jerarquía más dura y separación visual más fuerte."
  },
  {
    value: "editorial",
    title: "Editorial",
    description: "Peso tipográfico premium con superficies más marcadas."
  }
] as const;

const surfaceControls = [
  {
    key: "wallpaperVisibility",
    label: "Wallpaper visibility",
    icon: "◌",
    min: 0,
    max: 100,
    unit: "%",
    helper: "Controla qué tan visible es la imagen de fondo del tema.",
  },
  {
    key: "surfaceVisibility",
    label: "Surface visibility",
    icon: "▥",
    min: 0,
    max: 100,
    unit: "%",
    helper: "Aclara u oscurece las superficies de vidrio y paneles sobre el wallpaper.",
  },
  {
    key: "strongScrim",
    label: "Strong scrim",
    icon: "◫",
    min: 0,
    max: 100,
    unit: "%",
    helper: "Ajusta la capa más densa del glassmorphism para textos y bloques principales.",
  },
  {
    key: "mediumScrim",
    label: "Medium scrim",
    icon: "◩",
    min: 0,
    max: 100,
    unit: "%",
    helper: "Ajusta la segunda capa de contraste usada en tarjetas y paneles secundarios.",
  },
  {
    key: "borderRadius",
    label: "Border radius",
    icon: "◧",
    min: 0,
    max: 40,
    unit: "px",
    helper: "Define qué tan redondeados se ven cards, hero y contenedores del sistema.",
  },
  {
    key: "borderWidth",
    label: "Border width",
    icon: "▣",
    min: 0,
    max: 6,
    unit: "px",
    helper: "Engrosa o adelgaza los contornos de paneles y superficies translúcidas.",
  },
  {
    key: "blurStrength",
    label: "Blur strength",
    icon: "◍",
    min: 0,
    max: 40,
    unit: "px",
    helper: "Controla cuánto se difumina el fondo detrás de las superficies del tema.",
  },
] as const;

type PaletteVariant = {
  label: string;
  tokens: {
    accent: string;
    accentAlt: string;
    background: string;
  };
};

type PaletteVariantSet = {
  dark: PaletteVariant[];
  light: PaletteVariant[];
};

export function AdminDashboard({ initialContent, userEmail }: AdminDashboardProps) {
  const router = useRouter();
  const [themeState, themeAction, savingTheme] = useActionState(saveThemeSettingsAction, initialState);
  const [restoreState, restoreAction, restoringTheme] = useActionState(restoreThemeRevisionAction, initialState);
  const [themeDraft, setThemeDraft] = useState(initialContent.theme);
  const [globalPreviewEnabled, setGlobalPreviewEnabled] = useState(false);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [paletteProgress, setPaletteProgress] = useState(0);
  const [paletteStatus, setPaletteStatus] = useState("Sube una imagen para extraer color y wallpaper.");
  const [paletteFileName, setPaletteFileName] = useState("");
  const [palettePreview, setPalettePreview] = useState("");
  const [paletteVariants, setPaletteVariants] = useState<PaletteVariantSet>({ dark: [], light: [] });
  const [selectedPalette, setSelectedPalette] = useState({ dark: 0, light: 0 });
  const incomingThemeSnapshot = useMemo(() => JSON.stringify(initialContent.theme), [initialContent.theme]);
  const lastSyncedThemeSnapshot = useRef(incomingThemeSnapshot);
  const surface = { ...defaultSurface, ...themeDraft.surface };
  const persistedTheme = useMemo(() => normalizeSiteTheme(initialContent.theme), [initialContent.theme]);
  const normalizedTheme = useMemo(() => normalizeSiteTheme(themeDraft), [themeDraft]);
  const adminTheme = globalPreviewEnabled ? normalizedTheme : persistedTheme;
  const adminSurface = globalPreviewEnabled ? { ...defaultSurface, ...themeDraft.surface } : { ...defaultSurface, ...initialContent.theme.surface };
  const previewWallpaper = palettePreview || themeDraft.backgroundImage || themeDraft.light.backgroundImage;
  const previewContent = useMemo(
    () => ({
      ...initialContent,
      theme: {
        ...themeDraft,
        backgroundImage: previewWallpaper || themeDraft.backgroundImage,
        light: {
          ...themeDraft.light,
          backgroundImage: previewWallpaper || themeDraft.light.backgroundImage,
        },
      },
    }),
    [initialContent, previewWallpaper, themeDraft],
  );

  useEffect(() => {
    applyThemeVariables(adminTheme);

    return () => {
      applyThemeVariables(persistedTheme);
    };
  }, [adminTheme, persistedTheme]);

  useEffect(() => {
    if (themeState.ok || restoreState.ok) {
      router.refresh();
    }
  }, [restoreState.ok, router, themeState.ok]);

  useEffect(() => {
    if (incomingThemeSnapshot === lastSyncedThemeSnapshot.current) {
      return;
    }

    lastSyncedThemeSnapshot.current = incomingThemeSnapshot;

    const frame = window.requestAnimationFrame(() => {
      setThemeDraft(initialContent.theme);
      setPalettePreview((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return "";
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [incomingThemeSnapshot, initialContent.theme]);

  useEffect(() => {
    return () => {
      if (palettePreview) {
        URL.revokeObjectURL(palettePreview);
      }
    };
  }, [palettePreview]);

  function applyPaletteVariant(mode: "dark" | "light", index: number, variants = paletteVariants) {
    const variant = variants[mode][index] ?? variants[mode][0];
    if (!variant) return;

    setSelectedPalette((current) => ({ ...current, [mode]: index }));
    setThemeDraft((current) => {
      if (mode === "dark") {
        return {
          ...current,
          accent: variant.tokens.accent,
          accentAlt: variant.tokens.accentAlt,
          background: variant.tokens.background
        };
      }

      return {
        ...current,
        light: {
          ...current.light,
          accent: variant.tokens.accent,
          accentAlt: variant.tokens.accentAlt,
          background: variant.tokens.background
        }
      };
    });
  }

  async function handlePaletteFile(file: File | null) {
    if (!file) {
      return;
    }

    setPaletteLoading(true);
    setPaletteProgress(10);
    setPaletteStatus("Preparando imagen para preview y extracción de color...");
    setPaletteFileName(file.name);
    setPalettePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(file);
    });

    try {
      setPaletteProgress(34);
      setPaletteStatus("Leyendo imagen y preparando los tonos principales...");
      const dataUrl = await readFileAsDataUrl(file);
      setPaletteProgress(64);
      setPaletteStatus("Generando variantes de color para dark y light...");
      const variants = await extractPaletteOptions(dataUrl);
      setPaletteVariants(variants);
      setSelectedPalette({ dark: 0, light: 0 });
      setThemeDraft((current) => ({
        ...current,
        accent: variants.dark[0]?.tokens.accent ?? current.accent,
        accentAlt: variants.dark[0]?.tokens.accentAlt ?? current.accentAlt,
        background: variants.dark[0]?.tokens.background ?? current.background,
        light: {
          ...current.light,
          accent: variants.light[0]?.tokens.accent ?? current.light.accent,
          accentAlt: variants.light[0]?.tokens.accentAlt ?? current.light.accentAlt,
          background: variants.light[0]?.tokens.background ?? current.light.background
        }
      }));
      setPaletteProgress(100);
      setPaletteStatus("Listo. El preview ya usa esta imagen y puedes guardar el tema cuando quieras.");
    } catch (error) {
      setPaletteStatus(error instanceof Error ? error.message : "No se pudo procesar la imagen.");
    } finally {
      window.setTimeout(() => {
        setPaletteLoading(false);
      }, 220);
    }
  }

  return (
    <main
      className={styles.page}
      data-testid="admin-theme-page"
      style={{
        ...themeCssVariables({
          ...initialContent.theme,
          ...themeDraft,
          surface: adminSurface,
          backgroundImage: globalPreviewEnabled ? previewWallpaper : initialContent.theme.backgroundImage,
          light: {
            ...initialContent.theme.light,
            ...themeDraft.light,
            backgroundImage: globalPreviewEnabled ? previewWallpaper : initialContent.theme.light.backgroundImage,
          },
        }),
        "--admin-bg": adminTheme.background,
        "--admin-fg": adminTheme.foreground,
        "--admin-muted": adminTheme.muted,
        "--admin-line": adminTheme.line,
        "--admin-panel": adminTheme.panel,
        "--admin-panel-strong": adminTheme.panelStrong,
        "--accent": adminTheme.accent,
        "--accent-alt": adminTheme.accentAlt,
        "--background": adminTheme.background,
        "--foreground": adminTheme.foreground,
        "--muted": adminTheme.muted,
        "--line": adminTheme.line,
        "--panel": adminTheme.panel,
        "--panel-strong": adminTheme.panelStrong,
        "--ink": adminTheme.ink,
        ...(globalPreviewEnabled && previewWallpaper ? { "--admin-preview-wallpaper": `url(${previewWallpaper})` } : { "--admin-preview-wallpaper": "none" }),
        "--admin-preview-wallpaper-opacity": globalPreviewEnabled ? `${adminSurface.wallpaperVisibility / 100}` : "0",
        ...(globalPreviewEnabled
          ? {
              "--admin-preview-wallpaper-visibility": `${surface.wallpaperVisibility}%`,
              "--admin-preview-surface-visibility": `${surface.surfaceVisibility}%`,
            }
          : {
              "--admin-preview-wallpaper-visibility": "0%",
              "--admin-preview-surface-visibility": "0%",
            }),
      } as CSSProperties}
      data-global-preview={globalPreviewEnabled ? "true" : "false"}
    >
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p>Admin Panel</p>
            <h1>Theme Controls</h1>
            <span>{userEmail}</span>
          </div>
          <Link href="/" className={styles.homeLink}>
            Back to Home
          </Link>
        </header>

        <div className={styles.workspaceGrid}>
          <aside className={styles.themeColumn}>
            <details className={styles.card} open>
              <summary>Extract Theme From Image</summary>
              <div className={styles.cardBody}>
                <div className={styles.form}>
                  <label htmlFor="themeImage">Upload image</label>
                  <input
                    id="themeImage"
                    name="themeImage"
                    type="file"
                    accept="image/*"
                    form="themeSettingsForm"
                    onChange={(event) => handlePaletteFile(event.target.files?.[0] ?? null)}
                  />
                  {palettePreview ? (
                    <span className={styles.imagePreview}>
                      <i style={{ backgroundImage: `url(${palettePreview})` }} />
                      <strong>{paletteFileName}</strong>
                    </span>
                  ) : (
                    <span className={styles.imageHint}>Preview updates immediately. Click Save Theme to persist the image and colors.</span>
                  )}
                  <div className={styles.uploadStatus} data-busy={paletteLoading ? "true" : "false"}>
                    <div className={styles.uploadStatusBar}>
                      <i style={{ width: `${paletteProgress}%` }} />
                    </div>
                    <small>{paletteStatus}</small>
                  </div>
                </div>
                {paletteVariants.dark.length > 0 ? (
                  <div className={styles.paletteOptions}>
                    <PaletteOptions title="Dark palettes" mode="dark" variants={paletteVariants.dark} selected={selectedPalette.dark} onSelect={applyPaletteVariant} />
                    <PaletteOptions title="Light palettes" mode="light" variants={paletteVariants.light} selected={selectedPalette.light} onSelect={applyPaletteVariant} />
                  </div>
                ) : null}
              </div>
            </details>

            <details className={styles.card} open>
              <summary>Manual Theme Settings</summary>
              <div className={styles.cardBody}>
                <form id="themeSettingsForm" action={themeAction} className={styles.compactThemeForm} data-testid="theme-settings-form">
                  <input type="hidden" name="backgroundImage" value={themeDraft.backgroundImage} />
                  <input type="hidden" name="lightBackgroundImage" value={themeDraft.light.backgroundImage} />
                  <input type="hidden" name="bannerStyle" value={themeDraft.bannerStyle ?? "editorial"} />
                  <div className={styles.bannerStylePicker}>
                    <span>Homepage banner format</span>
                    <div>
                      {bannerStyles.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={(themeDraft.bannerStyle ?? "editorial") === option.value ? styles.activeBannerStyle : undefined}
                          onClick={() => setThemeDraft((theme) => ({ ...theme, bannerStyle: option.value }))}
                        >
                          <i data-banner-preview={option.value} style={{ "--preview-wallpaper": previewWallpaper ? `url(${previewWallpaper})` : "none" } as CSSProperties} />
                          <strong>{option.title}</strong>
                          <small>{option.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <ColorField label="Accent" name="accent" value={themeDraft.accent} adjusted={normalizedTheme.accent} background={normalizedTheme.background} onChange={(value) => setThemeDraft((theme) => ({ ...theme, accent: value }))} />
                  <ColorField label="Accent Alt" name="accentAlt" value={themeDraft.accentAlt} adjusted={normalizedTheme.accentAlt} background={normalizedTheme.background} onChange={(value) => setThemeDraft((theme) => ({ ...theme, accentAlt: value }))} />
                  <ColorField label="Background" name="background" value={themeDraft.background} adjusted={normalizedTheme.background} background={normalizedTheme.foreground} onChange={(value) => setThemeDraft((theme) => ({ ...theme, background: value }))} />
                  <input type="hidden" name="contrast" value={themeDraft.contrast} />
                  <ContrastPicker
                    label="Contrast"
                    value={themeDraft.contrast}
                    onChange={(value) => setThemeDraft((theme) => ({ ...theme, contrast: value }))}
                  />
                  <ColorField label="Light Accent" name="lightAccent" value={themeDraft.light.accent} adjusted={normalizedTheme.light.accent} background={normalizedTheme.light.background} onChange={(value) => setThemeDraft((theme) => ({ ...theme, light: { ...theme.light, accent: value } }))} />
                  <ColorField label="Light Accent Alt" name="lightAccentAlt" value={themeDraft.light.accentAlt} adjusted={normalizedTheme.light.accentAlt} background={normalizedTheme.light.background} onChange={(value) => setThemeDraft((theme) => ({ ...theme, light: { ...theme.light, accentAlt: value } }))} />
                  <ColorField label="Light Background" name="lightBackground" value={themeDraft.light.background} adjusted={normalizedTheme.light.background} background={normalizedTheme.light.foreground} onChange={(value) => setThemeDraft((theme) => ({ ...theme, light: { ...theme.light, background: value } }))} />
                  <input type="hidden" name="lightContrast" value={themeDraft.light.contrast} />
                  <ContrastPicker
                    label="Light Contrast"
                    value={themeDraft.light.contrast}
                    onChange={(value) => setThemeDraft((theme) => ({ ...theme, light: { ...theme.light, contrast: value } }))}
                  />
                  <div className={styles.surfaceControlSection}>
                    <div className={styles.surfaceControlHeader}>
                      <span>◈ Surface system</span>
                      <small>Ajusta cómo se sienten wallpaper, transparencias, blur y bordes en toda la interfaz.</small>
                    </div>
                    <div className={styles.surfaceControlGrid}>
                      {surfaceControls.map((control) => (
                        <SurfaceSlider
                          key={control.key}
                          label={control.label}
                          icon={control.icon}
                          helper={control.helper}
                          max={control.max}
                          min={control.min}
                          name={`surface.${control.key}`}
                          unit={control.unit}
                          value={surface[control.key]}
                          onChange={(value) =>
                            setThemeDraft((theme) => ({
                              ...theme,
                              surface: { ...defaultSurface, ...theme.surface, [control.key]: value },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div className={styles.actions}><button type="submit" disabled={savingTheme}>{savingTheme ? "Saving..." : "Save Theme"}</button></div>
                </form>
                {themeState.message ? <p className={themeState.ok ? styles.success : styles.error}>{themeState.message}</p> : null}
                {restoreState.message ? <p className={restoreState.ok ? styles.success : styles.error}>{restoreState.message}</p> : null}
              </div>
            </details>

            <details className={styles.card} open>
              <summary>Theme revisions</summary>
              <div className={styles.cardBody}>
                <ThemeRevisionList revisions={initialContent.themeHistory ?? []} action={restoreAction} busy={restoringTheme} />
              </div>
            </details>
          </aside>

          <aside className={styles.previewColumn}>
            <ThemePreview
              bannerStyle={themeDraft.bannerStyle ?? "editorial"}
              content={previewContent}
              globalPreviewEnabled={globalPreviewEnabled}
              onGlobalPreviewChange={setGlobalPreviewEnabled}
              wallpaper={previewWallpaper}
            />
          </aside>
        </div>
      </section>
    </main>
  );
}

function ColorField({
  adjusted,
  background,
  label,
  name,
  onChange,
  value
}: {
  adjusted: string;
  background: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const ratio = contrastRatio(adjusted, background);
  const adjustedLabel = adjusted.toLowerCase() === value.toLowerCase() ? "OK" : "Adjusted";

  return (
    <label>
      {label}
      <input
        type="color"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => onChange((event.target as HTMLInputElement).value)}
      />
      <span className={styles.adjustedChip}>
        <i style={{ background: adjusted }} />
        {adjustedLabel}: {adjusted} · {contrastGrade(ratio)}
      </span>
    </label>
  );
}

function ThemePreview({
  bannerStyle,
  content,
  globalPreviewEnabled,
  onGlobalPreviewChange,
  wallpaper
}: {
  bannerStyle: (typeof bannerStyles)[number]["value"];
  content: SiteContent;
  globalPreviewEnabled: boolean;
  onGlobalPreviewChange: (checked: boolean) => void;
  wallpaper: string;
}) {
  const normalizedTheme = normalizeSiteTheme(content.theme);
  const style = {
    ...themeCssVariables(content.theme),
    "--preview-accent": normalizedTheme.accent,
    "--preview-accent-alt": normalizedTheme.accentAlt,
    "--preview-background": normalizedTheme.background,
    "--preview-foreground": normalizedTheme.foreground,
    "--preview-muted": normalizedTheme.muted,
    "--preview-panel": normalizedTheme.panelStrong,
    "--preview-light-accent": normalizedTheme.light.accent,
    "--preview-light-accent-alt": normalizedTheme.light.accentAlt,
    "--preview-light-background": normalizedTheme.light.background,
    "--preview-light-foreground": normalizedTheme.light.foreground,
    "--preview-wallpaper": wallpaper ? `url(${wallpaper})` : "none"
  } as CSSProperties;

  return (
    <section className={styles.themePreviewPanel} style={style} data-testid="live-theme-preview">
      <div className={styles.previewPanelHeader}>
        <div className={styles.previewPanelTitle}>
          <span>Live Theme Preview</span>
          <strong>Preview</strong>
          <small>Revisa cómo viven color, contraste y wallpaper en desktop, tablet y mobile sin esconder ninguna vista.</small>
        </div>
        <div className={styles.previewPanelMeta}>
          <article>
            <span>Visión</span>
            <strong>3 pantallas visibles</strong>
          </article>
          <article>
            <span>Foco</span>
            <strong>Color, contraste y wallpaper</strong>
          </article>
          <article>
            <span>Contrast</span>
            <strong>{content.theme.contrast}</strong>
          </article>
        </div>
        <div className={styles.previewModeStrip}>
          <article className={styles.previewModeCard}>
            <span>Dark mode</span>
            <div className={styles.previewModeSwatch} data-mode="dark">
              <i />
              <b>{content.theme.contrast}</b>
            </div>
          </article>
          <article className={styles.previewModeCard}>
            <span>Light mode</span>
            <div className={styles.previewModeSwatch} data-mode="light">
              <i />
              <b>{content.theme.light.contrast}</b>
            </div>
          </article>
        </div>
        <label className={styles.globalPreviewToggle}>
          <input
            type="checkbox"
            checked={globalPreviewEnabled}
            onChange={(event) => onGlobalPreviewChange(event.target.checked)}
          />
          <div>
            <strong>Preview aplica a toda la página</strong>
            <small>Refleja este draft temporalmente en todo el admin. Si sales sin guardar, se pierde.</small>
          </div>
        </label>
      </div>

      <div className={styles.previewViewportGrid}>
          <ThemeViewportCard
            label="Desktop"
            subtitle="Hero + sidebar"
            width={1200}
            height={760}
            displayWidthRem={18.2}
            displayHeightPx={228}
          >
          <ThemePreviewCanvas bannerStyle={bannerStyle} content={content} viewport="desktop" />
        </ThemeViewportCard>
        <div className={styles.previewViewportRow}>
          <ThemeViewportCard
            label="Tablet"
            subtitle="iPad Pro"
            width={1024}
            height={768}
            displayWidthRem={10.5}
            displayHeightPx={188}
          >
            <ThemePreviewCanvas bannerStyle={bannerStyle} content={content} viewport="tablet" />
          </ThemeViewportCard>
          <ThemeViewportCard
            label="Mobile"
            subtitle="Screenshot view"
            width={390}
            height={844}
            displayWidthRem={7.2}
            displayHeightPx={188}
          >
            <ThemePreviewCanvas bannerStyle={bannerStyle} content={content} viewport="mobile" />
          </ThemeViewportCard>
        </div>
        <div className={styles.previewFooterMeta}>
          {[
            `Banner: ${bannerStyle}`,
            `Contrast: ${content.theme.contrast}`,
            `Wallpaper ${wallpaper ? "on" : "off"}`,
            `Surface ${content.theme.surface?.surfaceVisibility ?? defaultSurface.surfaceVisibility}%`,
            `Blur ${content.theme.surface?.blurStrength ?? defaultSurface.blurStrength}px`,
          ].map((item) => (
            <i key={item}>{item}</i>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContrastPicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: (typeof contrastModes)[number]["value"]) => void;
  value: (typeof contrastModes)[number]["value"];
}) {
  return (
    <div className={styles.contrastPicker} data-testid={`contrast-picker-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <span>{label}</span>
      <div>
        {contrastModes.map((option) => (
          <button
            key={`${label}-${option.value}`}
            type="button"
            className={value === option.value ? styles.activeContrastMode : undefined}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.title}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeViewportCard({
  children,
  displayHeightPx,
  displayWidthRem,
  height,
  label,
  subtitle,
  width,
}: {
  children: ReactNode;
  displayHeightPx: number;
  displayWidthRem: number;
  height: number;
  label: string;
  subtitle: string;
  width: number;
}) {
  const displayWidth = `${displayWidthRem}rem`;
  const displayWidthPx = Math.round(displayWidthRem * 16);
  const displayHeight = `${displayHeightPx / 16}rem`;
  const scale = Math.min(displayWidthPx / width, displayHeightPx / height);

  return (
    <article className={styles.previewViewportCard} data-testid={`viewport-${label.toLowerCase()}`}>
      <div className={styles.previewViewportHeader}>
        <div>
          <span>{label}</span>
          <strong>{subtitle}</strong>
        </div>
        <small>
          {width} × {height}
        </small>
      </div>
      <div
        className={styles.previewViewportStage}
        style={
          {
            "--preview-display-width": displayWidth,
            "--preview-display-height": displayHeight,
            "--preview-viewport-width": `${width}px`,
            "--preview-viewport-height": `${height}px`,
            "--preview-scale": `${scale}`,
          } as CSSProperties
        }
      >
        <div className={styles.previewViewportWindow}>
          {children}
        </div>
      </div>
    </article>
  );
}

function ThemePreviewCanvas({
  bannerStyle,
  content,
  viewport,
}: {
  bannerStyle: (typeof bannerStyles)[number]["value"];
  content: SiteContent;
  viewport: "desktop" | "tablet" | "mobile";
}) {
  return (
    <div className={styles.themePreviewShell} data-banner-style={bannerStyle} data-viewport={viewport} data-testid={`preview-shell-${viewport}`}>
      <div className={styles.themePreview}>
        <HomePagePreview content={content} viewport={viewport} />
      </div>
    </div>
  );
}

function ThemeRevisionList({
  action,
  busy,
  revisions
}: {
  action: (formData: FormData) => void;
  busy: boolean;
  revisions: ThemeRevision[];
}) {
  if (revisions.length === 0) {
    return <p className={styles.revisionHint}>No saved revisions yet. Save two theme changes to unlock restore coverage.</p>;
  }

  return (
    <div className={styles.revisionList} data-testid="theme-revision-list">
      {revisions.map((revision, index) => (
        <form key={revision.id} action={action} className={styles.revisionCard}>
          <input type="hidden" name="revisionId" value={revision.id} />
          <div>
            <span>{index === 0 ? "Latest previous theme" : "Older previous theme"}</span>
            <strong>{new Date(revision.savedAt).toLocaleString()}</strong>
            <small>
              {revision.theme.bannerStyle ?? "editorial"} · {revision.theme.contrast} / {revision.theme.light.contrast}
            </small>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Restoring..." : `Restore revision ${index + 1}`}
          </button>
        </form>
      ))}
    </div>
  );
}

function SurfaceSlider({
  helper,
  icon,
  label,
  max,
  min,
  name,
  onChange,
  unit,
  value,
}: {
  helper: string;
  icon: string;
  label: string;
  max: number;
  min: number;
  name: string;
  onChange: (value: number) => void;
  unit: string;
  value: number;
}) {
  return (
    <label className={styles.surfaceSliderCard}>
      <span className={styles.surfaceSliderTopline}>
        <strong>
          <i>{icon}</i>
          {label}
        </strong>
        <button type="button" className={styles.tooltipButton} title={helper} aria-label={`Qué hace ${label}`}>
          ?
        </button>
      </span>
      <small>{helper}</small>
      <span className={styles.surfaceSliderValue}>
        {value}
        {unit}
      </span>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onInput={(event) => onChange(Number((event.target as HTMLInputElement).value))}
      />
    </label>
  );
}

function PaletteOptions({
  mode,
  onSelect,
  selected,
  title,
  variants
}: {
  mode: "dark" | "light";
  onSelect: (mode: "dark" | "light", index: number) => void;
  selected: number;
  title: string;
  variants: PaletteVariant[];
}) {
  return (
    <div className={styles.paletteGroup} data-testid={`${mode}-palette-group`}>
      <span>{title}</span>
      <div>
        {variants.map((variant, index) => (
          <button
            key={`${mode}-${variant.label}`}
            type="button"
            className={index === selected ? styles.activePalette : undefined}
            style={{
              "--palette-bg": variant.tokens.background,
              "--palette-fg": readableTextColor(variant.tokens.background)
            } as CSSProperties}
            onClick={() => onSelect(mode, index)}
          >
            <strong>{variant.label}</strong>
            <i style={{ background: variant.tokens.background }} />
            <i style={{ background: variant.tokens.accent }} />
            <i style={{ background: variant.tokens.accentAlt }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("Could not read image.")));
    reader.readAsDataURL(file);
  });
}

async function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Could not load image.")));
    image.src = dataUrl;
  });
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = ((h % 360) + 360) % 360;
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

  return rgbToHex((red + match) * 255, (green + match) * 255, (blue + match) * 255);
}

function rgbToHsl(r: number, g: number, b: number) {
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

  return { h: (hue + 360) % 360, s: saturation * 100, l: lightness * 100 };
}

function hueDistance(a: number, b: number) {
  const distance = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(distance, 360 - distance);
}

function shiftedHue(hue: number, shift: number) {
  return (hue + shift + 360) % 360;
}

async function extractPaletteOptions(dataUrl: string): Promise<PaletteVariantSet> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return { dark: [], light: [] };
  }

  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

  const data = context.getImageData(0, 0, size, size).data;
  const buckets = new Map<string, { count: number; h: number; s: number; l: number }>();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];
    if (alpha < 180) continue;

    const hsl = rgbToHsl(data[index], data[index + 1], data[index + 2]);
    if (hsl.l < 8 || hsl.l > 94 || hsl.s < 8) continue;

    const key = `${Math.round(hsl.h / 18)}-${Math.round(hsl.s / 12)}-${Math.round(hsl.l / 12)}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.count += 1;
      bucket.h += hsl.h;
      bucket.s += hsl.s;
      bucket.l += hsl.l;
    } else {
      buckets.set(key, { count: 1, h: hsl.h, s: hsl.s, l: hsl.l });
    }
  }

  const candidates = [...buckets.values()]
    .map((bucket) => ({
      h: bucket.h / bucket.count,
      s: bucket.s / bucket.count,
      l: bucket.l / bucket.count,
      score: bucket.count * (0.8 + bucket.s / bucket.count / 80)
    }))
    .sort((a, b) => b.score - a.score);

  const diverse = candidates.reduce<Array<{ h: number; s: number; l: number; score: number }>>((picked, candidate) => {
    if (picked.length >= 6) return picked;
    if (picked.every((item) => hueDistance(item.h, candidate.h) > 18)) {
      picked.push(candidate);
    }
    return picked;
  }, []);

  const base = diverse[0] ?? { h: 214, s: 70, l: 58, score: 1 };
  const colorSet = [
    base,
    diverse[1] ?? { ...base, h: shiftedHue(base.h, 32), s: Math.max(42, base.s - 18) },
    diverse[2] ?? { ...base, h: shiftedHue(base.h, -42), s: Math.min(88, base.s + 14) },
    diverse[3] ?? { ...base, h: shiftedHue(base.h, 118), s: Math.max(36, base.s - 28) },
    diverse[4] ?? { ...base, h: shiftedHue(base.h, 180), s: Math.min(92, base.s + 4) },
    diverse[5] ?? { ...base, h: shiftedHue(base.h, -128), s: Math.max(30, base.s - 34) }
  ];

  const moods = [
    { label: "Muted", bgShift: 0, accentShift: 0, altShift: 34, darkBgS: 26, darkBgL: 10, lightBgS: 12, lightBgL: 96, accentS: 46 },
    { label: "Editorial", bgShift: -18, accentShift: 0, altShift: 46, darkBgS: 34, darkBgL: 13, lightBgS: 16, lightBgL: 94, accentS: 58 },
    { label: "Vivid", bgShift: 28, accentShift: 4, altShift: -52, darkBgS: 48, darkBgL: 16, lightBgS: 24, lightBgL: 91, accentS: 78 },
    { label: "Deep", bgShift: 118, accentShift: 0, altShift: 180, darkBgS: 38, darkBgL: 8, lightBgS: 10, lightBgL: 97, accentS: 64 },
    { label: "Studio", bgShift: 180, accentShift: -8, altShift: 72, darkBgS: 42, darkBgL: 18, lightBgS: 20, lightBgL: 92, accentS: 70 },
    { label: "Airy", bgShift: -128, accentShift: 12, altShift: -86, darkBgS: 30, darkBgL: 22, lightBgS: 28, lightBgL: 89, accentS: 52 }
  ];

  return {
    dark: moods.map((mood, index) => {
      const source = colorSet[index];
      return {
      label: mood.label,
      tokens: {
        accent: hslToHex(shiftedHue(source.h, mood.accentShift), Math.max(mood.accentS, source.s), Math.max(46, Math.min(68, source.l + 8))),
        accentAlt: hslToHex(shiftedHue(source.h, mood.altShift), Math.max(38, Math.min(84, source.s - 8)), 62),
        background: hslToHex(shiftedHue(source.h, mood.bgShift), mood.darkBgS, mood.darkBgL)
      }
    }; }),
    light: moods.map((mood, index) => {
      const source = colorSet[index];
      return {
      label: mood.label,
      tokens: {
        accent: hslToHex(shiftedHue(source.h, mood.accentShift), Math.max(46, Math.min(82, source.s + 8)), 38),
        accentAlt: hslToHex(shiftedHue(source.h, mood.altShift), Math.max(34, Math.min(74, source.s - 14)), 34),
        background: hslToHex(shiftedHue(source.h, mood.bgShift), mood.lightBgS, mood.lightBgL)
      }
    }; })
  };
}
