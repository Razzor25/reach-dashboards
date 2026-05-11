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

console.log('🔍 Testing qom_interaction_data table\n');

// Status IDs from production
const STATUS_SCHEDULED = 1000936;
const STATUS_COMPLETED = 1000883;
const STATUS_ATTEMPTED = 1002200;

// First, introspect the table structure
const introspectQuery = `
  query IntrospectTable {
    __type(name: "qom_interaction_data") {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
  }
`;

console.log('📋 Step 1: Introspecting qom_interaction_data fields...\n');

try {
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query: introspectQuery }),
  });

  let result = await response.json();
  
  if (result.errors) {
    console.error('❌ GraphQL Error:', JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }

  const fields = result.data.__type.fields.map(f => f.name);
  console.log('Available fields:');
  fields.forEach(f => console.log(`   - ${f}`));
  
  // Now query the data
  console.log('\n📊 Step 2: Querying data...\n');
  
  const query = `
    query GetInteractions {
      qom_interaction_data(
        where: {
          _and: [
            { indv_id: { _gt: 0 } }
            { interaction_status_id: { _in: [${STATUS_SCHEDULED}, ${STATUS_COMPLETED}, ${STATUS_ATTEMPTED}] } }
          ]
        }
      ) {
        interaction_id
        interaction_status_id
        chg_dttm
        creat_dttm
      }
    }
  `;

  response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query }),
  });

  result = await response.json();

  if (result.errors) {
    console.error('❌ GraphQL Error:', JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }

  const allRecords = result.data.qom_interaction_data;
  console.log(`✅ Fetched ${allRecords.length.toLocaleString()} total records\n`);

  // Apply date filtering using production logic
  const startDate = new Date('2024-10-08T00:00:00');
  const endDate = new Date('2026-05-11T23:59:59');
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const filteredRecords = allRecords.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const dateMs = new Date(effectiveDatetime).getTime();
    return dateMs >= startMs && dateMs <= endMs;
  });

  console.log(`📅 After date filtering: ${filteredRecords.length.toLocaleString()} records\n`);

  // Count by status
  const statusCounts = {
    [STATUS_COMPLETED]: 0,
    [STATUS_ATTEMPTED]: 0,
    [STATUS_SCHEDULED]: 0,
  };

  for (const row of filteredRecords) {
    statusCounts[row.interaction_status_id]++;
  }

  console.log('📈 Status Breakdown:');
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
    console.log('   ❌ Significant difference');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
