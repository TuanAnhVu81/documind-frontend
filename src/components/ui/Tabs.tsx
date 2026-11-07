import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

type Tab = { value: string; label: string; content: ReactNode; disabled?: boolean };
export function Tabs({
  label,
  defaultValue,
  tabs,
}: {
  label: string;
  defaultValue: string;
  tabs: Tab[];
}) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue}>
      <TabsPrimitive.List className="ui-tabs-list" aria-label={label}>
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            className="ui-tab"
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content className="ui-tab-content" key={tab.value} value={tab.value}>
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
