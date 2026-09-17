import type { FC, ReactNode } from 'react';

export interface EmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly hint?: string;
}

export const EmptyState: FC<EmptyStateProps> = ({
  icon,
  title,
  hint,
}) => {
  return (
    <div
      className="
        flex flex-col items-center justify-center gap-2 px-6 py-14 text-center
      "
      data-empty-state
    >
      {/* A 24-grid glyph drawn at 32px carries a 2.7px stroke, which reads as
          blunt rather than drawn. Thinned here so every empty state gets it. */}
      <div className="
        text-muted-foreground/50
        [&_svg]:stroke-[1.5]
      "
      >
        {icon}
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {title}
      </p>
      {hint != null && (
        <p className="max-w-xs text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};
