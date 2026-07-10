"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "theme";

function applyTheme(nextTheme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(nextTheme);
  root.style.colorScheme = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const initialTheme = root.classList.contains("light") ? "light" : "dark";
    setTheme(initialTheme);
    setMounted(true);
  }, []);

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  if (!mounted) {
    return <div className="h-11 w-28 rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)]" />;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto relative rounded-full border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-soft)] backdrop-blur">
        <div
          className={cn(
            "pointer-events-none absolute top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-full bg-[var(--toggle-thumb)] shadow-[var(--shadow-button)] transition duration-300",
            theme === "dark" ? "left-1.5" : "left-[calc(50%+0px)]",
          )}
        />
        <div className="relative grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => updateTheme("dark")}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-full transition duration-200",
              theme === "dark" ? "text-slate-950" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
            aria-label="Switch to dark mode"
            aria-pressed={theme === "dark"}
          >
            <Moon className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => updateTheme("light")}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-full transition duration-200",
              theme === "light" ? "text-slate-950" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
            aria-label="Switch to light mode"
            aria-pressed={theme === "light"}
          >
            <Sun className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
