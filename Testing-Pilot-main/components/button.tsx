"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-[1px]",
        variant === "primary" &&
          "border-teal-700 bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)] text-[var(--accent-foreground)] shadow-[var(--shadow-button)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-teal-800 hover:shadow-[var(--shadow-button-hover)]",
        variant === "secondary" &&
          "border-slate-300 bg-white text-[var(--foreground)] shadow-sm hover:-translate-y-0.5 hover:border-slate-400 hover:bg-[var(--surface-muted)] hover:shadow-[var(--shadow-soft)]",
        variant === "ghost" && "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
        variant === "danger" &&
          "border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-[var(--shadow-soft)]",
        className,
      )}
      {...props}
    />
  );
}
