import { memberCommGraphqlRequest } from "@/lib/api/member-comm-graphql-client";
import { mbrProvGraphqlRequest } from "@/lib/api/mbr-prov-graphql-client";

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type LetterStatusTab =
  | "In Progress"
  | "Failed"
  | "Success"
  | "Disbursement Delay";

// ─── Reference IDs (mbr_cmnct_ref) ───────────────────────────────────────────
// Timestamp lookup IDs (NEW IDs per production SQL comments "previously X")
const STS_ELGS_RECEIVED  = 27020; // ELGS Received (was 25060)
const STS_ELGS_GENERATE  = 25962; // ELGS Generate (was 25061)
const STS_ELGS_PRINT     = 25975; // ELGS Print (was 25062)
const STS_ELGS_TO_SFLY   = 25972; // ELGS to SFLY (was 25063)
const STS_ELGS_TO_OPS    = 24804; // ELGS to OPS
const STS_ELGS_TO_FAX    = 25973; // ELGS to FAX (was 25106)
const STS_OPS_DISBURSED  = 24805; // OPS Disbursed
const STS_SFLY_DISBURSED = 25970; // SFLY Disbursed (was 25064)
const STS_FAX_DISBURSED  = 25107; // FAX Disbursed

// Status classification IDs from production SQL (includes both old and new IDs during migration)
const IN_PROGRESS_IDS = [24804, 25060, 25962, 25975, 25972, 25973, 25988, 25989];
const SUCCESS_IDS = [25107, 24805, 25970, 25930];

// memberCommunicationSubjectType
const SBJ_MEMBER_ID       = 25046; // memberID
const SBJ_INTERACTION_ID  = 24850; // interactionID
const SBJ_HSC_ID          = 25045; // hscID (HSC/CM letters - to be excluded)

// memberCommunicationAttributeType (stored in mbr_cmnct_atr)
const ATR_DELIVERY_METHOD = 25042; // deliveryMethod

// memberCommunicationKeyType
const KEY_LETTER_TRACKING = 25052; // letterTrackingID

// letterAttributeType — template names are stored in mbr_cmnct_atr with this ref_id
const ATR_TEMPLATE_NAME = 25041; // templateName (stored in atr table per production SQL)

// memberCommunicationCategoryType - 2.0 letters only (production SQL filter)
const CATEGORY_2_0_LETTERS = [20700, 20701, 20715, 20747, 20753, 74006];

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
             indv(where: { 
               _and: [
                 { indv_id: { _in: $ids } }
                 { indv_id: { _gt: 0 } }
                 { org_id: { _is_null: false } }
               ]
             }) {
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

/** Batch-looks up reference display names for participant role ref IDs. */
async function fetchRefDisplayNames(refIds: number[]): Promise<Record<number, string>> {
  if (refIds.length === 0) return {};
  const uniqueIds = [...new Set(refIds)];
  
  const refData = await memberCommGraphqlRequest<{
    mbr_cmnct_ref: Array<{ ref_id: number; ref_dspl: string }>;
  }>(
    `query FetchRefDisplayNames($ids: [Int!]!) {
       mbr_cmnct_ref(where: { ref_id: { _in: $ids }, ref_dspl: { _is_null: false } }) {
         ref_id ref_dspl
       }
     }`,
    { ids: uniqueIds },
  );

  return Object.fromEntries(refData.mbr_cmnct_ref.map((r) => [r.ref_id, r.ref_dspl]));
}

/**
 * Fetches all REACH CEQ member IDs for the given date range, looks up their orgs
 * via indv, and returns those whose org matches orgName.
 * Used for the org filter in fetchLetterRecords.
 */
async function fetchMemberIdsForOrg(
  dateRange: DateRangeKey,
  orgName: string,
): Promise<string[]> {
  const { startDate, endDate } = getDateRange(dateRange);

  const reachData = await memberCommGraphqlRequest<{
    mbr_cmnct: Array<{ 
      mbr_cmnct_sbjs: Array<{ mbr_cmnct_sbj_id: string }>;
      mbr_cmnct_atrs: Array<{ mbr_cmnct_atr_typ_ref_id: number; mbr_cmnct_atr_val: string }>;
    }>;
  }>(
    `query FetchReachMemberIds($startDate: timestamp!, $endDate: timestamp!) {
       mbr_cmnct(
         where: { _and: [
           { creat_dttm: { _gte: $startDate, _lte: $endDate } }
           { mbr_cmnct_atrs: { _and: [
               { mbr_cmnct_atr_typ_ref_id: { _eq: ${ATR_TEMPLATE_NAME} } }
               { mbr_cmnct_atr_val: { _in: ${JSON.stringify(REACH_TEMPLATE_NAMES)} } }
             ] } }
           { mbr_cmnct_catgy_ref_id: { _in: ${JSON.stringify(CATEGORY_2_0_LETTERS)} } }
           { _not: { mbr_cmnct_sbjs: { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_HSC_ID} } } } }
         ] }
         limit: 100000
       ) {
         mbr_cmnct_sbjs(where: { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_MEMBER_ID} } }) {
           mbr_cmnct_sbj_id
         }
         mbr_cmnct_atrs { mbr_cmnct_atr_typ_ref_id mbr_cmnct_atr_val }
       }
     }`,
    { startDate, endDate },
  );

  const allMemberIds = [
    ...new Set(
      reachData.mbr_cmnct
        .filter((r) => {
          // Exclude TESTONLY
          const deliveryMethod = r.mbr_cmnct_atrs.find(a => a.mbr_cmnct_atr_typ_ref_id === ATR_DELIVERY_METHOD)?.mbr_cmnct_atr_val ?? null;
          if (deliveryMethod && deliveryMethod.toUpperCase() === 'TESTONLY') {
            return false;
          }
          return true;
        })
        .flatMap((r) => r.mbr_cmnct_sbjs.map((s) => s.mbr_cmnct_sbj_id))
    ),
  ].filter(id => {
    const idNum = Number(id);
    return !isNaN(idNum) && idNum > 0; // Production SQL: where indv_id>0
  });

  const orgByMemberId = await fetchOrgsByMemberIds(allMemberIds);
  return Object.entries(orgByMemberId)
    .filter(([, nm]) => nm === orgName)
    .map(([id]) => id);
}

// ─── Raw → domain mapping ─────────────────────────────────────────────────────

function mapRawLetter(
  raw: RawLetter, 
  orgByMemberId: Record<string, string>,
  refDsplMap: Record<number, string>
): LetterRecord {
  // Use Number() coercions on all ref_id keys — Hasura may return bigint columns as strings,
  // so strict === comparison against numeric literals would silently fail without this.
  const stsMap = new Map(raw.mbr_cmnct_sts_chgs.map((s) => [Number(s.mbr_cmnct_sts_ref_id), s.sts_dttm]));
  const keyMap = new Map(raw.mbr_cmnct_keys.map((k) => [Number(k.mbr_cmnct_key_typ_ref_id), k.mbr_cmnct_key_val]));
  const sbjMap = new Map(raw.mbr_cmnct_sbjs.map((s) => [Number(s.mbr_cmnct_sbj_typ_ref_id), s.mbr_cmnct_sbj_id]));
  // Template name and delivery method are stored in mbr_cmnct_atrs (not mbr_cmnct_sbjs)
  const atrMap = new Map(raw.mbr_cmnct_atrs.map((a) => [Number(a.mbr_cmnct_atr_typ_ref_id), a.mbr_cmnct_atr_val]));
  
  // Recipient is the reference display name from mbr_cmnct_ref (e.g., "PCP" = Primary Care Provider)
  // Production SQL: r.ref_dspl as Recipient from mbr_cmnct_prtcp joined to mbr_cmnct_ref
  const roleRefId = raw.mbr_cmnct_prtcps[0]?.mbr_cmnct_prtcp_role_ref_id;
  const recipient = roleRefId ? refDsplMap[roleRefId] ?? null : null;

  const memberId = sbjMap.get(SBJ_MEMBER_ID) ?? null;

  return {
    mbr_cmnct_id: raw.mbr_cmnct_id,
    cli_org_id: raw.cli_org_id,
    member_id: memberId,
    interaction_id: sbjMap.get(SBJ_INTERACTION_ID) ?? null,
    letter_tracking_id: keyMap.get(KEY_LETTER_TRACKING) ?? null,
    letter_template_name: atrMap.get(ATR_TEMPLATE_NAME) ?? null,
    delivery_method: atrMap.get(ATR_DELIVERY_METHOD) ?? null,
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

// ─── Status classification (matches production SQL logic) ────────────────────

function getLatestStatus(statusChanges: { mbr_cmnct_sts_ref_id: number; sts_dttm: string }[]): number | null {
  if (statusChanges.length === 0) return null;
  // Sort by sts_dttm DESC to get latest (handle null timestamps)
  const sorted = [...statusChanges]
    .filter(s => s.sts_dttm != null)
    .sort((a, b) => b.sts_dttm.localeCompare(a.sts_dttm));
  if (sorted.length === 0) return null;
  return sorted[0].mbr_cmnct_sts_ref_id;
}

function classifyLetterStatus(latestStatusId: number | null, deliveryMethod: string | null): LetterStatusTab | null {
  if (latestStatusId === null) return null;
  
  // Production SQL logic for status classification
  const isEdelivery = deliveryMethod?.toUpperCase() === 'EDELIVERY';
  
  // Success: status in SUCCESS_IDS or (edelivery AND 25975)
  if (SUCCESS_IDS.includes(latestStatusId) || (isEdelivery && latestStatusId === 25975)) {
    return "Success";
  }
  
  // In Progress: status in IN_PROGRESS_IDS AND NOT edelivery
  if (IN_PROGRESS_IDS.includes(latestStatusId) && !isEdelivery) {
    return "In Progress";
  }
  
  // Failed: everything else (not in success or in-progress)
  return "Failed";
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
  const { startDate, endDate } = getDateRange(dateRange);

  // For org filter: resolve matching member IDs from indv (cross-domain via mbr-prov)
  let orgMemberIds: string[] | null = null;
  if (org !== "All") {
    // Note: we can't use tab filtering here anymore since we need all records first
    orgMemberIds = await fetchMemberIdsForOrg(dateRange, org);
    if (orgMemberIds.length === 0) return { records: [], totalCount: 0 };
  }

  // Production SQL approach: fetch ALL matching records (no status filtering in WHERE clause)
  // Status filtering happens in memory based on LATEST status
  const andConditions: string[] = [
    `{ creat_dttm: { _gte: $startDate, _lte: $endDate } }`,
    // REACH letters only — filter by CEQ template names
    `{ mbr_cmnct_atrs: { _and: [
        { mbr_cmnct_atr_typ_ref_id: { _eq: ${ATR_TEMPLATE_NAME} } }
        { mbr_cmnct_atr_val: { _in: ${JSON.stringify(REACH_TEMPLATE_NAMES)} } }
      ] } }`,
    // Production SQL: Only 2.0 letters (mbr_cmnct_catgy_ref_id filter)
    `{ mbr_cmnct_catgy_ref_id: { _in: ${JSON.stringify(CATEGORY_2_0_LETTERS)} } }`,
    // Production SQL: Exclude CM letters (msbjhscid.mbr_cmnct_sbj_id is null)
    `{ _not: { mbr_cmnct_sbjs: { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_HSC_ID} } } } }`,
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
    "$startDate: timestamp!",
    "$endDate: timestamp!",
    memberId !== "All" ? "$memberId: String!" : null,
    orgMemberIds ? "$orgMemberIds: [String!]!" : null,
  ].filter(Boolean).join(", ");

  const query = `
    query FetchLetterFulfilment(${varDecls}) {
      mbr_cmnct(
        where: { ${whereClause} }
        order_by: { creat_dttm: desc }
        limit: 50000
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
    }
  `;

  const variables: Record<string, unknown> = {
    startDate,
    endDate,
  };
  if (memberId !== "All") variables.memberId = memberId;
  if (orgMemberIds) variables.orgMemberIds = orgMemberIds;

  type Response = {
    mbr_cmnct: RawLetter[];
  };

  const data = await memberCommGraphqlRequest<Response>(query, variables);

  // Production Power BI status IDs for disbursed/distributed check
  const DISBURSED_STATUS_IDS = [24805, 25970, 25107, 26988]; // mcscdistributed from prod SQL
  const PRINT_STATUS_ID = 25975; // mcscprint from prod SQL

  // Debug: Count status classification before filtering
  const statusCounts: Record<string, number> = { "Success": 0, "In Progress": 0, "Failed": 0, "Disbursement Delay": 0, "null": 0 };
  const validRecords = data.mbr_cmnct.filter((raw) => {
    // Filter out records with invalid member IDs
    const memberIdSubj = raw.mbr_cmnct_sbjs.find(s => s.mbr_cmnct_sbj_typ_ref_id === SBJ_MEMBER_ID);
    const memberId = memberIdSubj?.mbr_cmnct_sbj_id;
    if (memberId) {
      const memberIdNum = Number(memberId);
      if (isNaN(memberIdNum) || memberIdNum <= 0) {
        return false;
      }
    }
    // Filter out TESTONLY
    const deliveryMethod = raw.mbr_cmnct_atrs.find(a => a.mbr_cmnct_atr_typ_ref_id === ATR_DELIVERY_METHOD)?.mbr_cmnct_atr_val ?? null;
    if (deliveryMethod && deliveryMethod.toUpperCase() === 'TESTONLY') {
      return false;
    }
    return true;
  });
  
  validRecords.forEach((raw) => {
    const latestStatus = getLatestStatus(raw.mbr_cmnct_sts_chgs);
    const deliveryMethod = raw.mbr_cmnct_atrs.find(a => a.mbr_cmnct_atr_typ_ref_id === ATR_DELIVERY_METHOD)?.mbr_cmnct_atr_val ?? null;
    const recordTab = classifyLetterStatus(latestStatus, deliveryMethod);
    statusCounts[recordTab ?? "null"]++;
  });
  console.warn(`[${tab}] Status distribution (after production filters):`, statusCounts);

  // Filter records by latest status (production SQL approach)
  const filteredRecords = data.mbr_cmnct.filter((raw) => {
    // Filter out records with invalid member IDs (production SQL: where indv_id>0)
    const memberIdSubj = raw.mbr_cmnct_sbjs.find(s => s.mbr_cmnct_sbj_typ_ref_id === SBJ_MEMBER_ID);
    const memberId = memberIdSubj?.mbr_cmnct_sbj_id;
    if (memberId) {
      const memberIdNum = Number(memberId);
      if (isNaN(memberIdNum) || memberIdNum <= 0) {
        return false; // Exclude records with invalid/negative member IDs
      }
    }
    
    // Production SQL: Exclude TESTONLY delivery method
    const deliveryMethod = raw.mbr_cmnct_atrs.find(a => a.mbr_cmnct_atr_typ_ref_id === ATR_DELIVERY_METHOD)?.mbr_cmnct_atr_val ?? null;
    if (deliveryMethod && deliveryMethod.toUpperCase() === 'TESTONLY') {
      return false;
    }
    
    const latestStatus = getLatestStatus(raw.mbr_cmnct_sts_chgs);
    const recordTab = classifyLetterStatus(latestStatus, deliveryMethod);
    
    if (recordTab !== tab) return false;
    
    // Production Power BI additional filter for In Progress tab:
    // "Main{Distributeddatetime is null and inprogress_status is 'Yes'}"
    // distributeddatetime = EDELIVERY ? mcscprint.sts_dttm : mcscdistributed.sts_dttm
    if (tab === "In Progress") {
      const isEdelivery = deliveryMethod?.toUpperCase() === 'EDELIVERY';
      const hasDisbursedStatus = raw.mbr_cmnct_sts_chgs.some(s => DISBURSED_STATUS_IDS.includes(s.mbr_cmnct_sts_ref_id));
      const hasPrintStatus = raw.mbr_cmnct_sts_chgs.some(s => s.mbr_cmnct_sts_ref_id === PRINT_STATUS_ID);
      const distributedDatetimeExists = isEdelivery ? hasPrintStatus : hasDisbursedStatus;
      
      // In Progress requires distributeddatetime to be null
      if (distributedDatetimeExists) return false;
    }
    
    return true;
  });

  const totalCount = filteredRecords.length;
  
  // Debug logging to verify filtering
  console.warn(`[${tab}] Total fetched: ${data.mbr_cmnct.length}, After filtering: ${totalCount}`);
  const offset = (page - 1) * pageSize;
  const pageRecords = filteredRecords.slice(offset, offset + pageSize);

  // Look up org names for this page's member IDs via indv → indv_cli_org
  const pageMembers = [
    ...new Set(
      pageRecords
        .flatMap((r) => r.mbr_cmnct_sbjs)
        .filter((s) => s.mbr_cmnct_sbj_typ_ref_id === SBJ_MEMBER_ID)
        .map((s) => s.mbr_cmnct_sbj_id),
    ),
  ];
  const orgByMemberId =
    org !== "All"
      ? Object.fromEntries(pageMembers.map((id) => [id, org]))
      : await fetchOrgsByMemberIds(pageMembers);

  // Look up reference display names for participant role ref IDs
  const roleRefIds = [
    ...new Set(
      pageRecords
        .flatMap((r) => r.mbr_cmnct_prtcps)
        .map((p) => p.mbr_cmnct_prtcp_role_ref_id)
        .filter((id) => id != null)
    ),
  ];
  const refDsplMap = await fetchRefDisplayNames(roleRefIds);

  return {
    records: pageRecords.map((raw) => mapRawLetter(raw, orgByMemberId, refDsplMap)),
    totalCount,
  };
}

// ─── Filter options ───────────────────────────────────────────────────────────

async function fetchOrgsForTab(tab: LetterStatusTab, dateRange: DateRangeKey): Promise<string[]> {
  const { startDate, endDate } = getDateRange(dateRange);

  // Production Power BI status IDs for disbursed/distributed check
  const DISBURSED_STATUS_IDS = [24805, 25970, 25107, 26988];
  const PRINT_STATUS_ID = 25975;

  // Fetch all REACH member IDs for this date range (no status filtering - matches production approach)
  const data = await memberCommGraphqlRequest<{
    mbr_cmnct: Array<{ 
      mbr_cmnct_sbjs: Array<{ mbr_cmnct_sbj_id: string }>;
      mbr_cmnct_sts_chgs: Array<{ mbr_cmnct_sts_ref_id: number; sts_dttm: string }>;
      mbr_cmnct_atrs: Array<{ mbr_cmnct_atr_typ_ref_id: number; mbr_cmnct_atr_val: string }>;
    }>;
  }>(
    `query FetchOrgsForTab($startDate: timestamp!, $endDate: timestamp!) {
       mbr_cmnct(
         where: { _and: [
           { creat_dttm: { _gte: $startDate, _lte: $endDate } }
           { mbr_cmnct_atrs: { _and: [
               { mbr_cmnct_atr_typ_ref_id: { _eq: ${ATR_TEMPLATE_NAME} } }
               { mbr_cmnct_atr_val: { _in: ${JSON.stringify(REACH_TEMPLATE_NAMES)} } }
             ] } }
           { mbr_cmnct_catgy_ref_id: { _in: ${JSON.stringify(CATEGORY_2_0_LETTERS)} } }
           { _not: { mbr_cmnct_sbjs: { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_HSC_ID} } } } }
         ] }
         limit: 100000
       ) {
         mbr_cmnct_sbjs(where: { mbr_cmnct_sbj_typ_ref_id: { _eq: ${SBJ_MEMBER_ID} } }) {
           mbr_cmnct_sbj_id
         }
         mbr_cmnct_sts_chgs { mbr_cmnct_sts_ref_id sts_dttm }
         mbr_cmnct_atrs { mbr_cmnct_atr_typ_ref_id mbr_cmnct_atr_val }
       }
     }`,
    { startDate, endDate },
  );

  // Filter by latest status matching the tab
  const filteredRecords = data.mbr_cmnct.filter((raw) => {
    // Filter out records with invalid member IDs (production SQL: where indv_id>0)
    const memberIdSubj = raw.mbr_cmnct_sbjs.find(s => s.mbr_cmnct_sbj_typ_ref_id === SBJ_MEMBER_ID);
    const memberId = memberIdSubj?.mbr_cmnct_sbj_id;
    if (memberId) {
      const memberIdNum = Number(memberId);
      if (isNaN(memberIdNum) || memberIdNum <= 0) {
        return false; // Exclude records with invalid/negative member IDs
      }
    }
    
    // Production SQL: Exclude TESTONLY delivery method
    const deliveryMethod = raw.mbr_cmnct_atrs.find(a => a.mbr_cmnct_atr_typ_ref_id === ATR_DELIVERY_METHOD)?.mbr_cmnct_atr_val ?? null;
    if (deliveryMethod && deliveryMethod.toUpperCase() === 'TESTONLY') {
      return false;
    }
    
    const latestStatus = getLatestStatus(raw.mbr_cmnct_sts_chgs);
    const recordTab = classifyLetterStatus(latestStatus, deliveryMethod);
    
    if (recordTab !== tab) return false;
    
    // Production Power BI additional filter for In Progress tab
    if (tab === "In Progress") {
      const isEdelivery = deliveryMethod?.toUpperCase() === 'EDELIVERY';
      const hasDisbursedStatus = raw.mbr_cmnct_sts_chgs.some(s => DISBURSED_STATUS_IDS.includes(s.mbr_cmnct_sts_ref_id));
      const hasPrintStatus = raw.mbr_cmnct_sts_chgs.some(s => s.mbr_cmnct_sts_ref_id === PRINT_STATUS_ID);
      const distributedDatetimeExists = isEdelivery ? hasPrintStatus : hasDisbursedStatus;
      if (distributedDatetimeExists) return false;
    }
    
    return true;
  });

  const allMemberIds = [
    ...new Set(filteredRecords.flatMap((r) => r.mbr_cmnct_sbjs.map((s) => s.mbr_cmnct_sbj_id))),
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
