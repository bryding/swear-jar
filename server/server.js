const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Redis setup - REQUIRE Redis in production
let client;
let redisConnected = false;
const redisUrl = process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL;
const useRedis = !!redisUrl;
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

console.log('Environment check:', {
  REDIS_PRIVATE_URL: !!process.env.REDIS_PRIVATE_URL,
  REDIS_URL: !!process.env.REDIS_URL,
  REDIS_PUBLIC_URL: !!process.env.REDIS_PUBLIC_URL,
  redisUrl: redisUrl ? redisUrl.substring(0, 20) + '...' : null,
  NODE_ENV: process.env.NODE_ENV,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  isProduction,
  useRedis
});

if (useRedis) {
  // Railway requires family=0 for IPv6 support on private network
  const redisUrlWithOptions = redisUrl + (redisUrl.includes('?') ? '&' : '?') + 'family=0';
  
  client = redis.createClient({
    url: redisUrlWithOptions
  });
  
  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
    redisConnected = true;
  });
  
  client.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
    redisConnected = false;
  });
  
  client.on('disconnect', () => {
    console.error('❌ Redis disconnected');
    redisConnected = false;
  });
  
  client.connect().catch(err => {
    console.error('❌ Failed to connect to Redis:', err);
  });
} else if (isProduction) {
  console.error('❌ FATAL: Redis required in production but REDIS_URL not found');
  process.exit(1);
}

console.log(`Storage mode: ${useRedis ? 'Redis (required)' : 'File (local dev only)'}`);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

async function readData() {
  if (useRedis) {
    if (!redisConnected) {
      throw new Error('Database not connected - cannot read data');
    }
    try {
      const data = await client.get('swearJarData');
      return data ? JSON.parse(data) : getDefaultData();
    } catch (error) {
      console.error('Redis read error:', error);
      throw new Error('Database read failed: ' + error.message);
    }
  } else {
    // Local development only
    try {
      const data = await fs.readFile(DATA_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      const defaultData = getDefaultData();
      await writeData(defaultData);
      return defaultData;
    }
  }
}

async function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  
  if (useRedis) {
    if (!redisConnected) {
      throw new Error('Database not connected - cannot write data');
    }
    try {
      await client.set('swearJarData', JSON.stringify(data));
    } catch (error) {
      console.error('Redis write error:', error);
      throw new Error('Database write failed: ' + error.message);
    }
  } else {
    // Local development only
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🫙 Swear jar server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to use the app`);
});