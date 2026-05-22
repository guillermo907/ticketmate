import { NextResponse } from "next/server";
import { getPosterDesignerCleanupUrl, getPosterDesignerGenerateUrl } from "@/lib/poster-designer-api";

type LegacyGeneratePayload = {
  prompt?: string;
  design_context?: string;
  event_name?: string;
  lineup?: string[] | string;
  event_date?: string;
  venue?: string;
  city?: string;
  price?: string;
  editorial_notes?: string;
  restrictions?: string[];
};

type NewGeneratePayload = {
  event?: {
    creative_direction?: string;
    title?: string;
    date_time?: string;
    venue?: string;
    city?: string;
    lineup?: string[];
    price?: string;
    editorial_notes?: string;
    restrictions?: string[];
  };
  num_concepts?: number;
  format?: string;
  keep_hours?: number;
};

type BackendConcept = {
  concept_id?: string;
  style_title?: string;
  design_storytelling?: string;
  art_direction?: string;
};

type BackendConceptScore = {
  concept_id?: string;
  total_score?: number | null;
  rank?: number | null;
  recommendation_label?: string | null;
  summary?: string;
  warnings?: string[];
  target_genres?: string[];
  target_subfamilies?: string[];
};

type BackendAsset = {
  concept_id?: string;
  asset_id?: string;
  relative_url?: string;
};

type BackendGenerateResponse = {
  proposals?: unknown[];
  backend?: string;
  generation_id?: string | null;
  brief?: unknown;
  concepts?: BackendConcept[];
  concept_scores?: BackendConceptScore[];
  assets?: BackendAsset[];
};

function normalizeLineup(lineup: LegacyGeneratePayload["lineup"]) {
  if (Array.isArray(lineup)) {
    return lineup.filter(Boolean);
  }

  if (typeof lineup === "string") {
    return lineup
      .split(/[,\n/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toBackendPayload(payload: LegacyGeneratePayload | NewGeneratePayload) {
  if ("event" in payload && payload.event) {
    return payload;
  }

  const legacy = payload as LegacyGeneratePayload;
  const venueText = legacy.venue?.trim() || "Venue por definir";
  const city = legacy.city?.trim() || inferCityFromVenue(venueText);

  return {
    event: {
      creative_direction: [legacy.prompt, legacy.design_context].filter(Boolean).join(" | "),
      title: legacy.event_name || "Evento sin titulo",
      date_time: legacy.event_date || "Fecha por definir",
      venue: venueText,
      city,
      lineup: normalizeLineup(legacy.lineup),
      price: legacy.price || "Precio por anunciar",
      editorial_notes: legacy.editorial_notes || legacy.design_context || "",
      restrictions: legacy.restrictions || [],
    },
    num_concepts: 3,
    format: "2:3",
    keep_hours: 24,
  };
}

function inferCityFromVenue(venueText: string) {
  const segments = venueText.split(/[·,-]/).map((item) => item.trim()).filter(Boolean);
  return segments[segments.length - 1] || "Guadalajara";
}

function toPublicPosterUrl(apiUrl: string, relativeUrl: string) {
  const base = new URL(apiUrl);
  return new URL(relativeUrl, `${base.origin}/`).toString();
}

function normalizeGenerateResponse(body: BackendGenerateResponse, endpoint: string) {
  if (Array.isArray(body?.proposals)) {
    return body;
  }

  const concepts = Array.isArray(body?.concepts) ? body.concepts : [];
  const conceptScores = Array.isArray(body?.concept_scores) ? body.concept_scores : [];
  const assets = Array.isArray(body?.assets) ? body.assets : [];
  const proposals = assets.map((asset: BackendAsset, index: number) => {
    const concept = concepts.find((entry: BackendConcept) => entry.concept_id === asset.concept_id);
    const score = conceptScores.find((entry: BackendConceptScore) => entry.concept_id === asset.concept_id);
    return {
      proposal_id: index + 1,
      concept_id: asset.concept_id,
      asset_id: asset.asset_id,
      style_title: concept?.style_title || asset.concept_id || `Poster ${index + 1}`,
      design_storytelling: concept?.design_storytelling || concept?.art_direction || "",
      poster_url: toPublicPosterUrl(endpoint, asset.relative_url),
      relative_url: asset.relative_url,
      total_score: score?.total_score ?? null,
      rank: score?.rank ?? null,
      recommendation_label: score?.recommendation_label ?? null,
      summary: score?.summary ?? "",
      warnings: Array.isArray(score?.warnings) ? score.warnings : [],
      target_genres: Array.isArray(score?.target_genres) ? score.target_genres : [],
      target_subfamilies: Array.isArray(score?.target_subfamilies) ? score.target_subfamilies : [],
    };
  });

  return {
    ok: true,
    backend: body?.backend || "unknown",
    generation_id: body?.generation_id || null,
    brief: body?.brief || null,
    concepts,
    concept_scores: conceptScores,
    assets,
    proposals,
  };
}

function parseCleanupGroups(payload: { generation_id?: string; asset_ids?: string[]; poster_urls?: string[] }) {
  if (payload?.generation_id || payload?.asset_ids) {
    return [payload];
  }

  const posterUrls = Array.isArray(payload?.poster_urls) ? payload.poster_urls : [];
  const groups = new Map<string, string[]>();

  for (const posterUrl of posterUrls) {
    if (typeof posterUrl !== "string") {
      continue;
    }

    const match = posterUrl.match(/\/public\/tmp\/([^/]+)\/([^/]+)\.png$/);
    if (!match) {
      continue;
    }

    const [, generationId, fileStem] = match;
    const assetId = fileStem.split("-").slice(2).join("-");
    if (!assetId) {
      continue;
    }

    const group = groups.get(generationId) || [];
    group.push(assetId);
    groups.set(generationId, group);
  }

  return Array.from(groups.entries()).map(([generation_id, asset_ids]) => ({
    generation_id,
    asset_ids,
  }));
}

export async function POST(request: Request) {
  const payload = await request.json();
  const endpoint = getPosterDesignerGenerateUrl();
  const backendPayload = toBackendPayload(payload);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
      cache: "no-store",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") && text ? JSON.parse(text) : { detail: text };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          detail: body?.detail || "No fue posible generar propuestas con el diseñador IA.",
        },
        { status: response.status },
      );
    }

    return NextResponse.json(normalizeGenerateResponse(body, endpoint), { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        detail:
          error instanceof Error
            ? `${error.message}. Asegura que el servicio FastAPI del diseñador este corriendo en ${endpoint}.`
            : "No fue posible conectar con el diseñador IA.",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const payload = await request.json();
  const endpoint = getPosterDesignerCleanupUrl();
  const cleanupGroups = parseCleanupGroups(payload);

  try {
    const results = [];

    for (const group of cleanupGroups) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(group),
        cache: "no-store",
      });

      const text = await response.text();
      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json") && text ? JSON.parse(text) : { detail: text };

      if (!response.ok) {
        return NextResponse.json(
          {
            ok: false,
            detail: body?.detail || "No fue posible borrar posters temporales del diseñador IA.",
          },
          { status: response.status },
        );
      }

      results.push(body);
    }

    return NextResponse.json(
      {
        ok: true,
        deleted_asset_ids: results.flatMap((item) => item?.deleted_asset_ids || []),
        deleted_files: results.flatMap((item) => item?.deleted_files || []),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        detail:
          error instanceof Error
            ? `${error.message}. Asegura que el servicio FastAPI del diseñador este corriendo en ${endpoint}.`
            : "No fue posible conectar con el diseñador IA.",
      },
      { status: 502 },
    );
  }
}
