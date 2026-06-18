import { describe, expect, it } from "vitest";
import { haversineMiles, rankLoads } from "./ranking";
import type { DriverProfile, Load } from "./schemas";

const profile: DriverProfile = {
  currentLocation: "Dallas, TX",
  currentLat: 32.7767,
  currentLon: -96.797,
  homeBase: "San Antonio, TX",
  homeLat: 29.4241,
  homeLon: -98.4936,
  minimumRatePerMile: 2,
  equipmentTypes: ["Hotshot", "Gooseneck"],
  weightCapacityLb: 15000,
  notes: [],
  assumptions: []
};

describe("haversineMiles", () => {
  it("computes a known Texas city distance", () => {
    expect(haversineMiles(32.7767, -96.797, 29.4241, -98.4936)).toBeCloseTo(252, 0);
  });
});

describe("rankLoads", () => {
  it("filters incomplete rows and ranks eligible loads by effective rate", () => {
    const loads: Load[] = [
      {
        loadId: "L08",
        origin: "Dallas",
        originLat: 32.7767,
        originLon: -96.797,
        destination: "McAllen",
        destLat: 26.2034,
        destLon: -98.23,
        trailer: "Hotshot",
        weight: 12600,
        price: 1700
      },
      {
        loadId: "L04",
        origin: "Plano",
        originLat: 33.0198,
        originLon: -96.6989,
        destination: "Memphis",
        destLat: 35.1495,
        destLon: -90.049,
        trailer: "Van",
        weight: 38000,
        price: 1500
      },
      {
        loadId: "L07",
        origin: "Tulsa",
        originLat: 36.154,
        originLon: -95.9928,
        destination: "MISSING",
        destLat: null,
        destLon: null,
        trailer: "Hotshot",
        weight: 13400,
        price: 1100
      }
    ];

    const result = rankLoads(profile, loads);
    expect(result.topLoads).toHaveLength(1);
    expect(result.topLoads[0].loadId).toBe("L08");
    expect(result.rejectedLoads[0].loadId).toBe("L04");
    expect(result.incompleteLoads[0].loadId).toBe("L07");
  });
});
