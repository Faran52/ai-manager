import remarkParse from 'remark-parse';
import { unified } from 'unified';

const processor = unified().use(remarkParse);

/*
 * The block constructs that mark text as a document rather than prose that
 * happens to hold punctuation. GFM is not loaded on purpose: a pipe-and-dash
 * grid in tool output must not read as a table. Inline emphasis or a lone code
 * span never counts, so a log line with one asterisk stays raw. Every block
 * construct sits at the root, so the top level is the whole search.
 */
const BLOCK_TYPES: ReadonlySet<string> = new Set([
  'heading',
  'code',
  'blockquote',
  'thematicBreak',
]);

export const hasMarkdownMarkup = (text: string): boolean => {
  let listItems = 0;

  for (const node of processor.parse(text).children) {
    if (BLOCK_TYPES.has(node.type)) {
      return true;
    }

    if (node.type === 'list') {
      listItems += node.children.length;
    }
  }

  // A single "- item" line is a dash, not a list.
  return listItems >= 2;
};
