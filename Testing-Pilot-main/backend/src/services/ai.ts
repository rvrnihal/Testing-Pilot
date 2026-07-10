import { ArtifactType, type Prisma, type User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateAiJson } from "../lib/openai";
import { captureLivePageStructure, compareVisualReferences } from "../lib/visual-qa";

const creditCosts: Record<string, number> = {
  generateTestCases: 10,
  generateAutomation: 8,
  analyzeBug: 5,
  generateTestData: 4,
  generateTestReport: 6,
  executeTestCases: 12,
  generateApiTests: 9,
  analyzeReleaseRisk: 7,
  analyzeContentMatch: 12,
  analyzeDesignMatch: 14,
  analyzeBulkUrlQa: 18,
};

async function loadWebsiteTestExecutor() {
  const module = await import("../lib/test-execution");
  return module.executeWebsiteTestCases;
}

async function spendCredits(user: User, action: keyof typeof creditCosts, projectId?: string) {
  const cost = creditCosts[action];
  const normalizedProjectId = projectId?.trim() ? projectId : undefined;

  if (user.creditsBalance < cost) {
    throw new Error("Not enough credits remaining.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      creditsBalance: {
        decrement: cost,
      },
    },
  });

  await prisma.usageEvent.create({
    data: {
      userId: user.id,
      projectId: normalizedProjectId,
      action,
      creditsUsed: cost,
    },
  });

  return cost;
}

async function storeArtifact({
  projectId,
  type,
  title,
  sourceName,
  inputText,
  outputText,
  outputJson,
}: {
  projectId?: string;
  type: ArtifactType;
  title: string;
  sourceName?: string;
  inputText?: string;
  outputText?: string;
  outputJson?: Prisma.InputJsonValue;
}) {
  const normalizedProjectId = projectId?.trim() ? projectId : undefined;

  if (!normalizedProjectId) {
    return;
  }

  await prisma.projectArtifact.create({
    data: {
      projectId: normalizedProjectId,
      type,
      title,
      sourceName,
      inputText,
      outputText,
      outputJson,
    },
  });
}

function countMatchingCases(
  testCases: Array<Record<string, unknown>>,
  keywords: string[],
) {
  return testCases.filter((testCase) => {
    const searchable = [
      typeof testCase.module === "string" ? testCase.module : "",
      typeof testCase.scenario === "string" ? testCase.scenario : "",
      typeof testCase.objective === "string" ? testCase.objective : "",
      Array.isArray(testCase.tags) ? testCase.tags.join(" ") : typeof testCase.tags === "string" ? testCase.tags : "",
    ]
      .join(" ")
      .toLowerCase();

    return keywords.some((keyword) => searchable.includes(keyword));
  }).length;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

type ExecutionRow = {
  id: string;
  title: string;
  statusRaw: string;
  status: "passed" | "failed" | "blocked" | "not_executed" | "unknown";
  actualResult: string;
  remarks: string;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeColumnName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getStringField(record: Record<string, unknown>, candidates: string[]) {
  for (const [key, rawValue] of Object.entries(record)) {
    const normalizedKey = normalizeColumnName(key);
    if (!candidates.includes(normalizedKey)) continue;
    if (rawValue === null || rawValue === undefined) continue;
    const value = String(rawValue).trim();
    if (value) return value;
  }

  return "";
}

function normalizeExecutionStatus(value: string): ExecutionRow["status"] {
  const normalized = value.toLowerCase().trim();

  if (!normalized) return "unknown";
  if (
    normalized.includes("pass") ||
    normalized === "ok" ||
    normalized === "success" ||
    normalized === "completed"
  ) {
    return "passed";
  }

  if (
    normalized.includes("fail") ||
    normalized.includes("defect") ||
    normalized.includes("error") ||
    normalized.includes("issue")
  ) {
    return "failed";
  }

  if (
    normalized.includes("block") ||
    normalized.includes("hold") ||
    normalized.includes("pending dependency") ||
    normalized.includes("awaiting")
  ) {
    return "blocked";
  }

  if (
    normalized.includes("not executed") ||
    normalized.includes("not run") ||
    normalized.includes("not started") ||
    normalized.includes("todo") ||
    normalized.includes("skip")
  ) {
    return "not_executed";
  }

  return "unknown";
}

function parseCsvExecutionRows(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || !lines[0].includes(",")) {
    return [] as ExecutionRow[];
  }

  const headers = parseCsvLine(lines[0]);
  const normalizedHeaders = headers.map((header) => normalizeColumnName(header));
  const hasStatusColumn = normalizedHeaders.some((header) =>
    [
      "status",
      "execution status",
      "result",
      "execution result",
      "test result",
      "outcome",
    ].includes(header),
  );

  if (!hasStatusColumn) {
    return [] as ExecutionRow[];
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ""]));
    const statusRaw = getStringField(row, [
      "execution status",
      "status",
      "result",
      "execution result",
      "test result",
      "outcome",
    ]);

    return {
      id:
        getStringField(row, ["test case id", "id", "tc id", "test id", "case id"]) ||
        `ROW-${index + 1}`,
      title:
        getStringField(row, ["title", "scenario", "test case", "test case title", "module"]) ||
        `Execution row ${index + 1}`,
      statusRaw,
      status: normalizeExecutionStatus(statusRaw),
      actualResult: getStringField(row, ["actual result", "actual", "observation", "observed result"]),
      remarks: getStringField(row, ["remarks", "comment", "comments", "notes"]),
    };
  });
}

function parseStructuredExecutionRows(input: string) {
  try {
    const parsed = JSON.parse(input) as {
      rows?: Array<Record<string, unknown>>;
      workbookSheets?: Array<{ sheetName?: string; rows?: Array<Record<string, unknown>> }>;
    };

    const rowSets: Array<Record<string, unknown>> = [];
    if (Array.isArray(parsed.rows)) {
      rowSets.push(...parsed.rows);
    }
    if (Array.isArray(parsed.workbookSheets)) {
      for (const sheet of parsed.workbookSheets) {
        if (Array.isArray(sheet.rows)) {
          rowSets.push(...sheet.rows);
        }
      }
    }

    return rowSets
      .map((row, index) => {
        const statusRaw = getStringField(row, [
          "execution status",
          "status",
          "result",
          "execution result",
          "test result",
          "outcome",
        ]);

        if (!statusRaw) return null;

        return {
          id:
            getStringField(row, ["test case id", "id", "tc id", "test id", "case id"]) ||
            `ROW-${index + 1}`,
          title:
            getStringField(row, ["title", "scenario", "test case", "test case title", "module"]) ||
            `Execution row ${index + 1}`,
          statusRaw,
          status: normalizeExecutionStatus(statusRaw),
          actualResult: getStringField(row, ["actual result", "actual", "observation", "observed result"]),
          remarks: getStringField(row, ["remarks", "comment", "comments", "notes"]),
        } satisfies ExecutionRow;
      })
      .filter((row): row is ExecutionRow => Boolean(row));
  } catch {
    return [] as ExecutionRow[];
  }
}

function summarizeExecutionRows(rows: ExecutionRow[], sourceName?: string) {
  const passed = rows.filter((row) => row.status === "passed");
  const failed = rows.filter((row) => row.status === "failed");
  const blocked = rows.filter((row) => row.status === "blocked");
  const notExecuted = rows.filter((row) => row.status === "not_executed");
  const unknown = rows.filter((row) => row.status === "unknown");
  const executedCount = passed.length + failed.length + blocked.length;
  const passRate = executedCount ? Math.round((passed.length / executedCount) * 100) : 0;

  const criticalIssues = [...failed, ...blocked]
    .slice(0, 8)
    .map(
      (row) =>
        `${row.id} - ${row.title}: ${row.actualResult || row.remarks || row.statusRaw || "Execution issue recorded."}`,
    );

  const blockers = blocked.map(
    (row) => `${row.id} - ${row.title}: ${row.remarks || row.actualResult || "Blocked during execution."}`,
  );

  const defectSummary = [
    `Total rows parsed: ${rows.length}`,
    `Executed: ${executedCount}`,
    `Passed: ${passed.length}`,
    `Failed: ${failed.length}`,
    `Blocked: ${blocked.length}`,
    `Not executed / skipped: ${notExecuted.length}`,
    unknown.length ? `Unknown status rows: ${unknown.length}` : "",
  ].filter(Boolean);

  const recommendation =
    failed.length || blocked.length
      ? "Retest the failed and blocked cases after fixes, then regenerate the execution report with the updated run evidence."
      : "Execution evidence is clean. Preserve this run as release evidence and attach it to sign-off.";

  const goNoGoRecommendation =
    blocked.length > 0 || failed.length >= 3
      ? "No-Go"
      : failed.length > 0
        ? "Conditional Go"
        : executedCount > 0
          ? "Go"
          : "Needs Evidence";

  const releaseRecommendation =
    goNoGoRecommendation === "No-Go"
      ? "Do not release until blocked and failed scenarios are resolved and rerun evidence is attached."
      : goNoGoRecommendation === "Conditional Go"
        ? "Release only if the failed scenarios are non-blocking, documented, and explicitly accepted by stakeholders."
        : goNoGoRecommendation === "Go"
          ? "Release can proceed based on the supplied execution evidence."
          : "Provide an execution sheet with pass, fail, blocked, or not-executed statuses before making a release decision.";

  const summary =
    executedCount > 0
      ? `Executed ${executedCount} cases from ${sourceName || "the supplied run evidence"}: ${passed.length} passed, ${failed.length} failed, ${blocked.length} blocked, and ${notExecuted.length} remain not executed.`
      : `The supplied report data did not contain enough executed-case rows to build a reliable execution summary.`;

  return {
    summary,
    passRate: `${passRate}% (${passed.length}/${Math.max(executedCount, 1)})`,
    goNoGoRecommendation,
    releaseRecommendation,
    criticalIssues,
    blockers,
    defectSummary,
    evidenceRequired: [
      sourceName ? `Source execution file: ${sourceName}` : "Source execution notes or file should be attached.",
      failed.length || blocked.length ? "Attach rerun evidence for every failed or blocked case." : "Keep this executed report as release evidence.",
    ],
    stakeholderActions: [
      recommendation,
      failed.length ? "Validate fixes for all failed scenarios." : "No failed scenarios require immediate triage.",
      blocked.length ? "Remove external blockers and rerun blocked cases." : "No blocked cases were detected in the parsed rows.",
    ],
    recommendation,
    testCases: rows.map((row) => `${row.id} - ${row.title}: ${row.statusRaw || row.status}`),
    executionBreakdown: {
      totalRows: rows.length,
      executed: executedCount,
      passed: passed.length,
      failed: failed.length,
      blocked: blocked.length,
      notExecuted: notExecuted.length,
      unknown: unknown.length,
    },
  };
}

function normalizeComparisonText(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u00ad]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenizeText(input: string) {
  return normalizeComparisonText(input)
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

const comparisonStopWords = new Set([
  "about",
  "after",
  "again",
  "against",
  "almost",
  "also",
  "among",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "could",
  "does",
  "doing",
  "during",
  "each",
  "from",
  "have",
  "having",
  "here",
  "into",
  "itself",
  "just",
  "more",
  "most",
  "only",
  "other",
  "over",
  "same",
  "should",
  "such",
  "than",
  "that",
  "their",
  "theirs",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "page",
  "pages",
  "content",
  "section",
  "sections",
  "source",
  "live",
  "using",
  "into",
  "will",
  "were",
  "been",
  "they",
]);

function getMeaningfulTokens(input: string) {
  return tokenizeText(input).filter((word) => word.length >= 4 && !comparisonStopWords.has(word));
}

function summarizeText(input: string, maxLength = 180) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function looksLikeHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) {
    return false;
  }

  if (/[:.!?]$/.test(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 12) {
    return false;
  }

  const titleCaseWords = words.filter((word) => /^[A-Z][a-z0-9/-]+$/.test(word));
  const upperWords = words.filter((word) => /^[A-Z0-9\s/&-]+$/.test(word));
  return titleCaseWords.length >= Math.ceil(words.length / 2) || upperWords.length === words.length;
}

function extractSourceSections(source: string) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    if (looksLikeHeading(line)) {
      if (currentHeading || currentContent.length) {
        sections.push({
          heading: currentHeading || `Section ${sections.length + 1}`,
          content: summarizeText(currentContent.join(" ")),
        });
      }
      currentHeading = line;
      currentContent = [];
      continue;
    }

    currentContent.push(line);
  }

  if (currentHeading || currentContent.length) {
    sections.push({
      heading: currentHeading || `Section ${sections.length + 1}`,
      content: summarizeText(currentContent.join(" ")),
    });
  }

  if (!sections.length && source.trim()) {
    const paragraphs = source
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 6);

    return paragraphs.map((paragraph, index) => ({
      heading: summarizeText(paragraph.split(/[.!?]/)[0] || `Section ${index + 1}`, 70) || `Section ${index + 1}`,
      content: summarizeText(paragraph),
    }));
  }

  return sections.slice(0, 8);
}

function splitParagraphs(input: string, limit = 4) {
  return input
    .split(/\n\s*\n/)
    .map((part) => summarizeText(part, 220))
    .filter(Boolean)
    .slice(0, limit);
}

function extractHtmlTextMatches(html: string, pattern: RegExp) {
  const matches = [...html.matchAll(pattern)];
  return matches
    .map((match) => decodeHtmlEntities(stripHtml(match[0])))
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractLiveHeadings(html: string) {
  const unique: string[] = [];

  for (const heading of extractHtmlTextMatches(html, /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi)) {
    const normalized = heading.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }

    if (!unique.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
      unique.push(normalized);
    }
  }

  return unique.slice(0, 12);
}

function extractLiveSections(html: string) {
  const headings = extractLiveHeadings(html);
  const paragraphs = extractHtmlTextMatches(html, /<(p|li)[^>]*>[\s\S]*?<\/(p|li)>/gi).filter((item) => item.length > 20);

  if (!headings.length) {
    return paragraphs.slice(0, 8).map((content, index) => ({
      heading: `Live section ${index + 1}`,
      content: summarizeText(content),
    }));
  }

  return headings.slice(0, 8).map((heading, index) => ({
    heading,
    content: summarizeText(paragraphs[index] || ""),
  }));
}

function similarityScore(left: string, right: string) {
  const leftTokens = new Set(tokenizeText(left));
  const rightTokens = new Set(tokenizeText(right));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function matchLiveSection(
  sourceSection: { heading: string; content: string },
  liveSections: Array<{ heading: string; content: string }>,
) {
  const ranked = liveSections
    .map((liveSection) => ({
      liveSection,
      score:
        similarityScore(sourceSection.heading, liveSection.heading) * 0.55 +
        similarityScore(sourceSection.content, liveSection.content) * 0.45,
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0] || null;
}

function topUniqueWords(source: string, live: string, limit = 8) {
  const liveSet = new Set(tokenizeText(live));
  const counts = new Map<string, number>();

  for (const word of tokenizeText(source)) {
    if (!liveSet.has(word)) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function topSharedWords(source: string, live: string, limit = 8) {
  const sourceSet = new Set(tokenizeText(source));
  const counts = new Map<string, number>();

  for (const word of tokenizeText(live)) {
    if (sourceSet.has(word)) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function chunkSentences(input: string, limit = 12) {
  return input
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30)
    .slice(0, limit);
}

function computeTokenOverlapScore(source: string, live: string) {
  const sourceTokens = new Set(tokenizeText(source));
  const liveTokens = new Set(tokenizeText(live));

  if (!sourceTokens.size || !liveTokens.size) {
    return 0;
  }

  let intersection = 0;
  sourceTokens.forEach((token) => {
    if (liveTokens.has(token)) {
      intersection += 1;
    }
  });

  return Math.round((intersection / sourceTokens.size) * 100);
}

function extractTopKeywords(input: string, limit = 12) {
  const counts = new Map<string, number>();

  for (const token of getMeaningfulTokens(input)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token);
}

function computeKeywordAlignment(source: string, live: string, limit = 12) {
  const sourceKeywords = extractTopKeywords(source, limit);
  const liveTokens = new Set(getMeaningfulTokens(live));

  if (!sourceKeywords.length) {
    return {
      score: 0,
      matchedKeywords: [] as string[],
      sourceKeywords,
    };
  }

  const matchedKeywords = sourceKeywords.filter((keyword) => liveTokens.has(keyword));

  return {
    score: Math.round((matchedKeywords.length / sourceKeywords.length) * 100),
    matchedKeywords,
    sourceKeywords,
  };
}

function computeDistinctiveKeywordAlignment(source: string, live: string, limit = 8) {
  const distinctiveKeywords = extractTopKeywords(source, limit).filter((keyword) => keyword.length >= 6);
  const liveTokens = new Set(getMeaningfulTokens(live));
  const matchedDistinctiveKeywords = distinctiveKeywords.filter((keyword) => liveTokens.has(keyword));

  return {
    score: distinctiveKeywords.length ? Math.round((matchedDistinctiveKeywords.length / distinctiveKeywords.length) * 100) : 0,
    distinctiveKeywords,
    matchedDistinctiveKeywords,
  };
}

function computeHeadingAlignment(
  sourceSections: Array<{ heading: string; content: string }>,
  liveSections: Array<{ heading: string; content: string }>,
) {
  if (!sourceSections.length || !liveSections.length) {
    return 0;
  }

  const scores = sourceSections.slice(0, 6).map((section) => {
    const match = matchLiveSection(section, liveSections);
    return Math.round(((match?.score ?? 0) * 100));
  });

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1));
}

function buildContentRelevanceAssessment({
  referenceContent,
  livePageText,
  sourceSections,
  liveSections,
  extractionSucceeded,
}: {
  referenceContent: string;
  livePageText: string;
  sourceSections: Array<{ heading: string; content: string }>;
  liveSections: Array<{ heading: string; content: string }>;
  extractionSucceeded: boolean;
}) {
  if (!extractionSucceeded) {
    return {
      isComparable: false,
      confidence: "Low",
      weightedScore: 0,
      overlapScore: 0,
      keywordAlignmentScore: 0,
      distinctiveKeywordAlignmentScore: 0,
      headingAlignmentScore: 0,
      sentenceAlignmentScore: 0,
      matchedKeywords: [] as string[],
      sourceKeywords: extractTopKeywords(referenceContent, 12),
      distinctiveKeywords: extractTopKeywords(referenceContent, 8).filter((keyword) => keyword.length >= 6),
      matchedDistinctiveKeywords: [] as string[],
      reason: "The live page text could not be extracted reliably, so semantic comparison could not be performed.",
    };
  }

  const overlapScore = computeTokenOverlapScore(referenceContent, livePageText);
  const keywordAlignment = computeKeywordAlignment(referenceContent, livePageText);
  const distinctiveKeywordAlignment = computeDistinctiveKeywordAlignment(referenceContent, livePageText);
  const headingAlignmentScore = computeHeadingAlignment(sourceSections, liveSections);
  const referenceSentences = chunkSentences(referenceContent, 6);
  const liveSentences = chunkSentences(livePageText, 12);
  const sentenceAlignmentScore =
    referenceSentences.length > 0
      ? Math.round(
          referenceSentences.reduce((sum, sentence) => sum + Math.max(...liveSentences.map((liveSentence) => similarityScore(sentence, liveSentence)), 0), 0) /
            Math.max(referenceSentences.length, 1) *
            100,
        )
      : 0;

  const weightedScore = Math.round(
    overlapScore * 0.25 +
      keywordAlignment.score * 0.2 +
      distinctiveKeywordAlignment.score * 0.35 +
      headingAlignmentScore * 0.2 +
      sentenceAlignmentScore * 0.1,
  );

  const confidence =
    weightedScore >= 72
      ? "High"
      : weightedScore >= 48
        ? "Medium"
        : "Low";

  const isComparable =
    weightedScore >= 52 &&
    (
      distinctiveKeywordAlignment.score >= 38 ||
      (keywordAlignment.score >= 42 && overlapScore >= 36) ||
      (headingAlignmentScore >= 36 && sentenceAlignmentScore >= 30)
    );

  const reason = !livePageText.trim()
    ? "The live page text could not be extracted, so comparison confidence is low."
    : isComparable
      ? "The reference and live page share enough topic-specific language to support a section-level comparison."
      : "The uploaded source and live page do not appear to discuss the same topic strongly enough for a reliable section-level comparison.";

  return {
    isComparable,
    confidence,
    weightedScore,
    overlapScore,
    keywordAlignmentScore: keywordAlignment.score,
    distinctiveKeywordAlignmentScore: distinctiveKeywordAlignment.score,
    headingAlignmentScore,
    sentenceAlignmentScore,
    matchedKeywords: keywordAlignment.matchedKeywords,
    sourceKeywords: keywordAlignment.sourceKeywords,
    distinctiveKeywords: distinctiveKeywordAlignment.distinctiveKeywords,
    matchedDistinctiveKeywords: distinctiveKeywordAlignment.matchedDistinctiveKeywords,
    reason,
  };
}

async function fetchLivePageData(url: string) {
  if (!url.trim()) {
    return {
      html: "",
      text: "",
      headings: [] as string[],
      sections: [] as Array<{ heading: string; content: string }>,
      extractionSucceeded: false,
      extractionMethod: "none",
      textLength: 0,
    };
  }

  let renderedResult:
    | ({
        html: string;
        text: string;
        headings: string[];
        sections: Array<{ heading: string; content: string }>;
      } & { extractionSucceeded?: boolean; extractionMethod?: string; textLength?: number })
    | null = null;

  try {
    const rendered = await captureLivePageStructure(url);
    renderedResult = {
      ...rendered,
      extractionSucceeded: rendered.text.trim().length >= 180 || rendered.headings.length >= 2,
      extractionMethod: "rendered",
      textLength: rendered.text.trim().length,
    };
  } catch {
    // Fall back to raw HTML extraction below.
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return renderedResult || { html: "", text: "", headings: [], sections: [], extractionSucceeded: false, extractionMethod: "failed", textLength: 0 };
    }

    const html = await response.text();
    const rawResult = {
      html,
      text: stripHtml(html),
      headings: extractLiveHeadings(html),
      sections: extractLiveSections(html),
      extractionSucceeded: stripHtml(html).trim().length >= 180 || extractLiveHeadings(html).length >= 2,
      extractionMethod: "raw-html",
      textLength: stripHtml(html).trim().length,
    };

    if (renderedResult && renderedResult.extractionSucceeded) {
      return (renderedResult.textLength || 0) >= rawResult.textLength * 0.6
        ? renderedResult
        : {
            html: renderedResult.html || rawResult.html,
            text: `${renderedResult.text} ${rawResult.text}`.trim(),
            headings: [...new Set([...renderedResult.headings, ...rawResult.headings])].slice(0, 12),
            sections: [...renderedResult.sections, ...rawResult.sections].slice(0, 12),
            extractionSucceeded: true,
            extractionMethod: "merged-rendered-raw",
            textLength: `${renderedResult.text} ${rawResult.text}`.trim().length,
          };
    }

    return rawResult;
  } catch {
    return renderedResult || { html: "", text: "", headings: [], sections: [], extractionSucceeded: false, extractionMethod: "failed", textLength: 0 };
  }
}

async function buildDynamicContentMatchFallback({
  publishedUrl,
  referenceContent,
  competitorUrl,
  visualComparison,
  useVisualScore = false,
}: {
  publishedUrl: string;
  referenceContent: string;
  competitorUrl?: string;
  visualComparison?: Awaited<ReturnType<typeof compareVisualReferences>> | null;
  useVisualScore?: boolean;
}) {
  const livePage = await fetchLivePageData(publishedUrl);
  const livePageText = livePage.text;
  const sourceSections = extractSourceSections(referenceContent);
  const relevance = buildContentRelevanceAssessment({
    referenceContent,
    livePageText,
    sourceSections,
    liveSections: livePage.sections,
    extractionSucceeded: Boolean((livePage as { extractionSucceeded?: boolean }).extractionSucceeded),
  });
  const overlapScore = relevance.overlapScore;
  const visualScore = useVisualScore ? visualComparison?.matchScore ?? overlapScore : overlapScore;
  const qaScore = Math.max(0, Math.min(100, Math.round((relevance.weightedScore * 0.8) + (visualScore * 0.2))));
  const missingTerms = topUniqueWords(referenceContent, livePageText);
  const sharedTerms = topSharedWords(referenceContent, livePageText);
  const referenceSentences = chunkSentences(referenceContent, 4);
  const liveSentences = chunkSentences(livePageText, 4);
  const headingComparisons = sourceSections.slice(0, 6).map((section, index) => {
    const match = matchLiveSection(section, livePage.sections);
    const liveHeading = match && match.score >= 0.15 ? match.liveSection.heading : "No clearly matching live heading found";
    return {
      index: index + 1,
      sourceHeading: section.heading,
      liveHeading,
      status: match && match.score >= 0.32 ? "Matched" : match && match.score >= 0.15 ? "Partial" : "Missing",
    };
  });
  const sectionComparisons = sourceSections.slice(0, 6).map((section, index) => {
    const match = matchLiveSection(section, livePage.sections);
    const hasMatch = Boolean(match && match.score >= 0.15);
    const sourceParagraphs = splitParagraphs(section.content || section.heading, 4);
    const liveParagraphs = hasMatch
      ? splitParagraphs(match!.liveSection.content || match!.liveSection.heading, 4)
      : [];

    return {
      index: index + 1,
      sourceHeading: section.heading,
      liveHeading: hasMatch ? match!.liveSection.heading : "No matching live section found",
      sourceContent: section.content || "Source content could not be summarized from the uploaded document.",
      liveContent: hasMatch
        ? match!.liveSection.content || "The live section exists, but adjacent body content could not be extracted confidently."
        : "This source section does not appear to be represented clearly on the live page.",
      sourceParagraphs,
      liveParagraphs,
      missingInLive:
        hasMatch && match!.score >= 0.32
          ? "No major omission detected from this section, but wording and structure should still be reviewed."
          : section.content || section.heading,
    };
  });

  if (!referenceContent.trim() || !livePageText.trim() || !relevance.isComparable) {
    const extractionFailed = !((livePage as { extractionSucceeded?: boolean }).extractionSucceeded);
    return {
      summary: !referenceContent.trim()
        ? "No reference source text was available, so a reliable comparison could not be performed."
        : extractionFailed || !livePageText.trim()
          ? "The live page content could not be extracted reliably, so the comparison result is low confidence."
          : "The uploaded reference does not appear to match the live page topic closely enough for an accurate comparison.",
      missingContent: [
        !referenceContent.trim()
          ? "Upload or paste the actual source content you want to validate against the live page."
          : extractionFailed || !livePageText.trim()
            ? "The live page did not expose enough extractable text to compare against the reference."
            : "The system detected a topic mismatch between the uploaded source and the live page, so detailed section findings were suppressed.",
      ],
      contentDrift: [
        relevance.reason,
      ],
      seoMismatches: relevance.sourceKeywords.length
        ? [`Expected topic keywords included ${relevance.sourceKeywords.slice(0, 6).join(", ")}, but the live page did not reflect enough of them to confirm relevance.`]
        : ["The reference did not provide enough distinctive keywords to support a reliable SEO or content-intent comparison."],
      formattingInconsistencies: [
        "Detailed heading and section comparison was skipped because the source-to-page relationship is low confidence.",
      ],
      headingComparisons: [],
      sectionComparisons: [],
      semanticValidation: {
        messagingAccuracy: "Low",
        toneConsistency: "Low",
        missingKeySections: relevance.sourceKeywords.slice(0, 4),
      },
      cmsSyncValidation: [
        "Verify that the uploaded document belongs to this exact live URL before relying on the comparison.",
      ],
      multilingualRisks: [],
      competitorInsights: competitorUrl
        ? ["Competitor review was not performed because the primary source-to-page comparison was low confidence."]
        : [],
      qaScore: Math.min(qaScore, 35),
      comparisonConfidence: relevance.confidence,
      comparisonStatus: extractionFailed ? "Low confidence - extraction failed" : "Low confidence - likely unrelated source",
      relevanceAnalysis: {
        reason: relevance.reason,
        overlapScore: relevance.overlapScore,
        keywordAlignmentScore: relevance.keywordAlignmentScore,
        distinctiveKeywordAlignmentScore: relevance.distinctiveKeywordAlignmentScore,
        headingAlignmentScore: relevance.headingAlignmentScore,
        sentenceAlignmentScore: relevance.sentenceAlignmentScore,
        matchedKeywords: relevance.matchedKeywords,
        sourceKeywords: relevance.sourceKeywords,
        distinctiveKeywords: relevance.distinctiveKeywords,
        matchedDistinctiveKeywords: relevance.matchedDistinctiveKeywords,
      },
      extractionDiagnostics: {
        extractionSucceeded: Boolean((livePage as { extractionSucceeded?: boolean }).extractionSucceeded),
        extractionMethod: (livePage as { extractionMethod?: string }).extractionMethod || "unknown",
        extractedTextLength: (livePage as { textLength?: number }).textLength || livePageText.length,
        headingsFound: livePage.headings.length,
        sectionsFound: livePage.sections.length,
      },
      issueHeatmap: [
        { section: "Comparison quality", severity: "High", issue: relevance.reason },
      ],
      visualComparison: useVisualScore ? visualComparison || undefined : undefined,
      autoBugReports: [
        {
          title: "Re-run content match with the correct source document",
          location: publishedUrl,
          suggestedFix: "Use the exact source document, CMS export, or approved copy deck that belongs to this live page before trusting detailed mismatch output.",
        },
      ],
    };
  }

  return {
    summary:
      qaScore >= 85
        ? "The live page is closely aligned with the uploaded source, with only minor content and presentation differences."
        : qaScore >= 65
          ? "The live page partially matches the uploaded source, but there are noticeable messaging and structure gaps that should be reviewed."
          : "The live page differs significantly from the uploaded source, with multiple content mismatches and missing reference signals.",
    missingContent:
      missingTerms.length > 0
        ? missingTerms.slice(0, 3).map((term) => `Reference-specific term "${term}" is not clearly represented on the live page.`)
        : ["No major missing keyword clusters were detected, but a manual section-by-section review is still recommended."],
    contentDrift:
      referenceSentences.length && liveSentences.length
        ? referenceSentences.slice(0, 2).map((sentence, index) => {
            const liveSentence = liveSentences[index] || "Equivalent live copy could not be confidently matched.";
            return `Source emphasis: "${sentence}" while the live page currently reflects "${liveSentence}".`;
          })
        : ["The available live page text could not be matched confidently against the uploaded source content."],
    seoMismatches:
      missingTerms.length > 0
        ? missingTerms.slice(0, 2).map((term) => `Keyword or intent term "${term}" appears in the reference but is weak or absent on the live page.`)
        : [`Shared terms detected include ${sharedTerms.slice(0, 4).join(", ") || "general overlap only"}, but stronger SEO intent validation is recommended.`],
    formattingInconsistencies: [
      "The uploaded document and the live page may not share the same heading hierarchy or section grouping.",
      "Long-form source content should be reviewed against live-page scanability and section order.",
    ],
    headingComparisons,
    sectionComparisons,
    semanticValidation: {
      messagingAccuracy: qaScore >= 85 ? "High" : qaScore >= 65 ? "Medium" : "Low",
      toneConsistency: overlapScore >= 80 ? "High" : overlapScore >= 60 ? "Medium" : "Low",
      missingKeySections: missingTerms.slice(0, 3),
    },
    comparisonConfidence: relevance.confidence,
    comparisonStatus: "Comparable source detected",
    relevanceAnalysis: {
      reason: relevance.reason,
      overlapScore: relevance.overlapScore,
      keywordAlignmentScore: relevance.keywordAlignmentScore,
      distinctiveKeywordAlignmentScore: relevance.distinctiveKeywordAlignmentScore,
      headingAlignmentScore: relevance.headingAlignmentScore,
      sentenceAlignmentScore: relevance.sentenceAlignmentScore,
      matchedKeywords: relevance.matchedKeywords,
      sourceKeywords: relevance.sourceKeywords,
      distinctiveKeywords: relevance.distinctiveKeywords,
      matchedDistinctiveKeywords: relevance.matchedDistinctiveKeywords,
    },
    extractionDiagnostics: {
      extractionSucceeded: Boolean((livePage as { extractionSucceeded?: boolean }).extractionSucceeded),
      extractionMethod: (livePage as { extractionMethod?: string }).extractionMethod || "unknown",
      extractedTextLength: (livePage as { textLength?: number }).textLength || livePageText.length,
      headingsFound: livePage.headings.length,
      sectionsFound: livePage.sections.length,
    },
    cmsSyncValidation: [
      "Verify that the latest source document content was fully published to the live CMS entry.",
      "Confirm no older draft or partial copy block is still active on the published page.",
    ],
    multilingualRisks: [
      "If translated variants exist, confirm the same content differences are not being repeated across locales.",
    ],
    competitorInsights: competitorUrl
      ? ["A competitor URL was provided, so positioning and value-message clarity should also be reviewed comparatively."]
      : [],
    qaScore,
    issueHeatmap: [
      { section: "Content coverage", severity: qaScore >= 85 ? "Low" : qaScore >= 65 ? "Medium" : "High", issue: "Reference-to-live content alignment" },
      { section: "Messaging", severity: overlapScore >= 80 ? "Low" : overlapScore >= 60 ? "Medium" : "High", issue: "Tone and keyword overlap" },
      { section: "Visual alignment", severity: visualScore >= 85 ? "Low" : visualScore >= 65 ? "Medium" : "High", issue: "Live page versus visual reference fidelity" },
    ],
    visualComparison: visualComparison || undefined,
    autoBugReports: [
      {
        title: "Review mismatched live content against uploaded source",
        location: publishedUrl,
        suggestedFix: `Prioritize missing reference terms such as ${missingTerms.slice(0, 4).join(", ") || "the omitted content blocks"} and revalidate the published page.`,
      },
    ],
  };
}

async function buildDynamicDesignMatchFallback({
  liveUrl,
  designReference,
  componentScope,
  viewportTargets,
  visualComparison,
}: {
  liveUrl: string;
  designReference: string;
  componentScope?: string;
  viewportTargets?: string;
  visualComparison?: Awaited<ReturnType<typeof compareVisualReferences>> | null;
}) {
  const livePageText = (await fetchLivePageData(liveUrl)).text;
  const overlapScore = computeTokenOverlapScore(designReference, livePageText);
  const visualScore = visualComparison?.matchScore ?? 55;
  const qaScore = Math.max(0, Math.min(100, Math.round((visualScore * 0.75) + (overlapScore * 0.25))));
  const missingTerms = topUniqueWords(designReference, livePageText);
  const topDiffs = visualComparison?.diffRegions.slice(0, 3) || [];

  return {
    summary:
      qaScore >= 85
        ? "The live page is visually close to the provided design reference, with only minor layout and token differences."
        : qaScore >= 65
          ? "The live page is moderately aligned with the provided design reference, but visible spacing and component-level differences remain."
          : "The live page shows notable deviations from the provided design reference and should be reviewed before signoff.",
    pixelLevelDifferences:
      topDiffs.length > 0
        ? topDiffs.map((region) => region.summary)
        : ["Visual diff regions were limited, so manual review of layout, spacing, and alignment is recommended."],
    uxImpactHighlights: [
      `The reviewed scope is ${componentScope || "the full page"}, and the current implementation should be checked for hierarchy, spacing, and emphasis drift.`,
      `Viewport targets under review: ${viewportTargets || "mobile, tablet, desktop"}.`,
    ],
    dynamicElementsIgnored: ["Live content that changes at runtime may create minor visual noise during comparison."],
    responsiveDeviations: (viewportTargets || "mobile, tablet, desktop").split(",").map((item) => ({
      viewport: item.trim() || "Viewport",
      issue: qaScore >= 85 ? "No major responsive drift detected from the current comparison inputs" : "Responsive review recommended because the implementation may not fully match the reference",
      severity: qaScore >= 85 ? "Low" : qaScore >= 65 ? "Medium" : "High",
    })),
    componentComparisons: [
      {
        component: componentScope || "Entire page",
        status: qaScore >= 85 ? "Pass" : qaScore >= 65 ? "Needs review" : "Mismatch",
        issue: missingTerms.length ? `Potential design/content drift around terms such as ${missingTerms.slice(0, 3).join(", ")}` : "No specific component keywords were isolated from the reference text.",
      },
    ],
    designTokenValidation: {
      colors: [qaScore >= 85 ? "No major color-token drift detected from the current visual comparison." : "Review accent, surface, and contrast tokens against the approved design."],
      typography: ["Validate heading scale, supporting text size, and visual emphasis against the design specification."],
      spacing: [topDiffs.length ? `Highest visual diff regions were detected around ${topDiffs.map((region) => region.label).join(", ")}.` : "Check section spacing and card padding manually."],
    },
    accessibilityFindings: [
      "Confirm contrast and readability in all visually changed regions before approval.",
    ],
    screenshotToCodeValidation: `The current visual comparison score is ${visualScore}%, based on the live page and the provided reference material.`,
    qaScore,
    issueHeatmap: topDiffs.map((region) => ({
      section: region.label,
      severity: region.severity,
      issue: region.summary,
    })),
    visualComparison: visualComparison || undefined,
    autoBugReports: [
      {
        title: "Review live page against uploaded design reference",
        location: liveUrl,
        suggestedFix: "Use the highlighted mismatch regions and responsive review notes to align the implementation with the approved design.",
      },
    ],
  };
}

function parseUrlList(urls: string) {
  return urls
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 10);
}

function extractHtmlTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(stripHtml(match[1])) : "";
}

async function analyzeBulkUrlTargets({
  urls,
  deploymentContext,
  workflowNotes,
}: {
  urls: string;
  deploymentContext?: string;
  workflowNotes?: string;
}) {
  const targets = parseUrlList(urls);

  const pages = await Promise.all(
    targets.map(async (url) => {
      const livePage = await fetchLivePageData(url);
      const pageTitle = livePage.headings[0] || extractHtmlTitle(livePage.html) || url;
      const textLength = livePage.text.length;
      const headingCount = livePage.headings.length;
      const hasContactSignals = /contact|email|phone|get in touch/i.test(livePage.text);
      const hasNavSignals = /services|about|contact|insights|pricing|features/i.test(livePage.text);
      const hasFooterSignals = /copyright|privacy|terms|linkedin|facebook/i.test(livePage.text);
      const structuralScore =
        (textLength > 600 ? 35 : textLength > 250 ? 22 : 8) +
        Math.min(headingCount, 6) * 6 +
        (hasNavSignals ? 10 : 0) +
        (hasFooterSignals ? 8 : 0) +
        (hasContactSignals ? 6 : 0);
      const contextPenalty = deploymentContext?.trim() && !new RegExp(deploymentContext.split(/\s+/).slice(0, 3).join("|"), "i").test(livePage.text)
        ? 6
        : 0;
      const workflowPenalty = workflowNotes?.trim() && !/responsive|content|design|link|form|navigation/i.test(workflowNotes)
        ? 3
        : 0;
      const matchScore = Math.max(25, Math.min(98, structuralScore - contextPenalty - workflowPenalty));

      const observations = [
        `Page title identified as "${pageTitle}".`,
        headingCount ? `${headingCount} visible headings were detected in the rendered page.` : "No meaningful heading structure was detected in the rendered page.",
        textLength > 600
          ? "The page exposes enough rendered content for a meaningful QA review."
          : textLength > 250
            ? "The page exposes moderate rendered content and should still be reviewed manually for completeness."
            : "The page exposes limited rendered content, which may indicate a thin page, blocked rendering, or a loading issue.",
      ];

      const issues: string[] = [];
      if (!hasNavSignals) issues.push("Navigation signals are weak or missing in the rendered content.");
      if (!hasFooterSignals) issues.push("Footer or trust signals are not obvious in the rendered content.");
      if (textLength < 250) issues.push("Rendered page content is shorter than expected for a stable marketing page.");
      if (headingCount < 2) issues.push("Heading hierarchy is sparse and may hurt scanability.");

      const responsiveStatus = matchScore >= 85 ? "Stable" : matchScore >= 65 ? "Needs review" : "High risk";
      const alert =
        issues[0] ||
        (matchScore >= 85
          ? "No major structural red flags were detected from the rendered page review."
          : "Rendered content suggests structural or content issues that should be reviewed before release.");

      return {
        url,
        pageTitle,
        matchScore,
        alert,
        responsiveStatus,
        testedFor: [
          "Rendered page availability",
          "Visible heading structure",
          "Navigation and footer signals",
          "Content depth and scanability",
        ],
        keyObservations: observations,
        issues,
      };
    }),
  );

  const pagesNeedingReview = pages.filter((page) => page.matchScore < 85);
  const summary =
    pages.length === 0
      ? "No URLs were provided for bulk QA."
      : pagesNeedingReview.length === 0
        ? `Bulk QA reviewed ${pages.length} page${pages.length === 1 ? "" : "s"} and found no major structural issues in the rendered content.`
        : `Bulk QA reviewed ${pages.length} page${pages.length === 1 ? "" : "s"} and found ${pagesNeedingReview.length} page${pagesNeedingReview.length === 1 ? "" : "s"} that should be reviewed before release.`;

  return {
    summary,
    pages,
    realtimeMonitoringAlerts: pagesNeedingReview.length
      ? pagesNeedingReview.slice(0, 3).map((page) => `Monitor ${page.url} because ${page.alert.toLowerCase()}`)
      : ["No urgent monitoring alerts were generated from the current URL set."],
    regressionTesting: {
      beforeVsAfter: "Compare the rendered content of the listed pages before and after deployment to catch structural regressions.",
      likelyBreakpoints: pagesNeedingReview.flatMap((page) => page.issues.slice(0, 2)).slice(0, 5),
    },
    workflowRouting: {
      designers: ["Review typography, hierarchy, spacing, and page scanability on any page marked Needs review or High risk."],
      developers: ["Review pages with weak rendered content, missing navigation signals, or structural issues."],
      qa: ["Retest any page flagged in the bulk run and confirm the visible content matches release expectations."],
    },
    ciCdIntegrations: [
      "Run the bulk URL review after deployment and compare the page-level findings over time.",
      "Publish the page-by-page QA output as a release verification artifact.",
    ],
    generatedTickets: pagesNeedingReview.slice(0, 5).map((page) => ({
      title: `Bulk QA follow-up for ${page.pageTitle}`,
      assigneeTeam: page.matchScore < 65 ? "QA + Frontend" : "QA",
      suggestedFix: page.alert,
      url: page.url,
    })),
  };
}

export async function generateTestCases({
  user,
  input,
  projectId,
  sourceName,
}: {
  user: User;
  input: string;
  projectId?: string;
  sourceName?: string;
}) {
  const fallback = {
    summary: "Enterprise QA pack generated with grouped suites for smoke, regression, UAT, and automation planning.",
    goNoGoRecommendation: "Conditional Go",
    releaseRecommendation: "Proceed only after all critical smoke and security scenarios pass in the target release environment.",
    governanceNotes: [
      "QA lead should review blocker and critical scenarios before release sign-off.",
      "Business owner should approve UAT outcomes for conversion-impacting flows.",
      "Automation engineer should prioritize smoke and auth candidates for repeatable coverage.",
    ],
    moduleCoverageTargets: [
      "Homepage and campaign content: minimum 4 detailed cases",
      "Navigation and footer links: minimum 4 detailed cases",
      "CTA and conversion journeys: minimum 6 detailed cases",
      "Authentication and authorization: minimum 4 detailed cases",
      "Responsive and cross-device behavior: minimum 4 detailed cases",
      "Negative, resilience, and recovery flows: minimum 4 detailed cases",
    ],
    defectSummary: [
      "Blocker: Authorization failure on protected flows would stop release",
      "Major: Validation defects could create bad customer submissions",
      "Minor: Responsive or content issues can be scheduled if they do not affect conversion",
    ],
    coverageGaps: [
      "API response validation still needs confirmation if backend contracts are in scope",
      "Browser matrix coverage should be expanded for Safari and mobile web if release requires it",
      "Analytics or event-tracking validation is not covered unless explicitly requested",
    ],
    testStrategy: [
      "Run smoke coverage first on the highest-risk user journeys.",
      "Use regression coverage for broader feature confidence before sign-off.",
      "Reserve UAT coverage for business-facing scenario validation.",
    ],
    entryCriteria: [
      "Build deployed to target environment",
      "Required integrations available",
      "Test data and user roles provisioned",
    ],
    exitCriteria: [
      "All critical and blocker defects resolved or formally waived",
      "Smoke suite passes in release candidate environment",
      "No open security issues affecting protected flows",
    ],
    smokeSuite: [
      "TC-001 - Execute primary revenue or conversion path",
      "TC-004 - Confirm unauthorized access is blocked on protected routes",
    ],
    regressionSuite: [
      "TC-001 - Validate end-to-end happy path stability",
      "TC-002 - Validate boundary handling against business rules",
      "TC-003 - Validate error handling and recovery for invalid submissions",
      "TC-004 - Validate authorization behavior after session and role changes",
    ],
    uatSuite: [
      "Business user validates that the highest-priority user journey matches release expectations",
      "Business user validates visible messaging, navigation outcomes, and critical approval flows",
    ],
    uatSignoffCriteria: [
      "Business owner confirms top conversion journeys match expected release behavior",
      "Marketing or product stakeholder confirms visible messaging and offer positioning are correct",
      "No blocker or major UAT issue remains open on business-critical flows",
    ],
    businessOwnerScenarios: [
      "Validate that a first-time customer can discover plans and reach the correct CTA destination without confusion",
      "Validate that sign in and sign up entry points align with expected customer onboarding behavior",
      "Validate that high-visibility homepage promotions and campaign messaging are business-approved",
    ],
    qaLeadPack: [
      "Review go/no-go recommendation against blocker and critical risks",
      "Confirm smoke suite, defect summary, and coverage gaps are acceptable for release",
      "Validate that entry and exit criteria are satisfied before sign-off",
    ],
    automationPack: [
      "Prioritize smoke and auth regression candidates for stable automation coverage",
      "Convert deterministic CTA, navigation, and validation scenarios into repeatable scripts",
      "Track flaky or environment-dependent scenarios separately from core smoke automation",
    ],
    businessUatPack: [
      "Business stakeholder validates top customer journeys and campaign messaging",
      "Product owner confirms CTA destinations and visible offer behavior align with release intent",
      "UAT approver signs off only when no major business-facing defect remains open",
    ],
    automationCandidates: [
      "TC-001 - High-value smoke candidate for every deployment",
      "TC-002 - Stable validation candidate with deterministic data",
      "TC-004 - Security regression candidate for auth-protected routes",
    ],
    testCases: [
      {
        id: "TC-001",
        requirementId: "REQ-AUTH-001",
        module: "Authentication",
        type: "Functional",
        priority: "Critical",
        severity: "Blocker",
        owner: "QA Automation",
        environment: "Web staging | Chrome | Desktop",
        automationStatus: "Candidate",
        dependencies: ["Authentication service available", "Test account provisioned", "Core login route deployed"],
        scenario: "Authenticated user completes the primary happy path without interruption",
        objective: "Protect the highest-value conversion or transaction workflow from release regressions.",
        preconditions: ["User account exists and is active", "Target environment is reachable", "Required feature flags are enabled"],
        testData: ["Valid user credentials", "Known-good account with required permissions"],
        steps: ["Open the target flow", "Submit valid inputs", "Confirm successful completion", "Verify success state and persisted outcome"],
        expectedResult: "Workflow completes successfully, the user sees the success confirmation, and the transaction or data change is persisted correctly.",
        negativeCoverage: ["Attempt the same flow with missing mandatory input", "Attempt the flow with an expired session"],
        edgeCoverage: ["Repeat the action after refresh", "Verify behavior on the smallest supported viewport"],
        automationCandidate: "Yes",
        postconditions: ["Authenticated session remains valid", "Expected audit or usage event is recorded if applicable"],
        releaseImpact: "High risk to customer access and conversion if this flow fails in production.",
        executionNotes: "Run first in smoke validation for every deployment and repeat on mobile web before release sign-off.",
        risk: "Revenue loss or critical user journey failure if the happy path breaks.",
        tags: ["smoke", "critical-path", "ui", "regression"],
      },
      {
        id: "TC-002",
        requirementId: "REQ-VAL-002",
        module: "Validation",
        type: "Edge",
        priority: "High",
        severity: "Major",
        owner: "QA Functional",
        environment: "Web staging | Desktop and mobile",
        automationStatus: "Candidate",
        dependencies: ["Validation rules configured", "Form field constraints available in requirements"],
        scenario: "Boundary values are accepted or rejected according to product rules",
        objective: "Ensure business-rule thresholds are enforced without silent truncation or inconsistent validation.",
        preconditions: ["User is on the relevant form or workflow"],
        testData: ["Minimum allowed value", "Maximum allowed value", "Value just below minimum", "Value just above maximum"],
        steps: ["Enter the minimum allowed value", "Submit and verify the response", "Repeat with the maximum allowed value", "Repeat with values just outside the allowed range"],
        expectedResult: "Accepted boundary values are processed correctly, and out-of-range values are blocked with precise validation messaging.",
        negativeCoverage: ["Submit blank input", "Submit malformed input type"],
        edgeCoverage: ["Paste long values", "Retry after server-side validation message"],
        automationCandidate: "Yes",
        postconditions: ["Invalid submissions do not create or update records"],
        releaseImpact: "Bad validation can cause escaped defects, inconsistent data, and customer-facing errors after launch.",
        executionNotes: "Pair with backend validation verification when API and UI rules are expected to match.",
        risk: "Incorrect validation can cause data corruption, support escalations, or inconsistent user experience.",
        tags: ["boundary", "validation", "high-risk"],
      },
      {
        id: "TC-003",
        requirementId: "REQ-VAL-003",
        module: "Validation",
        type: "Negative",
        priority: "High",
        severity: "Major",
        owner: "QA Functional",
        environment: "Web staging | Chrome | Responsive",
        automationStatus: "Candidate",
        dependencies: ["Submission endpoint reachable", "Validation error messages configured"],
        scenario: "Invalid or incomplete input is blocked with actionable feedback",
        objective: "Prevent bad submissions from reaching downstream systems or creating hidden defects.",
        preconditions: ["User is on the submission flow"],
        testData: ["Empty mandatory field", "Invalid format", "Disallowed special characters"],
        steps: ["Enter invalid or missing input", "Submit the form", "Correct the input and resubmit"],
        expectedResult: "System blocks invalid submission, highlights the affected fields, and allows successful resubmission after correction.",
        negativeCoverage: ["Multiple invalid fields submitted together", "Server-side validation mismatch"],
        edgeCoverage: ["Keyboard-only interaction", "Mobile form validation state"],
        automationCandidate: "Yes",
        postconditions: ["No malformed record is created", "Validation state clears after correction"],
        releaseImpact: "Weak validation can damage data quality and increase user drop-off in core forms.",
        executionNotes: "Check both inline validation and submit-time validation behavior.",
        risk: "Poor validation allows broken data into core systems and weakens trust in the platform.",
        tags: ["negative", "validation", "usability"],
      },
      {
        id: "TC-004",
        requirementId: "REQ-SEC-001",
        module: "Authorization",
        type: "Security",
        priority: "Critical",
        severity: "Blocker",
        owner: "QA Security",
        environment: "Web staging | Auth-enabled environment",
        automationStatus: "Candidate",
        dependencies: ["Protected route exists", "Role matrix defined", "Unauthorized test user available"],
        scenario: "Unauthorized users cannot access protected workflows or data",
        objective: "Confirm protected pages and actions reject requests without valid authorization.",
        preconditions: ["Protected workflow exists", "Unauthenticated or unauthorized session is available for testing"],
        testData: ["No session", "Expired session", "User without required role"],
        steps: ["Attempt access without a valid session", "Attempt access with insufficient permissions", "Verify system response and data exposure"],
        expectedResult: "Protected routes and actions are rejected consistently, and no restricted data is exposed in the UI or responses.",
        negativeCoverage: ["Manipulate direct URL access", "Retry protected action after logout"],
        edgeCoverage: ["Open protected page in a new tab", "Use browser back navigation after session expiry"],
        automationCandidate: "Yes",
        postconditions: ["Protected data remains inaccessible", "Unauthorized request is logged where applicable"],
        releaseImpact: "Failure here creates severe compliance, privacy, and reputational risk.",
        executionNotes: "Validate both UI route protection and direct backend/API access where applicable.",
        risk: "Unauthorized access creates severe security, compliance, and customer-trust exposure.",
        tags: ["security", "authorization", "critical"],
      },
    ],
  };

  const minimumDetailedCases = 24;
  const minimumSmokeCases = 6;
  const minimumRegressionCases = 10;
  const minimumUatCases = 4;
  const minimumAutomationCandidates = 4;
  const moduleCoverageTargets = [
    "Homepage and campaign content: minimum 4 detailed cases",
    "Navigation and footer links: minimum 4 detailed cases",
    "CTA and conversion journeys: minimum 6 detailed cases",
    "Authentication and authorization: minimum 4 detailed cases",
    "Responsive and cross-device behavior: minimum 4 detailed cases",
    "Negative, resilience, and recovery flows: minimum 4 detailed cases",
  ];

  const systemPrompt = [
    "You are a principal QA architect generating enterprise-grade test design.",
    "Return strict JSON with keys summary, goNoGoRecommendation, releaseRecommendation, governanceNotes, moduleCoverageTargets, defectSummary, coverageGaps, testStrategy, entryCriteria, exitCriteria, smokeSuite, regressionSuite, uatSuite, uatSignoffCriteria, businessOwnerScenarios, qaLeadPack, automationPack, businessUatPack, automationCandidates, testCases.",
    "Each of governanceNotes, moduleCoverageTargets, defectSummary, coverageGaps, smokeSuite, regressionSuite, uatSuite, uatSignoffCriteria, businessOwnerScenarios, qaLeadPack, automationPack, businessUatPack, automationCandidates, testStrategy, entryCriteria, and exitCriteria should be an array of concise strings.",
    "Each test case must include: id, requirementId, module, type, priority, severity, owner, environment, automationStatus, dependencies, scenario, objective, preconditions, testData, steps, expectedResult, negativeCoverage, edgeCoverage, automationCandidate, postconditions, releaseImpact, executionNotes, risk, tags.",
    "Every test case must also be directly usable in a spreadsheet sheet named QA Test Cases with these core columns in this exact order: Test Case ID, Module, Scenario, Preconditions, Test Steps, Expected Result, Priority, Type.",
    "Map those spreadsheet columns exactly as follows: Test Case ID=id, Module=module, Scenario=scenario, Preconditions=preconditions, Test Steps=steps, Expected Result=expectedResult, Priority=priority, Type=type.",
    "The values for scenario, preconditions, steps, and expectedResult must be clean, execution-ready, and understandable without reading other fields.",
    "Write cases that are execution-ready, measurable, and risk-based.",
    "Avoid generic wording like correct, proper, accurate, valid, works, or appropriate unless followed by a concrete assertion.",
    "Include critical-path, negative, boundary, authorization, resilience, cross-device, content, and conversion coverage where relevant.",
    `Generate at least ${minimumDetailedCases} unique detailed test cases.`,
    `Generate at least ${minimumSmokeCases} smoke items, at least ${minimumRegressionCases} regression items, at least ${minimumUatCases} UAT items, and at least ${minimumAutomationCandidates} automation candidates.`,
    "Do not collapse multiple checks into one oversized test case just to reduce count.",
    "Prefer broad, well-structured enterprise coverage over a short compact list.",
    "Steps should be specific enough for a QA engineer to execute without guessing.",
    "Expected results must describe observable outcomes such as route change, persisted state, error messaging, access control, returned status, visible UI state, or business rule enforcement.",
    "Requirement IDs should be concise and traceable. Owners should reflect realistic QA ownership such as QA Functional, QA Automation, QA Security, or Release QA.",
    "Environment should mention the most relevant platform or browser context. Release impact should explain why the case matters to go-live confidence.",
    "Execution notes should help a QA lead decide when or how to run the case during smoke, regression, UAT, or release sign-off.",
    "Set goNoGoRecommendation to Go, Conditional Go, or No-Go based on the generated risk profile.",
    "Use governanceNotes to explain ownership and release decision responsibilities.",
    "Use moduleCoverageTargets to reflect the required spread of coverage across the release.",
    "Use defectSummary to summarize likely blocker, major, or minor defect themes that leadership should watch.",
    "Use coverageGaps to call out testing that is still missing or should be added before release confidence is complete.",
    "Populate smokeSuite with only the highest-risk go-live checks.",
    "Populate regressionSuite with broader repeatable coverage.",
    "Populate uatSuite with business-facing validation scenarios.",
    "Populate uatSignoffCriteria with explicit business sign-off conditions.",
    "Populate businessOwnerScenarios with realistic business-user validation examples for release review.",
    "Populate qaLeadPack with concise release-decision actions and review checkpoints for a QA lead.",
    "Populate automationPack with concise priorities and action items for an automation engineer.",
    "Populate businessUatPack with concise review items for business stakeholders performing UAT.",
    "Populate automationCandidates with the best candidates for stable automated coverage.",
    "Use realistic QA language suitable for enterprise review.",
  ].join(" ");

  const basePrompt = [
    "Generate enterprise-grade test cases from the following requirement or source content.",
    "Focus on business risk, measurable assertions, negative paths, and release readiness.",
    "The primary deliverable should feel like a clean QA worksheet, not a vague summary.",
    "Make the testCases array spreadsheet-ready for a sheet called QA Test Cases with columns Test Case ID, Module, Scenario, Preconditions, Test Steps, Expected Result, Priority, Type.",
    "Also produce grouped QA pack sections for smoke, regression, UAT, UAT sign-off criteria, business-owner scenarios, QA lead pack, automation pack, business UAT pack, entry criteria, exit criteria, automation candidates, go/no-go recommendation, defect summary, and coverage gaps.",
    `Module coverage targets: ${moduleCoverageTargets.join("; ")}.`,
    `Minimum detailed test case count: ${minimumDetailedCases}.`,
    `Minimum suite sizes: smoke ${minimumSmokeCases}, regression ${minimumRegressionCases}, UAT ${minimumUatCases}, automation candidates ${minimumAutomationCandidates}.`,
    sourceName ? `Source file: ${sourceName}` : "",
    "",
    input,
  ]
    .filter(Boolean)
    .join("\n");

  let result = await generateAiJson({
    system: systemPrompt,
    prompt: basePrompt,
    fallback,
    allowFallback: true,
  });

  const resultRecord = result as Record<string, unknown>;
  const testCasesCount = Array.isArray(resultRecord.testCases) ? resultRecord.testCases.length : 0;
  const smokeCount = Array.isArray(resultRecord.smokeSuite) ? resultRecord.smokeSuite.length : 0;
  const regressionCount = Array.isArray(resultRecord.regressionSuite) ? resultRecord.regressionSuite.length : 0;
  const uatCount = Array.isArray(resultRecord.uatSuite) ? resultRecord.uatSuite.length : 0;
  const automationCount = Array.isArray(resultRecord.automationCandidates) ? resultRecord.automationCandidates.length : 0;
  const generatedTestCases = Array.isArray(resultRecord.testCases) ? (resultRecord.testCases as Array<Record<string, unknown>>) : [];
  const homepageCount = countMatchingCases(generatedTestCases, ["homepage", "campaign", "banner"]);
  const navigationCount = countMatchingCases(generatedTestCases, ["navigation", "nav", "footer", "link"]);
  const conversionCount = countMatchingCases(generatedTestCases, ["cta", "plan", "buy", "switch", "conversion", "activate"]);
  const authCount = countMatchingCases(generatedTestCases, ["auth", "login", "sign in", "sign up", "authorization", "session", "protected"]);
  const responsiveCount = countMatchingCases(generatedTestCases, ["responsive", "mobile", "desktop", "viewport", "cross-device"]);
  const resilienceCount = countMatchingCases(generatedTestCases, ["negative", "recovery", "resilience", "error", "retry", "invalid"]);

  const moduleCoverageFailed =
    homepageCount < 4 ||
    navigationCount < 4 ||
    conversionCount < 6 ||
    authCount < 4 ||
    responsiveCount < 4 ||
    resilienceCount < 4;

  if (
    testCasesCount < minimumDetailedCases ||
    smokeCount < minimumSmokeCases ||
    regressionCount < minimumRegressionCases ||
    uatCount < minimumUatCases ||
    automationCount < minimumAutomationCandidates ||
    moduleCoverageFailed
  ) {
    result = await generateAiJson({
      system: systemPrompt,
      prompt: [
        basePrompt,
        "",
        "The previous answer did not meet the minimum enterprise coverage counts.",
        `You must return at least ${minimumDetailedCases} detailed test cases, ${minimumSmokeCases} smoke items, ${minimumRegressionCases} regression items, ${minimumUatCases} UAT items, and ${minimumAutomationCandidates} automation candidates.`,
        `Previous counts were: testCases=${testCasesCount}, smoke=${smokeCount}, regression=${regressionCount}, uat=${uatCount}, automation=${automationCount}.`,
        `Respect these module coverage targets: ${moduleCoverageTargets.join("; ")}.`,
        `Previous module coverage counts were: homepage=${homepageCount}, navigation=${navigationCount}, conversion=${conversionCount}, auth=${authCount}, responsive=${responsiveCount}, resilience=${resilienceCount}.`,
        "Regenerate with broader coverage and more unique scenarios.",
      ].join("\n"),
      fallback,
      allowFallback: true,
    });
  }

  const creditsUsed = await spendCredits(user, "generateTestCases", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.TEST_CASES,
    title: "AI generated test cases",
    sourceName,
    inputText: input,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function generateAutomationScript({
  user,
  input,
  framework,
  projectId,
}: {
  user: User;
  input: string;
  framework: string;
  projectId?: string;
}) {
  const fallback = {
    framework,
    script:
      framework === "selenium"
        ? `from selenium import webdriver\n\ndef test_login_flow():\n    driver = webdriver.Chrome()\n    driver.get("https://example.com")\n    driver.find_element("id", "email").send_keys("qa@example.com")\n    driver.find_element("id", "submit").click()\n    assert "Dashboard" in driver.page_source`
        : framework === "cypress"
          ? `describe("login flow", () => {\n  it("logs the user in", () => {\n    cy.visit("https://example.com");\n    cy.get('[name=\"email\"]').type("qa@example.com");\n    cy.contains("button", "Submit").click();\n    cy.contains("Dashboard").should("be.visible");\n  });\n});`
          : `import { test, expect } from "@playwright/test";\n\ntest("login flow", async ({ page }) => {\n  await page.goto("https://example.com");\n  await page.getByLabel("Email").fill("qa@example.com");\n  await page.getByRole("button", { name: "Submit" }).click();\n  await expect(page.getByText("Dashboard")).toBeVisible();\n});`,
  };

  const result = await generateAiJson({
    system: "Return JSON with framework and script.",
    prompt: `Generate a ${framework} automation script for the following test case:\n\n${input}`,
    fallback,
  });

  const creditsUsed = await spendCredits(user, "generateAutomation", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.AUTOMATION_SCRIPT,
    title: `${framework} automation script`,
    inputText: input,
    outputText: String(result.script),
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function analyzeBug({
  user,
  input,
  projectId,
  sourceName,
}: {
  user: User;
  input: string;
  projectId?: string;
  sourceName?: string;
}) {
  const fallback = {
    rootCause: "The issue is likely caused by missing null checks or environment-specific configuration drift.",
    affectedModule: "Application service or controller nearest the top stack frame",
    suggestedFix: "Validate input earlier, confirm deployment configuration, and add a regression test.",
  };

  const result = await generateAiJson({
    system: "Return JSON with rootCause, affectedModule, suggestedFix.",
    prompt: `Analyze these logs and identify the bug cause:\n\n${input}`,
    fallback,
  });

  const creditsUsed = await spendCredits(user, "analyzeBug", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.BUG_ANALYSIS,
    title: "Bug analysis",
    sourceName,
    inputText: input,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function generateTestData({
  user,
  prompt,
  recordCount,
  projectId,
}: {
  user: User;
  prompt: string;
  recordCount: number;
  projectId?: string;
}) {
  const fallback = {
    records: Array.from({ length: recordCount }).map((_, index) => ({
      name: index === recordCount - 1 ? "" : `QA User ${index + 1}`,
      email: index === recordCount - 1 ? "invalid-email" : `qa.user${index + 1}@example.com`,
      phone: index === recordCount - 1 ? "123" : `+1-415-555-01${String(index).padStart(2, "0")}`,
      address: index === recordCount - 1 ? "" : `${100 + index} Mission Street, San Francisco, CA`,
    })),
  };

  const result = await generateAiJson({
    system: "Return JSON with key records. Include realistic positive and edge data.",
    prompt: `Generate ${recordCount} QA data records for the following use case:\n\n${prompt}`,
    fallback,
  });

  const creditsUsed = await spendCredits(user, "generateTestData", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.TEST_DATA,
    title: "Generated test data",
    inputText: prompt,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function generateTestReport({
  user,
  input,
  projectId,
  sourceName,
}: {
  user: User;
  input: string;
  projectId?: string;
  sourceName?: string;
}) {
  const parsedRows = [...parseStructuredExecutionRows(input), ...parseCsvExecutionRows(input)];
  const uniqueRows = Array.from(
    new Map(parsedRows.map((row) => [`${row.id}::${row.title}::${row.statusRaw}`, row])).values(),
  );

  const fallback = summarizeExecutionRows(uniqueRows, sourceName);

  const result = uniqueRows.length
    ? fallback
    : await generateAiJson({
        system: [
          "Return strict JSON with keys summary, passRate, goNoGoRecommendation, criticalIssues, blockers, defectSummary, stakeholderActions, recommendation, releaseRecommendation, evidenceRequired, testCases.",
          "Do not invent execution evidence that is not present in the user input.",
          "If the input lacks explicit execution status, say so clearly and recommend providing an execution sheet.",
          "Prefer concrete counts, failed scenarios, blockers, and next actions over generic QA language.",
        ].join(" "),
        prompt: `Create an execution-aware QA report from the following run evidence:\n\n${input}`,
        fallback,
      });

  const creditsUsed = await spendCredits(user, "generateTestReport", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.TEST_REPORT,
    title: "QA execution report",
    sourceName,
    inputText: input,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function executeTestCases({
  user,
  input,
  baseUrl,
  projectId,
  sourceName,
}: {
  user: User;
  input: string;
  baseUrl: string;
  projectId?: string;
  sourceName?: string;
}) {
  const executeWebsiteTestCases = await loadWebsiteTestExecutor();
  const result = await executeWebsiteTestCases({
    baseUrl,
    input,
  });

  const creditsUsed = await spendCredits(user, "executeTestCases", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.TEST_REPORT,
    title: "Executed website test run",
    sourceName,
    inputText: input,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function generateApiTests({
  user,
  input,
  projectId,
}: {
  user: User;
  input: string;
  projectId?: string;
}) {
  const fallback = {
    testCases: [
      {
        endpoint: "POST /orders",
        scenario: "Create order with valid payload",
        expectedResult: "Returns 201 Created with order id.",
      },
      {
        endpoint: "POST /orders",
        scenario: "Reject request with missing customer id",
        expectedResult: "Returns 400 with validation error.",
      },
    ],
    sampleRequests: [
      {
        method: "POST",
        endpoint: "/orders",
        body: {
          customerId: "cust_001",
          items: [{ sku: "SKU-100", quantity: 1 }],
        },
      },
    ],
  };

  const result = await generateAiJson({
    system: "Return JSON with testCases and sampleRequests based on the provided API spec.",
    prompt: `Generate API tests from the following OpenAPI or Swagger content:\n\n${input}`,
    fallback,
  });

  const creditsUsed = await spendCredits(user, "generateApiTests", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.API_TESTS,
    title: "API test suite",
    inputText: input,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function analyzeReleaseRisk({
  user,
  input,
  projectId,
  sourceName,
}: {
  user: User;
  input: string;
  projectId?: string;
  sourceName?: string;
}) {
  const fallback = {
    readinessScore: 72,
    riskLevel: "Moderate",
    goNoGoRecommendation: "Conditional Go",
    summary: "Release readiness is moderate. Core journeys show promise, but unresolved quality risks still require targeted retesting before go-live.",
    highRiskModules: ["Homepage CTA reliability", "Plan discovery", "Authentication entry points"],
    blockers: ["Broken or unstable critical CTA routing", "Unverified auth entry-point behavior under release conditions"],
    releaseDecisionDrivers: ["Customer conversion impact", "Visibility of critical homepage messaging", "Responsive stability on mobile web"],
    residualRisks: ["Minor browser-specific layout drift may remain after release", "Low-confidence edge-case coverage on content updates could still produce post-release noise"],
    rollbackTriggers: ["Critical CTA route fails in production", "Sign in or sign up flow becomes inaccessible", "Homepage layout degrades on major mobile viewport"],
    deploymentGuards: ["Smoke tests must pass on release candidate", "Critical route health checks must return success", "No blocker defects may remain open at deployment time"],
    signoffOwners: ["QA Lead", "Product Owner", "Release Manager"],
    monitoringPlan: ["Monitor CTA click-through health after deployment", "Track auth-entry errors during first release window", "Watch 4xx/5xx spikes on critical landing pages"],
    communicationPlan: ["Share go/no-go status with QA, product, and engineering before deployment", "Notify stakeholders of residual risks and mitigations", "Post-release status update after smoke validation completes"],
    entryCriteria: ["Release candidate deployed to target environment", "Critical smoke scope identified", "Required test data and stakeholders available"],
    exitCriteria: ["No blocker defects remain open", "Critical user journeys pass retest", "Release owner approves residual risks"],
    stakeholderActions: ["QA Lead to review blocker status", "Product owner to confirm business-critical flows", "Engineering to fix unstable CTA or auth issues"],
    mitigationPlan: ["Retest homepage CTA flows", "Validate responsive behavior on mobile devices", "Confirm sign in and sign up routes under clean sessions"],
    evidenceRequired: ["Smoke test results", "Responsive checks", "Authentication flow validation", "Open-defect summary"],
    coverageGaps: ["Cross-browser confirmation is incomplete", "Protected route behavior needs stronger evidence", "Footer/legal link checks may need refresh after latest content changes"],
    releaseRecommendation: "Proceed only if blockers are cleared and critical retest evidence is attached to the release decision.",
    recommendation: "Hold release until flaky tests are stabilized, critical journeys are retested, and missing coverage evidence is completed.",
  };

  const result = await generateAiJson({
    system: [
      "You are a senior release manager and principal QA lead.",
      "Return strict JSON with keys readinessScore, riskLevel, goNoGoRecommendation, summary, highRiskModules, blockers, releaseDecisionDrivers, residualRisks, rollbackTriggers, deploymentGuards, signoffOwners, monitoringPlan, communicationPlan, entryCriteria, exitCriteria, stakeholderActions, mitigationPlan, evidenceRequired, coverageGaps, releaseRecommendation, recommendation.",
      "Use enterprise release language suitable for QA leads, product owners, and release managers.",
      "readinessScore must be a number from 0 to 100.",
      "riskLevel should be Low, Moderate, High, or Critical.",
      "goNoGoRecommendation should be Go, Conditional Go, or No-Go.",
      "Array fields should be concise, actionable, and specific to release decision-making.",
      "Prioritize business impact, production risk, customer journeys, and unresolved coverage gaps.",
      "Include explicit residual risks, rollback triggers, deployment guards, sign-off owners, monitoring plan, and communication plan.",
    ].join(" "),
    prompt: [
      "Analyze release risk using the following QA indicators.",
      "Return an enterprise release-readiness assessment with blockers, decision drivers, residual risks, rollback triggers, deployment guards, sign-off owners, monitoring plan, communication plan, mitigations, evidence required, and stakeholder actions.",
      "",
      input,
    ].join("\n"),
    fallback,
  });

  const creditsUsed = await spendCredits(user, "analyzeReleaseRisk", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.RELEASE_RISK,
    title: "Release risk analysis",
    sourceName,
    inputText: input,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function analyzeContentMatch({
  user,
  publishedUrl,
  referenceContent,
  referenceType,
  screenshotDescription,
  competitorUrl,
  projectId,
  sourceName,
  referenceImage,
}: {
  user: User;
  publishedUrl: string;
  referenceContent: string;
  referenceType: string;
  screenshotDescription?: string;
  competitorUrl?: string;
  projectId?: string;
  sourceName?: string;
  referenceImage?: Buffer;
}) {
  const useVisualScore = Boolean(referenceImage);
  const visualComparison =
    publishedUrl && (referenceImage || referenceContent.trim())
      ? await compareVisualReferences({
          liveUrl: publishedUrl,
          referenceImage,
          referenceText: referenceContent,
          sourceName,
        })
      : null;

  const fallback = await buildDynamicContentMatchFallback({
    publishedUrl,
    referenceContent,
    competitorUrl,
    visualComparison,
    useVisualScore,
  });

  if ((fallback as { comparisonStatus?: unknown }).comparisonStatus === "Low confidence - likely unrelated source") {
    const creditsUsed = await spendCredits(user, "analyzeContentMatch", projectId);
    await storeArtifact({
      projectId,
      type: ArtifactType.TEST_REPORT,
      title: "Content matcher analysis",
      sourceName,
      inputText: `${publishedUrl}\n\n${referenceContent}`,
      outputJson: fallback as Prisma.InputJsonValue,
    });

    return { ...fallback, creditsUsed };
  }

  const result = await generateAiJson({
    system:
      "You are an AI QA content validator. Respect the supplied relevance metrics. If comparisonConfidence is Low or the source appears unrelated, do not invent detailed section findings. Return JSON with summary, missingContent, contentDrift, seoMismatches, formattingInconsistencies, semanticValidation, cmsSyncValidation, multilingualRisks, competitorInsights, qaScore, comparisonConfidence, comparisonStatus, relevanceAnalysis, issueHeatmap, visualComparison, autoBugReports.",
    prompt: `Compare a published page against a reference source.\nPublished URL: ${publishedUrl}\nReference type: ${referenceType}\nReference content:\n${referenceContent}\nScreenshot or image notes:\n${screenshotDescription || "None provided"}\nCompetitor URL:\n${competitorUrl || "None provided"}\nVisual comparison metadata:\n${useVisualScore && visualComparison ? JSON.stringify(visualComparison.diffRegions) : "No visual diff data"}\nDeterministic relevance metrics:\n${JSON.stringify({
      comparisonConfidence: (fallback as { comparisonConfidence?: unknown }).comparisonConfidence,
      comparisonStatus: (fallback as { comparisonStatus?: unknown }).comparisonStatus,
      relevanceAnalysis: (fallback as { relevanceAnalysis?: unknown }).relevanceAnalysis,
      headingComparisons: (fallback as { headingComparisons?: unknown }).headingComparisons,
      sectionComparisons: (fallback as { sectionComparisons?: unknown }).sectionComparisons,
      qaScore: (fallback as { qaScore?: unknown }).qaScore,
    })}\nUse the metrics above as ground truth for relevance and scoring. Do not increase the score materially if the relevance metrics are weak. Return structured QA findings for content matching, semantic validation, CMS sync, multilingual risk, visual comparison, and auto bug reporting.`,
    fallback,
  });

  const creditsUsed = await spendCredits(user, "analyzeContentMatch", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.TEST_REPORT,
    title: "Content matcher analysis",
    sourceName,
    inputText: `${publishedUrl}\n\n${referenceContent}`,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function analyzeDesignMatch({
  user,
  liveUrl,
  designReference,
  componentScope,
  viewportTargets,
  screenshotDescription,
  projectId,
  sourceName,
  referenceImage,
}: {
  user: User;
  liveUrl: string;
  designReference: string;
  componentScope?: string;
  viewportTargets?: string;
  screenshotDescription?: string;
  projectId?: string;
  sourceName?: string;
  referenceImage?: Buffer;
}) {
  const visualComparison =
    liveUrl && (referenceImage || designReference.trim())
      ? await compareVisualReferences({
          liveUrl,
          referenceImage,
          referenceText: designReference,
          sourceName,
        })
      : null;

  const fallback = await buildDynamicDesignMatchFallback({
    liveUrl,
    designReference,
    componentScope,
    viewportTargets,
    visualComparison,
  });

  const result = await generateAiJson({
    system:
      "You are an AI design QA reviewer. Return JSON with summary, pixelLevelDifferences, uxImpactHighlights, dynamicElementsIgnored, responsiveDeviations, componentComparisons, designTokenValidation, accessibilityFindings, screenshotToCodeValidation, qaScore, issueHeatmap, visualComparison, autoBugReports.",
    prompt: `Compare a live page with a design reference.\nLive URL: ${liveUrl}\nDesign reference:\n${designReference}\nComponent scope: ${componentScope || "Entire page"}\nViewport targets: ${viewportTargets || "mobile, tablet, desktop"}\nScreenshot notes: ${screenshotDescription || "None provided"}\nVisual comparison metadata:\n${visualComparison ? JSON.stringify(visualComparison.diffRegions) : "No visual diff data"}\nReturn findings for design matching, visual diff, responsive breakpoints, component-level comparison, design token validation, accessibility, screenshot-to-code validation, and clear missing-section highlights.`,
    fallback,
  });

  const creditsUsed = await spendCredits(user, "analyzeDesignMatch", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.RELEASE_RISK,
    title: "Design matcher analysis",
    sourceName,
    inputText: `${liveUrl}\n\n${designReference}`,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export async function analyzeBulkUrlQa({
  user,
  urls,
  deploymentContext,
  workflowNotes,
  projectId,
}: {
  user: User;
  urls: string;
  deploymentContext?: string;
  workflowNotes?: string;
  projectId?: string;
}) {
  const fallback = await analyzeBulkUrlTargets({
    urls,
    deploymentContext,
    workflowNotes,
  });

  const result = await generateAiJson({
    system:
      "You are an AI website QA orchestrator. Return JSON with summary, pages, realtimeMonitoringAlerts, regressionTesting, workflowRouting, ciCdIntegrations, generatedTickets.",
    prompt: `Analyze a group of URLs for website QA.\nURLs or sitemap input:\n${urls}\nDeployment context:\n${deploymentContext || "Not provided"}\nWorkflow notes:\n${workflowNotes || "Not provided"}\nReturn findings for bulk URL testing, regression testing, real-time monitoring, role-based workflows, CI/CD integration, and auto ticket generation.`,
    fallback,
  });

  const creditsUsed = await spendCredits(user, "analyzeBulkUrlQa", projectId);
  await storeArtifact({
    projectId,
    type: ArtifactType.TEST_REPORT,
    title: "Bulk website QA analysis",
    inputText: urls,
    outputJson: result as Prisma.InputJsonValue,
  });

  return { ...result, creditsUsed };
}

export const creditsCatalog = creditCosts;
