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

console.log('🔍 Checking available tables in REACH schema\n');

// Introspection query to list all tables
const query = `
  query IntrospectSchema {
    __schema {
      queryType {
        fields {
          name
        }
      }
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

  const tables = result.data.__schema.queryType.fields
    .filter(f => !f.name.startsWith('__'))
    .map(f => f.name)
    .sort();

  console.log('📋 Available tables:\n');
  
  // Look for interaction-related tables
  const interactionTables = tables.filter(t => t.toLowerCase().includes('interaction'));
  
  console.log('🎯 Interaction-related tables:');
  interactionTables.forEach(t => console.log(`   - ${t}`));
  
  console.log('\n📊 All tables:');
  tables.forEach(t => console.log(`   - ${t}`));

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
