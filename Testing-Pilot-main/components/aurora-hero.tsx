"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Circle, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/button";

const heroSignals = [
  { label: "Coverage", value: "92%" },
  { label: "Risk", value: "Low" },
  { label: "Release", value: "Ready" },
];

const priorityRows = [
  {
    title: "Checkout regression",
    meta: "18 cases - Payments",
    status: "Ready",
  },
  {
    title: "Authentication flow",
    meta: "14 cases - Identity",
    status: "Review",
  },
  {
    title: "Plan selection",
    meta: "11 cases - Acquisition",
    status: "Running",
  },
];

const workflowNotes = [
  "Requirements converted into structured cases",
  "Regression scope grouped by product risk",
  "Release review prepared for engineering and QA leads",
];

export function AuroraHero() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-14 pt-4 text-[var(--foreground)] sm:px-6 lg:px-8">
      <div className="grid items-center gap-10 lg:grid-cols-[0.88fr_1.12fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dbe4ff] bg-white/88 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Shipping clarity for modern QA
              </div>

              <div className="space-y-5">
                <h1 className="max-w-2xl text-[3rem] font-semibold leading-[0.9] tracking-[-0.075em] text-slate-950 sm:text-[4.8rem]">
                  Quality operations,
                  <span className="block bg-gradient-to-r from-slate-950 via-indigo-700 to-cyan-600 bg-clip-text text-transparent">
                    refined into one system.
                  </span>
                </h1>
                <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                  QA Copilot turns requirements, bugs, and release context into
                  structured workflows, automation-ready outputs, and cleaner
                  release decisions for the whole team.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href="/register">
                  <Button className="min-w-[220px] rounded-full border-transparent bg-[linear-gradient(135deg,#111827_0%,#3730a3_55%,#0ea5e9_100%)] px-6 py-3.5 shadow-[0_18px_36px_rgba(79,70,229,0.28)] hover:shadow-[0_24px_44px_rgba(79,70,229,0.34)]">
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="secondary"
                    className="min-w-[170px] rounded-full border-[#dbe4ff] bg-white/90 px-6 py-3.5 text-slate-700 shadow-none"
                  >
                    Login
                  </Button>
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-[22px] border border-[#dbe4ff] bg-white/76 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                      {signal.value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="overflow-hidden rounded-[32px] border border-[#dbe4ff] bg-[#f8fbff]/92 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <div className="rounded-[26px] border border-[#dbe4ff] bg-white">
                  <div className="flex items-center justify-between border-b border-[#e7ecff] px-5 py-3.5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Release Workspace
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                        Signal first. Noise removed.
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-3 py-1.5 text-xs font-semibold text-slate-600">
                      <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                      Synced
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex items-center gap-2 rounded-2xl border border-[#e7ecff] bg-[#fbfdff] px-3 py-2.5 text-sm text-slate-400">
                      <Search className="h-4 w-4" />
                      Search release workspace
                    </div>

                    <div className="rounded-[24px] border border-[#e7ecff] bg-[linear-gradient(180deg,#111827_0%,#1e1b4b_100%)] p-5 text-white shadow-[0_18px_36px_rgba(17,24,39,0.20)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200/80">
                            Overview
                          </p>
                          <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                            Release confidence at a glance
                          </p>
                        </div>
                        <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                          Live
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {heroSignals.map((signal) => (
                          <div
                            key={signal.label}
                            className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-4"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100/70">
                              {signal.label}
                            </p>
                            <p className="mt-2 text-2xl font-semibold">{signal.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 space-y-3">
                        {workflowNotes.map((item) => (
                          <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-300" />
                            <p className="text-sm text-indigo-50/90">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#e7ecff] bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7ff_100%)] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Top priorities
                        </p>
                        <p className="text-xs font-medium text-slate-400">Today</p>
                      </div>

                      <div className="mt-4 space-y-3">
                        {priorityRows.map((row) => (
                          <div
                            key={row.title}
                            className="grid grid-cols-[1.25fr_0.7fr] items-center gap-3 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{row.title}</p>
                              <p className="text-xs text-slate-500">{row.meta}</p>
                            </div>
                            <div className="ml-auto">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  row.status === "Ready"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : row.status === "Review"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-indigo-50 text-indigo-700"
                                }`}
                              >
                                {row.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
      </div>
    </section>
  );
}
