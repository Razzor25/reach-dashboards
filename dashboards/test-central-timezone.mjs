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

console.log('🔍 Testing Timezone Conversion Impact on Date Filtering\n');

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

// Convert UTC timestamp to Central Time, then extract date
function toCentralDate(utcTimestamp) {
  // Central Time is UTC-6 (CST) or UTC-5 (CDT)
  // Simplified: subtract 6 hours (we'll treat as CST for now)
  const date = new Date(utcTimestamp);
  // Convert to Central by subtracting 6 hours
  const centralMs = date.getTime() - (6 * 60 * 60 * 1000);
  return new Date(centralMs);
}

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
  const allRecords = result.data.qom_qom_interaction;

  console.log(`📊 Total records: ${allRecords.length.toLocaleString()}\n`);

  const prodStartDate = new Date('2024-10-08T00:00:00'); // In Central time
  const prodEndDate = new Date('2026-05-10T23:59:59.999'); // In Central time

  // Test 1: Without timezone conversion (what we currently do)
  console.log('Test 1: WITHOUT timezone conversion (current approach)\n');
  const withoutTzConversion = allRecords.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const date = new Date(effectiveDatetime);
    return date >= prodStartDate && date <= prodEndDate;
  });

  const countsWithout = {
    [STATUS_COMPLETED]: 0,
    [STATUS_ATTEMPTED]: 0,
    [STATUS_SCHEDULED]: 0,
  };
  withoutTzConversion.forEach(row => countsWithout[row.interaction_status_id]++);

  console.log(`  Total filtered: ${withoutTzConversion.length.toLocaleString()}`);
  console.log(`  Completed: ${countsWithout[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`  Attempted: ${countsWithout[STATUS_ATTEMPTED].toLocaleString()}`);
  console.log(`  Scheduled: ${countsWithout[STATUS_SCHEDULED].toLocaleString()}\n`);

  // Test 2: With timezone conversion to Central (what production does)
  console.log('Test 2: WITH timezone conversion to Central (production approach)\n');
  const withTzConversion = allRecords.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const centralDate = toCentralDate(effectiveDatetime);
    return centralDate >= prodStartDate && centralDate <= prodEndDate;
  });

  const countsWith = {
    [STATUS_COMPLETED]: 0,
    [STATUS_ATTEMPTED]: 0,
    [STATUS_SCHEDULED]: 0,
  };
  withTzConversion.forEach(row => countsWith[row.interaction_status_id]++);

  console.log(`  Total filtered: ${withTzConversion.length.toLocaleString()}`);
  console.log(`  Completed: ${countsWith[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`  Attempted: ${countsWith[STATUS_ATTEMPTED].toLocaleString()}`);
  console.log(`  Scheduled: ${countsWith[STATUS_SCHEDULED].toLocaleString()}\n`);

  // Compare
  const prodCompleted = 830499;
  
  console.log('🎯 Production Comparison:\n');
  console.log(`  Production: ${prodCompleted.toLocaleString()}\n`);
  
  const diffWithout = countsWithout[STATUS_COMPLETED] - prodCompleted;
  const diffWith = countsWith[STATUS_COMPLETED] - prodCompleted;
  
  console.log(`  Without TZ conversion: ${countsWithout[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`    Difference: ${diffWithout.toLocaleString()} (${((diffWithout/prodCompleted)*100).toFixed(2)}%)`);
  console.log(`    ${Math.abs(diffWithout) < 100 ? '✅ MATCH!' : Math.abs(diffWithout) < 1000 ? '⚠️  Close' : '❌ Off'}\n`);
  
  console.log(`  With TZ conversion: ${countsWith[STATUS_COMPLETED].toLocaleString()}`);
  console.log(`    Difference: ${diffWith.toLocaleString()} (${((diffWith/prodCompleted)*100).toFixed(2)}%)`);
  console.log(`    ${Math.abs(diffWith) < 100 ? '✅ MATCH!' : Math.abs(diffWith) < 1000 ? '⚠️  Close' : '❌ Off'}\n`);

  if (Math.abs(diffWith) < Math.abs(diffWithout)) {
    console.log('✅ Timezone conversion gets us closer!');
  } else {
    console.log('❌ Timezone conversion doesn\'t help');
  }

  // Check which records changed
  const changedRecords = allRecords.filter(row => {
    const effectiveDatetime = row.chg_dttm || row.creat_dttm;
    const utcDate = new Date(effectiveDatetime);
    const centralDate = toCentralDate(effectiveDatetime);
    
    const inRangeWithoutTz = utcDate >= prodStartDate && utcDate <= prodEndDate;
    const inRangeWithTz = centralDate >= prodStartDate && centralDate <= prodEndDate;
    
    return inRangeWithoutTz !== inRangeWithTz;
  });

  console.log(`\n📝 Records affected by timezone conversion: ${changedRecords.length.toLocaleString()}`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
