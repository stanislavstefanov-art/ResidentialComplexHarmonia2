import React, { useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import {
  AppBar, Box, Button, CircularProgress, Tab, Tabs, Toolbar, ToggleButton,
  ToggleButtonGroup, Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useTranslation } from 'react-i18next';
import { makeTheme } from './theme';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import DirectoryList from './components/DirectoryList';
import ExpensesScreen from './components/ExpensesScreen';
import FinancialScreen from './components/FinancialScreen';
import MaintenanceFeesScreen from './components/MaintenanceFeesScreen';
import NotificationsScreen from './components/NotificationsScreen';
import PaymentsScreen from './components/PaymentsScreen';
import PrivacyScreen from './components/PrivacyScreen';
import AdminPendingScreen from './components/AdminPendingScreen';
import ContactEditScreen from './components/ContactEditScreen';
import ReservationScreen from './components/ReservationScreen';
import { getMyStatus } from './api/me';
import ResidentPendingScreen from './components/ResidentPendingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import LanguageSwitcher from './components/LanguageSwitcher';
import IosSafariInstallBanner from './components/IosSafariInstallBanner';
import { Role } from './types';

type Screen = 'directory' | 'reservations' | 'financial' | 'expenses' | 'fees' | 'payments' | 'notifications' | 'privacy' | 'contact-edit' | 'admin-pending';

function SignInPage() {
  const { instance, inProgress } = useMsal();
  const { t } = useTranslation();
  const loading = inProgress !== 'none';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 12, gap: 2 }}>
      <LanguageSwitcher color="inherit" />
      <HomeIcon sx={{ fontSize: 48, color: 'primary.main' }} />
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('signIn.title')}</Typography>
      <Typography variant="body2" color="text.secondary">{t('signIn.subtitle')}</Typography>
      {loading ? (
        <CircularProgress size={32} />
      ) : (
        <Button
          variant="contained"
          size="large"
          onClick={() => instance.loginRedirect(loginRequest)}
        >
          {t('signIn.button')}
        </Button>
      )}
    </Box>
  );
}

function MainApp() {
  const { instance, accounts } = useMsal();
  const { t } = useTranslation();
  const claims = accounts[0]?.idTokenClaims as Record<string, unknown> | undefined;
  const roles = claims?.['roles'] as string[] | undefined;
  const initialRole: Role = roles?.includes('admin') ? 'admin' : 'resident';
  const [role, setRole] = useState<Role>(initialRole);

  const firstLogin = initialRole === 'resident' && !localStorage.getItem('harmonia-welcomed');
  const [screen, setScreen] = useState<Screen>(
    firstLogin ? 'contact-edit' : initialRole === 'resident' ? 'notifications' : 'directory'
  );

  useEffect(() => {
    if (firstLogin) localStorage.setItem('harmonia-welcomed', '1');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = accounts[0]?.name ?? accounts[0]?.username ?? t('app.user');

  const roleScreens: Screen[] = ['directory', 'financial', 'expenses', 'fees', 'payments', 'notifications', 'privacy', 'contact-edit', 'admin-pending'];

  useEffect(() => {
    if (role === 'admin' && screen === 'reservations') setScreen('directory');
  }, [role, screen]);

  return (
    <>
      <AppBar position="static" elevation={2}>
        {/* Top row: brand + actions */}
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <HomeIcon sx={{ flexShrink: 0 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1, display: { xs: 'none', sm: 'block' } }}>
            {t('app.brand')}
          </Typography>
          <Box sx={{ flexGrow: { xs: 1, sm: 0 } }} />
          {initialRole === 'admin' && roleScreens.includes(screen) && (
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
                  px: { xs: 1, sm: 2 },
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
              <ToggleButton value="resident">{t('app.roleResident')}</ToggleButton>
              <ToggleButton value="admin">{t('app.roleAdmin')}</ToggleButton>
            </ToggleButtonGroup>
          )}
          <Typography variant="caption" sx={{ opacity: 0.8, display: { xs: 'none', md: 'block' } }}>{displayName}</Typography>
          <LanguageSwitcher />
          <Button
            size="small"
            sx={{ color: 'rgba(255,255,255,0.75)', textTransform: 'none', minWidth: 0, px: { xs: 1, sm: 1.5 } }}
            onClick={() => instance.logoutRedirect()}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t('app.signOut')}</Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>✕</Box>
          </Button>
        </Toolbar>
        {/* Nav row: swipe-scrollable tabs */}
        <Box sx={{
          overflowX: 'auto',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}>
          <Tabs
            value={screen}
            onChange={(_, v) => setScreen(v)}
            textColor="inherit"
            variant="scrollable"
            scrollButtons={false}
            slotProps={{ indicator: { style: { backgroundColor: 'white' } } }}
            sx={{
              minWidth: 'max-content',
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.75)',
                textTransform: 'none',
                minWidth: { xs: 72, sm: 90 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                py: { xs: 1, sm: 1.5 },
                '&.Mui-selected': { color: 'white' },
              },
            }}
          >
            <Tab label={t('nav.directory')} value="directory" />
            {role !== 'admin' && <Tab label={t('nav.reservations')} value="reservations" />}
            <Tab label={t('nav.finance')} value="financial" />
            <Tab label={t('nav.expenses')} value="expenses" />
            <Tab label={t('nav.fees')} value="fees" />
            <Tab label={t('nav.payments')} value="payments" />
            <Tab label={t('nav.notifications')} value="notifications" />
            <Tab label={t('nav.contactEdit')} value="contact-edit" />
            {initialRole === 'admin' && <Tab label={t('nav.adminPending')} value="admin-pending" />}
            <Tab label={t('nav.privacy')} value="privacy" />
          </Tabs>
        </Box>
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
        {screen === 'financial' && <FinancialScreen role={role} />}
        {screen === 'expenses' && <ExpensesScreen role={role} />}
        {screen === 'fees' && <MaintenanceFeesScreen role={role} />}
        {screen === 'payments' && <PaymentsScreen role={role} />}
        {screen === 'notifications' && <NotificationsScreen role={role} />}
        {screen === 'privacy' && <PrivacyScreen role={role} />}
        {screen === 'contact-edit' && <ContactEditScreen role={role} />}
        {screen === 'admin-pending' && initialRole === 'admin' && <AdminPendingScreen role={role} />}
      </Box>
    </>
  );
}

function AppStatusGate() {
  const { instance } = useMsal();
  const [status, setStatus] = useState<'loading' | 'pending' | 'ok'>('loading');

  useEffect(() => {
    getMyStatus()
      .then((res) => setStatus(res.status === 'pending' ? 'pending' : 'ok'))
      .catch(() => setStatus('ok'));
  }, []);

  if (status === 'loading') {
    return <CircularProgress sx={{ mt: 8, display: 'block', mx: 'auto' }} />;
  }
  if (status === 'pending') {
    return (
      <ResidentPendingScreen
        onCheckAgain={async () => {
          const res = await getMyStatus().catch(() => ({ status: 'ok' }));
          if (res.status !== 'pending') setStatus('ok');
        }}
        onSignOut={() => instance.logoutRedirect()}
      />
    );
  }
  return <MainApp />;
}

function App() {
  const { i18n } = useTranslation();
  const theme = React.useMemo(() => makeTheme(i18n.language), [i18n.language]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <IosSafariInstallBanner />
      <ErrorBoundary>
        <AuthenticatedTemplate><AppStatusGate /></AuthenticatedTemplate>
        <UnauthenticatedTemplate><SignInPage /></UnauthenticatedTemplate>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
