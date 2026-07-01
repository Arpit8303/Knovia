import React, { useState, useRef } from 'react';

const STEPS = [
  { key: 'extract', label: 'Extracting text from document...' },
  { key: 'chunk',   label: 'Splitting into chunks...' },
  { key: 'embed',   label: 'Generating embeddings via Cohere...' },
  { key: 'save',    label: 'Saving to MongoDB Atlas...' },
];

export default function FileUpload({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(-1); // -1 = not started
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleFile = async (file) => {
    if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
      setError('Only PDF and TXT files are allowed.');
      return;
    }
    setError(null);
    setFileName(file.name);
    setUploading(true);
    setStep(0);

    // Animate steps while upload is in progress
    const stepTimer = (i) => setTimeout(() => setStep(i), i * 1200);
    [1, 2, 3].forEach(i => stepTimer(i));

    const formData = new FormData();
    formData.append('document', file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Brief pause so user sees step 4 complete
      await new Promise(r => setTimeout(r, 600));
      onUploadSuccess({ fileName: data.fileName, chunkCount: data.chunkCount });
    } catch (err) {
      setError(err.message);
      setUploading(false);
      setStep(-1);
    }
  };

  /* ── PROCESSING VIEW ── */
  if (uploading) {
    const progress = Math.min(((step + 1) / STEPS.length) * 100, 95);
    return (
      <div className="processing-center">
        <div style={{ textAlign: 'center' }}>
          <div className="proc-title">Processing {fileName}</div>
          <div className="proc-sub" style={{ marginTop: 4 }}>Please wait while we index your document…</div>
        </div>

        <div className="prog-bar">
          <div className="prog-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="proc-steps">
          {STEPS.map((s, i) => {
            const status = i < step ? 'done' : i === step ? 'active' : 'wait';
            const icon = status === 'done' ? '✅' : status === 'active' ? '⚡' : '⏳';
            return (
              <div className="proc-step" key={s.key}>
                <div className={`p-icon ${status}`}>{icon}</div>
                <div className={`p-text ${status}`}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── UPLOAD DROPZONE ── */
  return (
    <div className="upload-center">
      <input
        ref={inputRef}
        type="file"
        className="file-input-hidden"
        accept=".pdf,.txt"
        onChange={handleChange}
      />

      <div
        className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <span className="drop-icon">📂</span>
        <div className="drop-title">Drop your document here</div>
        <div className="drop-sub">
          Drag &amp; drop a PDF or TXT file, or click to browse
        </div>
        <button className="drop-btn" onClick={() => inputRef.current.click()}>
          Choose File
        </button>

        <div className="fmt-row">
          <div className="fmt-pill">📄 PDF</div>
          <div className="fmt-pill">📝 TXT</div>
        </div>

        {error && <div className="upload-error">⚠ {error}</div>}

        {dragActive && (
          <div
            className="drag-overlay"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          />
        )}
      </div>
    </div>
  );
}
