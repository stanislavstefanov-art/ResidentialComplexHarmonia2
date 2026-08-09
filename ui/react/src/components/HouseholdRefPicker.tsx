import React from 'react';
import {
  Box, FormControl, IconButton, InputLabel, MenuItem, Select, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

type Building = 'X3' | 'X4';

interface ApartmentRow { building: Building; number: number; }

const APTS: Record<Building, number[]> = {
  X3: Array.from({ length: 19 }, (_, i) => i + 1),
  X4: Array.from({ length: 16 }, (_, i) => i + 1),
};

function buildRef(rows: ApartmentRow[]): string {
  if (rows.length === 0) return '';
  const grouped = new Map<Building, number[]>();
  [...rows]
    .sort((a, b) => a.building.localeCompare(b.building) || a.number - b.number)
    .forEach(r => {
      const nums = grouped.get(r.building) ?? [];
      nums.push(r.number);
      grouped.set(r.building, nums);
    });
  return Array.from(grouped.entries())
    .map(([b, nums]) => `${b} АП${nums.join('/')}`)
    .join(' / ');
}

interface Props {
  onChange: (ref: string) => void;
}

const HouseholdRefPicker: React.FC<Props> = ({ onChange }) => {
  const { t } = useTranslation();
  const [rows, setRows] = React.useState<ApartmentRow[]>([{ building: 'X3', number: 1 }]);

  React.useEffect(() => { onChange(buildRef(rows)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: ApartmentRow[]) => {
    setRows(next);
    onChange(buildRef(next));
  };

  const setBuilding = (idx: number, building: Building) => {
    const next = rows.map((r, i) =>
      i === idx ? { building, number: APTS[building][0] } : r,
    );
    update(next);
  };

  const setNumber = (idx: number, number: number) => {
    const next = rows.map((r, i) => i === idx ? { ...r, number } : r);
    update(next);
  };

  const addRow = () => update([...rows, { building: 'X3', number: 1 }]);

  const removeRow = (idx: number) => {
    if (rows.length === 1) return;
    update(rows.filter((_, i) => i !== idx));
  };

  const ref = buildRef(rows);

  return (
    <Box>
      {rows.map((row, idx) => (
        <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <InputLabel>{t('households.building')}</InputLabel>
            <Select
              value={row.building}
              label={t('households.building')}
              onChange={e => setBuilding(idx, e.target.value as Building)}
            >
              <MenuItem value="X3">X3</MenuItem>
              <MenuItem value="X4">X4</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <InputLabel>{t('households.apartment')}</InputLabel>
            <Select
              value={row.number}
              label={t('households.apartment')}
              onChange={e => setNumber(idx, Number(e.target.value))}
            >
              {APTS[row.building].map(n => (
                <MenuItem key={n} value={n}>АП{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {rows.length > 1 && (
            <IconButton size="small" onClick={() => removeRow(idx)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        <IconButton size="small" onClick={addRow} title={t('households.addApartment')}>
          <AddIcon fontSize="small" />
        </IconButton>
        {ref && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {ref}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default HouseholdRefPicker;
