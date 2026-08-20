import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { copyTextToClipboard, saveTextFile } from './browserFilesUtils';

describe('saveTextFile', () => {
  test('creates a blob link, clicks and revokes it', () => {
    const createObjectURL = vi.fn(() => {
      return 'blob:x';
    });
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      return undefined;
    });

    saveTextFile('notes.md', '# hi', 'text/markdown');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');

    clickSpy.mockRestore();
  });
});

describe('copyTextToClipboard', () => {
  test('reports success from the clipboard API', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn() } });

    await expect(copyTextToClipboard('x')).resolves.toBe(true);
  });

  test('reports failure when the clipboard rejects', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(() => {
          throw new Error('denied');
        }),
      },
    });

    await expect(copyTextToClipboard('x')).resolves.toBe(false);
  });
});
