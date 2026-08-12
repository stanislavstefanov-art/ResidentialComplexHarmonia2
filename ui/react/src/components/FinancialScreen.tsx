import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import BillsTab from './financial/BillsTab';
import FeesTab from './financial/FeesTab';
import PaymentsTab from './financial/PaymentsTab';
import ReportTab from './financial/ReportTab';
import ResidentFinancial from './financial/ResidentFinancial';

interface Props { role: 'resident' | 'admin'; }
type FinTab = 'bills' | 'fees' | 'payments' | 'report';

export default function FinancialScreen({ role }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FinTab>('bills');

  if (role !== 'admin') return <ResidentFinancial />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label={t('finance.tabBills')} value="bills" />
        <Tab label={t('finance.tabFees')} value="fees" />
        <Tab label={t('finance.tabPayments')} value="payments" />
        <Tab label={t('finance.tabReport')} value="report" />
      </Tabs>
      {tab === 'bills' && <BillsTab />}
      {tab === 'fees' && <FeesTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'report' && <ReportTab />}
    </Box>
  );
}
