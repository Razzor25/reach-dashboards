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

console.log('🔍 Testing GROUP BY Deduplication\n');

const STATUS_SCHEDULED = 1000936;
const STATUS_COMPLETED = 1000883;
const STATUS_ATTEMPTED = 1002200;

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

// Get interaction type names
const typesQuery = `
  query GetTypes {
    qom_interaction_type {
      interaction_type_id
      interaction_name
    }
  }
`;

// Get status display names
const refsQuery = `
  query GetRefs {
    qom_ref(where: { ref_id: { _in: [${STATUS_SCHEDULED}, ${STATUS_COMPLETED}, ${STATUS_ATTEMPTED}] } }) {
      ref_id
      ref_dspl
    }
  }
`;

try {
  // Fetch all data
  console.log('📊 Fetching data...\n');
  
  const [interactionsRes, typesRes, refsRes] = await Promise.all([
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': adminSecret },
      body: JSON.stringify({ query }),
    }),
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': adminSecret },
      body: JSON.stringify({ query: typesQuery }),
    }),
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': adminSecret },
      body: JSON.stringify({ query: refsQuery }),
    }),
  ]);

  const interactions = (await interactionsRes.json()).data.qom_qom_interaction;
  const types = (await typesRes.json()).data.qom_interaction_type;
  const refs = (await refsRes.json()).data.qom_ref;

  console.log(`Total interactions: ${interactions.length.toLocaleString()}\n`);

  // Build lookup maps
  const typeMap = new Map(types.map(t => [String(t.interaction_type_id), t.interaction_name]));
  const refMap = new Map(refs.map(r => [Number(r.ref_id), r.ref_dspl]));

  // Apply date filter
  const startDate = new Date('2024-10-08T00:00:00');
  const endDate = new Date('2026-05-10T23:59:59.999');

  const filtered = interactions.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const dateMs = new Date(effectiveDatetime).getTime();
    return dateMs >= startDate.getTime() && dateMs <= endDate.getTime();
  });

  console.log(`After date filter: ${filtered.length.toLocaleString()}\n`);

  // Simulate production SQL GROUP BY
  // group by org_id, interaction_name, qr.ref_dspl, qi.chg_dttm, qi.creat_dttm
  const groupMap = new Map();

  for (const row of filtered) {
    const interactionName = typeMap.get(String(row.interaction_type_id)) || 'Unknown';
    const refDspl = refMap.get(row.interaction_status_id) || 'Unknown';
    
    // Create group key matching production SQL GROUP BY
    const groupKey = `${row.org_id}|${interactionName}|${refDspl}|${row.chg_dttm}|${row.creat_dttm}`;
    
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        count: 0,
        interaction_status_id: row.interaction_status_id,
        org_id: row.org_id,
        interaction_name: interactionName,
        ref_dspl: refDspl,
      });
    }
    
    groupMap.get(groupKey).count++;
  }

  console.log(`After GROUP BY: ${groupMap.size.toLocaleString()} unique groups\n`);
  console.log(`Duplicates eliminated: ${(filtered.length - groupMap.size).toLocaleString()}\n`);

  // Count by status (counting GROUPS, not individual records)
  const statusCounts = {
    [STATUS_COMPLETED]: 0,
    [STATUS_ATTEMPTED]: 0,
    [STATUS_SCHEDULED]: 0,
  };

  for (const group of groupMap.values()) {
    statusCounts[group.interaction_status_id]++;
  }

  console.log('📈 Status Counts (after GROUP BY deduplication):\n');
  console.log(`  Completed: ${statusCounts[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`  Attempted: ${statusCounts[STATUS_ATTEMPTED].toLocaleString()}`);
  console.log(`  Scheduled: ${statusCounts[STATUS_SCHEDULED].toLocaleString()}\n`);

  // Compare to production
  const prodCompleted = 830499;
  const diff = statusCounts[STATUS_COMPLETED] - prodCompleted;
  const diffPercent = ((diff / prodCompleted) * 100).toFixed(2);

  console.log('🎯 Production Comparison:\n');
  console.log(`  Production: ${prodCompleted.toLocaleString()}`);
  console.log(`  Our Count (with GROUP BY): ${statusCounts[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`  Difference: ${diff.toLocaleString()} (${diffPercent}%)`);

  if (Math.abs(diff) < 100) {
    console.log('  ✅ EXACT MATCH!');
  } else if (Math.abs(diff) < 1000) {
    console.log('  ⚠️  Close match');
  } else {
    console.log('  ❌ Still off');
  }

  // Show some duplicate examples
  console.log('\n🔍 Sample duplicates:\n');
  let dupeCount = 0;
  for (const [key, group] of groupMap.entries()) {
    if (group.count > 1 && dupeCount < 5) {
      console.log(`  Group: ${key.substring(0, 80)}...`);
      console.log(`  Count: ${group.count} records in this group\n`);
      dupeCount++;
    }
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
