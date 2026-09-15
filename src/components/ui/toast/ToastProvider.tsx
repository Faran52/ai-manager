import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ToastStack } from './ToastStack';

import type { FC, ReactNode } from 'react';
import type { ToastVariant } from './Toast';
import type { ActiveToast } from './ToastStack';

export interface ToastContextValue {
  // Defaults to 'info' so a caller that only ever reports one kind of thing,
  // like a refresh notice, does not have to name it every time.
  readonly push: (text: string, variant?: ToastVariant) => void;
}

export interface ToastProviderProps {
  readonly children: ReactNode;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4_000;

// The one place the stack lives: mounted once at the app root, so two
// toasts from unrelated components never land on top of each other.
export const ToastProvider: FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<readonly ActiveToast[]>([]);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => {
      return current.filter((toast) => {
        return toast.id !== id;
      });
    });
  }, []);

  const push = useCallback((text: string, variant: ToastVariant = 'info') => {
    const id = nextIdRef.current;

    nextIdRef.current += 1;
    setToasts((current) => {
      return [...current, {
        id,
        text,
        variant,
      }];
    });
    window.setTimeout(() => {
      dismiss(id);
    }, AUTO_DISMISS_MS);
  }, [dismiss]);

  const value = useMemo(() => {
    return { push };
  }, [push]);

  return (
    <ToastContext value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  );
};

export const useToast = (): ToastContextValue => {
  const context = use(ToastContext);

  if (context == null) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};
