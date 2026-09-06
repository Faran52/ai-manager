import { useId } from 'react';

import {
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
} from '@radix-ui/react-tabs';
import { motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { controlTransition } from '../constants';
import { Tooltip } from '../tooltip/Tooltip';

import type { FC, ReactNode } from 'react';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode | undefined;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly iconOnly?: boolean;
  readonly children?: ReactNode;
}

const TRIGGER = `
  relative inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs
  text-muted-foreground transition-colors
  hover:text-foreground
  focus-visible:ring-2 focus-visible:ring-ring
  data-[state=active]:text-foreground
`;

export const Tabs: FC<TabsProps> = ({
  items,
  value,
  onChange,
  label,
  iconOnly = false,
  children,
}) => {
  /*
   * The marker is a shared element, so its id has to be unique per strip or two
   * tab bars on one screen would animate their markers into each other.
   */
  const markerId = useId();

  return (
    <TabsRoot value={value} onValueChange={onChange}>
      <TabsList aria-label={label} className="inline-flex items-center gap-1">
        {items.map((item) => {
          const trigger = (
            <TabsTrigger className={cn(TRIGGER)} key={item.id} value={item.id}>
              {/* One marker for the whole strip, so it slides between tabs
                  rather than fading out here and in again there. */}
              {item.id === value && (
                <motion.span
                  className="absolute inset-0 -z-10 rounded-md bg-accent"
                  layoutId={markerId}
                  transition={controlTransition}
                />
              )}
              {item.icon}
              {/* The label is the accessible name either way, so an icon-only
                  strip hides it visually rather than dropping it. */}
              <span className={iconOnly ? 'sr-only' : undefined}>{item.label}</span>
            </TabsTrigger>
          );

          if (!iconOnly) {
            return trigger;
          }

          return (
            <Tooltip content={item.label} key={item.id}>
              {trigger}
            </Tooltip>
          );
        })}
      </TabsList>
      {children}
    </TabsRoot>
  );
};
