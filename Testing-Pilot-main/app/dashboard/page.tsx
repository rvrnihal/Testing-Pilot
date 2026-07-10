"use client";

import dynamic from "next/dynamic";

const UserConsole = dynamic(
  () => import("../../components/user-console").then((module) => module.UserConsole),
  {
    loading: () => (
      <main className="pb-14">
        <div className="grid gap-8 xl:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="h-20 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
            <div className="h-[420px] animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
          </aside>
          <section className="space-y-8">
            <div className="h-32 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-36 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
              <div className="h-36 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
              <div className="h-36 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
            </div>
          </section>
        </div>
      </main>
    ),
  },
);

export default function DashboardPage() {
  return <UserConsole />;
}
