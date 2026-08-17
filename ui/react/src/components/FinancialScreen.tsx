import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import IncomeTab from './financial/IncomeTab';
import OutcomeTab from './financial/OutcomeTab';
import ReportTab from './financial/ReportTab';
import ResidentFinancial from './financial/ResidentFinancial';

interface Props { role: 'resident' | 'admin'; }
type FinTab = 'income' | 'outcome' | 'report';

export default function FinancialScreen({ role }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FinTab>('income');

  if (role !== 'admin') return <ResidentFinancial />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label={t('finance.tabIncome')} value="income" />
        <Tab label={t('finance.tabOutcome')} value="outcome" />
        <Tab label={t('finance.tabReport')} value="report" />
      </Tabs>
      {tab === 'income' && <IncomeTab />}
      {tab === 'outcome' && <OutcomeTab />}
      {tab === 'report' && <ReportTab />}
    </Box>
  );
}
