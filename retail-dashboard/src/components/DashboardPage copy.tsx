import React, { useState, useEffect } from 'react';
import RetailDashboard from './RetailDashboard';
import { 
  Alert, 
  AlertTitle, 
  CircularProgress, 
  Box, 
  Container 
} from '@mui/material';

interface RetailEvent {
  tag_rfid: string;
  categoria: string;
  tipo: string;
  operatore: string;
  rack: string;
  magazzino: string;
  data: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3025';

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<RetailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      } catch (err) {
        console.error('Errore dettagliato:', err);
        setError(err instanceof Error ? 
          `Errore di connessione al server (${API_URL}): ${err.message}` : 
          'Errore sconosciuto nella connessione al server'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

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

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <RetailDashboard data={data} />
    </Box>
  );
};

export default DashboardPage;