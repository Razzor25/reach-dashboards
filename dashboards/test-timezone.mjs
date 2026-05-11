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

console.log('🔍 Testing timezone conversion impact\n');

// Status IDs
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
      interaction_status_id
      chg_dttm
      creat_dttm
    }
  }
`;

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();

  if (result.errors) {
    console.error('❌ GraphQL Error:', JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }

  const allRecords = result.data.qom_qom_interaction;
  console.log(`✅ Fetched ${allRecords.length.toLocaleString()} total records\n`);

  // Production date range in UTC
  // Power BI shows: 10/8/2024 to 5/10/2026
  // But these might be in Central Time, so we need to think about timezones
  
  // Option 1: Date range as-is (UTC interpretation)
  const startDateUTC = new Date('2024-10-08T00:00:00Z');
  const endDateUTC = new Date('2026-05-10T23:59:59Z');
  
  // Option 2: Date range in Central Time (CDT is UTC-5, CST is UTC-6)
  // Assuming CDT (UTC-5) for October 8, 2024
  const startDateCentral = new Date('2024-10-08T05:00:00Z'); // Oct 8 00:00 Central = Oct 8 05:00 UTC
  const endDateCentral = new Date('2026-05-11T04:59:59Z'); // May 10 23:59 Central = May 11 04:59 UTC
  
  console.log('Testing different timezone interpretations:\n');
  
  // Test UTC interpretation
  let filteredUTC = allRecords.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const dateMs = new Date(effectiveDatetime).getTime();
    return dateMs >= startDateUTC.getTime() && dateMs <= endDateUTC.getTime();
  });
  
  let statusCountsUTC = { [STATUS_COMPLETED]: 0, [STATUS_ATTEMPTED]: 0, [STATUS_SCHEDULED]: 0 };
  filteredUTC.forEach(row => statusCountsUTC[row.interaction_status_id]++);
  
  console.log('📅 Option 1: UTC interpretation (Oct 8, 2024 00:00 UTC - May 10, 2026 23:59 UTC)');
  console.log(`   Total: ${filteredUTC.length.toLocaleString()}`);
  console.log(`   Completed: ${statusCountsUTC[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`   Attempted: ${statusCountsUTC[STATUS_ATTEMPTED].toLocaleString()}`);
  console.log(`   Scheduled: ${statusCountsUTC[STATUS_SCHEDULED].toLocaleString()}\n`);
  
  // Test Central Time interpretation  
  let filteredCentral = allRecords.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const dateMs = new Date(effectiveDatetime).getTime();
    return dateMs >= startDateCentral.getTime() && dateMs <= endDateCentral.getTime();
  });
  
  let statusCountsCentral = { [STATUS_COMPLETED]: 0, [STATUS_ATTEMPTED]: 0, [STATUS_SCHEDULED]: 0 };
  filteredCentral.forEach(row => statusCountsCentral[row.interaction_status_id]++);
  
  console.log('📅 Option 2: Central Time interpretation (Oct 8, 2024 00:00 CDT - May 10, 2026 23:59 CDT)');
  console.log(`   Total: ${filteredCentral.length.toLocaleString()}`);
  console.log(`   Completed: ${statusCountsCentral[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`   Attempted: ${statusCountsCentral[STATUS_ATTEMPTED].toLocaleString()}`);
  console.log(`   Scheduled: ${statusCountsCentral[STATUS_SCHEDULED].toLocaleString()}\n`);
  
  // Compare both to production
  const prodCompleted = 830499;
  
  console.log('🎯 Production Comparison:');
  console.log(`   Production: ${prodCompleted.toLocaleString()}\n`);
  
  console.log(`   UTC Option: ${statusCountsUTC[STATUS_COMPLETED].toLocaleString()}`);
  const diffUTC = statusCountsUTC[STATUS_COMPLETED] - prodCompleted;
  console.log(`   Difference: ${diffUTC.toLocaleString()} (${((diffUTC/prodCompleted)*100).toFixed(2)}%)\n`);
  
  console.log(`   Central Option: ${statusCountsCentral[STATUS_COMPLETED].toLocaleString()}`);
  const diffCentral = statusCountsCentral[STATUS_COMPLETED] - prodCompleted;
  console.log(`   Difference: ${diffCentral.toLocaleString()} (${((diffCentral/prodCompleted)*100).toFixed(2)}%)\n`);
  
  if (Math.abs(diffCentral) < Math.abs(diffUTC)) {
    console.log('✅ Central Time interpretation is closer!');
  } else {
    console.log('✅ UTC interpretation is closer (or same)');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
