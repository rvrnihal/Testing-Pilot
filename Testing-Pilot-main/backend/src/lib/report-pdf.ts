import { chromium } from "playwright-chromium";

type ReportContext = {
  label?: string;
  pageUrl?: string;
  sourceName?: string;
  referenceType?: string;
  generatedAt?: string;
};

type Severity = "High" | "Medium" | "Low";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";

      const values = Object.values(item as Record<string, unknown>)
        .filter((entry) => typeof entry === "string" || typeof entry === "number")
        .map((entry) => String(entry).trim())
        .filter(Boolean);

      return values.join(" | ");
    })
    .filter(Boolean);
}

function toObjectList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
}

function toSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function clampScore(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferSeverity(value: string): Severity {
  const normalized = value.toLowerCase();
  if (/(missing|critical|failure|blocked|broken|incorrect|mismatch|misleading|not visible|compliance|security|accessibility)/.test(normalized)) {
    return "High";
  }
  if (/(partial|drift|review|weak|inconsistent|sparse|limited|needs|medium)/.test(normalized)) {
    return "Medium";
  }
  return "Low";
}

function severityBadge(severity: Severity) {
  return `<span class="severity severity-${severity.toLowerCase()}">${escapeHtml(severity)}</span>`;
}

function summarizeLabel(label?: string) {
  if (!label) return "QA Audit";
  if (/content/i.test(label)) return "Content Comparison Audit";
  if (/design/i.test(label)) return "Design Fidelity Audit";
  return `${label} Audit`;
}

function scoreTone(score: number | null) {
  if (score === null) return "neutral";
  if (score >= 85) return "good";
  if (score >= 60) return "warn";
  return "risk";
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (/(comparable|aligned|matched|stable)/.test(normalized)) return "good";
  if (/(partial|review|needs)/.test(normalized)) return "warn";
  return "risk";
}

function confidenceTone(confidence: string) {
  const normalized = confidence.toLowerCase();
  if (normalized === "high") return "good";
  if (normalized === "medium") return "warn";
  if (normalized === "low") return "risk";
  return "neutral";
}

function metricRow(metric: string, score: number | null, description: string) {
  return {
    metric,
    score: score === null ? "N/A" : `${score}%`,
    description,
  };
}

function buildMatchedContent(result: Record<string, unknown>) {
  const matchedKeywords = result.relevanceAnalysis && typeof result.relevanceAnalysis === "object"
    ? toTextList((result.relevanceAnalysis as Record<string, unknown>).matchedKeywords)
    : [];

  const headingComparisons = toObjectList(result.headingComparisons)
    .filter((row) => String(row.status || "").toLowerCase() === "matched")
    .map((row) => {
      const source = typeof row.sourceHeading === "string" ? row.sourceHeading : "Matched heading";
      const live = typeof row.liveHeading === "string" ? row.liveHeading : source;
      return `${source} aligned with live heading "${live}".`;
    });

  const combined = [...matchedKeywords.map((keyword) => `Matched keyword theme: ${keyword}`), ...headingComparisons];
  return Array.from(new Set(combined)).slice(0, 6);
}

function buildMissingContentRows(result: Record<string, unknown>) {
  return toTextList(result.missingContent).map((item, index) => ({
    id: index + 1,
    sectionName: item.split(/[:|-]/)[0]?.trim() || `Missing section ${index + 1}`,
    description: toSentence(item),
    severity: inferSeverity(item),
  }));
}

function buildContentDriftRows(result: Record<string, unknown>) {
  return toTextList(result.contentDrift).map((item) => ({
    text: toSentence(item),
    severity: inferSeverity(item),
  }));
}

function buildFormattingIssues(result: Record<string, unknown>) {
  return toTextList(result.formattingInconsistencies).map((item) => ({
    text: toSentence(item),
    severity: inferSeverity(item),
  }));
}

function buildIssueHeatmap(result: Record<string, unknown>) {
  const heatmap = toObjectList(result.issueHeatmap);
  if (heatmap.length) {
    return heatmap.map((entry) => ({
      issueType:
        typeof entry.issueType === "string"
          ? entry.issueType
          : typeof entry.area === "string"
            ? entry.area
            : typeof entry.title === "string"
              ? entry.title
              : "Unspecified Issue",
      count:
        typeof entry.count === "number"
          ? entry.count
          : typeof entry.issueCount === "number"
            ? entry.issueCount
            : 1,
    }));
  }

  return [
    { issueType: "Missing Sections", count: toTextList(result.missingContent).length },
    { issueType: "Partial Content", count: toTextList(result.contentDrift).length },
    { issueType: "Formatting Issues", count: toTextList(result.formattingInconsistencies).length },
  ].filter((entry) => entry.count > 0);
}

function buildBugRows(result: Record<string, unknown>) {
  const bugRows = toObjectList(result.autoBugReports);
  return bugRows.map((entry, index) => {
    const title = typeof entry.title === "string" ? entry.title : `Audit issue ${index + 1}`;
    const description =
      typeof entry.description === "string"
        ? entry.description
        : typeof entry.suggestedFix === "string"
          ? entry.suggestedFix
          : typeof entry.location === "string"
            ? `Review ${entry.location}.`
            : "Follow up on the reported mismatch.";
    const severity = typeof entry.severity === "string"
      ? (titleCase(entry.severity) as Severity)
      : inferSeverity(`${title} ${description}`);

    return {
      id: typeof entry.id === "string" ? entry.id : `BUG-${String(index + 1).padStart(3, "0")}`,
      title,
      description: toSentence(description),
      severity,
    };
  });
}

function buildRecommendations(result: Record<string, unknown>) {
  const recommendations = [
    ...toTextList(result.generatedTickets),
    ...toTextList(result.autoBugReports),
    ...toTextList(result.recommendedNextSteps),
    ...(typeof result.recommendation === "string" ? [result.recommendation] : []),
    ...(typeof result.suggestedFix === "string" ? [result.suggestedFix] : []),
  ]
    .map((item) => toSentence(item))
    .filter(Boolean);

  const unique = Array.from(new Set(recommendations));
  return unique.slice(0, 8);
}

function buildExecutiveSummary(result: Record<string, unknown>, score: number | null, status: string) {
  const providedSummary = typeof result.summary === "string" ? result.summary.trim() : "";
  if (providedSummary) return toSentence(providedSummary);

  const missingCount = toTextList(result.missingContent).length;
  const driftCount = toTextList(result.contentDrift).length;
  const formatCount = toTextList(result.formattingInconsistencies).length;

  return [
    `The audit found an overall alignment score of ${score === null ? "N/A" : `${score}%`} with status marked as ${status || "under review"}.`,
    missingCount
      ? `${missingCount} content gap${missingCount === 1 ? "" : "s"} were identified between the source and the live experience.`
      : "No major missing sections were detected in the reviewed scope.",
    driftCount
      ? `${driftCount} content drift item${driftCount === 1 ? "" : "s"} indicate areas where messaging or detail has diverged from the approved source.`
      : "Messaging alignment remained stable across the compared sections.",
    formatCount
      ? `${formatCount} structural or formatting issue${formatCount === 1 ? "" : "s"} could reduce readability and scanning efficiency.`
      : "Formatting and information hierarchy remained generally consistent.",
    "The final verdict should be treated as an enterprise QA recommendation, prioritizing content accuracy, readability, and release confidence before publication.",
  ].join(" ");
}

function buildConclusion(result: Record<string, unknown>, score: number | null, status: string, confidence: string) {
  const riskLevel = score === null ? "unknown" : score >= 85 ? "low" : score >= 60 ? "moderate" : "elevated";
  const recommendation = buildRecommendations(result)[0] || "Prioritize the highest-severity issues and rerun the comparison after corrections.";

  return [
    `This audit closes with a ${riskLevel} content quality risk assessment,`,
    `supported by a ${confidence || "unrated"} confidence reading and status of ${status || "unspecified"}.`,
    `The comparison highlights a clear opportunity to strengthen content completeness, structural consistency, and search relevance.`,
    recommendation,
  ].join(" ");
}

function renderTable(headers: string[], rows: string[][], className = "") {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");

  return `
    <table class="report-table ${className}">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderBulletList(items: string[]) {
  if (!items.length) {
    return `<p class="muted">No notable items were identified for this section.</p>`;
  }

  return `<ul class="bullet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderNumberedMissing(rows: Array<{ id: number; sectionName: string; description: string; severity: Severity }>) {
  if (!rows.length) {
    return `<p class="muted">No missing sections were recorded in the current result.</p>`;
  }

  return `
    <div class="stack-sm">
      ${rows
        .map(
          (row) => `
            <div class="issue-card">
              <div class="issue-card-header">
                <div class="issue-index">${row.id}</div>
                <div>
                  <div class="issue-title">${escapeHtml(row.sectionName)}</div>
                  <div class="issue-description">${escapeHtml(row.description)}</div>
                </div>
                ${severityBadge(row.severity)}
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSectionDivider() {
  return `<div class="section-divider"></div>`;
}

function buildReportHtml(result: Record<string, unknown>, context: ReportContext) {
  const label = context.label || "QA Audit";
  const reportTitle = summarizeLabel(label);
  const subtitle = context.pageUrl
    ? `Audit generated for ${escapeHtml(context.pageUrl)}`
    : "Professional content comparison and QA audit report";
  const score = clampScore(result.qaScore ?? result.readinessScore);
  const confidence = typeof result.comparisonConfidence === "string" ? result.comparisonConfidence : "Medium";
  const status = typeof result.comparisonStatus === "string" ? result.comparisonStatus : "Comparable";
  const summary = buildExecutiveSummary(result, score, status);
  const relevance = result.relevanceAnalysis && typeof result.relevanceAnalysis === "object"
    ? (result.relevanceAnalysis as Record<string, unknown>)
    : {};
  const metrics = [
    metricRow("Overlap Score", clampScore(relevance.overlapScore), "Content overlap between approved source and live extract."),
    metricRow("Keyword Alignment", clampScore(relevance.keywordAlignmentScore), "Coverage of meaningful source keywords in the live page."),
    metricRow("Heading Alignment", clampScore(relevance.headingAlignmentScore), "Structural similarity of headings and sections."),
    metricRow("Sentence Alignment", clampScore(relevance.sentenceAlignmentScore), "Similarity of sentence-level messaging and phrasing."),
  ];
  const matchedContent = buildMatchedContent(result);
  const missingContent = buildMissingContentRows(result);
  const contentDrift = buildContentDriftRows(result);
  const formattingIssues = buildFormattingIssues(result);
  const heatmap = buildIssueHeatmap(result);
  const autoBugReports = buildBugRows(result);
  const recommendations = buildRecommendations(result);
  const conclusion = buildConclusion(result, score, status, confidence);
  const scoreText = score === null ? "N/A" : `${score}%`;
  const metadataItems = [
    context.sourceName ? `<div><span class="meta-label">Source File</span><span class="meta-value">${escapeHtml(context.sourceName)}</span></div>` : "",
    context.referenceType ? `<div><span class="meta-label">Reference Type</span><span class="meta-value">${escapeHtml(titleCase(context.referenceType))}</span></div>` : "",
    context.pageUrl ? `<div><span class="meta-label">Target URL</span><span class="meta-value url">${escapeHtml(context.pageUrl)}</span></div>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportTitle)}</title>
        <style>
          :root {
            --bg: #0f172a;
            --panel: #ffffff;
            --panel-alt: #f8fafc;
            --text: #0f172a;
            --muted: #475569;
            --border: #d9e2ec;
            --accent: #0f766e;
            --accent-soft: #ccfbf1;
            --good: #166534;
            --good-bg: #dcfce7;
            --warn: #c2410c;
            --warn-bg: #ffedd5;
            --risk: #b91c1c;
            --risk-bg: #fee2e2;
            --neutral: #334155;
            --neutral-bg: #e2e8f0;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: var(--text);
            background: linear-gradient(180deg, #e2e8f0 0%, #f8fafc 180px, #eef2f7 100%);
            line-height: 1.55;
          }
          .page {
            width: 100%;
            padding: 42px 44px 56px;
          }
          .hero {
            background: linear-gradient(135deg, #0f172a, #1e293b 60%, #134e4a);
            color: white;
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
          }
          h1 {
            margin: 0;
            font-size: 28px;
            line-height: 1.2;
          }
          .subtitle {
            margin-top: 10px;
            color: rgba(255, 255, 255, 0.82);
            font-size: 13px;
          }
          .hero-grid {
            margin-top: 28px;
            display: grid;
            grid-template-columns: 1.6fr 1fr;
            gap: 18px;
          }
          .hero-panel, .score-panel {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 18px 20px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px 18px;
          }
          .meta-label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: rgba(255, 255, 255, 0.68);
            margin-bottom: 5px;
          }
          .meta-value {
            display: block;
            font-size: 13px;
            color: white;
            word-break: break-word;
          }
          .score-panel {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            align-content: start;
          }
          .score-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 120px;
            padding: 14px 18px;
            border-radius: 18px;
            font-weight: 700;
            font-size: 28px;
            letter-spacing: -0.03em;
            background: rgba(255, 255, 255, 0.14);
          }
          .status-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 10px;
          }
          .pill {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .tone-good { color: var(--good); background: var(--good-bg); }
          .tone-warn { color: var(--warn); background: var(--warn-bg); }
          .tone-risk { color: var(--risk); background: var(--risk-bg); }
          .tone-neutral { color: var(--neutral); background: var(--neutral-bg); }
          .content {
            margin-top: 28px;
            background: rgba(255, 255, 255, 0.72);
            border: 1px solid rgba(217, 226, 236, 0.7);
            border-radius: 24px;
            padding: 30px 32px;
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          }
          .section {
            margin-top: 36px;
          }
          .section:first-child {
            margin-top: 0;
          }
          .section-divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #cbd5e1 15%, #cbd5e1 85%, transparent);
            margin-top: 34px;
          }
          h2 {
            margin: 0 0 16px;
            font-size: 18px;
            line-height: 1.3;
          }
          h3 {
            margin: 0 0 10px;
            font-size: 15px;
            line-height: 1.4;
          }
          p {
            margin: 0;
            color: var(--text);
            font-size: 12px;
          }
          .summary {
            color: var(--muted);
            font-size: 12.5px;
            max-width: 82ch;
          }
          .two-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
          }
          .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 18px;
          }
          .stack-sm > * + * { margin-top: 12px; }
          .stack-md > * + * { margin-top: 18px; }
          .bullet-list, .drift-list {
            margin: 0;
            padding-left: 18px;
          }
          .bullet-list li, .drift-list li {
            margin: 0 0 10px;
            color: var(--text);
            font-size: 12px;
          }
          .muted {
            color: var(--muted);
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            overflow: hidden;
            border: 1px solid var(--border);
            border-radius: 16px;
            font-size: 11.5px;
          }
          .report-table th {
            text-align: left;
            background: #e6fffa;
            color: #134e4a;
            font-size: 11px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
          }
          .report-table td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
            color: var(--text);
          }
          .report-table tr:last-child td {
            border-bottom: none;
          }
          .issue-card {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--panel);
            padding: 14px 16px;
          }
          .issue-card-header {
            display: grid;
            grid-template-columns: 30px 1fr auto;
            gap: 12px;
            align-items: start;
          }
          .issue-index {
            width: 30px;
            height: 30px;
            border-radius: 999px;
            background: #ecfeff;
            color: #155e75;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
          }
          .issue-title {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .issue-description {
            font-size: 12px;
            color: var(--muted);
          }
          .severity {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 700;
            min-width: 66px;
          }
          .severity-high { color: var(--risk); background: var(--risk-bg); }
          .severity-medium { color: var(--warn); background: var(--warn-bg); }
          .severity-low { color: var(--good); background: var(--good-bg); }
          .footer-note {
            margin-top: 26px;
            padding-top: 14px;
            border-top: 1px solid var(--border);
            font-size: 11px;
            color: var(--muted);
          }
          .url {
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="hero">
            <h1>${escapeHtml(reportTitle)}</h1>
            <div class="subtitle">${subtitle}</div>
            <div class="hero-grid">
              <div class="hero-panel">
                <div class="meta-grid">
                  <div>
                    <span class="meta-label">Generated</span>
                    <span class="meta-value">${escapeHtml(formatDateTime(context.generatedAt))}</span>
                  </div>
                  <div>
                    <span class="meta-label">Report Type</span>
                    <span class="meta-value">${escapeHtml(label)}</span>
                  </div>
                  ${metadataItems}
                </div>
              </div>
              <div class="score-panel">
                <div>
                  <span class="meta-label">Overall Score</span>
                  <div class="score-badge">${escapeHtml(scoreText)}</div>
                </div>
                <div class="status-row">
                  <span class="pill tone-${confidenceTone(confidence)}">Confidence: ${escapeHtml(confidence)}</span>
                  <span class="pill tone-${statusTone(status)}">Status: ${escapeHtml(status)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="content">
            <section class="section">
              <h2>Executive Summary</h2>
              <p class="summary">${escapeHtml(summary)}</p>
            </section>

            ${renderSectionDivider()}

            <section class="section">
              <h2>Relevance Analysis</h2>
              ${renderTable(
                ["Metric", "Score", "Description"],
                metrics.map((metric) => [escapeHtml(metric.metric), escapeHtml(metric.score), escapeHtml(metric.description)]),
              )}
            </section>

            ${renderSectionDivider()}

            <section class="section">
              <h2>Key Findings</h2>
              <div class="two-column">
                <div class="panel">
                  <h3>Matched Content</h3>
                  ${renderBulletList(matchedContent)}
                </div>
                <div class="panel">
                  <h3>Content Drift</h3>
                  ${renderBulletList(contentDrift.map((item) => `[${item.severity}] ${item.text}`))}
                </div>
              </div>
              <div class="panel" style="margin-top: 18px;">
                <h3>Missing Content</h3>
                ${renderNumberedMissing(missingContent)}
              </div>
            </section>

            ${renderSectionDivider()}

            <section class="section">
              <h2>Formatting Issues</h2>
              ${renderBulletList(formattingIssues.map((item) => `[${item.severity}] ${item.text}`))}
            </section>

            ${renderSectionDivider()}

            <section class="section">
              <h2>Issue Heatmap</h2>
              ${renderTable(
                ["Issue Type", "Count"],
                (heatmap.length ? heatmap : [{ issueType: "No tracked issues", count: 0 }]).map((entry) => [
                  escapeHtml(entry.issueType),
                  escapeHtml(String(entry.count)),
                ]),
              )}
            </section>

            ${renderSectionDivider()}

            <section class="section">
              <h2>Auto Bug Reports</h2>
              ${renderTable(
                ["ID", "Title", "Description", "Severity"],
                (autoBugReports.length
                  ? autoBugReports
                  : [{ id: "BUG-000", title: "No auto bug reports", description: "No autogenerated issues were recorded for this result.", severity: "Low" as Severity }])
                  .map((row) => [
                    escapeHtml(row.id),
                    escapeHtml(row.title),
                    escapeHtml(row.description),
                    severityBadge(row.severity),
                  ]),
              )}
            </section>

            ${renderSectionDivider()}

            <section class="section">
              <h2>Recommendations</h2>
              ${renderBulletList(recommendations.length ? recommendations : [
                "Revalidate the live page after applying the identified content and structure updates.",
                "Confirm search-intent coverage and readability across headings, paragraphs, and supporting sections.",
              ])}
            </section>

            ${renderSectionDivider()}

            <section class="section">
              <h2>Conclusion</h2>
              <p class="summary">${escapeHtml(conclusion)}</p>
            </section>

            <div class="footer-note">
              Generated by QA Copilot. This report is formatted for PDF readability and enterprise audit review.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function generateAuditPdfBuffer(result: Record<string, unknown>, context: ReportContext = {}) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(buildReportHtml(result, context), { waitUntil: "load" });
    await page.emulateMedia({ media: "screen" });
    return Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "16px",
          right: "16px",
          bottom: "16px",
          left: "16px",
        },
      }),
    );
  } finally {
    await browser.close();
  }
}
