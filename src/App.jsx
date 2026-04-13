import { useEffect, useState } from "react";
import Header from "./components/Header";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import ChatPanel from "./components/ChatPanel";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import ProgPage from "./pages/ProgPage";
import ProgDetail from "./pages/ProgDetail";

const CHAT_VIEW_MODE_KEY = "keanglobal_chat_view_mode";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [chatViewMode, setChatViewMode] = useState(() => {
    try {
      return localStorage.getItem(CHAT_VIEW_MODE_KEY) === "compact" ? "compact" : "full";
    } catch {
      return "full";
    }
  });
  const [globalRouteRequest, setGlobalRouteRequest] = useState(null);
  const [globalMapVisible, setGlobalMapVisible] = useState(false);

  useEffect(() => {
    localStorage.setItem(CHAT_VIEW_MODE_KEY, chatViewMode);
  }, [chatViewMode]);

  const showCompactWidget =
    chatViewMode === "compact" && ["/", "/programs"].includes(location.pathname);

  function handleCompactShowMap(show) {
    setGlobalMapVisible(show);
    if (show) {
      navigate("/map");
    }
  }

  return (
    <div className="app">
      <Header onMapChatClick={() => setChatViewMode("full")} />

      <Routes>
        <Route path="/" element={<HomePage compactModeActive={showCompactWidget} />} />
        <Route
          path="/chat"
          element={<MapPage chatViewMode={chatViewMode} onChatViewModeChange={setChatViewMode} />}
        />
        <Route
          path="/map"
          element={
            <MapPage
              standalone
              routeRequest={globalRouteRequest}
              forceShowMap={globalMapVisible || Boolean(globalRouteRequest)}
            />
          }
        />
        <Route path="/programs" element={<ProgPage compactModeActive={showCompactWidget} />} />
        <Route path="/program/:id" element={<ProgDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showCompactWidget && (
        <ChatPanel
          setShowMap={handleCompactShowMap}
          setRouteRequest={setGlobalRouteRequest}
          viewMode="compact"
          onViewModeChange={(nextMode) => {
            setChatViewMode(nextMode);
            if (nextMode === "full") {
              navigate("/chat");
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
