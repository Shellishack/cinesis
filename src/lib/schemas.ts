import { z } from "zod";

export const DriverProfileSchema = z.object({
  currentLocation: z.string(),
  currentLat: z.number(),
  currentLon: z.number(),
  homeBase: z.string(),
  homeLat: z.number(),
  homeLon: z.number(),
  minimumRatePerMile: z.number(),
  equipmentTypes: z.array(z.string()).min(1),
  weightCapacityLb: z.number(),
  notes: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([])
});

export type DriverProfile = z.infer<typeof DriverProfileSchema>;

export const ConversationRowSchema = z.object({
  speaker: z.string(),
  dialogue: z.string()
});

export type ConversationRow = z.infer<typeof ConversationRowSchema>;

export const LoadSchema = z.object({
  loadId: z.string(),
  origin: z.string(),
  originLat: z.number().nullable(),
  originLon: z.number().nullable(),
  destination: z.string(),
  destLat: z.number().nullable(),
  destLon: z.number().nullable(),
  trailer: z.string(),
  weight: z.number().nullable(),
  price: z.number().nullable()
});

export type Load = z.infer<typeof LoadSchema>;

export const RankedLoadSchema = LoadSchema.extend({
  rank: z.number(),
  deadheadToOrigin: z.number(),
  loadedMiles: z.number(),
  deadheadHome: z.number(),
  totalMiles: z.number(),
  effectiveRatePerMile: z.number()
});

export type RankedLoad = z.infer<typeof RankedLoadSchema>;

export type RejectedLoad = {
  loadId: string;
  reason: string;
  price: number | null;
  trailer: string;
};

export type AnalysisResult = {
  profile: DriverProfile;
  loads: Load[];
  topLoads: RankedLoad[];
  rejectedLoads: RejectedLoad[];
  incompleteLoads: RejectedLoad[];
  readme: string;
};
