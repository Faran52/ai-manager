#!/usr/bin/env bash

payload=$(cat)

# The checker sits at the project root, and the payload's `cwd` is wherever the agent is standing: an agent working in
# a subdirectory resolved it to a path that does not exist, and node exiting non-zero for a missing file reads exactly
# like a banned pattern, so the edit was blocked with `Cannot find module` as the reason. Searched upwards instead,
# from the root the host names where there is one, since Claude Code exports it and Codex does not.
checker_above() {
  dir=$1

  while [ -n "$dir" ]; do
    if [ -f "$dir/scripts/checkBannedPatterns.ts" ]; then
      printf '%s' "$dir/scripts/checkBannedPatterns.ts"
      return 0
    fi

    parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && return 1
    dir=$parent
  done

  return 1
}

while IFS= read -r -d '' cwd && IFS= read -r -d '' file; do
  [ -f "$file" ] || continue

  # No checker anywhere above the file is a project with no floor to enforce, which is not a violation to report.
  checker=$(checker_above "${CLAUDE_PROJECT_DIR:-$cwd}") \
    || checker=$(checker_above "$cwd") \
    || continue

  hits=$(node "$checker" "$file" 2>&1)
  status=$?

  if [ "$status" -ne 0 ]; then
    printf '%s' "$hits" | node -e '
      const hits = require("node:fs").readFileSync(0, "utf8");
      process.stdout.write(JSON.stringify({
        decision: "block",
        reason: `Banned pattern.\n${hits}`,
      }) + "\n");
    '
    exit 0
  fi
done < <(printf '%s' "$payload" | node -e '
  const fs = require("node:fs");
  const path = require("node:path");

  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    process.exit(0);
  }

  const cwd = path.resolve(typeof input.cwd === "string" && input.cwd !== "" ? input.cwd : ".");
  const paths = [];
  const toolInput = input.tool_input;
  const toolResponse = input.tool_response;

  if (toolInput !== null && typeof toolInput === "object" && !Array.isArray(toolInput)) {
    if (typeof toolInput.file_path === "string") paths.push(toolInput.file_path);
  }
  if (toolResponse !== null && typeof toolResponse === "object" && !Array.isArray(toolResponse)) {
    if (typeof toolResponse.filePath === "string") paths.push(toolResponse.filePath);
  }

  const patch = toolInput !== null && typeof toolInput === "object"
      && typeof toolInput.command === "string"
    ? toolInput.command
    : typeof toolInput === "string"
      ? toolInput
      : toolInput !== null && typeof toolInput === "object" && typeof toolInput.patch === "string"
        ? toolInput.patch
        : "";

  for (const line of patch.split(/\r?\n/u)) {
    const match = /^\*\*\* (?:Add|Update) File: (.+)$/u.exec(line);
    if (match?.[1] !== undefined) paths.push(match[1]);
  }

  for (const file of new Set(paths.map((candidate) => path.resolve(cwd, candidate)))) {
    if (/\.(?:ts|tsx|mts|cts|vue|svelte)$/u.test(file)) {
      process.stdout.write(`${cwd}\0${file}\0`);
    }
  }
')

exit 0
