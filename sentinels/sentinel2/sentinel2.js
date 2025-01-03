require('dotenv').config();
const express = require('express');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const cors = require('cors');

const API_BASE_URL = process.env.API_BASE_URL || 'https://point-demo.adant.com/api/v0';
const PORT = 3026;
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '300000', 10);

const app = express();

// CORS
app.use(cors({
  origin: ['http://localhost:3030', 'http://127.0.0.1:3030'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true
}));

// OpenAPI
const swaggerDocument = YAML.load('./openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Funzione per formattare la data in stile GG/MM/YYYY HH:mm:ss
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

// Direzione: enter → In, exit → Out
function mapDirection(dir) {
  switch (dir) {
    case 'enter': return 'In';
    case 'exit':  return 'Out';
    default:      return dir;
  }
}

// Cache in-memory
const cache = {};

// Funzione di supporto per caching
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

/*
  Carica e prepara i dati:
  - operatorList:   array di operatori
  - warehouseList:  array di warehouse
  - areaTypeList:   array di warehouse_area_type

  Qui costruiremo delle mappe per uso rapido:
  - warehouseMap[uuid] = { name: "...", ... }
  - areaTypeMap[warehouse_uuid + "_" + id] = { name: "...", ... }

  Per l'operator, se non hai modo di legare MAC all'operator, potresti lasciarli in un array
  o creare un operatorMap, ma senza un campo di collegamento, rimarrà di base "Sconosciuto".
*/
async function loadData() {
  const [operatorList, warehouseList, areaTypeList] = await Promise.all([
    getCachedData('operators', `${API_BASE_URL}/operator`),
    getCachedData('warehouses', `${API_BASE_URL}/warehouse`),
    getCachedData('warehouse_area_type', `${API_BASE_URL}/warehouse_area_type`)
  ]);

  // Mappa warehouse => name
  const warehouseMap = {};
  warehouseList.forEach(wh => {
    // wh.uuid (string), wh.name (ipotizzo esista)
    warehouseMap[wh.uuid] = wh;
  });

  // Mappa per area => name
  // Facciamo matching su (warehouse_uuid, id)
  const areaTypeMap = {};
  areaTypeList.forEach(area => {
    // area.id (string), area.warehouse_uuid
    // Esempio chiave: "99849379288172366_2" => {name: 'AreaRTLS', ...}
    const key = `${area.warehouse_uuid}_${area.id}`;
    areaTypeMap[key] = area;
  });

  // Per gli operatori, se non esiste link MAC → operator, non possiamo far granché
  // Mettiamoli in operatorMap indicizzato da "identity", se servisse
  const operatorMap = {};
  operatorList.forEach(op => {
    operatorMap[op.identity] = op;
  });

  return { operatorMap, warehouseMap, areaTypeMap };
}

// Funzione per arricchire gli eventi
async function enrichEvents(events) {
  // Carichiamo le mappe dai dati esterni
  const { operatorMap, warehouseMap, areaTypeMap } = await loadData();

  // Arricchimento
  return events.map(ev => {
    const mac        = ev.MAC || 'N/A';
    const warehouse  = ev.warehouse || 'unknownWarehouse';
    const area       = ev.area?.toString() || 'unknownArea';
    const direction  = ev.direction || 'unknownDirection';
    const ts         = ev.ts || new Date().toISOString();

    // Trova warehouseName
    const whObj      = warehouseMap[warehouse];
    const warehouseName = whObj ? whObj.name : warehouse; // fallback

    // Trova areaName
    const areaKey    = `${warehouse}_${area}`;
    const areaObj    = areaTypeMap[areaKey];
    const areaName   = areaObj ? areaObj.name : areaKey; // fallback

    // Operator → in mancanza di un link da MAC a operator, lasciamo "UnknownOperator"
    // Oppure si potrebbe usare operatorMap se avessimo un campo comune di correlazione
    const operator   = 'UnknownOperator';

    return {
      MAC: mac,
      Operator: operator,
      Warehouse: warehouseName,
      Zone: areaName,
      Direction: mapDirection(direction),
      Date: formatDate(ts)
    };
  });
}

// Endpoint con filtri
app.get('/api/enriched_area_events', async (req, res) => {
  try {
    const { date, start, end } = req.query;

    // Recuperiamo tutti gli eventi da area_event_ble
    const events = await getCachedData('events', `${API_BASE_URL}/area_event_ble`);

    // Filtraggio base
    let filteredEvents = events;
    if (date) {
      const targetDate = new Date(date); 
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Formato data non valido. Usa YYYY-MM-DD.' });
      }
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      const endOfDay   = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
      filteredEvents   = filteredEvents.filter(ev => {
        const eventDate = new Date(ev.ts);
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });
    } else if (start || end) {
      const startDate = start ? new Date(start) : new Date('1970-01-01T00:00:00Z');
      const endDate   = end   ? new Date(end)   : new Date();
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Formato start/end non valido. Usa date ISO (YYYY-MM-DDTHH:mm:ssZ).' });
      }
      filteredEvents   = filteredEvents.filter(ev => {
        const eventDate = new Date(ev.ts);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    // Arricchimento
    const enriched = await enrichEvents(filteredEvents);
    res.json(enriched);

  } catch (error) {
    console.error('Errore durante la generazione degli enriched_area_events:', error.message);
    res.status(502).json({ error: 'Impossibile recuperare i dati da uno o più servizi esterni.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
  console.log(`Visita http://localhost:${PORT}/api-docs per vedere la documentazione Swagger UI`);
});
