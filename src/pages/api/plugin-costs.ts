import { handlePluginCosts } from '@lib/apis/endpoints';

import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = ({ request }) => {
  return handlePluginCosts(request);
};
