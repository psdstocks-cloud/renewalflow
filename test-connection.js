#!/usr/bin/env node

/**
 * Connection Test Script
 * Tests the connection to the RenewalFlow API
 * 
 * Usage:
 *   node test-connection.js [API_URL] [API_KEY]
 * 
 * Examples:
 *   node test-connection.js
 *   node test-connection.js https://renewalflow-production.up.railway.app
 *   node test-connection.js https://renewalflow-production.up.railway.app artly_xxxxx...
 */

const API_URL = process.argv[2] || 'https://renewalflow-production.up.railway.app';
const API_KEY = process.argv[3] || null;

// Remove trailing slash
const baseUrl = API_URL.replace(/\/$/, '');

console.log('🔍 Testing Connection to RenewalFlow API');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Server URL: ${baseUrl}`);
console.log(`🔑 API Key: ${API_KEY ? API_KEY.substring(0, 30) + '...' : 'Not provided'}`);
console.log('');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, options = {}) {
  try {
    log(`\n🧪 Testing: ${name}`, 'cyan');
    log(`   URL: ${url}`, 'blue');
    
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const status = response.status;
    const statusText = response.statusText;
    let data;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      data = { raw: text };
    }

    if (status >= 200 && status < 300) {
      log(`   ✅ Status: ${status} ${statusText}`, 'green');
      if (options.showResponse) {
        console.log('   Response:', JSON.stringify(data, null, 2));
      }
      return { success: true, status, data };
    } else {
      log(`   ⚠️  Status: ${status} ${statusText}`, 'yellow');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return { success: false, status, data };
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  const results = {
    serverReachable: false,
    apiKeyValid: false,
    connectionTest: false,
  };

  // Test 1: Basic server connectivity (no auth)
  log('\n📡 Test 1: Server Connectivity', 'cyan');
  const test1 = await testEndpoint(
    'Basic Test Endpoint',
    `${baseUrl}/artly/test`,
    { showResponse: true }
  );
  results.serverReachable = test1.success;

  if (!test1.success) {
    log('\n❌ Server is not reachable. Please check:', 'red');
    log('   1. The server URL is correct', 'red');
    log('   2. The server is running and deployed', 'red');
    log('   3. There are no network/firewall issues', 'red');
    return results;
  }

  // Test 2: API Key validation (if provided)
  if (API_KEY) {
    log('\n🔑 Test 2: API Key Validation', 'cyan');
    const test2 = await testEndpoint(
      'API Key Check',
      `${baseUrl}/artly/debug/key-check`,
      {
        headers: {
          'x-artly-secret': API_KEY,
        },
        showResponse: true,
      }
    );
    
    if (test2.success && test2.data) {
      if (test2.data.exactMatch?.found) {
        log('   ✅ API Key found in database', 'green');
        log(`   ✅ Connection is active: ${test2.data.exactMatch.isActive}`, 'green');
        log(`   ✅ Website URL: ${test2.data.exactMatch.websiteUrl}`, 'green');
        results.apiKeyValid = true;
      } else {
        log('   ⚠️  API Key not found in database', 'yellow');
        if (test2.data.similarKeys?.length > 0) {
          log('   Found similar keys:', 'yellow');
          test2.data.similarKeys.forEach((key, i) => {
            log(`     ${i + 1}. ${key.websiteUrl} (Active: ${key.isActive})`, 'yellow');
          });
        }
      }
    }
  } else {
    log('\n⚠️  Test 2: Skipped (no API key provided)', 'yellow');
    log('   To test API key validation, run:', 'yellow');
    log(`   node test-connection.js ${baseUrl} YOUR_API_KEY`, 'yellow');
  }

  // Test 3: Full connection test (requires auth)
  if (API_KEY) {
    log('\n🔐 Test 3: Full Connection Test', 'cyan');
    const test3 = await testEndpoint(
      'Authenticated Endpoint',
      `${baseUrl}/artly/sync/users`,
      {
        method: 'POST',
        headers: {
          'x-artly-secret': API_KEY,
        },
        body: [],
        showResponse: true,
      }
    );
    
    if (test3.success) {
      log('   ✅ Connection test successful!', 'green');
      log('   ✅ API key is valid and accepted', 'green');
      results.connectionTest = true;
    } else if (test3.status === 401) {
      log('   ❌ Unauthorized: API key is invalid', 'red');
      log('   Please check:', 'red');
      log('   1. The API key matches the one in your RenewalFlow dashboard', 'red');
      log('   2. The connection is active in the database', 'red');
    } else {
      log(`   ⚠️  Connection test returned status ${test3.status}`, 'yellow');
    }
  } else {
    log('\n⚠️  Test 3: Skipped (no API key provided)', 'yellow');
  }

  // Summary
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('📊 Test Summary', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log(`   Server Reachable: ${results.serverReachable ? '✅' : '❌'}`, results.serverReachable ? 'green' : 'red');
  if (API_KEY) {
    log(`   API Key Valid: ${results.apiKeyValid ? '✅' : '❌'}`, results.apiKeyValid ? 'green' : 'red');
    log(`   Connection Test: ${results.connectionTest ? '✅' : '❌'}`, results.connectionTest ? 'green' : 'red');
  }
  log('');

  if (results.serverReachable && (!API_KEY || results.connectionTest)) {
    log('🎉 All tests passed!', 'green');
  } else if (results.serverReachable && API_KEY && !results.connectionTest) {
    log('⚠️  Server is reachable but connection test failed', 'yellow');
    log('   Check your API key and ensure it matches the dashboard', 'yellow');
  } else {
    log('❌ Some tests failed. Please check the errors above.', 'red');
  }

  return results;
}

// Run tests
runTests()
  .then((results) => {
    process.exit(results.serverReachable && (!API_KEY || results.connectionTest) ? 0 : 1);
  })
  .catch((error) => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });

