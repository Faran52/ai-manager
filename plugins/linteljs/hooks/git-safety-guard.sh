#!/usr/bin/env bash

payload=$(cat)
decision=$(printf '%s' "$payload" | node "${CLAUDE_PLUGIN_ROOT}/hooks/commandParser.js" git)
status=$?

if [ "$status" -ne 0 ]; then
  decision=indeterminate
fi

if [ "$decision" = "deny" ] || [ "$decision" = "indeterminate" ]; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Banned git operation. Stage only explicit paths and never bypass hooks or rewrite the current commit."}}'
fi

exit 0
