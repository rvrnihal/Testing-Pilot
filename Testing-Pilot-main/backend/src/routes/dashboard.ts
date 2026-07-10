import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireApprovedUser, requireAuth } from "../middleware/auth";
import { creditsCatalog } from "../services/ai";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireApprovedUser);

dashboardRouter.get("/overview", async (request, response) => {
  const userId = request.auth!.userId;
  const [user, usageSummary, recentActivity, recentArtifacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        projects: {
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    prisma.usageEvent.aggregate({
      where: { userId },
      _sum: { creditsUsed: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.projectArtifact.findMany({
      where: {
        project: {
          ownerId: userId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  if (!user) {
    response.status(404).json({ error: "User not found." });
    return;
  }

  response.json({
    user,
    usageSummary: {
      creditsUsed: usageSummary._sum.creditsUsed ?? 0,
      actionsCount: usageSummary._count._all ?? 0,
    },
    recentActivity,
    recentArtifacts,
    projects: user.projects,
    creditCatalog: creditsCatalog,
    modules: [
      "AI content matcher for live URL vs document, image, and messaging validation",
      "AI design matcher for live URL vs Figma or design QA with responsive breakpoint review",
      "Bulk URL monitoring, regression QA, CI/CD alerts, and auto bug ticket generation",
      "AI exploratory testing agent",
      "AI accessibility testing",
      "AI performance test scenario generator",
      "AI security test generator",
      "AI UX quality analyzer",
    ],
  });
});
