import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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

export default function MapPage({ standalone = false }) {
  const location = useLocation();
  const initialRouteRequest = useMemo(() => buildRouteRequestFromSearch(location.search), [location.search]);
  const [showMap, setShowMap] = useState(standalone || Boolean(initialRouteRequest));
  const [routeRequest, setRouteRequest] = useState(initialRouteRequest);

  return (
    <div className={standalone ? "main-layout map-only" : showMap ? "main-layout two-col" : "main-layout one-col"}>
      {!standalone && <ChatPanel setShowMap={setShowMap} setRouteRequest={setRouteRequest} />}
      {(showMap || standalone) && (
        <MapPanel setShowMap={setShowMap} routeRequest={routeRequest} standalone={standalone} />
      )}
    </div>
  );
}
