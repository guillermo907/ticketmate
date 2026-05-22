import { NextResponse } from "next/server";
import { getPosterDesignerHealthUrl } from "@/lib/poster-designer-api";

export async function GET() {
  const endpoint = getPosterDesignerHealthUrl();

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") && text ? JSON.parse(text) : { detail: text };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          detail: body?.detail || "El backend del diseñador no respondió correctamente.",
          endpoint,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true, endpoint, backend: body }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        endpoint,
        detail:
          error instanceof Error
            ? `${error.message}. Asegura que el servicio FastAPI del diseñador este corriendo en ${endpoint}.`
            : "No fue posible conectar con el backend del diseñador.",
      },
      { status: 502 },
    );
  }
}
