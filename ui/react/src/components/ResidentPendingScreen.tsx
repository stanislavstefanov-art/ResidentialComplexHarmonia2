import React, { useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

interface Props {
  onCheckAgain: () => Promise<void>;
  onSignOut: () => void;
}

export default function ResidentPendingScreen({ onCheckAgain, onSignOut }: Props) {
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
        Account pending approval
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 480, textAlign: 'center' }}
        data-testid="pending-body"
      >
        Your account registration is complete, but a building administrator needs to approve it
        before you can access the portal. This usually takes up to 24 hours.
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
          Check again
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={onSignOut}
          data-testid="sign-out-btn"
        >
          Sign out
        </Button>
      </Box>
    </Box>
  );
}
