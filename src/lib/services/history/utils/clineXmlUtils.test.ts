import { expect, test } from 'vitest';

import { parseClineBlocks } from './clineXmlUtils';

import type { AssistantBlock } from '../types';

const REAL = `I'll help you read the latest Claude Code session.

<list_files>
<path>/Users/me/Desktop</path>
<recursive>false</recursive>
<task_progress>
- [x] Locate the project directory
- [ ] Read the session content
</task_progress>
</list_files>

<execute_command>
<command>ls ~/.claude/projects/</command>
<requires_approval>false</requires_approval>
</execute_command>`;

const toolNames = (blocks: readonly AssistantBlock[]): readonly string[] => {
  return blocks.flatMap((block) => {
    return block.blockType === 'tool-use' ? [block.call.name] : [];
  });
};

test('splits one message into its prose and the calls it made', () => {
  const blocks = parseClineBlocks(REAL, 'turn');

  expect(blocks[0]).toEqual({
    blockType: 'text',
    text: "I'll help you read the latest Claude Code session.",
  });
  expect(toolNames(blocks)).toEqual(['list_files', 'task_progress', 'execute_command']);
});

test('reads a command out of the markup it was buried in', () => {
  const blocks = parseClineBlocks('<execute_command>\n<command>ls -la</command>\n</execute_command>', 'turn');

  expect(blocks).toEqual([{
    blockType: 'tool-use',
    call: {
      id: 'turn-0',
      name: 'execute_command',
      input: {
        kind: 'bash',
        command: 'ls -la',
        description: undefined,
      },
    },
  }]);
});

test('turns a progress checklist into todos, ticked or not', () => {
  const blocks = parseClineBlocks('<task_progress>\n- [x] done\n- [ ] pending\n</task_progress>', 'turn');

  expect(blocks[0]).toEqual({
    blockType: 'tool-use',
    call: {
      id: 'turn-0',
      name: 'task_progress',
      input: {
        kind: 'todo-write',
        todos: [
          {
            content: 'done',
            status: 'completed',
            activeForm: undefined,
          },
          {
            content: 'pending',
            status: 'pending',
            activeForm: undefined,
          },
        ],
      },
    },
  });
});

test('names the file a read or a write worked on', () => {
  const read = parseClineBlocks('<read_file>\n<path>src/a.ts</path>\n</read_file>', 'turn');
  const write = parseClineBlocks(
    '<write_to_file>\n<path>src/b.ts</path>\n<content>hi</content>\n</write_to_file>',
    'turn',
  );

  expect(read[0]).toMatchObject({
    call: {
      input: {
        kind: 'file-read',
        path: 'src/a.ts',
      },
    },
  });
  expect(write[0]).toMatchObject({
    call: {
      input: {
        kind: 'file-write',
        path: 'src/b.ts',
        content: 'hi',
      },
    },
  });
});

test('searches by the name Cline gives the pattern', () => {
  const blocks = parseClineBlocks('<search_files>\n<path>src</path>\n<regex>todo</regex>\n</search_files>', 'turn');

  expect(blocks[0]).toMatchObject({
    call: {
      input: {
        kind: 'search-files',
        tool: 'grep',
        pattern: 'todo',
        searchPath: 'src',
      },
    },
  });
});

test('leaves a tool it does not know as a row of what it was given', () => {
  const blocks = parseClineBlocks('<browser_action>\n<url>http://x.test</url>\n</browser_action>', 'turn');

  expect(blocks[0]).toMatchObject({
    call: {
      name: 'browser_action',
      input: {
        kind: 'generic',
        title: 'browser_action',
        rows: [{
          label: 'url',
          value: 'http://x.test',
        }],
      },
    },
  });
});

test('keeps prose that only looks like markup', () => {
  const blocks = parseClineBlocks('Wrap it in a <div>block</div> and ship.', 'turn');

  expect(blocks).toEqual([{
    blockType: 'text',
    text: 'Wrap it in a <div>block</div> and ship.',
  }]);
});

test('keeps text around an unclosed tag rather than eating it', () => {
  const blocks = parseClineBlocks('before <execute_command> after', 'turn');

  expect(blocks).toEqual([{
    blockType: 'text',
    text: 'before <execute_command> after',
  }]);
});

test('reads a message that is prose and nothing else', () => {
  expect(parseClineBlocks('Just talking.', 'turn')).toEqual([{
    blockType: 'text',
    text: 'Just talking.',
  }]);
});

test('drops a progress block that lists nothing', () => {
  expect(parseClineBlocks('<task_progress>\n\n</task_progress>', 'turn')).toEqual([]);
});

test('gives every call in a message its own id', () => {
  const blocks = parseClineBlocks(
    '<execute_command>\n<command>a</command>\n</execute_command>\n'
    + '<execute_command>\n<command>b</command>\n</execute_command>',
    'turn',
  );

  expect(blocks.flatMap((block) => {
    return block.blockType === 'tool-use' ? [block.call.id] : [];
  })).toEqual(['turn-0', 'turn-1']);
});

test('stops at an angle bracket that never closes', () => {
  expect(parseClineBlocks('a < b and nothing after', 'turn')).toEqual([{
    blockType: 'text',
    text: 'a < b and nothing after',
  }]);
});

test('reads the diff a replace was given as its content', () => {
  const blocks = parseClineBlocks(
    '<replace_in_file>\n<path>src/a.ts</path>\n<diff>one</diff>\n</replace_in_file>',
    'turn',
  );

  expect(blocks[0]).toMatchObject({
    call: {
      name: 'replace_in_file',
      input: {
        kind: 'generic',
        rows: [
          {
            label: 'file',
            value: 'src/a.ts',
          },
          {
            label: 'content',
            value: 'one',
          },
        ],
      },
    },
  });
});

test('reads the question a follow-up asks and the result a completion reports', () => {
  const asked = parseClineBlocks(
    '<ask_followup_question>\n<question>which one?</question>\n</ask_followup_question>',
    'turn',
  );
  const done = parseClineBlocks(
    '<attempt_completion>\n<result>all set</result>\n</attempt_completion>',
    'turn',
  );

  expect(asked[0]).toMatchObject({
    call: {
      input: {
        rows: [{
          label: 'query',
          value: 'which one?',
        }],
      },
    },
  });
  expect(done[0]).toMatchObject({
    call: {
      input: {
        rows: [{
          label: 'prompt',
          value: 'all set',
        }],
      },
    },
  });
});

test('takes a pattern named as a pattern when there is no regex', () => {
  const blocks = parseClineBlocks('<search_files>\n<pattern>todo</pattern>\n</search_files>', 'turn');

  expect(blocks[0]).toMatchObject({ call: { input: { pattern: 'todo' } } });
});

test('ignores a bracket pair that is not a tag name at all', () => {
  expect(parseClineBlocks('compare a <3> b and <DIV>x</DIV>', 'turn')).toEqual([{
    blockType: 'text',
    text: 'compare a <3> b and <DIV>x</DIV>',
  }]);
});
