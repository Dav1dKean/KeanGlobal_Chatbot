import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

export default function MapPage({ standalone = false, routeRequest = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const activeRouteRequest = useMemo(() => {
    return routeRequest || buildRouteRequestFromSearch(location.search);
  }, [routeRequest, location.search]);

  return (
    <div className={standalone ? "main-layout map-only" : "main-layout"}>
      <MapPanel 
        routeRequest={activeRouteRequest} 
        standalone={standalone}
        setShowMap={(show) => {
          if (!show && !standalone) {
            navigate("/");
          }
        }} 
      />
    </div>
  );
}