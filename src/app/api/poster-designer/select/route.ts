import { NextResponse } from "next/server";
import { getPosterDesignerSelectUrl } from "@/lib/poster-designer-api";

function toPublicPosterUrl(apiUrl: string, relativeUrl: string) {
  const base = new URL(apiUrl);
  return new URL(relativeUrl, `${base.origin}/`).toString();
}

export async function POST(request: Request) {
  const payload = await request.json();
  const endpoint = getPosterDesignerSelectUrl();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") && text ? JSON.parse(text) : { detail: text };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          detail: body?.detail || "No fue posible seleccionar el poster recomendado.",
        },
        { status: response.status },
      );
    }

    const savedAsset = body?.saved_asset
      ? {
          ...body.saved_asset,
          poster_url: body.saved_asset.relative_url ? toPublicPosterUrl(endpoint, body.saved_asset.relative_url) : null,
        }
      : null;

    return NextResponse.json({ ok: true, ...body, saved_asset: savedAsset }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        detail:
          error instanceof Error
            ? `${error.message}. Asegura que el servicio FastAPI del diseñador este corriendo en ${endpoint}.`
            : "No fue posible conectar con el selector del diseñador IA.",
      },
      { status: 502 },
    );
  }
}
