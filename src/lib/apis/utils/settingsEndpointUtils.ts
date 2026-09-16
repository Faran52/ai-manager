import {
  isSettingsScope,
  readAgentSettings,
  writeScopeSettings,
} from '@services/settings/settingsService';

import {
  jsonError,
  jsonOk,
  readJsonObject,
  withJsonErrors,
} from '../apiHandler';
import { BAD_REQUEST } from '../constants';

import {
  claudeDirFor,
  isAgent,
  isRuleList,
} from './endpointDepsUtils';

import type { EnvEntry } from '@services/settings/settingsService';
import type { SettingsBody, WriteSettingsBody } from '../contracts';
import type { EndpointDeps } from './endpointDepsUtils';

const isSettingsBody = (body: object): body is SettingsBody => {
  if (!('projectPath' in body) || typeof body.projectPath !== 'string') {
    return false;
  }

  // Absent means Claude, which is what every caller meant before the picker.
  // Parsed JSON never yields undefined, so a present key must name an agent.
  return (!('agent' in body) || isAgent(body.agent))
    && (!('profile' in body) || typeof body.profile === 'string');
};

const isEnvEntry = (value: unknown): value is EnvEntry => {
  return typeof value === 'object' && value !== null
    && 'name' in value && typeof value.name === 'string'
    && 'value' in value && typeof value.value === 'string';
};

const isWriteSettingsBody = (body: object): body is WriteSettingsBody => {
  if (!isSettingsBody(body)
    || !('scope' in body) || typeof body.scope !== 'string' || !isSettingsScope(body.scope)
    || !('patch' in body) || typeof body.patch !== 'object' || body.patch === null) {
    return false;
  }

  const { patch } = body;

  if (!('permissions' in patch) || typeof patch.permissions !== 'object' || patch.permissions === null
    || !('env' in patch) || !Array.isArray(patch.env)) {
    return false;
  }

  const { permissions } = patch;
  const lists = ['allow', 'deny', 'ask', 'additionalDirectories'];

  return lists.every((key) => {
    return key in permissions && isRuleList(Reflect.get(permissions, key));
  }) && patch.env.every(isEnvEntry);
};

export const handleReadSettings = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isSettingsBody(body)) {
      return jsonError(BAD_REQUEST, 'A project path is required.');
    }

    return jsonOk({
      scopes: await readAgentSettings(
        body.agent ?? 'claude',
        body.projectPath,
        deps?.home,
        claudeDirFor(body, deps),
      ),
    });
  });
};

export const handleWriteSettings = async (request: Request, deps?: EndpointDeps): Promise<Response> => {
  return withJsonErrors(async () => {
    const body = await readJsonObject(request);

    if (body == null || !isWriteSettingsBody(body)) {
      return jsonError(BAD_REQUEST, 'A scope and a complete settings patch are required.');
    }

    // Every scope but the user one is written inside a project, so a request
    // without one is asking for a file with no place to live.
    if (body.scope !== 'user' && body.projectPath.length === 0) {
      return jsonError(BAD_REQUEST, 'Select a project before editing its settings.');
    }

    return jsonOk({
      scope: await writeScopeSettings(
        body.scope,
        body.projectPath,
        body.patch,
        deps?.home,
        body.agent ?? 'claude',
        claudeDirFor(body, deps),
      ),
    });
  });
};
