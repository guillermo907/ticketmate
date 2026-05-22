import type { VenueEventRecord } from "@/lib/event-types";
import type { EventPosterDesign } from "@/lib/poster-designer";
import styles from "@/app/events/[slug]/page.module.scss";

type EventData = VenueEventRecord;
type RelatedEvent = { slug: string; title: string };
const defaultPosterVisibleFields = [
  "venue",
  "date",
  "address",
  "summary",
  "description",
  "schedule",
  "lineup",
  "genre",
  "pricing",
  "cta",
  "related",
] as const;

function getPublishedPosterAssetUrl(event: EventData) {
  return event.posterReferenceUrls?.[0] ?? "";
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

function formatPosterDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    .format(new Date(date))
    .toUpperCase();
}

function formatPosterYear(date: string) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(new Date(date));
}

function buildTicketPriceLabel(price: number, fee: number) {
  return `ENTRADAS: ${price} + ${fee} MXN`;
}

function shouldRenderPhoto(event: EventData, posterDesign: EventPosterDesign) {
  return posterDesign.handoff.usesPhotography && Boolean(event.heroImage);
}

function GeneratedImagePoster({
  event,
  relatedEvents,
}: {
  event: EventData;
  relatedEvents: RelatedEvent[];
}) {
  const posterAssetUrl = getPublishedPosterAssetUrl(event);

  if (!posterAssetUrl) {
    return null;
  }

  return (
    <article className={`${styles.posterSite} ${styles.generatedImagePosterSite}`}>
      <div className={styles.generatedImageStage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterAssetUrl} alt={`Poster oficial de ${event.title}`} className={styles.generatedImagePoster} />
      </div>
      <div className={styles.generatedImageDock}>
        <div className={styles.generatedImageMeta}>
          <span>{event.venueName}</span>
          <strong>{event.title}</strong>
          <small>
            {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.startsAt))}
          </small>
        </div>
        <div className={styles.generatedImageActions}>
          <a className={styles.buyButton} href={`/checkout?event=${event.slug}`}>
            COMPRAR BOLETO
          </a>
          {relatedEvents.length > 0 ? (
            <div className={styles.relatedLinks}>
              {relatedEvents.map((item) => (
                <a key={item.slug} href={`/events/${item.slug}`}>
                  {item.title}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function isVisible(event: EventData, field: (typeof defaultPosterVisibleFields)[number]) {
  const visibleFields = event.posterVisibleFields?.length ? event.posterVisibleFields : defaultPosterVisibleFields;
  return visibleFields.includes(field);
}

function FestivalTicketPoster({
  event,
  posterDesign,
  relatedEvents,
}: {
  event: EventData;
  posterDesign: EventPosterDesign;
  relatedEvents: RelatedEvent[];
}) {
  const { narrative, layout } = posterDesign;
  const showPhoto = shouldRenderPhoto(event, posterDesign);
  const showVenue = isVisible(event, "venue");
  const showDate = isVisible(event, "date");
  const showAddress = isVisible(event, "address");
  const showSummary = isVisible(event, "summary");
  const showDescription = isVisible(event, "description");
  const showSchedule = isVisible(event, "schedule");
  const showLineup = isVisible(event, "lineup");
  const showGenre = isVisible(event, "genre");
  const showPricing = isVisible(event, "pricing");
  const showCta = isVisible(event, "cta");
  const showRelated = isVisible(event, "related");

  return (
    <article className={`${styles.posterSite} ${styles.festivalTicketSite}`}>
      <div className={styles.posterNotes} aria-hidden="true" />
      <div className={styles.posterBlob} aria-hidden="true" />
      {showPhoto ? (
        <div className={styles.posterFigureWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.heroImage} alt={event.title} className={styles.posterFigure} />
        </div>
      ) : (
        <div className={styles.posterFigureGlyph} aria-hidden="true">
          <span>{layout.monogram}</span>
        </div>
      )}

      <section className={styles.ticketLeftColumn}>
        <header className={styles.ticketHeadline}>
          <div className={styles.ticketTitle}>
            {layout.titleRows.map((row) => (
              <h1 key={row}>{row}</h1>
            ))}
          </div>
          <div className={styles.ticketVenue}>
            {showVenue ? <strong>{event.venueName}</strong> : null}
            {showDate ? <span>{formatPosterYear(event.startsAt)}</span> : null}
          </div>
        </header>

        {(showAddress || showDate) && (
          <div className={styles.ticketMetaBlock}>
            <p>{narrative.inviteLabel}</p>
            {showAddress ? <strong>{event.venueAddress}</strong> : null}
            {showDate ? <span>{formatPosterDay(event.startsAt)}</span> : null}
          </div>
        )}

        {(showSummary || showDescription) && (
          <div className={styles.ticketStory}>
            {showSummary ? <p>{event.summary}</p> : null}
            {showDescription ? <strong>{event.description}</strong> : null}
          </div>
        )}

        {showSchedule && <div className={styles.ticketSchedule}>
          <div>
            <span>DOORS</span>
            <strong>{formatTime(event.doorTime)}</strong>
          </div>
          <div>
            <span>SHOW</span>
            <strong>{formatTime(event.startsAt)}</strong>
          </div>
          <div>
            <span>SOUNDCHECK</span>
            <strong>{formatTime(event.soundcheckTime)}</strong>
          </div>
        </div>}

        {showLineup && <div className={styles.ticketLineup}>
          {event.lineup.map((artist) => (
            <span key={artist}>{artist}</span>
          ))}
        </div>}
      </section>

      <aside className={styles.ticketRightColumn}>
        <div className={styles.ticketQuote}>
          <span>{narrative.panelLabel}</span>
          <strong>&ldquo;{narrative.kicker}&rdquo;</strong>
        </div>

        {(showPricing || showCta) && (
          <div className={styles.ticketBadge}>
            {showPricing ? <span>{buildTicketPriceLabel(event.ticketPriceMXN, event.ticketFeeMXN)}</span> : null}
            {showPricing ? <strong>{Math.max(0, event.capacity - event.soldCount)} LUGARES DISPONIBLES</strong> : null}
            {showCta ? (
              <a className={styles.buyButton} href={`/checkout?event=${event.slug}`}>
                COMPRAR BOLETO
              </a>
            ) : null}
          </div>
        )}

        <div className={styles.ticketFooter}>
          {showGenre ? <div>
            <span>TEXTURA</span>
            <strong>{event.genre.slice(0, 2).join(" / ")}</strong>
          </div> : null}
          <div>
            <span>MOTION</span>
            <strong>{narrative.motionLabel}</strong>
          </div>
          {showRelated ? <div>
            <span>OTRAS FECHAS</span>
            <div className={styles.relatedLinks}>
              {relatedEvents.map((item) => (
                <a key={item.slug} href={`/events/${item.slug}`}>
                  {item.title}
                </a>
              ))}
            </div>
          </div> : null}
        </div>
      </aside>
    </article>
  );
}

function MidnightFlyerPoster({
  event,
  posterDesign,
  relatedEvents,
}: {
  event: EventData;
  posterDesign: EventPosterDesign;
  relatedEvents: RelatedEvent[];
}) {
  const { narrative } = posterDesign;
  const showPhoto = shouldRenderPhoto(event, posterDesign);
  const showVenue = isVisible(event, "venue");
  const showDate = isVisible(event, "date");
  const showAddress = isVisible(event, "address");
  const showSummary = isVisible(event, "summary");
  const showDescription = isVisible(event, "description");
  const showSchedule = isVisible(event, "schedule");
  const showLineup = isVisible(event, "lineup");
  const showGenre = isVisible(event, "genre");
  const showPricing = isVisible(event, "pricing");
  const showCta = isVisible(event, "cta");
  const showRelated = isVisible(event, "related");

  return (
    <article className={`${styles.posterSite} ${styles.midnightFlyerSite}`}>
      <div className={styles.midnightOrb} aria-hidden="true" />
      <div className={styles.midnightGrid} aria-hidden="true" />
      <div className={styles.midnightPulse} aria-hidden="true" />

      <header className={styles.midnightHeader}>
        {showVenue ? <span>{event.venueName}</span> : null}
        {showDate ? <span>{formatPosterDay(event.startsAt)}</span> : null}
        {showPricing ? <span>{buildTicketPriceLabel(event.ticketPriceMXN, event.ticketFeeMXN)}</span> : null}
      </header>

      <section className={styles.midnightMain}>
        <div className={styles.midnightTitleBlock}>
          <p>{narrative.inviteLabel}</p>
          <h1>{event.title}</h1>
          {showGenre ? <strong>{event.genre.join(" / ")}</strong> : null}
        </div>

        <div className={styles.midnightFigureWrap}>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.heroImage} alt={event.title} className={styles.midnightFigure} />
          ) : (
            <div className={styles.midnightGlyph}>
              <span>{event.title.slice(0, 1)}</span>
            </div>
          )}
        </div>

        {(showSummary || showDescription) && <div className={styles.midnightStory}>
          <span>{narrative.panelLabel}</span>
          {showSummary ? <p>{event.summary}</p> : null}
          {showDescription ? <strong>{event.description}</strong> : null}
        </div>}
      </section>

      {showSchedule || showAddress ? <section className={styles.midnightInfoStrip}>
        <div>
          <span>DOORS</span>
          <strong>{formatTime(event.doorTime)}</strong>
        </div>
        <div>
          <span>SHOW</span>
          <strong>{formatTime(event.startsAt)}</strong>
        </div>
        <div>
          <span>SOUNDCHECK</span>
          <strong>{formatTime(event.soundcheckTime)}</strong>
        </div>
        {showAddress ? <div>
          <span>VENUE</span>
          <strong>{event.venueAddress}</strong>
        </div> : null}
      </section> : null}

      <section className={styles.midnightFooter}>
        {showLineup ? <div className={styles.midnightLineup}>
          {event.lineup.map((artist) => (
            <span key={artist}>{artist}</span>
          ))}
        </div> : <div />}
        <div className={styles.midnightActions}>
          {showCta ? <a className={styles.buyButtonClub} href={`/checkout?event=${event.slug}`}>
            COMPRAR BOLETO
          </a> : null}
          {showRelated ? <div className={styles.relatedLinksClub}>
            {relatedEvents.map((item) => (
              <a key={item.slug} href={`/events/${item.slug}`}>
                {item.title}
              </a>
            ))}
          </div> : null}
        </div>
      </section>
    </article>
  );
}

function SunburstPoster({
  event,
  posterDesign,
  relatedEvents,
}: {
  event: EventData;
  posterDesign: EventPosterDesign;
  relatedEvents: RelatedEvent[];
}) {
  const { narrative } = posterDesign;
  const showPhoto = shouldRenderPhoto(event, posterDesign);
  const showVenue = isVisible(event, "venue");
  const showDate = isVisible(event, "date");
  const showSummary = isVisible(event, "summary");
  const showDescription = isVisible(event, "description");
  const showPricing = isVisible(event, "pricing");
  const showCta = isVisible(event, "cta");
  const showRelated = isVisible(event, "related");

  return (
    <article className={`${styles.posterSite} ${styles.sunburstSite}`}>
      <div className={styles.sunburstRay} aria-hidden="true" />
      <div className={styles.sunburstDisc} aria-hidden="true" />

      <section className={styles.sunburstHeader}>
        {showVenue ? <span>{event.venueName}</span> : null}
        {showDate ? <span>{formatPosterDay(event.startsAt)}</span> : null}
        {showDate ? <span>{formatPosterYear(event.startsAt)}</span> : null}
      </section>

      <section className={styles.sunburstHero}>
        <div className={styles.sunburstCopy}>
          <p>{narrative.inviteLabel}</p>
          <h1>{event.title}</h1>
          {showSummary ? <strong>{event.summary}</strong> : null}
        </div>
        <div className={styles.sunburstVisual}>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.heroImage} alt={event.title} className={styles.sunburstFigure} />
          ) : (
            <div className={styles.sunburstGlyph}>
              <span>{event.venueName}</span>
            </div>
          )}
        </div>
      </section>

      <section className={styles.sunburstBottom}>
        <div>
          {showDescription ? <span>{event.description}</span> : null}
        </div>
        <div>
          {showPricing ? <strong>{buildTicketPriceLabel(event.ticketPriceMXN, event.ticketFeeMXN)}</strong> : null}
          {showCta ? <a className={styles.buyButton} href={`/checkout?event=${event.slug}`}>
            COMPRAR BOLETO
          </a> : null}
        </div>
        <div className={styles.relatedLinks}>
          {showRelated
            ? relatedEvents.map((item) => (
                <a key={item.slug} href={`/events/${item.slug}`}>
                  {item.title}
                </a>
              ))
            : null}
        </div>
      </section>
    </article>
  );
}

function BrassMarqueePoster({
  event,
  posterDesign,
  relatedEvents,
}: {
  event: EventData;
  posterDesign: EventPosterDesign;
  relatedEvents: RelatedEvent[];
}) {
  const { narrative, layout } = posterDesign;
  const showPhoto = shouldRenderPhoto(event, posterDesign);
  const showVenue = isVisible(event, "venue");
  const showDate = isVisible(event, "date");
  const showSummary = isVisible(event, "summary");
  const showDescription = isVisible(event, "description");
  const showSchedule = isVisible(event, "schedule");
  const showLineup = isVisible(event, "lineup");
  const showPricing = isVisible(event, "pricing");
  const showCta = isVisible(event, "cta");
  const showRelated = isVisible(event, "related");

  return (
    <article className={`${styles.posterSite} ${styles.brassMarqueeSite}`}>
      <div className={styles.brassFrame} aria-hidden="true" />
      <div className={styles.brassWave} aria-hidden="true" />

      <section className={styles.brassHeader}>
        {showVenue ? <span>{event.venueName}</span> : null}
        {showDate ? <span>{formatPosterDay(event.startsAt)}</span> : null}
        {showDate ? <span>{formatPosterYear(event.startsAt)}</span> : null}
      </section>

      <section className={styles.brassBody}>
        <div className={styles.brassTitleBlock}>
          <p>{narrative.inviteLabel}</p>
          <div className={styles.brassTitleStack}>
            {layout.titleRows.map((row) => (
              <h1 key={row}>{row}</h1>
            ))}
          </div>
          {showSummary ? <strong>{event.summary}</strong> : null}
        </div>

        <div className={styles.brassProgramColumn}>
          {showLineup ? <div className={styles.brassProgramCard}>
            <span>PROGRAM</span>
            {event.lineup.map((artist) => (
              <strong key={artist}>{artist}</strong>
            ))}
          </div> : null}
          {showSchedule ? <div className={styles.brassProgramCard}>
            <span>SCHEDULE</span>
            <strong>Doors {formatTime(event.doorTime)}</strong>
            <strong>Show {formatTime(event.startsAt)}</strong>
            <strong>Soundcheck {formatTime(event.soundcheckTime)}</strong>
          </div> : null}
        </div>

        <div className={styles.brassVisual}>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.heroImage} alt={event.title} className={styles.brassVisualImage} />
          ) : (
            <div className={styles.brassVisualGlyph}>
              <span>{layout.monogram}</span>
            </div>
          )}
        </div>
      </section>

      <section className={styles.brassFooter}>
        <div className={styles.brassMetaCard}>
          {showDescription ? <span>{event.description}</span> : null}
        </div>
        <div className={styles.brassMetaCard}>
          {showPricing ? <strong>{buildTicketPriceLabel(event.ticketPriceMXN, event.ticketFeeMXN)}</strong> : null}
          {showCta ? <a className={styles.buyButton} href={`/checkout?event=${event.slug}`}>
            COMPRAR BOLETO
          </a> : null}
        </div>
        {showRelated ? <div className={styles.brassMetaCard}>
          <span>RELATED</span>
          <div className={styles.relatedLinks}>
            {relatedEvents.map((item) => (
              <a key={item.slug} href={`/events/${item.slug}`}>
                {item.title}
              </a>
            ))}
          </div>
        </div> : null}
      </section>
    </article>
  );
}

function PaperCutCollagePoster({
  event,
  posterDesign,
  relatedEvents,
}: {
  event: EventData;
  posterDesign: EventPosterDesign;
  relatedEvents: RelatedEvent[];
}) {
  const { narrative } = posterDesign;
  const showPhoto = shouldRenderPhoto(event, posterDesign);
  const showVenue = isVisible(event, "venue");
  const showDate = isVisible(event, "date");
  const showSummary = isVisible(event, "summary");
  const showDescription = isVisible(event, "description");
  const showLineup = isVisible(event, "lineup");
  const showSchedule = isVisible(event, "schedule");
  const showPricing = isVisible(event, "pricing");
  const showCta = isVisible(event, "cta");
  const showRelated = isVisible(event, "related");

  return (
    <article className={`${styles.posterSite} ${styles.paperCutCollageSite}`}>
      <div className={styles.paperSun} aria-hidden="true" />
      <div className={styles.paperRibbons} aria-hidden="true" />
      <div className={styles.paperTexture} aria-hidden="true" />

      <section className={styles.paperTopLine}>
        {showVenue ? <span>{event.venueName}</span> : null}
        {showDate ? <span>{formatPosterDay(event.startsAt)}</span> : null}
        {showPricing ? <span>{buildTicketPriceLabel(event.ticketPriceMXN, event.ticketFeeMXN)}</span> : null}
      </section>

      <section className={styles.paperLayout}>
        <div className={styles.paperCopy}>
          <p>{narrative.inviteLabel}</p>
          <h1>{event.title}</h1>
          {showSummary ? <strong>{event.summary}</strong> : null}
        </div>

        <div className={styles.paperPolaroid}>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.heroImage} alt={event.title} className={styles.paperPolaroidImage} />
          ) : (
            <div className={styles.paperGlyph}>
              <span>{event.title}</span>
            </div>
          )}
        </div>

        {showDescription ? <div className={styles.paperNotesCard}>
          <span>{narrative.panelLabel}</span>
          <p>{event.description}</p>
        </div> : null}

        {showLineup ? <div className={styles.paperLineupCard}>
          {event.lineup.map((artist) => (
            <strong key={artist}>{artist}</strong>
          ))}
        </div> : null}

        <div className={styles.paperActionCard}>
          {showSchedule ? <div>
            <span>DOORS {formatTime(event.doorTime)}</span>
            <span>SHOW {formatTime(event.startsAt)}</span>
          </div> : null}
          {showCta ? <a className={styles.buyButton} href={`/checkout?event=${event.slug}`}>
            COMPRAR BOLETO
          </a> : null}
          {showRelated ? <div className={styles.relatedLinks}>
            {relatedEvents.map((item) => (
              <a key={item.slug} href={`/events/${item.slug}`}>
                {item.title}
              </a>
            ))}
          </div> : null}
        </div>
      </section>
    </article>
  );
}

function SignalMatrixPoster({
  event,
  posterDesign,
  relatedEvents,
}: {
  event: EventData;
  posterDesign: EventPosterDesign;
  relatedEvents: RelatedEvent[];
}) {
  const { narrative, layout } = posterDesign;
  const showPhoto = shouldRenderPhoto(event, posterDesign);
  const showVenue = isVisible(event, "venue");
  const showDate = isVisible(event, "date");
  const showDescription = isVisible(event, "description");
  const showLineup = isVisible(event, "lineup");
  const showSchedule = isVisible(event, "schedule");
  const showPricing = isVisible(event, "pricing");
  const showCta = isVisible(event, "cta");
  const showRelated = isVisible(event, "related");
  const showGenre = isVisible(event, "genre");

  return (
    <article className={`${styles.posterSite} ${styles.signalMatrixSite}`}>
      <div className={styles.signalGridOverlay} aria-hidden="true" />
      <div className={styles.signalBand} aria-hidden="true" />

      <section className={styles.signalMetaBar}>
        {showVenue ? <span>{event.venueName}</span> : null}
        {showDate ? <span>{formatPosterDay(event.startsAt)}</span> : null}
        {showDate ? <span>{formatPosterYear(event.startsAt)}</span> : null}
      </section>

      <section className={styles.signalBoard}>
        <div className={styles.signalTitleCells}>
          <p>{narrative.inviteLabel}</p>
          <div className={styles.signalRows}>
            {layout.titleRows.map((row) => (
              <h1 key={row}>{row}</h1>
            ))}
          </div>
          {showGenre ? <strong>{event.genre.join(" / ")}</strong> : null}
        </div>

        <div className={styles.signalInfoCells}>
          {showLineup ? <article>
            <span>LINEUP</span>
            {event.lineup.map((artist) => (
              <strong key={artist}>{artist}</strong>
            ))}
          </article> : null}
          {showSchedule ? <article>
            <span>SLOTS</span>
            <strong>Doors {formatTime(event.doorTime)}</strong>
            <strong>Show {formatTime(event.startsAt)}</strong>
            <strong>Check {formatTime(event.soundcheckTime)}</strong>
          </article> : null}
          {(showPricing || showCta) ? <article>
            <span>ACCESS</span>
            {showPricing ? <strong>{buildTicketPriceLabel(event.ticketPriceMXN, event.ticketFeeMXN)}</strong> : null}
            {showCta ? <a className={styles.buyButtonClub} href={`/checkout?event=${event.slug}`}>
              COMPRAR BOLETO
            </a> : null}
          </article> : null}
        </div>

        <div className={styles.signalFigureTile}>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.heroImage} alt={event.title} className={styles.signalFigure} />
          ) : (
            <div className={styles.signalGlyph}>
              <span>{layout.monogram}</span>
            </div>
          )}
        </div>

        <div className={styles.signalAsideTile}>
          {showDescription ? <p>{event.description}</p> : null}
          {showRelated ? <div className={styles.relatedLinksClub}>
            {relatedEvents.map((item) => (
              <a key={item.slug} href={`/events/${item.slug}`}>
                {item.title}
              </a>
            ))}
          </div> : null}
        </div>
      </section>
    </article>
  );
}

export function renderPosterPage(
  event: EventData,
  posterDesign: EventPosterDesign,
  relatedEvents: RelatedEvent[],
) {
  if (getPublishedPosterAssetUrl(event)) {
    return <GeneratedImagePoster event={event} relatedEvents={relatedEvents} />;
  }

  switch (posterDesign.rendererId) {
    case "festival-ticket-site":
      return <FestivalTicketPoster event={event} posterDesign={posterDesign} relatedEvents={relatedEvents} />;
    case "brass-marquee-site":
      return <BrassMarqueePoster event={event} posterDesign={posterDesign} relatedEvents={relatedEvents} />;
    case "midnight-flyer-site":
      return <MidnightFlyerPoster event={event} posterDesign={posterDesign} relatedEvents={relatedEvents} />;
    case "paper-cut-collage-site":
      return <PaperCutCollagePoster event={event} posterDesign={posterDesign} relatedEvents={relatedEvents} />;
    case "signal-matrix-site":
      return <SignalMatrixPoster event={event} posterDesign={posterDesign} relatedEvents={relatedEvents} />;
    case "sunburst-billboard-site":
    default:
      return <SunburstPoster event={event} posterDesign={posterDesign} relatedEvents={relatedEvents} />;
  }
}
