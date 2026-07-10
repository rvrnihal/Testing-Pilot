import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  TERMINATED: "border-rose-200 bg-rose-50 text-rose-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  trialing: "border-sky-200 bg-sky-50 text-sky-700",
  pending_approval: "border-amber-200 bg-amber-50 text-amber-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  terminated: "border-rose-200 bg-rose-50 text-rose-700",
};

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        styles[status] || "border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--foreground)]",
      )}
    >
      {status.toString().replaceAll("_", " ")}
    </span>
  );
}
