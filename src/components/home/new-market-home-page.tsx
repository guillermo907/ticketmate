import Link from "next/link";
import type { CSSProperties } from "react";
import type { SiteContent } from "@/lib/types";
import type { VenueEventRecord } from "@/lib/event-types";
import { ThemeModeToggle } from "./theme-mode-toggle";
import styles from "./new-market-home-page.module.scss";

type NewMarketHomePageProps = {
  content: SiteContent;
  events: VenueEventRecord[];
};

export type MarketEvent = {
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  venueName: string;
  venueAddress: string;
  ticketPriceMXN: number;
  ticketFeeMXN: number;
  capacity: number;
  soldCount: number;
  genre: string[];
  lineup: string[];
  tone: "green" | "coral" | "cyan" | "amber" | "violet";
};

const fallbackEvents: MarketEvent[] = [
  {
    slug: "midnight-cumbia-systems",
    title: "Midnight Cumbia Systems",
    summary: "Cumbia digital, brass en vivo y patio nocturno para bailar hasta tarde.",
    startsAt: "2026-06-20T22:00:00.000Z",
    venueName: "Foro GDL",
    venueAddress: "Americana, Guadalajara",
    ticketPriceMXN: 280,
    ticketFeeMXN: 15,
    capacity: 320,
    soldCount: 214,
    genre: ["Cumbia", "Nightlife"],
    lineup: ["Sonido Solar", "DJ Bruma", "Los Magnéticos"],
    tone: "green"
  },
  {
    slug: "club-atlas-after",
    title: "Club Atlas After",
    summary: "House, breaks y luces bajas en una noche pensada para moverse sin pausa.",
    startsAt: "2026-06-22T04:30:00.000Z",
    venueName: "Bodega Centro",
    venueAddress: "Centro, Guadalajara",
    ticketPriceMXN: 220,
    ticketFeeMXN: 15,
    capacity: 180,
    soldCount: 132,
    genre: ["Club", "Electronic"],
    lineup: ["Mar de Fondo", "Niko Norte"],
    tone: "cyan"
  },
  {
    slug: "ruido-botanico",
    title: "Ruido Botánico",
    summary: "Indie, visuales orgánicos y bandas emergentes en formato íntimo.",
    startsAt: "2026-06-27T03:00:00.000Z",
    venueName: "Casa Taller",
    venueAddress: "Santa Tere, Guadalajara",
    ticketPriceMXN: 180,
    ticketFeeMXN: 15,
    capacity: 140,
    soldCount: 86,
    genre: ["Indie", "Live"],
    lineup: ["Planta Baja", "Menta Gris"],
    tone: "coral"
  },
  {
    slug: "jazz-de-azotea",
    title: "Jazz de Azotea",
    summary: "Cuarteto, cocteles y skyline nocturno para cerrar la semana arriba.",
    startsAt: "2026-07-01T02:00:00.000Z",
    venueName: "Terraza Chapultepec",
    venueAddress: "Lafayette, Guadalajara",
    ticketPriceMXN: 350,
    ticketFeeMXN: 15,
    capacity: 120,
    soldCount: 101,
    genre: ["Jazz", "Rooftop"],
    lineup: ["Cuarteto Aurora"],
    tone: "amber"
  }
];

const tones: MarketEvent["tone"][] = ["green", "coral", "cyan", "amber", "violet"];

function localizeContent(content: SiteContent) {
  const es = content.locales?.es;

  return {
    ...content,
    siteTitle: es?.siteTitle ?? content.siteTitle,
    subtitle: es?.subtitle ?? content.subtitle,
    heroText: es?.heroText ?? content.heroText,
    contactEmail: es?.contactEmail ?? content.contactEmail,
    cv: {
      ...content.cv,
      ...es?.cv
    },
    services: es?.services ?? content.services,
    servicesIntro: es?.servicesIntro ?? content.servicesIntro,
    testimonials: es?.testimonials ?? content.testimonials
  };
}

export function toMarketEvents(events: VenueEventRecord[], { useFallback = true } = {}): MarketEvent[] {
  if (!events.length) return useFallback ? fallbackEvents : [];

  return events
    .slice()
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 8)
    .map((event, index) => ({
      slug: event.slug,
      title: event.title,
      summary: event.summary || event.description,
      startsAt: event.startsAt,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      ticketPriceMXN: event.ticketPriceMXN,
      ticketFeeMXN: event.ticketFeeMXN,
      capacity: event.capacity,
      soldCount: event.soldCount,
      genre: event.genre.length ? event.genre : ["Live"],
      lineup: event.lineup.length ? event.lineup : [event.title],
      tone: tones[index % tones.length]
    }));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "America/Mexico_City" })
    .format(new Date(value))
    .replace(".", "");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(
    new Date(value),
  );
}

function getAvailability(event: MarketEvent) {
  const remaining = Math.max(0, event.capacity - event.soldCount);
  const soldRatio = event.capacity > 0 ? event.soldCount / event.capacity : 0;

  if (remaining <= 0) return "Sold out";
  if (soldRatio > 0.8) return `Últimos ${remaining}`;
  if (soldRatio > 0.55) return "Alta demanda";
  return "Disponible";
}

function getPriceLabel(event: MarketEvent) {
  return `$${event.ticketPriceMXN} + ${event.ticketFeeMXN} MXN`;
}

export function NewMarketHomePage({ content, events }: NewMarketHomePageProps) {
  const localized = localizeContent(content);
  const marketEvents = toMarketEvents(events);
  const featuredEvent = marketEvents[0];
  const secondaryEvents = marketEvents.slice(1, 4);
  const wallpaper = content.theme.backgroundImage || content.theme.light.backgroundImage;
  const categories = ["Música", "Hoy", "Esta semana", "Club", "Cultura", "Indie", "Jazz", "Promotores"];
  const venueMetrics = [
    ["0", "mensualidad base"],
    ["$15", "fee por boleto"],
    ["1.5%", "payout automatizado"],
    ["QR", "acceso seguro"]
  ];

  return (
    <main className={styles.page} data-banner={content.theme.bannerStyle ?? "editorial"} data-theme-scope>
      <nav className={styles.nav} aria-label="Navegación principal">
        <Link className={styles.brand} href="/">
          <span>Foro</span>
          <strong>GDL</strong>
        </Link>
        <div className={styles.navLinks}>
          <a href="#eventos">Eventos</a>
          <a href="#categorias">Categorías</a>
          <a href="#venues">Venues</a>
          <Link href="/venue">Corre tu venue</Link>
          <ThemeModeToggle />
          <Link href="/admin" className={styles.adminLink}>
            Admin
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Cartelera viva de Guadalajara</p>
          <h1>Encuentra tu próxima noche.</h1>
          <p>
            Eventos, boletos y venues independientes en un solo lugar. Diseñado para que el público descubra rápido y
            los equipos operen sin fricción.
          </p>
          <form className={styles.searchPanel} action="/">
            <label htmlFor="event-search">Busca eventos, artistas o venues</label>
            <div>
              <input id="event-search" name="q" placeholder="Ej. cumbia, jazz, Chapultepec..." />
              <button type="submit">Buscar</button>
            </div>
          </form>
          {wallpaper ? (
            <div
              className={styles.wallpaperAccent}
              style={{ "--market-wallpaper": `url(${wallpaper})` } as CSSProperties}
              aria-hidden="true"
            >
              <span>Imagen del tema</span>
            </div>
          ) : null}
          <div className={styles.heroActions}>
            <a href="#eventos">Explorar eventos</a>
            <Link href="/venue">Publicar un evento</Link>
          </div>
        </div>

        <Link href={`/events/${featuredEvent.slug}`} className={styles.featuredCard} data-tone={featuredEvent.tone}>
          <PosterArtwork event={featuredEvent} featured />
          <div className={styles.featuredInfo}>
            <span>{formatDay(featuredEvent.startsAt)}</span>
            <h2>{featuredEvent.title}</h2>
            <p>{featuredEvent.venueName}</p>
            <strong>{getPriceLabel(featuredEvent)}</strong>
          </div>
        </Link>
      </section>

      <section className={styles.categoryRail} id="categorias" aria-label="Categorías">
        {categories.map((category) => (
          <a href="#eventos" key={category}>
            {category}
          </a>
        ))}
      </section>

      <section className={styles.discoveryGrid} aria-label="Resumen de eventos destacados">
        {secondaryEvents.map((event) => (
          <Link key={event.slug} href={`/events/${event.slug}`} className={styles.discoveryTile} data-tone={event.tone}>
            <span>{formatTime(event.startsAt)}</span>
            <strong>{event.title}</strong>
            <small>{event.venueName}</small>
          </Link>
        ))}
        <article className={styles.trustTile}>
          <span>Compra clara</span>
          <strong>Precio + fee visible antes de pagar.</strong>
          <p>Sin sorpresas al checkout, boletos QR y acceso listo para móvil.</p>
        </article>
      </section>

      <PublicEventPosterSection events={marketEvents} />

      <section className={styles.venueSection} id="venues">
        <div className={styles.venueCopy}>
          <p className={styles.kicker}>Para venues y promotores</p>
          <h2>La cartelera vende. La consola sostiene la noche.</h2>
          <p>
            Publica eventos, controla aforo, valida accesos y liquida payouts desde una operación diseñada para equipos
            pequeños que se mueven rápido.
          </p>
          <Link href="/venue">Abrir consola del venue</Link>
        </div>
        <div className={styles.metricStrip}>
          {venueMetrics.map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.howItWorks}>
        <div className={styles.sectionHeading}>
          <p>Cómo funciona</p>
          <h2>Del cartel al acceso en cinco pasos.</h2>
        </div>
        <ol>
          {["Crear evento", "Publicar cartelera", "Vender boletos", "Validar QR", "Liquidar"].map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.closingCta}>
        <p>{localized.siteTitle}</p>
        <h2>Tu próxima noche no debería perderse en un feed.</h2>
        <div>
          <a href="#eventos">Ver cartelera</a>
          <Link href="/venue">Crear evento</Link>
        </div>
      </section>
    </main>
  );
}

export function PublicEventPosterSection({
  events,
  limit = 6,
  showMoreHref = "/new"
}: {
  events: MarketEvent[];
  limit?: number;
  showMoreHref?: string;
}) {
  const visibleEvents = events.slice(0, limit);
  const hasMoreEvents = events.length > visibleEvents.length;

  return (
    <section className={styles.eventsSection} id="eventos">
      <div className={styles.sectionHeading}>
        <p>Próximos eventos</p>
        <h2>Posters que sí dan ganas de salir.</h2>
      </div>
      {visibleEvents.length > 0 ? (
        <>
          <div className={styles.eventGrid} data-count={visibleEvents.length}>
            {visibleEvents.map((event, index) => (
              <Link key={event.slug} href={`/events/${event.slug}`} className={styles.eventCard} data-tone={event.tone}>
                <PosterArtwork event={event} index={index} />
                <div className={styles.eventMeta}>
                  <span>{formatDay(event.startsAt)}</span>
                  <h3>{event.title}</h3>
                  <p>{event.venueName}</p>
                  <div>
                    <strong>{getPriceLabel(event)}</strong>
                    <em>{getAvailability(event)}</em>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {hasMoreEvents ? (
            <div className={styles.moreEventsRow}>
              <Link href={showMoreHref}>Ver más eventos</Link>
            </div>
          ) : null}
        </>
      ) : (
        <article className={styles.emptyEvents}>
          <span>Cartelera en preparación</span>
          <strong>Los próximos eventos públicos aparecerán aquí.</strong>
          <p>Marca “Hacer evento público” desde la consola del venue para que un show entre a la cartelera.</p>
          <Link href="/venue">Crear evento público</Link>
        </article>
      )}
    </section>
  );
}

function PosterArtwork({
  event,
  featured = false,
  index = 0
}: {
  event: MarketEvent;
  featured?: boolean;
  index?: number;
}) {
  return (
    <div className={styles.posterArtwork} data-featured={featured} data-tone={event.tone}>
      <span>{event.genre[0] ?? "Live"}</span>
      <strong>{event.title}</strong>
      <div className={styles.posterLineup}>
        {event.lineup.slice(0, featured ? 3 : 2).map((artist) => (
          <small key={artist}>{artist}</small>
        ))}
      </div>
      <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
    </div>
  );
}
