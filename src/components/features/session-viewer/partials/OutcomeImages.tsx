import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { uniqueKeys } from '@utils/reactKeyUtils';

import { ImageViewer } from './ImageViewer';

import type { ToolOutcome } from '@services/history/historyService';
import type { FC } from 'react';

export interface OutcomeImagesProps {
  readonly outcome: ToolOutcome;
}

const imageIdentity = (image: ToolOutcome['images'][number]): string => {
  return image.url ?? `${String(image.mediaType)}:${String(image.data?.length ?? 0)}`;
};

export const OutcomeImages: FC<OutcomeImagesProps> = ({ outcome }) => {
  const { t } = useTranslation('common');
  const [selectedSrc, setSelectedSrc] = useState<string>();
  const keys = uniqueKeys(outcome.images, imageIdentity);
  const keyed = outcome.images.map((image, index) => {
    return {
      image,
      key: keys[index],
    };
  });

  return (
    <div className="flex flex-wrap gap-2" data-outcome-images>
      {keyed.map(({ image, key }) => {
        const isEmbedded = image.data != null && image.mediaType != null;
        const src = isEmbedded ? `data:${image.mediaType};base64,${image.data}` : image.url;

        return src != null
          ? (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedSrc(src);
                }}
                aria-label={t('openImageViewer')}
                className="
                  group relative overflow-hidden rounded-lg border border-border
                  bg-muted/30 transition-colors outline-none
                  hover:border-primary/50
                  focus-visible:ring-2 focus-visible:ring-ring
                "
              >
                <img
                  src={src}
                  alt="tool result"
                  loading="lazy"
                  className="
                    max-h-48 transition-transform duration-300
                    group-hover:scale-[1.02]
                  "
                />
              </button>
            )
          : null;
      })}
      {selectedSrc != null && (
        <ImageViewer
          src={selectedSrc}
          onClose={() => {
            setSelectedSrc(undefined);
          }}
        />
      )}
    </div>
  );
};
