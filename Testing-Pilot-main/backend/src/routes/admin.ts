import { ApprovalStatus } from "@prisma/client";
import { Router } from "express";
import { getAiProviderStatus } from "../lib/openai";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireApprovedUser, requireAuth } from "../middleware/auth";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireApprovedUser, requireAdmin);

adminRouter.get("/overview", async (_request, response) => {
  const [users, plans, usageEvents] = await Promise.all([
    prisma.user.findMany({
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        usageEvents: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionPlan.findMany({ orderBy: { priceMonthly: "asc" } }),
    prisma.usageEvent.findMany(),
  ]);

  response.json({
    users,
    plans,
    usageBreakdown: usageEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + event.creditsUsed;
      return acc;
    }, {}),
    stats: {
      totalUsers: users.length,
      pendingUsers: users.filter((user) => user.approvalStatus === ApprovalStatus.PENDING).length,
      approvedUsers: users.filter((user) => user.approvalStatus === ApprovalStatus.APPROVED).length,
      totalCreditsUsed: usageEvents.reduce((sum, event) => sum + event.creditsUsed, 0),
    },
  });
});

adminRouter.get("/users/:id", async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.params.id },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
      usageEvents: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    response.status(404).json({ error: "User not found." });
    return;
  }

  const creditsUsed = user.usageEvents.reduce((sum, event) => sum + event.creditsUsed, 0);
  const actions = user.usageEvents.length;
  const tokensUsed = creditsUsed * 25 + actions * 10;
  const planCredits = user.subscription?.plan.creditsPerMonth ?? 250;
  const tokensLimit = Math.max(planCredits * 40, 10000);
  const tokensRemaining = Math.max(tokensLimit - tokensUsed, 0);

  response.json({
    user: {
      ...user,
      creditsUsed,
      actions,
    },
  });
});

adminRouter.get("/ai-provider", async (_request, response) => {
  response.json({ provider: getAiProviderStatus() });
});

adminRouter.post("/users/:id/credits", async (request, response) => {
  const creditsToAdd = Number(request.body?.creditsToAdd);

  if (!Number.isFinite(creditsToAdd) || !Number.isInteger(creditsToAdd) || creditsToAdd <= 0) {
    response.status(400).json({ error: "creditsToAdd must be a positive integer." });
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: request.params.id },
    select: { creditsBalance: true, name: true },
  });

  if (!existingUser) {
    response.status(404).json({ error: "User not found." });
    return;
  }

  const MAX_INT = 2147483647;
  if (existingUser.creditsBalance + creditsToAdd > MAX_INT) {
    response.status(400).json({
      error: `Assigning these credits would exceed the maximum allowed limit of ${MAX_INT} credits.`,
    });
    return;
  }

  const user = await prisma.user.update({
    where: { id: request.params.id },
    data: {
      creditsBalance: {
        increment: creditsToAdd,
      },
    },
    select: {
      id: true,
      name: true,
      creditsBalance: true,
    },
  });

  response.json({
    message: `${creditsToAdd} credits assigned to ${user.name}.`,
    user,
  });
});

adminRouter.post("/users/:id/approve", async (request, response) => {
  const user = await prisma.user.update({
    where: { id: request.params.id },
    data: {
      approvalStatus: ApprovalStatus.APPROVED,
      subscription: {
        update: {
          status: "active",
        },
      },
    },
  });

  response.json({ message: `${user.name} approved.` });
});

adminRouter.post("/users/:id/reject", async (request, response) => {
  const user = await prisma.user.update({
    where: { id: request.params.id },
    data: {
      approvalStatus: ApprovalStatus.REJECTED,
      subscription: {
        update: {
          status: "rejected",
        },
      },
    },
  });

  response.json({ message: `${user.name} rejected.` });
});

adminRouter.post("/users/:id/terminate", async (request, response) => {
  const user = await prisma.user.update({
    where: { id: request.params.id },
    data: {
      approvalStatus: ApprovalStatus.REJECTED,
      subscription: {
        update: {
          status: "rejected",
        },
      },
    },
  });

  response.json({ message: `${user.name} terminated.` });
});

adminRouter.post("/plans/:slug", async (request, response) => {
  const { creditsPerMonth, priceMonthly, description, features } = request.body;

  const plan = await prisma.subscriptionPlan.update({
    where: { slug: request.params.slug },
    data: {
      creditsPerMonth,
      priceMonthly,
      description,
      features,
    },
  });

  response.json({ plan });
});
