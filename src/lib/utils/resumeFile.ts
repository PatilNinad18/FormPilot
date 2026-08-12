import {
  ACCEPTED_RESUME_EXTENSIONS,
  ACCEPTED_RESUME_MIME_TYPES,
  MAX_RESUME_BYTES,
} from '@constants/resume';
import type { ResumeFile } from '@/types/resume';

/**
 * Turn a browser {@link File} (from an <input type="file">) into the storable
 * {@link ResumeFile} shape, validating type and size first.
 *
 * Lives in the shared lib rather than the screen so the read/validate logic is
 * reusable and testable, and the screen stays declarative. Uses only browser
 * APIs available in the popup (FileReader); it never uploads anything — the
 * bytes are encoded to a local data URL and handed straight to storage.
 */

/** Human-readable ceiling for messages, derived from the byte constant. */
const MAX_RESUME_MB = Math.round(MAX_RESUME_BYTES / (1024 * 1024));

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Whether the picked file looks like an accepted resume by MIME or extension. */
export function isAcceptedResume(file: File): boolean {
  if (file.type !== '' && ACCEPTED_RESUME_MIME_TYPES.includes(file.type)) return true;
  return hasAcceptedExtension(file.name);
}

/** Read the file's bytes as a base64 `data:` URL. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Could not read the selected file.'));
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validate and read a resume file. Rejects with a user-facing message when the
 * file is the wrong type or too large, so callers can surface `error.message`
 * directly.
 */
export async function readResumeFile(file: File): Promise<ResumeFile> {
  if (!isAcceptedResume(file)) {
    throw new Error('Unsupported file type. Please choose a PDF or Word document.');
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error(`That file is too large. Please keep resumes under ${MAX_RESUME_MB} MB.`);
  }
  const dataUrl = await readAsDataUrl(file);
  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    dataUrl,
  };
}
