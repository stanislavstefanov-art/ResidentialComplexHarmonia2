import React, { useState } from 'react';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import {
  AppBar, Box, Tab, Tabs, Toolbar, ToggleButton,
  ToggleButtonGroup, Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DirectoryList from './components/DirectoryList';
import FinancialScreen from './components/FinancialScreen';
import ReservationScreen from './components/ReservationScreen';
import { Role } from './types';

const theme = createTheme({
  palette: {
    primary: { main: '#2e6b4f' },
    background: { default: '#f5f5f0' },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
});

type Screen = 'directory' | 'reservations' | 'financial';

function App() {
  const [role, setRole] = useState<Role>('resident');
  const [screen, setScreen] = useState<Screen>('directory');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <HomeIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 2 }}>
            Harmonia
          </Typography>
          <Tabs
            value={screen}
            onChange={(_, v) => setScreen(v)}
            textColor="inherit"
            TabIndicatorProps={{ style: { backgroundColor: 'white' } }}
            sx={{
              flexGrow: 1,
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.75)',
                textTransform: 'none',
                '&.Mui-selected': { color: 'white' },
              },
            }}
          >
            <Tab label="Directory" value="directory" />
            <Tab label="Reservations" value="reservations" />
            <Tab label="Finance" value="financial" />
          </Tabs>
          {screen === 'directory' && (
            <>
              <Typography variant="caption" sx={{ opacity: 0.7, mr: 1.5 }}>
                View as:
              </Typography>
              <ToggleButtonGroup
                value={role}
                exclusive
                onChange={(_, v) => v && setRole(v)}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  borderRadius: 2,
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.75)',
                    border: 'none',
                    px: 2,
                    py: 0.5,
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(255,255,255,0.22)',
                      color: 'white',
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' },
                    },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                  },
                }}
              >
                <ToggleButton value="resident">Resident</ToggleButton>
                <ToggleButton value="admin">Admin</ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          maxWidth: screen === 'directory' && role === 'admin' ? 1200 : 900,
          mx: 'auto',
          px: 2,
          py: 4,
          transition: 'max-width 0.2s',
        }}
      >
        {screen === 'directory' && <DirectoryList role={role} />}
        {screen === 'reservations' && <ReservationScreen />}
        {screen === 'financial' && <FinancialScreen />}
      </Box>
    </ThemeProvider>
  );
}

export default App;
