import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { REPO_URL, FEEDBACK_URL } from "@/lib/feedback.mjs";

// Plain-language privacy note. Keep it describing what the site *actually*
// does — if a new third-party request, cookie or form is added anywhere in
// the app, this page needs the same change.

const TITLE = "Privacy";
const DESCRIPTION = "What uganda-locale's website collects (very little), who else sees your visit, and how to opt out.";
const UPDATED = "5 November 2026";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/privacy" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
          <p className="text-muted-foreground">
            The short version: there are no accounts, no sign-ups and no forms on this site, and we never ask for your
            name or email. We use Google Analytics to count visits and see which pages are useful. That's it.
          </p>
        </header>

        <Section title="What we measure">
          <p>
            We use <strong>Google Analytics</strong>, loaded through Google Tag Manager, to understand how the site is
            used, for example how many people visit, which districts get looked up, and whether people arrive from X,
            GitHub or search. For each visit Google Analytics records:
          </p>
          <ul>
            <li>the pages you view, and the page that linked you here</li>
            <li>your approximate location (country and city), worked out from your IP address. Google Analytics doesn't store the IP address itself</li>
            <li>your device type, browser, operating system, screen size and language</li>
            <li>simple interactions such as scrolling and clicking links that leave the site</li>
          </ul>
          <p>
            To tell a returning visitor from a new one, it sets two cookies in your browser (<code>_ga</code> and{" "}
            <code>_ga_…</code>), which last up to two years. We see this only as totals and trends. We don't use it to
            identify anyone, we don't use it for advertising, and we don't sell it. Google keeps the underlying data for
            up to 14 months.
          </p>
        </Section>

        <Section title="What we don't collect">
          <ul>
            <li>No accounts, logins, newsletters or contact forms.</li>
            <li>No names, emails or phone numbers.</li>
            <li>
              Downloading the data or using the API doesn't need a key and isn't tied to you. The npm package doesn't
              report usage either.
            </li>
          </ul>
        </Section>

        <Section title="Other services your browser talks to">
          <p>Like most websites, a visit here involves a few other services, each under its own privacy policy:</p>
          <ul>
            <li>
              <strong>Vercel</strong> hosts the site. Its servers handle every request, so they see your IP address and
              keep short-lived technical logs.
            </li>
            <li>
              On the <Link href="/map">map</Link>, base map tiles come from <strong>OpenFreeMap</strong>, and 3D terrain
              comes from the open elevation tiles on <strong>Amazon Web Services</strong>. Your browser loads these
              directly, so those services see your IP address. Satellite imagery from Esri is fetched by our own server,
              so Esri doesn't see your visit.
            </li>
            <li>
              Links to <strong>Google Maps</strong>, <strong>Street View</strong>, <strong>Mapillary</strong>,{" "}
              <strong>GitHub</strong> and <strong>npm</strong> only contact those sites if you click them.
            </li>
          </ul>
        </Section>

        <Section title="Reporting a correction">
          <p>
            &ldquo;Report a correction&rdquo; links open a new issue on{" "}
            <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>, pre-filled with the unit you were looking at.
            Nothing is sent until you submit it there, from your own GitHub account. GitHub issues are public, so please
            don't include personal details you wouldn't want published.
          </p>
        </Section>

        <Section title="Stored on your device">
          <p>
            If you switch between light and dark mode, that choice is saved in your browser&rsquo;s local storage so it
            sticks next time. It never leaves your device.
          </p>
        </Section>

        <Section title="Opting out">
          <ul>
            <li>Block or clear cookies for this site in your browser settings.</li>
            <li>
              Install Google&rsquo;s{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">
                Analytics opt-out add-on
              </a>
              , or use a content blocker. The site and data work exactly the same without analytics.
            </li>
          </ul>
        </Section>

        <Section title="Questions">
          <p>
            Ask anything about this note, or about data held about you, by{" "}
            <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">opening an issue on GitHub</a>. If this site starts
            collecting anything new, this page will be updated first and the date at the top will change.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground [&_code]:font-mono [&_code]:text-xs [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
