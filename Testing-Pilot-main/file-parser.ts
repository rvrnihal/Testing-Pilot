import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

export async function parseUploadedFile(file?: Express.Multer.File | null) {
  if (!file) {
    return "";
  }

  const filename = file.originalname.toLowerCase();

  if (filename.endsWith(".txt") || filename.endsWith(".md") || filename.endsWith(".json")) {
    return file.buffer.toString("utf-8");
  }

  if (filename.endsWith(".csv")) {
    return file.buffer.toString("utf-8");
  }

  if (filename.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  if (filename.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(filename)) {
    return `Image asset uploaded for QA review: ${file.originalname}. Use provided screenshot notes or design context for visual comparison.`;
  }

  if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheetSummaries = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      return {
        sheetName,
        rowCount: rows.length,
        rows: rows.slice(0, 25),
      };
    });

    return JSON.stringify(
      {
        sourceFile: file.originalname,
        workbookSheets: sheetSummaries,
      },
      null,
      2,
    );
  }

  return file.buffer.toString("utf-8");
}
