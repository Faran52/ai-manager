import { createElement } from 'react';

import { ToastProvider } from '@ui/index';

import type { ToastProviderProps } from '@ui/toast/ToastProvider';
import type { ReactNode } from 'react';

// renderHook wrapper for a hook that pushes a toast, which needs the provider
// mounted or the hook throws on its missing context.
export const toastWrapper = ({ children }: ToastProviderProps): ReactNode => {
  return createElement(ToastProvider, null, children);
};
