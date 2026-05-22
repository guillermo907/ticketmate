import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Script from "next/script";
import { notFound } from "next/navigation";
import { renderPosterPage } from "@/components/events/poster-page-renderers";
import { getEventBySlug, getUpcomingPublicEvents } from "@/lib/events";
import { buildPosterDesign } from "@/lib/poster-designer";
import styles from "./page.module.scss";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event || !event.isPublished) {
    return {
      title: "Event not found | Foro GDL",
    };
  }

  return {
    title: `${event.title} | ${event.venueName}`,
    description: event.summary,
    openGraph: {
      type: "website",
      title: `${event.title} | ${event.venueName}`,
      description: event.description,
      images: [event.posterReferenceUrls?.[0] || event.heroImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${event.title} | ${event.venueName}`,
      description: event.summary,
      images: [event.posterReferenceUrls?.[0] || event.heroImage],
    },
    alternates: {
      canonical: `/events/${event.slug}`,
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
  const posterDesignCandidate =
    (event.isPublished ? event.publishedPoster : undefined) ??
    event.draftPoster ??
    event.posterDesign ??
    buildPosterDesign(event, event.updatedAt);
  const posterDesign = posterDesignCandidate.shellTheme
    ? posterDesignCandidate
    : buildPosterDesign(
        {
          ...event,
          designVariant: posterDesignCandidate.variant,
          designTemplateId: posterDesignCandidate.templateId,
          designMotifs: posterDesignCandidate.motifs,
        },
        posterDesignCandidate.generatedAt,
      );
  const relatedEvents = upcomingEvents.filter((item) => item.slug !== event.slug).slice(0, 3);
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
    name: event.title,
    description: event.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: [event.posterReferenceUrls?.[0] || event.heroImage],
    location: {
      "@type": "MusicVenue",
      name: event.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venueAddress,
        addressLocality: "Guadalajara",
        addressRegion: "Jalisco",
        addressCountry: "MX",
      },
    },
    offers: {
      "@type": "Offer",
      availability:
        Math.max(0, event.capacity - event.soldCount) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      price: event.ticketPriceMXN + event.ticketFeeMXN,
      priceCurrency: "MXN",
      url: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/events/${event.slug}`,
    },
    performer: event.lineup.map((name) => ({
      "@type": "MusicGroup",
      name,
    })),
    organizer: {
      "@type": "Organization",
      name: event.venueName,
    },
  };

  return (
    <main className={styles.page} style={eventThemeStyle}>
      <Script
        id={`event-jsonld-${event.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {renderPosterPage(event, posterDesign, relatedEvents)}
    </main>
  );
}
