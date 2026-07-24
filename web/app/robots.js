import { SITE_URL } from "@/lib/site";

// This is a public open-data project — the whole point is for the dataset to
// be found, cited, and quoted, including by AI answer engines. Everything is
// crawlable; only the API's own machine-readable surface is left out of the
// generic-crawler allow so we don't invite scraping in through /api/* instead
// of the documented download files on /data.
export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      // Explicitly named so these keep working even if a future default
      // ever tightened the "*" rule — these are the crawlers that actually
      // power citations in ChatGPT, Claude, Perplexity, and Google's AI
      // Overviews.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
