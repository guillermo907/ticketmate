import type { Metadata } from "next";
import { VenueWorkspace } from "@/components/venue/venue-workspace";
import { getSiteContent } from "@/lib/content";
import { getAllEvents } from "@/lib/events";

export const metadata: Metadata = {
  title: "Venue Console | Foro GDL",
  description:
    "Workspace del venue para crear eventos, estructurar ticketing, coordinar artistas y visualizar settlements."
};

export const dynamic = "force-dynamic";

export default async function VenuePage() {
  const [events, content] = await Promise.all([getAllEvents(), getSiteContent()]);
  const siteWallpaper =
    content.theme.backgroundImage ||
    content.theme.light.backgroundImage ||
    "/uploads/cv-wallpaper-d8dc4df6-6283-49ff-a115-9a6142a90abe.jpg";

  return (
    <VenueWorkspace
      initialEvents={events}
      siteWallpaper={siteWallpaper}
      applyConsoleWallpaper={Boolean(content.theme.applyVenueConsoleWallpaper)}
      applyEventPosterWallpaper={Boolean(content.theme.applyEventPosterConsoleWallpaper)}
    />
  );
}
