import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandSearch } from "@/components/command-search";

const NAV_LINKS = [
  ["/explore", "Explore data"],
  ["/map", "Map"],
];

export function SiteHeader({ onSelectDistrict }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Image
            src="/country/flag.svg"
            alt="Flag of Uganda"
            width={24}
            height={16}
            className="rounded-[3px] ring-1 ring-border/60"
          />
          <span>uganda-locale</span>
        </Link>

        <nav className="hidden items-center gap-4 md:flex">
          {NAV_LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="hidden w-full max-w-xs sm:block">
          <CommandSearch onSelectDistrict={onSelectDistrict} />
        </div>

        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            nativeButton={false}
            render={
              <a
                href="https://www.npmjs.com/package/uganda-locale"
                target="_blank"
                rel="noreferrer"
                aria-label="View on npm"
              >
                <Package className="size-4" />
              </a>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            nativeButton={false}
            render={
              <a
                href="https://github.com/kakandemanwell/uganda"
                target="_blank"
                rel="noreferrer"
                aria-label="View source on GitHub"
              >
                <GithubIcon className="size-4" />
              </a>
            }
          />
          <ThemeToggle />
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pb-3 sm:hidden">
        <CommandSearch onSelectDistrict={onSelectDistrict} />
      </div>
      <nav className="flex items-center gap-4 border-t border-border/60 px-4 py-2 md:hidden">
        {NAV_LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
