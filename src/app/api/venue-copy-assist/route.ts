import { NextResponse } from "next/server";

type CopyAssistField = "summary" | "description" | "genre";

type CopyAssistRequest = {
  field?: CopyAssistField;
  title?: string;
  lineup?: string;
  venue?: string;
  genres?: string;
};

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toSentenceCase(value: string) {
  if (!value.trim()) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function trimWords(value: string, maxWords: number) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.slice(0, maxWords).join(" ");
}

function buildLocalFallback({ field, title = "", lineup = "", venue = "", genres = "" }: CopyAssistRequest) {
  const artists = splitList(lineup);
  const tags = splitList(genres);
  const leadArtist = artists[0] ?? "invitados especiales";
  const supportArtist = artists[1] ?? "seleccionados en vivo";
  const eventTitle = title.trim() || "evento especial";
  const venueLabel = venue.trim() || "el venue";

  if (field === "summary") {
    return trimWords(
      `${eventTitle} en ${venueLabel}: ${leadArtist} y ${supportArtist} para una noche intensa, bailable y compartible.`,
      15,
    );
  }

  if (field === "description") {
    return trimWords(
      `${eventTitle} toma ${venueLabel} con ${artists.slice(0, 3).join(", ") || "un lineup curado"} para una noche de energía alta, entrada ágil y ambiente pensado para móvil, social y conversión inmediata.`,
      40,
    );
  }

  if (tags.length > 0) {
    return tags.slice(0, 5).join(", ");
  }

  const lineupLower = lineup.toLowerCase();

  if (lineupLower.includes("cumbia")) {
    return "Cumbia digital, Bass tropical, Bronces en vivo";
  }

  if (lineupLower.includes("jazz")) {
    return "Jazz contemporáneo, Groove nocturno, Sesión en vivo";
  }

  return "Música en vivo, Nightlife, Sesión híbrida";
}

function buildPrompt({ field, title = "", lineup = "", venue = "", genres = "" }: CopyAssistRequest) {
  if (field === "summary") {
    return `Write a punchy 15-word Spanish event summary for: "${title}". Lineup: "${lineup}". Return only the summary text, no quotes, no explanation.`;
  }

  if (field === "description") {
    return `Write a 40-word Spanish public event description for: "${title}". Lineup: "${lineup}". Venue: "${venue}". Genres: "${genres}". Energetic, mobile-first tone. Return only the description, no quotes.`;
  }

  return `Based on this lineup: "${lineup}", suggest 3-5 music genre tags in Spanish, comma separated. Examples: Cumbia digital, Jazz tropical, Electrónica. Return only the tags.`;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let body: CopyAssistRequest = {};

  try {
    body = (await request.json()) as CopyAssistRequest;

    if (!body.field) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ ok: true, text: toSentenceCase(buildLocalFallback(body)) });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: buildPrompt(body),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ ok: true, text: toSentenceCase(buildLocalFallback(body)) });
    }

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const text =
      payload.content
        ?.filter((item) => item.type === "text" && typeof item.text === "string")
        .map((item) => item.text?.trim() ?? "")
        .join(" ")
        .trim() ?? "";

    return NextResponse.json({ ok: true, text: text || toSentenceCase(buildLocalFallback(body)) });
  } catch {
    if (body.field) {
      return NextResponse.json({ ok: true, text: toSentenceCase(buildLocalFallback(body)) });
    }

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
