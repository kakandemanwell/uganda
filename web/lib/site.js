// Canonical origin for metadataBase, OG/Twitter tags, JSON-LD, and the
// sitemap/robots generators. Falls back to the production domain so local
// builds without the env var still produce absolute, well-formed URLs.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://data.mnwll.tech";
