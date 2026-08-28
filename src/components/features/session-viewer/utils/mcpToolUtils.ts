import type { ToolCall } from '@services/history/historyService';

export interface McpToolIdentity {
  readonly server: string;
  readonly tool: string;
}

export const mcpToolIdentity = (call: ToolCall): McpToolIdentity | undefined => {
  if (call.serverName != null) {
    return {
      server: call.serverName,
      tool: call.name,
    };
  }

  if (!call.name.startsWith('mcp__')) {
    return undefined;
  }

  const suffix = call.name.slice(5);
  const separator = suffix.indexOf('__');

  if (separator < 0) {
    return {
      server: suffix,
      tool: call.name,
    };
  }

  return {
    server: suffix.slice(0, separator),
    tool: suffix.slice(separator + 2),
  };
};
