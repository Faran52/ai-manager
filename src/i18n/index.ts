import { initReactI18next } from 'react-i18next';

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { languageStorageKey } from '@config/storageKeys';

import {
  directionOf,
  fallbackLanguage,
  languages,
} from './config';
import arAnalytics from './locales/ar/analytics.json';
import arArchive from './locales/ar/archive.json';
import arBoard from './locales/ar/board.json';
import arCommon from './locales/ar/common.json';
import arSession from './locales/ar/session.json';
import arSettings from './locales/ar/settings.json';
import arSetup from './locales/ar/setup.json';
import arSidebar from './locales/ar/sidebar.json';
import arUpdate from './locales/ar/update.json';
import enAnalytics from './locales/en/analytics.json';
import enArchive from './locales/en/archive.json';
import enBoard from './locales/en/board.json';
import enCommon from './locales/en/common.json';
import enSession from './locales/en/session.json';
import enSettings from './locales/en/settings.json';
import enSetup from './locales/en/setup.json';
import enSidebar from './locales/en/sidebar.json';
import enUpdate from './locales/en/update.json';
import jaAnalytics from './locales/ja/analytics.json';
import jaArchive from './locales/ja/archive.json';
import jaBoard from './locales/ja/board.json';
import jaCommon from './locales/ja/common.json';
import jaSession from './locales/ja/session.json';
import jaSettings from './locales/ja/settings.json';
import jaSetup from './locales/ja/setup.json';
import jaSidebar from './locales/ja/sidebar.json';
import jaUpdate from './locales/ja/update.json';
import koAnalytics from './locales/ko/analytics.json';
import koArchive from './locales/ko/archive.json';
import koBoard from './locales/ko/board.json';
import koCommon from './locales/ko/common.json';
import koSession from './locales/ko/session.json';
import koSettings from './locales/ko/settings.json';
import koSetup from './locales/ko/setup.json';
import koSidebar from './locales/ko/sidebar.json';
import koUpdate from './locales/ko/update.json';
import cnAnalytics from './locales/zh-CN/analytics.json';
import cnArchive from './locales/zh-CN/archive.json';
import cnBoard from './locales/zh-CN/board.json';
import cnCommon from './locales/zh-CN/common.json';
import cnSession from './locales/zh-CN/session.json';
import cnSettings from './locales/zh-CN/settings.json';
import cnSetup from './locales/zh-CN/setup.json';
import cnSidebar from './locales/zh-CN/sidebar.json';
import cnUpdate from './locales/zh-CN/update.json';
import twAnalytics from './locales/zh-TW/analytics.json';
import twArchive from './locales/zh-TW/archive.json';
import twBoard from './locales/zh-TW/board.json';
import twCommon from './locales/zh-TW/common.json';
import twSession from './locales/zh-TW/session.json';
import twSettings from './locales/zh-TW/settings.json';
import twSetup from './locales/zh-TW/setup.json';
import twSidebar from './locales/zh-TW/sidebar.json';
import twUpdate from './locales/zh-TW/update.json';

const bundle = (
  analytics: typeof enAnalytics,
  archive: typeof enArchive,
  board: typeof enBoard,
  common: typeof enCommon,
  session: typeof enSession,
  settings: typeof enSettings,
  setup: typeof enSetup,
  sidebar: typeof enSidebar,
  update: typeof enUpdate,
) => {
  return {
    analytics,
    archive,
    board,
    common,
    session,
    settings,
    setup,
    sidebar,
    update,
  };
};

export const resources = {
  'en': bundle(enAnalytics, enArchive, enBoard, enCommon, enSession, enSettings, enSetup, enSidebar, enUpdate),
  'ar': bundle(arAnalytics, arArchive, arBoard, arCommon, arSession, arSettings, arSetup, arSidebar, arUpdate),
  'ja': bundle(jaAnalytics, jaArchive, jaBoard, jaCommon, jaSession, jaSettings, jaSetup, jaSidebar, jaUpdate),
  'ko': bundle(koAnalytics, koArchive, koBoard, koCommon, koSession, koSettings, koSetup, koSidebar, koUpdate),
  'zh-CN': bundle(cnAnalytics, cnArchive, cnBoard, cnCommon, cnSession, cnSettings, cnSetup, cnSidebar, cnUpdate),
  'zh-TW': bundle(twAnalytics, twArchive, twBoard, twCommon, twSession, twSettings, twSetup, twSidebar, twUpdate),
};

export const applyDocumentDirection = (language: string): void => {
  const root = document.documentElement;

  root.lang = language;
  root.dir = directionOf(language);
};

export const initI18n = (): typeof i18next => {
  if (!i18next.isInitialized) {
    void i18next
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources,
        fallbackLng: fallbackLanguage,
        supportedLngs: languages.map((option) => {
          return option.id;
        }),
        defaultNS: 'common',
        interpolation: { escapeValue: false },
        detection: {
          order: ['localStorage', 'navigator'],
          /*
           * Nothing is written here. Storing what was merely detected would
           * make every first visit look like a decision, and the reader could
           * never get back to following their own system.
           */
          caches: [],
          lookupLocalStorage: languageStorageKey,
        },
      });

    applyDocumentDirection(i18next.language);
    i18next.on('languageChanged', applyDocumentDirection);
  }

  return i18next;
};

export {
  directionOf,
  fallbackLanguage,
  labelOf,
  languages,
} from './config';
