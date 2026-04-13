import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatPanel from "../components/ChatPanel";
import MapPanel from "../components/MapPanel";

function buildRouteRequestFromSearch(search) {
  const params = new URLSearchParams(search);
  const destinationId = params.get("destination") || params.get("highlight") || "";
  const startId = params.get("start") || "";
  const locationMode = params.get("mode") === "highlight" ? "highlight" : "directions";

  if (!destinationId && !startId) return null;

  return {
    destinationId: destinationId || startId || null,
    startId: startId || null,
    locationMode,
    useCurrentLocation: params.get("useCurrentLocation") === "1"
  };
}

export default function MapPage({
  standalone = false,
  routeRequest: externalRouteRequest = null,
  forceShowMap = false,
  chatViewMode = "full",
  onChatViewModeChange = () => {}
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialRouteRequest = useMemo(() => buildRouteRequestFromSearch(location.search), [location.search]);
  const [showMap, setShowMap] = useState(standalone || forceShowMap || Boolean(externalRouteRequest) || Boolean(initialRouteRequest));
  const [routeRequest, setRouteRequest] = useState(externalRouteRequest || initialRouteRequest);
  const [routeDirectionsMessage, setRouteDirectionsMessage] = useState(null);

  useEffect(() => {
    if (externalRouteRequest) {
      setRouteRequest(externalRouteRequest);
      setShowMap(true);
    }
  }, [externalRouteRequest]);

  useEffect(() => {
    if (forceShowMap) {
      setShowMap(true);
    }
  }, [forceShowMap]);

  const layoutClassName = standalone ? "main-layout map-only" : showMap ? "main-layout two-col" : "main-layout one-col";

  return (
    <div className={layoutClassName}>
      {!standalone && (
        <ChatPanel
          setShowMap={setShowMap}
          setRouteRequest={setRouteRequest}
          externalBotMessage={routeDirectionsMessage}
          viewMode={chatViewMode}
          onViewModeChange={(nextMode) => {
            onChatViewModeChange(nextMode);
            if (nextMode === "compact") {
              navigate("/");
            }
          }}
        />
      )}
      {(showMap || standalone) && (
        <MapPanel
          setShowMap={setShowMap}
          routeRequest={routeRequest}
          standalone={standalone}
          onRouteDirectionsChange={setRouteDirectionsMessage}
        />
      )}
    </div>
  );
}
