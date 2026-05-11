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

console.log('🔍 Testing Date Boundary Conditions\n');

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
  const allRecords = result.data.qom_qom_interaction;

  console.log(`📊 Total records: ${allRecords.length.toLocaleString()}\n`);

  // Test different boundary interpretations
  const scenarios = [
    {
      name: 'Inclusive both ends (00:00:00 to 23:59:59)',
      start: new Date('2024-10-08T00:00:00Z'),
      end: new Date('2026-05-10T23:59:59.999Z'),
    },
    {
      name: 'Inclusive start, exclusive end (00:00:00 to 00:00:00)',
      start: new Date('2024-10-08T00:00:00Z'),
      end: new Date('2026-05-11T00:00:00Z'),
    },
    {
      name: 'Strict inclusive (full days)',
      start: new Date('2024-10-08T00:00:00Z'),
      end: new Date('2026-05-10T23:59:59Z'),
    },
    {
      name: 'Central Time boundaries (CDT/CST aware)',
      start: new Date('2024-10-08T05:00:00Z'), // Oct 8 midnight CDT
      end: new Date('2026-05-11T04:59:59Z'),   // May 10 11:59:59 CDT
    },
  ];

  const prodCompleted = 830499;

  scenarios.forEach((scenario, idx) => {
    const filtered = allRecords.filter(row => {
      const effectiveDatetime = row.chg_dttm || row.creat_dttm;
      const dateMs = new Date(effectiveDatetime).getTime();
      return dateMs >= scenario.start.getTime() && dateMs <= scenario.end.getTime();
    });

    const statusCounts = {
      [STATUS_COMPLETED]: 0,
      [STATUS_ATTEMPTED]: 0,
      [STATUS_SCHEDULED]: 0,
    };

    filtered.forEach(row => statusCounts[row.interaction_status_id]++);

    const diff = statusCounts[STATUS_COMPLETED] - prodCompleted;
    const diffPercent = ((diff / prodCompleted) * 100).toFixed(2);
    const match = Math.abs(diff) < 100 ? '✅ MATCH!' : Math.abs(diff) < 1000 ? '⚠️  Close' : '❌ Off';

    console.log(`${idx + 1}. ${scenario.name}`);
    console.log(`   Range: ${scenario.start.toISOString()} to ${scenario.end.toISOString()}`);
    console.log(`   Total: ${filtered.length.toLocaleString()}`);
    console.log(`   Completed: ${statusCounts[STATUS_COMPLETED].toLocaleString()}`);
    console.log(`   Diff: ${diff.toLocaleString()} (${diffPercent}%) ${match}\n`);
  });

  // Check records on boundary dates
  console.log('📅 Boundary Date Analysis:\n');
  
  const boundaryDates = [
    { date: '2024-10-07', name: 'Oct 7 (day before start)' },
    { date: '2024-10-08', name: 'Oct 8 (start date)' },
    { date: '2026-05-10', name: 'May 10 (end date)' },
    { date: '2026-05-11', name: 'May 11 (day after end)' },
  ];

  boundaryDates.forEach(({ date, name }) => {
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    
    const recordsOnDay = allRecords.filter(row => {
      const effectiveDatetime = row.chg_dttm || row.creat_dttm;
      const dateMs = new Date(effectiveDatetime).getTime();
      return dateMs >= dayStart.getTime() && dateMs <= dayEnd.getTime();
    });

    const completed = recordsOnDay.filter(r => r.interaction_status_id === STATUS_COMPLETED).length;
    
    console.log(`${name}: ${recordsOnDay.length.toLocaleString()} total (${completed.toLocaleString()} completed)`);
  });

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
