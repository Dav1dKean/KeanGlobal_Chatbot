import { useEffect, useRef, useState } from "react";

<<<<<<< Updated upstream
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const CHAT_STORAGE_KEY = "keanglobal_chat_messages";
=======
// ==============================
// CONSTANTS & CONFIGURATION
// ==============================
const ENV_API_BASE_URL = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URLS = ENV_API_BASE_URL
  ? [ENV_API_BASE_URL]
  : ["http://127.0.0.1:8000", "http://localhost:8000"];
const CHAT_STORAGE_KEY = "keanglobal_chat_messages";
const URL_PATTERN = /((?:https?:\/\/|\/)[^\s]+)([.,;:!?)]*)(?=\s|$)/gi;
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
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "zh", label: "Mandarin" },
  { value: "ko", label: "Korean" },
  { value: "tr", label: "Turkish" },
  { value: "ur", label: "Urdu" }
];

// ==============================
// HELPER FUNCTIONS
// ==============================
function detectSpeechLanguage(text, fallbackLanguage = "") {
  const sample = String(text || "").trim();
  const normalized = sample.toLowerCase();
  const fallback = String(fallbackLanguage || "").toLowerCase();

  if (/[\uac00-\ud7af]/.test(sample)) return SPEECH_LANGUAGE_MAP.ko;
  if (/[\u4e00-\u9fff]/.test(sample)) return SPEECH_LANGUAGE_MAP.zh;
  if (/[\u0600-\u06ff]/.test(sample)) return SPEECH_LANGUAGE_MAP.ur;

  if (/\b(cuando|cuándo|donde|dónde|quien|quién|eres|hola|admisiones|matricula|matrícula|programa|universidad|biblioteca|horario)\b/.test(normalized)) {
    return SPEECH_LANGUAGE_MAP.es;
  }
  if (/\b(merhaba|universite|üniversite|kayit|kayıt|bolum|bölüm|programi|programı|saat)\b/.test(normalized)) {
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
        target={url.startsWith("/") ? undefined : "_blank"}
        rel={url.startsWith("/") ? undefined : "noreferrer"}
        className="text-blue-500 underline hover:text-blue-700 break-all"
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

  if (lastIndex === 0) return content;
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
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
    if (/^source:\s*/i.test(line)) continue;
    if (currentItem) {
      currentItem.body = `${currentItem.body} ${line}`.trim();
    }
  }

  if (currentItem) listItems.push(currentItem);

  if (!listItems.length) {
    return (
      <>
        <div className="whitespace-pre-wrap leading-relaxed">{renderLinkedText(text)}</div>
        {foodSuggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {foodSuggestions.map(suggestion => (
              <button
                key={suggestion.id}
                type="button"
                className="bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 text-xs px-3 py-1.5 rounded-full transition-colors"
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
    <div className="flex flex-col gap-2">
      <div className="whitespace-pre-wrap leading-relaxed">{renderLinkedText(lines[0])}</div>
      <ol className="list-decimal list-inside space-y-1 ml-1">
        {listItems.map((item, index) => (
          <li key={`${item.body}-${index}`} className="leading-relaxed">
            <span>{renderLinkedText(item.body)}</span>
          </li>
        ))}
      </ol>
      {foodSuggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {foodSuggestions.map(suggestion => (
            <button
              key={suggestion.id}
              type="button"
              className="bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 text-xs px-3 py-1.5 rounded-full transition-colors"
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
>>>>>>> Stashed changes

// ==============================
// MAIN COMPONENT
// ==============================
function ChatPanel({ setShowMap, setRouteRequest }) {
  // Widget Open State
  const [isOpen, setIsOpen] = useState(false);
  const [hideCopy, setHideCopy] = useState(false);
  // Chat States
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
<<<<<<< Updated upstream
  const abortControllerRef = useRef(null);
  const pendingUserMessageRef = useRef("");
=======
  
  // Voice States
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState("auto");

  // Refs
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
  const chatBoxRef = useRef(null);

  // Auto-scroll to bottom whenever messages or window open state changes
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isOpen, loading, listening]);

  // Voice Language Handlers
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

  // Keep refs updated for speech recognition callbacks
  useEffect(() => {
    currentInputRef.current = input;
    loadingRef.current = loading;
  }, [input, loading]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
>>>>>>> Stashed changes

  // Save chat history
  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

<<<<<<< Updated upstream
  async function sendMessage() {
    const userMessage = input.trim();
    if (!userMessage || loading) return;
=======
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Messaging Logic
  async function sendMessage(messageOverride) {
    const userMessage = String(messageOverride ?? input).trim();
    if (!userMessage || loadingRef.current) return;
>>>>>>> Stashed changes

    setMessages(prev => [...prev, { text: userMessage, sender: "user" }]);
    setInput("");
    setLoading(true);
    pendingUserMessageRef.current = userMessage;
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
        signal: abortControllerRef.current.signal
      });
      const data = await response.json().catch(() => ({}));

<<<<<<< Updated upstream
      if (!response.ok) {
        throw new Error(data?.detail || "Request failed.");
      }

      const answerText = data.answer || data.reply || "No response from backend.";
      setMessages(prev => [...prev, { text: answerText, sender: "bot" }]);
      setShowMap(data.intent === "location");
      if (data.intent === "location") {
=======
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

      if (lastNetworkError) throw lastNetworkError;
      if (!response?.ok) throw new Error(data?.detail || "Request failed.");

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
        setShowMap(true); 
>>>>>>> Stashed changes
        setRouteRequest({
          destinationId: data.destination_id || null,
          useCurrentLocation: Boolean(data.use_current_location)
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const errorText = error instanceof Error ? error.message : "Backend unavailable. Start FastAPI and Ollama.";
      setMessages(prev => [...prev, { text: `Error: ${errorText}`, sender: "bot" }]);
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
    if (abortControllerRef.current) abortControllerRef.current.abort();

    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.sender === "user" && last.text === pendingMessage) return prev.slice(0, -1);
      return prev;
    });
    setInput(pendingMessage);
    setLoading(false);
    abortControllerRef.current = null;
    pendingUserMessageRef.current = "";
  }

  function clearHistory() {
<<<<<<< Updated upstream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
=======
    if (recognitionRef.current && listening) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setMessages([DEFAULT_GREETING]);
>>>>>>> Stashed changes
    setInput("");
    setLoading(false);
    setShowMap(false);
    setRouteRequest(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    abortControllerRef.current = null;
    pendingUserMessageRef.current = "";
  }

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
  function handleKeyDown(event) {
    if (event.key === "Enter") sendMessage();
  }

<<<<<<< Updated upstream
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
            {m.text}
=======
  function selectFoodSuggestion(suggestion) {
    if (!suggestion?.id) return;
    setShowMap(true);
    setRouteRequest({
      destinationId: suggestion.id,
      useCurrentLocation: false,
      locationMode: "highlight"
    });
  }

  // ==============================
  // RENDER UI (TAILWIND WIDGET)
  // ==============================
  return (
    <div className="fixed bottom-5 right-5 z-9999 flex flex-col items-end font-sans">
      
      {/* Floating Chat Window */}
      {isOpen && (
        <div className="w-[350px] sm:w-[400px] h-[550px] bg-white rounded-2xl shadow-2xl mb-4 flex flex-col overflow-hidden border border-gray-200">
          
          {/* Header */}
          <div className="bg-[#005A9C] text-white px-4 py-3 flex justify-between items-center shadow-md z-10">
            <h3 className="font-bold text-lg">Campus Concierge</h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={clearHistory} 
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors focus:outline-none"
              >
                Clear
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="hover:text-gray-200 text-xl font-bold transition-transform hover:scale-110 focus:outline-none"
              >
                ✖
              </button>
            </div>
>>>>>>> Stashed changes
          </div>

          {/* Chat Messages Area */}
          <div 
            ref={chatBoxRef}
            className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4"
          >
            {messages.map((m, i) => (
              <div 
                key={i} 
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                    m.sender === "user" 
                      ? "bg-[#005A9C] text-white rounded-tr-sm" 
                      : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
                  }`}
                >
                  {m.sender === "bot" ? renderBotMessage(m, selectFoodSuggestion) : m.text}
                </div>
              </div>
            ))}
            
            {/* Loading Indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>

<<<<<<< Updated upstream
        <button className="btn-primary" onClick={sendMessage} disabled={loading}>
          Send
        </button>
        {loading && (
          <button className="btn-secondary" type="button" onClick={cancelSend}>
            Cancel
          </button>
        )}
=======
          {/* Input Area (Tailwind Flex Layout) */}
          <div className="bg-white border-t border-gray-200 flex flex-col">
            
            {/* Input & Buttons Row */}
            <div className="p-3 flex items-center gap-2">
              <input
                className="flex-1 bg-gray-100 focus:bg-white border border-transparent focus:border-[#005A9C] rounded-full px-4 py-2 text-sm outline-none transition-colors"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Kean University..."
              />
              
              {/* Mic Toggle Button */}
              <button
                className={`p-2.5 rounded-full flex-shrink-0 transition-colors focus:outline-none ${
                  listening 
                    ? "bg-red-500 text-white animate-pulse shadow-md" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                type="button"
                onClick={toggleVoiceInput}
                disabled={loading}
                title={voiceSupported ? "Use voice input" : "Voice input is unavailable"}
              >
                {listening ? <Square size={18} /> : <Mic size={18} />}
              </button>

              {/* Send / Cancel Button */}
              {loading ? (
                <button 
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors flex-shrink-0" 
                  onClick={cancelSend}
                >
                  Stop
                </button>
              ) : (
                <button 
                  className="bg-[#005A9C] hover:bg-[#004a80] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0" 
                  onClick={() => sendMessage()} 
                  disabled={!input.trim()}
                >
                  Send
                </button>
              )}
            </div>

            {/* Sub-controls: Language Select & Voice Status */}
            <div className="px-4 pb-2 flex justify-between items-center gap-2">
              <select
                className="text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded px-2 py-1 outline-none focus:border-blue-400"
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
              
              <span className="text-[11px] text-gray-400 truncate">
                {voiceSupported ? voiceStatus : "Voice input unavailable"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bubble Button */}
<div className="flex items-end gap-3">
      
      <button 
        className="w-14 h-14 rounded-full bg-[#005A9C] text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        ) : (
          <span className="text-2xl">💬</span>
        )}
      </button>

      {!isOpen && !hideCopy && (
        <div 
          className="bg-white border border-gray-200 shadow-lg rounded-2xl rounded-br-sm p-3 max-w-[260px] animate-bounce-slow cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setHideCopy(true)}
          title="Click to hide"
        >
          <p className="text-sm text-gray-700 m-0 leading-relaxed">
            Hello! How can I help you today? I am KeanGlobal Chatbot and I can answer questions about Kean University and campus locations/directions.
          </p>
        </div>
      )}
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

export default ChatPanel;