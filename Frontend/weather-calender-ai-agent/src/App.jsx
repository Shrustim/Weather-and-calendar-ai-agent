import React, { useEffect, useMemo, useRef, useState } from "react";
import "./app.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

function generateSessionId() {
  const rand = Math.random().toString(16).slice(2, 10);
  return `user-${rand}`;
}

function nowTimeLabel(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [lastMeta, setLastMeta] = useState(null);

  const [messages, setMessages] = useState(() => [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text:
        "Hi! I’m your AI Agent demo (Weather + Calendar).\n\nTry:\n• Weather in Nagpur today?\n• Show my calendar events for tomorrow between 10am and 6pm IST",
      createdAt: Date.now()
    }
  ]);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = [
    "Weather in Nagpur today?",
    "Weather in Pune, IN",
    "Show my calendar events for tomorrow between 10am and 6pm IST",
    "Create a calendar event tomorrow 5pm-6pm IST titled 'English practice'"
  ];

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  async function sendMessage(text) {
    const userText = text.trim();
    if (!userText) return;

    setError("");
    setLastMeta(null);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: userText, createdAt: Date.now() }
    ]);

    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userText })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const msg = data?.error
          ? typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error)
          : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.answer || "No answer received.",
          createdAt: Date.now()
        }
      ]);

      setLastMeta({
        toolHops: data?.meta?.toolHops ?? 0,
        correlationId: data?.correlationId || ""
      });
    } catch (e) {
      const msg = e?.message || "Something went wrong.";
      setError(msg);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text:
            "I couldn’t reach the backend.\n\nCheck:\n• Backend running on http://localhost:8080\n• CORS allowed in backend\n• API URL is correct\n\nError: " +
            msg,
          createdAt: Date.now()
        }
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!canSend) return;
    sendMessage(input);
  }

  function newChat() {
    setError("");
    setLastMeta(null);
    setSessionId(generateSessionId());
    setInput("");
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text:
          "New chat started ✅\n\nAsk:\n• Weather (e.g. “Weather in Mumbai?”)\n• Calendar (e.g. “List my calendar events tomorrow”)",
        createdAt: Date.now()
      }
    ]);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function copySession() {
    navigator.clipboard?.writeText(sessionId);
  }

  return (
    <div className="page">
      <div className="bgGlow" />

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="titleBlock">
            <div className="titleRow">
              <h1 className="title">AI Agent Demo</h1>
              <span className="pill">Weather + Calendar</span>
            </div>
            <p className="subtitle">
              Chat UI connected to your Node.js agent API. Keep the same sessionId to observe temporary memory.
            </p>
          </div>

          <button className="btnPrimary" onClick={newChat}>
            New Chat
          </button>
        </header>

        {/* Session */}
        <section className="card">
          <div className="sessionRow">
            <div>
              <div className="label">Session</div>
              <div className="hint">Use same sessionId to keep temporary memory in backend.</div>
            </div>

            <div className="sessionInputRow">
              <div className="inputGroup">
                <label className="smallLabel">sessionId</label>
                <input
                  className="input"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="user-123456"
                />
              </div>

              <button className="btnGhost" onClick={copySession} title="Copy sessionId">
                Copy
              </button>
            </div>
          </div>

          <div className="metaRow">
            <div className="metaLeft">
              <span className="metaPill">
                API: <b>{API_BASE}</b>
              </span>

              {lastMeta?.toolHops !== undefined && (
                <span className="metaPill">
                  toolHops: <b>{lastMeta.toolHops}</b>
                </span>
              )}

              {lastMeta?.correlationId && (
                <span className="metaPill">
                  correlationId: <b>{lastMeta.correlationId}</b>
                </span>
              )}
            </div>

            {error && <div className="errorBox">{error}</div>}
          </div>
        </section>

        {/* Suggestions */}
        <section className="suggestions">
          <div className="label">Try these</div>
          <div className="chipRow">
            {suggestions.map((s) => (
              <button key={s} className="chip" onClick={() => sendMessage(s)} disabled={isSending}>
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Chat */}
        <main className="chatCard">
          <div className="chatList" ref={listRef}>
            {messages.map((m) => (
              <ChatBubble key={m.id} role={m.role} text={m.text} time={nowTimeLabel(m.createdAt)} />
            ))}

            {isSending && (
              <div className="typingRow">
                <div className="spinner" />
                <div className="typingText">Agent is thinking…</div>
              </div>
            )}
          </div>

          <form className="composer" onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              className="textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about weather or calendar…"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) sendMessage(input);
                }
              }}
            />

            <button className="btnPrimary" type="submit" disabled={!canSend}>
              Send
            </button>
          </form>

          <div className="composerHint">Enter to send • Shift+Enter for new line</div>
        </main>

        <footer className="footer">
          Tip: Keep same <b>sessionId</b> to see memory. Click <b>New Chat</b> to start fresh.
        </footer>
      </div>
    </div>
  );
}

function ChatBubble({ role, text, time }) {
  const isUser = role === "user";

  return (
    <div className={`bubbleRow ${isUser ? "right" : "left"}`}>
      <div className={`bubble ${isUser ? "user" : "assistant"}`}>
        <div className="bubbleText">{text}</div>
        <div className="bubbleTime">{time}</div>
      </div>
    </div>
  );
}