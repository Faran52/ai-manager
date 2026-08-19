// Runs the project typecheck and filters the errors down to the staged files.
// Usage: node scripts/typecheckStaged.ts src/App.tsx src/lib/utils/dateUtils.ts
import { type ExecException, execSync } from 'node:child_process';
import {
  argv,
  env,
  exit,
} from 'node:process';

interface ExecSyncError extends ExecException {
  stdout: string;
  stderr: string;
}

// A caught value is untyped by construction, so this is the one place a guard has to narrow it.
const isExecSyncError = (value: unknown): value is ExecSyncError => {
  return value instanceof Error && 'stdout' in value && 'stderr' in value;
};

// Overridable for vue-tsc or svelte-check; destructuring also satisfies the tsconfig's index-signature rule.
const { TYPECHECK_COMMAND } = env;
const typecheckCommand = TYPECHECK_COMMAND ?? 'npm run typecheck';
const ANSI_ESCAPE_GLOBAL = /\u001b\[[0-9;]*m/g;

const normalizePath = (filePath: string): string => {
  const normalized = filePath.replaceAll('\\', '/');
  const srcIndex = normalized.indexOf('src/');
  return srcIndex === -1 ? normalized : normalized.slice(srcIndex);
};

const stagedFiles: string[] = argv.slice(2).map(normalizePath);

if (stagedFiles.length === 0) {
  exit(0);
}

let output = '';

try {
  execSync(typecheckCommand, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  exit(0);
}
catch (error) {
  if (!isExecSyncError(error)) {
    throw error;
  }

  output = `${error.stdout}\n${error.stderr}`;
}

const lines: string[] = output.split('\n');

const errors: string[] = lines.filter((line: string) => {
  const normalizedLine = line.replace(ANSI_ESCAPE_GLOBAL, '');

  if (!normalizedLine.includes(' - error TS') && !normalizedLine.includes('): error TS')) {
    return false;
  }

  return stagedFiles.some((file: string) => {
    return normalizedLine.includes(file);
  });
});

if (errors.length > 0) {
  console.error('\nTypeScript errors in staged files:\n');
  console.error(errors.join('\n'));
  console.error('');
  exit(1);
}
