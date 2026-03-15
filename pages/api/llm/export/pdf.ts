import type { NextApiRequest, NextApiResponse } from "next";
import { buildPdfBytes } from "@/lib/exportBuilders";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};

type ExportBody = {
  fileName?: string;
  originalCv?: string;
  rewrittenCv?: string;
  atsBefore?: number;
  atsAfter?: number;
  genAiBefore?: number;
  genAiAfter?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const {
      fileName = "rewritten-cv",
      originalCv = "",
      rewrittenCv = "",
      atsBefore = 0,
      atsAfter = 0,
      genAiBefore = 0,
      genAiAfter = 0,
    } = req.body as ExportBody;

    const safeName = fileName.replace(/[^\w-]+/g, "_");

    const bytes = await buildPdfBytes({
      originalCv,
      rewrittenCv,
      atsBefore,
      atsAfter,
      genAiBefore,
      genAiAfter,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);

    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    console.error("PDF export error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to export PDF.",
    });
  }
}