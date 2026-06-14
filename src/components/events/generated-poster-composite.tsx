"use client";

import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  posterVisibleFieldIds,
  type PosterOverlayAnchor,
  type PosterOverlayLayoutConfig,
  type PosterOverlayTypographyStyle,
  type PosterOverlayLayout,
  type PosterTextOverlayMode,
  type PosterVisibleFieldId,
  type PosterOverlayViewport,
  type VenueEventRecord,
} from "@/lib/event-types";
import { buildPosterPreviewTheme } from "./poster-theme";
import styles from "./generated-poster-composite.module.scss";

type RelatedEvent = { slug: string; title: string };

type GeneratedPosterCompositeProps = {
  event: VenueEventRecord;
  posterUrl: string;
  relatedEvents?: RelatedEvent[];
  mode?: "page" | "preview";
  viewport?: "desktop" | "tablet" | "mobile";
  overlayMode?: PosterTextOverlayMode;
  artworkFit?: "cover" | "contain";
  themeVars?: CSSProperties;
  editorMode?: boolean;
  selectedEditorRole?: PosterBlockRole | null;
  selectedEditorLayer?: PosterEditorSelectionLayer;
  onEditorRolePointerDown?: (
    role: PosterBlockRole,
    layer: PosterEditorSelectionLayer,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onEditorRoleSelect?: (role: PosterBlockRole, layer: PosterEditorSelectionLayer) => void;
  onEditorRoleResizePointerDown?: (
    role: PosterBlockRole,
    layer: PosterEditorSelectionLayer,
    corner: "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se",
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onEditorRoleRotatePointerDown?: (role: PosterBlockRole, event: ReactPointerEvent<HTMLElement>) => void;
};

export type PosterViewport = "desktop" | "tablet" | "mobile";
export type PosterBlockRole = "hero" | "story" | "lineup" | "action";
export type PosterEditorSelectionLayer = "inner" | "outer";

const POSTER_ROLE_SCALE_MIN = 0.4;
const POSTER_ROLE_SCALE_MAX = 3.2;

export const defaultPosterOverlayLayout: Required<PosterOverlayLayout> = {
  heroAnchor: "bottom-left",
  lineupAnchor: "top-left",
  actionAnchor: "top-right",
  storyAnchor: "middle-right",
  heroOffsetX: 0,
  heroOffsetY: 0,
  heroScale: 1,
  heroScaleX: 1,
  heroScaleY: 1,
  heroBoxScale: 1,
  heroBoxScaleX: 1,
  heroBoxScaleY: 1,
  heroRotation: 0,
  heroOpacity: 1,
  lineupOffsetX: 0,
  lineupOffsetY: 0,
  lineupScale: 1,
  lineupScaleX: 1,
  lineupScaleY: 1,
  lineupBoxScale: 1,
  lineupBoxScaleX: 1,
  lineupBoxScaleY: 1,
  lineupRotation: 0,
  lineupOpacity: 1,
  actionOffsetX: 0,
  actionOffsetY: 0,
  actionScale: 1,
  actionScaleX: 1,
  actionScaleY: 1,
  actionBoxScale: 1,
  actionBoxScaleX: 1,
  actionBoxScaleY: 1,
  actionRotation: 0,
  actionOpacity: 1,
  storyOffsetX: 0,
  storyOffsetY: 0,
  storyScale: 1,
  storyScaleX: 1,
  storyScaleY: 1,
  storyBoxScale: 1,
  storyBoxScaleX: 1,
  storyBoxScaleY: 1,
  storyRotation: 0,
  storyOpacity: 1,
  textAlign: "left",
  typographyStyle: "display",
  fontScale: 1,
  elementScale: 1,
  cardScale: 1,
  density: "balanced",
  cardStyle: "glass",
};

export function clampPosterControl(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getAnchorOrigin(anchor: PosterOverlayAnchor) {
  const [vertical, horizontal] = anchor.split("-") as ["top" | "middle" | "bottom", "left" | "center" | "right"];
  const y = vertical === "top" ? "0%" : vertical === "middle" ? "50%" : "100%";
  const x = horizontal === "left" ? "0%" : horizontal === "center" ? "50%" : "100%";
  return `${x} ${y}`;
}

function getLayoutOffset(role: PosterBlockRole, layout: Required<PosterOverlayLayout>) {
  if (role === "hero") {
    return { x: layout.heroOffsetX, y: layout.heroOffsetY };
  }

  if (role === "lineup") {
    return { x: layout.lineupOffsetX, y: layout.lineupOffsetY };
  }

  if (role === "action") {
    return { x: layout.actionOffsetX, y: layout.actionOffsetY };
  }

  return { x: layout.storyOffsetX, y: layout.storyOffsetY };
}

function getRoleScaleX(role: PosterBlockRole, layout: Required<PosterOverlayLayout>) {
  if (role === "hero") return layout.heroScaleX ?? layout.heroScale;
  if (role === "lineup") return layout.lineupScaleX ?? layout.lineupScale;
  if (role === "action") return layout.actionScaleX ?? layout.actionScale;
  return layout.storyScaleX ?? layout.storyScale;
}

function getRoleScaleY(role: PosterBlockRole, layout: Required<PosterOverlayLayout>) {
  if (role === "hero") return layout.heroScaleY ?? layout.heroScale;
  if (role === "lineup") return layout.lineupScaleY ?? layout.lineupScale;
  if (role === "action") return layout.actionScaleY ?? layout.actionScale;
  return layout.storyScaleY ?? layout.storyScale;
}

function getRoleBoxScaleX(role: PosterBlockRole, layout: Required<PosterOverlayLayout>) {
  if (role === "hero") return layout.heroBoxScaleX ?? layout.heroBoxScale;
  if (role === "lineup") return layout.lineupBoxScaleX ?? layout.lineupBoxScale;
  if (role === "action") return layout.actionBoxScaleX ?? layout.actionBoxScale;
  return layout.storyBoxScaleX ?? layout.storyBoxScale;
}

function getRoleBoxScaleY(role: PosterBlockRole, layout: Required<PosterOverlayLayout>) {
  if (role === "hero") return layout.heroBoxScaleY ?? layout.heroBoxScale;
  if (role === "lineup") return layout.lineupBoxScaleY ?? layout.lineupBoxScale;
  if (role === "action") return layout.actionBoxScaleY ?? layout.actionBoxScale;
  return layout.storyBoxScaleY ?? layout.storyBoxScale;
}

function getRoleRotation(role: PosterBlockRole, layout: Required<PosterOverlayLayout>) {
  if (role === "hero") return layout.heroRotation;
  if (role === "lineup") return layout.lineupRotation;
  if (role === "action") return layout.actionRotation;
  return layout.storyRotation;
}

function getRoleOpacity(role: PosterBlockRole, layout: Required<PosterOverlayLayout>) {
  if (role === "hero") return layout.heroOpacity;
  if (role === "lineup") return layout.lineupOpacity;
  if (role === "action") return layout.actionOpacity;
  return layout.storyOpacity;
}

function isViewportOverlayLayout(
  layout: PosterOverlayLayoutConfig | undefined,
): layout is Partial<Record<PosterOverlayViewport, PosterOverlayLayout>> {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return false;
  }

  return ["desktop", "tablet", "mobile"].some((viewport) => {
    const candidate = (layout as Record<string, unknown>)[viewport];
    return Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate));
  });
}

function resolvePosterOverlayLayout(
  layout: PosterOverlayLayoutConfig | undefined,
  viewport: PosterOverlayViewport,
): Required<PosterOverlayLayout> {
  if (isViewportOverlayLayout(layout)) {
    return {
      ...defaultPosterOverlayLayout,
      ...(layout.desktop ?? {}),
      ...(layout[viewport] ?? {}),
    } satisfies Required<PosterOverlayLayout>;
  }

  return {
    ...defaultPosterOverlayLayout,
    ...(layout ?? {}),
  } satisfies Required<PosterOverlayLayout>;
}

export function getPosterBlockStyle(
  role: PosterBlockRole,
  layoutInput: PosterOverlayLayoutConfig | undefined,
  viewport: PosterViewport,
): CSSProperties {
  const layout = resolvePosterOverlayLayout(layoutInput, viewport);
  const anchor =
    role === "hero"
      ? layout.heroAnchor
      : role === "lineup"
        ? layout.lineupAnchor
        : role === "action"
          ? layout.actionAnchor
          : layout.storyAnchor;
  const [vertical, horizontal] = anchor.split("-") as ["top" | "middle" | "bottom", "left" | "center" | "right"];

  const layoutMap = {
    desktop: {
      hero: { colSpan: 7, rowSpan: 5, cols: { left: 1, center: 3, right: 6 }, rows: { top: 2, middle: 3, bottom: 4 } },
      story: { colSpan: 5, rowSpan: 4, cols: { left: 1, center: 4, right: 8 }, rows: { top: 2, middle: 4, bottom: 5 } },
      lineup: { colSpan: 4, rowSpan: 2, cols: { left: 1, center: 5, right: 9 }, rows: { top: 2, middle: 4, bottom: 7 } },
      action: { colSpan: 4, rowSpan: 2, cols: { left: 1, center: 5, right: 9 }, rows: { top: 2, middle: 4, bottom: 7 } },
    },
    tablet: {
      hero: { colSpan: 8, rowSpan: 5, cols: { left: 1, center: 3, right: 5 }, rows: { top: 2, middle: 3, bottom: 4 } },
      story: { colSpan: 5, rowSpan: 4, cols: { left: 1, center: 4, right: 8 }, rows: { top: 2, middle: 4, bottom: 5 } },
      lineup: { colSpan: 5, rowSpan: 2, cols: { left: 1, center: 4, right: 8 }, rows: { top: 2, middle: 4, bottom: 7 } },
      action: { colSpan: 4, rowSpan: 2, cols: { left: 1, center: 4, right: 8 }, rows: { top: 2, middle: 4, bottom: 7 } },
    },
    mobile: {
      hero: { colSpan: 6, rowSpan: 3, cols: { left: 1, center: 1, right: 1 }, rows: { top: 2, middle: 4, bottom: 5 } },
      story: { colSpan: 6, rowSpan: 2, cols: { left: 1, center: 1, right: 1 }, rows: { top: 2, middle: 4, bottom: 7 } },
      lineup: { colSpan: 6, rowSpan: 2, cols: { left: 1, center: 1, right: 1 }, rows: { top: 2, middle: 6, bottom: 8 } },
      action: { colSpan: 4, rowSpan: 2, cols: { left: 1, center: 2, right: 3 }, rows: { top: 3, middle: 6, bottom: 8 } },
    },
  } as const;

  const spec = layoutMap[viewport][role];
  const offset = getLayoutOffset(role, layout);
  const elementScale = clampPosterControl(layout.elementScale, 0.8, 1.22);
  const roleScaleX = clampPosterControl(getRoleScaleX(role, layout), POSTER_ROLE_SCALE_MIN, POSTER_ROLE_SCALE_MAX);
  const roleScaleY = clampPosterControl(getRoleScaleY(role, layout), POSTER_ROLE_SCALE_MIN, POSTER_ROLE_SCALE_MAX);
  const roleBoxScaleX = clampPosterControl(getRoleBoxScaleX(role, layout), POSTER_ROLE_SCALE_MIN, POSTER_ROLE_SCALE_MAX);
  const roleBoxScaleY = clampPosterControl(getRoleBoxScaleY(role, layout), POSTER_ROLE_SCALE_MIN, POSTER_ROLE_SCALE_MAX);
  const roleRotation = clampPosterControl(getRoleRotation(role, layout), -24, 24);
  return {
    gridColumn: `${spec.cols[horizontal]} / span ${spec.colSpan}`,
    gridRow: `${spec.rows[vertical]} / span ${spec.rowSpan}`,
    justifySelf: horizontal === "left" ? "start" : horizontal === "center" ? "center" : "end",
    alignSelf: vertical === "top" ? "start" : vertical === "middle" ? "center" : "end",
    textAlign: layout.textAlign,
    transform: `translate(calc(${offset.x} * 1cqw), calc(${offset.y} * 1cqh)) rotate(${roleRotation}deg) scale(${roleScaleX}, ${roleScaleY})`,
    transformOrigin: getAnchorOrigin(anchor),
    "--poster-role-scale-x": String(roleScaleX),
    "--poster-role-scale-y": String(roleScaleY),
    "--poster-role-box-scale-x": String(roleBoxScaleX),
    "--poster-role-box-scale-y": String(roleBoxScaleY),
    "--poster-role-element-scale": String(elementScale),
    "--poster-role-opacity": String(clampPosterControl(getRoleOpacity(role, layout), 0.2, 1)),
  } as CSSProperties;
}

function resolveTitleRowCount(wordCount: number, viewport: "desktop" | "tablet" | "mobile") {
  if (viewport === "mobile") {
    return wordCount > 4 ? 3 : 2;
  }

  if (viewport === "tablet") {
    return wordCount > 5 ? 3 : 2;
  }

  return wordCount > 6 ? 3 : 2;
}

function buildBalancedTitleRows(title: string, viewport: "desktop" | "tablet" | "mobile") {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 1) {
    return title.trim();
  }

  const targetRows = Math.min(resolveTitleRowCount(words.length, viewport), words.length);
  const lengths = words.map((word) => word.length);
  const totalLength = lengths.reduce((sum, length) => sum + length, 0) + Math.max(0, words.length - 1);
  const averageRowLength = totalLength / targetRows;

  let bestRows: string[] = [title.trim()];
  let bestScore = Number.POSITIVE_INFINITY;

  function scoreRows(rows: string[]) {
    const rowLengths = rows.map((row) => row.length);
    const longest = Math.max(...rowLengths);
    const shortest = Math.min(...rowLengths);
    const variance = rowLengths.reduce((sum, rowLength) => sum + Math.abs(rowLength - averageRowLength), 0);
    const orphanPenalty = rows.reduce((sum, row, index) => {
      const rowWords = row.split(" ");
      const firstOrLast = index === 0 || index === rows.length - 1;
      if (rowWords.length === 1 && rowWords[0].length <= 4) {
        return sum + (firstOrLast ? 11 : 7);
      }

      return sum;
    }, 0);
    const steepDropPenalty = rows.reduce((sum, row, index) => {
      if (index === 0) {
        return sum;
      }

      return sum + Math.max(0, rows[index - 1].length - row.length - 8);
    }, 0);

    return variance + (longest - shortest) * 1.6 + orphanPenalty + steepDropPenalty;
  }

  function search(startIndex: number, rowsLeft: number, currentRows: string[]) {
    if (rowsLeft === 1) {
      const nextRows = [...currentRows, words.slice(startIndex).join(" ")];
      const nextScore = scoreRows(nextRows);

      if (nextScore < bestScore) {
        bestScore = nextScore;
        bestRows = nextRows;
      }

      return;
    }

    const maxEnd = words.length - rowsLeft + 1;

    for (let end = startIndex + 1; end <= maxEnd; end += 1) {
      const row = words.slice(startIndex, end).join(" ");
      search(end, rowsLeft - 1, [...currentRows, row]);
    }
  }

  search(0, targetRows, []);
  return bestRows.join("\n");
}

function formatMetaDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    .format(new Date(dateValue))
    .toUpperCase();
}

function formatTime(dateValue: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function buildTicketPriceLabel(event: VenueEventRecord) {
  return `Entradas: ${event.ticketPriceMXN} + ${event.ticketFeeMXN} MXN`;
}

function compactText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, Math.max(0, maxLength - 1)).trim();
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trim();
}

function getTypographyClass(style: PosterOverlayTypographyStyle) {
  if (style === "editorial") {
    return styles.typographyEditorial;
  }

  if (style === "mono") {
    return styles.typographyMono;
  }

  return styles.typographyDisplay;
}

export function GeneratedPosterComposite({
  event,
  posterUrl,
  relatedEvents = [],
  mode = "page",
  viewport = "desktop",
  overlayMode,
  artworkFit = "cover",
  themeVars,
  editorMode = false,
  selectedEditorRole = null,
  selectedEditorLayer = "inner",
  onEditorRolePointerDown,
  onEditorRoleSelect,
  onEditorRoleResizePointerDown,
  onEditorRoleRotatePointerDown,
}: GeneratedPosterCompositeProps) {
  const resolvedOverlayMode = overlayMode ?? event.posterTextOverlayMode ?? "editorial-band";
  const [derivedThemeVars, setDerivedThemeVars] = useState<CSSProperties | undefined>(themeVars);
  const mergedThemeVars = themeVars ?? derivedThemeVars;
  const overlayLayout = resolvePosterOverlayLayout(event.posterOverlayLayout, viewport);
  const handoffRows =
    event.publishedPoster?.layout.titleRows?.filter(Boolean) ??
    event.draftPoster?.layout.titleRows?.filter(Boolean) ??
    [];
  const titleRows = handoffRows.length > 0 ? handoffRows.join("\n") : buildBalancedTitleRows(event.title, viewport);
  const normalizedSummary = event.summary.trim();
  const normalizedDescription = event.description.trim();
  const normalizedAddress = event.venueAddress.trim();
  const normalizedGenres = event.genre.filter(Boolean);
  const visibleFields = event.posterVisibleFields?.length ? event.posterVisibleFields : posterVisibleFieldIds;
  const isVisible = (field: PosterVisibleFieldId) => visibleFields.includes(field);
  const showVenue = isVisible("venue") && Boolean(event.venueName.trim());
  const showDate = isVisible("date") && Boolean(event.startsAt);
  const showAddress = isVisible("address") && Boolean(normalizedAddress);
  const showSummary = isVisible("summary") && Boolean(normalizedSummary);
  const showDescription = isVisible("description") && Boolean(normalizedDescription) && normalizedDescription !== normalizedSummary;
  const showSchedule = isVisible("schedule") && Boolean(event.doorTime || event.startsAt);
  const showLineup = isVisible("lineup");
  const showGenre = isVisible("genre");
  const showPricing = isVisible("pricing");
  const showCta = isVisible("cta");
  const showRelated = isVisible("related");
  const showAddressDetail = showAddress && (viewport !== "mobile" || !showSchedule);
  const headlineGenre =
    (showGenre ? normalizedGenres.slice(0, 2).join(", ").toUpperCase() : "") ||
    (showSummary && normalizedSummary.length <= 28 ? normalizedSummary.toUpperCase() : "LIVE EVENT");
  const visibleLineupCount = viewport === "mobile" ? 2 : viewport === "tablet" ? 3 : 4;
  const visibleLineup = event.lineup.slice(0, visibleLineupCount);
  const shouldShowSummary = showSummary && normalizedSummary.toUpperCase() !== headlineGenre;
  const showStoryCard = showDescription;
  const showLineupCard = showLineup && visibleLineup.length > 0;
  const related = relatedEvents[0];
  const buyCta = showCta
    ? mode === "preview" ? (
      <span className={styles.buyButton}>Comprar boleto</span>
    ) : (
      <a className={styles.buyButton} href={`/checkout?event=${event.slug}`}>
        Comprar boleto
      </a>
    )
    : null;
  const relatedCta =
    showRelated && related && mode === "page" ? (
      <a className={styles.relatedLink} href={`/events/${related.slug}`}>
        {related.title}
      </a>
    ) : showRelated && related ? (
      <span className={styles.relatedLink}>{related.title}</span>
    ) : null;
  const metaItems = [
    showVenue ? compactText(event.venueName, viewport === "mobile" ? 16 : viewport === "tablet" ? 22 : 28) : null,
    showDate ? formatMetaDate(event.startsAt) : null,
    showPricing ? buildTicketPriceLabel(event) : null,
  ].filter(Boolean);
  const showActionCard = Boolean(showSchedule || showAddressDetail || buyCta || relatedCta);
  const heroStyle = getPosterBlockStyle("hero", overlayLayout, viewport);
  const storyStyle = getPosterBlockStyle("story", overlayLayout, viewport);
  const lineupStyle = getPosterBlockStyle("lineup", overlayLayout, viewport);
  const actionStyle = getPosterBlockStyle("action", overlayLayout, viewport);
  const selectedLayer = selectedEditorLayer ?? "inner";

  function renderEditorChrome(role: PosterBlockRole) {
    if (!editorMode) {
      return null;
    }

    const roleSelected = selectedEditorRole === role;
    const outerSelected = roleSelected && selectedLayer === "outer";
    const innerSelected = roleSelected && selectedLayer === "inner";

    return (
      <div className={styles.editorChrome}>
        <div className={styles.editorOuterRegion}>
          {(["Top", "Right", "Bottom", "Left"] as const).map((side) => (
            <button
              key={`${role}-${side}`}
              type="button"
              className={`${styles.editorOuterRegionButton} ${styles[`editorOuterRegion${side}`]} ${
                outerSelected ? styles.editorOuterRegionSelected : ""
              }`}
              onPointerDown={
                onEditorRolePointerDown
                  ? (event) => {
                      event.stopPropagation();
                      onEditorRolePointerDown(role, "outer", event);
                    }
                  : undefined
              }
              onClick={
                onEditorRoleSelect
                  ? (event) => {
                      event.stopPropagation();
                      onEditorRoleSelect(role, "outer");
                    }
                  : undefined
              }
              aria-label={`Seleccionar contenedor externo de ${role}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={`${styles.editorInnerRegionButton} ${innerSelected ? styles.editorInnerRegionSelected : ""}`}
          onPointerDown={
            onEditorRolePointerDown
              ? (event) => {
                  event.stopPropagation();
                  onEditorRolePointerDown(role, "inner", event);
                }
              : undefined
          }
          onClick={
            onEditorRoleSelect
              ? (event) => {
                  event.stopPropagation();
                  onEditorRoleSelect(role, "inner");
                }
              : undefined
          }
          aria-label={`Seleccionar figura interna de ${role}`}
        />
        <span
          aria-hidden="true"
          className={`${styles.editorInnerChrome} ${innerSelected ? styles.editorInnerChromeSelected : ""}`}
        />
        <span
          aria-hidden="true"
          className={`${styles.editorOuterChrome} ${outerSelected ? styles.editorOuterChromeSelected : ""}`}
        />
        {roleSelected && selectedLayer === "outer" && onEditorRoleRotatePointerDown ? (
          <button
            type="button"
            className={styles.editorRotateHandle}
            onPointerDown={(event) => {
              event.stopPropagation();
              onEditorRoleRotatePointerDown(role, event);
            }}
            aria-label={`Rotar ${role}`}
          />
        ) : null}
        {renderResizeHandles(role, "outer")}
        {renderResizeHandles(role, "inner")}
      </div>
    );
  }

  function renderResizeHandles(role: PosterBlockRole, layer: PosterEditorSelectionLayer) {
    if (!editorMode || selectedEditorRole !== role || !onEditorRoleResizePointerDown) {
      return null;
    }

    return (
      <>
        {(["n", "e", "s", "w", "nw", "ne", "sw", "se"] as const).map((corner) => (
          <button
            key={`${role}-${layer}-${corner}`}
            type="button"
            className={`${styles.editorResizeHandle} ${
              layer === "outer" ? styles.editorResizeHandleOuter : styles.editorResizeHandleInner
            } ${styles[`editorResizeHandle${corner.toUpperCase()}`]}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              onEditorRoleResizePointerDown(role, layer, corner, event);
            }}
            aria-label={`Redimensionar ${role}`}
          />
        ))}
      </>
    );
  }

  useEffect(() => {
    let cancelled = false;

    if (themeVars) {
      return () => {
        cancelled = true;
      };
    }

    if (!posterUrl) {
      return () => {
        cancelled = true;
      };
    }

    void buildPosterPreviewTheme(posterUrl)
      .then((nextTheme) => {
        if (!cancelled) {
          setDerivedThemeVars(nextTheme ?? undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDerivedThemeVars(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [posterUrl, themeVars]);

  return (
    <article
      className={[
        styles.shell,
        mode === "page" ? styles.pageShell : styles.previewShell,
        styles[`overlay-${resolvedOverlayMode}`],
        artworkFit === "contain" ? styles.artworkContain : styles.artworkCover,
        showStoryCard ? "" : styles.storylessLayout,
        showLineupCard ? "" : styles.lineuplessLayout,
        viewport === "mobile"
          ? styles.viewportMobile
          : viewport === "tablet"
            ? styles.viewportTablet
            : styles.viewportDesktop,
      ].join(" ")}
      data-overlay-density={overlayLayout.density}
      data-card-style={overlayLayout.cardStyle}
      data-text-align={overlayLayout.textAlign}
      data-typography-style={overlayLayout.typographyStyle}
      style={{
        "--poster-artwork": `url(${posterUrl})`,
        "--poster-font-scale": String(clampPosterControl(overlayLayout.fontScale, 0.84, 1.22)),
        "--poster-element-scale": String(clampPosterControl(overlayLayout.elementScale, 0.8, 1.22)),
        "--poster-card-scale": String(clampPosterControl(overlayLayout.cardScale, 0.76, 1.12)),
        ...mergedThemeVars,
      } as CSSProperties}
    >
      <div className={styles.artworkWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterUrl} alt={`Poster oficial de ${event.title}`} className={styles.artwork} />
      </div>
      <div className={styles.scrim} />
      <div className={styles.grain} />

      {metaItems.length > 0 ? (
        <div className={styles.metaStrip}>
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}

      <header
        className={`${styles.hero} ${getTypographyClass(overlayLayout.typographyStyle)} ${editorMode ? styles.editorMovable : ""} ${selectedEditorRole === "hero" ? styles.editorSelected : ""}`}
        style={heroStyle}
        onPointerDown={
          editorMode && onEditorRolePointerDown ? (event) => onEditorRolePointerDown("hero", "inner", event) : undefined
        }
        onClick={editorMode && onEditorRoleSelect ? () => onEditorRoleSelect("hero", "inner") : undefined}
        data-editor-role={editorMode ? "hero" : undefined}
      >
        <p className={styles.eyebrow}>{headlineGenre}</p>
        <h1 className={styles.title}>{titleRows}</h1>
        {shouldShowSummary ? (
          <p className={styles.summary}>
            {compactText(normalizedSummary, viewport === "mobile" ? 54 : viewport === "tablet" ? 86 : 128)}
          </p>
        ) : null}
        {renderEditorChrome("hero")}
      </header>

      {showStoryCard ? (
        <aside
          className={`${styles.storyCard} ${styles.card} ${editorMode ? styles.editorMovable : ""} ${selectedEditorRole === "story" ? styles.editorSelected : ""}`}
          style={storyStyle}
          onPointerDown={
            editorMode && onEditorRolePointerDown ? (event) => onEditorRolePointerDown("story", "inner", event) : undefined
          }
          onClick={editorMode && onEditorRoleSelect ? () => onEditorRoleSelect("story", "inner") : undefined}
          data-editor-role={editorMode ? "story" : undefined}
        >
          <span>Ciudad en vivo</span>
          <p>{compactText(normalizedDescription, viewport === "desktop" ? 170 : viewport === "tablet" ? 120 : 92)}</p>
          {renderEditorChrome("story")}
        </aside>
      ) : null}

      {showLineupCard ? (
        <section
          className={`${styles.lineupCard} ${styles.card} ${editorMode ? styles.editorMovable : ""} ${selectedEditorRole === "lineup" ? styles.editorSelected : ""}`}
          style={lineupStyle}
          onPointerDown={
            editorMode && onEditorRolePointerDown ? (event) => onEditorRolePointerDown("lineup", "inner", event) : undefined
          }
          onClick={editorMode && onEditorRoleSelect ? () => onEditorRoleSelect("lineup", "inner") : undefined}
          data-editor-role={editorMode ? "lineup" : undefined}
        >
          <span>Lineup</span>
          <div className={styles.lineupList}>
            {visibleLineup.map((artist) => (
              <strong key={artist}>{artist}</strong>
            ))}
            {event.lineup.length > visibleLineup.length ? <em>+{event.lineup.length - visibleLineup.length}</em> : null}
          </div>
          {renderEditorChrome("lineup")}
        </section>
      ) : null}

      {showActionCard ? (
        <section
          className={`${styles.actionCard} ${styles.card} ${editorMode ? styles.editorMovable : ""} ${selectedEditorRole === "action" ? styles.editorSelected : ""}`}
          style={actionStyle}
          onPointerDown={
            editorMode && onEditorRolePointerDown ? (event) => onEditorRolePointerDown("action", "inner", event) : undefined
          }
          onClick={editorMode && onEditorRoleSelect ? () => onEditorRoleSelect("action", "inner") : undefined}
          data-editor-role={editorMode ? "action" : undefined}
        >
          <span>{showSchedule ? "Horarios" : showAddress ? "Dirección" : showCta ? "Acceso" : "Relacionado"}</span>
          {showSchedule ? (
            <div className={styles.schedule}>
              {showDate ? <strong>{formatMetaDate(event.startsAt)}</strong> : null}
              {event.doorTime ? <strong>Doors {formatTime(event.doorTime)}</strong> : null}
              {event.startsAt ? <strong>Show {formatTime(event.startsAt)}</strong> : null}
            </div>
          ) : null}
          {showAddressDetail ? (
            <p className={styles.actionDetail}>
              {compactText(normalizedAddress, viewport === "mobile" ? 56 : viewport === "tablet" ? 72 : 92)}
            </p>
          ) : null}
          {buyCta}
          {relatedCta}
          {renderEditorChrome("action")}
        </section>
      ) : null}
    </article>
  );
}
