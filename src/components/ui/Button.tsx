import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Reusable, token-styled button. Variants map to the semantic colour tokens in
 * tokens.css so the extension can be re-skinned without touching call sites.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly children: ReactNode;
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg hover:brightness-110',
  secondary: 'bg-surface-sunken text-ink hover:bg-line',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-sunken',
  danger: 'bg-transparent text-accent-danger hover:bg-accent-danger/10',
};

export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`.trim();
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
