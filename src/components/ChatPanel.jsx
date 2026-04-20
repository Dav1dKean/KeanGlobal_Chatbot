import { Maximize2, MessageCircle, Mic, Minimize2, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import chatbotButtonImage from "../assets/Chatbot Button.png";
import { API_BASE_URLS } from "../lib/api";

const CHAT_STORAGE_KEY = "keanglobal_chat_messages";
const CHAT_SESSION_KEY = "keanglobal_chat_session_id";
const URL_PATTERN = /((?:https?:\/\/)[^\s]+)([.,;:!?)]*)(?=\s|$)/gi;
const DEFAULT_GREETING = {
  text: "Hello! How can I help you today? I can answer questions about Kean University and help with campus locations and directions.",
  sender: "bot"
};
const SPEECH_LANGUAGE_MAP = {
  en: { code: "en-US", label: "English", alternates: ["en"] },
  es: { code: "es-ES", label: "Spanish", alternates: ["es-US", "es"] },
  zh: { code: "zh-CN", label: "Mandarin", alternates: ["zh-TW", "zh"] },
  ko: { code: "ko-KR", label: "Korean", alternates: ["ko"] },
  tr: { code: "tr-TR", label: "Turkish", alternates: ["tr"] },
  ur: { code: "ur-PK", label: "Urdu", alternates: ["ur-IN", "ur"] }
};
const VOICE_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
  { value: "zh", label: "ZH" },
  { value: "ko", label: "KO" },
  { value: "tr", label: "TR" },
  { value: "ur", label: "UR" }
];

function createChatSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function detectSpeechLanguage(text, fallbackLanguage = "") {
  const sample = String(text || "").trim();
  const normalized = sample.toLowerCase();
  const fallback = String(fallbackLanguage || "").toLowerCase();

  if (/[\uac00-\ud7af]/.test(sample)) return SPEECH_LANGUAGE_MAP.ko;
  if (/[\u4e00-\u9fff]/.test(sample)) return SPEECH_LANGUAGE_MAP.zh;
  if (/[\u0600-\u06ff]/.test(sample)) return SPEECH_LANGUAGE_MAP.ur;

  if (
    /\b(cuando|cuándo|donde|dónde|quien|quién|eres|hola|admisiones|matricula|matrícula|programa|universidad|biblioteca|horario)\b/.test(normalized)
  ) {
    return SPEECH_LANGUAGE_MAP.es;
  }
  if (
    /\b(merhaba|universite|üniversite|kayit|kayıt|bolum|bölüm|programi|programı|saat)\b/.test(normalized)
  ) {
    return SPEECH_LANGUAGE_MAP.tr;
  }

  if (fallback.startsWith("es")) return SPEECH_LANGUAGE_MAP.es;
  if (fallback.startsWith("zh")) return SPEECH_LANGUAGE_MAP.zh;
  if (fallback.startsWith("ko")) return SPEECH_LANGUAGE_MAP.ko;
  if (fallback.startsWith("tr")) return SPEECH_LANGUAGE_MAP.tr;
  if (fallback.startsWith("ur")) return SPEECH_LANGUAGE_MAP.ur;
  return SPEECH_LANGUAGE_MAP.en;
}

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

function renderLinkedText(text) {
  const content = String(text || "");
  const parts = [];
  let lastIndex = 0;

  content.replace(URL_PATTERN, (match, url, trailing, offset) => {
    if (offset > lastIndex) {
      parts.push(content.slice(lastIndex, offset));
    }
    parts.push(
      <a
        key={`${url}-${offset}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="chat-link"
      >
        {url}
      </a>
    );
    if (trailing) {
      parts.push(trailing);
    }
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex === 0) {
    return content;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts;
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
        <div>{renderLinkedText(text)}</div>
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
      <div className="bot-rich-intro">{renderLinkedText(lines[0])}</div>
      <ol className="bot-rich-list">
        {listItems.map((item, index) => (
          <li key={`${item.body}-${index}`} className="bot-rich-item">
            <div>{renderLinkedText(item.body)}</div>
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


function ChatPanel({
  setShowMap,
  setRouteRequest,
  externalBotMessage = null,
  viewMode = "full",
  onViewModeChange = () => {}
}) {
  const isCompact = viewMode === "compact";
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [DEFAULT_GREETING];
    } catch {
      return [DEFAULT_GREETING];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState("auto");
  const abortControllerRef = useRef(null);
  const pendingUserMessageRef = useRef("");
  const recognitionRef = useRef(null);
  const currentInputRef = useRef("");
  const loadingRef = useRef(false);
  const lastUserLanguageRef = useRef(navigator.language || "en-US");
  const sendMessageRef = useRef(() => {});
  const voiceTranscriptRef = useRef("");
  const shouldAutoSendVoiceRef = useRef(false);
  const speechAttemptRef = useRef(0);
  const shouldRestartVoiceRef = useRef(false);
  const lastExternalMessageIdRef = useRef(null);
  const routeRequestCounterRef = useRef(0);
  const chatBoxRef = useRef(null);
  const sessionIdRef = useRef("");
  const [isCompactOpen, setIsCompactOpen] = useState(true);
  const [showCompactCallout, setShowCompactCallout] = useState(true);

  if (!sessionIdRef.current) {
    try {
      const storedSessionId = localStorage.getItem(CHAT_SESSION_KEY);
      if (storedSessionId) {
        sessionIdRef.current = storedSessionId;
      } else {
        sessionIdRef.current = createChatSessionId();
        localStorage.setItem(CHAT_SESSION_KEY, sessionIdRef.current);
      }
    } catch {
      sessionIdRef.current = createChatSessionId();
    }
  }

  function applyRecognitionLanguage(recognition, sampleText = "") {
    const language = getActiveSpeechLanguage(sampleText);
    const attempts = [language.code, ...(language.alternates || [])];
    const index = Math.min(speechAttemptRef.current, attempts.length - 1);
    recognition.lang = attempts[index];
    return { label: language.label, code: attempts[index], hasFallback: index < attempts.length - 1 };
  }

  function getActiveSpeechLanguage(sampleText = "") {
    if (voiceLanguage !== "auto") {
      return SPEECH_LANGUAGE_MAP[voiceLanguage] || SPEECH_LANGUAGE_MAP.en;
    }
    return detectSpeechLanguage(sampleText, lastUserLanguageRef.current);
  }

  useEffect(() => {
    currentInputRef.current = input;
    loadingRef.current = loading;
  }, [input, loading]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    applyRecognitionLanguage(recognition, "");

    recognition.onstart = () => {
      setListening(true);
      const activeLanguage = applyRecognitionLanguage(recognition, currentInputRef.current);
      setVoiceStatus(`Listening in ${activeLanguage.label}...`);
    };

    recognition.onresult = event => {
      let transcript = "";
      let finalTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const chunk = event.results[index][0]?.transcript || "";
        transcript += chunk;
        if (event.results[index].isFinal) {
          finalTranscript += chunk;
        }
      }
      const nextTranscript = transcript.trim();
      if (nextTranscript) {
        setInput(nextTranscript);
        voiceTranscriptRef.current = nextTranscript;
      }
      if (finalTranscript.trim()) {
        voiceTranscriptRef.current = finalTranscript.trim();
      }
    };

    recognition.onerror = event => {
      if (event.error === "language-not-supported") {
        const activeLanguage = applyRecognitionLanguage(recognition, currentInputRef.current);
        if (activeLanguage.hasFallback) {
          speechAttemptRef.current += 1;
          shouldRestartVoiceRef.current = true;
          setListening(false);
          setVoiceStatus(`Trying another ${activeLanguage.label} voice locale...`);
          return;
        }
      }
      shouldAutoSendVoiceRef.current = false;
      const nextMessage =
        event.error === "not-allowed"
          ? "Microphone access was blocked. Please allow microphone access in your browser."
          : event.error === "no-speech"
          ? "I didn't hear anything. Try again and speak clearly."
          : "Voice input is temporarily unavailable.";
      setListening(false);
      setVoiceStatus(nextMessage);
    };

    recognition.onend = () => {
      setListening(false);
      if (shouldRestartVoiceRef.current) {
        shouldRestartVoiceRef.current = false;
        try {
          applyRecognitionLanguage(recognition, currentInputRef.current);
          recognition.start();
          return;
        } catch {
          setVoiceStatus("Voice input is temporarily unavailable.");
        }
      }
      const transcript = voiceTranscriptRef.current.trim();
      if (shouldAutoSendVoiceRef.current && transcript) {
        shouldAutoSendVoiceRef.current = false;
        voiceTranscriptRef.current = "";
        setVoiceStatus("Sending voice message...");
        sendMessageRef.current(transcript);
        return;
      }
      shouldAutoSendVoiceRef.current = false;
      voiceTranscriptRef.current = "";
      setVoiceStatus(current => (current.includes("Listening") ? "Voice input ready." : current));
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);
    setVoiceStatus("Voice input ready.");

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors during teardown.
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!isCompact) {
      setIsCompactOpen(true);
      setShowCompactCallout(true);
    }
  }, [isCompact]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, loading, listening, isCompactOpen]);

  async function sendMessage(messageOverride) {
    const userMessage = String(messageOverride ?? input).trim();
    if (!userMessage || loadingRef.current) return;

    if (isCompact) {
      setIsCompactOpen(true);
    }
    lastUserLanguageRef.current = detectSpeechLanguage(userMessage, lastUserLanguageRef.current).code;
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
            body: JSON.stringify({ message: userMessage, session_id: sessionIdRef.current }),
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
        setIsCompactOpen(true);
        routeRequestCounterRef.current += 1;
        setRouteRequest({
          requestId: `${Date.now()}-${routeRequestCounterRef.current}`,
          startId: data.start_id || null,
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

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (!externalBotMessage?.id || !externalBotMessage?.text) return;
    if (lastExternalMessageIdRef.current === externalBotMessage.id) return;
    lastExternalMessageIdRef.current = externalBotMessage.id;
    if (isCompact) {
      setIsCompactOpen(true);
    }
    setMessages(prev => [
      ...prev,
      {
        text: externalBotMessage.text,
        sender: "bot"
      }
    ]);
  }, [externalBotMessage]);

  function switchView(nextMode) {
    if (nextMode === viewMode) return;
    if (nextMode === "compact") {
      setIsCompactOpen(true);
      setShowCompactCallout(true);
    }
    onViewModeChange(nextMode);
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
    if (recognitionRef.current && listening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors when clearing state.
      }
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([DEFAULT_GREETING]);
    setInput("");
    setLoading(false);
    setShowMap(false);
    setRouteRequest(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    sessionIdRef.current = createChatSessionId();
    try {
      localStorage.setItem(CHAT_SESSION_KEY, sessionIdRef.current);
    } catch {
      // Ignore storage issues; the in-memory session id still resets the chat context.
    }
    abortControllerRef.current = null;
    pendingUserMessageRef.current = "";
  }

  function toggleVoiceInput() {
    if (!voiceSupported) {
      setVoiceStatus("Voice input is not supported in this browser.");
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceStatus("Voice input is not ready yet.");
      return;
    }

    if (listening) {
      recognition.stop();
      return;
    }

    try {
      speechAttemptRef.current = 0;
      shouldRestartVoiceRef.current = false;
      applyRecognitionLanguage(recognition, currentInputRef.current);
      voiceTranscriptRef.current = "";
      shouldAutoSendVoiceRef.current = true;
      setVoiceStatus(`Listening in ${getActiveSpeechLanguage(currentInputRef.current).label}...`);
      recognition.start();
    } catch {
      setVoiceStatus("Voice input could not start. Please try again.");
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      sendMessage();
    }
  }

  function selectFoodSuggestion(suggestion) {
    if (!suggestion?.id) return;
    if (isCompact) {
      setIsCompactOpen(true);
    }
    setShowMap(true);
    routeRequestCounterRef.current += 1;
    setRouteRequest({
      requestId: `${Date.now()}-${routeRequestCounterRef.current}`,
      destinationId: suggestion.id,
      useCurrentLocation: false,
      locationMode: "highlight"
    });
  }

  const headerActions = (
    <>
      <button
        className="btn-secondary compact-mode-toggle"
        type="button"
        onClick={() => switchView(isCompact ? "full" : "compact")}
      >
        {isCompact ? (
          <>
            <Maximize2 size={15} aria-hidden="true" />
            Full Page
          </>
        ) : (
          <>
            <Minimize2 size={15} aria-hidden="true" />
            Compact View
          </>
        )}
      </button>
      <button className="btn-secondary" type="button" onClick={clearHistory}>
        Clear Chat
      </button>
    </>
  );

  if (isCompact && !isCompactOpen) {
    return (
      <div className="compact-chat-launcher">
        {showCompactCallout && (
          <div className="compact-chat-callout-wrap">
            <button
              type="button"
              className="compact-chat-close"
              aria-label="Dismiss compact chat message"
              onClick={() => setShowCompactCallout(false)}
            >
              x
            </button>
            <button
              type="button"
              className="compact-chat-callout"
              onClick={() => setIsCompactOpen(true)}
              aria-label="Open compact chat"
            >
              <p className="compact-chat-copy">
                Ask here anytime. I’ll stay tucked away until you want the full conversation or map.
              </p>
            </button>
          </div>
        )}

        <button
          className="compact-chat-launcher-button"
          type="button"
          onClick={() => setIsCompactOpen(true)}
          aria-label="Open compact chat"
        >
          <img
            src={chatbotButtonImage}
            alt="Open compact chatbot"
            className="compact-chat-launcher-image"
            draggable="false"
          />
        </button>
      </div>
    );
  }

  return (
    <div className={`panel chat-panel${isCompact ? " chat-panel-compact" : ""}`}>
      <div className="map-header">
        <h3 className="panel-title">Campus Concierge</h3>
        <div className="chat-panel-actions">
          {headerActions}
          {isCompact && (
            <button
              className="btn-secondary compact-collapse-btn"
              type="button"
              onClick={() => setIsCompactOpen(false)}
              aria-label="Collapse compact chat"
            >
              <Minimize2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div ref={chatBoxRef} className="chat-box">
        {loading && <div className="spinner"></div>}

        {messages.map((m, i) => (
          <div key={i} className={m.sender === "user" ? "msg-user" : "msg-bot"}>
            {m.sender === "bot" ? renderBotMessage(m, selectFoodSuggestion) : m.text}
          </div>
        ))}
      </div>

      <div className={`input-row${isCompact ? " input-row-compact" : ""}`}>
        <input
          className={isCompact ? "compact-input-full" : ""}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about Kean University..."
        />

        <div className={`input-controls-row${isCompact ? " input-controls-row-compact" : ""}`}>
          <select
            className="voice-lang-select"
            value={voiceLanguage}
            onChange={event => setVoiceLanguage(event.target.value)}
            disabled={listening || loading}
            aria-label="Voice input language"
          >
            {VOICE_LANGUAGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className={`btn-secondary voice-btn${listening ? " voice-btn-active" : ""}`}
            type="button"
            onClick={toggleVoiceInput}
            disabled={loading}
            aria-pressed={listening}
            title={voiceSupported ? "Use voice input" : "Voice input is unavailable in this browser"}
          >
            {listening ? <Square size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
          </button>
          <button className="btn-primary" onClick={() => sendMessage()} disabled={loading}>
            Send
          </button>
          {loading && (
            <button className="btn-secondary compact-cancel-btn" type="button" onClick={cancelSend}>
              Cancel
            </button>
          )}
        </div>
      </div>
      <div className={`voice-status${isCompact ? " voice-status-compact" : ""}`} aria-live="polite">
        <span className={isCompact ? "voice-status-ticker" : ""}>
          {voiceSupported ? voiceStatus : "Voice input is available in supported browsers like Chrome."}
        </span>
      </div>
    </div>
  );
}

export default ChatPanel;
