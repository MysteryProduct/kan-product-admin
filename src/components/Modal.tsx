'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

// `compact`, `standard` and `wide` are the design system's 440 / 520 / 600px. `sm` to `xl` keep the
// widths pages were built with; a page moves to the new names when it is redesigned.
type ModalSize = 'compact' | 'standard' | 'wide' | 'sm' | 'md' | 'lg' | 'xl';
/** `drawer` slides in from the right on wide screens; `sheet` rises from the bottom at every width. */
type ModalPlacement = 'center' | 'drawer' | 'sheet';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  layer?: 'default' | 'elevated';
  placement?: ModalPlacement;
}

const sizeClasses: Record<ModalSize, string> = {
  compact: 'max-w-[440px]',
  standard: 'max-w-[520px]',
  wide: 'max-w-[600px]',
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

// Open modals, oldest first: only the topmost one handles Escape and Tab so stacked dialogs do not close together.
const openModals: symbol[] = [];
let originalOverflow = '';
let rootOpener: HTMLElement | null = null;

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = 'ปิดหน้าต่าง',
  closeOnBackdrop = true,
  closeOnEscape = true,
  layer = 'default',
  placement = 'center',
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  }, [onClose, closeOnEscape]);

  useEffect(() => {
    if (!isOpen) return;

    const token = Symbol('modal');
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openModals.length === 0) {
      originalOverflow = document.body.style.overflow;
      rootOpener = previouslyFocused;
    }
    openModals.push(token);
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== token) return;
      if (event.key === 'Escape' && closeOnEscapeRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const wasTopmost = openModals[openModals.length - 1] === token;
      openModals.splice(openModals.indexOf(token), 1);
      if (openModals.length === 0) {
        // Form and result may unmount in either order in the same commit.
        document.body.style.overflow = originalOverflow;
        if (rootOpener?.isConnected) rootOpener.focus();
        rootOpener = null;
      } else if (wasTopmost && previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`ka-scrim ${placement === 'center' ? '' : `ka-scrim--${placement}`} ${layer === 'elevated' ? 'z-[80]' : 'z-[70]'}`}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`ka-modal overscroll-contain ${placement === 'center' ? '' : `ka-modal--${placement}`} ${sizeClasses[size]}`}
      >
        <header className="ka-modal__head shrink-0 px-5 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="ka-modal__title">{title}</h2>
            {description && <p id={descriptionId} className="ka-modal__desc">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="ka-btn ka-btn--icon shrink-0">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="ka-modal__body px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="ka-modal__foot shrink-0 px-5 sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
