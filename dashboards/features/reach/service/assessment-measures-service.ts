import { reachGraphqlRequest } from "@/lib/api/reach-graphql-client";

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type DateRangeKey =
  | "last3Months"
  | "last30Days"
  | "last60Days"
  | "lastMonth"
  | "lastWeek"
  | "today"
  | "customRange";

export type InteractionStatus = "Completed" | "Attempted" | "Scheduled";

export type InteractionSummary = {
  interaction_name: string;
  attempted: number;
  completed: number;
  scheduled: number;
  total: number;
};

export type InteractionsData = {
  byStatus: { status: InteractionStatus; count: number }[];
  byType: InteractionSummary[];
  totals: { attempted: number; completed: number; scheduled: number; total: number };
};

export type MembersReachedMonthly = {
  month: string; // "2024 October", "2025 January", etc.
  reached: number;
  notReached: number;
};

export type MembersStatusMonthly = {
  month: string;
  verified: number;
  failed: number;
};

export type VerificationReason = {
  reason: string;
  count: number;
};

export type MembersReachedData = {
  reachedByMonth: MembersReachedMonthly[];
  statusByMonth: MembersStatusMonthly[];
  declinedReasons: VerificationReason[];
  unableToVerifyReasons: VerificationReason[];
};

// ─── Status Reference IDs ─────────────────────────────────────────────────────
// From query: interaction_status_id in (1000936, 1000883, 1002200)
const STATUS_SCHEDULED = 1000936;
const STATUS_COMPLETED = 1000883;
const STATUS_ATTEMPTED = 1002200;

// ─── HIPAA Verification Status Values ─────────────────────────────────────────
const HIPAA_VERIFIED = ["hipaa_verified", "hipaa_verified_authorized_representative", "hipaa_verified_via_warm_transfer"];
const HIPAA_FAILED = ["declined_to_verify_hipaa", "unable_to_verify_hipaa"];
const HIPAA_NOT_REACHED = ["memberrepresentative_not_reached"];

// ─── Date Range Helper ────────────────────────────────────────────────────────

export function getDateRange(
  key: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();

  const subtract = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  switch (key) {
    case "customRange":
      if (customFrom && customTo) {
        return {
          startDate: new Date(customFrom + "T00:00:00.000Z").toISOString(),
          endDate: new Date(customTo + "T23:59:59.999Z").toISOString(),
        };
      }
      return { startDate: subtract(90), endDate };
    case "today":
      return { startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), endDate };
    case "lastWeek":
      return { startDate: subtract(7), endDate };
    case "last30Days":
      return { startDate: subtract(30), endDate };
    case "last60Days":
      return { startDate: subtract(60), endDate };
    case "lastMonth": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const curr = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: prev.toISOString(), endDate: curr.toISOString() };
    }
    case "last3Months":
    default:
      return { startDate: subtract(90), endDate };
  }
}

// ─── Schema Introspection (for debugging) ─────────────────────────────────────

export async function introspectReachSchema(): Promise<string[]> {
  const query = `
    query IntrospectSchema {
      __schema {
        queryType {
          fields {
            name
          }
        }
      }
    }
  `;

  type IntrospectionResult = {
    __schema: {
      queryType: {
        fields: Array<{ name: string }>;
      };
    };
  };

  try {
    const data = await reachGraphqlRequest<IntrospectionResult>(query, {});
    return data.__schema.queryType.fields.map((f) => f.name);
  } catch {
    return [];
  }
}

export async function introspectTableFields(tableName: string): Promise<string[]> {
  const query = `
    query IntrospectTable {
      __type(name: "${tableName}") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  type IntrospectionResult = {
    __type: {
      name: string;
      fields: Array<{
        name: string;
        type: {
          name: string | null;
          kind: string;
          ofType: { name: string | null; kind: string } | null;
        };
      }>;
    } | null;
  };

  try {
    const data = await reachGraphqlRequest<IntrospectionResult>(query, {});
    return data.__type?.fields.map((f) => f.name) || [];
  } catch {
    return [];
  }
}

// ─── Fetch Interactions Data ──────────────────────────────────────────────────
/**
 * Matches production SQL query structure:
 * - qom_interaction qi (exposed as qom_qom_interaction in Hasura)
 * - JOIN interaction_type it ON qi.interaction_type_id = it.interaction_type_id
 * - JOIN qom_ref qr ON qr.ref_id = qi.interaction_status_id
 * - interaction_type table has: interaction_type_id, interaction_name, interaction_abbr
 * - qom_ref table has: ref_id, ref_dspl (display name for status)
 */

export async function fetchInteractionsData(
  dateRange: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): Promise<InteractionsData> {
  const { startDate, endDate } = getDateRange(dateRange, customFrom, customTo);

  // Introspect schema for error reporting if needed
  let availableTables: string[] = [];
  try {
    availableTables = await introspectReachSchema();
  } catch {
    // Ignore introspection errors
  }

  // Query qom_qom_interaction matching production SQL
  // Production SQL: from qom_interaction qi join interaction_type it on qi.interaction_type_id=it.interaction_type_id
  // IMPORTANT: Production filters on calculated datetime = COALESCE(chg_dttm, creat_dttm)
  // We fetch both fields and filter in memory to match exactly
  const query = `
    query GetInteractions {
      qom_qom_interaction(
        where: {
          _and: [
            { indv_id: { _gt: 0 } }
            { interaction_status_id: { _in: [${STATUS_SCHEDULED}, ${STATUS_COMPLETED}, ${STATUS_ATTEMPTED}] } }
          ]
        }
      ) {
        interaction_id
        org_id
        interaction_type_id
        interaction_status_id
        chg_dttm
        creat_dttm
      }
    }
  `;

  type QueryResult = {
    qom_qom_interaction: Array<{
      interaction_id: string;
      org_id: string;
      interaction_type_id: string;
      interaction_status_id: number;
      chg_dttm: string | null;
      creat_dttm: string;
    }>;
  };

  let data: QueryResult;
  try {
    data = await reachGraphqlRequest<QueryResult>(query, {});
  } catch (error) {
    // If qom_qom_interaction doesn't exist, throw with available tables info
    const message = error instanceof Error ? error.message : "Unknown error";
    const filtered = availableTables.filter(t => !t.startsWith("__"));
    throw new Error(`GraphQL query failed. Available tables in REACH schema: [${filtered.join(", ")}]. Original error: ${message}`);
  }

  // Filter by date using the same logic as production SQL:
  // datetime = case when qi.chg_dttm is not null then qi.chg_dttm else qi.creat_dttm
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  
  const filteredData = data.qom_qom_interaction.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const dateMs = new Date(effectiveDatetime).getTime();
    return dateMs >= startMs && dateMs <= endMs;
  });

  // Fetch interaction type names from interaction_type table
  // Production SQL: join interaction_type it on qi.interaction_type_id=it.interaction_type_id
  const typeIds = [...new Set(filteredData.map(row => row.interaction_type_id))];
  const typeQuery = `
    query GetInteractionTypes {
      qom_interaction_type(where: { interaction_type_id: { _in: [${typeIds.join(", ")}] } }) {
        interaction_type_id
        interaction_name
      }
    }
  `;

  type TypeQueryResult = {
    qom_interaction_type: Array<{
      interaction_type_id: string;
      interaction_name: string;
    }>;
  };

  let typeData: TypeQueryResult;
  try {
    typeData = await reachGraphqlRequest<TypeQueryResult>(typeQuery, {});
  } catch {
    // If fetching types fails, continue with "Unknown" names
    typeData = { qom_interaction_type: [] };
  }

  // Build type name lookup
  const typeNameMap = new Map<string, string>();
  for (const type of typeData.qom_interaction_type) {
    typeNameMap.set(String(type.interaction_type_id), type.interaction_name);
  }

  // Map status IDs to status names (using display names from qom_ref)
  const statusMap: Record<number, InteractionStatus> = {
    [STATUS_COMPLETED]: "Completed",
    [STATUS_ATTEMPTED]: "Attempted",
    [STATUS_SCHEDULED]: "Scheduled",
  };

  // Aggregate by status
  const statusCounts: Record<InteractionStatus, number> = {
    Completed: 0,
    Attempted: 0,
    Scheduled: 0,
  };

  // Aggregate by interaction type
  const typeMap = new Map<string, { attempted: number; completed: number; scheduled: number }>();

  for (const row of filteredData) {
    const status = statusMap[row.interaction_status_id];
    if (status) {
      statusCounts[status]++;

      // Get interaction_name from interaction_type table
      const typeName = typeNameMap.get(String(row.interaction_type_id)) || "Unknown";
      if (!typeMap.has(typeName)) {
        typeMap.set(typeName, { attempted: 0, completed: 0, scheduled: 0 });
      }
      const entry = typeMap.get(typeName)!;
      if (status === "Attempted") entry.attempted++;
      else if (status === "Completed") entry.completed++;
      else if (status === "Scheduled") entry.scheduled++;
    }
  }

  const byStatus: { status: InteractionStatus; count: number }[] = [
    { status: "Completed", count: statusCounts.Completed },
    { status: "Attempted", count: statusCounts.Attempted },
    { status: "Scheduled", count: statusCounts.Scheduled },
  ];

  const byType: InteractionSummary[] = Array.from(typeMap.entries())
    .map(([name, counts]) => ({
      interaction_name: name,
      ...counts,
      total: counts.attempted + counts.completed + counts.scheduled,
    }))
    .sort((a, b) => b.total - a.total);

  const totals = {
    attempted: statusCounts.Attempted,
    completed: statusCounts.Completed,
    scheduled: statusCounts.Scheduled,
    total: statusCounts.Attempted + statusCounts.Completed + statusCounts.Scheduled,
  };

  return { byStatus, byType, totals };
}

// ─── Fetch Members Reached Data ───────────────────────────────────────────────

export async function fetchMembersReachedData(
  dateRange: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): Promise<MembersReachedData> {
  const { startDate, endDate } = getDateRange(dateRange, customFrom, customTo);

  // Query HIPAA verification responses
  const query = `
    query GetHipaaStatus($startDate: timestamp!, $endDate: timestamp!) {
      dw_questnr_rspn_dtl(
        where: {
          _and: [
            { questnr_rspn_quest_txt: { _eq: "Member HIPAA Verification" } }
            { creat_dttm: { _gte: $startDate, _lte: $endDate } }
          ]
        }
      ) {
        questnr_rspn_id
        questnr_reesponse_val_txt
        chg_dttm
        creat_dttm
      }
    }
  `;

  // Query for reasons (Summary field)
  const reasonsQuery = `
    query GetHipaaReasons($startDate: timestamp!, $endDate: timestamp!) {
      dw_questnr_rspn_dtl(
        where: {
          _and: [
            { questnr_rspn_quest_txt: { _eq: "Summary" } }
            { creat_dttm: { _gte: $startDate, _lte: $endDate } }
          ]
        }
      ) {
        questnr_rspn_id
        questnr_reesponse_val_txt
      }
    }
  `;

  type StatusQueryResult = {
    dw_questnr_rspn_dtl: Array<{
      questnr_rspn_id: string;
      questnr_reesponse_val_txt: string | null;
      chg_dttm: string | null;
      creat_dttm: string;
    }>;
  };

  type ReasonsQueryResult = {
    dw_questnr_rspn_dtl: Array<{
      questnr_rspn_id: string;
      questnr_reesponse_val_txt: string | null;
    }>;
  };

  const [statusData, reasonsData] = await Promise.all([
    reachGraphqlRequest<StatusQueryResult>(query, { startDate, endDate }),
    reachGraphqlRequest<ReasonsQueryResult>(reasonsQuery, { startDate, endDate }),
  ]);

  // Build reasons lookup by questnr_rspn_id
  const reasonsMap = new Map<string, string>();
  for (const r of reasonsData.dw_questnr_rspn_dtl) {
    if (r.questnr_reesponse_val_txt) {
      reasonsMap.set(r.questnr_rspn_id, r.questnr_reesponse_val_txt);
    }
  }

  // Process status data
  const reachedByMonthMap = new Map<string, { reached: number; notReached: number }>();
  const statusByMonthMap = new Map<string, { verified: number; failed: number }>();
  const declinedReasonsMap = new Map<string, number>();
  const unableToVerifyReasonsMap = new Map<string, number>();

  for (const row of statusData.dw_questnr_rspn_dtl) {
    const statusVal = row.questnr_reesponse_val_txt?.toLowerCase() || "";
    const datetime = row.chg_dttm || row.creat_dttm;
    const date = new Date(datetime);
    const monthKey = `${date.getFullYear()} ${date.toLocaleString("en-US", { month: "long" })}`;

    // Initialize month entries
    if (!reachedByMonthMap.has(monthKey)) {
      reachedByMonthMap.set(monthKey, { reached: 0, notReached: 0 });
    }
    if (!statusByMonthMap.has(monthKey)) {
      statusByMonthMap.set(monthKey, { verified: 0, failed: 0 });
    }

    const reachedEntry = reachedByMonthMap.get(monthKey)!;
    const statusEntry = statusByMonthMap.get(monthKey)!;

    // Categorize
    if (HIPAA_VERIFIED.includes(statusVal)) {
      reachedEntry.reached++;
      statusEntry.verified++;
    } else if (HIPAA_NOT_REACHED.includes(statusVal)) {
      reachedEntry.notReached++;
    } else if (HIPAA_FAILED.includes(statusVal)) {
      reachedEntry.reached++; // They were reached but failed verification
      statusEntry.failed++;

      // Get reason
      const reason = reasonsMap.get(row.questnr_rspn_id) || "Reason Not Provided";
      
      if (statusVal === "declined_to_verify_hipaa") {
        declinedReasonsMap.set(reason, (declinedReasonsMap.get(reason) || 0) + 1);
      } else if (statusVal === "unable_to_verify_hipaa") {
        unableToVerifyReasonsMap.set(reason, (unableToVerifyReasonsMap.get(reason) || 0) + 1);
      }
    }
  }

  // Sort months chronologically
  const sortMonths = (a: string, b: string) => {
    const parseMonth = (m: string) => {
      const [year, month] = m.split(" ");
      const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
      return parseInt(year) * 12 + monthIndex;
    };
    return parseMonth(a) - parseMonth(b);
  };

  const reachedByMonth: MembersReachedMonthly[] = Array.from(reachedByMonthMap.entries())
    .sort((a, b) => sortMonths(a[0], b[0]))
    .map(([month, data]) => ({ month, ...data }));

  const statusByMonth: MembersStatusMonthly[] = Array.from(statusByMonthMap.entries())
    .sort((a, b) => sortMonths(a[0], b[0]))
    .map(([month, data]) => ({ month, ...data }));

  const declinedReasons: VerificationReason[] = Array.from(declinedReasonsMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const unableToVerifyReasons: VerificationReason[] = Array.from(unableToVerifyReasonsMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    reachedByMonth,
    statusByMonth,
    declinedReasons,
    unableToVerifyReasons,
  };
}
