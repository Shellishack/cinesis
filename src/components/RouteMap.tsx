"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip
} from "react-leaflet";
import { Route } from "lucide-react";
import type { AnalysisResult, DriverProfile, Load } from "@/lib/schemas";

type RouteStatus = "eligible" | "rejected" | "incomplete";

type RouteItem = {
  load: Load;
  status: RouteStatus;
  reason: string;
  effectiveRatePerMile?: number;
  rank?: number;
};

const LeafletMapContainer = MapContainer as unknown as (props: {
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  scrollWheelZoom: boolean;
  className: string;
  children: ReactNode;
}) => ReactNode;

const LeafletTileLayer = TileLayer as unknown as (props: {
  attribution: string;
  url: string;
}) => ReactNode;

const LeafletPolyline = Polyline as unknown as (props: {
  pathOptions: {
    color: string;
    opacity: number;
    weight: number;
  };
  positions: [number, number][];
  eventHandlers: {
    mouseover: () => void;
    click: () => void;
  };
  children: ReactNode;
}) => ReactNode;

const LeafletCircleMarker = CircleMarker as unknown as (props: {
  center: [number, number];
  radius: number;
  pathOptions: {
    color: string;
    fillColor: string;
    fillOpacity: number;
  };
  children: ReactNode;
}) => ReactNode;

const LeafletTooltip = Tooltip as unknown as (props: {
  sticky?: boolean;
  children: ReactNode;
}) => ReactNode;

const LeafletPopup = Popup as unknown as (props: {
  children: ReactNode;
}) => ReactNode;

function routeColor(status: RouteStatus): string {
  if (status === "eligible") {
    return "#047857";
  }

  if (status === "rejected") {
    return "#b45309";
  }

  return "#78716c";
}

function routeOpacity(status: RouteStatus): number {
  return status === "incomplete" ? 0.35 : 0.8;
}

function buildMapRoutes(result: AnalysisResult): RouteItem[] {
  const topById = new Map(result.topLoads.map((load) => [load.loadId, load]));
  const rejectedById = new Map(result.rejectedLoads.map((load) => [load.loadId, load]));
  const incompleteById = new Map(result.incompleteLoads.map((load) => [load.loadId, load]));

  return result.loads.map((load) => {
    const topLoad = topById.get(load.loadId);
    if (topLoad) {
      return {
        load,
        status: "eligible",
        reason: `Ranked #${topLoad.rank} after filtering`,
        effectiveRatePerMile: topLoad.effectiveRatePerMile,
        rank: topLoad.rank
      };
    }

    const rejected = rejectedById.get(load.loadId);
    if (rejected) {
      return {
        load,
        status: "rejected",
        reason: rejected.reason
      };
    }

    const incomplete = incompleteById.get(load.loadId);
    return {
      load,
      status: "incomplete",
      reason: incomplete?.reason ?? "Not ranked"
    };
  });
}

function hasCoordinates(load: Load): load is Load & {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
} {
  return (
    load.originLat !== null &&
    load.originLon !== null &&
    load.destLat !== null &&
    load.destLon !== null
  );
}

export default function RouteMap({
  result,
  profile
}: {
  result: AnalysisResult;
  profile: DriverProfile;
}) {
  const routes = useMemo(() => buildMapRoutes(result), [result]);
  const [activeLoadId, setActiveLoadId] = useState<string | null>(null);
  const activeRoute =
    routes.find((route) => route.load.loadId === activeLoadId) ?? routes[0];
  const center: [number, number] = [29.9, -97.2];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="min-h-[420px] overflow-hidden rounded-md border border-stone-300 bg-stone-200">
        <LeafletMapContainer
          center={center}
          zoom={6}
          minZoom={4}
          maxZoom={12}
          scrollWheelZoom
          className="h-[420px] w-full"
        >
          <LeafletTileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {routes.map((route) => {
            if (!hasCoordinates(route.load)) {
              return null;
            }

            const color = routeColor(route.status);
            const isActive = activeLoadId === route.load.loadId;
            const current: [number, number] = [profile.currentLat, profile.currentLon];
            const origin: [number, number] = [route.load.originLat, route.load.originLon];
            const destination: [number, number] = [route.load.destLat, route.load.destLon];
            const home: [number, number] = [profile.homeLat, profile.homeLon];

            return (
              <LeafletPolyline
                key={route.load.loadId}
                pathOptions={{
                  color,
                  opacity: routeOpacity(route.status),
                  weight: isActive ? 6 : 4
                }}
                positions={[current, origin, destination, home]}
                eventHandlers={{
                  mouseover: () => setActiveLoadId(route.load.loadId),
                  click: () => setActiveLoadId(route.load.loadId)
                }}
              >
                <LeafletTooltip sticky>
                  {route.load.loadId}: {route.reason}
                </LeafletTooltip>
                <LeafletPopup>
                  <div className="grid gap-1 text-sm">
                    <strong>{route.load.loadId}</strong>
                    <span>
                      {route.load.origin} to {route.load.destination}
                    </span>
                    <span>{route.reason}</span>
                  </div>
                </LeafletPopup>
              </LeafletPolyline>
            );
          })}
          <LeafletCircleMarker
            center={[profile.currentLat, profile.currentLon]}
            radius={8}
            pathOptions={{ color: "#111827", fillColor: "#111827", fillOpacity: 1 }}
          >
            <LeafletTooltip>Current truck: {profile.currentLocation}</LeafletTooltip>
          </LeafletCircleMarker>
          <LeafletCircleMarker
            center={[profile.homeLat, profile.homeLon]}
            radius={8}
            pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 1 }}
          >
            <LeafletTooltip>Home base: {profile.homeBase}</LeafletTooltip>
          </LeafletCircleMarker>
        </LeafletMapContainer>
      </div>

      <div className="rounded-md border border-stone-300 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Route className="h-4 w-4 text-emerald-800" aria-hidden />
          Route Detail
        </h3>
        {activeRoute ? (
          <div className="grid gap-3 text-sm">
            <div>
              <div className="text-xs uppercase text-stone-500">Load</div>
              <div className="text-lg font-semibold">{activeRoute.load.loadId}</div>
            </div>
            <div>
              {activeRoute.load.origin} to {activeRoute.load.destination}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-stone-100 p-3">
                <div className="text-xs text-stone-500">Trailer</div>
                <div className="font-medium">{activeRoute.load.trailer}</div>
              </div>
              <div className="rounded-md bg-stone-100 p-3">
                <div className="text-xs text-stone-500">Price</div>
                <div className="font-medium">
                  {activeRoute.load.price === null
                    ? "Missing"
                    : `$${activeRoute.load.price.toFixed(0)}`}
                </div>
              </div>
            </div>
            <div className="rounded-md bg-stone-100 p-3">
              <div className="text-xs text-stone-500">Decision</div>
              <div className="font-medium">{activeRoute.reason}</div>
            </div>
            {activeRoute.effectiveRatePerMile ? (
              <div className="rounded-md bg-emerald-50 p-3 text-emerald-950">
                Effective rate: ${activeRoute.effectiveRatePerMile.toFixed(3)}/mi
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-700" /> Eligible
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-700" /> Rejected
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-stone-500" /> Incomplete
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-600">Hover a route to inspect it.</p>
        )}
      </div>
    </div>
  );
}
