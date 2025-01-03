'use client';

import React, { useState, useEffect } from 'react';
import RetailDashboard from './RetailDashboard';
import { 
  Alert, 
  AlertTitle, 
  Box, 
  Container, 
  Skeleton 
} from '@mui/material';
import { useSnackbar, SnackbarProvider } from 'notistack';

// Tipo per il dato Retail
interface RetailEvent {
  tag_rfid: string;
  categoria: string;
  tipo: string;
  operatore: string;
  rack: string;
  magazzino: string;
  data: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://ec2-3-79-180-85.eu-central-1.compute.amazonaws.com/api';

const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minuti

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<RetailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { enqueueSnackbar } = useSnackbar(); // Hook per notifiche

  // Funzione per il fetching dei dati
  const fetchData = async () => {
    try {
      console.log('Tentativo di connessione a:', `${API_URL}/api/enriched_events/latest`);
      const response = await fetch(`${API_URL}/api/enriched_events/latest`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();
      console.log('Dati ricevuti:', jsonData);
      setData(jsonData);
      setError(null); // Resetta eventuali errori
      enqueueSnackbar('Dati caricati con successo!', { variant: 'success' });
    } catch (err) {
      console.error('Errore dettagliato:', err);
      setError(err instanceof Error ? 
        `Errore di connessione al server (${API_URL}): ${err.message}` : 
        'Errore sconosciuto nella connessione al server'
      );
      enqueueSnackbar('Errore nel caricamento dati.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, FETCH_INTERVAL);

    return () => clearInterval(intervalId); // Cleanup per evitare memory leak
  }, []);

  // UI per caricamento
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Skeleton variant="rectangular" width="100%" height={400} />
        <Skeleton variant="text" width="60%" />
      </Container>
    );
  }

  // UI per errore
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          <AlertTitle>Errore</AlertTitle>
          {error}
          <Box component="ul" sx={{ mt: 2, pl: 2 }}>
            <li>Verifica che il server backend sia in esecuzione sulla porta 3025</li>
            <li>Verifica che il CORS sia configurato correttamente</li>
            <li>Verifica che non ci siano problemi di rete</li>
          </Box>
        </Alert>
      </Container>
    );
  }

  // UI principale
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <RetailDashboard data={data} />
    </Box>
  );
};

// Wrapper con SnackbarProvider per supportare le notifiche
const DashboardPageWrapper: React.FC = () => (
  <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
    <DashboardPage />
  </SnackbarProvider>
);

export default DashboardPageWrapper;
