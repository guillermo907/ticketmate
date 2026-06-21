import { NewMarketHomePage } from "@/components/home/new-market-home-page";
import { getSiteContent } from "@/lib/content";
import { getAllEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function NewPage() {
  const [content, events] = await Promise.all([getSiteContent(), getAllEvents()]);

  return <NewMarketHomePage content={content} events={events.filter((event) => event.isPublished)} />;
}
