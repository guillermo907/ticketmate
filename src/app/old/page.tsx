import { HomePage } from "@/components/home/home-page";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function OldPage() {
  const content = await getSiteContent();

  return <HomePage content={content} />;
}
