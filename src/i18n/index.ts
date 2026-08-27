import { initReactI18next } from 'react-i18next';

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import {
  directionOf,
  fallbackLanguage,
  languages,
} from './config';
import arAnalytics from './locales/ar/analytics.json';
import arCommon from './locales/ar/common.json';
import arSession from './locales/ar/session.json';
import arSetup from './locales/ar/setup.json';
import arSidebar from './locales/ar/sidebar.json';
import arUpdate from './locales/ar/update.json';
import enAnalytics from './locales/en/analytics.json';
import enCommon from './locales/en/common.json';
import enSession from './locales/en/session.json';
import enSetup from './locales/en/setup.json';
import enSidebar from './locales/en/sidebar.json';
import enUpdate from './locales/en/update.json';
import jaAnalytics from './locales/ja/analytics.json';
import jaCommon from './locales/ja/common.json';
import jaSession from './locales/ja/session.json';
import jaSetup from './locales/ja/setup.json';
import jaSidebar from './locales/ja/sidebar.json';
import jaUpdate from './locales/ja/update.json';
import koAnalytics from './locales/ko/analytics.json';
import koCommon from './locales/ko/common.json';
import koSession from './locales/ko/session.json';
import koSetup from './locales/ko/setup.json';
import koSidebar from './locales/ko/sidebar.json';
import koUpdate from './locales/ko/update.json';
import cnAnalytics from './locales/zh-CN/analytics.json';
import cnCommon from './locales/zh-CN/common.json';
import cnSession from './locales/zh-CN/session.json';
import cnSetup from './locales/zh-CN/setup.json';
import cnSidebar from './locales/zh-CN/sidebar.json';
import cnUpdate from './locales/zh-CN/update.json';
import twAnalytics from './locales/zh-TW/analytics.json';
import twCommon from './locales/zh-TW/common.json';
import twSession from './locales/zh-TW/session.json';
import twSetup from './locales/zh-TW/setup.json';
import twSidebar from './locales/zh-TW/sidebar.json';
import twUpdate from './locales/zh-TW/update.json';

const bundle = (
  analytics: typeof enAnalytics,
  common: typeof enCommon,
  session: typeof enSession,
  setup: typeof enSetup,
  sidebar: typeof enSidebar,
  update: typeof enUpdate,
) => {
  return {
    analytics,
    common,
    session,
    setup,
    sidebar,
    update,
  };
};

export const resources = {
  'en': bundle(enAnalytics, enCommon, enSession, enSetup, enSidebar, enUpdate),
  'ar': bundle(arAnalytics, arCommon, arSession, arSetup, arSidebar, arUpdate),
  'ja': bundle(jaAnalytics, jaCommon, jaSession, jaSetup, jaSidebar, jaUpdate),
  'ko': bundle(koAnalytics, koCommon, koSession, koSetup, koSidebar, koUpdate),
  'zh-CN': bundle(cnAnalytics, cnCommon, cnSession, cnSetup, cnSidebar, cnUpdate),
  'zh-TW': bundle(twAnalytics, twCommon, twSession, twSetup, twSidebar, twUpdate),
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
          caches: ['localStorage'],
          lookupLocalStorage: 'ai-chat-manager-language',
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
