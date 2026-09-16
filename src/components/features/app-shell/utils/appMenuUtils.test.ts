import { expect, test } from 'vitest';

import { applicationMenu } from './appMenuUtils';

// The key back, so a label proves which string the menu asked for.
const label = (key: string): string => {
  return `<${key}>`;
};

const sectionLabels = (items: readonly Deno.MenuItem[]): readonly string[] => {
  return items.flatMap((item) => {
    return typeof item === 'object' && 'submenu' in item ? [item.submenu.label] : [];
  });
};

const sectionItems = (
  items: readonly Deno.MenuItem[],
  name: string,
): readonly Deno.MenuItem[] => {
  const found = items.find((item) => {
    return typeof item === 'object' && 'submenu' in item && item.submenu.label === name;
  });

  return found != null && typeof found === 'object' && 'submenu' in found
    ? found.submenu.items
    : [];
};

const idsIn = (items: readonly Deno.MenuItem[]): readonly string[] => {
  return items.flatMap((item) => {
    return typeof item === 'object' && 'item' in item && item.item.id != null
      ? [item.item.id]
      : [];
  });
};

test('names every section in the language the page is reading', () => {
  expect(sectionLabels(applicationMenu(label))).toEqual([
    'AI Manager',
    '<menuEdit>',
    '<menuView>',
    '<menuWindow>',
    '<menuHelp>',
  ]);
});

test('says the same words the rail and the shortcut sheet already use', () => {
  const menu = applicationMenu(label);

  expect(idsIn(sectionItems(menu, 'AI Manager'))).toEqual(['about', 'settings']);
  expect(idsIn(sectionItems(menu, '<menuView>'))).toEqual([
    'viewSessions',
    'viewAnalytics',
    'viewHealth',
    'viewArchive',
    'reload',
  ]);
});

test('leaves cut, copy and paste to the roles a webview needs them from', () => {
  const edit = sectionItems(applicationMenu(label), '<menuEdit>');
  const roles = edit.flatMap((item) => {
    return typeof item === 'object' && 'role' in item ? [item.role.role] : [];
  });

  expect(roles).toEqual(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']);
});

test('carries an accelerator only where one belongs', () => {
  const app = sectionItems(applicationMenu(label), 'AI Manager');
  const byId = (id: string): Deno.MenuItem | undefined => {
    return app.find((item) => {
      return typeof item === 'object' && 'item' in item && item.item.id === id;
    });
  };

  expect(byId('settings')).toEqual({
    item: {
      label: '<navSettings>',
      id: 'settings',
      enabled: true,
      accelerator: 'CmdOrCtrl+,',
    },
  });
  expect(byId('about')).toEqual({
    item: {
      label: '<settingsAbout>',
      id: 'about',
      enabled: true,
    },
  });
});
