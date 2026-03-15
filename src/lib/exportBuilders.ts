import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type ExportInput = {
  originalCv: string;
  rewrittenCv: string;
  atsBefore: number;
  atsAfter: number;
  genAiBefore: number;
  genAiAfter: number;
};

function splitLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd());
}

function sectionFromText(title: string, text: string): Paragraph[] {
  const lines = splitLines(text);

  const content = lines.length
    ? lines.map((line) =>
        new Paragraph({
          children: [new TextRun({ text: line || " ", size: 22 })],
          spacing: { after: 120 },
        })
      )
    : [
        new Paragraph({
          children: [new TextRun({ text: "No content available.", italics: true, size: 22 })],
          spacing: { after: 120 },
        }),
      ];

  return [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 180 },
    }),
    ...content,
  ];
}

export async function buildDocxBuffer(input: ExportInput): Promise<Buffer> {
  const stats: Paragraph[] = [
    new Paragraph({
      text: "CV Optimization Summary",
      heading: HeadingLevel.TITLE,
      spacing: { after: 220 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Original ATS: ${input.atsBefore}/100`, bold: true }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Improved ATS: ${input.atsAfter}/100`, bold: true }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Original GenAI Risk: ${input.genAiBefore}/100`, bold: true }),
      ],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `New GenAI Risk: ${input.genAiAfter}/100`, bold: true }),
      ],
      spacing: { after: 220 },
    }),
  ];

  const children: Paragraph[] = [
    ...stats,
    ...sectionFromText("Original CV", input.originalCv),
    ...sectionFromText("Rewritten CV", input.rewrittenCv),
  ];

  const sections: ISectionOptions[] = [
    {
      properties: {},
      children,
    },
  ];

  const doc = new Document({
    sections,
  });

  return Packer.toBuffer(doc);
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxCharsPerLine) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

function drawWrappedBlock(params: {
  page: PDFPage;
  font: PDFFont;
  title: string;
  text: string;
  startY: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  fontSize?: number;
  titleSize?: number;
}): number {
  const {
    page,
    font,
    title,
    text,
    startY,
    pageWidth,
    pageHeight,
    margin,
    fontSize = 11,
    titleSize = 16,
  } = params;

  let y = startY;

  if (y < 80) return y;

  page.drawText(title, {
    x: margin,
    y,
    size: titleSize,
    font,
    color: rgb(0.12, 0.16, 0.22),
  });

  y -= 24;

  const usableWidth = pageWidth - margin * 2;
  const approxCharsPerLine = Math.max(45, Math.floor(usableWidth / (fontSize * 0.52)));
  const lines = wrapText(text || "No content available.", approxCharsPerLine);

  for (const line of lines) {
    if (y < 60) {
      break;
    }

    page.drawText(line || " ", {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0.18, 0.21, 0.28),
    });

    y -= fontSize + 6;
  }

  return y - 12;
}

export async function buildPdfBytes(input: ExportInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4-ish
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 44;

  page.drawText("CV Optimization Summary", {
    x: margin,
    y: height - 56,
    size: 20,
    font: bold,
    color: rgb(0.08, 0.12, 0.2),
  });

  const summaryLines = [
    `Original ATS: ${input.atsBefore}/100`,
    `Improved ATS: ${input.atsAfter}/100`,
    `Original GenAI Risk: ${input.genAiBefore}/100`,
    `New GenAI Risk: ${input.genAiAfter}/100`,
  ];

  let y = height - 92;

  for (const line of summaryLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.18, 0.21, 0.28),
    });
    y -= 18;
  }

  y -= 10;

  y = drawWrappedBlock({
    page,
    font,
    title: "Original CV",
    text: input.originalCv,
    startY: y,
    pageWidth: width,
    pageHeight: height,
    margin,
    fontSize: 10,
    titleSize: 15,
  });

  if (y < 120) {
    const nextPage = pdfDoc.addPage([595, 842]);
    y = height - 56;

    nextPage.drawText("Rewritten CV", {
      x: margin,
      y,
      size: 18,
      font: bold,
      color: rgb(0.08, 0.12, 0.2),
    });

    y -= 28;

    drawWrappedBlock({
      page: nextPage,
      font,
      title: "",
      text: input.rewrittenCv,
      startY: y,
      pageWidth: width,
      pageHeight: height,
      margin,
      fontSize: 10,
      titleSize: 14,
    });
  } else {
    drawWrappedBlock({
      page,
      font,
      title: "Rewritten CV",
      text: input.rewrittenCv,
      startY: y,
      pageWidth: width,
      pageHeight: height,
      margin,
      fontSize: 10,
      titleSize: 15,
    });
  }

  return pdfDoc.save();
}