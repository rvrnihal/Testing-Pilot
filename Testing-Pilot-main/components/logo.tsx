import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

type LogoProps = {
  compact?: boolean;
  className?: string;
  href?: Route;
};

export function Logo({ compact = false, className, href = "/" }: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-3", className)}>
      <Image
        src="/qa-copilot-app-icon.jpg"
        alt="QA Copilot logo"
        width={compact ? 40 : 52}
        height={compact ? 40 : 52}
        className={cn(
          "h-auto w-auto rounded-2xl object-cover shadow-lg shadow-slate-950/25",
          compact ? "max-h-10 max-w-10" : "max-h-13 max-w-13",
        )}
        priority
      />
      {compact ? null : (
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">QA Copilot</p>
          <p className="text-sm text-slate-300">AI Co-Pilot for Test Engineers</p>
        </div>
      )}
    </div>
  );

  return <Link href={href}>{content}</Link>;
}
