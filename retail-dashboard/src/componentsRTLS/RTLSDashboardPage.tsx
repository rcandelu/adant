'use client';

import React, { useState, useEffect } from 'react';
import RTLSDashboard from './RTLSDashboard';
import {
  Alert,
  AlertTitle,
  Box,
  Container,
  Skeleton
} from '@mui/material';
import { SnackbarProvider, useSnackbar } from 'notistack';

interface RtlEvent {
  MAC: string;
  Operator: string;
  Warehouse: string;
  Zone: string;
  Direction: string;
  Date: string;
}

// Punto di accesso per i dati RTLS
const API_URL = 'http://ec2-3-79-180-85.eu-central-1.compute.amazonaws.com/api/enriched_area_events';

// Intervallo fetch (ms)
const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minuti

const RTLSDashboardPage: React.FC = () => {
  const [data, setData] = useState<RtlEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { enqueueSnackbar } = useSnackbar();

  const fetchData = async () => {
    try {
      console.log('Tentativo di recuperare dati da:', API_URL);
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();
      console.log('Dati RTLS ricevuti:', jsonData);
      setData(jsonData);
      setError(null);
      enqueueSnackbar('Dati UWB/RTLS caricati con successo!', { variant: 'success' });
    } catch (err) {
      console.error('Errore dettagliato RTLS:', err);
      setError(err instanceof Error
        ? `Errore di connessione al server: ${err.message}`
        : 'Errore sconosciuto nella connessione al server'
      );
      enqueueSnackbar('Errore nel caricamento dati RTLS.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, FETCH_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  // UI di caricamento
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
            <li>Verifica che il backend RTLS sia raggiungibile</li>
            <li>Verifica che il CORS sia configurato correttamente</li>
            <li>Verifica la connessione di rete</li>
          </Box>
        </Alert>
      </Container>
    );
  }

  // UI finale
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <RTLSDashboard data={data} />
    </Box>
  );
};

// Wrapper con SnackbarProvider per abilitare le notifiche
const RTLSDashboardPageWrapper: React.FC = () => (
  <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
    <RTLSDashboardPage />
  </SnackbarProvider>
);

export default RTLSDashboardPageWrapper;
