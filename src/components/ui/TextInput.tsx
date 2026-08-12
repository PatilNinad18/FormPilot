import { useId } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';

/**
 * Generic labelled text input, not bound to a profile {@link FieldDescriptor}.
 *
 * Use this for ad-hoc fields the descriptor system does not model — custom
 * fields, resume metadata — so those screens share the same look, spacing, and
 * accessibility wiring (label/help/error association) as the descriptor-bound
 * {@link TextField} without inventing a fake descriptor.
 */

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'id' | 'className'
>;

interface TextInputProps extends NativeInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string | null;
  readonly helpText?: string;
}

const CONTROL_CLASSES =
  'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

export function TextInput({ label, value, onChange, error, helpText, ...rest }: TextInputProps) {
  const generatedId = useId();
  const controlId = `input-${generatedId}`;
  const describedById = error ? `${controlId}-error` : helpText ? `${controlId}-help` : undefined;
  const hasError = Boolean(error);

  const borderClass = hasError
    ? 'border-accent-danger focus-visible:ring-accent-danger/40'
    : 'border-line hover:border-line-strong';

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={controlId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={controlId}
        className={`${CONTROL_CLASSES} ${borderClass}`}
        value={value}
        aria-invalid={hasError}
        aria-describedby={describedById}
        onChange={handleChange}
        {...rest}
      />
      {hasError ? (
        <p id={`${controlId}-error`} className="text-xs text-accent-danger">
          {error}
        </p>
      ) : helpText ? (
        <p id={`${controlId}-help`} className="text-xs text-ink-faint">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
