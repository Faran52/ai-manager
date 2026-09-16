import type { FC, ReactNode } from 'react';

export interface LoaderProps {
  // The stage text and the accessible name; the caller translates it.
  readonly label: string;
  // The glyph for the mark; without one the ring and its arc still read as a spinner.
  readonly icon?: ReactNode;
}

// The mark turning behind a conic arc, and the stage it is on. Transform and
// opacity only; reduced motion stops both loops in global.css.
export const Loader: FC<LoaderProps> = ({ label, icon }) => {
  return (
    <div aria-label={label} className="loader" data-loader role="status">
      <div className="loader-mark">
        {icon != null && (
          <span aria-hidden className="loader-glyph">
            {icon}
          </span>
        )}
      </div>
      <p className="loader-stage">{label}</p>
    </div>
  );
};
