import { LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';

type Props = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'icon';
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
