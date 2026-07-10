"use client";

import { Button } from "@/components/button";

type Plan = {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  creditsPerMonth: number;
};

export function BillingCard({ plan }: { plan: Plan }) {
  return (
    <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[var(--foreground)]">{plan.name}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{plan.creditsPerMonth} credits / month</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-[var(--foreground)]">${plan.priceMonthly}/mo</p>
          <Button
            className="mt-3"
            onClick={async () => {
              const response = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ planSlug: plan.slug }),
              });
              const data = await response.json();
              if (data.url) {
                window.location.href = data.url;
                return;
              }
              window.location.reload();
            }}
          >
            Choose plan
          </Button>
        </div>
      </div>
    </div>
  );
}
