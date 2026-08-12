import { Button } from '@components/ui/Button';
import { TextInput } from '@components/ui/TextInput';
import { createId } from '@shared/utils/id';
import type { CustomField } from '@/types/profile';

/**
 * Custom Fields manager.
 *
 * Lets the user define arbitrary fields (label + value + alias keywords) that
 * participate in autofill exactly like built-in ones — the engine never learns
 * their names. The editor is *controlled*: it works in a {@link CustomFieldDraft}
 * shape where aliases are raw comma-separated text, so typing commas feels
 * natural. ProfileScreen owns the draft array and converts to {@link CustomField}
 * only at save time (via {@link draftsToCustomFields}), keeping one Save button
 * for the whole profile.
 */

/** Editable representation of a custom field: aliases held as raw text. */
export interface CustomFieldDraft {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly aliasesText: string;
  readonly enabled: boolean;
}

/** Split the aliases text field into clean, de-duplicated phrases. */
function parseAliases(text: string): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const part of text.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(trimmed);
  }
  return aliases;
}

/** Seed the editor from persisted custom fields. */
export function customFieldsToDrafts(fields: readonly CustomField[]): CustomFieldDraft[] {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    value: field.value,
    aliasesText: field.aliases.join(', '),
    enabled: field.enabled,
  }));
}

/**
 * Convert drafts back to persisted custom fields, dropping rows with no label
 * (an empty label can never match and would just be noise in storage).
 */
export function draftsToCustomFields(drafts: readonly CustomFieldDraft[]): CustomField[] {
  const fields: CustomField[] = [];
  for (const draft of drafts) {
    if (draft.label.trim() === '') continue;
    fields.push({
      id: draft.id,
      label: draft.label.trim(),
      value: draft.value,
      aliases: parseAliases(draft.aliasesText),
      enabled: draft.enabled,
    });
  }
  return fields;
}

function createDraft(): CustomFieldDraft {
  return { id: createId(), label: '', value: '', aliasesText: '', enabled: true };
}

interface CustomFieldsEditorProps {
  readonly drafts: readonly CustomFieldDraft[];
  readonly onChange: (next: readonly CustomFieldDraft[]) => void;
}

export function CustomFieldsEditor({ drafts, onChange }: CustomFieldsEditorProps) {
  function patch(id: string, changes: Partial<CustomFieldDraft>): void {
    onChange(drafts.map((draft) => (draft.id === id ? { ...draft, ...changes } : draft)));
  }

  function remove(id: string): void {
    onChange(drafts.filter((draft) => draft.id !== id));
  }

  function add(): void {
    onChange([...drafts, createDraft()]);
  }

  return (
    <div className="flex flex-col gap-3">
      {drafts.length === 0 ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-faint">
          No custom fields yet. Add one for anything the built-in fields don&apos;t cover, like
          &ldquo;Father&apos;s Name&rdquo; or &ldquo;Portfolio&rdquo;.
        </p>
      ) : null}

      {drafts.map((draft) => (
        <div
          key={draft.id}
          className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised p-3"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <TextInput
                label="Field name"
                value={draft.label}
                placeholder="e.g. Father's Name"
                maxLength={80}
                onChange={(value) => patch(draft.id, { label: value })}
              />
            </div>
            <Button
              type="button"
              variant="danger"
              className="mt-5 shrink-0 px-2"
              aria-label="Delete custom field"
              onClick={() => remove(draft.id)}
            >
              Delete
            </Button>
          </div>

          <TextInput
            label="Value"
            value={draft.value}
            placeholder="What should be filled in"
            maxLength={500}
            onChange={(value) => patch(draft.id, { value })}
          />

          <TextInput
            label="Aliases"
            value={draft.aliasesText}
            placeholder="guardian name, parent name"
            helpText="Comma-separated keywords that should also match this field."
            onChange={(value) => patch(draft.id, { aliasesText: value })}
          />

          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line accent-brand"
              checked={draft.enabled}
              onChange={(event) => patch(draft.id, { enabled: event.target.checked })}
            />
            Enabled for autofill
          </label>
        </div>
      ))}

      <div>
        <Button type="button" variant="secondary" onClick={add}>
          + Add custom field
        </Button>
      </div>
    </div>
  );
}
