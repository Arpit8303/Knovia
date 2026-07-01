import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ChatWindow from './components/ChatWindow';
import './index.css';

function App() {
  // docs = array of { fileName, chunkCount }
  const [docs, setDocs] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [llmProvider, setLlmProvider] = useState('gemini');
  const [showUpload, setShowUpload] = useState(false);

  const handleUploadSuccess = (info) => {
    const newDoc = { fileName: info.fileName, chunkCount: info.chunkCount };
    setDocs(prev => [...prev, newDoc]);
    setActiveDoc(newDoc);
    setShowUpload(false);
  };

  const noDocs = docs.length === 0;

  return (
    <div className="app-container">
      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="logo">
          <span className="logo-dot" />
          Knovia
        </div>
        <div className="llm-selector">
          <label htmlFor="llm-select">Model:</label>
          <select 
            id="llm-select" 
            value={llmProvider} 
            onChange={(e) => setLlmProvider(e.target.value)}
          >
            <option value="gemini">Gemini 1.5 Flash</option>
            <option value="nvidia">Nvidia NIM (Llama 3)</option>
          </select>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="app-body">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <span className="slabel">Documents</span>

          {/* Upload button in sidebar */}
          <div
            className="sidebar-upload-btn"
            onClick={() => setShowUpload(true)}
            role="button"
          >
            <span>📄</span>
            <span>Upload new file</span>
          </div>

          {/* Doc list */}
          {noDocs ? (
            <div className="sidebar-empty">No documents yet.<br />Upload a file to begin.</div>
          ) : (
            docs.map((doc, i) => (
              <div
                key={i}
                className={`doc-item ${activeDoc?.fileName === doc.fileName ? 'active' : ''}`}
                onClick={() => { setActiveDoc(doc); setShowUpload(false); }}
              >
                <span className="doc-icon">📑</span>
                <div className="doc-info">
                  <div className="doc-name">{doc.fileName}</div>
                  <div className="doc-meta">{doc.chunkCount} chunks</div>
                </div>
                <span className="doc-dot" />
              </div>
            ))
          )}
        </aside>

        {/* ── MAIN ── */}
        <main className="app-main">
          {(noDocs || showUpload) ? (
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          ) : (
            activeDoc && <ChatWindow llmProvider={llmProvider} activeDoc={activeDoc} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
