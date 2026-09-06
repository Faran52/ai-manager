import { TabsContent } from '@radix-ui/react-tabs';

import type { FC, ReactNode } from 'react';

export interface TabsPanelProps {
  readonly value: string;
  readonly children: ReactNode;
}

export const TabsPanel: FC<TabsPanelProps> = ({ value, children }) => {
  return (
    <TabsContent
      value={value}
      className="focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </TabsContent>
  );
};
