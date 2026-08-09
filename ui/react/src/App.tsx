import React, { useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import {
  AppBar, Avatar, Box, Button, CircularProgress, Divider, IconButton,
  ListItemIcon, Menu, MenuItem, Tab, Tabs, Toolbar, Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ManageAccountsIcon from '@mui/icons-material/ManageAccountsOutlined';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import { useTranslation } from 'react-i18next';
import { makeTheme } from './theme';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import DirectoryList from './components/DirectoryList';
import FinancialScreen from './components/FinancialScreen';
import NotificationsScreen from './components/NotificationsScreen';
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

type Screen = 'directory' | 'reservations' | 'financial' | 'notifications' | 'privacy' | 'contact-edit' | 'admin-pending';

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
  const role = initialRole;

  const firstLogin = initialRole === 'resident' && !localStorage.getItem('harmonia-welcomed');
  const [screen, setScreen] = useState<Screen>(
    firstLogin ? 'contact-edit' : initialRole === 'resident' ? 'notifications' : 'directory'
  );

  useEffect(() => {
    if (firstLogin) localStorage.setItem('harmonia-welcomed', '1');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = accounts[0]?.name ?? accounts[0]?.username ?? t('app.user');
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);

  const roleScreens: Screen[] = ['directory', 'financial', 'notifications', 'privacy', 'contact-edit', 'admin-pending'];

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
          <LanguageSwitcher />
          <IconButton onClick={(e) => setProfileAnchor(e.currentTarget)} sx={{ p: 0.5, ml: 0.5 }} size="small">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '0.8125rem', fontWeight: 700 }}>
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={profileAnchor}
            open={Boolean(profileAnchor)}
            onClose={() => setProfileAnchor(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { minWidth: 240, mt: 0.5 } } }}
          >
            <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontSize: '1.25rem', fontWeight: 700 }}>
                {displayName.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{displayName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{accounts[0]?.username}</Typography>
              </Box>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setScreen('contact-edit'); setProfileAnchor(null); }}>
              <ListItemIcon><ManageAccountsIcon fontSize="small" /></ListItemIcon>
              {t('nav.contactEdit')}
            </MenuItem>
            <MenuItem onClick={() => instance.logoutRedirect()}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              {t('app.signOut')}
            </MenuItem>
          </Menu>
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
            <Tab label={t('nav.notifications')} value="notifications" />
            <Tab label={t('nav.finance')} value="financial" />
            {role !== 'admin' && <Tab label={t('nav.reservations')} value="reservations" />}
            {initialRole === 'admin' && <Tab label={t('nav.adminPending')} value="admin-pending" />}
            <Tab label={t('nav.directory')} value="directory" />
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
      .catch(() => setStatus('pending'));
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
