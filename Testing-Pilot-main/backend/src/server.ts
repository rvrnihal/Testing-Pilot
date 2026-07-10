import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { adminRouter } from "./routes/admin";
import { aiRouter } from "./routes/ai";
import { authRouter } from "./routes/auth";
import { billingRouter } from "./routes/billing";
import { dashboardRouter } from "./routes/dashboard";
import { prisma } from "./lib/prisma";
import { requireAuth } from "./middleware/auth";
import { projectsRouter } from "./routes/projects";
import { execSync } from "child_process";

// Avoid blocking local API startup on browser installation. Set
// PLAYWRIGHT_INSTALL_ON_BOOT=true when runtime installation is required.
if (process.env.PLAYWRIGHT_INSTALL_ON_BOOT === "true") {
  try {
    console.log("Installing Playwright Chromium...");
    execSync("npx playwright install chromium", { stdio: "inherit" });
  } catch (e) {
    console.log("Playwright already installed or skipped");
  }
}
const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed =
        env.corsOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      callback(null, isAllowed);
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/me", requireAuth, async (request, response) => {
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

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ai", aiRouter);
app.use("/api/billing", billingRouter);

app.use(
  (error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      error: error.message || "Unexpected server error.",
    });
  },
);
app.get("/test-playwright", async (req, res) => {
  const { chromium } = require("playwright");

  try {
    const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});

    const page = await browser.newPage();
    await page.goto("https://example.com");

    const title = await page.title();

    await browser.close();

    res.json({ success: true, title });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(env.apiPort, env.apiHost, () => {
  console.log(`QA Copilot API running on http://${env.apiHost}:${env.apiPort}`);
});
