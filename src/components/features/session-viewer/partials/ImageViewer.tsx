import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  Maximize2,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { fadeTransition } from '@ui/index';

import type {
  FC,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';

export interface ImageViewerProps {
  readonly src: string;
  readonly onClose: () => void;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface PanStart extends Point {
  readonly pointerX: number;
  readonly pointerY: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

const boundedZoom = (value: number): number => {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
};

export const ImageViewer: FC<ImageViewerProps> = ({ src, onClose }) => {
  const { t } = useTranslation('common');
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [dragging, setDragging] = useState(false);
  const panStartRef = useRef<PanStart>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const resetView = (): void => {
    setZoom(MIN_ZOOM);
    setOffset({
      x: 0,
      y: 0,
    });
  };

  const changeZoom = (change: number): void => {
    setZoom((current) => {
      const next = boundedZoom(current + change);

      if (next === MIN_ZOOM) {
        setOffset({
          x: 0,
          y: 0,
        });
      }

      return next;
    });
  };

  useEffect(() => {
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
      else if (event.key === '+' || event.key === '=') {
        changeZoom(ZOOM_STEP);
      }
      else if (event.key === '-') {
        changeZoom(-ZOOM_STEP);
      }
      else if (event.key === '0') {
        resetView();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const startPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (zoom === MIN_ZOOM) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: offset.x,
      y: offset.y,
    };
    setDragging(true);
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = panStartRef.current;

    if (start == null) {
      return;
    }

    setOffset({
      x: start.x + event.clientX - start.pointerX,
      y: start.y + event.clientY - start.pointerY,
    });
  };

  const stopPan = (): void => {
    panStartRef.current = null;
    setDragging(false);
  };

  const zoomWithWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  return createPortal(
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('imageViewer')}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fadeTransition}
      className="
        fixed inset-0 z-70 overflow-hidden bg-black/90 backdrop-blur-md
        outline-none
      "
      data-image-viewer
    >
      <button
        type="button"
        aria-label={t('closeImageViewer')}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="presentation"
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onWheel={zoomWithWheel}
        onDoubleClick={() => {
          if (zoom === MIN_ZOOM) {
            changeZoom(1);
          }
          else {
            resetView();
          }
        }}
        className={cn(
          `
            absolute inset-0 z-10 grid touch-none place-items-center
            overflow-hidden p-12 select-none
          `,
          zoom > MIN_ZOOM && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        <img
          src={src}
          alt={t('imageViewer')}
          draggable={false}
          className="
            max-h-full max-w-full rounded-md object-contain shadow-2xl
            will-change-transform
          "
          style={{ transform: `translate(${String(offset.x)}px, ${String(offset.y)}px) scale(${String(zoom)})` }}
        />
      </div>
      <div className="
        absolute inset-e-4 top-4 z-20 flex items-center gap-1 rounded-lg border
        border-white/10 bg-black/55 p-1 text-white shadow-xl backdrop-blur-md
      "
      >
        <button
          type="button"
          onClick={() => {
            changeZoom(-ZOOM_STEP);
          }}
          disabled={zoom === MIN_ZOOM}
          aria-label={t('zoomOut')}
          title={t('zoomOut')}
          className="
            grid size-8 place-items-center rounded-md
            hover:bg-white/10
            disabled:opacity-35
          "
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label={t('resetZoom')}
          title={t('resetZoom')}
          className="
            flex h-8 min-w-14 items-center justify-center gap-1 rounded-md px-2
            font-mono text-xs
            hover:bg-white/10
          "
        >
          <Maximize2 className="size-3.5" />
          {`${String(Math.round(zoom * 100))}%`}
        </button>
        <button
          type="button"
          onClick={() => {
            changeZoom(ZOOM_STEP);
          }}
          disabled={zoom === MAX_ZOOM}
          aria-label={t('zoomIn')}
          title={t('zoomIn')}
          className="
            grid size-8 place-items-center rounded-md
            hover:bg-white/10
            disabled:opacity-35
          "
        >
          <Plus className="size-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-white/15" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeImageViewer')}
          title={t('closeImageViewer')}
          className="
            grid size-8 place-items-center rounded-md
            hover:bg-white/10
          "
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="
        absolute inset-s-1/2 bottom-4 z-20 -translate-x-1/2 rounded-md
        bg-black/45 px-3 py-1.5 font-mono text-[10px] tracking-wide
        text-white/55
      "
      >
        {t('imageViewerHint')}
      </p>
    </motion.div>,
    document.body,
  );
};
