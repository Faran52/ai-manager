import { expect, test } from 'vitest';

import { clineOutcomes } from './clineOutcomeUtils';

const REAL = `[list_files for '/Users/me/Desktop'] Result:
.DS_Store
Claims/
[execute_command for 'jq '.projects | keys' ~/.claude.json | head -20'] Result:
Command executed.
Output:
one`;

test('pairs each result with the call that ran it and keeps its output', () => {
  expect(clineOutcomes(REAL, ['turn-0', 'turn-1'])).toEqual({
    text: '',
    outcomes: [
      {
        toolUseId: 'turn-0',
        status: 'ok',
        text: '.DS_Store\nClaims/',
        images: [],
      },
      {
        toolUseId: 'turn-1',
        status: 'ok',
        text: 'Command executed.\nOutput:\none',
        images: [],
      },
    ],
  });
});

test('reads a result reported without the argument clause', () => {
  const results = clineOutcomes('[attempt_completion] Result: Done', ['turn-0']);

  expect(results.outcomes[0]?.text).toBe('Done');
});

test('marks a failed call as an error and a refused one too', () => {
  const failure = 'The tool execution failed with the following error:\n<error>\nno such file\n</error>';
  const failed = clineOutcomes(`[read_file for 'missing.ts'] Result:\n${failure}`, ['turn-0']);
  const denied = clineOutcomes(
    "[execute_command for 'rm -rf /'] Result:\nThe user denied this operation.",
    ['turn-0'],
  );

  expect(failed.outcomes[0]?.status).toBe('error');
  expect(denied.outcomes[0]?.status).toBe('error');
});

test('keeps what the person typed and drops nothing when no result was appended', () => {
  expect(clineOutcomes('now write the tests\n', [])).toEqual({
    text: 'now write the tests',
    outcomes: [],
  });
});

test('keeps feedback typed above a result out of the result body', () => {
  const results = clineOutcomes("stop there\n[list_files for '.'] Result:\nsrc/", ['turn-0']);

  expect(results.text).toBe('stop there');
  expect(results.outcomes[0]?.text).toBe('src/');
});

test('drops a result that no call in the turn above can account for', () => {
  const results = clineOutcomes(REAL, ['turn-0']);

  expect(results.outcomes.map((outcome) => {
    return outcome.toolUseId;
  })).toEqual(['turn-0']);
});
