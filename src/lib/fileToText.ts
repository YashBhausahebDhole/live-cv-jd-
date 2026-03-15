import mammoth from "mammoth";

export function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
}

async function getPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser.");
  }

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.624/pdf.worker.min.mjs";
  }

  return pdfjsLib;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = await readAsArrayBuffer(file);

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((item) => item.str ?? "")
      .join(" ");
    fullText += `${pageText}\n`;
  }

  return fullText.trim();
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await readAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value?.trim() ?? "";
}

export async function extractTextFromTxt(file: File): Promise<string> {
  return (await file.text()).trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) return extractTextFromPdf(file);
  if (name.endsWith(".docx")) return extractTextFromDocx(file);
  if (name.endsWith(".txt")) return extractTextFromTxt(file);

  throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
}