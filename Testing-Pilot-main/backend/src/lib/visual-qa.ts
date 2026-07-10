import sharp from "sharp";
import { chromium } from "playwright-chromium";

type DiffRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  severity: "Low" | "Medium" | "High";
  summary: string;
};

type VisualComparisonResult = {
  liveScreenshot: string;
  referenceScreenshot: string;
  highlightedScreenshot: string;
  diffRegions: DiffRegion[];
  matchScore: number;
};

const SCREENSHOT_WIDTH = 1440;
const SCREENSHOT_HEIGHT = 1600;
const CELL_SIZE = 48;

export type LivePageStructure = {
  html: string;
  text: string;
  headings: string[];
  sections: Array<{ heading: string; content: string }>;
};

async function createBrowserPage() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage({
    viewport: { width: SCREENSHOT_WIDTH, height: 960 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  });

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });

  return { browser, page };
}

async function preparePage(page: Awaited<ReturnType<typeof createBrowserPage>>["page"], url: string) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch {
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
  }

  await page.waitForTimeout(1800);

  await page.evaluate(async () => {
    const dismissSelectors = [
      "button[aria-label*='close' i]",
      "button[aria-label*='dismiss' i]",
      "button[aria-label*='accept' i]",
      "button[id*='accept' i]",
      "[data-testid*='accept' i]",
      ".cookie-banner button",
      "#onetrust-accept-btn-handler",
      ".onetrust-close-btn-handler",
    ];

    for (const selector of dismissSelectors) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
      for (const element of elements.slice(0, 2)) {
        try {
          element.click();
        } catch {
          // Ignore dismiss failures.
        }
      }
    }

    const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
    const maxScroll = Math.min(document.body.scrollHeight, window.innerHeight * 8);

    for (let offset = 0; offset < maxScroll; offset += step) {
      window.scrollTo({ top: offset, behavior: "instant" as ScrollBehavior });
      await new Promise((resolve) => setTimeout(resolve, 180));
    }

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  });

  await page.waitForTimeout(1200);
}

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapLines(text: string, maxLength = 54) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) {
        lines.push(current.trim());
      }
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current) {
    lines.push(current.trim());
  }

  return lines.slice(0, 18);
}

function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function describeRegion(x: number, y: number, width: number, height: number, imageWidth: number, imageHeight: number) {
  const horizontal =
    x + width / 2 < imageWidth / 3 ? "left" : x + width / 2 > (imageWidth * 2) / 3 ? "right" : "center";
  const vertical =
    y + height / 2 < imageHeight / 3 ? "top" : y + height / 2 > (imageHeight * 2) / 3 ? "bottom" : "middle";

  return `${vertical} ${horizontal}`.trim();
}

function normalizeSeverity(score: number): "Low" | "Medium" | "High" {
  if (score > 80) {
    return "High";
  }

  if (score > 45) {
    return "Medium";
  }

  return "Low";
}

function mergeDiffCells(
  cells: Array<{ x: number; y: number; width: number; height: number; score: number }>,
  imageWidth: number,
  imageHeight: number,
) {
  const merged: DiffRegion[] = [];

  for (const cell of cells) {
    const existing = merged.find(
      (region) =>
        Math.abs(region.x - cell.x) <= CELL_SIZE &&
        Math.abs(region.y - cell.y) <= CELL_SIZE &&
        Math.abs(region.width - cell.width) <= CELL_SIZE * 2,
    );

    if (existing) {
      const right = Math.max(existing.x + existing.width, cell.x + cell.width);
      const bottom = Math.max(existing.y + existing.height, cell.y + cell.height);
      existing.x = Math.min(existing.x, cell.x);
      existing.y = Math.min(existing.y, cell.y);
      existing.width = right - existing.x;
      existing.height = bottom - existing.y;
      existing.severity = normalizeSeverity(cell.score);
      existing.summary = `Visible mismatch detected in the ${describeRegion(existing.x, existing.y, existing.width, existing.height, imageWidth, imageHeight)} section.`;
      continue;
    }

    merged.push({
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
      label: describeRegion(cell.x, cell.y, cell.width, cell.height, imageWidth, imageHeight),
      severity: normalizeSeverity(cell.score),
      summary: `Visible mismatch detected in the ${describeRegion(cell.x, cell.y, cell.width, cell.height, imageWidth, imageHeight)} section.`,
    });
  }

  return merged.slice(0, 8);
}

async function drawRegions(buffer: Buffer, regions: DiffRegion[]) {
  if (!regions.length) {
    return bufferToDataUrl(buffer, "image/png");
  }

  const svg = `
    <svg width="${SCREENSHOT_WIDTH}" height="${SCREENSHOT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${regions
        .map(
          (region) => `
            <rect
              x="${region.x}"
              y="${region.y}"
              width="${region.width}"
              height="${region.height}"
              rx="16"
              ry="16"
              fill="rgba(239,68,68,0.14)"
              stroke="rgba(248,113,113,0.95)"
              stroke-width="4"
            />
            <rect
              x="${region.x}"
              y="${Math.max(region.y - 36, 8)}"
              width="${Math.max(180, region.label.length * 10)}"
              height="28"
              rx="10"
              ry="10"
              fill="rgba(15,23,42,0.92)"
              stroke="rgba(248,113,113,0.8)"
              stroke-width="1"
            />
            <text
              x="${region.x + 12}"
              y="${Math.max(region.y - 18, 26)}"
              fill="white"
              font-size="14"
              font-family="Arial, sans-serif"
            >${region.label}</text>
          `,
        )
        .join("")}
    </svg>
  `;

  const output = await sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return bufferToDataUrl(output, "image/png");
}

async function buildReferencePreview({
  referenceImage,
  referenceText,
  sourceName,
}: {
  referenceImage?: Buffer;
  referenceText?: string;
  sourceName?: string;
}) {
  if (referenceImage) {
    return sharp(referenceImage)
      .resize(SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT, {
        fit: "cover",
        position: "top",
      })
      .png()
      .toBuffer();
  }

  const title = escapeXml(sourceName || "Uploaded document");
  const textLines = wrapLines(referenceText || "No extracted content available for visual preview.").map(escapeXml);

  const svg = `
    <svg width="${SCREENSHOT_WIDTH}" height="${SCREENSHOT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#082f49" />
          <stop offset="100%" stop-color="#020617" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect x="80" y="80" width="${SCREENSHOT_WIDTH - 160}" height="${SCREENSHOT_HEIGHT - 160}" rx="36" ry="36" fill="rgba(15,23,42,0.92)" stroke="rgba(103,232,249,0.22)" stroke-width="2" />
      <text x="120" y="170" fill="#67e8f9" font-size="26" font-family="Arial, sans-serif" letter-spacing="3">REFERENCE PREVIEW</text>
      <text x="120" y="230" fill="white" font-size="42" font-family="Arial, sans-serif" font-weight="700">${title}</text>
      ${textLines
        .map(
          (line, index) => `
            <text x="120" y="${320 + index * 58}" fill="#cbd5e1" font-size="28" font-family="Arial, sans-serif">${line}</text>
          `,
        )
        .join("")}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function captureLivePageScreenshot(url: string) {
  const { browser, page } = await createBrowserPage();

  try {
    await preparePage(page, url);
    const screenshot = await page.screenshot({
      fullPage: true,
      type: "png",
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

export async function captureLivePageStructure(url: string): Promise<LivePageStructure> {
  const { browser, page } = await createBrowserPage();

  try {
    await preparePage(page, url);

    const data = (await page.evaluate(`
      (() => {
        const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
        const isVisible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || "1") > 0 &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const collectTextBlocks = (root) =>
          Array.from(root.querySelectorAll("p, li, blockquote, article p, main p, section p, div"))
            .filter((element) => isVisible(element))
            .map((element) => normalize(element.textContent || ""))
            .filter((text) => text.length > 40 && text.length < 800);
        const root =
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.querySelector("[role='main']") ||
          document.querySelector(".post-content") ||
          document.querySelector(".blog-content") ||
          document.querySelector(".content") ||
          document.querySelector(".entry-content") ||
          document.querySelector(".elementor-widget-theme-post-content") ||
          document.querySelector(".elementor-location-single") ||
          document.body;

        const headingSelector = "h1, h2, h3, h4, h5, h6, .elementor-heading-title";
        const headingElements = Array.from(root.querySelectorAll(headingSelector)).filter((element) => isVisible(element));
        const headings = headingElements
          .map((element) => normalize(element.textContent || ""))
          .filter(Boolean);

        const sections = headings.slice(0, 12).map((heading) => {
          const headingElement = headingElements.find(
            (element) => normalize(element.textContent || "") === heading
          );

          let node = headingElement ? headingElement.nextElementSibling : null;
          const chunks = [];

          while (node && chunks.length < 6) {
            const tag = (node.tagName || "").toLowerCase();
            if (/^h[1-6]$/.test(tag) || node.matches(headingSelector)) {
              break;
            }

            const text = normalize((node.textContent || "").trim());
            if (text && text.length > 30) {
              chunks.push(text);
            }
            node = node.nextElementSibling;
          }

          return { heading, content: chunks.join(" ") };
        });

        const blockTexts = collectTextBlocks(root);
        const fallbackText = normalize((document.body.innerText || root.textContent || "").trim());
        const combinedText = normalize(
          headings.slice(0, 20)
            .concat(sections.flatMap((section) => [section.heading, section.content]))
            .concat(blockTexts.slice(0, 80))
            .join(" ")
        );

        return {
          html: root.outerHTML || document.documentElement.outerHTML,
          text: combinedText.length > fallbackText.length * 0.35 ? combinedText : fallbackText,
          headings,
          sections
        };
      })()
    `)) as {
      html: string;
      text: string;
      headings: string[];
      sections: Array<{ heading: string; content: string }>;
    };

    return {
      html: data.html,
      text: data.text,
      headings: [...new Set(data.headings)].slice(0, 12),
      sections: data.sections.filter((section) => section.heading),
    };
  } finally {
    await browser.close();
  }
}

export async function compareVisualReferences({
  liveUrl,
  referenceImage,
  referenceText,
  sourceName,
}: {
  liveUrl: string;
  referenceImage?: Buffer;
  referenceText?: string;
  sourceName?: string;
}): Promise<VisualComparisonResult> {
  const liveScreenshotBuffer = await captureLivePageScreenshot(liveUrl);

  const normalizedLive = await sharp(liveScreenshotBuffer)
    .resize(SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT, {
      fit: "cover",
      position: "top",
    })
    .png()
    .toBuffer();

  const normalizedReference = await buildReferencePreview({
    referenceImage,
    referenceText,
    sourceName,
  });

  const liveRaw = await sharp(normalizedLive).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const referenceRaw = await sharp(normalizedReference).raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  const diffCells: Array<{ x: number; y: number; width: number; height: number; score: number }> = [];
  let differingPixels = 0;
  const totalPixels = SCREENSHOT_WIDTH * SCREENSHOT_HEIGHT;

  for (let y = 0; y < SCREENSHOT_HEIGHT; y += CELL_SIZE) {
    for (let x = 0; x < SCREENSHOT_WIDTH; x += CELL_SIZE) {
      let cellScore = 0;
      let pixelCount = 0;

      for (let cy = y; cy < Math.min(y + CELL_SIZE, SCREENSHOT_HEIGHT); cy += 2) {
        for (let cx = x; cx < Math.min(x + CELL_SIZE, SCREENSHOT_WIDTH); cx += 2) {
          const index = (cy * SCREENSHOT_WIDTH + cx) * 4;
          const diff =
            Math.abs(liveRaw.data[index] - referenceRaw.data[index]) +
            Math.abs(liveRaw.data[index + 1] - referenceRaw.data[index + 1]) +
            Math.abs(liveRaw.data[index + 2] - referenceRaw.data[index + 2]);

          cellScore += diff / 3;
          pixelCount += 1;

          if (diff > 90) {
            differingPixels += 1;
          }
        }
      }

      const normalizedScore = cellScore / Math.max(pixelCount, 1);

      if (normalizedScore > 38) {
        diffCells.push({
          x,
          y,
          width: Math.min(CELL_SIZE, SCREENSHOT_WIDTH - x),
          height: Math.min(CELL_SIZE, SCREENSHOT_HEIGHT - y),
          score: normalizedScore,
        });
      }
    }
  }

  const diffRegions = mergeDiffCells(
    diffCells.sort((a, b) => b.score - a.score).slice(0, 24),
    SCREENSHOT_WIDTH,
    SCREENSHOT_HEIGHT,
  );

  const matchScore = Math.max(0, Math.min(100, Math.round(100 - (differingPixels / totalPixels) * 1000)));

  return {
    liveScreenshot: bufferToDataUrl(normalizedLive, "image/png"),
    referenceScreenshot: bufferToDataUrl(normalizedReference, "image/png"),
    highlightedScreenshot: await drawRegions(normalizedLive, diffRegions),
    diffRegions,
    matchScore,
  };
}
