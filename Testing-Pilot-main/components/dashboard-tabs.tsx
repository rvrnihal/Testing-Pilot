"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input, Textarea } from "@/components/input";
import { cn } from "@/lib/utils";

type TabId = "cases" | "automation" | "bug" | "data" | "report";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "cases", label: "Generate Test Cases" },
  { id: "automation", label: "Automation Script Generator" },
  { id: "bug", label: "Bug Analyzer" },
  { id: "data", label: "Test Data Generator" },
  { id: "report", label: "Test Report Generator" },
];

function extractRows(markdown: string) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 3) {
    return [];
  }

  const headers = lines[0]
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  return lines.slice(2).map((line) => {
    const values = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);

    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] || "";
      return acc;
    }, {});
  });
}

export function DashboardTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("cases");
  const [artifactType, setArtifactType] = useState("PRD");
  const [framework, setFramework] = useState("playwright");
  const [casesInput, setCasesInput] = useState("");
  const [automationInput, setAutomationInput] = useState("");
  const [bugInput, setBugInput] = useState("");
  const [dataInput, setDataInput] = useState("");
  const [reportInput, setReportInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const exportRows = useMemo(() => extractRows(result), [result]);

  async function callApi(path: string, payload: Record<string, unknown>) {
    setLoading(true);
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setResult(data.error || "Request failed.");
      return;
    }

    setResult(data.result || data.message || "");
  }

  async function exportFile(format: "csv" | "xlsx") {
    const response = await fetch("/api/export/test-cases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: exportRows,
        format,
      }),
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = format === "csv" ? "qa-copilot-test-cases.csv" : "qa-copilot-test-cases.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(file: File | null, setter: (value: string) => void) {
    if (!file) {
      return;
    }

    const text = await file.text();
    setter(text);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <div className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setResult("");
              }}
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-left text-sm transition",
                activeTab === tab.id
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-[var(--surface-border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-6">
        {activeTab === "cases" ? (
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">Generate Test Cases</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Upload or paste a PRD, BRD, user story, or API documentation.
                </p>
              </div>
              <select
                value={artifactType}
                onChange={(event) => setArtifactType(event.target.value)}
                className="rounded-full border border-[var(--surface-border)] bg-white px-4 py-2 text-sm text-[var(--foreground)]"
              >
                <option>PRD</option>
                <option>BRD</option>
                <option>User Story</option>
                <option>API Documentation</option>
              </select>
            </div>
            <div className="space-y-4">
              <Input
                type="file"
                accept=".txt,.md,.json,.csv"
                onChange={(event) => handleUpload(event.target.files?.[0] || null, setCasesInput)}
              />
              <Textarea
                value={casesInput}
                onChange={(event) => setCasesInput(event.target.value)}
                placeholder="Paste requirement content here..."
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    callApi("/api/ai/generate-test-cases", {
                      artifactType,
                      content: casesInput,
                    })
                  }
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => exportFile("csv")}
                  disabled={!exportRows.length}
                >
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => exportFile("xlsx")}
                  disabled={!exportRows.length}
                >
                  Export Excel
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {activeTab === "automation" ? (
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">Automation Script Generator</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Convert a manual test case into executable automation.
                </p>
              </div>
              <select
                value={framework}
                onChange={(event) => setFramework(event.target.value)}
                className="rounded-full border border-[var(--surface-border)] bg-white px-4 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="selenium">Selenium</option>
                <option value="cypress">Cypress</option>
                <option value="playwright">Playwright</option>
              </select>
            </div>
            <Textarea
              value={automationInput}
              onChange={(event) => setAutomationInput(event.target.value)}
              placeholder="Describe the test case to automate..."
            />
            <div className="mt-4">
              <Button
                onClick={() =>
                  callApi("/api/ai/automation-script", {
                    framework,
                    content: automationInput,
                  })
                }
                disabled={loading}
              >
                {loading ? "Generating..." : "Generate Script"}
              </Button>
            </div>
          </Card>
        ) : null}

        {activeTab === "bug" ? (
          <Card>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Bug Analyzer</h2>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              Paste stack traces, console errors, or logs to get a root-cause summary.
            </p>
            <Textarea
              value={bugInput}
              onChange={(event) => setBugInput(event.target.value)}
              placeholder="Paste logs or stack traces..."
            />
            <div className="mt-4">
              <Button
                onClick={() => callApi("/api/ai/bug-analyzer", { content: bugInput })}
                disabled={loading}
              >
                {loading ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          </Card>
        ) : null}

        {activeTab === "data" ? (
          <Card>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Test Data Generator</h2>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              Describe the domain and constraints for the dummy data you need.
            </p>
            <Textarea
              value={dataInput}
              onChange={(event) => setDataInput(event.target.value)}
              placeholder="Example: Generate onboarding data for a fintech app with valid and invalid KYC records."
            />
            <div className="mt-4">
              <Button
                onClick={() => callApi("/api/ai/test-data", { content: dataInput })}
                disabled={loading}
              >
                {loading ? "Generating..." : "Generate Data"}
              </Button>
            </div>
          </Card>
        ) : null}

        {activeTab === "report" ? (
          <Card>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Test Report Generator</h2>
            <p className="mb-4 text-sm text-[var(--muted-foreground)]">
              Upload or paste raw test results to generate a professional QA summary.
            </p>
            <Input
              type="file"
              accept=".txt,.md,.json,.csv"
              onChange={(event) => handleUpload(event.target.files?.[0] || null, setReportInput)}
            />
            <Textarea
              className="mt-4"
              value={reportInput}
              onChange={(event) => setReportInput(event.target.value)}
              placeholder="Paste test execution output..."
            />
            <div className="mt-4">
              <Button
                onClick={() => callApi("/api/ai/test-report", { content: reportInput })}
                disabled={loading}
              >
                {loading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="min-h-72">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-[var(--foreground)]">AI Output</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Results appear here and update based on the selected QA workflow.
              </p>
            </div>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-muted)] p-5 text-sm leading-7 text-[var(--foreground)]">
            {result || "Your generated output will appear here."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
