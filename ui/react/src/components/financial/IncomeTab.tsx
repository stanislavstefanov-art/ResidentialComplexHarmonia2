import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FeesTab from './FeesTab';
import PaymentsTab from './PaymentsTab';

type SubTab = 'charged' | 'received';

export default function IncomeTab() {
  const { t } = useTranslation();
  const [sub, setSub] = useState<SubTab>('charged');

  return (
    <Box>
      <Tabs value={sub} onChange={(_, v) => setSub(v)} sx={{ mb: 2 }}>
        <Tab label={t('finance.subTabCharged')} value="charged" />
        <Tab label={t('finance.subTabReceived')} value="received" />
      </Tabs>
      {sub === 'charged' && <FeesTab />}
      {sub === 'received' && <PaymentsTab />}
    </Box>
  );
}
