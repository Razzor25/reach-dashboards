// Quick test script to verify actual status counts from database
// Run with: node --loader tsx test-counts.mjs

import { memberCommGraphqlRequest } from './lib/api/member-comm-graphql-client.ts';

// Constants from service
const ATR_TEMPLATE_NAME = 25041;
const ATR_DELIVERY_METHOD = 25042;
const REACH_TEMPLATE_NAMES = ["CEQ_Pharmacy_Coversheet", "CEQ_MedAdherence_Coversheet"];
const IN_PROGRESS_IDS = [24804, 25060, 25962, 25975, 25972, 25973, 25988, 25989];
const SUCCESS_IDS = [25107, 24805, 25970, 25930];
const DISBURSED_STATUS_IDS = [24805, 25970, 25107, 26988];
const PRINT_STATUS_ID = 25975;

async function fetchData() {
  const startDate = "2025-12-15T00:00:00.000Z";
  const endDate = "2026-01-11T23:59:59.999Z";

  const query = `
    query TestQuery($startDate: timestamp!, $endDate: timestamp!) {
      mbr_cmnct(
        where: { _and: [
          { creat_dttm: { _gte: $startDate, _lte: $endDate } }
          { mbr_cmnct_atrs: { _and: [
              { mbr_cmnct_atr_typ_ref_id: { _eq: ${ATR_TEMPLATE_NAME} } }
              { mbr_cmnct_atr_val: { _in: ${JSON.stringify(REACH_TEMPLATE_NAMES)} } }
            ] } }
        ] }
        limit: 50000
      ) {
        mbr_cmnct_id
        mbr_cmnct_sts_chgs { mbr_cmnct_sts_ref_id sts_dttm }
        mbr_cmnct_atrs { mbr_cmnct_atr_typ_ref_id mbr_cmnct_atr_val }
      }
    }
  `;

  const response = await fetch(MEMBER_COMM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables: { startDate, endDate } }),
  });

  const result = await response.json();
  if (result.errors) {
    console.error('GraphQL Errors:', result.errors);
    process.exit(1);
  }

  return result.data.mbr_cmnct;
}

function getLatestStatus(statusChanges) {
  if (statusChanges.length === 0) return null;
  const sorted = [...statusChanges].sort((a, b) => b.sts_dttm.localeCompare(a.sts_dttm));
  return sorted[0].mbr_cmnct_sts_ref_id;
}

function classifyLetterStatus(latestStatusId, deliveryMethod) {
  if (latestStatusId === null) return null;
  
  const isEdelivery = deliveryMethod?.toUpperCase() === 'EDELIVERY';
  
  // Success: status in SUCCESS_IDS or (edelivery AND 25975)
  if (SUCCESS_IDS.includes(latestStatusId) || (isEdelivery && latestStatusId === 25975)) {
    return "Success";
  }
  
  // In Progress: status in IN_PROGRESS_IDS AND NOT edelivery
  if (IN_PROGRESS_IDS.includes(latestStatusId) && !isEdelivery) {
    return "In Progress";
  }
  
  return "Failed";
}

async function main() {
  console.log('Fetching REACH letter data for date range 2025-12-15 to 2026-01-11...\n');
  
  const records = await fetchData();
  console.log(`Total records fetched: ${records.length}\n`);

  // Track delivery methods
  const deliveryMethods = new Map();
  
  // Count by basic classification (without distributeddatetime filter)
  const basicCounts = { "Success": 0, "In Progress": 0, "Failed": 0, "null": 0 };
  
  // Count with production Power BI filter (distributeddatetime null for In Progress)
  const filteredCounts = { "Success": 0, "In Progress": 0, "Failed": 0, "null": 0 };

  records.forEach((raw) => {
    const latestStatus = getLatestStatus(raw.mbr_cmnct_sts_chgs);
    const deliveryMethod = raw.mbr_cmnct_atrs.find(a => a.mbr_cmnct_atr_typ_ref_id === ATR_DELIVERY_METHOD)?.mbr_cmnct_atr_val ?? null;
    
    // Track delivery methods
    const key = deliveryMethod ?? "null";
    deliveryMethods.set(key, (deliveryMethods.get(key) || 0) + 1);
    
    const recordTab = classifyLetterStatus(latestStatus, deliveryMethod);
    basicCounts[recordTab ?? "null"]++;

    // Apply production Power BI filter for In Progress
    let finalTab = recordTab;
    if (recordTab === "In Progress") {
      const isEdelivery = deliveryMethod?.toUpperCase() === 'EDELIVERY';
      const hasDisbursedStatus = raw.mbr_cmnct_sts_chgs.some(s => DISBURSED_STATUS_IDS.includes(s.mbr_cmnct_sts_ref_id));
      const hasPrintStatus = raw.mbr_cmnct_sts_chgs.some(s => s.mbr_cmnct_sts_ref_id === PRINT_STATUS_ID);
      const distributedDatetimeExists = isEdelivery ? hasPrintStatus : hasDisbursedStatus;
      
      if (distributedDatetimeExists) {
        finalTab = null; // Excluded from In Progress
      }
    }
    
    filteredCounts[finalTab ?? "null"]++;
  });

  console.log('=== BASIC STATUS COUNTS (without distributeddatetime filter) ===');
  console.log(basicCounts);
  console.log();

  console.log('=== FINAL COUNTS (with Power BI In Progress filter) ===');
  console.log(filteredCounts);
  console.log();

  console.log('=== DELIVERY METHOD DISTRIBUTION ===');
  console.log(Object.fromEntries(deliveryMethods));
  console.log();

  console.log('=== COMPARISON TO PRODUCTION ===');
  console.log('Production expects:');
  console.log('  Success: ~16,401');
  console.log('  In Progress: ~27');
  console.log('  Failed: ~2,701');
  console.log();
  console.log('Our counts:');
  console.log(`  Success: ${filteredCounts.Success}`);
  console.log(`  In Progress: ${filteredCounts["In Progress"]}`);
  console.log(`  Failed: ${filteredCounts.Failed}`);
  console.log();
  
  const successMatch = Math.abs(filteredCounts.Success - 16401) < 100;
  const inProgressMatch = Math.abs(filteredCounts["In Progress"] - 27) < 10;
  const failedMatch = Math.abs(filteredCounts.Failed - 2701) < 100;
  
  if (successMatch && inProgressMatch && failedMatch) {
    console.log('✅ COUNTS MATCH PRODUCTION!');
  } else {
    console.log('❌ COUNTS DO NOT MATCH PRODUCTION');
    if (!successMatch) console.log(`   - Success off by ${filteredCounts.Success - 16401}`);
    if (!inProgressMatch) console.log(`   - In Progress off by ${filteredCounts["In Progress"] - 27}`);
    if (!failedMatch) console.log(`   - Failed off by ${filteredCounts.Failed - 2701}`);
  }
}

main().catch(console.error);
