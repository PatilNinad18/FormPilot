import { useId } from 'react';
import type { ChangeEvent } from 'react';
import type { FieldDescriptor, FieldFormat } from '@/types/profile';

/**
 * Controlled input bound to a {@link FieldDescriptor}. Maps the field's semantic
 * `format` to the correct HTML input type, `inputmode`, and `autocomplete`
 * token, and wires label/help/error together for accessibility. `multiline`
 * renders a textarea; every other format renders an <input>.
 */

interface TextFieldProps {
  readonly descriptor: FieldDescriptor;
  readonly value: string;
  readonly error?: string | null;
  readonly onChange: (key: FieldDescriptor['key'], value: string) => void;
  readonly onBlur?: (key: FieldDescriptor['key']) => void;
}

/**
 * Map a semantic field format to a concrete HTML input `type`. Formats not
 * listed fall back to a plain text input.
 */
const INPUT_TYPE_BY_FORMAT: Partial<Record<FieldFormat, string>> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  date: 'date',
  number: 'number',
};

function inputTypeFor(format: FieldFormat): string {
  return INPUT_TYPE_BY_FORMAT[format] ?? 'text';
}

/** Hint mobile/soft keyboards where it helps; undefined otherwise. */
const INPUT_MODE_BY_FORMAT: Partial<Record<FieldFormat, 'email' | 'tel' | 'url' | 'numeric'>> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  number: 'numeric',
};

function inputModeFor(format: FieldFormat): 'email' | 'tel' | 'url' | 'numeric' | undefined {
  return INPUT_MODE_BY_FORMAT[format];
}

const CONTROL_CLASSES =
  'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

export function TextField({ descriptor, value, error, onChange, onBlur }: TextFieldProps) {
  const generatedId = useId();
  const controlId = `field-${descriptor.key}-${generatedId}`;
  const describedById = error ? `${controlId}-error` : descriptor.helpText ? `${controlId}-help` : undefined;
  const hasError = Boolean(error);

  const borderClass = hasError
    ? 'border-accent-danger focus-visible:ring-accent-danger/40'
    : 'border-line hover:border-line-strong';

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    onChange(descriptor.key, event.target.value);
  }

  function handleBlur(): void {
    onBlur?.(descriptor.key);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={controlId} className="text-xs font-medium text-ink-muted">
        {descriptor.label}
        {descriptor.required ? <span className="ml-0.5 text-accent-danger">*</span> : null}
      </label>

      {descriptor.format === 'multiline' ? (
        <textarea
          id={controlId}
          className={`${CONTROL_CLASSES} ${borderClass} min-h-[68px] resize-y`}
          value={value}
          placeholder={descriptor.placeholder}
          autoComplete={descriptor.autoComplete}
          maxLength={descriptor.maxLength}
          aria-invalid={hasError}
          aria-describedby={describedById}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      ) : (
        <input
          id={controlId}
          type={inputTypeFor(descriptor.format)}
          inputMode={inputModeFor(descriptor.format)}
          className={`${CONTROL_CLASSES} ${borderClass}`}
          value={value}
          placeholder={descriptor.placeholder}
          autoComplete={descriptor.autoComplete}
          maxLength={descriptor.maxLength}
          aria-invalid={hasError}
          aria-describedby={describedById}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      )}

      {hasError ? (
        <p id={`${controlId}-error`} className="text-xs text-accent-danger">
          {error}
        </p>
      ) : descriptor.helpText ? (
        <p id={`${controlId}-help`} className="text-xs text-ink-faint">
          {descriptor.helpText}
        </p>
      ) : null}
    </div>
  );
}
