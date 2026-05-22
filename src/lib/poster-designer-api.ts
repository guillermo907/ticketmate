const defaultPosterDesignerBaseUrl = "http://127.0.0.1:8000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getPosterDesignerBaseUrl() {
  return trimTrailingSlash(process.env.POSTER_DESIGNER_API_BASE_URL || defaultPosterDesignerBaseUrl);
}

export function getPosterDesignerGenerateUrl() {
  return process.env.POSTER_DESIGNER_API_URL || `${getPosterDesignerBaseUrl()}/v1/posters/generate`;
}

export function getPosterDesignerSelectUrl() {
  return process.env.POSTER_DESIGNER_SELECT_API_URL || `${getPosterDesignerBaseUrl()}/v1/posters/select`;
}

export function getPosterDesignerCleanupUrl() {
  return `${getPosterDesignerGenerateUrl().replace(/\/generate$/, "")}/cleanup`;
}

export function getPosterDesignerHealthUrl() {
  return process.env.POSTER_DESIGNER_HEALTH_URL || `${getPosterDesignerBaseUrl()}/healthz`;
}
