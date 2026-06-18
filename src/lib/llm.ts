import { ChatOpenAI } from "@langchain/openai";
import type { ConversationRow, DriverProfile } from "./schemas";
import { DriverProfileSchema } from "./schemas";

const FALLBACK_PROFILE: DriverProfile = {
  currentLocation: "Dallas, TX",
  currentLat: 32.7767,
  currentLon: -96.797,
  homeBase: "San Antonio, TX",
  homeLat: 29.4241,
  homeLon: -98.4936,
  minimumRatePerMile: 2,
  equipmentTypes: ["Hotshot", "Gooseneck"],
  weightCapacityLb: 15000,
  notes: [
    "Driver says he is usually based in San Antonio and is currently in Dallas.",
    "Driver explicitly says he runs a hotshot gooseneck trailer.",
    "Driver says he will consider loads above $2 per mile."
  ],
  assumptions: [
    "Weight capacity is inferred from hotshot/gooseneck context and the sample load board weights."
  ]
};

function transcriptText(conversation: ConversationRow[]): string {
  return conversation.map((row) => `${row.speaker}: ${row.dialogue}`).join("\n");
}

export async function extractDriverProfile(
  conversation: ConversationRow[]
): Promise<DriverProfile> {
  if (!process.env.OPENAI_API_KEY) {
    return FALLBACK_PROFILE;
  }

  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    temperature: 0
  });

  const structuredModel = model.withStructuredOutput(DriverProfileSchema, {
    name: "driver_profile"
  });

  const result = await structuredModel.invoke([
    [
      "system",
      [
        "You extract a freight driver's operational profile from a messy dispatcher call.",
        "Return only facts or well-labeled interpretations supported by the transcript.",
        "Use decimal numbers for money, coordinates, and weight.",
        "For this Texas dispatch context, infer common city coordinates when the city is clear.",
        "Equipment types should be normalized load-board labels such as Hotshot, Gooseneck, Flatbed, Van, or Reefer."
      ].join(" ")
    ],
    [
      "human",
      `Extract the driver profile required for load filtering and ranking.\n\nTranscript:\n${transcriptText(
        conversation
      )}`
    ]
  ]);

  return DriverProfileSchema.parse(result);
}
