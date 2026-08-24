import { uniqueKeys } from '@utils/reactKeyUtils';

import type { ToolOutcome } from '@services/history/historyService';
import type { FC } from 'react';

export interface OutcomeImagesProps {
  readonly outcome: ToolOutcome;
}

const imageIdentity = (image: ToolOutcome['images'][number]): string => {
  return image.url ?? `${String(image.mediaType)}:${String(image.data?.length ?? 0)}`;
};

export const OutcomeImages: FC<OutcomeImagesProps> = ({ outcome }) => {
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
              <img
                key={key}
                src={src}
                alt="tool result"
                className="max-h-48 rounded-lg border border-border"
              />
            )
          : null;
      })}
    </div>
  );
};
