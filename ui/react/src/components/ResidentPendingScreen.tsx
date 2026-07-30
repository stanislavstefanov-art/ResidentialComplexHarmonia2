import React, { useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useTranslation } from 'react-i18next';

interface Props {
  onCheckAgain: () => Promise<void>;
  onSignOut: () => void;
}

export default function ResidentPendingScreen({ onCheckAgain, onSignOut }: Props) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      await onCheckAgain();
    } finally {
      setChecking(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 12, gap: 2 }}>
      <HomeIcon sx={{ fontSize: 48, color: 'primary.main' }} />
      <Typography variant="h5" sx={{ fontWeight: 700 }} data-testid="pending-heading">
        {t('residentPending.heading')}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 480, textAlign: 'center' }}
        data-testid="pending-body"
      >
        {t('residentPending.body')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleCheckAgain}
          disabled={checking}
          data-testid="check-again-btn"
          startIcon={checking ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t('residentPending.checkAgain')}
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={onSignOut}
          data-testid="sign-out-btn"
        >
          {t('residentPending.signOut')}
        </Button>
      </Box>
    </Box>
  );
}
