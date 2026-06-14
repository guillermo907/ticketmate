import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { defaultContent } from "./default-content";
import { assertWritableStorage, shouldUseBlobStorage } from "./storage";
import { normalizeThemeForStorage } from "./theme-contrast";
import type { SiteContent } from "./types";

const contentPath = path.join(process.cwd(), "data", "site-content.json");
const blobKey = "site-content.json";

function mergeContent(raw: Partial<SiteContent>): SiteContent {
  const themeHistory = Array.isArray(raw.themeHistory)
    ? raw.themeHistory.slice(0, 2).map((revision) => ({
        id: String(revision?.id ?? ""),
        savedAt: String(revision?.savedAt ?? ""),
        theme: normalizeThemeForStorage(revision?.theme ?? defaultContent.theme)
      }))
    : defaultContent.themeHistory;

  return {
    ...defaultContent,
    ...raw,
    homeText: {
      ...defaultContent.homeText!,
      ...raw.homeText
    },
    cv: {
      ...defaultContent.cv,
      ...raw.cv,
      experience: raw.cv?.experience ?? defaultContent.cv.experience,
      education: raw.cv?.education ?? defaultContent.cv.education,
      skills: raw.cv?.skills ?? defaultContent.cv.skills,
      projects: raw.cv?.projects ?? defaultContent.cv.projects,
      showProjects: raw.cv?.showProjects ?? defaultContent.cv.showProjects
    },
    theme: {
      ...defaultContent.theme,
      ...raw.theme,
      light: {
        ...defaultContent.theme.light,
        ...raw.theme?.light
      }
    },
    themeHistory,
    locales: {
      ...defaultContent.locales,
      ...raw.locales,
      es: {
        ...defaultContent.locales?.es,
        ...raw.locales?.es,
        homeText: {
          ...defaultContent.locales?.es?.homeText,
          ...raw.locales?.es?.homeText
        },
        cv: {
          ...defaultContent.locales?.es?.cv,
          ...raw.locales?.es?.cv
        }
      }
    }
  };
}

async function getBlobContent(): Promise<SiteContent | null> {
  if (!shouldUseBlobStorage()) return null;

  try {
    const result = await get(blobKey, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const raw = await new Response(result.stream).text();
    return mergeContent(JSON.parse(raw) as Partial<SiteContent>);
  } catch {
    return null;
  }
}

async function getFileContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(contentPath, "utf8");
    return mergeContent(JSON.parse(raw) as Partial<SiteContent>);
  } catch {
    return defaultContent;
  }
}

export async function getSiteContent(): Promise<SiteContent> {
  return (await getBlobContent()) ?? (await getFileContent());
}

export async function saveSiteContent(content: SiteContent) {
  assertWritableStorage();

  if (shouldUseBlobStorage()) {
    await put(blobKey, JSON.stringify(content, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });
    return;
  }

  await fs.mkdir(path.dirname(contentPath), { recursive: true });
  await fs.writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}
