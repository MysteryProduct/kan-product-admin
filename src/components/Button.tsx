import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'action' | 'secondary' | 'ghost' | 'danger';

type IconOnly = { icon: true; 'aria-label': string };
type WithText = { icon?: false };

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  /** `action` is the one main action of a toolbar, form or dialog; everything else is secondary, ghost or danger. */
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** Shows a spinner and blocks clicks while a command is saving. */
  loading?: boolean;
  'aria-label'?: string;
} & (IconOnly | WithText);

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  action: 'ka-btn--primary',
  secondary: '',
  ghost: 'ka-btn--ghost',
  danger: 'ka-btn--danger',
};

/** The design system's button. It presses down 1px (CSS) and grows to 44px on touch screens. */
export default function Button({
  variant = 'secondary',
  size = 'md',
  icon = false,
  loading = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['ka-btn', VARIANT_CLASS[variant], size === 'sm' ? 'ka-btn--sm' : '', icon ? 'ka-btn--icon' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button {...rest} type={type} disabled={disabled} aria-busy={loading || undefined} className={classes}>
      {children}
    </button>
  );
}
