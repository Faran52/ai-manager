#!/usr/bin/env bash

payload=$(cat)
decision=$(printf '%s' "$payload" | node "${CLAUDE_PLUGIN_ROOT}/hooks/commandParser.js" eslint)
status=$?

if [ "$status" -ne 0 ]; then
  decision=indeterminate
fi

if [ "$decision" = "warn" ] || [ "$decision" = "indeterminate" ]; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"eslint was called without --fix. Run eslint <files> --fix instead."}}'
fi

exit 0
