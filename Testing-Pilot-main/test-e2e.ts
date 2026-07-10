import { chromium } from "playwright-chromium";
import dotenv from "dotenv";

dotenv.config();

const APP_URL = "http://localhost:3000";

async function runTest() {
  console.log("Starting End-to-End E2E Tests for QA Copilot...");
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 1. Go to login page
    console.log(`Navigating to ${APP_URL}/login...`);
    await page.goto(`${APP_URL}/login`);
    
    // 2. Log in
    console.log("Logging in as admin@qacopilot.ai...");
    await page.fill('input[placeholder="Work email"]', "admin@qacopilot.ai");
    await page.fill('input[placeholder="Password"]', "Admin@123");
    await page.click('button[type="submit"]');
    
    // Wait for URL redirect
    console.log("Waiting for redirection...");
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`Successfully logged in. Current URL: ${currentUrl}`);
    
    // If redirected to /admin, navigate to dashboard
    if (currentUrl.includes("/admin")) {
      console.log("Redirected to admin panel. Navigating to /dashboard...");
      await page.goto(`${APP_URL}/dashboard`);
      await page.waitForTimeout(2000);
    }
    
    console.log(`Current dashboard URL: ${page.url()}`);
    
    // 3. Create a project
    console.log("Creating a new project...");
    const projectName = `E2E Test Project - ${Date.now()}`;
    await page.fill('input[placeholder="Project name"]', projectName);
    await page.fill('textarea[placeholder="Short description, release goal, or module scope"]', "Automated test project for E2E validation");
    await page.click('button:has-text("Add project")');
    await page.waitForTimeout(2000);
    console.log(`Project "${projectName}" created.`);
    
    // Select the project from select dropdown to be sure
    console.log("Selecting the project from dropdown...");
    await page.selectOption('select:has-text("Choose a project")', { label: projectName });
    await page.waitForTimeout(1000);
    
    const report: Array<{ flow: string; status: "PASSED" | "FAILED"; details?: string }> = [];
    
    const testFlow = async (
      flowName: string,
      sidebarTabLabel: string,
      setupInputs: () => Promise<void>,
      submitButtonText: string
    ) => {
      console.log(`\n--- Testing flow: ${flowName} ---`);
      try {
        // Click the sidebar tab
        console.log(`Clicking sidebar tab "${sidebarTabLabel}"...`);
        await page.click(`button:has-text("${sidebarTabLabel}")`);
        await page.waitForTimeout(1000);
        
        // Setup inputs
        console.log("Setting up inputs...");
        await setupInputs();
        
        // Click the submit button
        console.log(`Clicking button "${submitButtonText}"...`);
        await page.click(`button:has-text("${submitButtonText}")`);
        
        // Wait for the "Generating" loading indicator to appear and then disappear
        console.log("Waiting for AI generation to complete...");
        await page.waitForSelector("text=Generating", { state: "detached", timeout: 45000 });
        
        // Check if there are any errors or if output was displayed
        const pageText = await page.innerText("body");
        if (pageText.toLowerCase().includes("failed") && pageText.toLowerCase().includes("generation")) {
          throw new Error("Generation error displayed on page.");
        }
        
        console.log(`Flow "${flowName}" completed successfully.`);
        report.push({ flow: flowName, status: "PASSED" });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Flow "${flowName}" failed:`, errorMsg);
        
        // Capture a screenshot for debugging
        const screenshotPath = `screenshot-${flowName.replace(/\s+/g, "-")}.png`;
        await page.screenshot({ path: screenshotPath });
        console.log(`Saved failure screenshot to ${screenshotPath}`);
        
        report.push({ flow: flowName, status: "FAILED", details: errorMsg });
      }
    };
    
    // Tab 1: Test Design
    await testFlow(
      "Test Design",
      "Test Design",
      async () => {
        await page.fill(
          'textarea[placeholder="Describe the feature, acceptance criteria, business rules, user roles, and edge cases you want covered."]',
          "System must allow user to log in and view their personal profile page. Password must be hashed."
        );
      },
      "Generate premium test cases"
    );
    
    // Tab 2: Automation
    await testFlow(
      "Automation",
      "Automation",
      async () => {
        await page.fill(
          'textarea[placeholder="Describe the validated manual flow, assertions, and setup notes."]',
          "Test Case: Verify user profile load. Steps: 1. Login. 2. Navigate to Profile. 3. Verify user name is shown."
        );
      },
      "Generate script"
    );
    
    // Tab 3: Bug Analysis
    await testFlow(
      "Bug Analysis",
      "Bug Analysis",
      async () => {
        await page.fill(
          'textarea[placeholder="Describe what is happening in the screenshot or video, add reproduction steps, expected behavior, actual behavior, logs, or stack traces."]',
          "Bug: Page crash when user clicks on billing history button. Steps: 1. Go to dashboard. 2. Click billing. 3. Observe spinner spins forever."
        );
      },
      "Analyze bug"
    );
    
    // Tab 4: Test Data
    await testFlow(
      "Test Data",
      "Test Data",
      async () => {
        await page.fill(
          'textarea[placeholder="Describe the records and data rules you need."]',
          "List of 5 test user accounts with fields: first_name, last_name, email, registration_date."
        );
        await page.fill('input[placeholder="Number of records"]', "5");
      },
      "Generate test data"
    );
    
    // Tab 5: Reports
    await testFlow(
      "Reports",
      "Reports",
      async () => {
        await page.fill(
          'textarea[placeholder="Paste test execution results and QA notes."]',
          "Test Run #432. Passed: 15, Failed: 1 (Login validation fails when email has uppercase letters), Blocked: 0."
        );
      },
      "Generate report"
    );
    
    // Tab 6: API Testing
    await testFlow(
      "API Testing",
      "API Testing",
      async () => {
        await page.fill(
          'textarea[placeholder="Paste Swagger or OpenAPI content."]',
          "paths:\n  /api/login:\n    post:\n      summary: Authenticate user\n      parameters:\n        - name: body\n          in: body\n          schema:\n            type: object\n            properties:\n              username:\n                type: string\n              password:\n                type: string"
        );
      },
      "Generate API tests"
    );
    
    // Tab 7: Release Risk
    await testFlow(
      "Release Risk",
      "Release Risk",
      async () => {
        await page.fill('input[placeholder="Release name, for example Checkout v2 rollout"]', "Checkout v2 rollout");
        await page.fill('textarea[placeholder="Critical defects, one per line. Example: Payment fails for Visa cards on mobile Safari"]', "Payment fails for Visa cards on mobile Safari");
      },
      "Analyze release risk"
    );
    
    // Tab 8: Content Match
    await testFlow(
      "Content Match",
      "Content Match",
      async () => {
        await page.fill('input[placeholder="Published URL to validate"]', APP_URL);
        await page.fill('textarea[placeholder="Paste source content or extracted document text."]', "QA Copilot Command Center. Streamline your release testing workflow.");
      },
      "Run content match"
    );
    
    // Tab 9: Design Match
    await testFlow(
      "Design Match",
      "Design Match",
      async () => {
        await page.fill('input[placeholder="Live URL to compare against design"]', APP_URL);
        await page.fill('textarea[placeholder="Paste Figma notes, annotations, or design requirements."]', "Hero layout has a dark background and a teal gradient header.");
      },
      "Run design match"
    );
    
    // Tab 10: Bulk URL QA
    await testFlow(
      "Bulk URL QA",
      "Bulk URL QA",
      async () => {
        await page.fill('textarea[placeholder="Paste one URL per line or add sitemap targets."]', `${APP_URL}\n${APP_URL}/login`);
      },
      "Run bulk URL QA"
    );
    
    console.log("\n=================================");
    console.log("       E2E TESTS SUMMARY");
    console.log("=================================");
    let passedCount = 0;
    for (const item of report) {
      console.log(`- ${item.flow}: ${item.status}${item.details ? ` (${item.details})` : ""}`);
      if (item.status === "PASSED") passedCount++;
    }
    console.log(`\nPassed ${passedCount} / ${report.length} flows.`);
    console.log("=================================");
    
  } catch (globalErr) {
    console.error("Global E2E test runner crashed:", globalErr);
  } finally {
    await browser.close();
  }
}

runTest();
