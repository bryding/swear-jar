const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    const defaultData = {
      ben: 0,
      kaiti: 0,
      lastUpdated: new Date().toISOString()
    };
    await writeData(defaultData);
    return defaultData;
  }
}

async function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

function validatePerson(person) {
  return ['ben', 'kaiti'].includes(person);
}

function validateCount(count) {
  const num = parseInt(count);
  return !isNaN(num) && num >= 0;
}

app.get('/api/counts', async (req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read data' });
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