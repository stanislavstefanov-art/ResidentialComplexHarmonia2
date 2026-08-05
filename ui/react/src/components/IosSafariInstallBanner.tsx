import React, { useState, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'harmonia-ios-install-dismissed';

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  const standalone = !!(window.navigator as { standalone?: boolean }).standalone;
  return ios && !standalone && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
}

export default function IosSafariInstallBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isIosSafari() && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1400,
        bgcolor: '#2e6b4f',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1.5,
        gap: 1,
        boxShadow: '0 -2px 8px rgba(0,0,0,.2)',
      }}
    >
      <Typography variant="body2" sx={{ flex: 1 }}>
        {t('pwa.iosInstallBanner')}
      </Typography>
      <IconButton
        size="small"
        onClick={dismiss}
        aria-label={t('pwa.dismiss')}
        sx={{ color: 'white', flexShrink: 0 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
