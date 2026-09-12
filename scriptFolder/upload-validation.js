// ─────────────────────────────────────────────
//  upload-validation.js — shared client-side upload checks
//
//  The `accept="image/*"` attribute on a file input is a picker hint only and
//  is trivially bypassed (drag-drop, devtools, a scripted change event), so
//  every upload path re-checks size and type here before touching Storage.
//  This is a usability/quota guard, NOT a security boundary — the real limit
//  belongs in Firebase Storage rules (see FIREBASE_RULES_POINTS.md).
// ─────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;   // 10MB — post covers & attachments
export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;  // 8MB  — points request evidence

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// Matches the "ZIP, PDF, DOCX" wording shown on the attachment dropzones.
export const DOC_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
export const DOC_EXTENSIONS = ['.pdf', '.zip', '.docx'];

export const EVIDENCE_TYPES = [...IMAGE_TYPES, 'application/pdf'];
export const EVIDENCE_EXTENSIONS = [...IMAGE_EXTENSIONS, '.pdf'];

/**
 * Returns an error message string if the file should be rejected, or null if
 * it is acceptable. The extension is checked as well as the MIME type because
 * browsers report .zip/.docx types inconsistently across operating systems,
 * and some report an empty string for both.
 */
export function validateUploadFile(file, { allowedTypes, allowedExtensions, maxBytes }) {
  if (!file) return 'No file selected.';
  if (typeof file.size === 'number' && file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    return `"${file.name}" is too large (max ${limitMb}MB).`;
  }
  const lowerName = String(file.name || '').toLowerCase();
  const typeOk = allowedTypes.includes(file.type);
  const extOk = allowedExtensions.some(ext => lowerName.endsWith(ext));
  if (!typeOk && !extOk) {
    return `"${file.name}" is not an accepted file type.`;
  }
  return null;
}

export function validateImageFile(file) {
  return validateUploadFile(file, {
    allowedTypes: IMAGE_TYPES,
    allowedExtensions: IMAGE_EXTENSIONS,
    maxBytes: MAX_UPLOAD_BYTES
  });
}

export function validateDocFile(file) {
  return validateUploadFile(file, {
    allowedTypes: DOC_TYPES,
    allowedExtensions: DOC_EXTENSIONS,
    maxBytes: MAX_UPLOAD_BYTES
  });
}

export function validateEvidenceFile(file) {
  return validateUploadFile(file, {
    allowedTypes: EVIDENCE_TYPES,
    allowedExtensions: EVIDENCE_EXTENSIONS,
    maxBytes: MAX_EVIDENCE_BYTES
  });
}
