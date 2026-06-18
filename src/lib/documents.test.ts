import { describe, expect, it } from "vitest";
import { conversationFromText } from "./documents";

describe("conversationFromText", () => {
  it("converts extracted document text into conversation rows", () => {
    expect(conversationFromText("Driver: Dallas today\nNeed hotshot loads")).toEqual([
      { speaker: "Driver", dialogue: "Dallas today" },
      { speaker: "Unknown", dialogue: "Need hotshot loads" }
    ]);
  });
});
