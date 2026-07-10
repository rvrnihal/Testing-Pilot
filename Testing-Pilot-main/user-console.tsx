"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, WandSparkles } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";
import { Input, Textarea } from "./input";
import { Logo } from "./logo";
import { apiDownload, apiRequest } from "../lib/client-api";

type OverviewPayload = {
  user: {
    id: string;
    name: string;
    role: string;
    creditsBalance: number;
    subscription: {
      status: string;
      plan: {
        name: string;
        priceMonthly: number;
        creditsPerMonth: number;
      };
    } | null;
  };
  usageSummary: {
    creditsUsed: number;
    actionsCount: number;
  };
  recentActivity: Array<{ id: string; action: string; creditsUsed: number; createdAt: string }>;
  projects: Array<{
    id: string;
    name: string;
    description?: string;
    artifacts?: Array<{ id: string; title: string; type: string }>;
  }>;
  creditCatalog: Record<string, number>;
  modules: string[];
};

type SectionId =
  | "overview"
  | "test-cases"
  | "automation"
  | "bug"
  | "release-risk"
  | "test-data"
  | "test-report"
  | "api-tests"
  | "content-match"
  | "design-match"
  | "bulk-url-qa";

type NavItem = {
  id: SectionId;
  label: string;
  title: string;
  desc: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type ReportContext = {
  pageUrl?: string;
  sourceName?: string;
  referenceType?: string;
};

const navGroups: NavGroup[] = [
  {
    title: "Core flows",
    items: [
      { id: "overview", label: "Overview", title: "QA Command Center", desc: "Track usage, activity, and workspace momentum." },
      { id: "test-cases", label: "Test Design", title: "Generate Test Cases from Requirements", desc: "Turn requirements into structured QA coverage and export-ready outputs." },
      { id: "automation", label: "Automation", title: "Generate Automation Scripts", desc: "Convert validated flows into framework-ready automation starters." },
      { id: "bug", label: "Bug Analysis", title: "Analyze Defects and Root Causes", desc: "Explain likely causes, impact, and recommended next steps." },
      { id: "release-risk", label: "Release Risk", title: "Assess Release Risk", desc: "Summarize release confidence using defects, gaps, and quality signals." },
    ],
  },
  {
    title: "Assets",
    items: [
      { id: "test-data", label: "Test Data", title: "Generate Test Data", desc: "Create realistic sample data for positive, negative, and edge-case validation." },
      { id: "test-report", label: "Reports", title: "Generate Test Reports", desc: "Turn raw execution notes into concise stakeholder-ready summaries." },
      { id: "api-tests", label: "API Testing", title: "Generate API Tests", desc: "Transform API specs into practical request and validation coverage." },
    ],
  },
  {
    title: "Website QA",
    items: [
      { id: "content-match", label: "Content Match", title: "Compare Live Content Against Source", desc: "Detect drift, SEO mismatches, and missing sections." },
      { id: "design-match", label: "Design Match", title: "Compare Live Experience Against Design", desc: "Audit responsive drift, screenshot gaps, and design fidelity." },
      { id: "bulk-url-qa", label: "Bulk URL QA", title: "Run Bulk URL QA", desc: "Scan multiple pages for release regressions and workflow breakage." },
    ],
  },
];

function exportJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatReportValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : item && typeof item === "object"
            ? Object.entries(item as Record<string, unknown>)
                .map(([key, entry]) => `${key}: ${typeof entry === "string" || typeof entry === "number" ? String(entry) : JSON.stringify(entry)}`)
                .join(" | ")
            : "",
      )
      .filter(Boolean)
      .join("; ");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${typeof entry === "string" || typeof entry === "number" ? String(entry) : JSON.stringify(entry)}`)
      .join("; ");
  }

  return "";
}

function buildWebsiteQaReportLines(result: Record<string, unknown>, label: string) {
  const lines: string[] = [];
  const score = typeof result.qaScore === "number" ? `${result.qaScore}%` : "";
  const summary = typeof result.summary === "string" ? result.summary : "";
  const comparisonConfidence = typeof result.comparisonConfidence === "string" ? result.comparisonConfidence : "";
  const comparisonStatus = typeof result.comparisonStatus === "string" ? result.comparisonStatus : "";
  const relevanceAnalysis = result.relevanceAnalysis && typeof result.relevanceAnalysis === "object"
    ? (result.relevanceAnalysis as Record<string, unknown>)
    : null;

  lines.push(`QA Copilot ${label} Report`);
  lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
  lines.push("");

  if (score) lines.push(`Overall Score: ${score}`);
  if (comparisonConfidence) lines.push(`Comparison Confidence: ${comparisonConfidence}`);
  if (comparisonStatus) lines.push(`Comparison Status: ${comparisonStatus}`);
  if (summary) {
    lines.push("");
    lines.push("Executive Summary");
    lines.push(summary);
  }

  if (relevanceAnalysis) {
    lines.push("");
    lines.push("Relevance Analysis");
    Object.entries(relevanceAnalysis).forEach(([key, value]) => {
      const formatted = formatReportValue(value);
      if (formatted) lines.push(`${key}: ${formatted}`);
    });
  }

  const sections: Array<[string, unknown]> = [
    ["Missing Content", result.missingContent],
    ["Content Drift", result.contentDrift],
    ["SEO Mismatches", result.seoMismatches],
    ["Formatting Inconsistencies", result.formattingInconsistencies],
    ["Heading Comparisons", result.headingComparisons],
    ["Section Comparisons", result.sectionComparisons],
    ["Issue Heatmap", result.issueHeatmap],
    ["Auto Bug Reports", result.autoBugReports],
    ["Recommended Next Steps", result.generatedTickets || result.autoBugReports],
  ];

  for (const [title, value] of sections) {
    const formatted = formatReportValue(value);
    if (!formatted) continue;
    lines.push("");
    lines.push(title);
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemText = formatReportValue(item);
        if (itemText) lines.push(`${index + 1}. ${itemText}`);
      });
    } else {
      lines.push(formatted);
    }
  }

  lines.push("");
  lines.push("Raw JSON");
  lines.push(JSON.stringify(result, null, 2));

  return lines;
}

function buildReleaseRiskReportLines(result: Record<string, unknown>) {
  const lines: string[] = [];
  const readinessScore = typeof result.readinessScore === "number" ? `${result.readinessScore}%` : "";
  const riskLevel = typeof result.riskLevel === "string" ? result.riskLevel : "";
  const goNoGoRecommendation = typeof result.goNoGoRecommendation === "string" ? result.goNoGoRecommendation : "";
  const summary = typeof result.summary === "string" ? result.summary : "";
  const releaseRecommendation = typeof result.releaseRecommendation === "string" ? result.releaseRecommendation : "";
  const blockers = toTextList(result.blockers);
  const decisionDrivers = toTextList(result.releaseDecisionDrivers);
  const residualRisks = toTextList(result.residualRisks);
  const rollbackTriggers = toTextList(result.rollbackTriggers);
  const deploymentGuards = toTextList(result.deploymentGuards);
  const signoffOwners = toTextList(result.signoffOwners);
  const monitoringPlan = toTextList(result.monitoringPlan);
  const communicationPlan = toTextList(result.communicationPlan);
  const stakeholderActions = toTextList(result.stakeholderActions);
  const mitigationPlan = toTextList(result.mitigationPlan);
  const entryCriteria = toTextList(result.entryCriteria);
  const exitCriteria = toTextList(result.exitCriteria);
  const evidenceRequired = toTextList(result.evidenceRequired);
  const coverageGaps = toTextList(result.coverageGaps);
  const highRiskModules = toTextList(result.highRiskModules);

  lines.push("QA Copilot");
  lines.push("AI Co-Pilot for Test Engineers");
  lines.push("Boardroom Release Readiness Report");
  lines.push("Executive Risk Assessment & Deployment Strategy");
  lines.push("Prepared by: QA Copilot");
  lines.push("Prepared for: Executive Leadership, QA Leaders, and Release Governance");
  lines.push(`Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`);
  lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
  lines.push("");

  lines.push("Executive KPI Dashboard");
  if (readinessScore) lines.push(`Readiness Score | ${readinessScore} | Target: 85%+`);
  if (riskLevel) lines.push(`Risk Level | ${riskLevel} | Target: Low to Moderate`);
  if (goNoGoRecommendation) lines.push(`Release Decision | ${goNoGoRecommendation} | Target: Go or Conditional Go`);
  lines.push(`Blocker Count | ${blockers.length} | Target: 0 Critical blockers`);
  lines.push(`Residual Risk Themes | ${residualRisks.length} | Target: 0 unmanaged risks`);
  lines.push(`Coverage Gaps | ${coverageGaps.length} | Target: 0 major gaps`);

  if (summary) {
    lines.push("");
    lines.push("Executive Summary");
    lines.push(summary);
  }

  if (highRiskModules.length) {
    lines.push("");
    lines.push("Risk Matrix");
    highRiskModules.forEach((module, index) => {
      lines.push(`${index + 1}. ${module}`);
    });
  }

  if (blockers.length) {
    lines.push("");
    lines.push("Critical Blockers");
    blockers.forEach((blocker, index) => {
      lines.push(`${index + 1}. ${blocker}`);
    });
  }

  if (decisionDrivers.length) {
    lines.push("");
    lines.push("Release Decision Drivers");
    decisionDrivers.forEach((driver, index) => {
      lines.push(`${index + 1}. ${driver}`);
    });
  }

  if (mitigationPlan.length || deploymentGuards.length) {
    lines.push("");
    lines.push("Deployment Strategy");
    mitigationPlan.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
    deploymentGuards.forEach((item, index) => {
      lines.push(`${mitigationPlan.length + index + 1}. ${item}`);
    });
  }

  if (monitoringPlan.length) {
    lines.push("");
    lines.push("Monitoring & Observability");
    monitoringPlan.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }

  if (rollbackTriggers.length) {
    lines.push("");
    lines.push("Rollback Triggers");
    rollbackTriggers.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }

  const sections: Array<[string, string[]]> = [
    ["Residual Risks", residualRisks],
    ["Stakeholder Actions", stakeholderActions],
    ["Communication Plan", communicationPlan],
    ["Sign-Off Owners", signoffOwners],
    ["Entry Criteria", entryCriteria],
    ["Exit Criteria", exitCriteria],
    ["Evidence Required", evidenceRequired],
    ["Coverage Gaps", coverageGaps],
    ["Recommended Next Steps", [
      typeof result.recommendation === "string" ? result.recommendation : "",
      releaseRecommendation,
    ].filter(Boolean)],
  ];

  for (const [title, value] of sections) {
    if (!value.length) continue;
    lines.push("");
    lines.push(title);
    value.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }

  if (goNoGoRecommendation || releaseRecommendation) {
    lines.push("");
    lines.push("Final Recommendation");
    if (goNoGoRecommendation) lines.push(`Board Decision: ${goNoGoRecommendation}`);
    if (releaseRecommendation) lines.push(releaseRecommendation);
  }

  lines.push("");
  lines.push("Raw JSON");
  lines.push(JSON.stringify(result, null, 2));

  return lines;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfText(text: string, maxCharsPerLine: number) {
  if (!text) return [""];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      return;
    }

    if (current) lines.push(current);
    if (word.length <= maxCharsPerLine) {
      current = word;
      return;
    }

    let remaining = word;
    while (remaining.length > maxCharsPerLine) {
      lines.push(remaining.slice(0, maxCharsPerLine - 1));
      remaining = remaining.slice(maxCharsPerLine - 1);
    }
    current = remaining;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdfBlobFromLines(lines: string[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 48;
  const marginTop = 60;
  const lineHeight = 16;
  const maxCharsPerLine = 92;
  const maxLinesPerPage = 44;

  const wrappedLines = lines.flatMap((line) => {
    if (!line) return [""];
    const chunks: string[] = [];
    let remaining = line;
    while (remaining.length > maxCharsPerLine) {
      let splitAt = remaining.lastIndexOf(" ", maxCharsPerLine);
      if (splitAt < 20) splitAt = maxCharsPerLine;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    chunks.push(remaining);
    return chunks;
  });

  const pages: string[][] = [];
  for (let index = 0; index < wrappedLines.length; index += maxLinesPerPage) {
    pages.push(wrappedLines.slice(index, index + maxLinesPerPage));
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextObjectId = 3;

  for (const pageLines of pages) {
    pageObjectIds.push(nextObjectId++);
    contentObjectIds.push(nextObjectId++);

    let y = pageHeight - marginTop;
    const textCommands = ["BT", "/F1 11 Tf", `1 0 0 1 ${marginLeft} ${y} Tm`];

    pageLines.forEach((line, index) => {
      if (index === 0) {
        textCommands.push(`(${escapePdfText(line)}) Tj`);
      } else {
        textCommands.push(`0 -${lineHeight} Td`);
        textCommands.push(`(${escapePdfText(line)}) Tj`);
      }
    });

    textCommands.push("ET");
    const stream = textCommands.join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }

  const pagesKids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  const pdfObjects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pagesKids}] /Count ${pageObjectIds.length} >>`,
  ];

  for (let index = 0; index < pageObjectIds.length; index += 1) {
    pdfObjects[pageObjectIds[index] - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${nextObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`;
    pdfObjects[contentObjectIds[index] - 1] = objects[index];
  }

  pdfObjects[nextObjectId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  pdfObjects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${pdfObjects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function exportWebsiteQaPdf(result: Record<string, unknown>, label: string) {
  const lines = buildWebsiteQaReportLines(result, label);
  const blob = buildPdfBlobFromLines(lines);
  const sanitized = label.toLowerCase().replace(/\s+/g, "-");
  downloadBlob(blob, `qa-copilot-${sanitized}-report.pdf`);
}

function buildReleaseRiskPdfBlob(result: Record<string, unknown>) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;
  const headerHeight = 58;
  const footerHeight = 28;
  const topStart = pageHeight - headerHeight - 18;
  const brandDark = "0.07 0.11 0.20";
  const brandTeal = "0.16 0.77 0.72";
  const brandSlate = "0.20 0.24 0.34";
  const textDark = "0.12 0.14 0.18";
  const textMuted = "0.36 0.40 0.47";
  const white = "1 1 1";
  const lineGap = 14;
  const boxPadding = 12;

  const readinessScore = typeof result.readinessScore === "number" ? `${result.readinessScore}%` : "N/A";
  const riskLevel = typeof result.riskLevel === "string" ? result.riskLevel : "Not Assessed";
  const goNoGoRecommendation = typeof result.goNoGoRecommendation === "string" ? result.goNoGoRecommendation : "Pending";
  const summary = typeof result.summary === "string" ? result.summary : "Release risk summary is not available.";
  const releaseRecommendation = typeof result.releaseRecommendation === "string" ? result.releaseRecommendation : "";

  const sectionData: Array<{ title: string; items: string[] }> = [
    {
      title: "Executive KPI Dashboard",
      items: [
        `Readiness Score | ${readinessScore} | Target: 85%+`,
        `Risk Level | ${riskLevel} | Target: Low to Moderate`,
        `Release Decision | ${goNoGoRecommendation} | Target: Go or Conditional Go`,
        `Coverage Gaps | ${toTextList(result.coverageGaps).length} | Target: 0 major gaps`,
      ],
    },
    { title: "Executive Summary", items: [summary] },
    { title: "Risk Matrix", items: toTextList(result.highRiskModules) },
    { title: "Critical Blockers", items: toTextList(result.blockers) },
    { title: "Release Decision Drivers", items: toTextList(result.releaseDecisionDrivers) },
    { title: "Deployment Strategy", items: [...toTextList(result.mitigationPlan), ...toTextList(result.deploymentGuards)] },
    { title: "Monitoring & Observability", items: toTextList(result.monitoringPlan) },
    { title: "Rollback Triggers", items: toTextList(result.rollbackTriggers) },
    { title: "Residual Risks", items: toTextList(result.residualRisks) },
    { title: "Stakeholder Actions", items: toTextList(result.stakeholderActions) },
    { title: "Communication Plan", items: toTextList(result.communicationPlan) },
    { title: "Sign-Off Owners", items: toTextList(result.signoffOwners) },
    { title: "Entry Criteria", items: toTextList(result.entryCriteria) },
    { title: "Exit Criteria", items: toTextList(result.exitCriteria) },
    { title: "Evidence Required", items: toTextList(result.evidenceRequired) },
    { title: "Coverage Gaps", items: toTextList(result.coverageGaps) },
    { title: "Final Recommendation", items: [goNoGoRecommendation, releaseRecommendation].filter(Boolean) },
  ].filter((section) => section.items.length);

  function estimateSectionHeight(section: { title: string; items: string[] }) {
    let height = 34;
    section.items.forEach((item) => {
      const lines = wrapPdfText(item, 88);
      height += Math.max(1, lines.length) * lineGap + 6;
    });
    return height + boxPadding * 2;
  }

  const pageCommands: string[] = [];
  let currentCommands: string[] = [];
  let cursorY = topStart;

  const drawHeader = (commands: string[], isFirstPage: boolean) => {
    commands.push(`q ${brandDark} rg 0 ${pageHeight - headerHeight} ${pageWidth} ${headerHeight} re f Q`);
    commands.push(`q ${brandTeal} rg 0 ${pageHeight - headerHeight} ${pageWidth} 4 re f Q`);
    commands.push(`BT /F2 13 Tf ${white} rg 42 ${pageHeight - 30} Td (${escapePdfText("QA Copilot")}) Tj ET`);
    commands.push(`BT /F1 10 Tf 0.82 0.90 0.96 rg 42 ${pageHeight - 44} Td (${escapePdfText("AI Co-Pilot for Test Engineers")}) Tj ET`);
    commands.push(`BT /F1 9 Tf 0.70 0.77 0.86 rg ${pageWidth - 170} ${pageHeight - 35} Td (${escapePdfText("Boardroom Release Readiness Report")}) Tj ET`);

    if (isFirstPage) {
      commands.push(`q 0.95 0.98 1 rg ${marginX} ${pageHeight - 210} ${contentWidth} 116 re f Q`);
      commands.push(`q ${brandTeal} rg ${marginX} ${pageHeight - 210} 8 116 re f Q`);
      commands.push(`BT /F2 24 Tf ${textDark} rg ${marginX + 20} ${pageHeight - 118} Td (${escapePdfText("Executive Risk Assessment & Deployment Strategy")}) Tj ET`);
      commands.push(`BT /F1 12 Tf ${textMuted} rg ${marginX + 20} ${pageHeight - 142} Td (${escapePdfText("Prepared by QA Copilot for executive leadership, QA leaders, and release governance")}) Tj ET`);
      commands.push(`BT /F1 11 Tf ${textMuted} rg ${marginX + 20} ${pageHeight - 164} Td (${escapePdfText(`Generated ${new Date().toLocaleString("en-IN")}`)}) Tj ET`);
      commands.push(`BT /F2 12 Tf ${brandDark} rg ${pageWidth - 190} ${pageHeight - 118} Td (${escapePdfText(`Decision: ${goNoGoRecommendation}`)}) Tj ET`);
      commands.push(`BT /F1 11 Tf ${textMuted} rg ${pageWidth - 190} ${pageHeight - 140} Td (${escapePdfText(`Risk Level: ${riskLevel}`)}) Tj ET`);
      commands.push(`BT /F1 11 Tf ${textMuted} rg ${pageWidth - 190} ${pageHeight - 162} Td (${escapePdfText(`Readiness Score: ${readinessScore}`)}) Tj ET`);
      cursorY = pageHeight - 236;
      return;
    }

    cursorY = topStart;
  };

  const drawFooter = (commands: string[], currentPage: number, totalPages: number) => {
    commands.push(`q 0.90 0.94 0.98 rg 0 0 ${pageWidth} ${footerHeight} re f Q`);
    commands.push(`BT /F1 9 Tf ${textMuted} rg ${marginX} 11 Td (${escapePdfText("QA Copilot Confidential - Executive Release Governance Pack")}) Tj ET`);
    commands.push(`BT /F1 9 Tf ${textMuted} rg ${pageWidth - 90} 11 Td (${escapePdfText(`Page ${currentPage} of ${totalPages}`)}) Tj ET`);
  };

  const startPage = (isFirstPage: boolean) => {
    currentCommands = [];
    drawHeader(currentCommands, isFirstPage);
  };

  const flushPage = () => {
    pageCommands.push(currentCommands.join("\n"));
  };

  const drawSection = (section: { title: string; items: string[] }) => {
    const height = estimateSectionHeight(section);
    if (cursorY - height < footerHeight + 26) {
      flushPage();
      startPage(false);
    }

    const sectionBottom = cursorY - height;
    currentCommands.push(`q 0.98 0.99 1 rg ${marginX} ${sectionBottom} ${contentWidth} ${height} re f Q`);
    currentCommands.push(`q 0.87 0.91 0.96 RG 1 w ${marginX} ${sectionBottom} ${contentWidth} ${height} re S Q`);
    currentCommands.push(`q ${brandSlate} rg ${marginX} ${cursorY - 30} ${contentWidth} 30 re f Q`);
    currentCommands.push(`BT /F2 12 Tf ${white} rg ${marginX + boxPadding} ${cursorY - 20} Td (${escapePdfText(section.title)}) Tj ET`);

    let textY = cursorY - 46;
    section.items.forEach((item, index) => {
      const wrapped = wrapPdfText(item, 88);
      wrapped.forEach((line, lineIndex) => {
        const prefix = lineIndex === 0 ? `${index + 1}. ` : "   ";
        currentCommands.push(`BT /F1 10 Tf ${textDark} rg ${marginX + boxPadding} ${textY} Td (${escapePdfText(`${prefix}${line}`)}) Tj ET`);
        textY -= lineGap;
      });
      textY -= 6;
    });

    cursorY = sectionBottom - 16;
  };

  startPage(true);
  sectionData.forEach(drawSection);
  pageCommands.push(currentCommands.join("\n"));

  const totalPages = pageCommands.length;
  const contentStreams = pageCommands.map((commands, index) => `${commands}\n${(() => {
    const footerCommands: string[] = [];
    drawFooter(footerCommands, index + 1, totalPages);
    return footerCommands.join("\n");
  })()}`);

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const pdfObjects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
  ];
  let nextObjectId = 3;

  contentStreams.forEach(() => {
    pageObjectIds.push(nextObjectId++);
    contentObjectIds.push(nextObjectId++);
  });

  const fontRegularId = nextObjectId++;
  const fontBoldId = nextObjectId++;

  pdfObjects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  contentStreams.forEach((stream, index) => {
    pdfObjects[pageObjectIds[index] - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`;
    pdfObjects[contentObjectIds[index] - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  pdfObjects[fontRegularId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pdfObjects[fontBoldId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  pdfObjects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${pdfObjects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

async function exportReleaseRiskPdf(result: Record<string, unknown>) {
  try {
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const footerY = pageHeight - 22;
    const brandDark: [number, number, number] = [17, 24, 39];
    const brandTeal: [number, number, number] = [38, 196, 185];
    const brandSlate: [number, number, number] = [31, 41, 55];
    const ink: [number, number, number] = [24, 31, 42];
    const muted: [number, number, number] = [88, 102, 118];
    const soft: [number, number, number] = [241, 245, 249];

    const readinessScore = typeof result.readinessScore === "number" ? `${result.readinessScore}%` : "N/A";
    const riskLevel = typeof result.riskLevel === "string" ? result.riskLevel : "Not Assessed";
    const goNoGoRecommendation = typeof result.goNoGoRecommendation === "string" ? result.goNoGoRecommendation : "Pending";
    const summary = typeof result.summary === "string" ? result.summary : "Release risk summary is not available.";
    const releaseRecommendation = typeof result.releaseRecommendation === "string" ? result.releaseRecommendation : "";
    const sections: Array<{ title: string; items: string[] }> = [
      {
        title: "Executive KPI Dashboard",
        items: [
          `Readiness Score | ${readinessScore} | Target 85%+`,
          `Risk Level | ${riskLevel} | Target Low to Moderate`,
          `Release Decision | ${goNoGoRecommendation} | Target Go or Conditional Go`,
          `Coverage Gaps | ${toTextList(result.coverageGaps).length} | Target 0 major gaps`,
        ],
      },
      { title: "Executive Summary", items: [summary] },
      { title: "Risk Matrix", items: toTextList(result.highRiskModules) },
      { title: "Critical Blockers", items: toTextList(result.blockers) },
      { title: "Release Decision Drivers", items: toTextList(result.releaseDecisionDrivers) },
      { title: "Deployment Strategy", items: [...toTextList(result.mitigationPlan), ...toTextList(result.deploymentGuards)] },
      { title: "Monitoring & Observability", items: toTextList(result.monitoringPlan) },
      { title: "Rollback Triggers", items: toTextList(result.rollbackTriggers) },
      { title: "Residual Risks", items: toTextList(result.residualRisks) },
      { title: "Stakeholder Actions", items: toTextList(result.stakeholderActions) },
      { title: "Communication Plan", items: toTextList(result.communicationPlan) },
      { title: "Sign-Off Owners", items: toTextList(result.signoffOwners) },
      { title: "Entry Criteria", items: toTextList(result.entryCriteria) },
      { title: "Exit Criteria", items: toTextList(result.exitCriteria) },
      { title: "Evidence Required", items: toTextList(result.evidenceRequired) },
      { title: "Coverage Gaps", items: toTextList(result.coverageGaps) },
      { title: "Final Recommendation", items: [goNoGoRecommendation, releaseRecommendation].filter(Boolean) },
    ].filter((section) => section.items.length);

    const addFooter = (pageNumber: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text("QA Copilot Confidential | Executive Release Governance Pack", margin, footerY);
      doc.text(`Page ${pageNumber}`, pageWidth - margin, footerY, { align: "right" });
    };

    const drawHeader = (firstPage: boolean) => {
      doc.setFillColor(...brandDark);
      doc.rect(0, 0, pageWidth, 56, "F");
      doc.setFillColor(...brandTeal);
      doc.rect(0, 0, pageWidth, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("QA Copilot", margin, 33);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(214, 226, 238);
      doc.text("Release Readiness Report", pageWidth - margin, 33, { align: "right" });

      if (firstPage) {
        doc.setFillColor(...soft);
        doc.roundedRect(margin, 88, contentWidth, 118, 12, 12, "F");
        doc.setFillColor(...brandTeal);
        doc.roundedRect(margin, 88, 6, 118, 6, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(...ink);
        doc.text("Executive Risk Assessment", margin + 22, 126);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...muted);
        doc.text("Prepared for executive leadership, QA leads, and release governance.", margin + 22, 148);
        doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, margin + 22, 166);
        doc.text(`Decision: ${goNoGoRecommendation} | Risk: ${riskLevel} | Readiness: ${readinessScore}`, margin + 22, 184);
      }
    };

    let currentY = 226;
    let pageNumber = 1;
    drawHeader(true);

    const ensureSpace = (neededHeight: number) => {
      if (currentY + neededHeight <= pageHeight - 44) return;
      addFooter(pageNumber);
      doc.addPage();
      pageNumber += 1;
      drawHeader(false);
      currentY = 88;
    };

    const drawSection = (title: string, items: string[]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrappedItems = items.map((item, index) => ({
        lines: doc.splitTextToSize(`${index + 1}. ${item}`, contentWidth - 40) as string[],
      }));
      const sectionHeight =
        28 + wrappedItems.reduce((sum, item) => sum + item.lines.length * 13 + 6, 0) + 16;

      ensureSpace(sectionHeight);

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, currentY, contentWidth, sectionHeight, 10, 10, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, sectionHeight, 10, 10, "S");
      doc.setFillColor(...soft);
      doc.roundedRect(margin, currentY, contentWidth, 24, 10, 10, "F");
      doc.rect(margin, currentY + 12, contentWidth, 12, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...brandSlate);
      doc.text(title, margin + 14, currentY + 16);

      let textY = currentY + 38;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...ink);

      wrappedItems.forEach((item) => {
        doc.text(item.lines, margin + 14, textY);
        textY += item.lines.length * 13 + 6;
      });

      currentY += sectionHeight + 12;
    };

    sections.forEach((section) => drawSection(section.title, section.items));
    addFooter(pageNumber);
    doc.save("QA-Copilot-Boardroom-Release-Readiness-Report.pdf");
    return;
  } catch {
    const blob = buildReleaseRiskPdfBlob(result);
    downloadBlob(blob, "QA-Copilot-Boardroom-Release-Readiness-Report.pdf");
  }
}

async function exportSpreadsheet(rows: Record<string, string>[], filename: string, format: "csv" | "xlsx") {
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/ChunkLoadError|Loading chunk/i.test(message)) {
      throw new Error("The export module was refreshed while the app was open. Reload the page once, then try the export again.");
    }
    throw error;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Results");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets.Results);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
    return;
  }

  const content = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([content], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`,
  );
}

async function exportQaPackWorkbook(result: Record<string, unknown>, filename: string) {
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/ChunkLoadError|Loading chunk/i.test(message)) {
      throw new Error("The export module was refreshed while the app was open. Reload the page once, then try the export again.");
    }
    throw error;
  }

  const workbook = XLSX.utils.book_new();
  const toRows = (key: string, values: string[]) => values.map((value, index) => ({ Order: index + 1, [key]: value }));
  const getList = (value: unknown) => toTextList(value);
  const testCases = Array.isArray(result.testCases) ? (result.testCases as Array<Record<string, unknown>>) : [];
  const traceabilityMap = new Map<string, {
    requirementId: string;
    modules: Set<string>;
    testCaseIds: Set<string>;
    priorities: Set<string>;
    owners: Set<string>;
    automationStatuses: Set<string>;
    releaseImpacts: Set<string>;
  }>();

  testCases.forEach((row) => {
    const requirementId = String(row.requirementId || "").trim();
    if (!requirementId) return;
    const entry = traceabilityMap.get(requirementId) || {
      requirementId,
      modules: new Set<string>(),
      testCaseIds: new Set<string>(),
      priorities: new Set<string>(),
      owners: new Set<string>(),
      automationStatuses: new Set<string>(),
      releaseImpacts: new Set<string>(),
    };

    if (row.module) entry.modules.add(String(row.module));
    if (row.id) entry.testCaseIds.add(String(row.id));
    if (row.priority) entry.priorities.add(String(row.priority));
    if (row.owner) entry.owners.add(String(row.owner));
    if (row.automationStatus) entry.automationStatuses.add(String(row.automationStatus));
    if (row.releaseImpact) entry.releaseImpacts.add(String(row.releaseImpact));

    traceabilityMap.set(requirementId, entry);
  });

  const traceabilityRows = Array.from(traceabilityMap.values()).map((entry) => ({
    "Requirement ID": entry.requirementId,
    Modules: Array.from(entry.modules).join(", "),
    "Linked Test Cases": Array.from(entry.testCaseIds).join(", "),
    Priority: Array.from(entry.priorities).join(", "),
    Owner: Array.from(entry.owners).join(", "),
    "Automation Status": Array.from(entry.automationStatuses).join(", "),
    "Coverage Status": entry.testCaseIds.size >= 2 ? "Covered" : "Partially Covered",
    "Release Impact": Array.from(entry.releaseImpacts).join(" | "),
  }));

  const detailedRows = testCases.map((row) => ({
    "Test Case ID": String(row.id || ""),
    "Requirement ID": String(row.requirementId || ""),
    Module: String(row.module || ""),
    Priority: String(row.priority || ""),
    Severity: String(row.severity || ""),
    Owner: String(row.owner || ""),
    Environment: String(row.environment || ""),
    "Automation Status": String(row.automationStatus || ""),
    Dependencies: Array.isArray(row.dependencies) ? row.dependencies.join(" | ") : String(row.dependencies || ""),
    Objective: String(row.objective || ""),
    Scenario: String(row.scenario || ""),
    Preconditions: Array.isArray(row.preconditions) ? row.preconditions.join(" | ") : String(row.preconditions || ""),
    "Test Data": Array.isArray(row.testData) ? row.testData.join(" | ") : String(row.testData || ""),
    Steps: Array.isArray(row.steps) ? row.steps.join(" | ") : String(row.steps || ""),
    "Expected Result": String(row.expectedResult || ""),
    "Negative Coverage": Array.isArray(row.negativeCoverage) ? row.negativeCoverage.join(" | ") : String(row.negativeCoverage || ""),
    "Edge Coverage": Array.isArray(row.edgeCoverage) ? row.edgeCoverage.join(" | ") : String(row.edgeCoverage || ""),
    "Automation Candidate": String(row.automationCandidate || ""),
    Postconditions: Array.isArray(row.postconditions) ? row.postconditions.join(" | ") : String(row.postconditions || ""),
    "Release Impact": String(row.releaseImpact || ""),
    "Execution Notes": String(row.executionNotes || ""),
    Risk: String(row.risk || ""),
    Tags: Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags || ""),
    Type: String(row.type || ""),
  }));

  const overviewRows = [
    { Section: "Summary", Value: typeof result.summary === "string" ? result.summary : "" },
    { Section: "Go/No-Go Recommendation", Value: typeof result.goNoGoRecommendation === "string" ? result.goNoGoRecommendation : "" },
    { Section: "Release Recommendation", Value: typeof result.releaseRecommendation === "string" ? result.releaseRecommendation : "" },
  ].filter((row) => row.Value);

  const sheets: Array<[string, Record<string, string | number>[]]> = [
    ["Overview", overviewRows],
    ["Smoke Suite", toRows("Smoke Item", getList(result.smokeSuite))],
    ["Regression Suite", toRows("Regression Item", getList(result.regressionSuite))],
    ["UAT Suite", toRows("UAT Item", getList(result.uatSuite))],
    ["UAT Signoff", toRows("UAT Sign-Off Criterion", getList(result.uatSignoffCriteria))],
    ["Business UAT", toRows("Business Owner Scenario", getList(result.businessOwnerScenarios))],
    ["QA Lead Pack", toRows("QA Lead Item", getList(result.qaLeadPack))],
    ["Automation Pack", toRows("Automation Pack Item", getList(result.automationPack))],
    ["Business UAT Pack", toRows("Business UAT Item", getList(result.businessUatPack))],
    ["Automation", toRows("Automation Candidate", getList(result.automationCandidates))],
    ["Strategy", toRows("Strategy Item", getList(result.testStrategy))],
    ["Entry Criteria", toRows("Entry Criterion", getList(result.entryCriteria))],
    ["Exit Criteria", toRows("Exit Criterion", getList(result.exitCriteria))],
    ["Defect Summary", toRows("Defect Theme", getList(result.defectSummary))],
    ["Coverage Gaps", toRows("Coverage Gap", getList(result.coverageGaps))],
    ["Traceability Matrix", traceabilityRows],
    ["Detailed Cases", detailedRows],
  ];

  sheets.forEach(([sheetName, rowsForSheet]) => {
    if (!rowsForSheet.length) return;
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowsForSheet), sheetName);
  });

  const content = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([content], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`,
  );
}

async function exportRoleWorkbook(
  result: Record<string, unknown>,
  filename: string,
  role: "qa-lead" | "automation" | "business-uat",
) {
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/ChunkLoadError|Loading chunk/i.test(message)) {
      throw new Error("The export module was refreshed while the app was open. Reload the page once, then try the export again.");
    }
    throw error;
  }

  const workbook = XLSX.utils.book_new();
  const toRows = (key: string, values: string[]) => values.map((value, index) => ({ Order: index + 1, [key]: value }));
  const getList = (value: unknown) => toTextList(value);
  const overviewRows = [
    { Section: "Summary", Value: typeof result.summary === "string" ? result.summary : "" },
    { Section: "Go/No-Go Recommendation", Value: typeof result.goNoGoRecommendation === "string" ? result.goNoGoRecommendation : "" },
    { Section: "Release Recommendation", Value: typeof result.releaseRecommendation === "string" ? result.releaseRecommendation : "" },
  ].filter((row) => row.Value);

  const roleSheets: Record<string, Array<[string, Record<string, string | number>[]]>> = {
    "qa-lead": [
      ["Overview", overviewRows],
      ["QA Lead Pack", toRows("QA Lead Item", getList(result.qaLeadPack))],
      ["Go No-Go", toRows("Release Decision", getList([
        typeof result.goNoGoRecommendation === "string" ? result.goNoGoRecommendation : "",
        typeof result.releaseRecommendation === "string" ? result.releaseRecommendation : "",
      ]))],
      ["Defect Summary", toRows("Defect Theme", getList(result.defectSummary))],
      ["Coverage Gaps", toRows("Coverage Gap", getList(result.coverageGaps))],
      ["Entry Criteria", toRows("Entry Criterion", getList(result.entryCriteria))],
      ["Exit Criteria", toRows("Exit Criterion", getList(result.exitCriteria))],
      ["Smoke Suite", toRows("Smoke Item", getList(result.smokeSuite))],
    ],
    automation: [
      ["Overview", overviewRows],
      ["Automation Pack", toRows("Automation Pack Item", getList(result.automationPack))],
      ["Automation Candidates", toRows("Automation Candidate", getList(result.automationCandidates))],
      ["Smoke Suite", toRows("Smoke Item", getList(result.smokeSuite))],
      ["Regression Suite", toRows("Regression Item", getList(result.regressionSuite))],
    ],
    "business-uat": [
      ["Overview", overviewRows],
      ["Business UAT Pack", toRows("Business UAT Item", getList(result.businessUatPack))],
      ["UAT Suite", toRows("UAT Item", getList(result.uatSuite))],
      ["UAT Signoff", toRows("UAT Sign-Off Criterion", getList(result.uatSignoffCriteria))],
      ["Business Scenarios", toRows("Business Owner Scenario", getList(result.businessOwnerScenarios))],
    ],
  };

  roleSheets[role].forEach(([sheetName, rows]) => {
    if (!rows.length) return;
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  });

  const content = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([content], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`,
  );
}

async function exportReleaseRiskWorkbook(result: Record<string, unknown>, filename: string) {
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/ChunkLoadError|Loading chunk/i.test(message)) {
      throw new Error("The export module was refreshed while the app was open. Reload the page once, then try the export again.");
    }
    throw error;
  }

  const workbook = XLSX.utils.book_new();
  const toRows = (key: string, values: string[]) => values.map((value, index) => ({ Order: index + 1, [key]: value }));
  const getList = (value: unknown) => toTextList(value);
  const overviewRows = [
    { Section: "Summary", Value: typeof result.summary === "string" ? result.summary : "" },
    { Section: "Readiness Score", Value: typeof result.readinessScore === "number" ? `${result.readinessScore}%` : "" },
    { Section: "Risk Level", Value: typeof result.riskLevel === "string" ? result.riskLevel : "" },
    { Section: "Go/No-Go Recommendation", Value: typeof result.goNoGoRecommendation === "string" ? result.goNoGoRecommendation : "" },
    { Section: "Release Recommendation", Value: typeof result.releaseRecommendation === "string" ? result.releaseRecommendation : "" },
  ].filter((row) => row.Value);

  const sheets: Array<[string, Record<string, string | number>[]]> = [
    ["Overview", overviewRows],
    ["Blockers", toRows("Blocker", getList(result.blockers))],
    ["Decision Drivers", toRows("Decision Driver", getList(result.releaseDecisionDrivers))],
    ["Residual Risks", toRows("Residual Risk", getList(result.residualRisks))],
    ["Rollback Triggers", toRows("Rollback Trigger", getList(result.rollbackTriggers))],
    ["Deployment Guards", toRows("Deployment Guard", getList(result.deploymentGuards))],
    ["Signoff Owners", toRows("Signoff Owner", getList(result.signoffOwners))],
    ["Monitoring Plan", toRows("Monitoring Item", getList(result.monitoringPlan))],
    ["Communication Plan", toRows("Communication Item", getList(result.communicationPlan))],
    ["Stakeholder Actions", toRows("Stakeholder Action", getList(result.stakeholderActions))],
    ["Mitigation Plan", toRows("Mitigation Item", getList(result.mitigationPlan))],
    ["Entry Criteria", toRows("Entry Criterion", getList(result.entryCriteria))],
    ["Exit Criteria", toRows("Exit Criterion", getList(result.exitCriteria))],
    ["Evidence Required", toRows("Evidence Item", getList(result.evidenceRequired))],
    ["Coverage Gaps", toRows("Coverage Gap", getList(result.coverageGaps))],
    ["High Risk Modules", toRows("High Risk Module", getList(result.highRiskModules))],
  ];

  sheets.forEach(([sheetName, rows]) => {
    if (!rows.length) return;
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  });

  const content = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([content], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`,
  );
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? Object.values(item as Record<string, unknown>)
              .filter((entry) => typeof entry === "string" || typeof entry === "number")
              .join(" - ")
          : "",
    )
    .filter(Boolean);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dateString));
}

function toSentence(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function ResultBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">{title}</h4>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-slate-200">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function coverageTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("partial")) {
    return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  }
  if (normalized.includes("covered")) {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  }
  return "border-rose-400/20 bg-rose-500/10 text-rose-100";
}

function goNoGoTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("no-go")) {
    return "border-rose-400/20 bg-rose-500/10 text-rose-100";
  }
  if (normalized.includes("conditional")) {
    return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  }
  return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
}

function TraceabilityMatrix({
  rows,
}: {
  rows: Array<{
    requirementId: string;
    modules: string;
    linkedTestCases: string;
    priority: string;
    owner: string;
    automationStatus: string;
    coverageStatus: string;
    releaseImpact: string;
  }>;
}) {
  if (!rows.length) return null;

  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h4 className="text-base font-semibold text-white">Traceability Matrix</h4>
          <p className="mt-1 text-sm text-slate-300">Requirement-level coverage, ownership, automation status, and release impact.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.requirementId} className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{row.requirementId}</p>
                <p className="mt-1 text-sm text-slate-300">{row.modules || "Unmapped module"}</p>
              </div>
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${coverageTone(row.coverageStatus)}`}>
                {row.coverageStatus}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Linked Cases</p>
                <p className="mt-2 text-sm text-slate-100">{row.linkedTestCases || "None"}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Priority</p>
                <p className="mt-2 text-sm text-slate-100">{row.priority || "Not set"}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Owner</p>
                <p className="mt-2 text-sm text-slate-100">{row.owner || "Not assigned"}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Automation</p>
                <p className="mt-2 text-sm text-slate-100">{row.automationStatus || "Unknown"}</p>
              </div>
            </div>
            {row.releaseImpact ? (
              <p className="mt-3 text-sm leading-7 text-slate-300">
                <span className="font-semibold text-white">Release impact:</span> {row.releaseImpact}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ParagraphReport({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  if (!paragraphs.length) return null;

  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <div className="mt-4 space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={`${title}-${index + 1}`} className="text-sm leading-7 text-slate-200">
            <span className="mr-2 font-semibold text-white">{index + 1}.</span>
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

function ComparisonRows({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    sourceHeading: string;
    liveHeading: string;
    sourceContent?: string;
    liveContent?: string;
    missingInLive?: string;
    status?: string;
    sourceParagraphs?: string[];
    liveParagraphs?: string[];
  }>;
}) {
  if (!rows.length) return null;

  function formatStatus(status?: string) {
    if (status === "Matched") return "Good match";
    if (status === "Partial") return "Partially matched";
    if (status === "Missing") return "Missing on live page";
    return status || "";
  }

  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <div className="mt-4 space-y-4">
        {rows.map((row, index) => (
          <div key={`${title}-${index + 1}-${row.sourceHeading}`} className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-white">{index + 1}. Source Heading: {row.sourceHeading}</p>
            <p className="mt-2 text-sm text-slate-200"><span className="font-semibold text-white">Live Heading:</span> {row.liveHeading}</p>
            {row.status ? <p className="mt-2 text-sm text-cyan-100"><span className="font-semibold text-white">Match Result:</span> {formatStatus(row.status)}</p> : null}

            {(row.sourceParagraphs?.length || row.liveParagraphs?.length)
              ? Array.from({ length: Math.max(row.sourceParagraphs?.length || 0, row.liveParagraphs?.length || 0) }).map((_, paragraphIndex) => (
                  <div key={`${row.sourceHeading}-paragraph-${paragraphIndex + 1}`} className="mt-3 space-y-2">
                    <p className="text-sm leading-7 text-slate-200">
                      <span className="font-semibold text-white">Source Paragraph {paragraphIndex + 1}:</span>{" "}
                      {row.sourceParagraphs?.[paragraphIndex] || "No corresponding source paragraph extracted."}
                    </p>
                    <p className="text-sm leading-7 text-slate-200">
                      <span className="font-semibold text-white">Live Paragraph {paragraphIndex + 1}:</span>{" "}
                      {row.liveParagraphs?.[paragraphIndex] || "No corresponding live paragraph found."}
                    </p>
                  </div>
                ))
              : null}

            {!row.sourceParagraphs?.length && row.sourceContent ? <p className="mt-3 text-sm leading-7 text-slate-200"><span className="font-semibold text-white">Source Paragraph 1:</span> {row.sourceContent}</p> : null}
            {!row.liveParagraphs?.length && row.liveContent ? <p className="mt-3 text-sm leading-7 text-slate-200"><span className="font-semibold text-white">Live Paragraph 1:</span> {row.liveContent}</p> : null}
            {row.missingInLive ? <p className="mt-3 text-sm leading-7 text-rose-100"><span className="font-semibold text-rose-200">Missing In Live:</span> {row.missingInLive}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function BulkUrlPages({
  pages,
}: {
  pages: Array<{
    url: string;
    pageTitle?: string;
    matchScore?: number;
    alert?: string;
    responsiveStatus?: string;
    testedFor?: string[];
    keyObservations?: string[];
    issues?: string[];
  }>;
}) {
  if (!pages.length) return null;

  return (
    <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5">
      <h4 className="text-base font-semibold text-white">Page-by-page QA review</h4>
      <div className="mt-4 space-y-4">
        {pages.map((page) => (
          <div key={page.url} className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{page.pageTitle || page.url}</p>
                <p className="mt-1 text-xs text-slate-400">{page.url}</p>
              </div>
              <div className="flex gap-2">
                {typeof page.matchScore === "number" ? <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Score {page.matchScore}%</div> : null}
                {page.responsiveStatus ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">{page.responsiveStatus}</div> : null}
              </div>
            </div>
            {page.alert ? <p className="mt-3 text-sm leading-7 text-slate-200"><span className="font-semibold text-white">Main finding:</span> {page.alert}</p> : null}
            {page.testedFor?.length ? <p className="mt-3 text-sm leading-7 text-slate-200"><span className="font-semibold text-white">Tested for:</span> {page.testedFor.join(", ")}</p> : null}
            {page.keyObservations?.length ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-white">Key observations</p>
                <div className="mt-2 space-y-2">
                  {page.keyObservations.map((item) => (
                    <p key={`${page.url}-${item}`} className="text-sm leading-7 text-slate-200">{item}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {page.issues?.length ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-rose-200">Issues found</p>
                <div className="mt-2 space-y-2">
                  {page.issues.map((item) => (
                    <p key={`${page.url}-issue-${item}`} className="text-sm leading-7 text-rose-100">{item}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildComparisonParagraph({
  label,
  source,
  live,
  impact,
  recommendation,
}: {
  label: string;
  source: string;
  live: string;
  impact: string;
  recommendation: string;
}) {
  return `${label}: Source says ${toSentence(source)} Live page shows ${toSentence(live)} Impact: ${toSentence(impact)} Recommended correction: ${toSentence(recommendation)}`;
}

function toUserFacingErrorMessage(message: string, role?: string) {
  if (role === "ADMIN") {
    return message;
  }

  if (/ai generation failed/i.test(message) || /429/i.test(message) || /quota/i.test(message) || /billing/i.test(message)) {
    return "AI generation is temporarily unavailable. Please try again later or contact support.";
  }

  return message;
}

function buildDetailedComparisonParagraphs(data: Record<string, unknown>) {
  const paragraphs: string[] = [];
  const missingContent = toTextList(data.missingContent);
  const contentDrift = toTextList(data.contentDrift);
  const seoMismatches = toTextList(data.seoMismatches);
  const formattingInconsistencies = toTextList(data.formattingInconsistencies);
  const accessibilityFindings = toTextList(data.accessibilityFindings);
  const pixelLevelDifferences = toTextList(data.pixelLevelDifferences);
  const uxImpactHighlights = toTextList(data.uxImpactHighlights);

  missingContent.forEach((item, index) => {
    paragraphs.push(
      buildComparisonParagraph({
        label: `Missing section ${index + 1}`,
        source: item,
        live: "This section is not visible or is materially incomplete on the published page",
        impact: "Users may miss important value, proof, or conversion-driving information",
        recommendation: "Restore the omitted section with the same hierarchy and messaging intent as the approved source",
      }),
    );
  });

  contentDrift.forEach((item, index) => {
    paragraphs.push(
      buildComparisonParagraph({
        label: `Content drift ${index + 1}`,
        source: "The approved source uses more specific, intentional product messaging",
        live: item,
        impact: "The page message becomes weaker or less aligned with the intended positioning",
        recommendation: "Rewrite the live copy so it matches the original source tone, meaning, and emphasis more closely",
      }),
    );
  });

  seoMismatches.forEach((item, index) => {
    paragraphs.push(
      buildComparisonParagraph({
        label: `SEO mismatch ${index + 1}`,
        source: "Reference copy preserves the intended keyword and search intent",
        live: item,
        impact: "Search visibility and relevance may weaken if the published copy drifts from the intended terms",
        recommendation: "Align headings and supporting copy with the keyword framing used in the approved source",
      }),
    );
  });

  formattingInconsistencies.forEach((item, index) => {
    paragraphs.push(
      buildComparisonParagraph({
        label: `Formatting issue ${index + 1}`,
        source: "The source document uses a clearer content hierarchy and scanning structure",
        live: item,
        impact: "Readers may find the page harder to scan and understand quickly",
        recommendation: "Reapply the original hierarchy using clearer headings, grouping, and spacing",
      }),
    );
  });

  pixelLevelDifferences.forEach((item, index) => {
    paragraphs.push(
      buildComparisonParagraph({
        label: `Visual comparison ${index + 1}`,
        source: "The approved design reference defines the intended spacing, alignment, and visual rhythm",
        live: item,
        impact: "The implemented page may feel visually inconsistent or less polished than the design",
        recommendation: "Adjust the live UI to match the source design tokens, spacing, and layout behavior",
      }),
    );
  });

  uxImpactHighlights.forEach((item, index) => {
    paragraphs.push(
      buildComparisonParagraph({
        label: `UX impact ${index + 1}`,
        source: "The intended design should guide the user with clear emphasis and comfortable spacing",
        live: item,
        impact: "This affects clarity, visual emphasis, or ease of interaction",
        recommendation: "Update the affected area so the live experience follows the intended interaction and reading flow",
      }),
    );
  });

  const semanticValidation =
    data.semanticValidation && typeof data.semanticValidation === "object"
      ? (data.semanticValidation as Record<string, unknown>)
      : null;

  if (semanticValidation) {
    const messagingAccuracy = typeof semanticValidation.messagingAccuracy === "string" ? semanticValidation.messagingAccuracy : "Not specified";
    const toneConsistency = typeof semanticValidation.toneConsistency === "string" ? semanticValidation.toneConsistency : "Not specified";
    const missingKeySections = toTextList(semanticValidation.missingKeySections);
    paragraphs.push(
      buildComparisonParagraph({
        label: "Semantic validation",
        source: `The source material expects accurate messaging and a consistent tone. Missing key sections include ${missingKeySections.join(", ") || "none specified"}`,
        live: `Messaging accuracy is rated ${messagingAccuracy.toLowerCase()} and tone consistency is rated ${toneConsistency.toLowerCase()}`,
        impact: "Semantic drift can reduce trust and weaken the intended business message",
        recommendation: "Revise the live page so the tone, terminology, and section coverage match the approved source",
      }),
    );
  }

  const designTokenValidation =
    data.designTokenValidation && typeof data.designTokenValidation === "object"
      ? (data.designTokenValidation as Record<string, unknown>)
      : null;

  if (designTokenValidation) {
    const tokenNotes = [
      ...toTextList(designTokenValidation.colors).map((item) =>
        buildComparisonParagraph({
          label: "Color token validation",
          source: "Design tokens should match the approved color system",
          live: item,
          impact: "Color drift can weaken brand consistency and contrast quality",
          recommendation: "Apply the exact approved color tokens or hex values from the source design",
        }),
      ),
      ...toTextList(designTokenValidation.typography).map((item) =>
        buildComparisonParagraph({
          label: "Typography token validation",
          source: "The design specifies a defined type scale and text rhythm",
          live: item,
          impact: "Typography drift can affect readability and visual hierarchy",
          recommendation: "Restore the intended font sizes, weights, and supporting text scale from the design spec",
        }),
      ),
      ...toTextList(designTokenValidation.spacing).map((item) =>
        buildComparisonParagraph({
          label: "Spacing token validation",
          source: "Section and component spacing should follow the approved spacing system",
          live: item,
          impact: "Spacing inconsistencies can make the layout feel compressed or uneven",
          recommendation: "Update margins, padding, and section rhythm to match the approved spacing tokens",
        }),
      ),
    ];

    tokenNotes.forEach((item) => paragraphs.push(item));
  }

  const responsiveDeviations = Array.isArray(data.responsiveDeviations) ? data.responsiveDeviations : [];
  responsiveDeviations.forEach((entry, index) => {
    if (entry && typeof entry === "object") {
      const item = entry as Record<string, unknown>;
      const viewport = typeof item.viewport === "string" ? item.viewport : `Viewport ${index + 1}`;
      const issue = typeof item.issue === "string" ? item.issue : "Responsive deviation detected";
      const severity = typeof item.severity === "string" ? item.severity : "Unspecified";
      paragraphs.push(
        buildComparisonParagraph({
          label: `Responsive check for ${viewport}`,
          source: `The source design should remain stable across breakpoints with consistent structure and spacing`,
          live: `${issue}. Severity is ${severity.toLowerCase()}`,
          impact: "Users on that viewport may experience layout instability or weaker visual hierarchy",
          recommendation: `Adjust the ${viewport.toLowerCase()} layout to match the approved responsive behavior`,
        }),
      );
    }
  });

  accessibilityFindings.forEach((item, index) => {
    paragraphs.push(
      buildComparisonParagraph({
        label: `Accessibility note ${index + 1}`,
        source: "The experience should remain accessible, readable, and operable for all users",
        live: item,
        impact: "Accessibility issues can reduce usability and introduce compliance risk",
        recommendation: "Correct the affected accessibility issue and retest with accessibility-focused checks",
      }),
    );
  });

  const autoBugReports = Array.isArray(data.autoBugReports) ? data.autoBugReports : [];
  autoBugReports.forEach((entry, index) => {
    if (entry && typeof entry === "object") {
      const item = entry as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title : `Recommended fix ${index + 1}`;
      const location = typeof item.location === "string" ? item.location : "Unspecified area";
      const suggestedFix = typeof item.suggestedFix === "string" ? item.suggestedFix : "";
      paragraphs.push(
        buildComparisonParagraph({
          label: `Recommended fix ${index + 1}`,
          source: `The approved source expects this area to be complete and correct in ${location}`,
          live: `${title} is needed in ${location}`,
          impact: "Leaving the issue unresolved may preserve visible content or design mismatch",
          recommendation: suggestedFix || "Apply the correction and validate the area again against the source",
        }),
      );
    }
  });

  return paragraphs;
}

function FriendlyResult({
  result,
  label,
  reportContext,
  onDownloadPdf,
}: {
  result: unknown;
  label: string;
  reportContext?: ReportContext;
  onDownloadPdf?: (result: Record<string, unknown>, label: string, context?: ReportContext) => Promise<void>;
}) {
  if (!result || typeof result !== "object") {
    return (
      <div className="rounded-[32px] border border-dashed border-white/10 bg-slate-950/45 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-300/12 p-3 text-cyan-100">
            <WandSparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white">Your {label.toLowerCase()} output will appear here</h4>
            <p className="mt-1 text-sm text-slate-300">We surface structured findings, summaries, and next actions instead of a generic text box.</p>
          </div>
        </div>
      </div>
    );
  }

  const data = result as Record<string, unknown>;
  const summary = typeof data.summary === "string" ? data.summary : "";
  const goNoGoRecommendation = typeof data.goNoGoRecommendation === "string" ? data.goNoGoRecommendation : "";
  const score = typeof data.qaScore === "number" ? data.qaScore : typeof data.readinessScore === "number" ? data.readinessScore : null;
  const riskLevel = typeof data.riskLevel === "string" ? data.riskLevel : "";
  const passRate = typeof data.passRate === "string" ? data.passRate : "";
  const comparisonConfidence = typeof data.comparisonConfidence === "string" ? data.comparisonConfidence : "";
  const comparisonStatus = typeof data.comparisonStatus === "string" ? data.comparisonStatus : "";
  const findings = [...toTextList(data.testCases), ...toTextList(data.criticalIssues), ...toTextList(data.highRiskModules), ...toTextList(data.missingContent), ...toTextList(data.pixelLevelDifferences)];
  const attention = [...toTextList(data.edgeCases), ...toTextList(data.risks), ...toTextList(data.gaps), ...toTextList(data.accessibilityFindings), ...toTextList(data.responsiveDeviations)];
  const nextSteps = [...toTextList(data.generatedTickets), ...toTextList(data.autoBugReports), ...toTextList(data.sampleRequests), typeof data.recommendation === "string" ? data.recommendation : "", typeof data.suggestedFix === "string" ? data.suggestedFix : "", typeof data.releaseRecommendation === "string" ? data.releaseRecommendation : ""].filter(Boolean);
  const smokeSuite = toTextList(data.smokeSuite);
  const regressionSuite = toTextList(data.regressionSuite);
  const uatSuite = toTextList(data.uatSuite);
  const uatSignoffCriteria = toTextList(data.uatSignoffCriteria);
  const businessOwnerScenarios = toTextList(data.businessOwnerScenarios);
  const qaLeadPack = toTextList(data.qaLeadPack);
  const automationPack = toTextList(data.automationPack);
  const businessUatPack = toTextList(data.businessUatPack);
  const automationCandidates = toTextList(data.automationCandidates);
  const testStrategy = toTextList(data.testStrategy);
  const governanceNotes = toTextList(data.governanceNotes);
  const moduleCoverageTargets = toTextList(data.moduleCoverageTargets);
  const entryCriteria = toTextList(data.entryCriteria);
  const exitCriteria = toTextList(data.exitCriteria);
  const defectSummary = toTextList(data.defectSummary);
  const coverageGaps = toTextList(data.coverageGaps);
  const blockers = toTextList(data.blockers);
  const releaseDecisionDrivers = toTextList(data.releaseDecisionDrivers);
  const residualRisks = toTextList(data.residualRisks);
  const rollbackTriggers = toTextList(data.rollbackTriggers);
  const deploymentGuards = toTextList(data.deploymentGuards);
  const signoffOwners = toTextList(data.signoffOwners);
  const monitoringPlan = toTextList(data.monitoringPlan);
  const communicationPlan = toTextList(data.communicationPlan);
  const stakeholderActions = toTextList(data.stakeholderActions);
  const mitigationPlan = toTextList(data.mitigationPlan);
  const evidenceRequired = toTextList(data.evidenceRequired);
  const traceabilityRows = Array.isArray(data.testCases)
    ? Array.from(
        (data.testCases as Array<Record<string, unknown>>).reduce((acc, item) => {
          const requirementId = typeof item.requirementId === "string" ? item.requirementId : "";
          if (!requirementId) return acc;

          const current = acc.get(requirementId) || {
            requirementId,
            modules: new Set<string>(),
            linkedTestCases: new Set<string>(),
            priorities: new Set<string>(),
            owners: new Set<string>(),
            automationStatuses: new Set<string>(),
            releaseImpacts: new Set<string>(),
          };

          if (typeof item.module === "string" && item.module) current.modules.add(item.module);
          if (typeof item.id === "string" && item.id) current.linkedTestCases.add(item.id);
          if (typeof item.priority === "string" && item.priority) current.priorities.add(item.priority);
          if (typeof item.owner === "string" && item.owner) current.owners.add(item.owner);
          if (typeof item.automationStatus === "string" && item.automationStatus) current.automationStatuses.add(item.automationStatus);
          if (typeof item.releaseImpact === "string" && item.releaseImpact) current.releaseImpacts.add(item.releaseImpact);

          acc.set(requirementId, current);
          return acc;
        }, new Map<string, {
          requirementId: string;
          modules: Set<string>;
          linkedTestCases: Set<string>;
          priorities: Set<string>;
          owners: Set<string>;
          automationStatuses: Set<string>;
          releaseImpacts: Set<string>;
        }>()).values(),
      ).map((entry) => ({
        requirementId: entry.requirementId,
        modules: Array.from(entry.modules).join(", "),
        linkedTestCases: Array.from(entry.linkedTestCases).join(", "),
        priority: Array.from(entry.priorities).join(", "),
        owner: Array.from(entry.owners).join(", "),
        automationStatus: Array.from(entry.automationStatuses).join(", "),
        coverageStatus:
          entry.linkedTestCases.size >= 3 ? "Covered" : entry.linkedTestCases.size >= 1 ? "Partially Covered" : "Weak Coverage",
        releaseImpact: Array.from(entry.releaseImpacts).join(" | "),
      }))
    : [];
  const detailedComparisonParagraphs = buildDetailedComparisonParagraphs(data);
  const bulkPages = Array.isArray(data.pages)
    ? data.pages.filter(
        (item): item is {
          url: string;
          pageTitle?: string;
          matchScore?: number;
          alert?: string;
          responsiveStatus?: string;
          testedFor?: string[];
          keyObservations?: string[];
          issues?: string[];
        } => Boolean(item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string"),
      )
    : [];
  const headingComparisons = Array.isArray(data.headingComparisons)
    ? data.headingComparisons.filter((item): item is { sourceHeading: string; liveHeading: string; status?: string } => Boolean(item && typeof item === "object"))
    : [];
  const sectionComparisons = Array.isArray(data.sectionComparisons)
    ? data.sectionComparisons.filter(
        (item): item is {
          sourceHeading: string;
          liveHeading: string;
          sourceContent?: string;
          liveContent?: string;
          missingInLive?: string;
          sourceParagraphs?: string[];
          liveParagraphs?: string[];
        } =>
          Boolean(item && typeof item === "object"),
      )
    : [];
  const isWebsiteQaReport =
    "missingContent" in data ||
    "contentDrift" in data ||
    "pixelLevelDifferences" in data ||
    "responsiveDeviations" in data ||
    "designTokenValidation" in data;
  const isReleaseRiskReport =
    "goNoGoRecommendation" in data ||
    "blockers" in data ||
    "releaseDecisionDrivers" in data ||
    "mitigationPlan" in data;
  const isRejectedComparison = comparisonStatus.toLowerCase().includes("low confidence");
  const isExtractionFailure = comparisonStatus.toLowerCase().includes("extraction failed");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {score !== null ? <div className="rounded-[28px] border border-cyan-300/15 bg-cyan-300/10 p-5"><p className="text-xs uppercase tracking-[0.18em] text-cyan-100">Overall score</p><p className="mt-3 text-3xl font-semibold text-white">{score}%</p></div> : null}
        {riskLevel ? <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-300">Risk level</p><p className="mt-3 text-2xl font-semibold text-white">{riskLevel}</p></div> : null}
        {passRate ? <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-300">Pass rate</p><p className="mt-3 text-2xl font-semibold text-white">{passRate}</p></div> : null}
      </div>
      {goNoGoRecommendation ? (
        <div className={`rounded-[28px] border p-5 ${goNoGoTone(goNoGoRecommendation)}`}>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Go / No-Go</p>
          <p className="mt-3 text-2xl font-semibold">{goNoGoRecommendation}</p>
        </div>
      ) : null}
      {isReleaseRiskReport ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ResultBlock title="Blockers" items={blockers} />
          <ResultBlock title="Decision Drivers" items={releaseDecisionDrivers} />
          <ResultBlock title="Residual Risks" items={residualRisks} />
          <ResultBlock title="Rollback Triggers" items={rollbackTriggers} />
          <ResultBlock title="Stakeholder Actions" items={stakeholderActions} />
          <ResultBlock title="Mitigation Plan" items={mitigationPlan} />
        </div>
      ) : null}
      {isReleaseRiskReport ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ResultBlock title="Deployment Guards" items={deploymentGuards} />
          <ResultBlock title="Sign-Off Owners" items={signoffOwners} />
          <ResultBlock title="Monitoring Plan" items={monitoringPlan} />
        </div>
      ) : null}
      {isReleaseRiskReport ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ResultBlock title="Communication Plan" items={communicationPlan} />
          <ResultBlock title="Entry Criteria" items={entryCriteria} />
          <ResultBlock title="Exit Criteria" items={exitCriteria} />
          <ResultBlock title="Evidence Required" items={evidenceRequired} />
        </div>
      ) : null}
      {comparisonConfidence || comparisonStatus ? (
        <div className="grid gap-4 md:grid-cols-2">
          {comparisonConfidence ? <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-300">Comparison confidence</p><p className="mt-3 text-2xl font-semibold text-white">{comparisonConfidence}</p></div> : null}
          {comparisonStatus ? <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-300">Comparison status</p><p className="mt-3 text-2xl font-semibold text-white">{comparisonStatus}</p></div> : null}
        </div>
      ) : null}
      {isRejectedComparison ? (
        <div className="rounded-[28px] border border-amber-300/20 bg-amber-400/10 p-5">
          <h4 className="text-base font-semibold text-amber-100">
            {isExtractionFailure ? "Live page extraction failed" : "Source rejected for detailed comparison"}
          </h4>
          <p className="mt-2 text-sm leading-7 text-amber-50/90">
            {isExtractionFailure
              ? "The app could not extract enough reliable text from the target URL, so it intentionally suppressed the detailed comparison instead of generating a misleading report."
              : "This source document does not appear related enough to the target URL. The app has intentionally suppressed detailed section-by-section findings to avoid a misleading report."}
          </p>
        </div>
      ) : null}
      {summary ? <div className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5"><h4 className="text-base font-semibold text-white">Executive summary</h4><p className="mt-3 text-sm leading-7 text-slate-200">{summary}</p></div> : null}
      {(smokeSuite.length || regressionSuite.length || uatSuite.length || uatSignoffCriteria.length || businessOwnerScenarios.length || qaLeadPack.length || automationPack.length || businessUatPack.length || automationCandidates.length) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ResultBlock title="Smoke Suite" items={smokeSuite} />
          <ResultBlock title="Regression Suite" items={regressionSuite} />
          <ResultBlock title="UAT Suite" items={uatSuite} />
          <ResultBlock title="UAT Sign-Off Criteria" items={uatSignoffCriteria} />
          <ResultBlock title="Business Owner Scenarios" items={businessOwnerScenarios} />
          <ResultBlock title="QA Lead Pack" items={qaLeadPack} />
          <ResultBlock title="Automation Pack" items={automationPack} />
          <ResultBlock title="Business UAT Pack" items={businessUatPack} />
          <ResultBlock title="Automation Candidates" items={automationCandidates} />
        </div>
      ) : null}
      {(testStrategy.length || entryCriteria.length || exitCriteria.length) ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <ResultBlock title="Test Strategy" items={testStrategy} />
          <ResultBlock title="Entry Criteria" items={entryCriteria} />
          <ResultBlock title="Exit Criteria" items={exitCriteria} />
        </div>
      ) : null}
      {(governanceNotes.length || moduleCoverageTargets.length) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ResultBlock title="Governance Notes" items={governanceNotes} />
          <ResultBlock title="Module Coverage Targets" items={moduleCoverageTargets} />
        </div>
      ) : null}
      {(defectSummary.length || coverageGaps.length) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ResultBlock title="Defect Summary" items={defectSummary} />
          <ResultBlock title="Coverage Gaps" items={coverageGaps} />
        </div>
      ) : null}
      <TraceabilityMatrix rows={traceabilityRows} />
      <BulkUrlPages pages={bulkPages} />
      <ComparisonRows title="Heading comparison" rows={headingComparisons} />
      <ComparisonRows title="Section-by-section content comparison" rows={sectionComparisons} />
      {isWebsiteQaReport ? <ParagraphReport title="Detailed comparison report" paragraphs={detailedComparisonParagraphs} /> : null}
      {isReleaseRiskReport ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => exportReleaseRiskWorkbook(data, "qa-copilot-release-risk-pack")}>Export Release Risk Pack</Button>
          <Button variant="secondary" onClick={() => exportReleaseRiskPdf(data)}>Export Release Risk PDF</Button>
          <Button variant="secondary" onClick={() => exportJsonFile(result, `qa-copilot-${label.toLowerCase().replace(/\s+/g, "-")}.json`)}>Export JSON</Button>
        </div>
      ) : null}
      {isWebsiteQaReport ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void onDownloadPdf?.(data, label, reportContext)}>Download PDF report</Button>
          <Button variant="secondary" onClick={() => exportJsonFile(result, `qa-copilot-${label.toLowerCase().replace(/\s+/g, "-")}.json`)}>Export JSON</Button>
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <ResultBlock title="Key findings" items={findings} />
        <ResultBlock title="Recommended next steps" items={nextSteps} />
      </div>
      <ResultBlock title="Needs attention" items={attention} />
      <details className="rounded-[28px] border border-white/8 bg-slate-950/55 p-5 text-sm text-slate-300">
        <summary className="cursor-pointer font-medium text-white">Show raw technical output</summary>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-100">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}

export function UserConsole() {
  const router = useRouter();
  const [section, setSection] = useState<SectionId>("overview");
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [requirementText, setRequirementText] = useState("");
  const [requirementFile, setRequirementFile] = useState<File | null>(null);
  const [automationText, setAutomationText] = useState("");
  const [automationFramework, setAutomationFramework] = useState("playwright");
  const [bugInput, setBugInput] = useState("");
  const [testDataPrompt, setTestDataPrompt] = useState("");
  const [testDataFile, setTestDataFile] = useState<File | null>(null);
  const [recordCount, setRecordCount] = useState("5");
  const [reportText, setReportText] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [apiSpecText, setApiSpecText] = useState("");
  const [apiFile, setApiFile] = useState<File | null>(null);
  const [releaseRiskText, setReleaseRiskText] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [referenceType, setReferenceType] = useState("pdf");
  const [referenceContent, setReferenceContent] = useState("");
  const [contentMatchFile, setContentMatchFile] = useState<File | null>(null);
  const [contentScreenshotNotes, setContentScreenshotNotes] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [liveDesignUrl, setLiveDesignUrl] = useState("");
  const [designReference, setDesignReference] = useState("");
  const [designMatchFile, setDesignMatchFile] = useState<File | null>(null);
  const [componentScope, setComponentScope] = useState("");
  const [viewportTargets, setViewportTargets] = useState("mobile, tablet, desktop");
  const [designScreenshotNotes, setDesignScreenshotNotes] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [deploymentContext, setDeploymentContext] = useState("");
  const [workflowNotes, setWorkflowNotes] = useState("");

  const currentSection = useMemo(() => navGroups.flatMap((group) => group.items).find((item) => item.id === section) || navGroups[0].items[0], [section]);
  const selectedProject = useMemo(() => overview?.projects.find((project) => project.id === selectedProjectId) || overview?.projects[0] || null, [overview, selectedProjectId]);
  const safeCreditsLeft = Math.max(0, overview?.user.creditsBalance ?? 0);
  const planCredits = overview?.user.subscription?.plan.creditsPerMonth || 250;
  const creditsUsed = overview?.usageSummary.creditsUsed ?? 0;
  const actionsCount = overview?.usageSummary.actionsCount ?? 0;
  const usagePercent = Math.min(100, Math.round((creditsUsed / Math.max(planCredits, 1)) * 100));
  const recentArtifacts = selectedProject?.artifacts || [];
  const exportedTestCases = useMemo(() => {
    if (result && typeof result === "object" && "testCases" in result && Array.isArray((result as { testCases: unknown[] }).testCases)) {
      return (result as { testCases: Array<Record<string, string>> }).testCases.map((row) => ({
        "Test Case ID": row.id,
        "Requirement ID": row.requirementId,
        Module: row.module,
        Priority: row.priority,
        Severity: row.severity,
        Owner: row.owner,
        Environment: row.environment,
        "Automation Status": row.automationStatus,
        Dependencies: Array.isArray(row.dependencies) ? row.dependencies.join(" | ") : String(row.dependencies || ""),
        Objective: row.objective,
        Scenario: row.scenario,
        Preconditions: Array.isArray(row.preconditions) ? row.preconditions.join(" | ") : String(row.preconditions || ""),
        "Test Data": Array.isArray(row.testData) ? row.testData.join(" | ") : String(row.testData || ""),
        Steps: Array.isArray(row.steps) ? row.steps.join(" | ") : String(row.steps || ""),
        "Expected Result": row.expectedResult,
        "Negative Coverage": Array.isArray(row.negativeCoverage) ? row.negativeCoverage.join(" | ") : String(row.negativeCoverage || ""),
        "Edge Coverage": Array.isArray(row.edgeCoverage) ? row.edgeCoverage.join(" | ") : String(row.edgeCoverage || ""),
        "Automation Candidate": row.automationCandidate,
        Postconditions: Array.isArray(row.postconditions) ? row.postconditions.join(" | ") : String(row.postconditions || ""),
        "Release Impact": row.releaseImpact,
        "Execution Notes": row.executionNotes,
        Risk: row.risk,
        Tags: Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags || ""),
        Type: row.type,
      }));
    }
    return [];
  }, [result]);

  async function loadOverview(preferredProjectId?: string) {
    try {
      const data = await apiRequest<OverviewPayload>("/dashboard/overview");
      setOverview(data);
      setSelectedProjectId((current) => preferredProjectId || current || data.projects[0]?.id || "");
    } catch {
      router.push("/login");
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  async function createProject() {
    if (!projectName.trim()) {
      setMessage("Give the project a clear name before creating it.");
      return;
    }
    setCreatingProject(true);
    setMessage("");
    try {
      const response = await apiRequest<{ project: { id: string } }>("/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectName, description: projectDescription }),
      });
      setProjectName("");
      setProjectDescription("");
      setMessage("Project created successfully.");
      await loadOverview(response.project.id);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Project creation failed.";
      setMessage(toUserFacingErrorMessage(rawMessage, overview?.user.role));
    } finally {
      setCreatingProject(false);
    }
  }

  async function sendMultipart(path: string, fields: Record<string, string>, file?: File | null) {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
    if (file) formData.append("file", file);
    return apiRequest(path, { method: "POST", body: formData });
  }

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setLoading(true);
    setMessage("");
    try {
      setResult(await action());
      await loadOverview();
      setMessage(successMessage);
    } catch (error) {
      setResult(null);
      const rawMessage = error instanceof Error ? error.message : "Action failed.";
      setMessage(toUserFacingErrorMessage(rawMessage, overview?.user.role));
    } finally {
      setLoading(false);
    }
  }

  async function downloadAuditPdf(data: Record<string, unknown>, label: string, reportContext?: ReportContext) {
    try {
      const blob = await apiDownload("/ai/report-pdf", {
        method: "POST",
        body: JSON.stringify({
          result: data,
          label,
          generatedAt: new Date().toISOString(),
          ...reportContext,
        }),
      });

      const sanitized = label.toLowerCase().replace(/\s+/g, "-");
      downloadBlob(blob, `qa-copilot-${sanitized}-report.pdf`);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Report download failed.";
      setMessage(toUserFacingErrorMessage(rawMessage, overview?.user.role));
    }
  }

  const reportContext: ReportContext = useMemo(() => {
    if (section === "content-match") {
      return {
        pageUrl: publishedUrl.trim() || undefined,
        sourceName: contentMatchFile?.name,
        referenceType,
      };
    }

    if (section === "design-match") {
      return {
        pageUrl: liveDesignUrl.trim() || undefined,
        sourceName: designMatchFile?.name,
        referenceType: "design",
      };
    }

    if (section === "bulk-url-qa") {
      return {
        pageUrl: bulkUrls
          .split(/\r?\n/)
          .map((entry) => entry.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join(", ") || undefined,
        referenceType: "bulk urls",
      };
    }

    return {};
  }, [section, publishedUrl, contentMatchFile, referenceType, liveDesignUrl, designMatchFile, bulkUrls]);

  function renderProjectWorkspace() {
    return (
      <Card className="p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-muted)] p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Project workspace</p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">Select the project for this QA run</h3>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              Every generated asset is tied to the selected project. Users can switch projects here or create a new one before running the flow.
            </p>
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-[var(--foreground)]">Current project</span>
                <select
                  value={selectedProject?.id || ""}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)]"
                >
                  <option value="" disabled>
                    {overviewData.projects.length ? "Choose a project" : "No projects yet"}
                  </option>
                  {overviewData.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                {selectedProject
                  ? `Selected project: ${selectedProject.name}${selectedProject.description ? ` - ${selectedProject.description}` : ""}`
                  : "Create your first project below to start organizing QA outputs."}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-muted)] p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Add project</p>
            <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">Create a new project</h3>
            <div className="mt-5 space-y-3">
              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Project name"
              />
              <Textarea
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Short description, release goal, or module scope"
                className="min-h-28"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void createProject()} disabled={creatingProject || !projectName.trim()}>
                  {creatingProject ? "Creating project..." : "Add project"}
                </Button>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  {overviewData.projects.length} active {overviewData.projects.length === 1 ? "project" : "projects"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  function renderContent() {
    if (section === "overview") {
      return (
        <div className="space-y-6">
          <Card className="p-8">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Welcome back</p>
            <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">Hi, {overviewData.user.name.split(" ")[0]}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                  Your workspace is ready. Review credits, usage, and recent activity at a glance.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--foreground)]">
                  {overviewData.user.subscription?.plan.name || "Starter"} plan
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm capitalize text-emerald-100">
                  {overviewData.user.subscription?.status || "active"}
                </div>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-6"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Credits remaining</p><p className="mt-4 text-5xl font-semibold tracking-tight text-[var(--foreground)]">{safeCreditsLeft}</p></Card>
            <Card className="p-6"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Credits used</p><p className="mt-4 text-5xl font-semibold tracking-tight text-[var(--foreground)]">{creditsUsed}</p></Card>
            <Card className="p-6"><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Actions</p><p className="mt-4 text-5xl font-semibold tracking-tight text-[var(--foreground)]">{actionsCount}</p></Card>
          </div>

          <Card className="p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Recent activity</p>
            <div className="mt-5 space-y-3">
              {(overviewData.recentActivity || []).slice(0, 5).map((activity) => (
                <div key={activity.id} className="rounded-[18px] border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{activity.action}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{formatDate(activity.createdAt)}</p>
                    </div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{activity.creditsUsed} credits</p>
                  </div>
                </div>
              ))}
              {!overviewData.recentActivity.length ? <div className="rounded-[18px] border border-dashed border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-6 text-sm text-[var(--muted-foreground)]">No recent activity yet.</div> : null}
            </div>
          </Card>
          {renderProjectWorkspace()}
        </div>
      );
    }

    if (section === "test-cases") {
      return (
        <Card className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Requirement source</p>
                <Input className="mt-4" type="file" accept=".pdf,.docx,.txt" onChange={(event) => setRequirementFile(event.target.files?.[0] || null)} />
                {requirementFile ? <p className="mt-3 text-sm text-cyan-100">Attached: {requirementFile.name}</p> : null}
              </div>
              <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Requirement details</p>
                <Textarea className="mt-4 min-h-52" value={requirementText} onChange={(event) => setRequirementText(event.target.value)} placeholder="Describe the feature, acceptance criteria, business rules, user roles, and edge cases you want covered." />
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Readiness</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">Project: {selectedProject?.name || "No project selected"}</div>
                  <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">Requirement text: {requirementText.trim() ? "Ready" : "Missing"}</div>
                  <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">Supporting file: {requirementFile ? "Attached" : "Optional"}</div>
                </div>
              </div>
              <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-sm font-medium text-white">Actions</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => runAction(() => sendMultipart("/ai/test-cases", { content: requirementText, projectId: selectedProjectId }, requirementFile), "Premium test case pack generated successfully.")} disabled={loading || (!requirementText.trim() && !requirementFile)}>{loading ? "Generating..." : "Generate premium test cases"}</Button>
                  {exportedTestCases.length ? <Button variant="secondary" onClick={() => exportSpreadsheet(exportedTestCases, "qa-copilot-test-cases", "csv")}>Export CSV</Button> : null}
                  {result && typeof result === "object" ? <Button variant="secondary" onClick={() => exportQaPackWorkbook(result as Record<string, unknown>, "qa-copilot-enterprise-qa-pack")}>Export Excel</Button> : null}
                  {result && typeof result === "object" ? <Button variant="secondary" onClick={() => exportQaPackWorkbook(result as Record<string, unknown>, "qa-copilot-enterprise-qa-pack")}>Export QA Pack</Button> : null}
                  {result && typeof result === "object" ? <Button variant="secondary" onClick={() => exportRoleWorkbook(result as Record<string, unknown>, "qa-copilot-qa-lead-pack", "qa-lead")}>Export QA Lead Pack</Button> : null}
                  {result && typeof result === "object" ? <Button variant="secondary" onClick={() => exportRoleWorkbook(result as Record<string, unknown>, "qa-copilot-automation-pack", "automation")}>Export Automation Pack</Button> : null}
                  {result && typeof result === "object" ? <Button variant="secondary" onClick={() => exportRoleWorkbook(result as Record<string, unknown>, "qa-copilot-business-uat-pack", "business-uat")}>Export Business UAT Pack</Button> : null}
                  {result ? <Button variant="secondary" onClick={() => exportJsonFile(result, "qa-copilot-test-cases.json")}>Export JSON</Button> : null}
                </div>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (section === "automation") {
      return (
        <Card className="space-y-4">
          <select value={automationFramework} onChange={(event) => setAutomationFramework(event.target.value)} className="rounded-2xl border border-white/12 bg-slate-950/60 px-4 py-3 text-sm text-white">
            <option value="selenium">Selenium (Python)</option>
            <option value="playwright">Playwright</option>
            <option value="cypress">Cypress</option>
          </select>
          <Textarea value={automationText} onChange={(event) => setAutomationText(event.target.value)} placeholder="Describe the validated manual flow, assertions, and setup notes." />
          <Button onClick={() => runAction(() => apiRequest("/ai/automation", { method: "POST", body: JSON.stringify({ content: automationText, framework: automationFramework, projectId: selectedProjectId }) }), "Automation draft generated successfully.")} disabled={loading || !automationText.trim()}>Generate script</Button>
        </Card>
      );
    }

    if (section === "bug") {
      return (
        <Card className="space-y-4">
          <Textarea value={bugInput} onChange={(event) => setBugInput(event.target.value)} placeholder="Paste logs, stack traces, reproduction clues, or screenshot context." />
          <Button onClick={() => runAction(() => apiRequest("/ai/bug-analyzer", { method: "POST", body: JSON.stringify({ content: bugInput, projectId: selectedProjectId }) }), "Bug analysis is ready.")} disabled={loading || !bugInput.trim()}>Analyze bug</Button>
        </Card>
      );
    }

    if (section === "test-data") {
      return (
        <Card className="space-y-4">
          <Input type="file" accept=".xlsx,.xls,.csv,.txt,.json" onChange={(event) => setTestDataFile(event.target.files?.[0] || null)} />
          {testDataFile ? <p className="text-sm text-[var(--muted-foreground)]">Attached: {testDataFile.name}</p> : null}
          <Input value={recordCount} onChange={(event) => setRecordCount(event.target.value)} placeholder="Number of records" />
          <Textarea value={testDataPrompt} onChange={(event) => setTestDataPrompt(event.target.value)} placeholder="Describe the records and data rules you need." />
          <Button onClick={() => runAction(() => sendMultipart("/ai/test-data", { prompt: testDataPrompt, recordCount: String(Number(recordCount || 5)), projectId: selectedProjectId }, testDataFile), "Test data generated successfully.")} disabled={loading || (!testDataPrompt.trim() && !testDataFile)}>Generate test data</Button>
        </Card>
      );
    }

    if (section === "test-report") {
      return (
        <Card className="space-y-4">
          <Input type="file" accept=".pdf,.docx,.txt,.csv,.xlsx,.xls" onChange={(event) => setReportFile(event.target.files?.[0] || null)} />
          <Textarea value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="Paste test execution results and QA notes." />
          <Button onClick={() => runAction(() => sendMultipart("/ai/test-report", { content: reportText, projectId: selectedProjectId }, reportFile), "Test report generated successfully.")} disabled={loading || (!reportText.trim() && !reportFile)}>Generate report</Button>
        </Card>
      );
    }

    if (section === "api-tests") {
      return (
        <Card className="space-y-4">
          <Input type="file" accept=".json,.txt,.yaml,.yml" onChange={(event) => setApiFile(event.target.files?.[0] || null)} />
          <Textarea value={apiSpecText} onChange={(event) => setApiSpecText(event.target.value)} placeholder="Paste Swagger or OpenAPI content." />
          <Button onClick={() => runAction(() => sendMultipart("/ai/api-tests", { content: apiSpecText, projectId: selectedProjectId }, apiFile), "API test pack generated successfully.")} disabled={loading || (!apiSpecText.trim() && !apiFile)}>Generate API tests</Button>
        </Card>
      );
    }

    if (section === "release-risk") {
      return (
        <Card className="space-y-4">
          <Textarea value={releaseRiskText} onChange={(event) => setReleaseRiskText(event.target.value)} placeholder="Paste release notes, test status, and bug counts." />
          <Button onClick={() => runAction(() => apiRequest("/ai/release-risk", { method: "POST", body: JSON.stringify({ content: releaseRiskText, projectId: selectedProjectId }) }), "Release risk assessment generated successfully.")} disabled={loading || !releaseRiskText.trim()}>Analyze release risk</Button>
        </Card>
      );
    }

    if (section === "content-match") {
      return (
        <Card className="space-y-4">
          <Input value={publishedUrl} onChange={(event) => setPublishedUrl(event.target.value)} placeholder="Published URL to validate" />
          <select value={referenceType} onChange={(event) => setReferenceType(event.target.value)} className="rounded-2xl border border-white/12 bg-slate-950/60 px-4 py-3 text-sm text-white">
            <option value="pdf">PDF or document</option>
            <option value="word">Word or DOCX</option>
            <option value="image">Image or screenshot notes</option>
            <option value="cms">CMS content</option>
          </select>
          <Input type="file" accept=".pdf,.docx,.txt,.md,.json,.png,.jpg,.jpeg,.webp" onChange={(event) => setContentMatchFile(event.target.files?.[0] || null)} />
          <Textarea value={referenceContent} onChange={(event) => setReferenceContent(event.target.value)} placeholder="Paste source content or extracted document text." />
          <Textarea value={contentScreenshotNotes} onChange={(event) => setContentScreenshotNotes(event.target.value)} placeholder="Describe screenshot-specific notes if needed." />
          <Input value={competitorUrl} onChange={(event) => setCompetitorUrl(event.target.value)} placeholder="Optional competitor URL" />
          <Button onClick={() => runAction(() => sendMultipart("/ai/content-match", { publishedUrl, referenceType, referenceContent, screenshotDescription: contentScreenshotNotes, competitorUrl, projectId: selectedProjectId }, contentMatchFile), "Content comparison completed successfully.")} disabled={loading || !publishedUrl.trim()}>Run content match</Button>
        </Card>
      );
    }

    if (section === "design-match") {
      return (
        <Card className="space-y-4">
          <Input value={liveDesignUrl} onChange={(event) => setLiveDesignUrl(event.target.value)} placeholder="Live URL to compare against design" />
          <Input type="file" accept=".pdf,.docx,.txt,.md,.json,.png,.jpg,.jpeg,.webp" onChange={(event) => setDesignMatchFile(event.target.files?.[0] || null)} />
          <Textarea value={designReference} onChange={(event) => setDesignReference(event.target.value)} placeholder="Paste Figma notes, annotations, or design requirements." />
          <Input value={componentScope} onChange={(event) => setComponentScope(event.target.value)} placeholder="Optional component scope" />
          <Input value={viewportTargets} onChange={(event) => setViewportTargets(event.target.value)} placeholder="Viewport targets" />
          <Textarea value={designScreenshotNotes} onChange={(event) => setDesignScreenshotNotes(event.target.value)} placeholder="Implementation notes or screenshot context." />
          <Button onClick={() => runAction(() => sendMultipart("/ai/design-match", { liveUrl: liveDesignUrl, designReference, componentScope, viewportTargets, screenshotDescription: designScreenshotNotes, projectId: selectedProjectId }, designMatchFile), "Design comparison completed successfully.")} disabled={loading || !liveDesignUrl.trim()}>Run design match</Button>
        </Card>
      );
    }

    if (section === "bulk-url-qa") {
      return (
        <Card className="space-y-4">
          <Textarea value={bulkUrls} onChange={(event) => setBulkUrls(event.target.value)} placeholder="Paste one URL per line or add sitemap targets." />
          <Textarea value={deploymentContext} onChange={(event) => setDeploymentContext(event.target.value)} placeholder="Describe the release or environment context." />
          <Textarea value={workflowNotes} onChange={(event) => setWorkflowNotes(event.target.value)} placeholder="Add workflow expectations for QA, design, or engineering." />
          <Button onClick={() => runAction(() => apiRequest("/ai/bulk-url-qa", { method: "POST", body: JSON.stringify({ urls: bulkUrls, deploymentContext, workflowNotes, projectId: selectedProjectId }) }), "Bulk URL QA completed successfully.")} disabled={loading || !bulkUrls.trim()}>Run bulk URL QA</Button>
        </Card>
      );
    }

    return null;
  }

  if (!overview) return <p className="text-sm text-slate-300">Loading workspace...</p>;

  const overviewData = overview;

  return (
    <main className="pb-14">
      <div className="grid gap-8 xl:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card className="bg-[var(--sidebar-bg)] p-5">
            <Logo compact />
          </Card>

          <Card className="space-y-6 bg-[var(--sidebar-bg)] p-5">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">{group.title}</p>
                <div className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                        item.id === section
                          ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[var(--shadow-soft)]"
                          : "border-[var(--surface-border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </aside>

        <section className="space-y-8">
          {section === "overview" ? (
            <div key={section}>{renderContent()}</div>
          ) : (
            <>
              <Card className="overflow-hidden p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">{overviewData.user.subscription?.plan.name || "Starter"} plan</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">{currentSection.title}</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{currentSection.desc}</p>
                  </div>
                  {loading ? <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--foreground)]"><LoaderCircle className="h-4 w-4 animate-spin" />Generating</div> : null}
                </div>
              </Card>

              {renderProjectWorkspace()}

              <div key={section}>{renderContent()}</div>

              <Card className="p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Generated QA assets</p><h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Structured output</h3></div>
                </div>
                {message ? <div className={`mt-5 rounded-[18px] border px-4 py-4 text-sm ${message.toLowerCase().includes("successfully") ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-rose-300/20 bg-rose-400/10 text-rose-100"}`}>{message}</div> : null}
                <div className="mt-6">
                  <FriendlyResult
                    result={result}
                    label={currentSection.label}
                    reportContext={reportContext}
                    onDownloadPdf={downloadAuditPdf}
                  />
                </div>
              </Card>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
