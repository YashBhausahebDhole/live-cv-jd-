import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("POST only");
  }

  const { fileName = "rewritten-cv", content = "" } = req.body as {
    fileName?: string;
    content?: string;
  };

  if (!content.trim()) {
    return res.status(400).send("content is required");
  }

  const safeName = fileName.replace(/[^\w\-]+/g, "_");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.txt"`);
  return res.status(200).send(content);
}