import type { CSSProperties } from "react";
import type { EventTicketDesign, VenueEventRecord } from "@/lib/event-types";
import styles from "./generated-ticket-composite.module.scss";

type GeneratedTicketCompositeProps = {
  event: VenueEventRecord;
  ticketDesign: EventTicketDesign;
  artworkUrl?: string;
  viewport?: "desktop" | "tablet" | "mobile";
};

function formatTicketDate(dateValue: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(dateValue))
    .toUpperCase();
}

function formatTicketTime(dateValue: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function buildTicketReference(event: VenueEventRecord) {
  const slugFragment = (event.slug || event.title)
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6);
  return `${slugFragment || "FOROGD"}-${new Date(event.startsAt).getFullYear()}`;
}

function buildPriceLabel(event: VenueEventRecord) {
  return `$${event.ticketPriceMXN} + $${event.ticketFeeMXN} MXN`;
}

export function GeneratedTicketComposite({
  event,
  ticketDesign,
  artworkUrl,
  viewport = "desktop",
}: GeneratedTicketCompositeProps) {
  const isCompact = viewport !== "desktop";
  const style = {
    "--ticket-background": ticketDesign.shellTheme.background,
    "--ticket-foreground": ticketDesign.shellTheme.foreground,
    "--ticket-accent": ticketDesign.shellTheme.accent,
    "--ticket-accentAlt": ticketDesign.shellTheme.accentAlt,
    "--ticket-panel": ticketDesign.shellTheme.panel,
    "--ticket-panelStrong": ticketDesign.shellTheme.panelStrong,
    "--ticket-line": ticketDesign.shellTheme.line,
    "--ticket-ink": ticketDesign.shellTheme.ink,
  } as CSSProperties;

  const title = event.title.trim();
  const summary = event.summary.trim();
  const lineup = event.lineup.slice(0, 4);
  const ticketRef = buildTicketReference(event);
  const commonContent = (
    <>
      <div className={styles.metaRow}>
        <span>{event.venueName}</span>
        <span>{formatTicketDate(event.startsAt)}</span>
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.summary}>{summary}</p>
      <div className={styles.lineup}>
        {lineup.map((artist) => (
          <span key={artist}>{artist}</span>
        ))}
      </div>
      <div className={styles.schedule}>
        <strong>Doors {formatTicketTime(event.doorTime)}</strong>
        <strong>Show {formatTicketTime(event.startsAt)}</strong>
        <strong>{event.venueName}</strong>
      </div>
    </>
  );

  return (
    <article
      className={[
        styles.ticket,
        styles[ticketDesign.templateId],
        isCompact ? styles.mobileTight : "",
      ].join(" ")}
      data-testid={`generated-ticket-${viewport}`}
      data-template-id={ticketDesign.templateId}
      style={style}
    >
      {artworkUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artworkUrl} alt="" className={styles.art} />
          <div className={styles.overlay} />
          <div className={styles.grain} />
        </>
      ) : null}

      <section className={styles.content}>{commonContent}</section>

      {ticketDesign.templateId === "night-band" ? (
        <div className={styles.footerBand}>
          <div>
            <span className={styles.label}>Acceso</span>
            <div className={styles.price}>{buildPriceLabel(event)}</div>
          </div>
          <div className={styles.qrBox}>
            <div className={styles.qrPattern} aria-hidden="true" />
          </div>
          <div className={styles.ref}>
            <strong>{ticketRef}</strong>
            <div>{event.genre.slice(0, 2).join(" / ") || "Evento en vivo"}</div>
          </div>
        </div>
      ) : (
        <aside className={styles.stub}>
          <div>
            <span className={styles.label}>Acceso</span>
            <div className={styles.price}>{buildPriceLabel(event)}</div>
          </div>
          <div className={styles.qrBox}>
            <div className={styles.qrPattern} aria-hidden="true" />
          </div>
          <div className={styles.ref}>
            <strong>{ticketRef}</strong>
            <div>{Math.max(0, event.capacity - event.soldCount)} lugares disponibles</div>
          </div>
        </aside>
      )}
    </article>
  );
}
