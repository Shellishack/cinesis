import { describe, expect, it } from "vitest";
import { parseDelimitedText } from "./excel";

describe("parseDelimitedText", () => {
  it("parses speaker/dialogue CSV files", () => {
    const result = parseDelimitedText(
      "Speaker,Dialogue\nDriver,I am in Dallas\nDispatch,What trailer do you run?"
    );

    expect(result.conversation).toEqual([
      { speaker: "Driver", dialogue: "I am in Dallas" },
      { speaker: "Dispatch", dialogue: "What trailer do you run?" }
    ]);
  });

  it("parses plain text transcript lines", () => {
    const result = parseDelimitedText("Driver: I run hotshot\nNeed $2 per mile");

    expect(result.conversation).toEqual([
      { speaker: "Driver", dialogue: "I run hotshot" },
      { speaker: "Unknown", dialogue: "Need $2 per mile" }
    ]);
  });
});
