import { useNavigate } from "react-router-dom";
import MapPanel from "../components/MapPanel";

export default function MapPage({ routeRequest }) {
  const navigate = useNavigate();

  return (
    <div className="main-layout">
      <MapPanel 
        routeRequest={routeRequest} 
        setShowMap={(show) => {
          if (!show) {
            navigate("/");
          }
        }} 
      />
    </div>
  );
}