'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// `compact`, `standard`, `wide`, `list` and `detail` are the design's 440 / 520 / 600 / 680 / 720px
// (`list` for a modal of records, `detail` for a record's read-only detail). `sm` to `xl` keep the
// widths pages were built with; a page moves to the new names when it is redesigned.
type ModalSize = 'compact' | 'standard' | 'wide' | 'list' | 'detail' | 'sm' | 'md' | 'lg' | 'xl';
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
  /**
   * For a form: once something is typed or chosen, Esc, × and a click on the scrim ask
   * "ยังไม่ได้บันทึกการแก้ไข" before closing. `dirty` overrides the guess when the caller knows.
   */
  guardUnsaved?: boolean;
  dirty?: boolean;
  /** A status icon before the title, tinted by `iconTone`. */
  icon?: ReactNode;
  iconTone?: 'danger' | 'warning' | 'info' | 'success';
  /** Content before the title block, drawn as given (a record's picture). */
  media?: ReactNode;
  /** A line above the title (a code chip and a status badge). */
  eyebrow?: ReactNode;
  /** Extra classes on the dialog panel, for a family of modals that shares one look. */
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  compact: 'max-w-[440px]',
  standard: 'max-w-[520px]',
  wide: 'max-w-[600px]',
  list: 'max-w-[680px]',
  detail: 'max-w-[720px]',
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
  guardUnsaved = false,
  dirty,
  icon,
  iconTone = 'info',
  media,
  eyebrow,
  className = '',
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const [edited, setEdited] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openedAt, setOpenedAt] = useState(isOpen);
  // A form opened again starts clean.
  if (openedAt !== isOpen) {
    setOpenedAt(isOpen);
    setEdited(false);
    setConfirming(false);
  }
  const unsaved = guardUnsaved && (dirty ?? edited);
  const requestClose = () => (unsaved ? setConfirming(true) : onClose());
  const requestCloseRef = useRef(requestClose);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
    requestCloseRef.current = requestClose;
  });

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
        requestCloseRef.current();
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
        if (closeOnBackdrop && event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onInput={(event) => {
          // Typing in a select's search box changes nothing yet.
          if (guardUnsaved && (event.target as HTMLElement).getAttribute('role') !== 'searchbox') setEdited(true);
        }}
        className={`ka-modal overscroll-contain ${placement === 'center' ? '' : `ka-modal--${placement}`} ${sizeClasses[size]} ${className}`}
      >
        <div className="ka-modal__grab" aria-hidden="true" />
        <header className="ka-modal__head shrink-0 px-5 sm:px-6">
          {icon && <span className="ka-modal__icon" data-tone={iconTone}>{icon}</span>}
          {media}
          <div className="min-w-0 flex-1">
            {eyebrow}
            <h2 id={titleId} className="ka-modal__title">{title}</h2>
            {description && <p id={descriptionId} className="ka-modal__desc">{description}</p>}
          </div>
          <button type="button" onClick={requestClose} aria-label={closeLabel} className="ka-btn ka-btn--icon shrink-0">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="ka-modal__body px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="ka-modal__foot shrink-0 px-5 sm:px-6">{footer}</footer>}
      </div>
      {guardUnsaved && (
        <Modal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          title="ยังไม่ได้บันทึกการแก้ไข"
          description="ถ้าปิดตอนนี้ สิ่งที่กรอกไว้จะหายไป"
          size="compact"
          layer="elevated"
          footer={
            <>
              <button type="button" className="ka-btn min-h-11" onClick={() => setConfirming(false)}>แก้ไขต่อ</button>
              <button type="button" className="ka-btn ka-btn--danger min-h-11" onClick={() => { setConfirming(false); onClose(); }}>ทิ้งการแก้ไข</button>
            </>
          }
        >
          <p className="text-[var(--ink-muted)]">ข้อมูลที่ยังไม่บันทึกจะไม่ถูกเก็บไว้</p>
        </Modal>
      )}
    </div>,
    document.body,
  );
}
