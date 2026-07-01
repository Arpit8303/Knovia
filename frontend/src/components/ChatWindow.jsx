import React, { useState, useRef, useEffect } from 'react';

export default function ChatWindow({ llmProvider, activeDoc }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am Knovia. I have read **${activeDoc?.fileName}**. What would you like to know?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, llmProvider, docId: activeDoc?.fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ Error: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      {/* Context bar */}
      <div className="chat-ctx-bar">
        <span>Chatting with</span>
        <span className="chat-ctx-doc">{activeDoc?.fileName}</span>
        <span className="chat-ctx-pill">{activeDoc?.chunkCount} chunks indexed</span>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`msg-group ${msg.role}`}>
            <div className="bubble">
              {/* Render simple markdown bold */}
              {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                /^\*\*/.test(part)
                  ? <strong key={i}>{part.replace(/\*\*/g, '')}</strong>
                  : part
              )}
            </div>

            {/* Citations (green cards) */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="cite-section">
                <span className="cite-label">Sources from document</span>
                {msg.citations.map((c, i) => (
                  <div key={i} className="cite-card">
                    <div className="cite-top">
                      <span className="cite-num">[{i + 1}]</span>
                      <span className="cite-src">Chunk {i + 1}</span>
                    </div>
                    <div className="cite-text">"{c.text}"</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="msg-group assistant">
            <div className="bubble typing-bubble">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-input-bar" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about the document…"
          disabled={loading}
        />
        <button type="submit" className="send-btn" disabled={loading || !input.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
