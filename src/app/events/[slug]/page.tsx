import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Script from "next/script";
import { notFound } from "next/navigation";
import { renderPosterPage, resolvePosterRuntimeEvent } from "@/components/events/poster-page-renderers";
import { resolvePosterPageDesign } from "@/lib/event-presentation";
import { getEventBySlug, getUpcomingPublicEvents } from "@/lib/events";
import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function getEventImageUrl(event: Awaited<ReturnType<typeof getEventBySlug>>) {
  if (!event) {
    return "";
  }

  const runtimeEvent = resolvePosterRuntimeEvent(event);

  return (
    runtimeEvent.posterAssets?.find((asset) => asset.id === runtimeEvent.activePosterAssetId)?.url ??
    runtimeEvent.posterReferenceUrls?.[0] ??
    runtimeEvent.heroImage
  );
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event || !event.isPublished) {
    return {
      title: "Event not found | Foro GDL",
    };
  }
  const runtimeEvent = resolvePosterRuntimeEvent(event);
  const eventImage = getEventImageUrl(event);

  return {
    title: `${runtimeEvent.title} | ${runtimeEvent.venueName}`,
    description: runtimeEvent.summary,
    openGraph: {
      type: "website",
      title: `${runtimeEvent.title} | ${runtimeEvent.venueName}`,
      description: runtimeEvent.description,
      images: [eventImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${runtimeEvent.title} | ${runtimeEvent.venueName}`,
      description: runtimeEvent.summary,
      images: [eventImage],
    },
    alternates: {
      canonical: `/events/${runtimeEvent.slug}`,
    },
  };
}

export default async function EventLandingPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event || !event.isPublished) {
    notFound();
  }

  const upcomingEvents = await getUpcomingPublicEvents();
  const { runtimeEvent, posterDesign } = resolvePosterPageDesign(event);
  const relatedEvents = upcomingEvents.filter((item) => item.slug !== runtimeEvent.slug).slice(0, 3);
  const eventThemeStyle = {
    "--event-page-bg": posterDesign.shellTheme.background,
    "--event-page-fg": posterDesign.shellTheme.foreground,
    "--event-shell-bg": posterDesign.shellTheme.accent,
    "--event-shell-fg": posterDesign.shellTheme.ink,
    "--event-shell-accent": posterDesign.shellTheme.accent,
    "--event-shell-accent-alt": posterDesign.shellTheme.accentAlt,
    "--event-shell-muted": posterDesign.shellTheme.muted,
    "--event-shell-line": posterDesign.shellTheme.line,
    "--event-shell-panel": posterDesign.shellTheme.panel,
    "--event-shell-panel-strong": posterDesign.shellTheme.panelStrong,
    "--event-shell-ink": posterDesign.shellTheme.ink,
  } as CSSProperties;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: runtimeEvent.title,
    description: runtimeEvent.description,
    startDate: runtimeEvent.startsAt,
    endDate: runtimeEvent.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: [getEventImageUrl(event)],
    location: {
      "@type": "MusicVenue",
      name: runtimeEvent.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: runtimeEvent.venueAddress,
        addressLocality: "Guadalajara",
        addressRegion: "Jalisco",
        addressCountry: "MX",
      },
    },
    offers: {
      "@type": "Offer",
      availability:
        Math.max(0, runtimeEvent.capacity - runtimeEvent.soldCount) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      price: runtimeEvent.ticketPriceMXN + runtimeEvent.ticketFeeMXN,
      priceCurrency: "MXN",
      url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/events/${runtimeEvent.slug}`,
    },
    performer: runtimeEvent.lineup.map((name) => ({
      "@type": "MusicGroup",
      name,
    })),
    organizer: {
      "@type": "Organization",
      name: runtimeEvent.venueName,
    },
  };

  return (
    <main className={styles.page} style={eventThemeStyle}>
      <Script
        id={`event-jsonld-${event.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {renderPosterPage(runtimeEvent, posterDesign, relatedEvents)}
    </main>
  );
}
