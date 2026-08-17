import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getCounterparties, CounterpartyDto } from '../../api/counterparties';

interface Props {
  value: CounterpartyDto | null;
  onChange: (cp: CounterpartyDto | null) => void;
}

export default function CounterpartyPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<CounterpartyDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCounterparties().then(setOptions).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Autocomplete
        options={options}
        loading={loading}
        value={value}
        onChange={(_, v) => onChange(v)}
        getOptionLabel={(o) => `${o.name} (${o.category})`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => (
          <TextField {...params} label={t('finance.counterpartyLabel')} required size="small" />
        )}
      />
      {value && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {value.category} / {value.parentCategory}
        </Typography>
      )}
    </Box>
  );
}
