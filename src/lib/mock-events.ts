import type { VenueEventRecord } from "./event-types";

export const defaultEventSeeds: VenueEventRecord[] = [
  {
    id: "seed-midnight-cumbia-systems",
    slug: "midnight-cumbia-systems",
    title: "Midnight Cumbia Systems",
    summary: "Cumbia digital, live brass and a late-night patio set built for Guadalajara weekends.",
    description:
      "A mobile-first ticket drop for Foro GDL featuring a headline cumbia systems act, guest selectors, and rapid-entry QR ticketing.",
    startsAt: "2026-06-12T22:00:00-06:00",
    endsAt: "2026-06-13T02:30:00-06:00",
    timezone: "America/Mexico_City",
    venueName: "Foro GDL",
    venueAddress: "Av. Chapultepec Sur 180, Americana, Guadalajara, Jalisco",
    heroImage: "/events/stage1.jpg",
    doorTime: "2026-06-12T21:00:00-06:00",
    soundcheckTime: "2026-06-12T18:30:00-06:00",
    operationalMoments: [],
    ticketPriceMXN: 280,
    ticketFeeMXN: 15,
    artistPayoutRate: 0.7,
    capacity: 320,
    soldCount: 174,
    lineup: ["La Sonora Pixel", "DJ Nopal", "Brass After Dark"],
    genre: ["Cumbia", "Tropical Bass", "Live Brass"],
    isPublished: true,
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z"
  },
  {
    id: "seed-neo-jazz-azotea-session",
    slug: "neo-jazz-azotea-session",
    title: "Neo Jazz Azotea Session",
    summary: "A rooftop jazz night with modern harmony, analog synth textures, and fast QR check-in.",
    description:
      "Designed as a premium but lightweight public event page, this session showcases how venues can publish indexed event landing pages without heavy scripts.",
    startsAt: "2026-06-19T20:30:00-06:00",
    endsAt: "2026-06-19T23:45:00-06:00",
    timezone: "America/Mexico_City",
    venueName: "Foro GDL",
    venueAddress: "Av. Chapultepec Sur 180, Americana, Guadalajara, Jalisco",
    heroImage: "/events/gallery1.jpg",
    doorTime: "2026-06-19T19:45:00-06:00",
    soundcheckTime: "2026-06-19T17:30:00-06:00",
    operationalMoments: [],
    ticketPriceMXN: 360,
    ticketFeeMXN: 15,
    artistPayoutRate: 0.72,
    capacity: 220,
    soldCount: 128,
    lineup: ["Marea Azul Quartet", "Guest Voice: Lucía Vega"],
    genre: ["Jazz", "Neo Soul", "Improvised Music"],
    isPublished: true,
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z"
  }
];
