import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "uganda-locale — Uganda's administrative data, mapped",
  description:
    "Uganda's administrative units — region, sub-region, district, county, subcounty, parish, village — plus boundaries, roads, and 2024 census population, served as JSON.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        {/* enableSystem intentionally omitted: this app defaults to dark
            regardless of OS preference (the design brief calls for dark by
            default), while still letting the user's explicit ThemeToggle
            choice persist via next-themes' own localStorage handling. */}
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
