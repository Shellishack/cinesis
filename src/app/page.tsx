"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  BarChart3,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  UserRound
} from "lucide-react";
import type { AnalysisResult, DriverProfile, RankedLoad } from "@/lib/schemas";
import { buildReadme, rankLoads } from "@/lib/ranking";

type EditableProfile = DriverProfile;
type ViewMode = "driver" | "dispatcher";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false
});

function money(value: number): string {
  return `$${value.toFixed(3)}`;
}

function ProfileField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-stone-700">
      {label}
      <input
        className="h-10 rounded-md border border-stone-300 bg-white px-3 text-stone-950 outline-none focus:border-emerald-700"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TopLoadsTable({ loads }: { loads: RankedLoad[] }) {
  if (!loads.length) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        No eligible loads matched the extracted profile and minimum effective rate.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-stone-600">
            <th className="py-2 pr-4">Rank</th>
            <th className="py-2 pr-4">Load</th>
            <th className="py-2 pr-4">Lane</th>
            <th className="py-2 pr-4">Trailer</th>
            <th className="py-2 pr-4">Price</th>
            <th className="py-2 pr-4">Total Miles</th>
            <th className="py-2 pr-4">Effective Rate</th>
          </tr>
        </thead>
        <tbody>
          {loads.map((load) => (
            <tr key={load.loadId} className="border-b border-stone-200">
              <td className="py-3 pr-4 font-semibold">{load.rank}</td>
              <td className="py-3 pr-4">{load.loadId}</td>
              <td className="py-3 pr-4">
                {load.origin} to {load.destination}
              </td>
              <td className="py-3 pr-4">{load.trailer}</td>
              <td className="py-3 pr-4">${load.price?.toFixed(0)}</td>
              <td className="py-3 pr-4">{load.totalMiles.toFixed(1)}</td>
              <td className="py-3 pr-4 font-semibold text-emerald-800">
                {money(load.effectiveRatePerMile)}/mi
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DriverView({
  result,
  profile
}: {
  result: AnalysisResult;
  profile: DriverProfile;
}) {
  return (
    <section className="grid gap-5">
      <div className="grid gap-4 rounded-md border border-stone-300 bg-stone-950 p-4 text-white md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Driver Offer View</h2>
          <p className="text-sm text-stone-300">
            Current truck: {profile.currentLocation}. Home base: {profile.homeBase}.
          </p>
        </div>
        <div className="rounded-md bg-emerald-500 px-4 py-3 text-center text-stone-950">
          <div className="text-xs font-semibold uppercase">Best Offer</div>
          <div className="text-2xl font-bold">
            {result.topLoads[0] ? result.topLoads[0].loadId : "None"}
          </div>
        </div>
      </div>
      <RouteMap result={result} profile={profile} />
      <TopLoadsTable loads={result.topLoads} />
    </section>
  );
}

function DispatcherView({ result }: { result: AnalysisResult }) {
  const eligibleCount = result.topLoads.length;
  const rejectedCount = result.rejectedLoads.length;
  const incompleteCount = result.incompleteLoads.length;

  return (
    <section className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-stone-300 bg-white p-4">
          <div className="text-sm text-stone-500">Loads Reviewed</div>
          <div className="text-3xl font-semibold">{result.loads.length}</div>
        </div>
        <div className="rounded-md border border-stone-300 bg-white p-4">
          <div className="text-sm text-stone-500">Eligible Offers</div>
          <div className="text-3xl font-semibold text-emerald-800">{eligibleCount}</div>
        </div>
        <div className="rounded-md border border-stone-300 bg-white p-4">
          <div className="text-sm text-stone-500">Rejected</div>
          <div className="text-3xl font-semibold text-amber-700">{rejectedCount}</div>
        </div>
        <div className="rounded-md border border-stone-300 bg-white p-4">
          <div className="text-sm text-stone-500">Incomplete</div>
          <div className="text-3xl font-semibold text-stone-600">{incompleteCount}</div>
        </div>
      </div>
      <RouteMap result={result} profile={result.profile} />
      <section className="grid gap-4 rounded-md border border-stone-300 bg-white p-4 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">AI Analytics</h2>
          <p className="text-sm leading-6 text-stone-700">{result.readme}</p>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Operational Notes</h2>
          <ul className="grid gap-2 text-sm">
            {result.profile.notes.concat(result.profile.assumptions).map((note) => (
              <li key={note} className="rounded-md bg-stone-100 p-3">
                {note}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </section>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("driver");

  const rejectedPreview = useMemo(
    () => result?.rejectedLoads.slice(0, 5) ?? [],
    [result]
  );

  async function analyze() {
    if (!file) {
      setError("Choose an Excel workbook first.");
      return;
    }

    setError("");
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Analysis failed.");
      return;
    }

    setResult(payload);
    setProfile(payload.profile);
  }

  function updateProfile<K extends keyof EditableProfile>(
    key: K,
    value: EditableProfile[K]
  ) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }

  function rerank() {
    if (!result || !profile) {
      return;
    }

    const { topLoads, rejectedLoads, incompleteLoads } = rankLoads(profile, result.loads);
    setResult({
      ...result,
      profile,
      topLoads,
      rejectedLoads,
      incompleteLoads,
      readme: buildReadme(profile, rejectedLoads, incompleteLoads)
    });
  }

  return (
    <main className="min-h-screen">
      <section className="border-b border-stone-300 bg-stone-950 text-stone-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[1.1fr_0.9fr] md:items-end">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Cinesis Good Fit Test
            </p>
            <h1 className="text-3xl font-semibold md:text-5xl">
              Driver profile extraction and load matching
            </h1>
          </div>
          <div className="rounded-md border border-stone-700 bg-stone-900 p-4 text-sm text-stone-300">
            Upload the workbook, extract the driver constraints with LangChain,
            then filter and rank loads by effective rate per mile.
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-6">
        <div className="grid gap-4 rounded-md border border-stone-300 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-stone-400 bg-stone-50 px-4 py-6 text-center">
            <FileSpreadsheet className="h-8 w-8 text-emerald-800" aria-hidden />
            <span className="font-medium text-stone-900">
              {file ? file.name : "Drop or choose a workbook, CSV, or transcript"}
            </span>
            <span className="text-sm text-stone-600">
              Supports .xlsx, .csv, .tsv, .txt, .md, and text-based files
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.md,.json,text/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
            onClick={analyze}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            Analyze
          </button>
        </div>

        {error ? (
          <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {result && profile ? (
          <div className="grid gap-5">
            <section className="grid gap-4 rounded-md border border-stone-300 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Extracted Driver Profile</h2>
                  <p className="text-sm text-stone-600">
                    Editable review form populated from the conversation.
                  </p>
                </div>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 px-3 text-sm font-semibold"
                  type="button"
                  onClick={rerank}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Re-rank
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <ProfileField
                  label="Current Location"
                  value={profile.currentLocation}
                  onChange={(value) => updateProfile("currentLocation", value)}
                />
                <ProfileField
                  label="Current Lat"
                  value={profile.currentLat}
                  onChange={(value) => updateProfile("currentLat", Number(value))}
                />
                <ProfileField
                  label="Current Lon"
                  value={profile.currentLon}
                  onChange={(value) => updateProfile("currentLon", Number(value))}
                />
                <ProfileField
                  label="Home Base"
                  value={profile.homeBase}
                  onChange={(value) => updateProfile("homeBase", value)}
                />
                <ProfileField
                  label="Home Lat"
                  value={profile.homeLat}
                  onChange={(value) => updateProfile("homeLat", Number(value))}
                />
                <ProfileField
                  label="Home Lon"
                  value={profile.homeLon}
                  onChange={(value) => updateProfile("homeLon", Number(value))}
                />
                <ProfileField
                  label="Minimum Rate"
                  value={profile.minimumRatePerMile}
                  onChange={(value) => updateProfile("minimumRatePerMile", Number(value))}
                />
                <ProfileField
                  label="Equipment Types"
                  value={profile.equipmentTypes.join(", ")}
                  onChange={(value) =>
                    updateProfile(
                      "equipmentTypes",
                      value.split(",").map((item) => item.trim()).filter(Boolean)
                    )
                  }
                />
                <ProfileField
                  label="Weight Capacity"
                  value={profile.weightCapacityLb}
                  onChange={(value) => updateProfile("weightCapacityLb", Number(value))}
                />
              </div>
            </section>

            <div className="inline-grid w-fit grid-cols-2 rounded-md border border-stone-300 bg-white p-1">
              <button
                className={`inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-semibold ${
                  viewMode === "driver" ? "bg-stone-950 text-white" : "text-stone-700"
                }`}
                onClick={() => setViewMode("driver")}
                type="button"
              >
                <UserRound className="h-4 w-4" aria-hidden />
                Driver
              </button>
              <button
                className={`inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-semibold ${
                  viewMode === "dispatcher" ? "bg-stone-950 text-white" : "text-stone-700"
                }`}
                onClick={() => setViewMode("dispatcher")}
                type="button"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                Dispatcher
              </button>
            </div>

            {viewMode === "driver" ? (
              <DriverView result={result} profile={profile} />
            ) : (
              <DispatcherView result={result} />
            )}

            <section className="grid gap-4 rounded-md border border-stone-300 bg-white p-4 md:grid-cols-2">
              <div>
                <h2 className="mb-2 text-lg font-semibold">Skipped Incomplete Rows</h2>
                <ul className="grid gap-2 text-sm">
                  {result.incompleteLoads.map((load) => (
                    <li key={load.loadId} className="rounded-md bg-stone-100 p-3">
                      <strong>{load.loadId}</strong>: {load.reason}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="mb-2 text-lg font-semibold">Rejected Loads</h2>
                <ul className="grid gap-2 text-sm">
                  {rejectedPreview.map((load) => (
                    <li key={load.loadId} className="rounded-md bg-stone-100 p-3">
                      <strong>{load.loadId}</strong>: {load.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="grid gap-2 rounded-md border border-stone-300 bg-white p-4">
              <h2 className="text-xl font-semibold">README Summary</h2>
              <p className="text-sm leading-6 text-stone-700">{result.readme}</p>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
