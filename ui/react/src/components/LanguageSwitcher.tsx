import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemText } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, Lang } from '../i18n';

const LABELS: Record<Lang, string> = {
  bg: 'Български',
  ru: 'Русский',
  en: 'English',
};

interface Props { color?: string; }

const LanguageSwitcher: React.FC<Props> = ({ color }) => {
  const { i18n, t } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const current = (i18n.language.split('-')[0] as Lang) || 'bg';

  const choose = (lang: Lang) => {
    i18n.changeLanguage(lang);
    setAnchor(null);
  };

  return (
    <>
      <IconButton
        aria-label={t('app.changeLanguage')}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: color ?? 'inherit' }}
        size="small"
      >
        <LanguageIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {SUPPORTED_LANGS.map((lang) => (
          <MenuItem key={lang} selected={lang === current} onClick={() => choose(lang)}>
            <ListItemText>{LABELS[lang]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageSwitcher;
