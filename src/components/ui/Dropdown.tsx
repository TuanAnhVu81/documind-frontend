import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

export function Dropdown({
  trigger,
  label,
  children,
}: {
  trigger: ReactElement;
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          className="ui-dropdown"
          align="end"
          sideOffset={8}
          aria-label={label}
        >
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

export function DropdownItem({
  className = '',
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item>) {
  return <DropdownPrimitive.Item className={`ui-dropdown-item ${className}`} {...props} />;
}

export function DropdownLabel({
  className = '',
  ...props
}: ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={`ui-dropdown-label ${className}`} {...props} />;
}

export function DropdownSeparator({
  className = '',
  ...props
}: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator className={`ui-dropdown-separator ${className}`} {...props} />
  );
}
