// Browser-safe facade: server-only readers live in ./utils and are imported directly
// by their sibling services, so components can take history types without pulling in node:fs.
export * from './types';
export * from './utils/claudeRawUtils';
export { findAgentProject } from './utils/lookupUtils';
export { pairToolOutcomes } from './utils/outcomeUtils';
