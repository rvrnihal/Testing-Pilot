const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");

const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "docs", "TOOL_DOCUMENTATION.md");
const outputPath = path.join(root, "docs", "QA_Copilot_Tool_Documentation.pdf");

function normalizeMarkdown(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, (match) => match.trim() + " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

function writeWrappedText(doc, text, options = {}) {
  const {
    x = 18,
    yState,
    maxWidth = 174,
    lineHeight = 7,
    font = "helvetica",
    fontStyle = "normal",
    fontSize = 11,
    gapAfter = 3,
  } = options;

  doc.setFont(font, fontStyle);
  doc.setFontSize(fontSize);

  const lines = doc.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    if (yState.value > 280) {
      doc.addPage();
      yState.value = 20;
    }
    doc.text(line, x, yState.value);
    yState.value += lineHeight;
  }

  yState.value += gapAfter;
}

function generatePdf() {
  const markdown = fs.readFileSync(inputPath, "utf8");
  const text = normalizeMarkdown(markdown);
  const lines = text.split("\n");

  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  const yState = { value: 20 };

  doc.setProperties({
    title: "QA Copilot Tool Documentation",
    subject: "Product documentation",
    author: "Codex",
    creator: "Codex",
  });

  writeWrappedText(doc, "QA Copilot Tool Documentation", {
    yState,
    fontStyle: "bold",
    fontSize: 18,
    lineHeight: 9,
    gapAfter: 6,
  });

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      yState.value += 2;
      continue;
    }

    const isBullet = line.trim().startsWith("• ");
    const isSectionLike =
      !isBullet &&
      line === line.trim() &&
      line.length <= 80 &&
      !line.endsWith(".") &&
      !line.endsWith(":");

    if (isSectionLike) {
      writeWrappedText(doc, line.trim(), {
        yState,
        fontStyle: "bold",
        fontSize: 13,
        lineHeight: 7,
        gapAfter: 2,
      });
      continue;
    }

    writeWrappedText(doc, line.trim(), {
      yState,
      x: isBullet ? 22 : 18,
      maxWidth: isBullet ? 170 : 174,
      fontSize: 11,
      lineHeight: 6,
      gapAfter: 1.5,
    });
  }

  fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
  console.log(outputPath);
}

generatePdf();
