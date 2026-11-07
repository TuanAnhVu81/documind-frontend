import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  side?: 'center' | 'left' | 'right' | 'bottom';
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'center',
}: Props) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-overlay" />
        <DialogPrimitive.Content
          className={`ui-dialog ui-dialog--${side}`}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              returnFocus.current.focus();
              if (document.activeElement === returnFocus.current) event.preventDefault();
            }
          }}
        >
          <div className="ui-dialog-heading">
            <div>
              <DialogPrimitive.Title className="ui-dialog-title">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="ui-dialog-description">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Đóng">
                <X size={18} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Sheet(props: Omit<Props, 'side'> & { side?: 'left' | 'right' | 'bottom' }) {
  return <Dialog {...props} side={props.side ?? 'right'} />;
}
