import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import ProgPage from "./pages/ProgPage";
import ProgDetail from "./pages/ProgDetail";
import ChatPanel from "./components/ChatPanel";

function App() {
  const [showMap, setShowMap] = useState(false);
  const [routeRequest, setRouteRequest] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (showMap) {
      navigate("/chat");
      setShowMap(false);
    }
  }, [showMap, navigate]);

  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<MapPage routeRequest={routeRequest} />} />
        <Route path="/programs" element={<ProgPage />} />
        <Route path="/program/:id" element={<ProgDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatPanel setShowMap={setShowMap} setRouteRequest={setRouteRequest} />
    </div>
  );
}

export default App;