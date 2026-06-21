import { getSiteContent } from "@/lib/content";
import { getAllEvents } from "@/lib/events";
import { HomePage } from "@/components/home/home-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [content, events] = await Promise.all([getSiteContent(), getAllEvents()]);

  return <HomePage content={content} publicEvents={events.filter((event) => event.isPublished)} />;
}
