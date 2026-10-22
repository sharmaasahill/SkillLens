import React, { useId, useState } from 'react';
import { Spinner, cx } from './primitives';

const MAX_BYTES = 16 * 1024 * 1024;

/** Validate a picked file the same way everywhere: PDF only, 16 MB max. Returns an error string or ''. */
export function pdfError(file) {
  if (!file) return '';
  if (file.type !== 'application/pdf') return 'Please upload a PDF file';
  if (file.size > MAX_BYTES) return 'File size should be less than 16MB';
  return '';
}

/** Drag-and-drop or click-to-pick area for a single PDF. */
function Dropzone({ onFile, busy = false, busyLabel = 'Uploading...', file, title = 'Drop your resume here', compact = false, inputId }) {
  const fallbackId = useId();
  const id = inputId || fallbackId;
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    if (busy || !files || !files[0]) return;
    onFile(files[0]);
  };

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={cx(
        'group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed text-center transition-colors duration-300',
        compact ? 'px-6 py-8' : 'px-6 py-14',
        dragging ? 'border-blue bg-blue-soft' : 'border-hairline bg-mist/60 hover:border-blue/50 hover:bg-blue-soft/50',
        busy && 'pointer-events-none'
      )}
    >
      <input
        id={id}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        disabled={busy}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      {busy && <Spinner className="mb-1 h-6 w-6 text-blue" />}
      <p className="mt-1 font-display text-[19px] font-semibold tracking-tight text-ink">
        {busy ? busyLabel : file ? file.name : title}
      </p>
      <p className="mt-1 text-[14px] text-graphite">
        {busy ? 'This usually takes a few seconds.' : (
          <>or <span className="text-action-link">choose a file</span>. PDF only, up to 16 MB.</>
        )}
      </p>
    </label>
  );
}

export default Dropzone;
