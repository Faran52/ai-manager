import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';

// The projectId a fetch stub was asked for, read from the request body it was handed.
export const projectIdOf = (init: RequestInit | undefined): string => {
  const body = parseJsonContainer(typeof init?.body === 'string' ? init.body : '{}');

  return isJsonObject(body) && typeof body.projectId === 'string' ? body.projectId : '';
};
