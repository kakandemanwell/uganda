"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration mismatch: the server can't know the user's stored
  // theme preference, so render a stable placeholder until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Tooltip>
      {/* Base UI composition uses `render`, not Radix's `asChild` — passing
          the Button element here merges Tooltip's trigger behavior onto it
          without either component rendering its own extra <button>. */}
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="size-8"
          >
            {mounted ? (
              isDark ? <Sun className="size-4" /> : <Moon className="size-4" />
            ) : (
              <Sun className="size-4 opacity-0" />
            )}
          </Button>
        }
      />
      <TooltipContent>{isDark ? "Switch to light mode" : "Switch to dark mode"}</TooltipContent>
    </Tooltip>
  );
}
