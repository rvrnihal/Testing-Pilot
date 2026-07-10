"use client";

import dynamic from "next/dynamic";

const AdminConsole = dynamic(
  () => import("../../components/admin-console").then((module) => module.AdminConsole),
  {
    loading: () => (
      <main className="space-y-8 pb-12">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="h-32 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
          <div className="h-32 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
          <div className="h-32 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
          <div className="h-32 animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
        </section>
        <div className="h-[520px] animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
      </main>
    ),
  },
);

export default function AdminPage() {
  return <AdminConsole />;
}
