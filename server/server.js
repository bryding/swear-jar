const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// STRICT REDIS-ONLY SETUP - NO FALLBACKS IN PRODUCTION
let client;
let redisConnected = false;
const redisUrl = process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL;
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

// STRICT LOGGING
console.log('🔍 ENVIRONMENT AUDIT:');
console.log('  REDIS_PRIVATE_URL:', process.env.REDIS_PRIVATE_URL ? 'SET' : 'NOT SET');
console.log('  REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET'); 
console.log('  REDIS_PUBLIC_URL:', process.env.REDIS_PUBLIC_URL ? 'SET' : 'NOT SET');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('  Is Production:', isProduction);
console.log('  Redis URL Found:', !!redisUrl);

// FAIL FAST IN PRODUCTION WITHOUT REDIS
if (isProduction && !redisUrl) {
  console.error('💥 FATAL ERROR: Production environment detected but NO Redis URL found!');
  console.error('💥 This app REQUIRES a database for syncing between devices');
  console.error('💥 Check Railway environment variables');
  process.exit(1);
}

// FAIL FAST IN PRODUCTION WITHOUT REDIS CONNECTION
if (isProduction && redisUrl) {
  console.log('🔌 Attempting Redis connection...');
  console.log('🔌 Redis URL (first 30 chars):', redisUrl.substring(0, 30) + '...');
  
  // Railway requires family=0 for IPv6 support on private network
  const redisUrlWithOptions = redisUrl + (redisUrl.includes('?') ? '&' : '?') + 'family=0';
  
  client = redis.createClient({
    url: redisUrlWithOptions
  });
  
  client.on('error', (err) => {
    console.error('❌ Redis Client Error:', err.message);
    console.error('❌ Connection details:', err);
    redisConnected = false;
  });
  
  client.on('disconnect', () => {
    console.error('❌ Redis disconnected - app will fail');
    redisConnected = false;
  });
  
  // FORCE KILL APP IF REDIS DOESN'T CONNECT IN 3 SECONDS
  const connectionTimeout = setTimeout(() => {
    console.error('💥 FATAL: Redis connection timeout after 3 seconds');
    console.error('💥 Connection is hanging - this indicates network/DNS issues');
    console.error('💥 Redis URL being used:', redisUrlWithOptions.substring(0, 50) + '...');
    console.error('💥 Full Redis URL (masked):', redisUrlWithOptions.replace(/:([^:@]+)@/, ':***@'));
    console.error('💥 This means Railway Redis service is not properly connected');
    console.error('💥 App requires database for multi-device sync - FORCE EXIT');
    process.exit(1);
  }, 3000);
  
  // Clear timeout if connection succeeds
  client.on('connect', () => {
    clearTimeout(connectionTimeout);
    console.log('✅ Redis connected successfully - starting HTTP server');
    redisConnected = true;
    startHttpServer();
  });
  
  // ATTEMPT CONNECTION - BUT TIMEOUT WILL KILL US IF IT HANGS
  console.log('⏰ Starting 3-second connection timeout...');
  client.connect().catch(err => {
    clearTimeout(connectionTimeout);
    console.error('💥 FATAL: Redis connection failed:', err.message);
    console.error('💥 Full error:', err);
    console.error('💥 This is a connection error, not a timeout');
    console.error('💥 App cannot function without database - exiting');
    process.exit(1);
  });
}

// Local development mode - start HTTP server immediately
if (!isProduction) {
  console.log('🏠 Local development mode - using file storage');
  startHttpServer();
}

console.log(`🗄️  Storage mode: ${isProduction ? 'Redis (REQUIRED)' : 'File (local dev)'}`);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

async function readData() {
  console.log('📖 READ DATA - Environment:', isProduction ? 'PRODUCTION' : 'LOCAL');
  
  if (isProduction) {
    // PRODUCTION: REDIS REQUIRED
    console.log('📖 Production mode - checking Redis connection...');
    
    if (!client) {
      console.error('💥 FATAL: No Redis client in production!');
      throw new Error('FATAL: No database connection in production');
    }
    
    if (!redisConnected) {
      console.error('💥 FATAL: Redis not connected in production!');
      throw new Error('FATAL: Database not connected - multi-device sync impossible');
    }
    
    try {
      console.log('📖 Reading from Redis...');
      const data = await client.get('swearJarData');
      const result = data ? JSON.parse(data) : getDefaultData();
      console.log('✅ Successfully read from Redis:', { ben: result.ben, kaiti: result.kaiti });
      return result;
    } catch (error) {
      console.error('💥 Redis read failed:', error.message);
      throw new Error('FATAL: Database read failed - ' + error.message);
    }
  } else {
    // LOCAL DEVELOPMENT: FILE STORAGE
    console.log('📖 Local development - using file storage');
    try {
      const data = await fs.readFile(DATA_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log('📖 Creating default data file');
      const defaultData = getDefaultData();
      await writeData(defaultData);
      return defaultData;
    }
  }
}

async function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  console.log('✍️ WRITE DATA - Environment:', isProduction ? 'PRODUCTION' : 'LOCAL');
  console.log('✍️ Data to write:', { ben: data.ben, kaiti: data.kaiti });
  
  if (isProduction) {
    // PRODUCTION: REDIS REQUIRED
    console.log('✍️ Production mode - checking Redis connection...');
    
    if (!client) {
      console.error('💥 FATAL: No Redis client in production!');
      throw new Error('FATAL: No database connection in production');
    }
    
    if (!redisConnected) {
      console.error('💥 FATAL: Redis not connected in production!');
      throw new Error('FATAL: Database not connected - cannot save data');
    }
    
    try {
      console.log('✍️ Writing to Redis...');
      await client.set('swearJarData', JSON.stringify(data));
      console.log('✅ Successfully wrote to Redis');
    } catch (error) {
      console.error('💥 Redis write failed:', error.message);
      throw new Error('FATAL: Database write failed - ' + error.message);
    }
  } else {
    // LOCAL DEVELOPMENT: FILE STORAGE
    console.log('✍️ Local development - writing to file');
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('✅ Successfully wrote to file');
  }
}

function getDefaultData() {
  return {
    ben: 0,
    kaiti: 0,
    lastUpdated: new Date().toISOString()
  };
}

function validatePerson(person) {
  return ['ben', 'kaiti'].includes(person);
}

function validateCount(count) {
  const num = parseInt(count);
  return !isNaN(num) && num >= 0;
}

// Debug endpoint to check database status
app.get('/api/status', (req, res) => {
  const status = {
    database: useRedis ? 'Redis' : 'File',
    connected: useRedis ? redisConnected : true,
    redisUrl: !!process.env.REDIS_URL,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
      isProduction
    },
    timestamp: new Date().toISOString()
  };
  
  console.log('Status check:', status);
  res.json(status);
});

app.get('/api/counts', async (req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (error) {
    console.error('API Error reading counts:', error.message);
    res.status(500).json({ 
      error: error.message,
      database: useRedis ? 'Redis' : 'File',
      connected: useRedis ? redisConnected : true
    });
  }
});

app.post('/api/swear/:person', async (req, res) => {
  const { person } = req.params;
  
  if (!validatePerson(person)) {
    return res.status(400).json({ error: 'Invalid person. Must be "ben" or "kaiti"' });
  }

  try {
    const data = await readData();
    data[person] += 1;
    await writeData(data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update count' });
  }
});

app.put('/api/counts/:person', async (req, res) => {
  const { person } = req.params;
  const { count } = req.body;
  
  if (!validatePerson(person)) {
    return res.status(400).json({ error: 'Invalid person. Must be "ben" or "kaiti"' });
  }

  if (!validateCount(count)) {
    return res.status(400).json({ error: 'Invalid count. Must be a non-negative integer' });
  }

  try {
    const data = await readData();
    data[person] = parseInt(count);
    await writeData(data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to set count' });
  }
});

app.post('/api/payout', async (req, res) => {
  try {
    const data = await readData();
    data.ben = 0;
    data.kaiti = 0;
    await writeData(data);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset counts' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// DO NOT START HTTP SERVER UNTIL REDIS IS READY
let httpServer = null;

function startHttpServer() {
  if (httpServer) return; // Already started
  
  httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🫙 Swear jar server running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} to use the app`);
    console.log(`🔗 App ready with Redis connection - multi-device sync enabled!`);
  });
}