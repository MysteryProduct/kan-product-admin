'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import BottomSheet from '@/components/BottomSheet';
import { useIsPhone } from '@/hooks/useMediaQuery';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EDGE = 8;

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The button that opens it; clicks on it are not "outside", and focus returns to it. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Names the panel for screen readers and is the heading of the bottom sheet on phones. */
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  align?: 'start' | 'end';
  width?: number;
  /** `menu` skips the automatic focus: the menu moves focus to its own first item. */
  role?: 'dialog' | 'menu';
}

/**
 * A panel anchored to a button. Esc and a click outside close it. Below 640px it is a
 * bottom sheet instead, because an anchored panel cannot fit a thumb or a phone screen.
 */
export default function Popover({ open, onClose, anchorRef, title, children, footer, align = 'start', width = 280, role = 'dialog' }: PopoverProps) {
  const isPhone = useIsPhone();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Placed straight on the element, before paint, so it never flashes at the wrong spot.
  useLayoutEffect(() => {
    if (!open || isPhone) return;
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const rect = anchor.getBoundingClientRect();
      const left = align === 'end' ? rect.right - panel.offsetWidth : rect.left;
      const maxLeft = window.innerWidth - panel.offsetWidth - EDGE;
      let top = rect.bottom + 6;
      if (top + panel.offsetHeight > window.innerHeight - EDGE && rect.top - panel.offsetHeight - 6 > EDGE) {
        top = rect.top - panel.offsetHeight - 6;
      }
      panel.style.left = `${Math.max(EDGE, Math.min(left, maxLeft))}px`;
      panel.style.top = `${top}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, isPhone, align, anchorRef]);

  useEffect(() => {
    if (!open || isPhone) return;
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (role === 'dialog') panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel?.contains(target) || anchor?.contains(target)) return;
      onCloseRef.current();
    };
    // Capture phase: Esc closes this panel only, not the dialog it may sit in.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      const active = document.activeElement;
      if ((!active || active === document.body || panel?.contains(active)) && anchor?.isConnected) anchor.focus();
    };
  }, [open, isPhone, role, anchorRef]);

  // On a phone the sheet's Modal records the focused element as its opener, but a menu has already moved
  // focus to its first item by then, so that record is lost on close. Hand focus back to the anchor here.
  useEffect(() => {
    if (!open || !isPhone) return;
    const anchor = anchorRef.current;
    return () => {
      const active = document.activeElement;
      if ((!active || active === document.body) && anchor?.isConnected) anchor.focus();
    };
  }, [open, isPhone, anchorRef]);

  if (!open) return null;

  if (isPhone) {
    return (
      <BottomSheet isOpen onClose={onClose} title={title} footer={footer}>
        {children}
      </BottomSheet>
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      role={role === 'menu' ? 'menu' : 'dialog'}
      aria-label={title}
      className="ka-popover"
      style={{ width }}
    >
      <div className="ka-popover__body">{children}</div>
      {footer && <div className="ka-popover__foot">{footer}</div>}
    </div>,
    document.body,
  );
}
