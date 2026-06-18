import JSZip from "jszip";
import mammoth from "mammoth";
import type { ConversationRow } from "./schemas";

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function conversationFromText(text: string): ConversationRow[] {
  return normalizeText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) {
        return { speaker: "Unknown", dialogue: line };
      }

      return {
        speaker: line.slice(0, separator).trim() || "Unknown",
        dialogue: line.slice(separator + 1).trim()
      };
    })
    .filter((row) => row.dialogue);
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(buffer) });

  try {
    const result = await parser.getText();
    return normalizeText(result.text);
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(buffer)
  });
  return normalizeText(result.value);
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractPptxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const bNum = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return aNum - bNum;
    });

  const slides = await Promise.all(
    slideNames.map(async (name, index) => {
      const xml = await zip.files[name].async("string");
      const textRuns = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) =>
        decodeXmlText(match[1])
      );
      return [`Slide ${index + 1}`, ...textRuns.filter(Boolean)].join("\n");
    })
  );

  return normalizeText(slides.join("\n\n"));
}
