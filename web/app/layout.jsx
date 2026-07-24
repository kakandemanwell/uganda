import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "uganda-locale — Uganda's administrative data, mapped";
const DESCRIPTION =
  "Uganda's administrative units — region, sub-region, district, county, subcounty, parish, village — plus boundaries, roads, and 2024 census population, served as JSON.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — uganda-locale" },
  description: DESCRIPTION,
  applicationName: "uganda-locale",
  keywords: [
    "Uganda administrative divisions",
    "Uganda districts",
    "Uganda sub-regions",
    "Uganda parishes",
    "Uganda villages",
    "Uganda census 2024",
    "Uganda GeoJSON boundaries",
    "Uganda open data API",
  ],
  authors: [{ name: "Manwell Kakande", url: "https://github.com/kakandemanwell" }],
  openGraph: {
    type: "website",
    siteName: "uganda-locale",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_UG",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        {/* enableSystem intentionally omitted: this app defaults to light
            regardless of OS preference, while still letting the user's
            explicit ThemeToggle choice persist via next-themes' own
            localStorage handling. */}
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
