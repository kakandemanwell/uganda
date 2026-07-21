import Link from "next/link";
import { Package } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandSearch } from "@/components/command-search";

export function SiteHeader({ onSelectDistrict }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="text-lg leading-none">
            🇺🇬
          </span>
          <span>uganda-locale</span>
        </Link>

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
      <div className="mx-auto block max-w-6xl px-4 pb-3 sm:hidden">
        <CommandSearch onSelectDistrict={onSelectDistrict} />
      </div>
    </header>
  );
}
