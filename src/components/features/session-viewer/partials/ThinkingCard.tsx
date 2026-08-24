import { Brain, ChevronDown } from 'lucide-react';

import type { FC } from 'react';

export interface ThinkingCardProps {
  readonly thinking: string;
}

export const ThinkingCard: FC<ThinkingCardProps> = ({ thinking }) => {
  return (
    <details
      className="group rounded-lg border border-primary/30 bg-primary/5"
      data-thinking
    >
      <summary className="
        flex cursor-pointer list-none items-center gap-1.5 px-3 py-1.5 text-xs
        font-medium text-primary
      "
      >
        <Brain className="size-3.5" />
        <span>Thinking</span>
        <ChevronDown className="
          size-3 transition-transform
          group-open:rotate-180
        "
        />
      </summary>
      <p className="
        border-t border-primary/20 px-3 py-2 text-xs/relaxed whitespace-pre-wrap
        text-muted-foreground
      "
      >
        {thinking}
      </p>
    </details>
  );
};
