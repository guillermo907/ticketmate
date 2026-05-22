"use client";

import type { SiteContent } from "@/lib/types";
import { applyThemeVariables } from "@/lib/apply-theme-variables";
import { normalizeSiteTheme, themeCssVariables } from "@/lib/theme-contrast";
import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ThemeModeToggle } from "./theme-mode-toggle";
import styles from "./home-page.module.scss";

type HomePageProps = {
  content: SiteContent;
};

type Locale = "en" | "es";

type FlowCard = {
  stage: string;
  title: string;
  body: string;
  points: string[];
};

type NavItem = {
  href: string;
  label: string;
  tone: "flows" | "modules" | "system" | "venue" | "contact";
  internal?: boolean;
};

let localeHydrated = false;

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "es";
  if (!localeHydrated) return "es";

  const saved = window.localStorage.getItem("site-locale");
  if (saved === "en" || saved === "es") return saved;
  return window.navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

function subscribeLocale(callback: () => void) {
  localeHydrated = true;
  window.setTimeout(callback, 0);
  window.addEventListener("storage", callback);
  window.addEventListener("site-locale-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("site-locale-change", callback);
  };
}

function setStoredLocale(locale: Locale) {
  window.localStorage.setItem("site-locale", locale);
  window.dispatchEvent(new Event("site-locale-change"));
}

export function HomePage({ content }: HomePageProps) {
  const locale = useSyncExternalStore<Locale>(subscribeLocale, getStoredLocale, () => "es");
  const normalizedTheme = useMemo(() => normalizeSiteTheme(content.theme), [content.theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    applyThemeVariables(normalizedTheme);
  }, [normalizedTheme]);

  const localized = useMemo(() => {
    if (locale !== "es") {
      return content;
    }

    const es = content.locales?.es;

    return {
      ...content,
      siteTitle: es?.siteTitle ?? content.siteTitle,
      homeText: {
        ...content.homeText,
        ...es?.homeText
      },
      cv: {
        ...content.cv,
        ...es?.cv
      },
      subtitle: es?.subtitle ?? content.subtitle,
      heroText: es?.heroText ?? content.heroText,
      primaryCta: es?.primaryCta ?? content.primaryCta,
      secondaryCta: es?.secondaryCta ?? content.secondaryCta,
      bioTitle: es?.bioTitle ?? content.bioTitle,
      bioText: es?.bioText ?? content.bioText,
      credentials: es?.credentials ?? content.credentials,
      servicesIntro: es?.servicesIntro ?? content.servicesIntro,
      services: es?.services ?? content.services,
      bookingInfo: es?.bookingInfo ?? content.bookingInfo,
      contactTitle: es?.contactTitle ?? content.contactTitle,
      contactText: es?.contactText ?? content.contactText,
      contactEmail: es?.contactEmail ?? content.contactEmail,
      testimonials: es?.testimonials ?? content.testimonials
    };
  }, [content, locale]);

  const labels =
    locale === "es"
      ? {
          builtBy: localized.homeText?.builtByLabel ?? "Construido por",
          languageLabel: "Cambiar idioma",
          flows: "Flujos",
          modules: "Módulos",
          howItWorks: "Cómo funciona",
          venueConsole: "Consola del venue",
          contact: "Contacto",
          monetization: "Monetización",
          admin: "Admin",
          quickView: "Vista rápida",
          email: "Correo"
        }
      : {
          builtBy: localized.homeText?.builtByLabel ?? "Built by",
          languageLabel: "Change language",
          flows: "Flows",
          modules: "Modules",
          howItWorks: "How it works",
          venueConsole: "Venue console",
          contact: "Contact",
          monetization: "Monetization",
          admin: "Admin",
          quickView: "Quick view",
          email: "Email"
        };

  const wallpaper = content.theme.backgroundImage || content.theme.light.backgroundImage;
  const socialEntries = Object.entries(localized.socialLinks ?? {}).filter(([, value]) => Boolean(value));
  const primaryCtaHref = locale === "es" ? "/como-funciona" : "/como-funciona";
  const secondaryCtaHref = "/venue";

  const flowCards: FlowCard[] =
    locale === "es"
      ? [
          {
            stage: "01",
            title: "Venue crea el evento",
            body: "El operador arma fecha, aforo, timeline, precio base y reparto para artista desde una sola consola.",
            points: ["Doors + soundcheck", "Inventario total", "Tema visual del venue"]
          },
          {
            stage: "02",
            title: "El sistema publica y vende",
            body: "Se genera una landing ligera para móvil, se aplica el cargo de $15 MXN y se protege contra doble cobro con idempotencia.",
            points: ["Página pública", "Checkout defensivo", "QR seguro"]
          },
          {
            stage: "03",
            title: "Artista y staff se coordinan",
            body: "El artista ve payout, rider y contexto; el venue mantiene control de accesos, status y disponibilidad en tiempo real.",
            points: ["Datos bancarios", "Rider técnico", "Estado del show"]
          },
          {
            stage: "04",
            title: "Se liquida sin hojas sueltas",
            body: "El ledger registra bruto, fee plataforma, costo procesador, neto al venue y neto al artista en una sola línea contable.",
            points: ["Ledger inmutable", "Split payout", "Trazabilidad completa"]
          }
        ]
      : [
          {
            stage: "01",
            title: "Venue creates the event",
            body: "The operator sets date, capacity, timeline, base pricing, and artist split from one control surface.",
            points: ["Doors + soundcheck", "Total inventory", "Venue branding"]
          },
          {
            stage: "02",
            title: "The system publishes and sells",
            body: "A lightweight mobile page goes live, the $15 MXN fee is applied, and double charges are blocked with idempotency.",
            points: ["Public page", "Defensive checkout", "Secure QR"]
          },
          {
            stage: "03",
            title: "Artist and staff stay aligned",
            body: "The artist sees payout and rider context while the venue keeps real-time control over access and availability.",
            points: ["Bank details", "Technical rider", "Show status"]
          },
          {
            stage: "04",
            title: "Settlement closes cleanly",
            body: "The ledger captures gross paid, platform fee, processor cost, venue net, and artist net in one auditable line.",
            points: ["Immutable ledger", "Split payout", "Full traceability"]
          }
        ];

  const orchestrationRail =
    locale === "es"
      ? [
          ["Antes de abrir", "Configuras fecha, lineup, aforo, fee y payout."],
          ["Durante la venta", "El público compra en móvil y el inventario baja de forma atómica."],
          ["Durante el acceso", "Cada ticket se valida con QR y estado seguro."],
          ["Después del show", "Se consolida el ledger y se prepara la liquidación."]
        ]
      : [
          ["Before doors", "Set date, lineup, capacity, fee, and payout."],
          ["During sales", "Audience buys on mobile and inventory decrements atomically."],
          ["At check-in", "Each ticket is validated through secure QR state."],
          ["After the show", "The ledger consolidates and payout preparation begins."]
        ];

  const navItems: NavItem[] = [
    { href: "#flows", label: labels.flows, tone: "flows" },
    { href: "#modules", label: labels.modules, tone: "modules" },
    { href: "/como-funciona", label: labels.howItWorks, tone: "system", internal: true },
    { href: "/venue", label: labels.venueConsole, tone: "venue", internal: true },
    { href: "#contact", label: labels.contact, tone: "contact" },
  ];

  return (
    <main
      className={styles.page}
      data-banner={content.theme.bannerStyle ?? "editorial"}
      data-contrast={content.theme.contrast}
      data-theme-scope
      style={
        {
          ...(wallpaper ? { "--cv-wallpaper": `url(${wallpaper})` } : {}),
          "--theme-wallpaper-visibility": `${content.theme.surface?.wallpaperVisibility ?? 30}%`,
          "--theme-surface-visibility": `${content.theme.surface?.surfaceVisibility ?? 30}%`,
          "--theme-strong-scrim": `${content.theme.surface?.strongScrim ?? 88}%`,
          "--theme-medium-scrim": `${content.theme.surface?.mediumScrim ?? 56}%`,
          "--theme-border-radius": `${content.theme.surface?.borderRadius ?? 16}px`,
          "--theme-border-width": `${content.theme.surface?.borderWidth ?? 1}px`,
          "--theme-blur-strength": `${content.theme.surface?.blurStrength ?? 10}px`
        } as React.CSSProperties
      }
    >
      <nav className={styles.nav}>
        <a className={styles.brand} href="#top">
          <span>{labels.builtBy}</span>
          <strong>{localized.siteTitle}</strong>
        </a>
        <div className={styles.navLinks}>
          {navItems.map((item) =>
            item.internal ? (
              <Link key={item.href} href={item.href} className={styles.navPill} data-tone={item.tone}>
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className={styles.navPill} data-tone={item.tone}>
                {item.label}
              </a>
            ),
          )}
          <LanguageToggle locale={locale} onChange={setStoredLocale} label={labels.languageLabel} />
          <ThemeModeToggle />
          <Link href="/admin" className={styles.adminLink}>
            {labels.admin}
          </Link>
        </div>
      </nav>

      <section className={styles.hero} id="top">
        {wallpaper ? (
          <div className={styles.wallpaperBanner} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wallpaper} alt="" />
          </div>
        ) : null}
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{localized.subtitle}</p>
          <h1>{localized.cv.fullName}</h1>
          <p className={styles.heroHeadline}>{localized.cv.headline}</p>
          <p className={styles.summaryText}>{localized.heroText ?? localized.cv.summary}</p>
          <div className={styles.heroActions}>
            <Link href={primaryCtaHref} className={styles.primaryAction}>
              {localized.primaryCta ?? labels.howItWorks}
            </Link>
            <Link href={secondaryCtaHref} className={styles.secondaryAction}>
              {localized.secondaryCta ?? labels.venueConsole}
            </Link>
          </div>
        </div>

        <aside className={styles.operatorBoard}>
          <div className={styles.boardHeader}>
            <p>{labels.quickView}</p>
            <strong>Tonight&apos;s operating stack</strong>
          </div>
          <div className={styles.boardGrid}>
            <article>
              <span>Fee por ticket</span>
              <strong>$15 MXN</strong>
              <small>Se suma al checkout del público.</small>
            </article>
            <article>
              <span>Fee payout</span>
              <strong>1.5%</strong>
              <small>Se descuenta solo en payout automatizado.</small>
            </article>
            <article>
              <span>Mobile first</span>
              <strong>4G-ready</strong>
              <small>Feed cacheado y checkout defensivo.</small>
            </article>
            <article>
              <span>Operación</span>
              <strong>1 panel</strong>
              <small>Evento, artista, boletos y settlement juntos.</small>
            </article>
          </div>
          <div className={styles.boardStream}>
            <div>
              <b>18:30</b>
              <span>Soundcheck bloqueado</span>
            </div>
            <div>
              <b>20:00</b>
              <span>Landing activa + tickets live</span>
            </div>
            <div>
              <b>22:00</b>
              <span>Check-in QR + ledger corriendo</span>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.flowSection} id="flows">
        <div className={styles.sectionHeading}>
          <p>{labels.flows}</p>
          <h2>{locale === "es" ? "Aquí sí se entiende quién hace qué" : "A clearer system of who does what"}</h2>
        </div>
        <div className={styles.flowGrid}>
          {flowCards.map((card) => (
            <article key={card.stage} className={styles.flowCard}>
              <span>{card.stage}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <ul>
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.orchestrationSection} id="modules">
        <div className={styles.sectionHeading}>
          <p>{labels.modules}</p>
          <h2>{localized.servicesIntro}</h2>
        </div>
        <div className={styles.orchestrationGrid}>
          <div className={styles.moduleColumn}>
            {(localized.services ?? []).map((service) => (
              <article key={`${service.eyebrow}-${service.title}`} className={styles.moduleCard}>
                <span>{service.eyebrow}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>

          <article className={styles.railCard}>
            <p>{locale === "es" ? "Timeline del sistema" : "System timeline"}</p>
            <div className={styles.railStack}>
              {orchestrationRail.map(([title, body]) => (
                <div key={title} className={styles.railItem}>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.monetizationCard}>
            <p>{labels.monetization}</p>
            <h3>{locale === "es" ? "Modelo claro para el venue" : "A clear venue business model"}</h3>
            <div className={styles.moneyRows}>
              <div>
                <span>{locale === "es" ? "Venue" : "Venue"}</span>
                <strong>{locale === "es" ? "No paga suscripción base" : "No base subscription"}</strong>
              </div>
              <div>
                <span>{locale === "es" ? "Consumidor" : "Consumer"}</span>
                <strong>{locale === "es" ? "+$15 MXN por boleto" : "+$15 MXN per ticket"}</strong>
              </div>
              <div>
                <span>{locale === "es" ? "Payout artista" : "Artist payout"}</span>
                <strong>{locale === "es" ? "1.5% si es automatizado" : "1.5% when automated"}</strong>
              </div>
            </div>
            <p className={styles.moneyNote}>{localized.bookingInfo}</p>
          </article>
        </div>
      </section>

      <section className={styles.workspaceSection}>
        <div className={styles.sectionHeading}>
          <p>{labels.venueConsole}</p>
          <h2>
            {locale === "es"
              ? "La interfaz del creador de eventos ya no está escondida"
              : "The event creator interface is no longer hidden"}
          </h2>
        </div>
        <div className={styles.workspaceGrid}>
          <article className={styles.workspaceNarrative}>
            <p>{localized.bioText}</p>
            <div className={styles.workspaceActions}>
              <Link href="/venue" className={styles.primaryAction}>
                {labels.venueConsole}
              </Link>
              <Link href="/como-funciona" className={styles.secondaryAction}>
                {labels.howItWorks}
              </Link>
            </div>
          </article>
          <article className={styles.workspacePreview}>
            <div className={styles.previewTopbar}>
              <span>Event Composer</span>
              <i />
              <i />
              <i />
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewColumn}>
                <strong>{locale === "es" ? "Evento" : "Event"}</strong>
                <span>Midnight Cumbia Systems</span>
                <span>{locale === "es" ? "Aforo: 320" : "Capacity: 320"}</span>
                <span>{locale === "es" ? "Base: $280 MXN" : "Base: $280 MXN"}</span>
              </div>
              <div className={styles.previewColumn}>
                <strong>{locale === "es" ? "Checkout" : "Checkout"}</strong>
                <span>{locale === "es" ? "Cargo consumidor: $15" : "Consumer fee: $15"}</span>
                <span>{locale === "es" ? "Estado: published" : "State: published"}</span>
                <span>{locale === "es" ? "QR: ready" : "QR: ready"}</span>
              </div>
              <div className={styles.previewColumn}>
                <strong>{locale === "es" ? "Settlement" : "Settlement"}</strong>
                <span>{locale === "es" ? "Venue neto: visible" : "Venue net: visible"}</span>
                <span>{locale === "es" ? "Artista neto: visible" : "Artist net: visible"}</span>
                <span>{locale === "es" ? "Ledger: locked" : "Ledger: locked"}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {localized.testimonials && localized.testimonials.length > 0 ? (
        <section className={styles.testimonialsSection}>
          <div className={styles.sectionHeading}>
            <p>Feedback</p>
            <h2>{locale === "es" ? "Se siente como producto, no como demo" : "This now reads like a product"}</h2>
          </div>
          <div className={styles.testimonialGrid}>
            {localized.testimonials.map((item) => (
              <article key={`${item.name}-${item.role}`} className={styles.testimonialCard}>
                <p>{item.quote}</p>
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.contactSection} id="contact">
        <div className={styles.sectionHeading}>
          <p>{labels.contact}</p>
          <h2>{localized.contactTitle}</h2>
        </div>
        <div className={styles.contactCard}>
          <p>{localized.contactText}</p>
          <a href={`mailto:${localized.contactEmail ?? localized.cv.email}`} className={styles.contactLink}>
            {labels.email}: {localized.contactEmail ?? localized.cv.email}
          </a>
          {socialEntries.length > 0 ? (
            <div className={styles.socialLinks}>
              {socialEntries.map(([name, value]) => (
                <a key={name} href={value as string} target="_blank" rel="noreferrer">
                  {name}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function HomePagePreview({
  content,
  viewport,
}: {
  content: SiteContent;
  viewport: "desktop" | "tablet" | "mobile";
}) {
  const wallpaper = content.theme.backgroundImage || content.theme.light.backgroundImage;
  const previewFlowCards = (content.services ?? []).slice(0, 2);
  const previewTheme = normalizeSiteTheme(content.theme);

  return (
    <div
      className={styles.page}
      data-banner={content.theme.bannerStyle ?? "editorial"}
      data-contrast={content.theme.contrast}
      data-preview="true"
      data-preview-viewport={viewport}
      data-theme-scope
      style={
        {
          ...themeCssVariables(content.theme),
          "--accent": previewTheme.accent,
          "--accent-alt": previewTheme.accentAlt,
          "--background": previewTheme.background,
          "--foreground": previewTheme.foreground,
          "--muted": previewTheme.muted,
          "--line": previewTheme.line,
          "--panel": previewTheme.panel,
          "--panel-strong": previewTheme.panelStrong,
          "--ink": previewTheme.ink,
          ...(wallpaper ? { "--cv-wallpaper": `url(${wallpaper})` } : {}),
          "--theme-wallpaper-visibility": `${content.theme.surface?.wallpaperVisibility ?? 30}%`,
          "--theme-surface-visibility": `${content.theme.surface?.surfaceVisibility ?? 30}%`,
          "--theme-strong-scrim": `${content.theme.surface?.strongScrim ?? 88}%`,
          "--theme-medium-scrim": `${content.theme.surface?.mediumScrim ?? 56}%`,
          "--theme-border-radius": `${content.theme.surface?.borderRadius ?? 16}px`,
          "--theme-border-width": `${content.theme.surface?.borderWidth ?? 1}px`,
          "--theme-blur-strength": `${content.theme.surface?.blurStrength ?? 10}px`
        } as React.CSSProperties
      }
    >
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span>{content.homeText?.builtByLabel ?? "Built by"}</span>
          <strong>{content.siteTitle}</strong>
        </div>
        <div className={styles.navLinks}>
          <span className={styles.navPill} data-tone="flows">Flows</span>
          <span className={styles.navPill} data-tone="modules">Modules</span>
          <span className={styles.navPill} data-tone="venue">Venue</span>
        </div>
      </nav>

      <section className={styles.hero}>
        {wallpaper ? (
          <div className={styles.wallpaperBanner} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wallpaper} alt="" />
          </div>
        ) : null}
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{content.subtitle}</p>
          <h1>{content.cv.fullName}</h1>
          <p className={styles.heroHeadline}>{content.cv.headline}</p>
          <p className={styles.summaryText}>{content.heroText ?? content.cv.summary}</p>
          <div className={styles.heroActions}>
            <span className={styles.primaryAction}>{content.primaryCta ?? "View events"}</span>
            <span className={styles.secondaryAction}>{content.secondaryCta ?? "Explore modules"}</span>
          </div>
        </div>

        <aside className={styles.operatorBoard}>
          <div className={styles.boardHeader}>
            <p>Quick view</p>
            <strong>Tonight&apos;s operating stack</strong>
          </div>
          <div className={styles.boardGrid}>
            <article>
              <span>Fee por ticket</span>
              <strong>$15 MXN</strong>
              <small>Se suma al checkout del público.</small>
            </article>
            <article>
              <span>Mobile first</span>
              <strong>4G-ready</strong>
              <small>Feed cacheado y checkout defensivo.</small>
            </article>
          </div>
          <div className={styles.boardStream}>
            <div>
              <b>20:00</b>
              <span>Landing activa + tickets live</span>
            </div>
            <div>
              <b>22:00</b>
              <span>Check-in QR + ledger corriendo</span>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.flowSection}>
        <div className={styles.sectionHeading}>
          <p>Modules</p>
          <h2>{content.servicesIntro}</h2>
        </div>
        <div className={styles.flowGrid}>
          {previewFlowCards.map((service) => (
            <article key={service.title} className={styles.flowCard}>
              <span>{service.eyebrow}</span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.workspaceSection}>
        <div className={styles.workspaceGrid}>
          <article className={styles.workspaceNarrative}>
            <p>{content.bioText}</p>
          </article>
          <article className={styles.workspacePreview}>
            <div className={styles.previewTopbar}>
              <span>Event Composer</span>
              <i />
              <i />
              <i />
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewColumn}>
                <strong>Event</strong>
                <span>Midnight Cumbia Systems</span>
                <span>Capacity: 320</span>
              </div>
              <div className={styles.previewColumn}>
                <strong>Checkout</strong>
                <span>Consumer fee: $15</span>
                <span>State: published</span>
              </div>
              <div className={styles.previewColumn}>
                <strong>Settlement</strong>
                <span>Venue net: visible</span>
                <span>Ledger: locked</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function LanguageToggle({
  locale,
  label,
  onChange
}: {
  locale: Locale;
  label: string;
  onChange: (locale: Locale) => void;
}) {
  return (
    <button
      className={styles.languageToggle}
      type="button"
      aria-label={label}
      onClick={() => onChange(locale === "en" ? "es" : "en")}
    >
      {locale.toUpperCase()}
    </button>
  );
}
