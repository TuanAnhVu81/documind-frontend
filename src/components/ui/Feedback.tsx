import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export function Skeleton({
  label = 'Đang tải',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return <span className={`ui-skeleton ${className}`} role="status" aria-label={label} />;
}

export function Progress({ value, label }: { value: number | null; label: string }) {
  const safeValue =
    value === null || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, value));
  return (
    <ProgressPrimitive.Root className="ui-progress" value={safeValue} aria-label={label}>
      <ProgressPrimitive.Indicator
        className="ui-progress-indicator"
        style={safeValue === null ? undefined : { width: `${safeValue}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ui-error" role="alert">
      <AlertCircle aria-hidden="true" size={20} />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {onRetry && (
          <Button variant="secondary" size="small" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}
      <ToastPrimitive.Viewport className="ui-toast-viewport" />
    </ToastPrimitive.Provider>
  );
}

export function Toast({
  open,
  onOpenChange,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <ToastPrimitive.Root className="ui-toast" open={open} onOpenChange={onOpenChange}>
      <ToastPrimitive.Title className="ui-toast-title">{title}</ToastPrimitive.Title>
      <ToastPrimitive.Description className="ui-toast-description">
        {description}
      </ToastPrimitive.Description>
      <ToastPrimitive.Close className="ui-toast-close" aria-label="Đóng thông báo">
        <X size={16} />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}
