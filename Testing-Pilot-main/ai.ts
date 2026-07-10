import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { parseUploadedFile } from "../lib/file-parser";
import { generateAuditPdfBuffer } from "../lib/report-pdf";
import { requireApprovedUser, requireAuth } from "../middleware/auth";
import {
  analyzeBug,
  analyzeBulkUrlQa,
  analyzeContentMatch,
  analyzeDesignMatch,
  analyzeReleaseRisk,
  generateApiTests,
  generateAutomationScript,
  generateTestCases,
  generateTestData,
  generateTestReport,
} from "../services/ai";

const upload = multer({
  storage: multer.memoryStorage(),
});

export const aiRouter = Router();

aiRouter.use(requireAuth, requireApprovedUser);

async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  return user;
}

aiRouter.post("/test-cases", upload.single("file"), async (request, response) => {
  const content = (await parseUploadedFile(request.file)) || String(request.body.content || "");
  const user = await getUser(request.auth!.userId);
  const result = await generateTestCases({
    user,
    input: content,
    projectId: request.body.projectId,
    sourceName: request.file?.originalname,
  });
  response.json(result);
});

aiRouter.post("/automation", async (request, response) => {
  const user = await getUser(request.auth!.userId);
  const result = await generateAutomationScript({
    user,
    input: String(request.body.content || ""),
    framework: String(request.body.framework || "playwright"),
    projectId: request.body.projectId,
  });
  response.json(result);
});

aiRouter.post("/bug-analyzer", async (request, response) => {
  const user = await getUser(request.auth!.userId);
  const result = await analyzeBug({
    user,
    input: String(request.body.content || ""),
    projectId: request.body.projectId,
  });
  response.json(result);
});

aiRouter.post("/test-data", upload.single("file"), async (request, response) => {
  const user = await getUser(request.auth!.userId);
  const result = await generateTestData({
    user,
    prompt: (await parseUploadedFile(request.file)) || String(request.body.prompt || ""),
    recordCount: Number(request.body.recordCount || 5),
    projectId: request.body.projectId,
  });
  response.json(result);
});

aiRouter.post("/test-report", upload.single("file"), async (request, response) => {
  const content = (await parseUploadedFile(request.file)) || String(request.body.content || "");
  const user = await getUser(request.auth!.userId);
  const result = await generateTestReport({
    user,
    input: content,
    projectId: request.body.projectId,
  });
  response.json(result);
});

aiRouter.post("/api-tests", upload.single("file"), async (request, response) => {
  const content = (await parseUploadedFile(request.file)) || String(request.body.content || "");
  const user = await getUser(request.auth!.userId);
  const result = await generateApiTests({
    user,
    input: content,
    projectId: request.body.projectId,
  });
  response.json(result);
});

aiRouter.post("/release-risk", async (request, response) => {
  const user = await getUser(request.auth!.userId);
  const result = await analyzeReleaseRisk({
    user,
    input: String(request.body.content || ""),
    projectId: request.body.projectId,
  });
  response.json(result);
});

aiRouter.post("/content-match", upload.single("file"), async (request, response) => {
  const referenceContent = (await parseUploadedFile(request.file)) || String(request.body.referenceContent || "");
  const user = await getUser(request.auth!.userId);
  const result = await analyzeContentMatch({
    user,
    publishedUrl: String(request.body.publishedUrl || ""),
    referenceContent,
    referenceType: String(request.body.referenceType || "document"),
    screenshotDescription: String(request.body.screenshotDescription || ""),
    competitorUrl: String(request.body.competitorUrl || ""),
    projectId: request.body.projectId,
    sourceName: request.file?.originalname,
    referenceImage: request.file?.mimetype.startsWith("image/") ? request.file.buffer : undefined,
  });
  response.json(result);
});

aiRouter.post("/design-match", upload.single("file"), async (request, response) => {
  const designReference = (await parseUploadedFile(request.file)) || String(request.body.designReference || "");
  const user = await getUser(request.auth!.userId);
  const result = await analyzeDesignMatch({
    user,
    liveUrl: String(request.body.liveUrl || ""),
    designReference,
    componentScope: String(request.body.componentScope || ""),
    viewportTargets: String(request.body.viewportTargets || ""),
    screenshotDescription: String(request.body.screenshotDescription || ""),
    projectId: request.body.projectId,
    sourceName: request.file?.originalname,
    referenceImage: request.file?.mimetype.startsWith("image/") ? request.file.buffer : undefined,
  });
  response.json(result);
});

aiRouter.post("/bulk-url-qa", async (request, response) => {
  const user = await getUser(request.auth!.userId);
  const result = await analyzeBulkUrlQa({
    user,
    urls: String(request.body.urls || ""),
    deploymentContext: String(request.body.deploymentContext || ""),
    workflowNotes: String(request.body.workflowNotes || ""),
    projectId: request.body.projectId,
  });
  response.json(result);
});

aiRouter.post("/report-pdf", async (request, response) => {
  const result = request.body?.result;

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    response.status(400).json({ error: "A valid report result payload is required." });
    return;
  }

  const buffer = await generateAuditPdfBuffer(result as Record<string, unknown>, {
    label: typeof request.body?.label === "string" ? request.body.label : undefined,
    pageUrl: typeof request.body?.pageUrl === "string" ? request.body.pageUrl : undefined,
    sourceName: typeof request.body?.sourceName === "string" ? request.body.sourceName : undefined,
    referenceType: typeof request.body?.referenceType === "string" ? request.body.referenceType : undefined,
    generatedAt: typeof request.body?.generatedAt === "string" ? request.body.generatedAt : undefined,
  });

  const baseName = typeof request.body?.label === "string" ? request.body.label : "qa-audit";
  const filename = `qa-copilot-${baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.pdf`;

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.send(buffer);
});
