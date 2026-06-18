import { NextResponse } from "next/server";
import { parseDelimitedText, parseWorkbook } from "@/lib/excel";
import { extractDriverProfile } from "@/lib/llm";
import { buildReadme, rankLoads } from "@/lib/ranking";

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

function isText(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".json")
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a workbook, CSV, or text transcript." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { conversation, loads } =
      isSpreadsheet(file) && !file.name.toLowerCase().endsWith(".csv") && !file.name.toLowerCase().endsWith(".tsv")
        ? parseWorkbook(buffer)
        : isSpreadsheet(file) || isText(file)
          ? parseDelimitedText(new TextDecoder().decode(buffer))
          : { conversation: [], loads: [] };

    if (!conversation.length) {
      return NextResponse.json(
        {
          error:
            "This file could not be read as a supported transcript. Upload .xlsx, .csv, .tsv, .txt, .md, or another text-based file."
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
