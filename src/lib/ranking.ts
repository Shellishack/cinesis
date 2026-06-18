import type {
  DriverProfile,
  Load,
  RankedLoad,
  RejectedLoad
} from "./schemas";

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMiles(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const latDelta = toRadians(toLat - fromLat);
  const lonDelta = toRadians(toLon - fromLon);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(lonDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

function normalizedEquipment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function trailerMatches(profile: DriverProfile, trailer: string): boolean {
  const loadTrailer = normalizedEquipment(trailer);
  return profile.equipmentTypes.some((equipment) => {
    const normalized = normalizedEquipment(equipment);
    return normalized === loadTrailer || normalized.includes(loadTrailer) || loadTrailer.includes(normalized);
  });
}

function incompleteReason(load: Load): string | null {
  if (load.price === null) {
    return "Missing price";
  }

  if (!load.destination || load.destination.toUpperCase() === "MISSING") {
    return "Missing destination";
  }

  if (
    load.originLat === null ||
    load.originLon === null ||
    load.destLat === null ||
    load.destLon === null
  ) {
    return "Missing coordinates";
  }

  if (load.weight === null) {
    return "Missing weight";
  }

  return null;
}

function rejection(load: Load, reason: string): RejectedLoad {
  return {
    loadId: load.loadId,
    reason,
    price: load.price,
    trailer: load.trailer
  };
}

export function rankLoads(profile: DriverProfile, loads: Load[]): {
  topLoads: RankedLoad[];
  rejectedLoads: RejectedLoad[];
  incompleteLoads: RejectedLoad[];
} {
  const rejectedLoads: RejectedLoad[] = [];
  const incompleteLoads: RejectedLoad[] = [];
  const eligible: Omit<RankedLoad, "rank">[] = [];

  for (const load of loads) {
    const incomplete = incompleteReason(load);
    if (incomplete) {
      incompleteLoads.push(rejection(load, incomplete));
      continue;
    }

    if (!trailerMatches(profile, load.trailer)) {
      rejectedLoads.push(rejection(load, `Trailer ${load.trailer} does not match ${profile.equipmentTypes.join(", ")}`));
      continue;
    }

    if ((load.weight ?? 0) > profile.weightCapacityLb) {
      rejectedLoads.push(rejection(load, `Weight ${load.weight} exceeds ${profile.weightCapacityLb} lb capacity`));
      continue;
    }

    const deadheadToOrigin = haversineMiles(
      profile.currentLat,
      profile.currentLon,
      load.originLat as number,
      load.originLon as number
    );
    const loadedMiles = haversineMiles(
      load.originLat as number,
      load.originLon as number,
      load.destLat as number,
      load.destLon as number
    );
    const deadheadHome = haversineMiles(
      load.destLat as number,
      load.destLon as number,
      profile.homeLat,
      profile.homeLon
    );
    const totalMiles = deadheadToOrigin + loadedMiles + deadheadHome;
    const effectiveRatePerMile = (load.price as number) / totalMiles;

    if (effectiveRatePerMile < profile.minimumRatePerMile) {
      rejectedLoads.push(
        rejection(load, `Effective rate $${effectiveRatePerMile.toFixed(3)}/mi is below $${profile.minimumRatePerMile.toFixed(2)}/mi minimum`)
      );
      continue;
    }

    eligible.push({
      ...load,
      deadheadToOrigin,
      loadedMiles,
      deadheadHome,
      totalMiles,
      effectiveRatePerMile
    });
  }

  const topLoads = eligible
    .sort((a, b) => b.effectiveRatePerMile - a.effectiveRatePerMile)
    .slice(0, 3)
    .map((load, index) => ({
      ...load,
      rank: index + 1,
      deadheadToOrigin: Number(load.deadheadToOrigin.toFixed(1)),
      loadedMiles: Number(load.loadedMiles.toFixed(1)),
      deadheadHome: Number(load.deadheadHome.toFixed(1)),
      totalMiles: Number(load.totalMiles.toFixed(1)),
      effectiveRatePerMile: Number(load.effectiveRatePerMile.toFixed(3))
    }));

  return { topLoads, rejectedLoads, incompleteLoads };
}

export function buildReadme(
  profile: DriverProfile,
  rejectedLoads: RejectedLoad[],
  incompleteLoads: RejectedLoad[]
): string {
  const highPayRejected = [...rejectedLoads]
    .filter((load) => load.price !== null)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];

  return [
    "The profile is extracted from the conversation with an LLM using a strict JSON schema, then loads are ranked deterministically.",
    `I treat the driver as currently in ${profile.currentLocation}, based from ${profile.homeBase}, running ${profile.equipmentTypes.join(" / ")} with a $${profile.minimumRatePerMile.toFixed(2)}/mi minimum.`,
    `Incomplete rows are excluded before scoring; ${incompleteLoads.length} row(s) were skipped for missing price, destination, coordinates, or weight.`,
    highPayRejected
      ? `A high-paying rejected load was ${highPayRejected.loadId}: ${highPayRejected.reason}.`
      : "No priced rejected load was available to cite."
  ].join(" ");
}
