import { Router } from "express";
import Stripe from "stripe";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { requireApprovedUser, requireAuth } from "../middleware/auth";

export const billingRouter = Router();

billingRouter.use(requireAuth, requireApprovedUser);

billingRouter.post("/checkout", async (request, response) => {
  const { planSlug } = request.body;
  const user = await prisma.user.findUnique({
    where: { id: request.auth!.userId },
  });
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { slug: planSlug },
  });

  if (!user || !plan) {
    response.status(404).json({ error: "User or plan not found." });
    return;
  }

  if (!env.stripeSecretKey || !plan.stripePriceId) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        creditsBalance: plan.creditsPerMonth,
        subscription: {
          upsert: {
            create: {
              planId: plan.id,
              status: "active",
            },
            update: {
              planId: plan.id,
              status: "active",
            },
          },
        },
      },
    });

    response.json({
      message: "Stripe is not configured, so the subscription was updated locally.",
    });
    return;
  }

  const stripe = new Stripe(env.stripeSecretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    success_url: `${env.appUrl}/dashboard?billing=success`,
    cancel_url: `${env.appUrl}/dashboard?billing=cancelled`,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    metadata: {
      userId: user.id,
      planId: plan.id,
    },
  });

  response.json({ url: session.url });
});

