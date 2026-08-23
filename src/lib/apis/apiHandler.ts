import { appConfig } from '@config/appConfig';

const JSON_HEADERS = { 'content-type': 'application/json' };

export const jsonOk = (payload: object): Response => {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: JSON_HEADERS,
  });
};

export const jsonError = (status: number, message: string): Response => {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
};

export const readJsonObject = async (request: Request): Promise<object | undefined> => {
  let text = '';

  try {
    text = await request.text();
  }
  catch {
    return undefined;
  }

  if (text.length === 0) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }

    return undefined;
  }
  catch {
    return undefined;
  }
};

export const clampLimit = (limit: number | undefined): number => {
  const requested = limit ?? appConfig.pageSize;

  return Math.min(Math.max(Math.floor(requested), 1), appConfig.maxPageSize);
};

export const clampOffset = (requested = 0): number => {
  return Math.max(Math.floor(requested), 0);
};

export const withJsonErrors = async (
  handler: () => Promise<Response>,
): Promise<Response> => {
  try {
    return await handler();
  }
  catch (cause) {
    console.error('unhandled api error:', cause);

    return jsonError(500, 'Unexpected server error.');
  }
};
