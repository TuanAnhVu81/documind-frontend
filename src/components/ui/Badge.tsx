import type { ComponentProps } from 'react';

type Props = ComponentProps<'span'> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
};
export function Badge({ tone = 'neutral', className = '', ...props }: Props) {
  return <span className={`ui-badge ui-badge--${tone} ${className}`} {...props} />;
}
