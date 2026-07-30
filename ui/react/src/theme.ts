import { createTheme, Theme } from '@mui/material';
import { bgBG, ruRU, enUS, Localization } from '@mui/material/locale';

const baseOptions = {
  palette: {
    primary: { main: '#2e6b4f' },
    background: { default: '#f5f5f0' },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
};

function muiLocaleFor(lang: string): Localization {
  if (lang.startsWith('ru')) return ruRU;
  if (lang.startsWith('en')) return enUS;
  return bgBG;
}

export function makeTheme(lang: string): Theme {
  return createTheme(baseOptions, muiLocaleFor(lang));
}
