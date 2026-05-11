"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@uhg-netra-ai/core-react-components/ui/select";
import {
  getInteractionsData,
  getMembersReachedData,
  getAvailableTables,
  type DateRangeKey,
  type InteractionsData,
  type MembersReachedData,
} from "@/features/reach/actions/assessment-measures-actions";
import { formatDateTimeInZone } from "@/lib/formats";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = "Interactions" | "Members Reached";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: TabType[] = ["Interactions", "Members Reached"];

const DATE_RANGE_PRESETS: { key: DateRangeKey; label: string }[] = [
  { key: "last3Months", label: "Last 3 months" },
  { key: "last60Days", label: "Last 60 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "lastMonth", label: "Last month" },
  { key: "lastWeek", label: "Last week" },
  { key: "today", label: "Today" },
  { key: "customRange", label: "Custom Range" },
];

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
] as const;

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

// ─── Chart Colors ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Completed: "#4ade80", // green
  Attempted: "#b45309", // brown/amber
  Scheduled: "#0ea5e9", // cyan
};

const REACHED_COLORS = {
  reached: "#4ade80", // green
  notReached: "#dc2626", // red
};

const STATUS_CHART_COLORS = {
  verified: "#4ade80", // green
  failed: "#dc2626", // red
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReachAssessmentAndMeasuresPage() {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<TabType>("Interactions");

  // ── Top filter bar state ──
  const [dateRangePreset, setDateRangePreset] = useState<DateRangeKey>("customRange");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [showDateRangeInfo, setShowDateRangeInfo] = useState(false);
  
  // ── Custom date range state ──
  const today = new Date().toISOString().split("T")[0];
  const prodStartDate = "2024-10-08"; // Production Power BI start date
  const [customFrom, setCustomFrom] = useState(prodStartDate);
  const [customTo, setCustomTo] = useState(today);

  // ── Data state ──
  const [interactionsData, setInteractionsData] = useState<InteractionsData | null>(null);
  const [membersReachedData, setMembersReachedData] = useState<MembersReachedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === "Interactions") {
        const data = await getInteractionsData(dateRangePreset, customFrom, customTo);
        setInteractionsData(data);
      } else {
        const data = await getMembersReachedData(dateRangePreset, customFrom, customTo);
        setMembersReachedData(data);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      // Fetch available tables on error to help debug
      try {
        const tables = await getAvailableTables();
        setAvailableTables(tables);
      } catch {
        // Ignore introspection errors
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, dateRangePreset, customFrom, customTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Reset filters ──
  function resetFilters() {
    setDateRangePreset("customRange");
    setCustomFrom(prodStartDate);
    setCustomTo(new Date().toISOString().split("T")[0]);
    setTimezone("America/Chicago");
  }

  // ── Handle date preset change ──
  function handleDatePresetChange(key: DateRangeKey) {
    setDateRangePreset(key);
    if (key !== "customRange") {
      // Auto-update custom dates for presets
      const now = new Date();
      setCustomTo(now.toISOString().split("T")[0]);
      const start = new Date();
      if (key === "last3Months") start.setDate(start.getDate() - 90);
      else if (key === "last60Days") start.setDate(start.getDate() - 60);
      else if (key === "last30Days") start.setDate(start.getDate() - 30);
      else if (key === "lastWeek") start.setDate(start.getDate() - 7);
      else if (key === "lastMonth") {
        start.setFullYear(now.getFullYear(), now.getMonth() - 1, 1);
      }
      else if (key === "today") start.setTime(now.getTime());
      setCustomFrom(start.toISOString().split("T")[0]);
    }
  }

  const tzLabel = US_TIMEZONES.find((tz) => tz.value === timezone)?.label ?? timezone;
  const dateRangeLabel = DATE_RANGE_PRESETS.find((p) => p.key === dateRangePreset)?.label ?? dateRangePreset;

  // ── Render ──
  return (
    <main className="flex h-[calc(100vh-4rem)] bg-white">
      <div className="flex-1 overflow-hidden flex flex-col">
        
        {/* ── Top filter bar ── */}
        <section className="border-b border-slate-200 bg-white px-6 py-3 shrink-0">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-end">

              {/* Date Range Preset */}
              <label htmlFor="date-range-preset" className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                  Date Range
                  <span className="relative inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowDateRangeInfo((c) => !c)}
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-400 text-[9px] font-bold leading-none text-slate-500 transition-colors hover:border-slate-500 hover:text-slate-700"
                      aria-label="Date range info"
                      aria-expanded={showDateRangeInfo}
                    >
                      i
                    </button>
                    {showDateRangeInfo && (
                      <span className="absolute left-5 top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
                        Filters by COALESCE(chg_dttm, creat_dttm)
                      </span>
                    )}
                  </span>
                </span>
                <Select
                  value={dateRangePreset}
                  onValueChange={(v) => handleDatePresetChange(v as DateRangeKey)}
                >
                  <SelectTrigger
                    id="date-range-preset"
                    className="h-9 min-w-[150px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  >
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-200 shadow-lg">
                    {DATE_RANGE_PRESETS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {/* Custom Date From */}
              {dateRangePreset === "customRange" && (
                <>
                  <label htmlFor="date-from" className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">From</span>
                    <input
                      id="date-from"
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </label>

                  {/* Custom Date To */}
                  <label htmlFor="date-to" className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">To</span>
                    <input
                      id="date-to"
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </label>
                </>
              )}

              {/* Timezone */}
              <label htmlFor="timezone" className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Timezone</span>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger
                    id="timezone"
                    className="h-9 min-w-[130px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  >
                    <SelectValue placeholder="Timezone" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-200 shadow-lg">
                    {US_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {/* Last Refreshed */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Last Refreshed:</span>
                <span className="font-medium">
                  {lastRefreshed ? formatDateTimeInZone(lastRefreshed.toISOString(), timezone) : "--"}
                </span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadData}
                disabled={isLoading}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>

              {/* Reset Button */}
              <button
                onClick={resetFilters}
                className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Applied filters summary */}
          <div className="mt-2 text-xs text-slate-500">
            {dateRangeLabel} · {tzLabel} · {activeTab}
            {dateRangePreset === "customRange" && ` · ${customFrom} to ${customTo}`}
          </div>
        </section>

        {/* ── Status tabs row ── */}
        <section className="border-b border-slate-200 bg-white px-6 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 mr-2">Report Type:</span>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-cyan-100 text-cyan-900 border border-cyan-300"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </section>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          {error ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                <h3 className="font-semibold mb-2">Error Loading Data</h3>
                <p className="text-sm">{error}</p>
              </div>
              {availableTables.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold text-amber-800 mb-2">Available Tables in REACH Schema</h3>
                  <p className="text-sm text-amber-700 mb-2">
                    The following tables are available in the GraphQL API. Please verify the correct table names:
                  </p>
                  <div className="bg-white rounded border border-amber-200 p-3 max-h-64 overflow-auto">
                    <ul className="text-xs font-mono text-amber-900 space-y-1">
                      {availableTables.map((table) => (
                        <li key={table} className="hover:bg-amber-100 px-1 rounded">{table}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
            </div>
          ) : activeTab === "Interactions" && interactionsData ? (
            <InteractionsTab data={interactionsData} timezone={timezone} />
          ) : activeTab === "Members Reached" && membersReachedData ? (
            <MembersReachedTab data={membersReachedData} timezone={timezone} />
          ) : null}
        </main>
      </div>
    </main>
  );
}

// ─── Interactions Tab ─────────────────────────────────────────────────────────

function InteractionsTab({ data, timezone }: { data: InteractionsData; timezone: string }) {
  // Chart data
  const chartData = data.byStatus.map((s) => ({
    name: s.status,
    count: s.count,
    fill: STATUS_COLORS[s.status] || "#94a3b8",
  }));

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Interactions by Status</h3>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-slate-100 rounded"><svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            <button className="p-1 hover:bg-slate-100 rounded"><svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
            <button className="p-1 hover:bg-slate-100 rounded"><svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg></button>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={formatCount} />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip formatter={(value: number) => formatCount(value)} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center mt-2 text-xs text-slate-500">Status</div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Detailed Information</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Interaction/Attempted Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Attempted
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Completed
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Scheduled
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.byType.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm text-slate-700">{row.interaction_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-700 text-right">{row.attempted.toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm text-slate-700 text-right">{row.completed.toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm text-slate-700 text-right">{row.scheduled.toLocaleString()}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-slate-900 text-right">{row.total.toLocaleString()}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-6 py-3 text-sm text-slate-900">Total</td>
                <td className="px-6 py-3 text-sm text-slate-900 text-right">{data.totals.attempted.toLocaleString()}</td>
                <td className="px-6 py-3 text-sm text-slate-900 text-right">{data.totals.completed.toLocaleString()}</td>
                <td className="px-6 py-3 text-sm text-slate-900 text-right">{data.totals.scheduled.toLocaleString()}</td>
                <td className="px-6 py-3 text-sm text-slate-900 text-right">{data.totals.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Members Reached Tab ──────────────────────────────────────────────────────

function MembersReachedTab({ data, timezone }: { data: MembersReachedData; timezone: string }) {
  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Members Reached chart */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Members Reached</h3>
          <div className="flex gap-4 mb-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-600">Reached</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-slate-600">Not Reached</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.reachedByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tickFormatter={formatCount} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
                <Bar dataKey="reached" fill={REACHED_COLORS.reached} name="Reached" />
                <Bar dataKey="notReached" fill={REACHED_COLORS.notReached} name="Not Reached" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-xs text-slate-500 mt-2">datetime Month</div>
        </div>

        {/* Members Reached Status chart */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Members Reached Status</h3>
          <div className="flex gap-4 mb-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-600">Verified Status</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-slate-600">Failed S...</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.statusByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tickFormatter={formatCount} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
                <Bar dataKey="verified" fill={STATUS_CHART_COLORS.verified} name="Verified Status" />
                <Bar dataKey="failed" fill={STATUS_CHART_COLORS.failed} name="Failed Status" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-xs text-slate-500 mt-2">datetime Month</div>
        </div>
      </div>

      {/* Reasons tables row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Declined to Verify */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">Declined to Verify</h3>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.declinedReasons.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-2 text-sm text-slate-700">{row.reason}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-6 py-2 text-sm text-slate-900">
                    Total
                    <div className="h-1 bg-amber-500 rounded mt-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Unable to Verify */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">Unable to Verify</h3>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.unableToVerifyReasons.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-2 text-sm text-slate-700">{row.reason}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-6 py-2 text-sm text-slate-900">
                    Total
                    <div className="h-1 bg-amber-500 rounded mt-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
