import { useState } from "react";
import { useNavigate } from "react-router-dom";
import chatbotButtonImage from "../assets/Chatbot button.png";

export default function ChatLauncher({ defaultOpen = false, className = "" }) {
  const navigate = useNavigate();
  const [showCallout, setShowCallout] = useState(defaultOpen);

  return (
    <div className={`home-chat-launcher ${className}`.trim()}>
      {showCallout ? (
        <div className="home-chat-callout-wrap">
          <button
            type="button"
            className="home-chat-close"
            aria-label="Dismiss chat message"
            onClick={() => setShowCallout(false)}
          >
            x
          </button>
          <button
            type="button"
            className="home-chat-callout"
            onClick={() => navigate("/chat")}
            aria-label="Open KeanGlobal chat"
          >
            <p className="home-chat-copy">
              Hello! How can I help you today? I am KeanGlobal Chatbot and I can
              answer questions about Kean University and campus
              locations/directions.
            </p>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="home-chat-bubble-button"
        onClick={() => navigate("/chat")}
        aria-label="Go to chatbot page"
      >
        <img
          src={chatbotButtonImage}
          alt="Open KeanGlobal chatbot"
          className="home-chat-bubble-image"
          draggable="false"
        />
      </button>
    </div>
  );
}
