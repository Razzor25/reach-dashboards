"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@uhg-netra-ai/core-react-components/ui/select";
import { FilterChip } from "@/app/components/FilterChip";
import { getLetterRecords, getLetterFilterOptions } from "@/features/reach/actions/letter-fulfilment-actions";
import { formatDateTimeInZone } from "@/lib/formats";
import type { LetterRecord, LetterStatusTab, DateRangeKey } from "@/features/reach/service/letter-fulfilment-service";

// ─── Feature Flags / Configuration ────────────────────────────────────────────
// TODO: Move to ENV or manifest file
const ENABLE_EXPORT_CSV = false;
const ENABLE_CHARTS = false;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: LetterStatusTab[] = ["All", "In Progress", "Failed", "Success", "Disbursement Delay"];

const DATE_RANGE_PRESETS: { key: DateRangeKey; label: string }[] = [
  { key: "last3Months", label: "Last 3 months" },
  { key: "last60Days", label: "Last 60 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "lastMonth", label: "Last month" },
  { key: "lastWeek", label: "Last week" },
  { key: "today", label: "Today" },
];

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
] as const;

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

const TABLE_COLUMNS = [
  { key: "member_id", label: "Member ID" },
  { key: "interaction_id", label: "Interaction ID" },
  { key: "letter_tracking_id", label: "Letter Tracking ID" },
  { key: "letter_template_name", label: "Letter Template Name" },
  { key: "recipient", label: "Recipient" },
  { key: "elgs_received_dttm", label: "ELGS – Received" },
  { key: "elgs_generate_dttm", label: "ELGS – Generate" },
  { key: "elgs_print_dttm", label: "ELGS – Print" },
  { key: "elgs_sent_dttm", label: "ELGS – Sent" },
  { key: "mailed_faxed_dttm", label: "Mailed / Faxed" },
  { key: "org_name", label: "Org" },
] as const;

type ColumnKey = (typeof TABLE_COLUMNS)[number]["key"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReachLetterFulfilmentPage() {
  // ── Top filter bar state ──
  const [dateRangePreset, setDateRangePreset] = useState<DateRangeKey>("last3Months");
  const [timezone, setTimezone] = useState("America/New_York");
  const [showDateRangeInfo, setShowDateRangeInfo] = useState(false);

  // ── Request category chips (status tabs) ──
  const [activeTab, setActiveTab] = useState<LetterStatusTab>("All");
  const [showCharts, setShowCharts] = useState(false); // Controlled by ENABLE_CHARTS flag

  // ── Filter chip row state ──
  const [selectedOrg, setSelectedOrg] = useState("All Orgs");
  const [appliedOrg, setAppliedOrg] = useState("All Orgs");
  const [selectedMemberId, setSelectedMemberId] = useState("All");
  const [appliedMemberId, setAppliedMemberId] = useState("All");
  const [memberIdSearch, setMemberIdSearch] = useState("");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [memberIdOptions, setMemberIdOptions] = useState<string[]>([]);

  // ── Table state ──
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageSize, setPageSize] = useState(50);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(TABLE_COLUMNS.map((c) => c.key));
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // ── Data state ──
  const [records, setRecords] = useState<LetterRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgOptions, setOrgOptions] = useState<string[]>([]);
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false);

  const latestRequestIdRef = useRef(0);

  // ── Load filter options ──
  useEffect(() => {
    let cancelled = false;
    setIsFilterOptionsLoading(true);
    getLetterFilterOptions(dateRangePreset, activeTab)
      .then(({ orgs }) => {
        if (!cancelled) {
          setOrgOptions(orgs);
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setIsFilterOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [dateRangePreset, activeTab]);

  // ── Load records ──
  const loadData = useCallback(() => {
    const requestId = ++latestRequestIdRef.current;
    setIsLoading(true);
    setError(null);
    getLetterRecords(
      activeTab,
      dateRangePreset,
      page,
      pageSize,
      appliedMemberId,
      appliedOrg === "All Orgs" ? "All" : appliedOrg,
    )
      .then(({ records: rows, totalCount: count }) => {
        if (requestId !== latestRequestIdRef.current) return;
        setRecords(rows);
        setTotalCount(count);
      })
      .catch((err: unknown) => {
        if (requestId !== latestRequestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => { if (requestId === latestRequestIdRef.current) setIsLoading(false); });
  }, [activeTab, dateRangePreset, page, pageSize, appliedMemberId, appliedOrg]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Sync page input with current page ──
  useEffect(() => { setPageInput(String(page)); }, [page]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  // ── Helpers ──
  function handleTabChange(tab: LetterStatusTab) {
    setActiveTab(tab);
    setSelectedOrg("All Orgs");
    setAppliedOrg("All Orgs");
    setSelectedMemberId("All");
    setAppliedMemberId("All");
    setMemberIdSearch("");
    setPage(1);
  }

  function applyFilters() {
    setAppliedOrg(selectedOrg);
    setAppliedMemberId(selectedMemberId);
    setPage(1);
  }

  function clearFilters() {
    setSelectedOrg("All Orgs");
    setAppliedOrg("All Orgs");
    setSelectedMemberId("All");
    setAppliedMemberId("All");
    setMemberIdSearch("");
    setPage(1);
  }

  function applyPageInput() {
    const next = Number(pageInput);
    if (!Number.isFinite(next)) { setPageInput(String(page)); return; }
    const clamped = Math.max(1, Math.min(pageCount, Math.trunc(next)));
    setPage(clamped);
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((k) => k !== key);
      }
      return [...current, key];
    });
  }

  function handleSort(key: ColumnKey) {
    if (sortColumn === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  }

  function csvEscape(value: string): string {
    if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  function getCellValue(row: LetterRecord, key: ColumnKey): string {
    const ts = (v: string | null) => v ? formatDateTimeInZone(v, timezone) : "";
    switch (key) {
      case "member_id": return row.member_id ?? "";
      case "interaction_id": return row.interaction_id ?? "";
      case "letter_tracking_id": return row.letter_tracking_id ?? "";
      case "letter_template_name": return row.letter_template_name ?? "";
      case "recipient": return row.recipient ?? "";
      case "elgs_received_dttm": return ts(row.elgs_received_dttm);
      case "elgs_generate_dttm": return ts(row.elgs_generate_dttm);
      case "elgs_print_dttm": return ts(row.elgs_print_dttm);
      case "elgs_sent_dttm": return ts(row.elgs_sent_dttm);
      case "mailed_faxed_dttm": return ts(row.mailed_faxed_dttm);
      case "org_name": return row.org_name ?? "";
    }
  }

  async function handleExportCsv() {
    setIsExportingCsv(true);
    setError(null);
    try {
      const exportPageSize = 1000;
      const pages = Math.max(1, Math.ceil(totalCount / exportPageSize));
      const rows: LetterRecord[] = [];
      for (let p = 1; p <= pages; p++) {
        const result = await getLetterRecords(
          activeTab, dateRangePreset, p, exportPageSize,
          appliedMemberId,
          appliedOrg === "All Orgs" ? "All" : appliedOrg,
        );
        if (result.records.length === 0) break;
        rows.push(...result.records);
      }
      const exportCols = TABLE_COLUMNS.filter((c) => visibleColumns.includes(c.key));
      const header = exportCols.map((c) => csvEscape(c.label)).join(",");
      const body = rows.map((row) => exportCols.map((c) => csvEscape(getCellValue(row, c.key))).join(",")).join("\n");
      const csv = `${header}\n${body}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `letter-fulfilment-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to export CSV");
    } finally {
      setIsExportingCsv(false);
    }
  }

  const hasPendingChanges = selectedOrg !== appliedOrg || selectedMemberId !== appliedMemberId;
  const hasSelections = appliedOrg !== "All Orgs" || appliedMemberId !== "All";
  const tzLabel = US_TIMEZONES.find((tz) => tz.value === timezone)?.label ?? timezone;
  const dateRangeLabel = DATE_RANGE_PRESETS.find((p) => p.key === dateRangePreset)?.label ?? dateRangePreset;
  const appliedSummary = [
    `Date Range: ${dateRangeLabel}`,
    `Timezone: ${tzLabel}`,
    `Status: ${activeTab}`,
    ...(appliedOrg !== "All Orgs" ? [`Org: ${appliedOrg}`] : []),
    ...(appliedMemberId !== "All" ? [`Member ID: ${appliedMemberId}`] : []),
  ].join(" · ");

  const dash = <span className="text-slate-300">—</span>;
  const ts = (v: string | null) =>
    v ? formatDateTimeInZone(v, timezone) : dash;

  // Sort records client-side
  const sortedRecords = React.useMemo(() => {
    if (!sortColumn) return records;
    return [...records].sort((a, b) => {
      const aVal = a[sortColumn as keyof LetterRecord] ?? "";
      const bVal = b[sortColumn as keyof LetterRecord] ?? "";
      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [records, sortColumn, sortDirection]);

  return (
    <main className="flex h-[calc(100vh-4rem)] bg-white">
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ── Top filter bar ── */}
        <section className="border-b border-slate-200 bg-white px-6 py-3 shrink-0">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-end">

              {/* Date Range */}
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
                        Filters by created date (creat_dttm)
                      </span>
                    )}
                  </span>
                </span>
                <Select
                  value={dateRangePreset}
                  onValueChange={(v) => { setDateRangePreset(v as DateRangeKey); setPage(1); }}
                >
                  <SelectTrigger
                    id="date-range-preset"
                    className="h-9 min-w-[140px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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

            {/* Request category chips (status tabs) — right side */}
            <div className="flex flex-wrap gap-2 items-end">{STATUS_TABS.map((tab) => (
                <FilterChip
                  key={tab}
                  label={tab}
                  isSelected={activeTab === tab}
                  onClick={() => handleTabChange(tab)}
                  size="md"
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Filter chip row ── */}
        <section className="border-b border-slate-200 bg-white px-6 py-3 shrink-0">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Filter</span>

            {/* Org filter chip */}
            <div className="relative z-50">
              <button
                type="button"
                onClick={() => setOpenFilter(openFilter === "org" ? null : "org")}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  appliedOrg !== "All Orgs"
                    ? "border-cyan-400 bg-cyan-50 text-cyan-800"
                    : selectedOrg !== "All Orgs"
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                Org
                {appliedOrg !== "All Orgs" && (
                  <span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">1</span>
                )}
                <span className="text-slate-400 text-[10px]">{openFilter === "org" ? "▲" : "▼"}</span>
              </button>
              {openFilter === "org" && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">Org</span>
                    {isFilterOptionsLoading && (
                      <span className="text-[10px] font-medium text-slate-400">Loading…</span>
                    )}
                  </div>
                  {["All Orgs", ...orgOptions].length === 1 && !isFilterOptionsLoading ? (
                    <p className="px-3 py-2 text-xs text-slate-400">No options available</p>
                  ) : (
                    <ul className="py-1">
                      {["All Orgs", ...orgOptions].map((opt) => (
                        <li key={opt}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                            <input
                              type="radio"
                              name="org"
                              value={opt}
                              checked={selectedOrg === opt}
                              onChange={() => setSelectedOrg(opt)}
                              className="border-slate-300"
                            />
                            <span className="text-xs text-slate-700">{opt}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Member ID filter chip */}
            <div className="relative z-50">
              <button
                type="button"
                onClick={() => setOpenFilter(openFilter === "memberId" ? null : "memberId")}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  appliedMemberId !== "All"
                    ? "border-cyan-400 bg-cyan-50 text-cyan-800"
                    : selectedMemberId !== "All"
                    ? "border-amber-400 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                Member ID
                {appliedMemberId !== "All" && (
                  <span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">1</span>
                )}
                <span className="text-slate-400 text-[10px]">{openFilter === "memberId" ? "▲" : "▼"}</span>
              </button>
              {openFilter === "memberId" && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] max-h-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="sticky top-0 border-b border-slate-100 bg-white px-3 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">Member ID</span>
                      {isFilterOptionsLoading && (
                        <span className="text-[10px] font-medium text-slate-400">Loading...</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={memberIdSearch}
                      onChange={(e) => setMemberIdSearch(e.target.value)}
                      placeholder="Search member ID..."
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {(() => {
                      const filtered = ["All", ...memberIdOptions].filter(
                        (opt) => opt.toLowerCase().includes(memberIdSearch.toLowerCase())
                      );
                      return filtered.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-400">No matches found</p>
                      ) : (
                        <ul className="py-1">
                          {filtered.slice(0, 100).map((opt) => (
                            <li key={opt}>
                              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                                <input
                                  type="radio"
                                  name="memberId"
                                  value={opt}
                                  checked={selectedMemberId === opt}
                                  onChange={() => setSelectedMemberId(opt)}
                                  className="border-slate-300"
                                />
                                <span className="text-xs text-slate-700 font-mono">{opt}</span>
                              </label>
                            </li>
                          ))}
                          {filtered.length > 100 && (
                            <li className="px-3 py-2 text-[10px] text-slate-400">
                              Showing first 100 of {filtered.length} results
                            </li>
                          )}
                        </ul>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Apply / Clear / Hide Charts */}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={applyFilters}
                disabled={!hasPendingChanges || isLoading}
                className="cursor-pointer rounded-full border border-cyan-600 bg-cyan-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:opacity-60"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasSelections}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
              {ENABLE_CHARTS && (
                <button
                  type="button"
                  onClick={() => setShowCharts((c) => !c)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  {showCharts ? "Hide Charts" : "Show Charts"}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Backdrop to close open filter dropdown */}
        {openFilter && (
          <div className="fixed inset-0 z-40" onClick={() => setOpenFilter(null)} />
        )}
        {showColumnModal && (
          <div className="fixed inset-0 z-40" onClick={() => setShowColumnModal(false)} />
        )}

        {/* ── Results header ── */}
        <section className="border-b border-slate-200 bg-white px-6 py-3 shrink-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Letters</h2>
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  {isLoading ? "…" : totalCount.toLocaleString()}
                </span>
              </div>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>
                  Page {page} of {pageCount}&nbsp;·&nbsp;Showing {startRow.toLocaleString()}–{endRow.toLocaleString()} of {totalCount.toLocaleString()}
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-600">{appliedSummary}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Export CSV */}
              {ENABLE_EXPORT_CSV && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={isLoading || isExportingCsv || totalCount === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExportingCsv ? "Exporting..." : "Export CSV"}
                </button>
              )}

              {/* Columns picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColumnModal((c) => !c)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  ⚙ Columns
                </button>
                {showColumnModal && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <span className="text-xs font-semibold text-slate-700">Visible Columns</span>
                    </div>
                    <ul className="max-h-72 overflow-y-auto py-1">
                      {TABLE_COLUMNS.map((col) => (
                        <li key={col.key}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={visibleColumns.includes(col.key)}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded-sm border-slate-300"
                            />
                            <span className="text-xs text-slate-700">{col.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Rows per page */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Rows</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                >
                  <SelectTrigger className="h-8 w-20 rounded-lg border-slate-300 bg-white text-xs text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pagination */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Page</span>
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={applyPageInput}
                  onKeyDown={(e) => e.key === "Enter" && applyPageInput()}
                  className="h-8 w-14 rounded-lg border border-slate-300 bg-white px-2 text-center text-xs text-slate-700 outline-none focus:border-cyan-500"
                />
                <button
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pageCount || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </section>

        {/* ── Scrollable table ── */}
        <section className="flex-1 overflow-auto relative">
          {isLoading && records.length > 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-lg">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600"></div>
                <span className="text-sm font-medium text-slate-700">Applying filters...</span>
              </div>
            </div>
          )}
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200">
                {TABLE_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-4 py-2 text-left font-semibold text-slate-600"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-left text-slate-700 transition hover:bg-slate-100"
                      aria-label={`Sort by ${col.label}`}
                    >
                      <span>{col.label}</span>
                      <span
                        className={`inline-block w-3 text-center ${sortColumn === col.key ? "text-cyan-700" : "text-transparent"}`}
                        aria-hidden="true"
                      >
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && records.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-cyan-600"></div>
                      <p className="text-sm text-slate-600">Loading data...</p>
                    </div>
                  </td>
                </tr>
              ) : !isLoading && sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="py-20 text-center text-slate-400 text-sm">
                    No records found for the selected filters.
                  </td>
                </tr>
              ) : (
                sortedRecords.map((row, index) => (
                  <tr
                    key={row.mbr_cmnct_id}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    }`}
                  >
                    {TABLE_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((col) => {
                      const isTimestamp = col.key.endsWith("_dttm");
                      const isId = col.key === "member_id";
                      const rawVal = row[col.key as keyof LetterRecord] as string | null;
                      const displayVal = isTimestamp
                        ? ts(rawVal)
                        : (rawVal ?? dash);
                      return (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap px-4 py-2 ${
                            isId ? "font-mono text-cyan-700" : "text-slate-700"
                          }`}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* ── Bottom pagination ── */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 shrink-0">
          <span className="text-xs text-slate-500">
            {totalCount === 0
              ? "No results"
              : `${startRow.toLocaleString()}–${endRow.toLocaleString()} of ${totalCount.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            >
              <SelectTrigger className="h-7 w-20 rounded-lg border-slate-300 bg-white text-xs text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {page}</span>
            <button
              disabled={page >= pageCount || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
