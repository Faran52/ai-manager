import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';

import { ArrowDown } from 'lucide-react';

import { scrollDockStorageKey } from '@config/storageKeys';

import { cn } from '@utils/cnUtils';

import {
  DOCK_SIZE_PX,
  DRAG_SLOP_PX,
  SCROLL_END_MARGIN_PX,
  SETTLE_MS,
} from '../constants';
import { Spinner } from '../spinner/Spinner';

import type { FC, PointerEvent } from 'react';

export interface ScrollToEndProps {
  readonly scrollElement: HTMLElement | null;
  // More to page in, so the end of the box is not the end of it.
  readonly hasMore?: boolean | undefined;
  readonly loading?: boolean | undefined;
  readonly onLoadRest?: (() => void)
    | undefined;
  // So two surfaces do not share one parking spot.
  readonly dockKey?: string | undefined;
}

interface Dock {
  readonly x: number;
  readonly y: number;
}

const DEFAULT_DOCK: Dock = {
  x: 24,
  y: 24,
};

const storedDock = (key: string): Dock => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '');

    if (typeof raw === 'object' && raw !== null && 'x' in raw && 'y' in raw
      && typeof raw.x === 'number' && typeof raw.y === 'number') {
      return {
        x: raw.x,
        y: raw.y,
      };
    }
  }
  catch {
    // Nothing stored, or an older shape.
  }

  return DEFAULT_DOCK;
};

const clamp = (value: number, limit: number): number => {
  return Math.min(Math.max(value, 0), Math.max(limit, 0));
};

// Offsets are from the bottom right, so it keeps its corner as the box resizes.
export const ScrollToEnd: FC<ScrollToEndProps> = ({
  scrollElement,
  hasMore = false,
  loading = false,
  onLoadRest,
  dockKey = scrollDockStorageKey,
}) => {
  const { t } = useTranslation('common');
  const [dock, setDock] = useState(() => {
    return storedDock(dockKey);
  });
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(0);
  const draggingRef = useRef(false);
  const wasLoadingRef = useRef(false);

  // Scrolling and growing both move the end; only one is an event.
  const subscribe = useCallback((notify: () => void): (() => void) => {
    if (scrollElement == null) {
      return () => {
        return undefined;
      };
    }

    const observer = new ResizeObserver(notify);

    scrollElement.addEventListener('scroll', notify, { passive: true });
    observer.observe(scrollElement);

    // The box keeps its size; the content inside it is what grows.
    if (scrollElement.firstElementChild != null) {
      observer.observe(scrollElement.firstElementChild);
    }

    // The box keeps its size; it is the content inside that grows.
    if (scrollElement.firstElementChild != null) {
      observer.observe(scrollElement.firstElementChild);
    }

    return () => {
      scrollElement.removeEventListener('scroll', notify);
      observer.disconnect();
    };
  }, [scrollElement]);

  const atEnd = useSyncExternalStore(subscribe, () => {
    if (scrollElement == null) {
      return true;
    }

    return scrollElement.scrollHeight - scrollElement.scrollTop
      - scrollElement.clientHeight <= SCROLL_END_MARGIN_PX;
  });

  useEffect(() => {
    localStorage.setItem(dockKey, JSON.stringify(dock));
  }, [dock, dockKey]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>): void => {
    movedRef.current = 0;
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLButtonElement>): void => {
    if (!draggingRef.current) {
      return;
    }

    movedRef.current += Math.abs(event.movementX) + Math.abs(event.movementY);

    setDock((current) => {
      const bounds = scrollElement?.getBoundingClientRect();

      return {
        x: clamp(current.x - event.movementX, (bounds?.width ?? 0) - DOCK_SIZE_PX),
        y: clamp(current.y - event.movementY, (bounds?.height ?? 0) - DOCK_SIZE_PX),
      };
    });
  }, [scrollElement]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLButtonElement>): void => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    draggingRef.current = false;
    setDragging(false);
  }, []);

  // Content grows as it measures, so the end keeps moving.
  const toEnd = useCallback((): void => {
    const content = scrollElement?.firstElementChild;

    if (scrollElement == null || content == null) {
      return;
    }

    // Never smooth: animating across a virtualized list mounts every row on
    // the way and hangs the renderer.
    const pin = (): void => {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'auto',
      });
    };

    const observer = new ResizeObserver(pin);

    pin();
    observer.observe(content);
    setTimeout(() => {
      observer.disconnect();
    }, SETTLE_MS);
  }, [scrollElement]);

  useEffect(() => {
    if (wasLoadingRef.current && !loading) {
      toEnd();
    }

    wasLoadingRef.current = loading;
  }, [loading, toEnd]);

  // A drag ending over the button is still a click, so the slop decides.
  const onClick = useCallback((): void => {
    if (movedRef.current > DRAG_SLOP_PX) {
      return;
    }

    if (hasMore && onLoadRest != null) {
      onLoadRest();

      return;
    }

    toEnd();
  }, [hasMore, onLoadRest, toEnd]);

  if (atEnd && !dragging && !hasMore) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={t('scrollToEnd')}
      title={t('scrollToEnd')}
      data-scroll-to-end
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      style={{
        right: `${String(dock.x)}px`,
        bottom: `${String(dock.y)}px`,
      }}
      className={cn(`
        absolute z-20 flex size-9 touch-none items-center justify-center
        rounded-md border border-border bg-card/90 text-muted-foreground
        shadow-sm backdrop-blur-sm
        hover:text-foreground
      `, dragging ? 'cursor-grabbing' : 'cursor-grab')}
    >
      {loading ? <Spinner /> : <ArrowDown className="size-4" />}
    </button>
  );
};
