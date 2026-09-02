import { isForeignOrigin } from '@lib/apis/originUtils';

import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = ({ request, url }, next) => {
  return isForeignOrigin(request.headers.get('origin'), url.origin)
    ? new Response('Cross-origin request refused.', { status: 403 })
    : next();
};
