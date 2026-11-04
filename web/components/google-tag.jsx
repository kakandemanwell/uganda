import Script from "next/script";

// Google tag (Tag Manager container) — the snippet from GTM's "Install
// manually" panel, loaded via next/script so it's injected once for the
// whole app from the root layout rather than pasted into every page.
//
// Production builds only: `next dev` visits would otherwise land in the
// analytics. Override the container with NEXT_PUBLIC_GTM_ID if it changes.
//
// Client-side navigations (the app is a SPA after first load) are tracked
// by GA4's enhanced measurement "page changes based on browser history
// events", which is on by default — no per-route code needed here.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-59RFGF54";

export function GoogleTag() {
  if (process.env.NODE_ENV !== "production" || !GTM_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());`}
      </Script>
    </>
  );
}
