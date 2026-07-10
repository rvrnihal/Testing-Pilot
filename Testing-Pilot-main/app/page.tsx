import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AuroraHero } from "../components/aurora-hero";
import { Button } from "../components/button";
import { Reveal } from "../components/reveal";

const trustIndicators = [
  "Trusted by quality-focused SaaS teams",
  "Structured outputs instead of raw AI text",
  "Release-ready governance built in",
  "Designed for teams shipping weekly",
];

const featureList = [
  {
    title: "Requirement intelligence",
    text: "Convert specs, tickets, and release notes into structured coverage without losing product context.",
    icon: Sparkles,
  },
  {
    title: "Automation acceleration",
    text: "Move from planning into Playwright, API, and regression-ready outputs with much less friction.",
    icon: ClipboardCheck,
  },
  {
    title: "Release readiness",
    text: "Bring blockers, coverage, and quality signals into one operating view that leaders can trust.",
    icon: Gauge,
  },
  {
    title: "Governed collaboration",
    text: "Keep approvals, usage controls, and team operations aligned as the workspace scales.",
    icon: ShieldCheck,
  },
];

const operatingModel = [
  {
    id: "01",
    title: "Ingest the real signal",
    text: "Requirements, defects, and release changes are brought into one place instead of being scattered across docs and chats.",
  },
  {
    id: "02",
    title: "Generate structured QA outputs",
    text: "The system produces reusable assets that stay aligned to product scope, not loose generic text.",
  },
  {
    id: "03",
    title: "Review the release with confidence",
    text: "Leads and stakeholders get a much cleaner picture of readiness before decisions are made.",
  },
];

const testimonials = [
  {
    quote:
      "The biggest win was not just speed. It was how much cleaner the entire release conversation became across QA and engineering.",
    author: "Riya Malhotra",
    role: "QA Lead, Fintech Platform",
  },
  {
    quote:
      "QA Copilot gave us better structure, better visibility, and much less operational noise around core quality workflows.",
    author: "Daniel Brooks",
    role: "Head of Quality, B2B SaaS",
  },
];

const metrics = [
  { label: "Planning speed", value: "3x" },
  { label: "Core QA workflows", value: "8+" },
  { label: "Shared release surface", value: "1" },
];

const plans = [
  {
    name: "Starter",
    price: "$29",
    description: "For individual QA engineers who want stronger structure and faster coverage creation.",
    bullets: ["250 credits", "Core QA workflows", "Structured test outputs"],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$79",
    description: "For teams who want better consistency, clearer operations, and stronger release confidence.",
    bullets: ["1000 credits", "Automation and API coverage", "Team-ready workflow standardization"],
    highlighted: true,
  },
  {
    name: "Scale",
    price: "$199",
    description: "For organizations coordinating quality operations across projects, teams, and approvals.",
    bullets: ["4000 credits", "Admin controls", "Multi-project governance"],
    highlighted: false,
  },
];

export default function HomePage() {
  return (
    <>
      <AuroraHero />

      <main className="mx-auto max-w-[1120px] space-y-28 pb-24 pt-6">
        <Reveal>
          <section className="overflow-hidden rounded-[30px] border border-[#dbe4ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,250,255,0.94))] px-6 py-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm font-medium text-slate-500">
              {trustIndicators.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section id="features" className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="space-y-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-slate-500">
                Platform
              </p>
              <h2 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-[3.35rem]">
                Built like premium infrastructure for QA teams.
              </h2>
              <p className="max-w-lg text-base leading-8 text-slate-600">
                The product is designed to feel precise and operationally calm, with stronger hierarchy, clearer outputs, and less visual noise.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {featureList.map((feature, index) => (
                <div
                  key={feature.title}
                  className="group rounded-[28px] border border-[#dbe4ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,255,0.96))] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_rgba(15,23,42,0.10)]"
                  style={{ transitionDelay: `${index * 40}ms` }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#111827_0%,#312e81_100%)] text-white transition duration-500 group-hover:scale-105">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{feature.text}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delay={120}>
          <section className="overflow-hidden rounded-[34px] border border-[#dbe4ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(244,248,255,0.96))] p-6 shadow-[0_26px_80px_rgba(15,23,42,0.09)] backdrop-blur-xl sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
              <div className="space-y-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-slate-500">
                  Operating Model
                </p>
                <h2 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-[3rem]">
                  The release workflow, reorganized around signal instead of noise.
                </h2>
                <p className="max-w-lg text-base leading-8 text-slate-600">
                  QA Copilot gives teams a cleaner path from intake to release review, with the kind of product clarity premium SaaS should provide.
                </p>
              </div>

              <div className="space-y-4">
                {operatingModel.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[26px] border border-[#dbe4ff] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition duration-500 hover:-translate-y-1"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                        {item.id}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={160}>
          <section className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div className="space-y-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-slate-500">
                Outcomes
              </p>
              <h2 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-[3rem]">
                Clearer workflows create better release conversations.
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="space-y-2">
                    <p className="text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                      {metric.value}
                    </p>
                    <p className="text-sm text-slate-500">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              {testimonials.map((item, index) => (
                <div
                  key={item.author}
                  className="rounded-[28px] border border-[#dbe4ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,250,255,0.96))] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition duration-500 hover:-translate-y-1"
                  style={{ transitionDelay: `${index * 60}ms` }}
                >
                  <p className="text-lg leading-8 text-slate-800">"{item.quote}"</p>
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-950">{item.author}</p>
                    <p className="text-sm text-slate-500">{item.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delay={220}>
          <section id="pricing" className="space-y-8">
            <div className="space-y-4 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-slate-500">
                Pricing
              </p>
              <h2 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-[3rem]">
                Plans designed for structured quality work.
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {plans.map((plan, index) => (
                <div
                  key={plan.name}
                  className={`rounded-[30px] border p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition duration-500 hover:-translate-y-1.5 ${
                    plan.highlighted
                      ? "border-[#1e1b4b] bg-[linear-gradient(180deg,#111827_0%,#1e1b4b_100%)] text-white"
                      : "border-[#dbe4ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,250,255,0.96))] text-slate-950"
                  }`}
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <p
                        className={`text-[11px] font-medium uppercase tracking-[0.24em] ${
                          plan.highlighted ? "text-indigo-200/70" : "text-slate-500"
                        }`}
                      >
                        {plan.name}
                      </p>
                      {plan.highlighted ? (
                        <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium text-white">
                          Most popular
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-semibold tracking-[-0.05em]">
                        {plan.price}
                      </span>
                      <span
                        className={`pb-2 text-sm ${
                          plan.highlighted ? "text-indigo-200/70" : "text-slate-500"
                        }`}
                      >
                        / month
                      </span>
                    </div>

                    <p
                      className={`text-sm leading-7 ${
                        plan.highlighted ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {plan.description}
                    </p>

                    <div className="space-y-3 pt-2">
                      {plan.bullets.map((item) => (
                        <div key={item} className="flex items-center gap-3 text-sm">
                          <CheckCircle2
                            className={`h-4 w-4 ${
                              plan.highlighted ? "text-cyan-400" : "text-indigo-600"
                            }`}
                          />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link href="/register" className="mt-8 block">
                    <Button
                      variant={plan.highlighted ? "secondary" : "primary"}
                      className={`w-full ${
                        plan.highlighted
                          ? "border-white/10 bg-white text-slate-950 hover:bg-slate-100"
                          : "border-transparent bg-[linear-gradient(135deg,#111827_0%,#3730a3_55%,#0ea5e9_100%)]"
                      }`}
                    >
                      Choose {plan.name}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal delay={260}>
          <section className="rounded-[36px] border border-[#dbe4ff] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,249,255,0.98))] px-8 py-14 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-slate-500">
              Ready to upgrade QA operations?
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-[3rem]">
              Give your team a sharper path from quality signals to confident releases.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/register">
                <Button className="min-w-[230px] border-transparent bg-[linear-gradient(135deg,#111827_0%,#3730a3_55%,#0ea5e9_100%)]">
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        </Reveal>
      </main>
    </>
  );
}
