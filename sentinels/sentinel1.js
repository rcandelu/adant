require('dotenv').config();
const express = require('express');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const cors = require('cors');

const API_BASE_URL = process.env.API_BASE_URL || 'https://smart-id.adant.com/api/v0';
const PORT = 3025;
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '300000', 10); // 5 min default

const app = express();

app.use(cors({
  origin: ['http://localhost:3030', 'http://127.0.0.1:3030'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true
}));

// Carica la specifica OpenAPI da file
const swaggerDocument = YAML.load('./openapi.yaml');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

function formatDate(isoString) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
}

function translateType(type) {
  const map = {
    insert: "Inserimento",
    movement: "Spostamento",
    missed: "Rimozione"
  };
  return map[type] || type;
}

// Cache in-memory
const cache = {};

async function getCachedData(key, url) {
  const now = Date.now();
  if (cache[key] && cache[key].expire > now) {
    return cache[key].data;
  }

  try {
    const { data } = await axios.get(url, { timeout: 5000 });
    cache[key] = {
      data,
      expire: now + CACHE_TTL_MS
    };
    return data;
  } catch (error) {
    console.error(`Errore nel recupero dati da ${url}:`, error.message);
    throw new Error(`External service unavailable: ${url}`);
  }
}

// Funzione per arricchire gli eventi con i dati provenienti dagli altri endpoint
async function enrichEvents(events) {
  const racks = await getCachedData('racks', `${API_BASE_URL}/rack/`);
  const operators = await getCachedData('operators', `${API_BASE_URL}/operator/`);
  const warehouses = await getCachedData('warehouses', `${API_BASE_URL}/warehouse/`);
  const tags = await getCachedData('tags', `${API_BASE_URL}/tag_rfid/`);

  const rackMap = {};
  for (const r of racks) {
    rackMap[r.uuid] = r;
  }

  const operatorMap = {};
  for (const op of operators) {
    operatorMap[op.uuid] = op;
  }

  const warehouseMap = {};
  for (const wh of warehouses) {
    warehouseMap[wh.uuid] = wh;
  }

  const tagMap = {};
  for (const t of tags) {
    tagMap[t.id] = t;
  }

  const enrichedEvents = events.map(ev => {
    const rackData = rackMap[ev.rack] || {};
    const operatorData = operatorMap[ev.operator] || {};
    const tagData = tagMap[ev.tag_rfid] || {};

    let warehouseName = 'Sconosciuto';
    if (rackData.warehouse && warehouseMap[rackData.warehouse]) {
      warehouseName = warehouseMap[rackData.warehouse].name || 'Sconosciuto';
    }

    return {
      tag_rfid: ev.tag_rfid,
      categoria: tagData.product_category || 'Sconosciuto',
      tipo: translateType(ev.type),
      operatore: operatorData.identity || 'Sconosciuto',
      rack: rackData.name || 'Sconosciuto',
      magazzino: warehouseName,
      data: formatDate(ev.ts)
    };
  });

  return enrichedEvents;
}

// Endpoint originale con filtri
app.get('/api/enriched_events', async (req, res) => {
  try {
    const { date, start, end } = req.query;

    const events = await getCachedData('events', `${API_BASE_URL}/event_rfid/`);

    let filteredEvents = events;

    if (date) {
      const targetDate = new Date(date); 
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: "Formato data non valido. Usa YYYY-MM-DD." });
      }
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

      filteredEvents = filteredEvents.filter(ev => {
        const eventDate = new Date(ev.ts);
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });
    } else if (start || end) {
      const startDate = start ? new Date(start) : new Date('1970-01-01T00:00:00Z');
      const endDate = end ? new Date(end) : new Date();

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Formato start/end non valido. Usa date ISO (YYYY-MM-DDTHH:mm:ssZ)." });
      }

      filteredEvents = filteredEvents.filter(ev => {
        const eventDate = new Date(ev.ts);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    const enrichedEvents = await enrichEvents(filteredEvents);
    res.json(enrichedEvents);
  } catch (error) {
    console.error('Errore durante la generazione degli enriched_events:', error.message);
    res.status(502).json({ error: 'Impossibile recuperare i dati da uno o più servizi esterni.' });
  }
});

// Endpoint per gli eventi di oggi
app.get('/api/enriched_events/today', async (req, res) => {
  try {
    const events = await getCachedData('events', `${API_BASE_URL}/event_rfid/`);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const filteredEvents = events.filter(ev => {
      const eventDate = new Date(ev.ts);
      return eventDate >= startOfDay && eventDate <= endOfDay;
    });

    const enrichedEvents = await enrichEvents(filteredEvents);
    res.json(enrichedEvents);
  } catch (error) {
    console.error('Errore durante il recupero degli eventi di oggi:', error.message);
    res.status(502).json({ error: 'Impossibile recuperare i dati da uno o più servizi esterni.' });
  }
});

// Endpoint per gli eventi di ieri
app.get('/api/enriched_events/yesterday', async (req, res) => {
  try {
    const events = await getCachedData('events', `${API_BASE_URL}/event_rfid/`);

    const now = new Date();
    // Calcolo la data di ieri
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);

    const filteredEvents = events.filter(ev => {
      const eventDate = new Date(ev.ts);
      return eventDate >= startOfYesterday && eventDate <= endOfYesterday;
    });

    const enrichedEvents = await enrichEvents(filteredEvents);
    res.json(enrichedEvents);
  } catch (error) {
    console.error('Errore durante il recupero degli eventi di ieri:', error.message);
    res.status(502).json({ error: 'Impossibile recuperare i dati da uno o più servizi esterni.' });
  }
});

// Endpoint per gli eventi degli ultimi 7 giorni
app.get('/api/enriched_events/weekly', async (req, res) => {
  try {
    const events = await getCachedData('events', `${API_BASE_URL}/event_rfid/`);

    const now = new Date();
    // Calcolo inizio degli ultimi 7 giorni
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);

    const filteredEvents = events.filter(ev => {
      const eventDate = new Date(ev.ts);
      return eventDate >= sevenDaysAgo && eventDate <= now;
    });

    const enrichedEvents = await enrichEvents(filteredEvents);
    res.json(enrichedEvents);
  } catch (error) {
    console.error('Errore durante il recupero degli eventi settimanali:', error.message);
    res.status(502).json({ error: 'Impossibile recuperare i dati da uno o più servizi esterni.' });
  }
});

// Endpoint per gli ultimi 60 record
app.get('/api/enriched_events/latest', async (req, res) => {
  try {
    const events = await getCachedData('events', `${API_BASE_URL}/event_rfid/`);

    // Ordina gli eventi per timestamp decrescente e prendi i primi 60
    const latestEvents = events
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 60);

    const enrichedEvents = await enrichEvents(latestEvents);
    res.json(enrichedEvents);
  } catch (error) {
    console.error('Errore durante il recupero degli ultimi 60 eventi:', error.message);
    res.status(502).json({ error: 'Impossibile recuperare i dati da uno o più servizi esterni.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
  console.log(`Visita http://localhost:${PORT}/api-docs per vedere la documentazione Swagger UI`);
});
