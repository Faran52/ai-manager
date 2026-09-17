import { isForeignOrigin } from '@lib/apis/originUtils';

import type { MiddlewareHandler } from 'astro';

/*
 * A prerendered page is built, not requested, so there is no origin to refuse
 * and reading the headers there only warns. The guard is for the API routes.
 */
export const onRequest: MiddlewareHandler = ({
  isPrerendered,
  request,
  url,
}, next) => {
  return !isPrerendered && isForeignOrigin(request.headers.get('origin'), url.origin)
    ? new Response('Cross-origin request refused.', { status: 403 })
    : next();
};
