import type { HistoryEntry } from '@services/history/historyService';

const cleanPreview = (text: string): string => {
  return text.replace(/\s+/gu, ' ').trim();
};

// The one line the navigator shows for an entry: its first words, or the tool it called.
export const previewOf = (entry: HistoryEntry): string => {
  switch (entry.kind) {
    case 'user':
      return cleanPreview([entry.text, entry.command, entry.injectedText].find((value) => {
        return value != null && value.length > 0;
      }) ?? '');
    case 'assistant': {
      const block = entry.blocks.find((item) => {
        return item.blockType === 'text' || item.blockType === 'tool-use';
      });

      if (block?.blockType === 'text') {
        return cleanPreview(block.text);
      }

      return block?.blockType === 'tool-use' ? block.call.name : '';
    }
    case 'system':
    case 'summary':
      return cleanPreview(entry.text);
  }
};
