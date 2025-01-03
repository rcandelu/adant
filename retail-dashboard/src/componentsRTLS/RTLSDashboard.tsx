'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Container,
  IconButton,
  Button,
  CircularProgress,
  useTheme
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  CompareArrows,
  TrendingUp
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';

// 1) Importa FlowiseClient
import { FlowiseClient } from 'flowise-sdk';
import _ from 'lodash';

interface RtlEvent {
  MAC: string;
  Operator: string;
  Warehouse: string;
  Zone: string;
  Direction: string;
  Date: string;
}

interface RTLSDashboardProps {
  data: RtlEvent[];
}

// Se vuoi cambiare ID del ChatFlow, fallo qui
const CHATFLOW_ID = 'f611e292-3cc6-4c55-ba83-8b06078dcdcd';

// Base URL del server Flowise
const FLOWISE_BASE_URL = 'http://ec2-3-79-180-85.eu-central-1.compute.amazonaws.com';

const RTLSDashboard: React.FC<RTLSDashboardProps> = ({ data = [] }) => {
  const theme = useTheme();

  // Stati per AI Analysis
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string[]>([]);

  // Calcolo KPI base
  const kpis = useMemo(() => {
    const totalEvents = data.length;
    const directionGroup = _.groupBy(data, 'Direction');
    const totalIn = directionGroup['In']?.length || 0;
    const totalOut = directionGroup['Out']?.length || 0;

    // Zone
    const zoneGroup = _.groupBy(data, 'Zone');
    const zoneStats = Object.entries(zoneGroup).map(([zone, items]) => ({
      zone,
      count: items.length,
    }));
    zoneStats.sort((a, b) => b.count - a.count);

    // Warehouse
    const whGroup = _.groupBy(data, 'Warehouse');
    const warehouseStats = Object.entries(whGroup).map(([wh, items]) => ({
      warehouse: wh,
      count: items.length,
    }));
    warehouseStats.sort((a, b) => b.count - a.count);

    return {
      totalEvents,
      totalIn,
      totalOut,
      zoneStats,
      warehouseStats,
    };
  }, [data]);

  // Funzione AI Analysis con STREAMING
  const handleAIAnalysis = async () => {
    try {
      setLoadingAI(true);
      setAiResponse([]);

      // Inizializza il client
      const client = new FlowiseClient({ baseUrl: FLOWISE_BASE_URL });
      const jsonPayload = JSON.stringify(data);

      // Crea una "prediction" in streaming
      const prediction = await client.createPrediction({
        chatflowId: CHATFLOW_ID,
        question: jsonPayload,
        streaming: true,
      });

      let fullResponse = '';
      // Legge i chunk man mano che arrivano
      for await (const chunk of prediction) {
        // Verifica l'evento "token" e concatena i dati
        if (chunk.event === 'token' && chunk.data) {
          fullResponse += chunk.data;
          setAiResponse([fullResponse]);
        }
      }
    } catch (error) {
      console.error('Errore AI:', error);
      setAiResponse(["Errore durante l'analisi AI."]);
    } finally {
      setLoadingAI(false);
    }
  };

  // Tooltip personalizzato
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2">{label}</Typography>
          {payload.map((entry: any, index: number) => (
            <Typography key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  // Colori
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.error.main,
  ];

  return (
    <Container maxWidth="xl">
      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid container item spacing={3}>
          {/* Totali */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <div>
                    <Typography color="textSecondary" variant="subtitle2">
                      Total Events
                    </Typography>
                    <Typography variant="h4">{kpis.totalEvents}</Typography>
                  </div>
                  <IconButton color="primary">
                    <BarChartIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Totali In */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" variant="subtitle2">
                  In
                </Typography>
                <Typography variant="h4">{kpis.totalIn}</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Totali Out */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" variant="subtitle2">
                  Out
                </Typography>
                <Typography variant="h4">{kpis.totalOut}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* AI Analysis */}
        <Grid item xs={12}>
          <Box textAlign="center" my={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAIAnalysis}
              disabled={loadingAI}
              sx={{ width: 200, height: 50 }}
            >
              {loadingAI ? 'Analisi in corso...' : 'AI Analysis'}
            </Button>
          </Box>

          {loadingAI && (
            <Box display="flex" justifyContent="center" alignItems="center" my={2}>
              <CircularProgress />
            </Box>
          )}

          {aiResponse.length > 0 && (
            <Paper elevation={3} sx={{ p: 3, mt: 2, backgroundColor: '#f8f8f8' }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                AI Analysis:
              </Typography>
              <Box
                sx={{
                  whiteSpace: 'pre-wrap',
                  maxHeight: 300,
                  overflowY: 'auto',
                  borderRadius: 2,
                  p: 2,
                  boxShadow: 1,
                }}
              >
                {aiResponse.map((chunk, index) => (
                  <Typography key={index} variant="body1" sx={{ mb: 1 }}>
                    {chunk}
                  </Typography>
                ))}
              </Box>
            </Paper>
          )}
        </Grid>

        {/* Distribuzione In/Out (Pie Chart) */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Distribution by Direction
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'In', value: kpis.totalIn },
                      { name: 'Out', value: kpis.totalOut },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                  >
                    <Cell fill={theme.palette.primary.main} />
                    <Cell fill={theme.palette.warning.main} />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Top 5 Zones */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Top 5 Zones
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.zoneStats.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="zone" type="category" width={150} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={theme.palette.primary.main} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Top Warehouse */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Top Warehouse
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.warehouseStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="warehouse" type="category" width={200} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="count" fill={theme.palette.success.main} name="Eventi" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default RTLSDashboard;
