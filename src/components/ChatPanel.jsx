import { useEffect, useRef, useState } from "react";

const ENV_API_BASE_URL = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URLS = ENV_API_BASE_URL
  ? [ENV_API_BASE_URL]
  : ["http://127.0.0.1:8000", "http://localhost:8000"];
const CHAT_STORAGE_KEY = "keanglobal_chat_messages";

function shouldOpenMapFromResponse(data, answerText) {
  if (data?.intent === "location") return true;
  if (data?.destination_id) return true;
  const text = (answerText || "").toLowerCase();
  return (
    text.includes("opening map") ||
    text.includes("abriendo mapa") ||
    text.includes("harita açılıyor") ||
    text.includes("正在打开地图")
  );
}

function renderBotMessage(message, onSelectSuggestion) {
  const text = message?.text || "";
  const foodSuggestions = Array.isArray(message?.foodSuggestions) ? message.foodSuggestions : [];
  const lines = String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const listItems = [];
  let currentItem = null;

  for (const line of lines) {
    if (/^\d+\.\s+/.test(line)) {
      if (currentItem) listItems.push(currentItem);
      currentItem = { body: line.replace(/^\d+\.\s+/, "").trim(), source: "" };
      continue;
    }
    if (/^source:\s*/i.test(line)) {
      if (currentItem) {
        currentItem.source = line.replace(/^source:\s*/i, "").trim();
      }
      continue;
    }
    if (currentItem) {
      currentItem.body = `${currentItem.body} ${line}`.trim();
    }
  }

  if (currentItem) listItems.push(currentItem);
  if (!listItems.length) {
    return (
      <>
        <div>{text}</div>
        {foodSuggestions.length > 0 && (
          <div className="chat-suggestion-group">
            {foodSuggestions.map(suggestion => (
              <button
                key={suggestion.id}
                type="button"
                className="btn-secondary chat-suggestion-btn"
                onClick={() => onSelectSuggestion(suggestion)}
              >
                {suggestion.name}
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="bot-rich-msg">
      <div className="bot-rich-intro">{lines[0]}</div>
      <ol className="bot-rich-list">
        {listItems.map((item, index) => (
          <li key={`${item.body}-${index}`} className="bot-rich-item">
            <div>{item.body}</div>
            {item.source && <div className="bot-rich-source">Source: {item.source}</div>}
          </li>
        ))}
      </ol>
      {foodSuggestions.length > 0 && (
        <div className="chat-suggestion-group">
          {foodSuggestions.map(suggestion => (
            <button
              key={suggestion.id}
              type="button"
              className="btn-secondary chat-suggestion-btn"
              onClick={() => onSelectSuggestion(suggestion)}
            >
              {suggestion.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function ChatPanel({ setShowMap, setRouteRequest }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);
  const pendingUserMessageRef = useRef("");

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  async function sendMessage() {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    setMessages(prev => [...prev, { text: userMessage, sender: "user" }]);
    setInput("");
    setLoading(true);
    pendingUserMessageRef.current = userMessage;
    abortControllerRef.current = new AbortController();

    try {
      let response = null;
      let data = {};
      let lastNetworkError = null;

      for (const baseUrl of API_BASE_URLS) {
        try {
          response = await fetch(`${baseUrl}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage }),
            signal: abortControllerRef.current.signal
          });
          data = await response.json().catch(() => ({}));
          lastNetworkError = null;
          break;
        } catch (error) {
          lastNetworkError = error;
        }
      }

      if (lastNetworkError) {
        throw lastNetworkError;
      }

      if (!response?.ok) {
        throw new Error(data?.detail || "Request failed.");
      }

      const answerText = data.answer || data.reply || "No response from backend.";
      setMessages(prev => [
        ...prev,
        {
          text: answerText,
          sender: "bot",
          foodSuggestions: Array.isArray(data.food_suggestions) ? data.food_suggestions : []
        }
      ]);
      const openMap = shouldOpenMapFromResponse(data, answerText);
      setShowMap(openMap);
      if (openMap) {
        setRouteRequest({
          destinationId: data.destination_id || null,
          useCurrentLocation: Boolean(data.use_current_location),
          locationMode: data.location_mode || "highlight"
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const errorText =
        error instanceof Error
          ? error.message
          : "Backend unavailable. Start FastAPI and Ollama.";

      setMessages(prev => [
        ...prev,
        {
          text: `Error: ${errorText}`,
          sender: "bot"
        }
      ]);
      setShowMap(false);
      setRouteRequest(null);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      pendingUserMessageRef.current = "";
    }
  }

  function cancelSend() {
    if (!loading) return;

    const pendingMessage = pendingUserMessageRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.sender === "user" && last.text === pendingMessage) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    setInput(pendingMessage);
    setLoading(false);
    abortControllerRef.current = null;
    pendingUserMessageRef.current = "";
  }

  function clearHistory() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setInput("");
    setLoading(false);
    setShowMap(false);
    setRouteRequest(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    abortControllerRef.current = null;
    pendingUserMessageRef.current = "";
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      sendMessage();
    }
  }

  function selectFoodSuggestion(suggestion) {
    if (!suggestion?.id) return;
    setShowMap(true);
    setRouteRequest({
      destinationId: suggestion.id,
      useCurrentLocation: false,
      locationMode: "highlight"
    });
  }

  return (
    <div className="panel chat-panel">
      <div className="map-header">
        <h3 className="panel-title">Campus Concierge</h3>
        <button className="btn-secondary" type="button" onClick={clearHistory}>
          Clear Chat
        </button>
      </div>

      <div className="chat-box">
        {loading && <div className="spinner"></div>}

        {messages.map((m, i) => (
          <div key={i} className={m.sender === "user" ? "msg-user" : "msg-bot"}>
            {m.sender === "bot" ? renderBotMessage(m, selectFoodSuggestion) : m.text}
          </div>
        ))}
      </div>

      <div className="input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about Kean University..."
        />

        <button className="btn-primary" onClick={sendMessage} disabled={loading}>
          Send
        </button>
        {loading && (
          <button className="btn-secondary" type="button" onClick={cancelSend}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatPanel;
