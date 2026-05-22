# CV App

Production-ready CV builder built with Next.js 16, TypeScript, SCSS modules, PDF parsing, and durable Vercel Blob storage.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env values:

```bash
cp .env.example .env
```

3. For local development, no storage token is required. Local edits are written to `data/site-content.json` and `public/uploads`.

4. Run locally:

```bash
npm run dev
```

## Content And Theme

Editable CV content and theme settings live in `data/site-content.json` for local development. In production on Vercel, set `BLOB_READ_WRITE_TOKEN` so `/admin` saves persist across refreshes, cold starts, deploys, and serverless instance changes.

Production storage uses Vercel Blob for:

- Parsed CV JSON: `site-content.json`
- Uploaded source CV PDFs: `cv/*.pdf`
- Uploaded wallpaper/theme images: `assets/cv-wallpaper.jpg`

If the app is running on Vercel without `BLOB_READ_WRITE_TOKEN`, save actions fail intentionally instead of writing to the ephemeral filesystem and silently losing data.

Default fallback content is in `src/lib/default-content.ts`. Theme normalization and contrast safety live in `src/lib/theme-contrast.ts`.

## Admin

The admin dashboard is currently public at `/admin` by design for this sprint. OAuth can be added later without changing the storage layer.

## Deploy

Recommended production deploy command:

```bash
npx vercel --prod --name cv-app
```

Configure these environment variables in Vercel before deploying:

- `BLOB_READ_WRITE_TOKEN`
# cv-builder
# ticketmate
# ticketmate
