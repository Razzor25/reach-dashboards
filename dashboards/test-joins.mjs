import { readFileSync } from 'fs';

// Read environment variables
const envContent = readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');
let endpoint = '';
let adminSecret = '';

for (const line of lines) {
  if (line.startsWith('REACH_GRAPHQL_ENDPOINT=')) {
    endpoint = line.split('=')[1].trim();
  } else if (line.startsWith('REACH_GRAPHQL_ADMIN_SECRET=')) {
    adminSecret = line.split('=')[1].trim();
  }
}

console.log('🔍 Testing if JOIN conditions filter out records\n');

// Status IDs
const STATUS_SCHEDULED = 1000936;
const STATUS_COMPLETED = 1000883;
const STATUS_ATTEMPTED = 1002200;

// Step 1: Get all interaction records
const interactionsQuery = `
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
      interaction_type_id
      interaction_status_id
      chg_dttm
      creat_dttm
    }
  }
`;

// Step 2: Get all valid interaction_type_id values
const typesQuery = `
  query GetInteractionTypes {
    qom_interaction_type {
      interaction_type_id
      interaction_name
    }
  }
`;

// Step 3: Get all valid ref_id values for statuses
const refsQuery = `
  query GetRefs {
    qom_ref(where: { ref_id: { _in: [${STATUS_SCHEDULED}, ${STATUS_COMPLETED}, ${STATUS_ATTEMPTED}] } }) {
      ref_id
      ref_dspl
    }
  }
`;

try {
  console.log('📊 Step 1: Fetching all interactions...\n');
  
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query: interactionsQuery }),
  });

  let result = await response.json();
  const allInteractions = result.data.qom_qom_interaction;
  console.log(`   Found: ${allInteractions.length.toLocaleString()} interactions\n`);

  console.log('📊 Step 2: Fetching interaction types...\n');
  
  response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query: typesQuery }),
  });

  result = await response.json();
  const allTypes = result.data.qom_interaction_type;
  const validTypeIds = new Set(allTypes.map(t => String(t.interaction_type_id)));
  console.log(`   Found: ${allTypes.length} interaction types\n`);

  console.log('📊 Step 3: Fetching status refs...\n');
  
  response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query: refsQuery }),
  });

  result = await response.json();
  const allRefs = result.data.qom_ref;
  const validRefIds = new Set(allRefs.map(r => Number(r.ref_id)));
  console.log(`   Found: ${allRefs.length} status refs\n`);

  // Now filter interactions that would pass the JOINs
  console.log('🔗 Applying JOIN conditions (INNER JOIN behavior)...\n');
  
  const validInteractions = allInteractions.filter(row => {
    const hasValidType = validTypeIds.has(String(row.interaction_type_id));
    const hasValidStatus = validRefIds.has(row.interaction_status_id);
    return hasValidType && hasValidStatus;
  });

  console.log(`   After JOIN filtering: ${validInteractions.length.toLocaleString()} interactions\n`);
  
  const filteredOut = allInteractions.length - validInteractions.length;
  if (filteredOut > 0) {
    console.log(`   ❌ Filtered out ${filteredOut.toLocaleString()} interactions with invalid foreign keys!\n`);
  }

  // Apply date filtering
  const startDate = new Date('2024-10-08T00:00:00');
  const endDate = new Date('2026-05-11T23:59:59');
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const dateFiltered = validInteractions.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const dateMs = new Date(effectiveDatetime).getTime();
    return dateMs >= startMs && dateMs <= endMs;
  });

  // Count by status
  const statusCounts = {
    [STATUS_COMPLETED]: 0,
    [STATUS_ATTEMPTED]: 0,
    [STATUS_SCHEDULED]: 0,
  };

  for (const row of dateFiltered) {
    statusCounts[row.interaction_status_id]++;
  }

  console.log('📈 Final Status Breakdown (with JOIN filtering):');
  console.log(`   ✓ Completed: ${statusCounts[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`   ⚠ Attempted: ${statusCounts[STATUS_ATTEMPTED].toLocaleString()}`);
  console.log(`   📅 Scheduled: ${statusCounts[STATUS_SCHEDULED].toLocaleString()}\n`);

  // Compare to production
  const prodCompleted = 830499;
  const diff = statusCounts[STATUS_COMPLETED] - prodCompleted;
  const diffPercent = ((diff / prodCompleted) * 100).toFixed(2);

  console.log('🎯 Production Comparison:');
  console.log(`   Production: ${prodCompleted.toLocaleString()}`);
  console.log(`   Our Count: ${statusCounts[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`   Difference: ${diff.toLocaleString()} (${diffPercent}%)`);

  if (Math.abs(diff) < 100) {
    console.log('   ✅ EXACT MATCH!');
  } else if (Math.abs(diff) < 1000) {
    console.log('   ⚠️  Close match');
  } else {
    console.log('   ❌ Still significant difference');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
