import { useEffect, useState } from "react";
import Header from "./components/Header";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import ProgPage from "./pages/ProgPage";
import ProgDetail from "./pages/ProgDetail";
import ChatPanel from "./components/ChatPanel"; 

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showMap, setShowMap] = useState(false);
  const [routeRequest, setRouteRequest] = useState(null);

  useEffect(() => {
    if (showMap && location.pathname !== "/chat" && location.pathname !== "/map") {
      navigate("/chat");
    }
  }, [showMap, navigate, location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/chat" && location.pathname !== "/map") {
      setShowMap(false);
    }
  }, [location.pathname]);

  return (
    <div className="app">
      <Header />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<MapPage routeRequest={routeRequest} />} />
        <Route path="/map" element={<MapPage standalone routeRequest={routeRequest} />} />
        <Route path="/programs" element={<ProgPage />} />
        <Route path="/program/:id" element={<ProgDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ChatPanel setShowMap={setShowMap} setRouteRequest={setRouteRequest} />
    </div>
  );
}

export default App;