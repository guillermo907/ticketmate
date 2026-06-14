import type { SiteContent } from "./types";

export const defaultContent: SiteContent = {
  siteTitle: "Foro GDL",
  homeText: {
    builtByLabel: "Built by",
    downloadCvLabel: "Download venue brief",
    generatePdfLabel: "Generate venue brief from this page",
    generatePdfButtonLabel: "Generate PDF file",
    experienceTitle: "Operations",
    skillsTitle: "Capabilities",
    educationTitle: "Infrastructure",
    projectsTitle: "Use cases",
    locationLabel: "Base",
    contactLabel: "Contact"
  },
  cv: {
    fullName: "Foro GDL",
    headline: "Live music venue operations and transactional ticketing",
    location: "Guadalajara, MX",
    address: "Americana, Guadalajara, Jalisco, Mexico",
    email: "operaciones@foro-gdl.mx",
    phone: "+52 33 0000 0000",
    summary:
      "Venue operations platform built for independent rooms that need fast event publishing, secure ticketing, payout orchestration, and night-of-show control.",
    skills: [
      "Event publishing",
      "Ticket inventory controls",
      "Split settlements",
      "Role-based operations",
      "Calendar sync",
      "Venue theming"
    ],
    experience: [
      {
        role: "Venue operations dashboard",
        company: "Foro GDL Platform",
        period: "Phase 1",
        highlights: [
          "Publish events with door times, soundchecks, and inventory controls.",
          "Manage payouts, routing, and performer access from one admin surface.",
          "Keep brand presentation editable through venue-driven theme tokens."
        ]
      },
      {
        role: "Transactional ticketing engine",
        company: "Foro GDL Platform",
        period: "Phase 2",
        highlights: [
          "Protect checkout flows with idempotency keys on unreliable mobile networks.",
          "Split consumer fees, processor fees, venue revenue, and artist payouts automatically."
        ]
      }
    ],
    education: [
      {
        title: "Micro-SaaS foundation",
        institution: "Next.js, Prisma, Auth.js, PostgreSQL",
        period: "Current build"
      }
    ],
    showProjects: false,
    projects: [
      {
        title: "Public event landing pages",
        url: "https://example.com",
        description: "SEO-ready event pages with JSON-LD, Open Graph tags, and local-feed caching for faster consumer booking."
      }
    ]
  },
  subtitle: "Operacion nocturna, ticketing agil y liquidaciones claras.",
  heroText:
    "Plataforma para venues independientes en Guadalajara que necesitan publicar shows, vender boletos, coordinar artistas y cerrar la noche con menos friccion operativa.",
  primaryCta: "Ver eventos",
  secondaryCta: "Explorar modulos",
  bioTitle: "Infraestructura digital para venues y promotores",
  bioText:
    "Foro GDL combina administracion de eventos, checkout transaccional y control de liquidaciones en una interfaz pensada para equipos pequeños que operan rapido y con poco margen para errores.",
  credentials: [
    "Operacion de eventos, artistas y staff desde un mismo flujo",
    "Cobro con sobrecargo al consumidor y fee de payout automatizado",
    "Experiencia movil optimizada para publico en redes 4G"
  ],
  servicesIntro:
    "Modulos pensados para venues, promotores y artistas que necesitan operar sin friccion.",
  services: [
    {
      eyebrow: "Venue Ops",
      title: "Programacion y calendarizacion",
      description:
        "Administra aperturas de puertas, soundchecks, cupo total y sincronizacion con Google Calendar desde una sola vista."
    },
    {
      eyebrow: "Ticketing",
      title: "Checkout y control de acceso",
      description:
        "Protege inventario con transacciones atomicas, idempotencia y QR seguro para acceso rapido."
    },
    {
      eyebrow: "Finance",
      title: "Split payouts y ledger",
      description:
        "Registra fee al consumidor, costo del procesador, neto al venue y neto al artista en un ledger inmutable."
    }
  ],
  bookingInfo:
    "El modelo base mantiene la plataforma gratuita para venues y monetiza mediante el cargo fijo por boleto y el micro-porcentaje aplicado a payouts automatizados.",
  contactTitle: "Llevemos mejor operacion a tu venue",
  contactText:
    "Escribe para implementar ticketing transaccional, dashboard de operacion, perfiles de artistas o automatizacion de liquidaciones.",
  contactEmail: "operaciones@foro-gdl.mx",
  testimonials: [],
  seo: {
    title: "Foro GDL | Venue management and ticketing platform",
    description:
      "Micro-SaaS para venues de musica en vivo con administracion de eventos, ticketing, split payouts y operacion movil.",
    ogImage: "/opengraph-image"
  },
  socialLinks: {
    instagram: "https://instagram.com/",
    youtube: "https://www.youtube.com/@comando9072",
    spotify: "https://spotify.com/"
  },
  theme: {
    accent: "#76f005",
    accentAlt: "#47f556",
    background: "#192211",
    backgroundImage: "",
    contrast: "soft",
    bannerStyle: "editorial",
    surface: {
      wallpaperVisibility: 30,
      surfaceVisibility: 30,
      strongScrim: 88,
      mediumScrim: 56,
      borderRadius: 16,
      borderWidth: 1,
      blurStrength: 10
    },
    light: {
      accent: "#4ea003",
      accentAlt: "#0ba32c",
      background: "#f5f7f3",
      backgroundImage: "",
      contrast: "editorial"
    }
  },
  themeHistory: [],
  locales: {
    es: {
      siteTitle: "Foro GDL",
      homeText: {
        builtByLabel: "Construido por",
        downloadCvLabel: "Descargar resumen del venue",
        generatePdfLabel: "Generar PDF desde esta pagina",
        generatePdfButtonLabel: "Generar archivo PDF",
        experienceTitle: "Operacion",
        skillsTitle: "Capacidades",
        educationTitle: "Infraestructura",
        projectsTitle: "Casos de uso",
        locationLabel: "Base",
        contactLabel: "Contacto"
      },
      cv: {
        headline: "Operacion de venues y ticketing transaccional",
        summary:
          "Plataforma para venues de musica en vivo con publicacion de eventos, checkout seguro, payouts automatizados y control operativo."
      },
      subtitle: "Operacion nocturna, ticketing agil y liquidaciones claras.",
      heroText:
        "Plataforma para venues independientes en Guadalajara que necesitan publicar shows, vender boletos, coordinar artistas y cerrar la noche con menos friccion operativa.",
      primaryCta: "Ver eventos",
      secondaryCta: "Explorar modulos",
      bioTitle: "Infraestructura digital para venues y promotores",
      bioText:
        "Foro GDL combina administracion de eventos, checkout transaccional y control de liquidaciones en una interfaz pensada para equipos pequenos que operan rapido y con poco margen para errores.",
      credentials: [
        "Operacion de eventos, artistas y staff desde un mismo flujo",
        "Cobro con sobrecargo al consumidor y fee de payout automatizado",
        "Experiencia movil optimizada para publico en redes 4G"
      ],
      servicesIntro:
        "Modulos pensados para venues, promotores y artistas que necesitan operar sin friccion.",
      services: [
        {
          eyebrow: "Venue Ops",
          title: "Programacion y calendarizacion",
          description:
            "Administra aperturas de puertas, soundchecks, cupo total y sincronizacion con Google Calendar desde una sola vista."
        },
        {
          eyebrow: "Ticketing",
          title: "Checkout y control de acceso",
          description:
            "Protege inventario con transacciones atomicas, idempotencia y QR seguro para acceso rapido."
        },
        {
          eyebrow: "Finance",
          title: "Split payouts y ledger",
          description:
            "Registra fee al consumidor, costo del procesador, neto al venue y neto al artista en un ledger inmutable."
        }
      ],
      bookingInfo:
        "El modelo base mantiene la plataforma gratuita para venues y monetiza mediante el cargo fijo por boleto y el micro-porcentaje aplicado a payouts automatizados.",
      contactTitle: "Llevemos mejor operacion a tu venue",
      contactText:
        "Escribe para implementar ticketing transaccional, dashboard de operacion, perfiles de artistas o automatizacion de liquidaciones.",
      contactEmail: "operaciones@foro-gdl.mx"
    }
  }
};
