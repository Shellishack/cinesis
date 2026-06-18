import { NextResponse } from "next/server";
import {
  conversationFromText,
  extractDocxText,
  extractPdfText,
  extractPptxText
} from "@/lib/documents";
import { parseDelimitedText, parseWorkbook } from "@/lib/excel";
import { extractDriverProfile } from "@/lib/llm";
import { buildReadme, rankLoads } from "@/lib/ranking";
import type { ConversationRow, Load } from "@/lib/schemas";

function isSpreadsheet(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm") ||
    name.endsWith(".csv") ||
    name.endsWith(".tsv")
  );
}

function extension(file: File): string {
  return file.name.toLowerCase().split(".").pop() ?? "";
}

function isText(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".json")
  );
}

function isDocument(file: File): boolean {
  return ["pdf", "docx", "pptx"].includes(extension(file));
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const passcode = formData.get("passcode");

    if (process.env.VISITOR_PASSCODE) {
      if (typeof passcode !== "string" || passcode !== process.env.VISITOR_PASSCODE) {
        return NextResponse.json(
          { error: "Invalid visitor passcode." },
          { status: 401 }
        );
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a workbook, document, presentation, PDF, CSV, or text transcript." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    let conversation: ConversationRow[] = [];
    let loads: Load[] = [];

    if (
      isSpreadsheet(file) &&
      !file.name.toLowerCase().endsWith(".csv") &&
      !file.name.toLowerCase().endsWith(".tsv")
    ) {
      const parsed = parseWorkbook(buffer);
      conversation = parsed.conversation;
      loads = parsed.loads;
    } else if (isSpreadsheet(file) || isText(file)) {
      const parsed = parseDelimitedText(new TextDecoder().decode(buffer));
      conversation = parsed.conversation;
      loads = parsed.loads;
    } else if (isDocument(file)) {
      const ext = extension(file);
      const text =
        ext === "pdf"
          ? await extractPdfText(buffer)
          : ext === "docx"
            ? await extractDocxText(buffer)
            : await extractPptxText(buffer);
      conversation = conversationFromText(text);
      loads = [];
    }

    if (!conversation.length) {
      return NextResponse.json(
        {
          error:
            "This file could not be read as a supported transcript. Upload .xlsx, .csv, .tsv, .txt, .md, .pdf, .docx, .pptx, or another text-based file."
        },
        { status: 400 }
      );
    }

    const profile = await extractDriverProfile(conversation);
    const { topLoads, rejectedLoads, incompleteLoads } = rankLoads(profile, loads);

    return NextResponse.json({
      profile,
      loads,
      topLoads,
      rejectedLoads,
      incompleteLoads,
      readme: buildReadme(profile, rejectedLoads, incompleteLoads)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze workbook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
