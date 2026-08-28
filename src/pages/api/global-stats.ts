import { handleGlobalStats } from '@lib/apis/endpoints';

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => {
  return handleGlobalStats();
};
