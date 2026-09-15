import {
  describe,
  expect,
  test,
} from 'vitest';

import { decodeCodexTool } from './codexToolCallUtils';

const patchLiteral = (...lines: readonly string[]): string => {
  return `const patch = "${['*** Begin Patch', ...lines, '*** End Patch'].join('\\n')}";`;
};

describe('decodeCodexTool exec', () => {
  test('reads a quoted or unquoted cmd field into a Bash call', () => {
    const quoted = decodeCodexTool('exec', 'const r = await tools.exec_command({"cmd":"pnpm check"});', 'c1');
    const bare = decodeCodexTool(
      'exec',
      'const r = await tools.exec_command({cmd:"git status", workdir:"/repo"});',
      'c2',
    );

    expect(quoted.call).toMatchObject({
      id: 'c1',
      name: 'Bash',
      input: {
        kind: 'bash',
        command: 'pnpm check',
      },
    });
    expect(bare.call.input).toMatchObject({
      kind: 'bash',
      command: 'git status',
    });
  });

  test('joins the commands run under a Promise.all', () => {
    const source = 'const results = await Promise.all(['
      + 'tools.exec_command({cmd:"pnpm lint"}),'
      + 'tools.exec_command({cmd:"pnpm test"})]);';
    const decoded = decodeCodexTool('exec', source, 'c3');

    expect(decoded.call.input).toMatchObject({
      kind: 'bash',
      command: 'pnpm lint\npnpm test',
    });
  });

  test('keeps an empty Bash call for an exec it cannot read a command from', () => {
    const noValue = decodeCodexTool('exec', 'await tools.exec_command({cmd: shellVar});', 'c4');
    const noArgs = decodeCodexTool('exec', 'await tools.exec_command();', 'c5');
    const unterminated = decodeCodexTool('exec', 'await tools.exec_command({cmd:"oops', 'c6');

    for (const decoded of [noValue, noArgs, unterminated]) {
      expect(decoded.call.input).toEqual({
        kind: 'bash',
        command: '',
        description: undefined,
      });
    }
  });

  test('unescapes quotes and backslashes inside a command', () => {
    const decoded = decodeCodexTool('exec', 'await tools.exec_command({cmd:"echo \\"hi\\" > a\\\\b"});', 'c7');

    expect(decoded.call.input).toMatchObject({
      kind: 'bash',
      command: 'echo "hi" > a\\b',
    });
  });

  test('reads the command out of a bracketed shell argument, closed or not', () => {
    const closed = decodeCodexTool('shell', '{"command":["bash","-lc","pwd"]}', 's1');
    const open = decodeCodexTool('local_shell', '{"command":["bash","-lc","ls -a"', 's2');

    expect(closed.call.input).toMatchObject({
      kind: 'bash',
      command: 'pwd',
    });
    expect(open.call.input).toMatchObject({
      kind: 'bash',
      command: 'ls -a',
    });
  });
});

describe('decodeCodexTool apply_patch', () => {
  test('turns a single-file patch into a file edit carrying its diff', () => {
    const decoded = decodeCodexTool('exec', patchLiteral(
      '*** Update File: /repo/src/dncr.ts',
      '@@',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
    ) + '\nawait tools.apply_patch({patch});', 'p1');

    expect(decoded.call).toMatchObject({
      name: 'apply_patch',
      input: {
        kind: 'file-edit',
        path: '/repo/src/dncr.ts',
      },
    });
    expect(decoded.changed).toEqual([{
      path: '/repo/src/dncr.ts',
      added: false,
    }]);
    expect(decoded.patch?.[0]?.lines).toEqual([' const a = 1;', '-const b = 2;', '+const b = 3;']);
    expect(decoded.patch?.[0]?.file).toBeUndefined();
  });

  test('marks an added file and keeps every plus line', () => {
    const decoded = decodeCodexTool('exec', patchLiteral('*** Add File: /repo/New.tsx', '+one', '+two'), 'p2');

    expect(decoded.changed).toEqual([{
      path: '/repo/New.tsx',
      added: true,
    }]);
    expect(decoded.patch?.[0]).toMatchObject({
      newLines: 2,
      oldLines: 0,
    });
  });

  test('carries no diff for a delete-only patch', () => {
    const decoded = decodeCodexTool('exec', patchLiteral('*** Delete File: /repo/gone.ts'), 'p3');

    expect(decoded.patch).toBeUndefined();
    expect(decoded.changed).toEqual([{
      path: '/repo/gone.ts',
      added: false,
    }]);
  });

  test('lists every file when a patch spans more than one', () => {
    const decoded = decodeCodexTool('exec', patchLiteral(
      '*** Update File: /repo/a.ts',
      '+added to a',
      '*** Update File: /repo/b.ts',
      '-gone from b',
    ), 'p4');

    expect(decoded.call.input).toMatchObject({
      kind: 'generic',
      title: 'apply_patch',
      rows: [
        {
          label: 'update',
          value: 'a.ts',
        },
        {
          label: 'update',
          value: 'b.ts',
        },
      ],
    });
    expect(decoded.changed).toEqual([
      {
        path: '/repo/a.ts',
        added: false,
      },
      {
        path: '/repo/b.ts',
        added: false,
      },
    ]);
    expect(decoded.patch?.map((hunk) => {
      return hunk.file;
    })).toEqual(['/repo/a.ts', '/repo/b.ts']);
  });

  test('reads a patch that was not written as a string literal', () => {
    const withEnd = ['*** Begin Patch', '*** Add File: /repo/raw.ts', '+line', '*** End Patch'].join('\n');
    const truncated = ['*** Begin Patch', '*** Add File: /repo/cut.ts', '+half'].join('\n');

    expect(decodeCodexTool('exec', `apply_patch(${withEnd})`, 'p5').call).toMatchObject({
      input: {
        kind: 'file-edit',
        path: '/repo/raw.ts',
      },
    });
    expect(decodeCodexTool('exec', truncated, 'p6').patch?.[0]?.lines).toEqual(['+half']);
  });
});

describe('decodeCodexTool other helpers', () => {
  test('routes an mcp helper to a server and tool identity', () => {
    const decoded = decodeCodexTool(
      'exec',
      'const r = await tools.mcp__node_repl__js({"title":"Load guidance","code":`x`});',
      'm1',
    );

    expect(decoded.call).toMatchObject({
      name: 'js',
      serverName: 'node_repl',
      input: {
        kind: 'generic',
        rows: [{
          label: 'title',
          value: 'Load guidance',
        }],
      },
    });
  });

  test('handles an mcp helper with no tool segment', () => {
    const decoded = decodeCodexTool('exec', 'await tools.mcp__linear({"query":"open"});', 'm2');

    expect(decoded.call).toMatchObject({
      name: 'linear',
      serverName: 'linear',
    });
  });

  test('reads update_plan into a checklist and tolerates a thin plan', () => {
    const full = decodeCodexTool(
      'exec',
      'await tools.update_plan({explanation:"go",plan:['
      + '{step:"Audit files",status:"completed"},'
      + '{description:"Ship it",status:"in_progress"},'
      + '{step:"",status:"pending"},'
      + '{note:"junk"},'
      + '{step:"No status yet"}]});',
      'u1',
    );
    const empty = decodeCodexTool('exec', 'await tools.update_plan({explanation:"nothing planned"});', 'u2');

    expect(full.call.input).toEqual({
      kind: 'todo-write',
      todos: [
        {
          content: 'Audit files',
          status: 'completed',
        },
        {
          content: 'Ship it',
          status: 'in_progress',
        },
        {
          content: 'No status yet',
          status: 'pending',
        },
      ],
    });
    expect(empty.call.input).toEqual({
      kind: 'todo-write',
      todos: [],
    });
  });

  test('gives an unrecognised helper a titled card with the fields it can read', () => {
    const decoded = decodeCodexTool(
      'exec',
      'const r = await tools.write_stdin({"session_id":"s7","session_id":"dup","path":"a\\\\b"});',
      'w1',
    );

    expect(decoded.call).toMatchObject({
      name: 'write_stdin',
      input: {
        kind: 'generic',
        title: 'write_stdin',
        rows: [
          {
            label: 'session_id',
            value: 's7',
          },
          {
            label: 'path',
            value: 'a\\b',
          },
        ],
      },
    });
  });

  test('names an opaque call by whatever it can find', () => {
    const named = decodeCodexTool('some_native_tool', '{}', 'o1');
    const nameless = decodeCodexTool(undefined, undefined, 'o2');

    expect(named.call).toMatchObject({
      name: 'some_native_tool',
      input: {
        kind: 'generic',
        rows: [],
      },
    });
    expect(nameless.call.name).toBe('tool');
  });

  test('handles the older JSON function_call shape', () => {
    const shell = decodeCodexTool('shell', '{"command":"pwd"}', 'f1');
    const wait = decodeCodexTool('wait', '{"cell_id":"16"}', 'f2');

    expect(shell.call.input).toMatchObject({
      kind: 'bash',
      command: 'pwd',
    });
    expect(wait.call).toMatchObject({
      name: 'wait',
      input: {
        kind: 'generic',
        rows: [{
          label: 'cell_id',
          value: '16',
        }],
      },
    });
  });
});
