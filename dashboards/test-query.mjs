import fs from 'fs';
import https from 'https';
import http from 'http';

// Read environment variables
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const endpoint = envVars.REACH_GRAPHQL_ENDPOINT || envVars.NEXT_PUBLIC_REACH_GRAPHQL_ENDPOINT;
const adminSecret = envVars.REACH_GRAPHQL_ADMIN_SECRET;

if (!endpoint) {
  console.error('Error: REACH_GRAPHQL_ENDPOINT not found in .env.local');
  process.exit(1);
}

if (!adminSecret) {
  console.error('Error: REACH_GRAPHQL_ADMIN_SECRET not found in .env.local');
  process.exit(1);
}

console.log('Endpoint:', endpoint);
console.log('Testing REACH query with production datetime logic...\n');

// Production status IDs
const STATUS_SCHEDULED = 1000936;
const STATUS_COMPLETED = 1000883;
const STATUS_ATTEMPTED = 1002200;

// Production date range: Oct 8, 2024 to May 10, 2026 (as specified in Power BI)
const startDate = '2024-10-08T00:00:00';
const endDate = '2026-05-10T23:59:59';

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

function makeRequest(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    const url = new URL(endpoint);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-hasura-admin-secret': adminSecret
      }
    };
    
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors, null, 2)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function test() {
  try {
    console.log('Fetching all interactions (indv_id > 0, valid status IDs)...');
    const data = await makeRequest(query);
    
    const allRecords = data.qom_qom_interaction;
    console.log(`Total records fetched: ${allRecords.length}\n`);
    
    // Apply production datetime filtering with US/Central timezone conversion
    // US Central is UTC-6 (CST) or UTC-5 (CDT)
    // Production SQL: timezone('US/Central', qi.chg_dttm)
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    
    console.log('Testing WITHOUT timezone conversion:');
    const filteredNoTZ = allRecords.filter(row => {
      const effectiveDatetime = row.chg_dttm || row.creat_dttm;
      const dateMs = new Date(effectiveDatetime).getTime();
      return dateMs >= startMs && dateMs <= endMs;
    });
    console.log(`  Records in range: ${filteredNoTZ.length}\n`);
    
    // Now test WITH timezone conversion (subtract 6 hours for Central time)
    console.log('Testing WITH timezone conversion to US/Central:');
    const CENTRAL_OFFSET_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    const filteredWithTZ = allRecords.filter(row => {
      const effectiveDatetime = row.chg_dttm || row.creat_dttm;
      const utcMs = new Date(effectiveDatetime).getTime();
      const centralMs = utcMs - CENTRAL_OFFSET_MS; // Convert to Central
      return centralMs >= startMs && centralMs <= endMs;
    });
    console.log(`  Records in range: ${filteredWithTZ.length}\n`);
    
    // Count by status for non-TZ version
    const statusCounts = {
      [STATUS_COMPLETED]: 0,
      [STATUS_ATTEMPTED]: 0,
      [STATUS_SCHEDULED]: 0
    };
    
    filteredNoTZ.forEach(row => {
      if (statusCounts[row.interaction_status_id] !== undefined) {
        statusCounts[row.interaction_status_id]++;
      }
    });
    
    console.log('Status Counts (NO timezone conversion):');
    console.log(`  Completed (${STATUS_COMPLETED}): ${statusCounts[STATUS_COMPLETED].toLocaleString()}`);
    console.log(`  Attempted (${STATUS_ATTEMPTED}): ${statusCounts[STATUS_ATTEMPTED].toLocaleString()}`);
    console.log(`  Scheduled (${STATUS_SCHEDULED}): ${statusCounts[STATUS_SCHEDULED].toLocaleString()}`);
    console.log(`  Total: ${(statusCounts[STATUS_COMPLETED] + statusCounts[STATUS_ATTEMPTED] + statusCounts[STATUS_SCHEDULED]).toLocaleString()}`);
    
    // Count by status for TZ version
    const statusCountsTZ = {
      [STATUS_COMPLETED]: 0,
      [STATUS_ATTEMPTED]: 0,
      [STATUS_SCHEDULED]: 0
    };
    
    filteredWithTZ.forEach(row => {
      if (statusCountsTZ[row.interaction_status_id] !== undefined) {
        statusCountsTZ[row.interaction_status_id]++;
      }
    });
    
    console.log('\nStatus Counts (WITH US/Central timezone conversion):');
    console.log(`  Completed (${STATUS_COMPLETED}): ${statusCountsTZ[STATUS_COMPLETED].toLocaleString()}`);
    console.log(`  Attempted (${STATUS_ATTEMPTED}): ${statusCountsTZ[STATUS_ATTEMPTED].toLocaleString()}`);
    console.log(`  Scheduled (${STATUS_SCHEDULED}): ${statusCountsTZ[STATUS_SCHEDULED].toLocaleString()}`);
    console.log(`  Total: ${(statusCountsTZ[STATUS_COMPLETED] + statusCountsTZ[STATUS_ATTEMPTED] + statusCountsTZ[STATUS_SCHEDULED]).toLocaleString()}`);
    
    console.log('\n✅ Production expects Completed: 830,499');
    console.log(`${statusCounts[STATUS_COMPLETED] === 830499 ? '✅' : '❌'} No TZ: ${statusCounts[STATUS_COMPLETED] === 830499}`);
    console.log(`${statusCountsTZ[STATUS_COMPLETED] === 830499 ? '✅' : '❌'} With TZ: ${statusCountsTZ[STATUS_COMPLETED] === 830499}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
