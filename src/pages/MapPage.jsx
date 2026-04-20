import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatPanel from "../components/ChatPanel";
import MapPanel from "../components/MapPanel";

const MOBILE_LAYOUT_BREAKPOINT = 980;

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
  const [isMobileLayout, setIsMobileLayout] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT : false
  ));
  const [mobileActivePanel, setMobileActivePanel] = useState(() => (
    standalone || forceShowMap || Boolean(externalRouteRequest) || Boolean(initialRouteRequest) ? "map" : "chat"
  ));
  const previousShowMapRef = useRef(showMap);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setIsMobileLayout(window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (standalone) {
      setMobileActivePanel("map");
      return;
    }

    if (!showMap) {
      setMobileActivePanel("chat");
    } else if (!previousShowMapRef.current) {
      setMobileActivePanel("map");
    }

    previousShowMapRef.current = showMap;
  }, [showMap, standalone]);

  useEffect(() => {
    if (routeRequest && !standalone) {
      setMobileActivePanel("map");
    }
  }, [routeRequest, standalone]);

  const layoutClassName = standalone ? "main-layout map-only" : showMap ? "main-layout two-col" : "main-layout one-col";
  const rootClassName = `${layoutClassName}${isMobileLayout && !standalone ? " mobile-stacked" : ""}`;
  const showMobileTabs = !standalone && isMobileLayout && showMap;

  return (
    <div className={rootClassName}>
      {showMobileTabs && (
        <div className="mobile-panel-tabs" role="tablist" aria-label="Chat and map panels">
          <button
            type="button"
            className={`mobile-panel-tab${mobileActivePanel === "chat" ? " active" : ""}`}
            onClick={() => setMobileActivePanel("chat")}
            aria-pressed={mobileActivePanel === "chat"}
          >
            Chat
          </button>
          <button
            type="button"
            className={`mobile-panel-tab${mobileActivePanel === "map" ? " active" : ""}`}
            onClick={() => setMobileActivePanel("map")}
            aria-pressed={mobileActivePanel === "map"}
          >
            Map
          </button>
        </div>
      )}
      {!standalone && (!showMobileTabs || mobileActivePanel === "chat") && (
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
      {(showMap || standalone) && (!showMobileTabs || mobileActivePanel === "map") && (
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
