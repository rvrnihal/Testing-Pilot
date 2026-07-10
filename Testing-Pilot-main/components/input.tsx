import * as React from "react";
import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const normalizedProps =
    props.type !== "file" && "value" in props
      ? { ...props, value: props.value ?? "" }
      : props;

  return (
    <input
      {...normalizedProps}
      className={cn(
        "w-full rounded-xl border border-[var(--surface-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--muted-foreground)] shadow-sm transition duration-200 ease-out hover:border-teal-300 focus:border-[var(--accent)] focus:shadow-[var(--focus-ring)]",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const hasExplicitValue = Object.prototype.hasOwnProperty.call(props, "value");
  const normalizedProps =
    hasExplicitValue && props.value == null
      ? { ...props, value: "" }
      : props;

  return (
    <textarea
      {...normalizedProps}
      className={cn(
        "min-h-36 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] shadow-sm transition duration-200 ease-out hover:border-teal-300 focus:border-[var(--accent)] focus:shadow-[var(--focus-ring)]",
        props.className,
      )}
    />
  );
}
