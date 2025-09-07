#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const SERVER_URL = process.env.SWEAR_JAR_URL || 'http://localhost:3000';

async function readLocalData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error('Could not read data file. Make sure the server has been run at least once.');
  }
}

async function writeLocalData(data) {
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

async function makeApiRequest(endpoint, method = 'GET', body = null) {
  try {
    const fetch = (await import('node-fetch')).default;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${SERVER_URL}/api${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️  Server not running, updating local file instead...');
      return null;
    }
    throw error;
  }
}

function validatePerson(person) {
  if (!['ben', 'kaiti'].includes(person)) {
    throw new Error('Person must be either "ben" or "kaiti"');
  }
}

function validateCount(count) {
  const num = parseInt(count);
  if (isNaN(num) || num < 0) {
    throw new Error('Count must be a non-negative integer (>= 0)');
  }
  return num;
}

async function setCount(person, count) {
  validatePerson(person);
  const validCount = validateCount(count);
  
  console.log(`Setting ${person}'s count to ${validCount}...`);
  
  try {
    const result = await makeApiRequest(`/counts/${person}`, 'PUT', { count: validCount });
    
    if (result) {
      console.log('✅ Updated via server API');
      showStatus(result);
    } else {
      const data = await readLocalData();
      data[person] = validCount;
      await writeLocalData(data);
      console.log('✅ Updated local file');
      showStatus(data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function showStatus() {
  try {
    let data = await makeApiRequest('/counts');
    
    if (!data) {
      data = await readLocalData();
      console.log('📂 Reading from local file (server offline)');
    } else {
      console.log('🌐 Reading from server');
    }
    
    console.log('\n📊 Current Swear Jar Status:');
    console.log('┌─────────┬───────┐');
    console.log('│ Person  │ Count │');
    console.log('├─────────┼───────┤');
    console.log(`│ Ben     │ ${String(data.ben).padStart(5)} │`);
    console.log(`│ Kaiti   │ ${String(data.kaiti).padStart(5)} │`);
    console.log('└─────────┴───────┘');
    console.log(`\nLast updated: ${new Date(data.lastUpdated).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function payout() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  try {
    const answer = await new Promise((resolve) => {
      rl.question('Are you sure you want to reset both jar counts to zero? (y/N): ', resolve);
    });
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Payout cancelled');
      return;
    }
    
    console.log('💰 Processing payout...');
    
    let result = await makeApiRequest('/payout', 'POST');
    
    if (result) {
      console.log('✅ Payout processed via server API');
      showStatus(result);
    } else {
      const data = await readLocalData();
      data.ben = 0;
      data.kaiti = 0;
      await writeLocalData(data);
      console.log('✅ Payout processed locally');
      showStatus(data);
    }
    
    console.log('🎉 Swear jars have been reset! Time for a fresh start.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

function showHelp() {
  console.log(`
🫙 Swear Jar CLI Tool

Usage:
  node cli.js <command> [arguments]

Commands:
  status                    Show current jar counts
  set <person> <count>      Set specific count for person
  payout                    Reset all counts to zero
  help                      Show this help message

Examples:
  node cli.js status
  node cli.js set ben 5
  node cli.js set kaiti 3
  node cli.js payout

Notes:
  - Person must be either "ben" or "kaiti"
  - Count must be a non-negative integer (>= 0)
  - Will try to connect to server first, fallback to local file
  - Set SWEAR_JAR_URL environment variable for remote server
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help') {
    showHelp();
    return;
  }
  
  const command = args[0].toLowerCase();
  
  switch (command) {
    case 'status':
      await showStatus();
      break;
      
    case 'set':
      if (args.length !== 3) {
        console.error('❌ Usage: node cli.js set <person> <count>');
        process.exit(1);
      }
      await setCount(args[1], args[2]);
      break;
      
    case 'payout':
      await payout();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error('Run "node cli.js help" for usage information');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });
}