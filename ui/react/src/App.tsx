import React, { useState } from 'react';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import {
  AppBar, Box, Button, CircularProgress, Tab, Tabs, Toolbar, ToggleButton,
  ToggleButtonGroup, Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { bgBG } from '@mui/material/locale';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import DirectoryList from './components/DirectoryList';
import ExpensesScreen from './components/ExpensesScreen';
import FinancialScreen from './components/FinancialScreen';
import MaintenanceFeesScreen from './components/MaintenanceFeesScreen';
import NotificationsScreen from './components/NotificationsScreen';
import PaymentsScreen from './components/PaymentsScreen';
import PrivacyScreen from './components/PrivacyScreen';
import ContactEditScreen from './components/ContactEditScreen';
import ReservationScreen from './components/ReservationScreen';
import { Role } from './types';

const theme = createTheme(
  {
    palette: {
      primary: { main: '#2e6b4f' },
      background: { default: '#f5f5f0' },
    },
    shape: { borderRadius: 8 },
    typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
  },
  bgBG,
);

type Screen = 'directory' | 'reservations' | 'financial' | 'expenses' | 'fees' | 'payments' | 'notifications' | 'privacy' | 'contact-edit';

function SignInPage() {
  const { instance, inProgress } = useMsal();
  const loading = inProgress !== 'none';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 12, gap: 2 }}>
      <HomeIcon sx={{ fontSize: 48, color: 'primary.main' }} />
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Residence Harmonia</Typography>
      <Typography variant="body2" color="text.secondary">Sign in to access your residence portal.</Typography>
      {loading ? (
        <CircularProgress size={32} />
      ) : (
        <Button
          variant="contained"
          size="large"
          onClick={() => instance.loginRedirect(loginRequest)}
        >
          Sign in
        </Button>
      )}
    </Box>
  );
}

function MainApp() {
  const { instance, accounts } = useMsal();
  const [role, setRole] = useState<Role>('resident');
  const [screen, setScreen] = useState<Screen>('directory');

  const displayName = accounts[0]?.name ?? accounts[0]?.username ?? 'User';

  const roleScreens: Screen[] = ['directory', 'expenses', 'fees', 'payments', 'notifications', 'privacy', 'contact-edit'];

  return (
    <>
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
            slotProps={{ indicator: { style: { backgroundColor: 'white' } } }}
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
            <Tab label="Expenses" value="expenses" />
            <Tab label="Fees" value="fees" />
            <Tab label="Payments" value="payments" />
            <Tab label="Notifications" value="notifications" />
            <Tab label="Privacy" value="privacy" />
            <Tab label="Edit Contact" value="contact-edit" />
          </Tabs>
          {roleScreens.includes(screen) && (
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
          <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>{displayName}</Typography>
            <Button
              size="small"
              sx={{ color: 'rgba(255,255,255,0.75)', textTransform: 'none' }}
              onClick={() => instance.logoutRedirect()}
            >
              Sign out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          maxWidth: roleScreens.includes(screen) && role === 'admin' ? 1200 : 900,
          mx: 'auto',
          px: 2,
          py: 4,
          transition: 'max-width 0.2s',
        }}
      >
        {screen === 'directory' && <DirectoryList role={role} />}
        {screen === 'reservations' && <ReservationScreen />}
        {screen === 'financial' && <FinancialScreen />}
        {screen === 'expenses' && <ExpensesScreen role={role} />}
        {screen === 'fees' && <MaintenanceFeesScreen role={role} />}
        {screen === 'payments' && <PaymentsScreen role={role} />}
        {screen === 'notifications' && <NotificationsScreen role={role} />}
        {screen === 'privacy' && <PrivacyScreen role={role} />}
        {screen === 'contact-edit' && <ContactEditScreen role={role} />}
      </Box>
    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthenticatedTemplate>
        <MainApp />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <SignInPage />
      </UnauthenticatedTemplate>
    </ThemeProvider>
  );
}

export default App;
