import * as XLSX from "xlsx";
import { conversationFromText } from "./documents";
import type { ConversationRow, Load } from "./schemas";

type Row = unknown[];

function clean(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = clean(value).replace(/[$,]/g, "");
  if (!normalized || normalized.toUpperCase() === "MISSING") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): Row[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Missing required sheet: ${sheetName}`);
  }

  return XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: "" });
}

export function parseWorkbook(buffer: ArrayBuffer): {
  conversation: ConversationRow[];
  loads: Load[];
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  const conversationRows = getSheetRows(workbook, "Sample Conversation").slice(1);
  const loadRows = getSheetRows(workbook, "Loads").slice(1);

  const conversation = conversationRows
    .map((row) => ({
      speaker: clean(row[0]),
      dialogue: clean(row[1])
    }))
    .filter((row) => row.speaker && row.dialogue);

  const loads = loadRows
    .map((row) => ({
      loadId: clean(row[0]),
      origin: clean(row[1]),
      originLat: numberOrNull(row[2]),
      originLon: numberOrNull(row[3]),
      destination: clean(row[4]),
      destLat: numberOrNull(row[5]),
      destLon: numberOrNull(row[6]),
      trailer: clean(row[7]),
      weight: numberOrNull(row[8]),
      price: numberOrNull(row[9])
    }))
    .filter((load) => load.loadId);

  return { conversation, loads };
}

export function parseDelimitedText(text: string): {
  conversation: ConversationRow[];
  loads: Load[];
} {
  const workbook = XLSX.read(text, { type: "string" });
  const firstSheetName = workbook.SheetNames[0];
  const rows = firstSheetName
    ? XLSX.utils.sheet_to_json<Row>(workbook.Sheets[firstSheetName], {
        header: 1,
        defval: ""
      })
    : [];

  const header = rows[0]?.map((cell) => clean(cell).toLowerCase()) ?? [];
  const hasConversationColumns =
    header.includes("speaker") && header.includes("dialogue");

  if (hasConversationColumns) {
    const speakerIndex = header.indexOf("speaker");
    const dialogueIndex = header.indexOf("dialogue");
    return {
      conversation: rows
        .slice(1)
        .map((row) => ({
          speaker: clean(row[speakerIndex]),
          dialogue: clean(row[dialogueIndex])
        }))
        .filter((row) => row.speaker && row.dialogue),
      loads: []
    };
  }

  return {
    conversation: conversationFromText(text),
    loads: []
  };
}
