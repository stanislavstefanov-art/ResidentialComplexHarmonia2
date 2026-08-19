import React, { useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import {
  AppBar, Avatar, Badge, Box, Button, CircularProgress, Divider, IconButton,
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
import HouseholdsScreen from './components/HouseholdsScreen';
import CounterpartiesScreen from './components/CounterpartiesScreen';
import { getMyStatus } from './api/me';
import ResidentPendingScreen from './components/ResidentPendingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import LanguageSwitcher from './components/LanguageSwitcher';
import IosSafariInstallBanner from './components/IosSafariInstallBanner';
import { Role } from './types';
import { useSlowLoad } from './hooks/useSlowLoad';
import { usePendingCount } from './hooks/usePendingCount';

type Screen = 'directory' | 'reservations' | 'financial' | 'notifications' | 'privacy' | 'contact-edit' | 'admin-pending' | 'households' | 'counterparties';

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
  const { count: pendingCount, setCount: setPendingCount } =
    usePendingCount(initialRole === 'admin');

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

  const ADMIN_SCREENS: Screen[] = ['counterparties', 'households', 'admin-pending'];
  const [adminAnchor, setAdminAnchor] = useState<null | HTMLElement>(null);
  const adminActive = ADMIN_SCREENS.includes(screen);

  const roleScreens: Screen[] = ['directory', 'financial', 'notifications', 'privacy', 'contact-edit', 'admin-pending', 'households', 'counterparties'];

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
            value={adminActive ? false : screen}
            onChange={(_, v) => { if (v !== '__admin__') setScreen(v); }}
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
            <Tab label={t('nav.reservations')} value="reservations" />
            {initialRole === 'admin' && <Tab label={t('nav.directory')} value="directory" />}
            {initialRole === 'admin' && (
              <Tab
                value="__admin__"
                onClick={(e: React.MouseEvent<HTMLElement>) => setAdminAnchor(e.currentTarget)}
                label={
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <Badge badgeContent={pendingCount} color="error" max={99} invisible={pendingCount === 0}
                      sx={{ '& .MuiBadge-badge': { right: -6, top: 4 } }}>
                      <span>{t('nav.administration')}</span>
                    </Badge>
                    <span aria-hidden>▾</span>
                  </Box>
                }
              />
            )}
            <Tab label={t('nav.privacy')} value="privacy" />
          </Tabs>
        </Box>
        <Menu
          anchorEl={adminAnchor}
          open={Boolean(adminAnchor)}
          onClose={() => setAdminAnchor(null)}
          slotProps={{ paper: { sx: { minWidth: 220 } } }}
        >
          <MenuItem onClick={() => { setScreen('counterparties'); setAdminAnchor(null); }}>
            {t('nav.counterparties')}
          </MenuItem>
          <MenuItem onClick={() => { setScreen('households'); setAdminAnchor(null); }}>
            {t('nav.households')}
          </MenuItem>
          <MenuItem onClick={() => { setScreen('admin-pending'); setAdminAnchor(null); }}>
            <Badge badgeContent={pendingCount} color="error" max={99} invisible={pendingCount === 0}
              sx={{ '& .MuiBadge-badge': { right: -12, top: 8 } }}>
              <span>{t('nav.adminPending')}</span>
            </Badge>
          </MenuItem>
        </Menu>
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
        {screen === 'admin-pending' && initialRole === 'admin' &&
          <AdminPendingScreen role={role} onPendingCount={setPendingCount} />}
        {screen === 'households' && initialRole === 'admin' && <HouseholdsScreen />}
        {screen === 'counterparties' && initialRole === 'admin' && <CounterpartiesScreen />}
      </Box>
    </>
  );
}

function AppStatusGate() {
  const { instance, accounts } = useMsal();
  const { t } = useTranslation();
  const claims = accounts[0]?.idTokenClaims as Record<string, unknown> | undefined;
  const roles = claims?.['roles'] as string[] | undefined;
  const isAdmin = roles?.includes('admin') ?? false;

  const [status, setStatus] = useState<'loading' | 'pending' | 'ok'>(isAdmin ? 'ok' : 'loading');
  const slowLoad = useSlowLoad(status === 'loading');

  useEffect(() => {
    if (isAdmin) return;
    getMyStatus()
      .then((res) => setStatus(res.status === 'pending' ? 'pending' : 'ok'))
      .catch(() => setStatus('pending'));
  }, [isAdmin]);

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, gap: 2 }}>
        <CircularProgress />
        {slowLoad && <Typography variant="body2" color="text.secondary">{t('app.slowLoad')}</Typography>}
      </Box>
    );
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
