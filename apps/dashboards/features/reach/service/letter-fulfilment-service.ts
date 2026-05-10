import { memberCommGraphqlRequest } from "@/lib/api/member-comm-graphql-client";
import { mbrProvGraphqlRequest } from "@/lib/api/mbr-prov-graphql-client";

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type LetterStatusTab =
  | "In Progress"
  | "Failed"
  | "Success"
  | "Disbursement Delay";

// ─── Reference IDs (mbr_cmnct_ref) ───────────────────────────────────────────
// memberCommunicationStatusType — UPDATED to match production SQL (old IDs in comments)
const STS_ELGS_RECEIVED  = 27020; // ELGS Received (was 25060)
const STS_ELGS_GENERATE  = 25962; // ELGS Generate (was 25061)
const STS_ELGS_PRINT     = 25975; // ELGS Print (was 25062)
const STS_ELGS_TO_SFLY   = 25972; // ELGS to SFLY (was 25063)
const STS_ELGS_TO_OPS    = 24804; // ELGS to OPS
const STS_ELGS_TO_FAX    = 25973; // ELGS to FAX (was 25106)
const STS_OPS_DISBURSED  = 24805; // OPS Disbursed
const STS_SFLY_DISBURSED = 25970; // SFLY Disbursed (was 25064)
const STS_FAX_DISBURSED  = 25107; // FAX Disbursed

const DISBURSED_IDS       = [STS_OPS_DISBURSED, STS_SFLY_DISBURSED, STS_FAX_DISBURSED];
const SENT_TO_VENDOR_IDS  = [STS_ELGS_TO_OPS, STS_ELGS_TO_SFLY, STS_ELGS_TO_FAX];
const FAILED_IDS = [
  24802, 24803, 24806, 24810, 24811, 24812, 24813,
  25065, 25066, 25067, 25068, 25069,
  25070, 25071, 25072, 25073, 25074, 25075, 25076,
  25077, 25078, 25079, 25080, 25081, 25082,
  25083, 25084, 25085, 25086, 25087, 25088, 25089, 25090, 25091,
  25092, 25093, 25094, 25095, 25096, 25097, 25098, 25099,
  25100, 25101, 25102, 25103, 25104, 25105, 25108, 25109, 25110, 25111, 25112,
  25954, 25955, 25956, 25963, 25964, 25965, 25966, 25967,
];

// memberCommunicationSubjectType
const SBJ_MEMBER_ID       = 25046; // memberID
const SBJ_INTERACTION_ID  = 24850; // interactionID
const SBJ_TEMPLATE_NAME   = 25041; // templateName
const SBJ_DELIVERY_METHOD = 25042; // deliveryMethod

// memberCommunicationKeyType
const KEY_LETTER_TRACKING = 25052; // letterTrackingID

// letterAttributeType — template names are stored in mbr_cmnct_atr with this ref_id
const ATR_TEMPLATE_NAME = 25041; // templateName (stored in atr table per production SQL)

// memberCommunicationParticipantRoleType
const PRTCP_MEMBER_ROLE    = 25030; // Member
const PRTCP_SHIP_TO_MEMBER = 21704; // Ship to Member

// REACH-specific template names (CEQ = Curo/ELGS letter program)
const REACH_TEMPLATE_NAMES = ["CEQ_Pharmacy_Coversheet", "CEQ_MedAdherence_Coversheet"];

export type DateRangeKey =
  | "last3Months"
  | "last30Days"
  | "last60Days"
  | "lastMonth"
  | "lastWeek"
  | "today";

export type LetterRecord = {
  mbr_cmnct_id: string;
  cli_org_id: string | null;
  member_id: string | null;
  interaction_id: string | null;
  letter_tracking_id: string | null;
  letter_template_name: string | null;
  delivery_method: string | null;
  recipient: string | null;
  creat_dttm: string;
  elgs_received_dttm: string | null;
  elgs_generate_dttm: string | null;
  elgs_print_dttm: string | null;
  elgs_sent_dttm: string | null;
  mailed_faxed_dttm: string | null;
  org_name: string | null;
};

export type LetterPage = {
  records: LetterRecord[];
  totalCount: number;
};

export type LetterFilterOptions = {
  orgs: string[];
};

// ─── Raw GraphQL response types ───────────────────────────────────────────────

type RawStsChg = {
  mbr_cmnct_sts_ref_id: number;
  sts_dttm: string;
};

type RawKey = {
  mbr_cmnct_key_typ_ref_id: number;
  mbr_cmnct_key_val: string;
};

type RawAtr = {
  mbr_cmnct_atr_typ_ref_id: number;
  mbr_cmnct_atr_val: string;
};

type RawSbj = {
  mbr_cmnct_sbj_typ_ref_id: number;
  mbr_cmnct_sbj_id: string;
};

type RawPrtcp = {
  mbr_cmnct_prtcp_role_ref_id: number;
  fst_nm: string | null;
  lst_nm: string | null;
};

type RawLetter = {
  mbr_cmnct_id: string;
  cli_org_id: string | null;
  creat_dttm: string;
  mbr_cmnct_sts_chgs: RawStsChg[];
  mbr_cmnct_keys: RawKey[];
  mbr_cmnct_atrs: RawAtr[];
  mbr_cmnct_sbjs: RawSbj[];
  mbr_cmnct_prtcps: RawPrtcp[];
};

// ─── Date range helpers ───────────────────────────────────────────────────────

export function getDateRange(key: DateRangeKey): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();

  const subtract = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  switch (key) {
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

// ─── Status tab WHERE fragment ────────────────────────────────────────────────

function buildStatusWhere(tab: LetterStatusTab): string {
  const disbursed = DISBURSED_IDS.join(", ");
  const sentToVendor = SENT_TO_VENDOR_IDS.join(", ");
  const failed = FAILED_IDS.join(", ");
  switch (tab) {
    case "In Progress":
      return `
        _and: [
          { mbr_cmnct_sts_chgs: { mbr_cmnct_sts_ref_id: { _eq: ${STS_ELGS_RECEIVED} } } }
          { _not: { mbr_cmnct_sts_chgs: { mbr_cmnct_sts_ref_id: { _in: [${disbursed}] } } } }
          { _not: { mbr_cmnct_sts_chgs: { mbr_cmnct_sts_ref_id: { _in: [${sentToVendor}] } } } }
        ]`;
    case "Failed":
      return `mbr_cmnct_sts_chgs: { mbr_cmnct_sts_ref_id: { _in: [${failed}] } }`;
    case "Success":
      return `mbr_cmnct_sts_chgs: { mbr_cmnct_sts_ref_id: { _in: [${disbursed}] } }`;
    case "Disbursement Delay":
      return `
        _and: [
          { mbr_cmnct_sts_chgs: { mbr_cmnct_sts_ref_id: { _in: [${sentToVendor}] } } }
          { _not: { mbr_cmnct_sts_chgs: { mbr_cmnct_sts_ref_id: { _in: [${disbursed}] } } } }
        ]`;
  }
}

// ─── Org helpers (mbr-prov domain) ───────────────────────────────────────────
// Org is determined by the member's indv.org_id, not mbr_cmnct.cli_org_id.
// Flow: memberID (mbr_cmnct_sbj ref 25046) → indv.indv_id → indv.org_id → indv_cli_org.org_nm

/** Batch-looks up org name for a set of member IDs via indv → indv_cli_org. */
async function fetchOrgsByMemberIds(memberIds: string[]): Promise<Record<string, string>> {
  if (memberIds.length === 0) return {};
  const numericIds = [...new Set(memberIds)].map(Number).filter((n) => !isNaN(n) && n > 0);
  if (numericIds.length === 0) return {};

  // Batch in chunks of 1000, run in parallel
  const CHUNK = 1000;
  const chunks: number[][] = [];
  for (let i = 0; i < numericIds.length; i += CHUNK) chunks.push(numericIds.slice(i, i + CHUNK));

  const indvRows = (
    await Promise.all(
      chunks.map((chunk) =>
        mbrProvGraphqlRequest<{ indv: Array<{ indv_id: number; org_id: string | null }> }>(
          `query FetchIndvOrgs($ids: [bigint!]!) {
             indv(where: { indv_id: { _in: $ids }, org_id: { _is_null: false } }) {
               indv_id org_id
             }
           }`,
          { ids: chunk },
        ),
      ),
    )
  ).flatMap((d) => d.indv);

  const orgIds = [...new Set(indvRows.map((r) => r.org_id).filter((id): id is string => id != null))];
  if (orgIds.length === 0) return {};

  const orgData = await mbrProvGraphqlRequest<{
    indv_cli_org: Array<{ cli_org_id: string; org_nm: string }>;
  }>(
    `query FetchOrgNames($ids: [String!]!) {
       indv_cli_org(
         distinct_on: cli_org_id
         where: { cli_org_id: { _in: $ids }, org_nm: { _is_null: false } }
       ) { cli_org_id org_nm }
     }`,
    { ids: orgIds },
  );

  const orgNameMap = new Map(orgData.indv_cli_org.map((r) => [r.cli_org_id, r.org_nm]));
  const result: Record<string, string> = {};
  for (const row of indvRows) {
    const name = row.org_id ? orgNameMap.get(row.org_id) : undefined;
    if (name) result[String(row.indv_id)] = name;
  }
  return result;
}

/**
 * Fetches all REACH CEQ member IDs for the given tab/date, looks up their orgs
 * via indv, and returns those whose org matches orgName.
 * Used for the org filter in fetchLetterRecords.
 */
async function fetchMemberIdsForOrgInTab(
  tab: LetterStatusTab,
  dateRange: DateRangeKey,
  orgName: string,
): Promise<string[]> {
  // const { startDate, endDate } = getDateRange(dateRange);
  const startDate = "2025-12-15T00:00:00.000Z";
  const endDate = "2026-01-11T23:59:59.999Z";
  const statusWhere = buildStatusWhere(tab);

  const reachData = await memberCommGraphqlRequest<{
    mbr_cmnct: Array<{ mbr_cmnct_sbjs: Array<{ mbr_cmnct_sbj_id: string }> }>;
  }>(
    `query FetchReachMemberIds($startDate: timestamp!, $endDate: timestamp!) {
       mbr_cmnct(
         where: { _and: [
           { creat_dttm: { _gte: $startDate, _lte: $endDate } }
           { mbr_cmnct_atrs: { _and: [
               { mbr_cmnct_atr_typ_ref_id: { _eq: ${ATR_TEMPLATE_NAME} } }
               { mbr_cmnct_atr_val: { _in: ${JSON.stringify(REACH_TEMPLATE_NAMES)} } }
             ] } }
           { ${statusWhere} }
         ] }
         limit: 100000
       ) {
         mbr_cmnct_sbjs(where: { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_MEMBER_ID} } }) {
           mbr_cmnct_sbj_id
         }
       }
     }`,
    { startDate, endDate },
  );

  const allMemberIds = [
    ...new Set(reachData.mbr_cmnct.flatMap((r) => r.mbr_cmnct_sbjs.map((s) => s.mbr_cmnct_sbj_id))),
  ];

  const orgByMemberId = await fetchOrgsByMemberIds(allMemberIds);
  return Object.entries(orgByMemberId)
    .filter(([, nm]) => nm === orgName)
    .map(([id]) => id);
}

// ─── Raw → domain mapping ─────────────────────────────────────────────────────

function mapRawLetter(raw: RawLetter, orgByMemberId: Record<string, string>): LetterRecord {
  // Use Number() coercions on all ref_id keys — Hasura may return bigint columns as strings,
  // so strict === comparison against numeric literals would silently fail without this.
  const stsMap = new Map(raw.mbr_cmnct_sts_chgs.map((s) => [Number(s.mbr_cmnct_sts_ref_id), s.sts_dttm]));
  const keyMap = new Map(raw.mbr_cmnct_keys.map((k) => [Number(k.mbr_cmnct_key_typ_ref_id), k.mbr_cmnct_key_val]));
  const sbjMap = new Map(raw.mbr_cmnct_sbjs.map((s) => [Number(s.mbr_cmnct_sbj_typ_ref_id), s.mbr_cmnct_sbj_id]));
  // Template name is stored in mbr_cmnct_atrs (not mbr_cmnct_sbjs)
  const atrMap = new Map(raw.mbr_cmnct_atrs.map((a) => [Number(a.mbr_cmnct_atr_typ_ref_id), a.mbr_cmnct_atr_val]));
  
  // Find first participant with a non-empty name (production SQL joins all participants without role filter)
  const recipientPrtcp = raw.mbr_cmnct_prtcps.find(
    (p) => (p.fst_nm && p.fst_nm.trim()) || (p.lst_nm && p.lst_nm.trim())
  );
  const recipient = recipientPrtcp
    ? [recipientPrtcp.fst_nm, recipientPrtcp.lst_nm].filter(Boolean).join(" ").trim() || null
    : null;

  const memberId = sbjMap.get(SBJ_MEMBER_ID) ?? null;

  return {
    mbr_cmnct_id: raw.mbr_cmnct_id,
    cli_org_id: raw.cli_org_id,
    member_id: memberId,
    interaction_id: sbjMap.get(SBJ_INTERACTION_ID) ?? null,
    letter_tracking_id: keyMap.get(KEY_LETTER_TRACKING) ?? null,
    letter_template_name: atrMap.get(ATR_TEMPLATE_NAME) ?? null,
    delivery_method: sbjMap.get(SBJ_DELIVERY_METHOD) ?? null,
    recipient,
    creat_dttm: raw.creat_dttm,
    elgs_received_dttm: stsMap.get(STS_ELGS_RECEIVED) ?? null,
    elgs_generate_dttm: stsMap.get(STS_ELGS_GENERATE) ?? null,
    elgs_print_dttm: stsMap.get(STS_ELGS_PRINT) ?? null,
    elgs_sent_dttm: stsMap.get(STS_ELGS_TO_OPS) ?? stsMap.get(STS_ELGS_TO_SFLY) ?? stsMap.get(STS_ELGS_TO_FAX) ?? null,
    mailed_faxed_dttm: stsMap.get(STS_OPS_DISBURSED) ?? stsMap.get(STS_SFLY_DISBURSED) ?? stsMap.get(STS_FAX_DISBURSED) ?? null,
    org_name: (memberId ? orgByMemberId[memberId] : null) ?? null,
  };
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchLetterRecords(
  tab: LetterStatusTab,
  dateRange: DateRangeKey,
  page: number,
  pageSize: number,
  memberId: string = "All",
  org: string = "All",
): Promise<LetterPage> {
  // const { startDate, endDate } = getDateRange(dateRange);
  const startDate = "2025-12-15T00:00:00.000Z";
  const endDate = "2026-01-11T23:59:59.999Z";
  const offset = (page - 1) * pageSize;
  const statusWhere = buildStatusWhere(tab);

  // For org filter: resolve matching member IDs from indv (cross-domain via mbr-prov)
  let orgMemberIds: string[] | null = null;
  if (org !== "All") {
    orgMemberIds = await fetchMemberIdsForOrgInTab(tab, dateRange, org);
    if (orgMemberIds.length === 0) return { records: [], totalCount: 0 };
  }

  const andConditions: string[] = [
    `{ creat_dttm: { _gte: $startDate, _lte: $endDate } }`,
    // REACH letters only — filter by CEQ template names in mbr_cmnct_atr (matches production SQL: mcstemplatename.mbr_cmnct_atr_val)
    `{ mbr_cmnct_atrs: { _and: [
        { mbr_cmnct_atr_typ_ref_id: { _eq: ${ATR_TEMPLATE_NAME} } }
        { mbr_cmnct_atr_val: { _in: ${JSON.stringify(REACH_TEMPLATE_NAMES)} } }
      ] } }`,
    `{ ${statusWhere} }`,
  ];

  if (memberId !== "All") {
    andConditions.push(
      `{ mbr_cmnct_sbjs: { _and: [
          { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_MEMBER_ID} } }
          { mbr_cmnct_sbj_id: { _eq: $memberId } }
        ] } }`,
    );
  }

  if (orgMemberIds) {
    andConditions.push(
      `{ mbr_cmnct_sbjs: { _and: [
          { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_MEMBER_ID} } }
          { mbr_cmnct_sbj_id: { _in: $orgMemberIds } }
        ] } }`,
    );
  }

  const whereClause = `_and: [\n${andConditions.join(",\n")}\n]`;

  const varDecls = [
    "$limit: Int!",
    "$offset: Int!",
    "$startDate: timestamp!",
    "$endDate: timestamp!",
    memberId !== "All" ? "$memberId: String!" : null,
    orgMemberIds ? "$orgMemberIds: [String!]!" : null,
  ].filter(Boolean).join(", ");

  const query = `
    query FetchLetterFulfilment(${varDecls}) {
      mbr_cmnct(
        where: { ${whereClause} }
        limit: $limit
        offset: $offset
        order_by: { creat_dttm: desc }
      ) {
        mbr_cmnct_id
        cli_org_id
        creat_dttm
        mbr_cmnct_sts_chgs { mbr_cmnct_sts_ref_id sts_dttm }
        mbr_cmnct_keys { mbr_cmnct_key_typ_ref_id mbr_cmnct_key_val }
        mbr_cmnct_atrs { mbr_cmnct_atr_typ_ref_id mbr_cmnct_atr_val }
        mbr_cmnct_sbjs { mbr_cmnct_sbj_typ_ref_id mbr_cmnct_sbj_id }
        mbr_cmnct_prtcps { mbr_cmnct_prtcp_role_ref_id fst_nm lst_nm }
      }
      mbr_cmnct_aggregate(where: { ${whereClause} }) {
        aggregate { count }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    limit: pageSize,
    offset,
    startDate,
    endDate,
  };
  if (memberId !== "All") variables.memberId = memberId;
  if (orgMemberIds) variables.orgMemberIds = orgMemberIds;

  type Response = {
    mbr_cmnct: RawLetter[];
    mbr_cmnct_aggregate: { aggregate: { count: number } };
  };

  const data = await memberCommGraphqlRequest<Response>(query, variables);
  const totalCount = data.mbr_cmnct_aggregate.aggregate.count;

  // Look up org names for this page's member IDs via indv → indv_cli_org
  const pageMembers = [
    ...new Set(
      data.mbr_cmnct
        .flatMap((r) => r.mbr_cmnct_sbjs)
        .filter((s) => s.mbr_cmnct_sbj_typ_ref_id === SBJ_MEMBER_ID)
        .map((s) => s.mbr_cmnct_sbj_id),
    ),
  ];
  const orgByMemberId =
    org !== "All"
      ? Object.fromEntries(pageMembers.map((id) => [id, org]))
      : await fetchOrgsByMemberIds(pageMembers);

  return {
    records: data.mbr_cmnct.map((raw) => mapRawLetter(raw, orgByMemberId)),
    totalCount,
  };
}

// ─── Filter options ───────────────────────────────────────────────────────────

async function fetchOrgsForTab(tab: LetterStatusTab, dateRange: DateRangeKey): Promise<string[]> {
  // const { startDate, endDate } = getDateRange(dateRange);
  const startDate = "2025-12-15T00:00:00.000Z";
  const endDate = "2026-01-11T23:59:59.999Z";
  const statusWhere = buildStatusWhere(tab);

  // Fetch all REACH member IDs for this tab/date (member IDs only — lightweight)
  const data = await memberCommGraphqlRequest<{
    mbr_cmnct: Array<{ mbr_cmnct_sbjs: Array<{ mbr_cmnct_sbj_id: string }> }>;
  }>(
    `query FetchOrgsForTab($startDate: timestamp!, $endDate: timestamp!) {
       mbr_cmnct(
         where: { _and: [
           { creat_dttm: { _gte: $startDate, _lte: $endDate } }
           { mbr_cmnct_atrs: { _and: [
               { mbr_cmnct_atr_typ_ref_id: { _eq: ${ATR_TEMPLATE_NAME} } }
               { mbr_cmnct_atr_val: { _in: ${JSON.stringify(REACH_TEMPLATE_NAMES)} } }
             ] } }
           { ${statusWhere} }
         ] }
         limit: 100000
       ) {
         mbr_cmnct_sbjs(where: { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_MEMBER_ID} } }) {
           mbr_cmnct_sbj_id
         }
       }
     }`,
    { startDate, endDate },
  );

  const allMemberIds = [
    ...new Set(data.mbr_cmnct.flatMap((r) => r.mbr_cmnct_sbjs.map((s) => s.mbr_cmnct_sbj_id))),
  ];

  const orgByMemberId = await fetchOrgsByMemberIds(allMemberIds);
  return [...new Set(Object.values(orgByMemberId))].filter(Boolean).sort();
}

export async function fetchLetterFilterOptions(
  dateRange: DateRangeKey,
  tab: LetterStatusTab,
): Promise<LetterFilterOptions> {
  const orgs = await fetchOrgsForTab(tab, dateRange);
  return { orgs };
}
