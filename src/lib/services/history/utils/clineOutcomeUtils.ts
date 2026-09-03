import type { ToolOutcome, ToolStatus } from '../types';

export interface ClineResults {
  readonly text: string;
  readonly outcomes: readonly ToolOutcome[];
}

/*
 * The marker Cline writes at the head of a tool result. The quoted argument is
 * matched greedily rather than up to the first quote, because a shell command
 * quotes its own arguments and Cline does not escape them. The `for` clause is
 * optional because attempt_completion reports without one.
 */
const RESULT_MARKER = /^\[[^\s\]]+(?: for '.*')?\] Result:/gmu;

// formatResponse.toolError and toolDenied, the only two failures Cline reports as result text.
const FAILURES = [
  'The tool execution failed with the following error:',
  'The user denied this operation.',
];

const statusOf = (body: string): ToolStatus => {
  return FAILURES.some((prefix) => {
    return body.startsWith(prefix);
  })
    ? 'error'
    : 'ok';
};

/**
 * Splits a Cline user message into the words the person typed and the tool
 * results the extension appended, pairing the results with the calls of the
 * assistant turn above in order, because Cline carries no id back from a call.
 */
export const clineOutcomes = (text: string, callIds: readonly string[]): ClineResults => {
  const markers = [...text.matchAll(RESULT_MARKER)];

  return {
    text: text.slice(0, markers[0]?.index ?? text.length).trim(),
    outcomes: markers.flatMap((marker, index) => {
      const toolUseId = callIds[index];
      const ends = markers[index + 1]?.index ?? text.length;
      const body = text.slice(marker.index + marker[0].length, ends).trim();

      return toolUseId == null
        ? []
        : [{
            toolUseId,
            status: statusOf(body),
            text: body,
            images: [],
          }];
    }),
  };
};
