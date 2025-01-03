'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  TrendingUp,
  People,
  ShoppingBag,
  BarChart as BarChartIcon,
  CompareArrows
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
import { FlowiseClient } from 'flowise-sdk';
import _ from 'lodash';

interface RetailEvent {
  tag_rfid: string;
  categoria: string;
  tipo: string;
  operatore: string;
  rack: string;
  magazzino: string;
  data: string;
}

interface RetailDashboardProps {
  data: RetailEvent[];
}

const RetailDashboard: React.FC<RetailDashboardProps> = ({ data = [] }) => {
  const theme = useTheme();

  // Stati per AI Analysis
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string[]>([]);

  const kpis = useMemo(() => {
    // Calcoli base
    const categoryMovements = _.groupBy(data, 'categoria');
    const categoryStats = Object.entries(categoryMovements).map(([category, items]) => ({
      name: category || 'Sconosciuto',
      count: items?.length || 0
    }));

    const operationTypes = _.groupBy(data, 'tipo');
    const operationStats = Object.entries(operationTypes).map(([type, items]) => ({
      name: type || 'Sconosciuto',
      count: items?.length || 0,
      percentage: data.length ? ((items?.length || 0) / data.length) * 100 : 0
    }));

    const operatorStats = _.chain(data)
      .groupBy('operatore')
      .map((items, operator) => ({
        name: operator || 'Sconosciuto',
        count: items?.length || 0
      }))
      .value();

    // Analisi flusso Checkout vs FittingRoom
    const flowAnalysis = {
      checkout: {
        total: data.filter(item => item.rack === 'Checkout').length,
        items: _.uniqBy(data.filter(item => item.rack === 'Checkout'), 'tag_rfid').length
      },
      fittingRoom: {
        total: data.filter(item => item.rack === 'FittingRoom').length,
        items: _.uniqBy(data.filter(item => item.rack === 'FittingRoom'), 'tag_rfid').length
      }
    };

    // Calcolo conversione FittingRoom -> Checkout
    const fittingRoomToCheckout = data.reduce((acc, curr, index, array) => {
      if (curr.rack === 'FittingRoom') {
        const tagId = curr.tag_rfid;
        const wentToCheckout = array.some((item, i) => 
          i > index && 
          item.tag_rfid === tagId && 
          item.rack === 'Checkout'
        );
        if (wentToCheckout) acc++;
      }
      return acc;
    }, 0);

    return {
      categoryStats: _.orderBy(categoryStats, 'count', 'desc'),
      operationStats: _.orderBy(operationStats, 'count', 'desc'),
      operatorStats: _.orderBy(operatorStats, 'count', 'desc'),
      totalMovements: data.length,
      uniqueCategories: categoryStats.length,
      activeOperators: operatorStats.length,
      flowAnalysis,
      fittingRoomToCheckout
    };
  }, [data]);

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.error.main
  ];

  // Funzione per chiamare l'AI
  const handleAIAnalysis = async () => {
    setLoadingAI(true);
    setAiResponse([]);
    const client = new FlowiseClient({ baseUrl: 'http://ec2-3-79-180-85.eu-central-1.compute.amazonaws.com' });
    const chatflowId = '2dad2323-ff8f-41a8-b701-ff8236b77230'; // ID del tuo flusso AI

    try {
      const jsonPayload = JSON.stringify(data);
      const prediction = await client.createPrediction({
        chatflowId,
        question: jsonPayload,
        streaming: true,
      });

      let fullResponse = ''; // Variabile per concatenare i chunk
      for await (const chunk of prediction) {
        console.log('Chunk ricevuto:', chunk);
        if (chunk.event === 'token' && chunk.data) {
          fullResponse += chunk.data; // Concatena il testo ricevuto
          setAiResponse([fullResponse]); // Aggiorna lo stato con il testo completo
        }
      }
    } catch (error) {
      console.error('Errore AI:', error);
      setAiResponse(["Errore durante l'analisi AI."]);
    } finally {
      setLoadingAI(false);
    }
  };

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

  return (
    <Container maxWidth="xl">
      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid container item spacing={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <div>
                    <Typography color="textSecondary" variant="subtitle2">
                      Total Movements
                    </Typography>
                    <Typography variant="h4">{kpis.totalMovements}</Typography>
                  </div>
                  <IconButton color="primary">
                    <BarChartIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
  
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <div>
                    <Typography color="textSecondary" variant="subtitle2">
                      Unique Category
                    </Typography>
                    <Typography variant="h4">{kpis.uniqueCategories}</Typography>
                  </div>
                  <IconButton color="secondary">
                    <ShoppingBag />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
  
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <div>
                    <Typography color="textSecondary" variant="subtitle2">
                      Active Operators
                    </Typography>
                    <Typography variant="h4">{kpis.activeOperators}</Typography>
                  </div>
                  <IconButton color="success">
                    <People />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
  
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <div>
                    <Typography color="textSecondary" variant="subtitle2">
                      Conversion Rate
                    </Typography>
                    <Typography variant="h4">
                      {((kpis.operationStats.find(op => op.name === "Rimozione")?.count || 0) / kpis.totalMovements * 100).toFixed(1)}%
                    </Typography>
                  </div>
                  <IconButton color="warning">
                    <TrendingUp />
                  </IconButton>
                </Box>
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
  
        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Top 5 Category
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.categoryStats.slice(0, 5)} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={theme.palette.primary.main} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
  
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Distribution Operations
            </Typography>
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={kpis.operationStats}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                  >
                    {kpis.operationStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
 {/* Flow Analysis */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Product Flow Analysis
            </Typography>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <div>
                        <Typography color="textSecondary" gutterBottom>
                          Checkout Products
                        </Typography>
                        <Typography variant="h4">
                          {kpis.flowAnalysis.checkout.items}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {kpis.flowAnalysis.checkout.total} movimenti totali
                        </Typography>
                      </div>
                      <IconButton>
                        <CompareArrows />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <div>
                        <Typography color="textSecondary" gutterBottom>
                          Fitting Room Products
                        </Typography>
                        <Typography variant="h4">
                          {kpis.flowAnalysis.fittingRoom.items}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {kpis.flowAnalysis.fittingRoom.total} movimenti totali
                        </Typography>
                      </div>
                      <IconButton>
                        <CompareArrows />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <div>
                        <Typography color="textSecondary" gutterBottom>
                          Conversion Fitting Room → Checkout
                        </Typography>
                        <Typography variant="h4">
                          {kpis.fittingRoomToCheckout}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {((kpis.fittingRoomToCheckout / kpis.flowAnalysis.fittingRoom.items) * 100).toFixed(1)}% tasso di conversione
                        </Typography>
                      </div>
                      <IconButton>
                        <TrendingUp />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: 'Checkout',
                      movimenti: kpis.flowAnalysis.checkout.total,
                      prodottiUnici: kpis.flowAnalysis.checkout.items
                    },
                    {
                      name: 'Fitting Room',
                      movimenti: kpis.flowAnalysis.fittingRoom.total,
                      prodottiUnici: kpis.flowAnalysis.fittingRoom.items
                    }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="movimenti" fill={theme.palette.primary.main} name="Movimenti Totali" />
                  <Bar dataKey="prodottiUnici" fill={theme.palette.secondary.main} name="Prodotti Unici" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Operation Details */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Operational Details
            </Typography>
            <Grid container spacing={2}>
              {kpis.operationStats.map((op, index) => (
                <Grid item xs={12} md={3} key={index}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        {op.name}
                      </Typography>
                      <Typography variant="h5">
                        {op.count}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {op.percentage.toFixed(1)}% del totale
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
  
};

export default RetailDashboard;