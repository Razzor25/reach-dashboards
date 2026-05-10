"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getLetterRecords, getLetterFilterOptions } from "@/features/reach/actions/letter-fulfilment-actions";
import { formatDateTime } from "@/lib/formats";
import { FilterSelect } from "@/app/components/FilterSelect";
import { useDebounce } from "@/hooks/useDebounce";
import type { LetterRecord, LetterStatusTab, DateRangeKey } from "@/features/reach/service/letter-fulfilment-service";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: LetterStatusTab[] = ["In Progress", "Failed", "Success", "Disbursement Delay"];

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "last3Months", label: "Last 3 months" },
  { key: "last60Days", label: "Last 60 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "lastMonth", label: "Last month" },
  { key: "lastWeek", label: "Last week" },
  { key: "today", label: "Today" },
];

const TABLE_TITLE: Record<LetterStatusTab, string> = {
  "In Progress": "Fulfilment – In Progress Letters",
  "Failed": "Fulfilment – Failed Letters",
  "Success": "Fulfilment – Successful Letters",
  "Disbursement Delay": "Fulfilment – Disbursement Delay Letters",
};

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [50, 100, 200];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReachLetterFulfilmentPage() {
  const [activeTab, setActiveTab] = useState<LetterStatusTab>("In Progress");
  const [dateRange, setDateRange] = useState<DateRangeKey>("last3Months");
  const [memberIdInput, setMemberIdInput] = useState("");
  const memberId = useDebounce(memberIdInput, 400);
  const [org, setOrg] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [records, setRecords] = useState<LetterRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgOptions, setOrgOptions] = useState<string[]>([]);

  // Load org filter options — scoped to current tab so only relevant orgs appear
  useEffect(() => {
    setFiltersLoading(true);
    setOrgOptions([]);
    getLetterFilterOptions(dateRange, activeTab)
      .then(({ orgs }) => {
        setOrgOptions(orgs);
      })
      .catch(() => {
        // Non-fatal — keep existing options
      })
      .finally(() => setFiltersLoading(false));
  }, [dateRange, activeTab]);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    getLetterRecords(activeTab, dateRange, page, pageSize, memberId.trim() || "All", org)
      .then(({ records: rows, totalCount: count }) => {
        setRecords(rows);
        setTotalCount(count);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => setLoading(false));
  }, [activeTab, dateRange, page, pageSize, memberId, org]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to page 1 when any filter or tab changes
  const handleTabChange = (tab: LetterStatusTab) => {
    setActiveTab(tab);
    setOrg("All");
    setPage(1);
  };

  const handleFilterChange =
    <T extends string>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (value: string) => {
      setter(value as T);
      setPage(1);
    };

  const handleReset = () => {
    setDateRange("last3Months");
    setMemberIdInput("");
    setOrg("All");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const formatTs = (ts: string | null) =>
    ts ? formatDateTime(ts) : <span className="text-slate-300">—</span>;

  return (
    <main className="app-width-left py-8 sm:py-12">
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Reach – Letter Fulfilment</h1>
        <p className="mt-1 text-sm text-slate-500">
          Outbound letter generation and delivery status for Reach member communications.
          All timestamps shown in Central Time.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Main content ── */}
        <div className="min-w-0 flex-1">
          {/* Status tabs */}
          <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-200"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* KPI card */}
          <div className="mb-5 inline-flex items-center gap-3 rounded-xl border border-cyan-100 bg-cyan-50 px-5 py-3">
            <span className="text-3xl font-bold text-cyan-700">
              {loading ? "—" : totalCount.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-cyan-600">Letter Count</span>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Table card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Table header row */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">{TABLE_TITLE[activeTab]}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rows per page</span>
                <FilterSelect
                  id="page-size"
                  label=""
                  value={String(pageSize)}
                  options={PAGE_SIZE_OPTIONS.map(String)}
                  size="sm"
                  onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                />
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-275 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 whitespace-nowrap">Member ID</th>
                    <th className="px-4 py-3 whitespace-nowrap">Interaction ID</th>
                    <th className="px-4 py-3 whitespace-nowrap">Letter Tracking ID</th>
                    <th className="px-4 py-3 whitespace-nowrap">Letter Template Name</th>
                    <th className="px-4 py-3 whitespace-nowrap">Recipient</th>
                    <th className="px-4 py-3 whitespace-nowrap">ELGS – Received</th>
                    <th className="px-4 py-3 whitespace-nowrap">ELGS – Generate</th>
                    <th className="px-4 py-3 whitespace-nowrap">ELGS – Print</th>
                    <th className="px-4 py-3 whitespace-nowrap">ELGS – Sent</th>
                    <th className="px-4 py-3 whitespace-nowrap">Mailed / Faxed</th>
                    <th className="px-4 py-3 whitespace-nowrap">Org</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400">
                        No records found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    records.map((row) => (
                      <tr
                        key={row.mbr_cmnct_id}
                        className="border-t border-slate-100 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3 font-medium text-cyan-700">
                          {row.member_id ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.interaction_id ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.letter_tracking_id ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.letter_template_name ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.recipient ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatTs(row.elgs_received_dttm)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTs(row.elgs_generate_dttm)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTs(row.elgs_print_dttm)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTs(row.elgs_sent_dttm)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatTs(row.mailed_faxed_dttm)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.org_name ?? <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <span className="text-xs text-slate-500">
                {totalCount === 0
                  ? "No results"
                  : `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, totalCount).toLocaleString()} of ${totalCount.toLocaleString()}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹ Prev
                </button>
                <span className="px-2 text-xs text-slate-600">
                  Page {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter panel ── */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Filters</h3>
              <button
                onClick={handleReset}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-800"
              >
                Reset
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <FilterSelect
                id="date-range"
                label="Created Date"
                value={dateRange}
                options={DATE_RANGE_OPTIONS.map((d) => d.key)}
                optionLabels={DATE_RANGE_OPTIONS.map((d) => d.label)}
                onChange={handleFilterChange(setDateRange)}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="member-id" className="text-xs font-medium text-slate-600">
                  Member ID
                </label>
                <input
                  id="member-id"
                  type="text"
                  value={memberIdInput}
                  onChange={(e) => { setMemberIdInput(e.target.value); setPage(1); }}
                  placeholder="Search member ID…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-200"
                />
              </div>
              <FilterSelect
                id="org"
                label="Org"
                value={org}
                options={["All", ...orgOptions]}
                onChange={handleFilterChange(setOrg)}
              />
            </div>
            {filtersLoading && (
              <p className="mt-3 text-xs text-slate-400">Loading filter options…</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
