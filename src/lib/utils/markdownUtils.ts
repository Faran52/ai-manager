interface CellSpan {
  readonly start: number;
  readonly end: number;
}

/*
 * Line-anchored patterns rather than a full parse: this only gates whether the
 * Parsed / Raw card appears, so a borderline hit costs a toggle, not
 * correctness. GFM tables are absent so a pipe grid in output is not a table.
 */
const HEADING = /^ {0,3}#{1,6}[ \t]/mu;
const BLOCKQUOTE = /^ {0,3}> /mu;
const THEMATIC_BREAK = /^ {0,3}(?:[-*_][ \t]*){3,}$/mu;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]/gmu;

// A fenced code block. Also the delimiter normalizeBoxDrawing wraps a grid in.
const FENCE = /^ {0,3}(?:`{3,}|~{3,})/mu;

// U+2500-U+257F Box Drawing (┌ ─ ┬ ┐ │ ├ ┼ ┤ └ ┴ ┘) and U+2580-U+259F Block
// Elements (█ ▀ ▄ ░ ▒ ▓). Em dashes and arrows sit outside this, so prose is safe.
const BOX_ART = /[─-▟]/u;

// A box-drawing table: a line opening with a top-left corner of any weight.
const BOX_TABLE = /^[ \t]*[┌╔╭┏╒╓]/mu;

/*
 * An attached-file envelope: <path>, <type> and <content> tags, the body often
 * line-numbered. FILE_REF tests the shape, FILE_REF_PARTS carves it.
 */
const FILE_REF = /<path>[^\n<]+<\/path>\s*<type>[^\n<]*<\/type>\s*<content>[\s\S]*?<\/content>/u;
const FILE_REF_PARTS = /<path>([^\n<]+)<\/path>\s*<type>[^\n<]*<\/type>\s*<content>\n?([\s\S]*?)\n?<\/content>/gu;
const LINE_GUTTER = /^ *\d+:[ \t]?/gmu;
const MARKDOWN_FILE = /\.(?:markdown|mdx?)$/iu;

/*
 * The pieces of a box-drawing grid, split by the job each does when the grid is
 * rewritten as a GFM table: the vertical rule, the connector a rule crosses a
 * border at, and a full border line (dashes and connectors, nothing else).
 */
const V_RULE = /[│┃║╎╏]/u;
const CONNECTOR = /[┌┬┐├┼┤└┴┘╔╦╗╠╬╣╚╩╝┏┳┓┣╋┫┗┻┛╤╧╪╞╡╭╮╰╯]/u;
const BORDER_LINE = /^[\s─━┄┅┈┉╌╍═╾╼┌┬┐├┼┤└┴┘╔╦╗╠╬╣╚╩╝┏┳┓┣╋┫┗┻┛╤╧╪╞╡╭╮╰╯]+$/u;

export const hasMarkdownMarkup = (text: string): boolean => {
  if (
    HEADING.test(text)
    || FENCE.test(text)
    || BLOCKQUOTE.test(text)
    || THEMATIC_BREAK.test(text)
    || BOX_TABLE.test(text)
    || FILE_REF.test(text)
  ) {
    return true;
  }

  // A single "- item" line is a dash, not a list.
  return (text.match(LIST_ITEM) ?? []).length >= 2;
};

/*
 * A markdown file renders as itself; any other file is fenced so its own
 * punctuation does not become markup. remark has no construct for the envelope.
 */
export const unwrapFileRefs = (text: string): string => {
  return text.replace(FILE_REF_PARTS, (_match, rawPath: string, rawBody: string) => {
    const path = rawPath.trim();
    const body = rawBody.replace(LINE_GUTTER, '').trim();

    return MARKDOWN_FILE.test(path)
      ? `\`${path}\`\n\n${body}`
      : `\`${path}\`\n\n\`\`\`\n${body}\n\`\`\``;
  });
};

/**
 * A block whose alignment depends on a monospace grid: a box-drawing table, a
 * file tree. The renderer keeps it out of the syntax highlighter and lets it
 * scroll rather than wrap.
 */
export const isBoxArt = (text: string): boolean => {
  return BOX_ART.test(text);
};

const isBorderLine = (line: string): boolean => {
  return line.trim() !== '' && BORDER_LINE.test(line);
};

// Column bounds read from the connector positions on a border line. A stray │
// inside cell text is not a connector there, so it cannot open a column.
const columnSpans = (border: string): CellSpan[] => {
  const spans: CellSpan[] = [];
  let opened = -1;

  for (let col = 0; col < border.length; col += 1) {
    if (!CONNECTOR.test(border.charAt(col))) {
      continue;
    }

    if (opened >= 0) {
      spans.push({
        start: opened + 1,
        end: col,
      });
    }

    opened = col;
  }

  return spans;
};

// The content lines between two border lines, each band a group of raw rows.
const bandsOf = (lines: readonly string[]): string[][] => {
  const bands: string[][] = [];
  let band: string[] = [];

  const flush = (): void => {
    if (band.length > 0) {
      bands.push(band);
      band = [];
    }
  };

  for (const line of lines) {
    if (isBorderLine(line)) {
      flush();
    }
    else if (V_RULE.test(line)) {
      band.push(line);
    }
  }

  flush();

  return bands;
};

// One row of cells: slice each raw line at the column bounds, then join the
// stack per column so a cell that wrapped over several lines reads as one.
const mergeBand = (lines: readonly string[], spans: readonly CellSpan[]): string[] => {
  const grid = lines.map((line) => {
    return spans.map((span) => {
      return line.slice(span.start, span.end).trim();
    });
  });

  return Array.from({ length: spans.length }, (_unused, col) => {
    const column = grid.map((cells) => {
      return cells[col];
    }).filter(Boolean);

    return column.join(' ');
  });
};

const toGfmRows = (rows: readonly string[][], columns: number): string => {
  const toRow = (cells: readonly string[]): string => {
    const filled = cells.map((cell) => {
      return cell.replace(/\|/gu, '\\|').replace(/\s+/gu, ' ');
    });

    return `| ${filled.join(' | ')} |`;
  };

  const divider = toRow(Array.from({ length: columns }, () => {
    return '---';
  }));

  return [
    ...rows.slice(0, 1).map(toRow),
    divider,
    ...rows.slice(1).map(toRow),
  ].join('\n');
};

/*
 * Null for anything that is not a grid of two or more rows and columns.
 * ponytail: a run of content lines between two rules is one row whose cells
 * wrapped, so a table ruling only its header merges its body rows.
 */
const boxTableToGfm = (lines: readonly string[]): string | null => {
  const width = Math.max(...lines.map((line) => {
    return line.length;
  }));
  const padded = lines.map((line) => {
    return line.padEnd(width);
  });
  const border = padded.find(isBorderLine);

  if (border === undefined) {
    return null;
  }

  const spans = columnSpans(border);

  if (spans.length < 2) {
    return null;
  }

  const ruledEveryRow = padded.filter(isBorderLine).length > 2;
  const bands = bandsOf(padded);
  const grouped = ruledEveryRow
    ? bands
    : bands.flatMap((band) => {
        return band.map((line) => {
          return [line];
        });
      });
  const rows = grouped.map((band) => {
    return mergeBand(band, spans);
  });

  if (rows.length < 2) {
    return null;
  }

  return toGfmRows(rows, spans.length);
};

/*
 * Box-drawing lines up only in a monospace font and remark has no construct for
 * it. A grid becomes a GFM table; a file tree or loose box art is fenced so the
 * code path keeps its alignment. A run already inside a fence is left be.
 */
export const normalizeBoxDrawing = (text: string): string => {
  const out: string[] = [];
  let run: string[] = [];
  let insideFence = false;

  const flush = (): void => {
    if (run.length > 1) {
      const table = boxTableToGfm(run);

      out.push(...(table === null ? ['```', ...run, '```'] : ['', table, '']));
    }
    else {
      out.push(...run);
    }

    run = [];
  };

  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      flush();
      insideFence = !insideFence;
      out.push(line);
    }
    else if (!insideFence && BOX_ART.test(line)) {
      run.push(line);
    }
    else {
      flush();
      out.push(line);
    }
  }

  flush();

  return out.join('\n');
};
