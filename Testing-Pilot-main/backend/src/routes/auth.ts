import { Router } from "express";
import { ApprovalStatus } from "@prisma/client";
import { comparePassword, hashPassword, signToken } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/register", async (request, response) => {
  const { name, email, password, company } = request.body;

  if (!name || !email || !password) {
    response.status(400).json({ error: "Name, email, and password are required." });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase() },
  });

  if (existing) {
    response.status(409).json({ error: "User already exists." });
    return;
  }

  const starter = await prisma.subscriptionPlan.findUnique({
    where: { slug: "starter" },
  });

  const user = await prisma.user.create({
    data: {
      name,
      email: String(email).toLowerCase(),
      company,
      passwordHash: await hashPassword(password),
      approvalStatus: ApprovalStatus.PENDING,
      creditsBalance: starter?.creditsPerMonth || 250,
      subscription: starter
        ? {
            create: {
              planId: starter.id,
              status: "pending_approval",
            },
          }
        : undefined,
    },
  });

  response.json({
    message: "Registration successful. An admin must approve the account before login.",
    userId: user.id,
  });
});

authRouter.post("/login", async (request, response) => {
  const { email, password } = request.body;

  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase() },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (user.approvalStatus !== ApprovalStatus.APPROVED) {
    response.status(403).json({ error: "Your account is pending admin approval." });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken({
    userId: user.id,
    role: user.role,
    approvalStatus: user.approvalStatus,
  });

  response.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus,
      creditsBalance: user.creditsBalance,
      subscription: user.subscription
        ? {
            status: user.subscription.status,
            plan: user.subscription.plan,
          }
        : null,
    },
  });
});

authRouter.get("/me", requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.auth!.userId },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!user) {
    response.status(404).json({ error: "User not found." });
    return;
  }

  response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus,
      creditsBalance: user.creditsBalance,
      subscription: user.subscription
        ? {
            status: user.subscription.status,
            plan: user.subscription.plan,
          }
        : null,
    },
  });
});

