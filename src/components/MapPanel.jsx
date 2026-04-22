import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import bikeIconImage from "../assets/buildings/bike_icon.png";
import busIconImage from "../assets/buildings/bus icon.png";
import evChargingIconImage from "../assets/buildings/electric-vehicle-charging-station-icon.jpg";
import phoneIconImage from "../assets/buildings/phone icon.png";
import buildingProfiles from "../data/building_profiles.json";
import campusLocationsData from "../data/kean_locations.json";
import missingPathsData from "../data/kean_paths_missing.json";
import routingGraphData from "../data/kean_routing_graph.json";
import parkingLotsGeoJsonRaw from "../data/kean_parking_lots.geojson?raw";
import pathsGeoJsonRaw from "../data/kean_paths.geojson?raw";
import supportedWalkingAreaData from "../data/kean_supported_walking_area.json";

const buildingImageModules = import.meta.glob("../assets/buildings/*.{png,jpg,jpeg,webp,gif}", {
  eager: true,
  import: "default"
});

const KEAN_MAIN_CAMPUS = [40.6798, -74.2341];
const MAP_DEFAULT_ZOOM = 18;
const MAP_DETAIL_ZOOM = 19.5;
const MAP_FOCUS_ZOOM = 20;
const MAP_TILE_NATIVE_MAX_ZOOM = 19;
const CAMPUS_BOUNDS = {
  north: 40.6825,
  south: 40.6772,
  east: -74.2312,
  west: -74.2378
};
const EXPANDED_CAMPUS_BOUNDS = {
  north: 40.6855,
  south: 40.674,
  east: -74.221,
  west: -74.2415
};

const PARKING_TYPE_COLORS = {
  student: "#2563eb",
  faculty_staff: "#f97316",
  visitor: "#ec4899",
  overnight: "#16a34a"
};
const ROUTE_LINE_COLORS = ["#2563eb", "#f97316", "#9333ea"];
const MAX_TRACED_ENDPOINT_MISMATCH_METERS = 35;
const MAX_ROUTE_SEGMENT_JOIN_GAP_METERS = 45;
const MAX_ROUTE_SEGMENT_MERGE_GAP_METERS = 8;
const DISALLOWED_AUTO_PROXIMITY_EDGE_IDS = new Set([
  // These shortcut edges cut across Morris Avenue / fenced areas instead of using the mapped crossing path.
  "eB00107",
  "eB00108"
]);

const LOCATION_TYPE_LABELS = {
  building: "Building",
  entrance: "Entrance",
  parking: "Parking",
  lawn: "Open Space",
  field: "Athletics",
  landmark: "Landmark",
  shuttle_stop: "Shuttle Stop",
  emergency_phone: "Emergency Phone",
  bike_scooter_parking: "Bike / Scooter Parking",
  ev_charging_station: "EV Charging Station"
};

const ROUTE_NODE_ALIASES = {
  administration_lot: "visitors_parking_lot",
  "downs_hall_entrance_front": "downs_hall_main",
  kean_parking_garage_near_hynes: "kean_parking_garage",
  "kean parking garage near hynes": "kean_parking_garage",
  "parking garage near hynes": "kean_parking_garage",
  "kean_hall_entrance_front": "kean_hall_main",
  "kean_hall_entrance_side": "kean_hall_main",
  "miron_center_main": "miron_main",
  "naab_entrance_front": "naab_main",
  "north_ave_academic_main": "naab_main",
  shuttle_stop_stem_liberty_hall: "shuttle_stop_lhac",
  "shuttle stop stem liberty hall": "shuttle_stop_lhac",
  visitors_lot: "visitors_parking_lot",
  "vaughn_eames_front": "vaughn_eames_main",
  "wilkins_theatre_front": "wilkins_theatre_main"
};

const MERGED_ROUTE_NODE_IDS = {
  downs_main: "downs_hall_main"
};

const PREFERRED_ROUTE_DESTINATION_IDS = {
  campus_police: "campus_police_main",
  cas: "cas_main",
  downs_hall: "downs_hall_main",
  harwood_arena: "harwood_arena_main",
  hennings_hall: "hennings_hall_front",
  hutchinson_hall: "hutchinson_hall_side",
  naab: "naab_entrance_front",
  wilkins_theatre: "wilkins_main"
};

const IMAGE_TOKEN_STOP_WORDS = new Set([
  "building",
  "hall",
  "center",
  "campus",
  "main",
  "new",
  "university",
  "residence",
  "student",
  "academic",
  "for",
  "and",
  "the",
  "of",
  "at"
]);

const BUILDING_IMAGE_ALIASES = {
  administration: ["administration building"],
  barnes_nobles_glab: ["kean barnes and noble", "barnes and noble at glab", "barnes noble glab", "bookstore at glab"],
  bartlett_hall: ["bartlett hall"],
  basketball_courts: ["kean basketball courts", "basketball courts", "basketball court"],
  burch_hall: ["burch hall"],
  cas: ["cas building", "center for academic success"],
  cougar_hall: ["cougar hall"],
  d_angola_gym: ["d angola gym", "dangola gym", "d'angola gymnasium", "d angola gymnasium"],
  d_angola_pool: ["d angola pool", "dangola pool", "d'angola pool", "pool"],
  enlow_hall_lawn: ["the lawn at enlow hall", "enlow hall lawn", "the lawn"],
  dougall_hall: ["dougall hall"],
  downs_hall: ["downs hall"],
  east_campus_building: ["east campus", "east campus building"],
  freshman_residence_hall: ["freshman hall", "freshman residence hall"],
  glab: ["glab", "green lane academic building"],
  harwood_arena: ["harwood arena"],
  hennings_hall: ["george hennings hall", "hennings hall"],
  hennings_research: ["george hennings research", "hennings research building"],
  hutchinson_hall: ["hutchinson hall"],
  kean_hall: ["kean hall"],
  kean_beach_volleyball_court: ["kean beach volleyball court", "beach volleyball court", "miron beach volleyball court"],
  kean_clock_tower: ["kean clock tower", "clock tower"],
  kean_east_soccer_field_1: ["kean east soccer field 1", "kean soccer field east campus 1"],
  kean_east_soccer_field_2: ["kean east soccer field 2", "kean soccer field east campus 2"],
  kean_shuttle_bus: ["kean shuttle bus", "shuttle bus", "campus shuttle"],
  emergency_phone: ["emergency phone"],
  bike_scooter_parking_stem_atrium: ["main campus bike scooter parking", "stem bike scooter parking", "stem building bike scooter parking"],
  bike_scooter_parking_glab_main_entrance: ["glab bike scooter parking"],
  bike_scooter_parking_naab_main_entrance: ["naab bike scooter parking"],
  bike_scooter_parking_hynes_main_entrance: ["hynes bike scooter parking"],
  bike_scooter_parking_wilkins_cougar_walk: ["wilkins bike scooter parking", "wilkins theatre bike scooter parking"],
  bike_scooter_parking_harwood_cougar_walk: ["harwood bike scooter parking", "harwood arena bike scooter parking"],
  library: ["nancy thompson library", "library"],
  learning_plaza: ["learning plaza"],
  little_theater: ["little theater", "little theatre"],
  miron_center: ["miron student center", "miron center"],
  msc_turf_field: ["miron turf field", "msc turf field", "miron student center turf field", "turf field"],
  naab: ["naab", "north avenue academic building"],
  nathan_weiss_building: ["nathan weiss east campus", "nathan weiss building"],
  starbucks_at_library: ["starbucks at nancy thompson library", "starbucks near library", "library starbucks", "starbucks"],
  burger_art_gallery: ["burger art gallery"],
  one_mans_search: ["one mans", "one mans search", "one man's search"],
  rogers_hall: ["rogers hall"],
  sozio_hall: ["sozio hall"],
  stem: ["stem building", "stem"],
  the_thinker_statue: ["the thinker", "the thinker statue"],
  townsend_hall: ["townsend hall"],
  union_train_station: ["union train station", "union township train station", "train station"],
  upperclassman_residence_hall: ["upperclassmen hall", "upperclassman residence hall"],
  vaughn_eames: ["vaughn eames hall", "vaughn-eames hall"],
  whiteman_hall: ["whiteman hall"],
  wilkins_theatre: ["wilkins theater", "wilkins theatre"]
};

const parkingLotsGeoJson = JSON.parse(parkingLotsGeoJsonRaw);
const pathsGeoJson = JSON.parse(pathsGeoJsonRaw);
const EXISTING_PATH_EDGE_IDS = new Set(
  (pathsGeoJson?.features || [])
    .map(feature => String(feature?.properties?.edge_id || "").replace(/\uFEFF/g, "").trim())
    .filter(Boolean)
);
const buildingImageRecords = buildBuildingImageRecords(buildingImageModules);
const HIDDEN_BUILDING_MARKER_IDS = new Set(["george_hennings_research", "kean_east_soccer_field", "msc_game_room"]);
const SUPPORTED_WALKING_AREA_POLYGON =
  supportedWalkingAreaData?.features?.find(feature => feature?.geometry?.type === "Polygon")?.geometry?.coordinates?.[0]
    ?.map(normalizeCoordinatePair)
    .filter(Boolean) || [];

const campusMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const shuttleStopMarkerIcon = L.icon({
  iconUrl: busIconImage,
  iconRetinaUrl: busIconImage,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
  className: "map-image-marker"
});

const emergencyPhoneMarkerIcon = L.icon({
  iconUrl: phoneIconImage,
  iconRetinaUrl: phoneIconImage,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
  className: "map-image-marker"
});

const bikeScooterMarkerIcon = L.icon({
  iconUrl: bikeIconImage,
  iconRetinaUrl: bikeIconImage,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
  className: "map-image-marker"
});

const evChargingMarkerIcon = L.icon({
  iconUrl: evChargingIconImage,
  iconRetinaUrl: evChargingIconImage,
  iconSize: [40, 34],
  iconAnchor: [20, 17],
  popupAnchor: [0, -18],
  className: "map-image-marker"
});

const parkingLabelAnchorIcon = L.divIcon({
  className: "parking-label-anchor",
  html: "",
  iconSize: [1, 1],
  iconAnchor: [0, 0]
});

const MARKER_LOCATION_TYPES = new Set([
  "building",
  "field",
  "lawn",
  "landmark",
  "shuttle_stop",
  "emergency_phone",
  "bike_scooter_parking",
  "ev_charging_station"
]);

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stripImageExtension(value) {
  return String(value || "").replace(/\.[^.]+$/, "");
}

function tokenizeMeaningfulName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(token => token && !IMAGE_TOKEN_STOP_WORDS.has(token));
}

function buildBuildingImageRecords(modules) {
  return Object.entries(modules).map(([path, src]) => {
    const filename = path.split("/").pop() || "";
    const normalizedName = normalizeId(stripImageExtension(filename));
    const tokens = new Set(tokenizeMeaningfulName(filename));
    return { path, src, filename, normalizedName, tokens };
  });
}

function scoreImageCandidate(candidate, image) {
  if (!candidate) return 0;
  const normalized = normalizeId(candidate);
  const tokens = tokenizeMeaningfulName(candidate);
  let score = 0;

  if (normalized && image.normalizedName === normalized) score += 200;
  if (normalized && image.normalizedName.includes(normalized)) score += 120;
  if (normalized && normalized.includes(image.normalizedName)) score += 80;

  const overlap = tokens.filter(token => image.tokens.has(token)).length;
  if (overlap) {
    score += overlap * 40;
    score += Math.round((overlap / Math.max(1, tokens.length)) * 30);
  }

  return score;
}

function toBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1";
}

function prettifyRouteNodeName(id) {
  return String(id || "")
    .replace(/\bmain\d*\b/gi, "Main")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function isWithinBounds([lat, lon], bounds) {
  return lat <= bounds.north && lat >= bounds.south && lon <= bounds.east && lon >= bounds.west;
}

function normalizeCoordinatePair(value) {
  if (!Array.isArray(value) || value.length < 2) return null;

  const first = Number(value[0]);
  const second = Number(value[1]);
  if (Number.isNaN(first) || Number.isNaN(second)) return null;

  const asLatLng = [first, second];
  const asLngLat = [second, first];

  const latLngInCampus = isWithinBounds(asLatLng, EXPANDED_CAMPUS_BOUNDS);
  const lngLatInCampus = isWithinBounds(asLngLat, EXPANDED_CAMPUS_BOUNDS);

  if (latLngInCampus && !lngLatInCampus) return asLatLng;
  if (lngLatInCampus && !latLngInCampus) return asLngLat;

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return asLatLng;
  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) return asLngLat;
  return null;
}

function parseLatLngPair(value) {
  if (Array.isArray(value)) {
    return normalizeCoordinatePair(value);
  }

  const parts = String(value || "")
    .split(",")
    .map(piece => Number(piece.trim()));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return [parts[0], parts[1]];
}

function getLocationPosition(location) {
  if (Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)) {
    return [Number(location.latitude), Number(location.longitude)];
  }

  const latLng = parseLatLngPair(location?.latlng);
  if (latLng) return latLng;

  return normalizeCoordinatePair(location?.coordinates);
}

function parseLocationRecords(data) {
  return data
    .map(location => {
      const position = getLocationPosition(location);
      const id = String(location?.id || "").replace(/\uFEFF/g, "").trim();
      if (!id || !position) return null;
      return {
        id,
        name: location?.name || id,
        position,
        campus: location?.campus || "Main",
        routable: toBoolean(location?.routable),
        parent: (location?.parent || "").trim() || null,
        accessibility: toBoolean(location?.accessibility),
        type: (location?.type || "location").trim().toLowerCase()
      };
    })
    .filter(Boolean);
}

function parseRoutingNodes(graphData, existingLocations) {
  const existingIds = new Set(existingLocations.map(location => location.id));
  return (graphData?.nodes || [])
    .map(node => {
      const id = String(node?.id || "").trim();
      const position = normalizeCoordinatePair(node?.coordinates);
      const mergedTargetId = MERGED_ROUTE_NODE_IDS[id];
      if (!id || !position || existingIds.has(id)) return null;
      if (mergedTargetId && existingIds.has(mergedTargetId)) return null;
      return {
        id,
        name: prettifyRouteNodeName(id),
        position,
        campus: isWithinBounds(position, CAMPUS_BOUNDS) ? "Main" : "Other",
        routable: true,
        parent: null,
        accessibility: true,
        type: "route_node"
      };
    })
    .filter(Boolean);
}

function parseParkingGeoJson(data) {
  const parsedLots = (data?.features || [])
    .map(feature => {
      const ring = feature?.geometry?.coordinates?.[0];
      const polygon = Array.isArray(ring) ? ring.map(normalizeCoordinatePair).filter(Boolean) : [];
      if (polygon.length < 3) return null;

      const properties = feature?.properties || {};
      const name = properties.name || properties.parking_id || "Parking";
      return {
        id: String(properties.parking_id || normalizeId(name)),
        name,
        parkingType: String(properties.parking_type || "").trim().toLowerCase() || inferParkingTypeFromName(name),
        polygon
      };
    })
    .filter(Boolean);

  const getPolygonBounds = polygon => {
    const latitudes = polygon.map(([lat]) => lat);
    const longitudes = polygon.map(([, lon]) => lon);
    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLon: Math.min(...longitudes),
      maxLon: Math.max(...longitudes)
    };
  };

  const getPolygonCenter = polygon => {
    const total = polygon.reduce(
      (acc, [lat, lon]) => ({ lat: acc.lat + lat, lon: acc.lon + lon }),
      { lat: 0, lon: 0 }
    );
    return [total.lat / polygon.length, total.lon / polygon.length];
  };

  const normalizeParkingName = name =>
    String(name || "")
      .toLowerCase()
      .replace(/\bnear hynes\b/g, "")
      .replace(/\blot\s+\d+\b/g, "lot")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const polygonSignature = polygon =>
    polygon
      .map(([lat, lon]) => `${lat.toFixed(6)},${lon.toFixed(6)}`)
      .join("|");

  const dedupedLots = [];
  parsedLots.forEach(lot => {
    const center = getPolygonCenter(lot.polygon);
    const bounds = getPolygonBounds(lot.polygon);
    const signature = polygonSignature(lot.polygon);
    const duplicateIndex = dedupedLots.findIndex(existing => {
      if (existing.signature === signature) return true;
      if (normalizeParkingName(existing.name) !== normalizeParkingName(lot.name)) return false;

      const [existingLat, existingLon] = existing.center;
      const [lotLat, lotLon] = center;
      const centerDistance = Math.hypot(existingLat - lotLat, existingLon - lotLon);
      const bboxDifference =
        Math.abs(existing.bounds.minLat - bounds.minLat) +
        Math.abs(existing.bounds.maxLat - bounds.maxLat) +
        Math.abs(existing.bounds.minLon - bounds.minLon) +
        Math.abs(existing.bounds.maxLon - bounds.maxLon);

      return centerDistance < 0.00012 && bboxDifference < 0.0003;
    });

    if (duplicateIndex >= 0) {
      const existing = dedupedLots[duplicateIndex];
      const preferCurrent =
        (!/near hynes/i.test(lot.name) && /near hynes/i.test(existing.name)) ||
        lot.name.length < existing.name.length;
      if (preferCurrent) {
        dedupedLots[duplicateIndex] = { ...lot, center, bounds, signature };
      }
      return;
    }

    dedupedLots.push({ ...lot, center, bounds, signature });
  });

  return dedupedLots.map(({ center, bounds, signature, ...lot }) => lot);
}

function parsePathFeatures(data) {
  return (data?.features || [])
    .map(feature => {
      const properties = feature?.properties || {};
      const pathCoordinates = Array.isArray(feature?.geometry?.coordinates)
        ? feature.geometry.coordinates.map(normalizeCoordinatePair).filter(Boolean)
        : [];

      const edgeId = String(properties.edge_id || "").replace(/\uFEFF/g, "").trim();
      const fromId = String(properties.from_id || "").trim();
      const toId = String(properties.to_id || "").trim();
      if (!edgeId || !fromId || !toId) return null;
      const source = String(properties.source || "").trim().toLowerCase();
      if (source === "auto_proximity" && DISALLOWED_AUTO_PROXIMITY_EDGE_IDS.has(edgeId)) return null;

      return {
        edgeId,
        fromId,
        toId,
        mode: String(properties.mode || "").trim().toLowerCase(),
        pathCoordinates,
        notes: String(properties.notes || "").trim(),
        source
      };
    })
    .filter(Boolean);
}

function parseMissingPathRecords(data) {
  return (data || [])
    .map(edge => {
      const edgeId = String(edge?.edge_id || "").replace(/\uFEFF/g, "").trim();
      const fromId = String(edge?.from_id || "").trim();
      const toId = String(edge?.to_id || "").trim();
      if (!edgeId || !fromId || !toId) return null;
      if (EXISTING_PATH_EDGE_IDS.has(edgeId)) return null;
      if (DISALLOWED_AUTO_PROXIMITY_EDGE_IDS.has(edgeId)) return null;

      return {
        edgeId,
        fromId,
        toId,
        mode: String(edge?.mode || "").trim().toLowerCase(),
        pathCoordinates: [],
        notes: String(edge?.notes || "").trim(),
        source: "auto_proximity"
      };
    })
    .filter(Boolean);
}

function formatParkingTypeLabel(parkingType) {
  const normalized = String(parkingType || "").trim().toLowerCase();
  if (normalized === "faculty_staff") return "Faculty/Staff Parking";
  if (normalized === "overnight") return "Overnight Parking";
  if (normalized === "visitor") return "Visitor Parking";
  if (normalized === "student") return "Student Parking";
  return "Parking";
}

function inferParkingTypeFromName(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("overnight")) return "overnight";
  if (text.includes("faculty") || text.includes("staff")) return "faculty_staff";
  if (text.includes("visitor")) return "visitor";
  return "student";
}

function getParkingLabelOverrides(name) {
  const normalized = normalizeId(name);
  if (normalized === "hynes_hall_lot") {
    return {
      anchor: [40.68303, -74.23184],
      direction: "center",
      offset: [0, 0]
    };
  }
  if (normalized === "hynes_hall_lot_overflow_lot") {
    return {
      anchor: [40.68312, -74.23034],
      direction: "center",
      offset: [0, 0]
    };
  }
  if (normalized === "kean_parking_garage") {
    return {
      anchor: [40.682245, -74.23159],
      direction: "center",
      offset: [0, 0]
    };
  }
  if (normalized === "admissions_faculty_lot") {
    return {
      anchor: [40.68086, -74.23374],
      direction: "top",
      offset: [0, -4]
    };
  }
  return { direction: "center", offset: [0, 0] };
}

function getBuildingImage(building) {
  const candidates = [
    building?.id,
    building?.name,
    ...(BUILDING_IMAGE_ALIASES[normalizeId(building?.id)] || [])
  ].filter(Boolean);

  let bestImage = null;
  let bestScore = 0;

  for (const image of buildingImageRecords) {
    let imageScore = 0;
    for (const candidate of candidates) {
      imageScore = Math.max(imageScore, scoreImageCandidate(candidate, image));
    }
    if (imageScore > bestScore) {
      bestScore = imageScore;
      bestImage = image;
    }
  }

  return bestScore >= 60 ? bestImage?.src || null : null;
}

function getLocationImage(location) {
  if (!location) return null;
  if (location.type === "shuttle_stop") {
    return getBuildingImage({ id: "kean_shuttle_bus", name: "Kean Shuttle Bus" });
  }
  if (location.type === "emergency_phone") {
    return getBuildingImage({ id: "emergency_phone", name: "Emergency Phone" });
  }
  if (location.type === "bike_scooter_parking") {
    return getBuildingImage(location) || bikeIconImage;
  }
  if (location.type === "ev_charging_station") {
    return evChargingIconImage;
  }
  return getBuildingImage(location);
}

function getLocationImagePlaceholder(location) {
  if (location?.id === "learning_plaza") {
    return "src/assets/buildings/Learning Plaza.jpg";
  }
  return null;
}

function getLocationMarkerIcon(location) {
  if (location?.type === "shuttle_stop") return shuttleStopMarkerIcon;
  if (location?.type === "emergency_phone") return emergencyPhoneMarkerIcon;
  if (location?.type === "bike_scooter_parking") return bikeScooterMarkerIcon;
  if (location?.type === "ev_charging_station") return evChargingMarkerIcon;
  return campusMarkerIcon;
}

function createSquareAroundPoint([lat, lon], delta = 0.00012) {
  return [
    [lat + delta, lon - delta],
    [lat + delta, lon + delta],
    [lat - delta, lon + delta],
    [lat - delta, lon - delta]
  ];
}

function getBuildingProfile(building) {
  const profile = buildingProfiles[building.id];
  if (profile) return profile;

  const isResidence = /hall|residence/i.test(building.name);
  if (isResidence) {
    return {
      usage: "Residential facility for campus housing.",
      departments: ["Housing and Residence Life"],
      notes: "Contact Housing and Residence Life for occupancy and assignment details."
    };
  }

  return {
    usage: "Campus building used for academic, student, or operational functions.",
    departments: ["Details available from campus directory"],
    notes: "Detailed profile for this building is being added."
  };
}

function getLocationProfile(location) {
  if (!location) return null;
  if (location.type === "building") return getBuildingProfile(location);
  if (location.type === "field") {
    return {
      usage: "Outdoor athletics and recreation area on campus.",
      departments: ["Athletics"],
      notes: "Use the map route tools for walking directions to this field."
    };
  }
  if (location.type === "lawn" || location.type === "landmark") {
    return {
      usage: "Campus point of interest used for wayfinding, gathering, or public art.",
      departments: ["Campus Directory"],
      notes: "This location can be highlighted directly from the map and directory."
    };
  }
  if (location.type === "shuttle_stop") {
    return {
      usage: "Campus shuttle pickup and drop-off stop.",
      departments: ["Kean Shuttle"],
      notes:
        "7:30 AM - 10:50 PM. The shuttle runs on weekdays during the fall and spring semesters, traveling around the Union campus. After 5 pm, the route is switched to an on-demand function."
    };
  }
  if (location.type === "emergency_phone") {
    return {
      usage: "Emergency phone location for campus safety and urgent assistance.",
      departments: ["Campus Police"],
      notes: "Use this phone to contact emergency services or campus security."
    };
  }
  if (location.type === "bike_scooter_parking") {
    return {
      usage: "Bike and scooter parking area for securing bicycles and small personal mobility devices.",
      departments: ["Campus Directory", "Transportation Support"],
      notes: "Use the bike racks or scooter parking area shown here. East Campus locations use the bike icon when no location photo is available."
    };
  }
  if (location.type === "ev_charging_station") {
    return {
      usage: "Electric vehicle charging station available on campus for EV charging.",
      departments: ["Parking and Transportation"],
      notes: "This location is marked as an EV charging station."
    };
  }
  return {
    usage: "Campus point of interest.",
    departments: ["Campus Directory"],
    notes: "Additional details for this location are being added."
  };
}

function haversineDistanceMeters([lat1, lon1], [lat2, lon2]) {
  const toRadians = value => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function alignSegmentToEndpoints(segment, fromPosition, toPosition) {
  const points = Array.isArray(segment)
    ? segment
        .filter(point => Array.isArray(point) && point.length === 2)
        .map(([lat, lon]) => [lat, lon])
    : [];

  if (points.length === 0) {
    return [fromPosition, toPosition].filter(Boolean);
  }

  if (fromPosition) {
    if (points.length === 1) {
      points.unshift(fromPosition);
    } else {
      points[0] = fromPosition;
    }
  }

  if (toPosition) {
    if (points.length === 1) {
      points.push(toPosition);
    } else {
      points[points.length - 1] = toPosition;
    }
  }

  return points;
}

function orientSegmentFromStart(segment, fromPosition) {
  const points = Array.isArray(segment)
    ? segment
        .filter(point => Array.isArray(point) && point.length === 2)
        .map(([lat, lon]) => [lat, lon])
    : [];

  if (points.length < 2 || !fromPosition) return points;

  const firstDistance = haversineDistanceMeters(points[0], fromPosition);
  const lastDistance = haversineDistanceMeters(points[points.length - 1], fromPosition);
  return lastDistance < firstDistance ? [...points].reverse() : points;
}

function measurePathDistance(segment) {
  let total = 0;
  for (let index = 1; index < segment.length; index += 1) {
    total += haversineDistanceMeters(segment[index - 1], segment[index]);
  }
  return total;
}

function midpointBetweenPoints([latA, lonA], [latB, lonB]) {
  return [(latA + latB) / 2, (lonA + lonB) / 2];
}

function isPointInPolygon([lat, lon], polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    const intersects =
      lonI > lon !== lonJ > lon &&
      lat < ((latJ - latI) * (lon - lonI)) / ((lonJ - lonI) || Number.EPSILON) + latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isInsideCampus([lat, lon]) {
  return isPointInPolygon([lat, lon], SUPPORTED_WALKING_AREA_POLYGON);
}

function getLocationById(id, locationsById) {
  return locationsById.get(id);
}

function getLocationDisplayName(location, locationsById) {
  if (!location) return "";
  if (location.type !== "entrance") return location.name;

  const parent = location.parent ? locationsById.get(location.parent) : null;
  if (!parent) return location.name;

  const parentName = parent.name;
  const rawName = String(location.name || "");
  const withoutParent = rawName
    .replace(parentName, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutParent) return parentName;

  const normalizedSuffix = withoutParent
    .replace(/^entrance\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedSuffix) return `${parentName} Main Entrance`;

  const prettySuffix = normalizedSuffix
    .replace(/\bfront(\d+)\b/i, "Front Entrance $1")
    .replace(/\brear(\d+)\b/i, "Rear Entrance $1")
    .replace(/\bside(\d+)\b/i, "Side Entrance $1")
    .replace(/\bfront\b/i, "Front Entrance")
    .replace(/\brear\b/i, "Rear Entrance")
    .replace(/\bside\b/i, "Side Entrance")
    .replace(/\bmain\b/i, "Main Entrance")
    .trim();

  return `${parentName} - ${prettySuffix}`;
}

function getNearestLocation(position, locations) {
  let nearest = locations[0];
  let minDistance = Number.POSITIVE_INFINITY;

  locations.forEach(location => {
    const distance = haversineDistanceMeters(position, location.position);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = location;
    }
  });

  return nearest;
}

function scoreRoutableCandidate(candidateId, requestedId, locationsById) {
  const location = locationsById.get(candidateId);
  if (!location) return Number.NEGATIVE_INFINITY;

  const normalizedRequested = normalizeId(requestedId);
  const normalizedCandidate = normalizeId(candidateId);
  const normalizedParent = normalizeId(location.parent);
  const label = `${candidateId} ${location.name || ""}`.toLowerCase();
  let score = 0;

  if (candidateId === requestedId) score += 2000;
  if (normalizedCandidate && normalizedCandidate === normalizedRequested) score += 1200;
  if (location.parent && location.parent === requestedId) score += 1000;
  if (normalizedParent && normalizedParent === normalizedRequested) score += 900;

  if (location.type === "entrance") score += 600;
  else if (location.type === "building") score += 420;
  else if (location.type === "parking") score += 120;
  else if (location.type === "bike_scooter_parking") score += 80;
  else if (location.type === "route_node") score += 60;
  else score += 180;

  if (/\bmain\b/.test(label)) score += 90;
  if (/\bfront\b/.test(label)) score += 55;
  if (/\brear\b/.test(label)) score -= 35;
  if (/\bside\b/.test(label)) score -= 15;

  return score;
}

function resolveEdgeNodeId(rawId, locationsById, routableLocationIds, childrenByParent, resolveRoutableId) {
  const requested = String(rawId || "").trim();
  if (!requested) return null;

  const mergedRequested = MERGED_ROUTE_NODE_IDS[requested];
  if (mergedRequested && routableLocationIds.has(mergedRequested)) return mergedRequested;

  if (routableLocationIds.has(requested)) return requested;

  const aliasedRequested = ROUTE_NODE_ALIASES[requested];
  if (aliasedRequested && routableLocationIds.has(aliasedRequested)) {
    return aliasedRequested;
  }

  const location = locationsById.get(requested);
  if (location) {
    const candidates = [];

    const pushRoutable = candidateId => {
      if (!candidateId || !routableLocationIds.has(candidateId)) return;
      const candidate = locationsById.get(candidateId);
      if (!candidate || !candidate.position || !location.position) return;
      const distance = haversineDistanceMeters(location.position, candidate.position);
      candidates.push({ id: candidateId, distance });
    };

    const siblingParent = location.parent || null;
    if (siblingParent && childrenByParent.has(siblingParent)) {
      childrenByParent.get(siblingParent).forEach(pushRoutable);
    }
    if (childrenByParent.has(requested)) {
      childrenByParent.get(requested).forEach(pushRoutable);
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distance - b.distance);
      return candidates[0].id;
    }
  }

  return resolveRoutableId(requested);
}

function buildGraph(routableLocations, locationsById, edges, resolveRoutableId, routableLocationIds, childrenByParent) {
  const graph = {};
  const edgeGeometryByKey = {};

  routableLocations.forEach(location => {
    graph[location.id] = [];
  });

  edges.forEach(edge => {
    if (edge.mode && edge.mode !== "walk") return;
    const fromId = resolveEdgeNodeId(edge.fromId, locationsById, routableLocationIds, childrenByParent, resolveRoutableId);
    const toId = resolveEdgeNodeId(edge.toId, locationsById, routableLocationIds, childrenByParent, resolveRoutableId);
    if (!fromId || !toId || fromId === toId) return;

    const from = getLocationById(fromId, locationsById);
    const to = getLocationById(toId, locationsById);
    if (!from || !to) return;

    const hasTracedGeometry = edge.pathCoordinates.length > 1;
    const rawCoordinates = hasTracedGeometry
      ? orientSegmentFromStart(edge.pathCoordinates, from.position)
      : [from.position, to.position];
    const startMismatchMeters =
      hasTracedGeometry && rawCoordinates.length > 0
        ? haversineDistanceMeters(rawCoordinates[0], from.position)
        : 0;
    const endMismatchMeters =
      hasTracedGeometry && rawCoordinates.length > 1
        ? haversineDistanceMeters(rawCoordinates[rawCoordinates.length - 1], to.position)
        : 0;
    const canTrustTracedGeometry =
      hasTracedGeometry &&
      startMismatchMeters <= MAX_TRACED_ENDPOINT_MISMATCH_METERS &&
      endMismatchMeters <= MAX_TRACED_ENDPOINT_MISMATCH_METERS;

    const coordinates = canTrustTracedGeometry
      ? rawCoordinates
      : alignSegmentToEndpoints(rawCoordinates, from.position, to.position);

    let weight = measurePathDistance(coordinates);
    if (hasTracedGeometry && !canTrustTracedGeometry) {
      // Mismatched traced edges tend to create bogus shortcuts and stretched route lines.
      weight *= 2.4;
    }
    if (edge.source === "auto_proximity") {
      weight *= hasTracedGeometry ? 1.35 : 5.0;
    } else if (!hasTracedGeometry) {
      weight *= 3.5;
    }

    const forwardEdgeKey = `${edge.edgeId}:${fromId}=>${toId}`;
    const reverseEdgeKey = `${edge.edgeId}:${toId}=>${fromId}`;

    graph[fromId].push({ id: toId, weight, edgeKey: forwardEdgeKey });
    graph[toId].push({ id: fromId, weight, edgeKey: reverseEdgeKey });
    edgeGeometryByKey[forwardEdgeKey] = coordinates;
    edgeGeometryByKey[reverseEdgeKey] = [...coordinates].reverse();
  });

  return { graph, edgeGeometryByKey };
}

function dijkstra(startId, endId, graph) {
  if (!startId || !endId || !graph[startId] || !graph[endId]) return { routeIds: [], edgeKeys: [] };
  if (startId === endId) return { routeIds: [startId], edgeKeys: [] };

  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(graph));

  Object.keys(graph).forEach(id => {
    distances[id] = Number.POSITIVE_INFINITY;
    previous[id] = { nodeId: null, edgeKey: null };
  });

  distances[startId] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    unvisited.forEach(id => {
      if (distances[id] < bestDistance) {
        bestDistance = distances[id];
        current = id;
      }
    });

    if (!current || bestDistance === Number.POSITIVE_INFINITY) break;
    if (current === endId) break;

    unvisited.delete(current);

    graph[current].forEach(({ id: neighborId, weight, edgeKey }) => {
      if (!unvisited.has(neighborId)) return;
      const candidate = distances[current] + weight;
      if (candidate < distances[neighborId]) {
        distances[neighborId] = candidate;
        previous[neighborId] = { nodeId: current, edgeKey };
      }
    });
  }

  const routeIds = [];
  const edgeKeys = [];
  let cursor = endId;

  while (cursor) {
    routeIds.unshift(cursor);
    const previousStep = previous[cursor];
    if (previousStep?.edgeKey) {
      edgeKeys.unshift(previousStep.edgeKey);
    }
    cursor = previousStep?.nodeId;
  }

  if (routeIds[0] !== startId) return { routeIds: [], edgeKeys: [] };
  return { routeIds, edgeKeys };
}

function createPenalizedGraph(graph, edgeKeys, penaltyMultiplier = 1.9) {
  if (edgeKeys.length === 0) return graph;

  const penalizedEdges = new Set(edgeKeys);

  const nextGraph = {};
  Object.entries(graph).forEach(([nodeId, edges]) => {
    nextGraph[nodeId] = edges.map(edge => ({
      ...edge,
      weight: penalizedEdges.has(edge.edgeKey) ? edge.weight * penaltyMultiplier : edge.weight
    }));
  });
  return nextGraph;
}

function buildRouteVariants(startId, endId, graph, edgeGeometryByKey, locationsById, maxRoutes = 3) {
  const routes = [];
  const seen = new Set();
  let workingGraph = graph;

  for (let index = 0; index < maxRoutes; index += 1) {
    const route = dijkstra(startId, endId, workingGraph);
    if (route.routeIds.length < 2) break;

    const signature = route.edgeKeys.join("|");
    if (seen.has(signature)) break;
    seen.add(signature);

    const coordinates = routeIdsToCoordinates(route.routeIds, route.edgeKeys, edgeGeometryByKey, locationsById);
    if (coordinates.length < 2) break;

    routes.push({ routeIds: route.routeIds, edgeKeys: route.edgeKeys, coordinates });
    workingGraph = createPenalizedGraph(workingGraph, route.edgeKeys);
  }

  return routes;
}

function routeIdsToCoordinates(routeIds, edgeKeys, edgeGeometryByKey, locationsById) {
  if (routeIds.length === 0) return [];
  if (routeIds.length === 1) {
    const only = locationsById.get(routeIds[0]);
    return only ? [only.position] : [];
  }

  const coordinates = [];
  for (let i = 1; i < routeIds.length; i += 1) {
    const fromId = routeIds[i - 1];
    const toId = routeIds[i];
    const fromPosition = locationsById.get(fromId)?.position;
    const toPosition = locationsById.get(toId)?.position;
    const segment = (edgeGeometryByKey[edgeKeys[i - 1]] || [fromPosition, toPosition].filter(Boolean)).map(
      ([lat, lon]) => [lat, lon]
    );
    if (segment.length === 0) continue;

    if (i === 1 && fromPosition) {
      if (haversineDistanceMeters(segment[0], fromPosition) > 6) {
        segment.unshift(fromPosition);
      } else {
        segment[0] = fromPosition;
      }
    }

    if (i === routeIds.length - 1 && toPosition) {
      if (haversineDistanceMeters(segment[segment.length - 1], toPosition) > 6) {
        segment.push(toPosition);
      } else {
        segment[segment.length - 1] = toPosition;
      }
    }

    if (coordinates.length === 0) {
      coordinates.push(...segment);
      continue;
    }

    const previousPoint = coordinates[coordinates.length - 1];
    const nextPoint = segment[0];
    const joinGapMeters = haversineDistanceMeters(previousPoint, nextPoint);

    if (joinGapMeters <= MAX_ROUTE_SEGMENT_MERGE_GAP_METERS) {
      coordinates.push(...segment.slice(1));
      continue;
    }

    if (joinGapMeters <= MAX_ROUTE_SEGMENT_JOIN_GAP_METERS) {
      const joinPoint = midpointBetweenPoints(previousPoint, nextPoint);
      coordinates[coordinates.length - 1] = joinPoint;
      segment[0] = joinPoint;
      coordinates.push(...segment.slice(1));
      continue;
    }

    coordinates.push(...segment);
  }

  const startLocation = locationsById.get(routeIds[0]);
  const endLocation = locationsById.get(routeIds[routeIds.length - 1]);
  if (startLocation?.position) {
    if (coordinates.length === 0) {
      coordinates.push(startLocation.position);
    } else if (haversineDistanceMeters(coordinates[0], startLocation.position) > 6) {
      coordinates.unshift(startLocation.position);
    } else {
      coordinates[0] = startLocation.position;
    }
  }
  if (endLocation?.position) {
    if (coordinates.length === 0) {
      coordinates.push(endLocation.position);
    } else if (haversineDistanceMeters(coordinates[coordinates.length - 1], endLocation.position) > 6) {
      coordinates.push(endLocation.position);
    } else {
      coordinates[coordinates.length - 1] = endLocation.position;
    }
  }

  return coordinates;
}

function isGenericRouteCue(label) {
  const normalized = String(label || "").toLowerCase();
  return (
    !normalized ||
    /\blot\b/.test(normalized) ||
    /\bparking\b/.test(normalized) ||
    /\bentrance\b/.test(normalized) ||
    /\bcharging\b/.test(normalized) ||
    /\bphone\b/.test(normalized) ||
    /\bshuttle stop\b/.test(normalized)
  );
}

function getRouteCueLabel(location, locationsById) {
  if (!location || location.type === "route_node") return "";

  if (location.type === "entrance") {
    const parent = location.parent ? locationsById.get(location.parent) : null;
    return parent?.name || "";
  }

  if (location.type === "parking") return "";
  if (location.type === "bike_scooter_parking") return "";
  if (location.type === "shuttle_stop") return "";
  if (location.type === "emergency_phone") return "";
  if (location.type === "ev_charging_station") return "";

  return location.name || "";
}

function buildNotableRouteStops(routeIds, locationsById, startLabel, endLabel) {
  const normalizedStart = normalizeId(startLabel);
  const normalizedEnd = normalizeId(endLabel);
  const names = [];

  routeIds.forEach(id => {
    const location = locationsById.get(id);
    const label = getRouteCueLabel(location, locationsById);
    if (!label || isGenericRouteCue(label)) return;

    const normalizedLabel = normalizeId(label);
    if (!normalizedLabel || normalizedLabel === normalizedStart || normalizedLabel === normalizedEnd) return;

    if (!names.some(existing => normalizeId(existing) === normalizedLabel)) {
      names.push(label);
    }
  });

  return names;
}

function routeCrossesVerticalBand(routeCoordinates, longitude, minLat, maxLat) {
  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const [prevLat, prevLon] = routeCoordinates[index - 1];
    const [nextLat, nextLon] = routeCoordinates[index];
    const segmentMinLat = Math.min(prevLat, nextLat);
    const segmentMaxLat = Math.max(prevLat, nextLat);
    if (segmentMaxLat < minLat || segmentMinLat > maxLat) continue;
    const crosses =
      (prevLon <= longitude && nextLon >= longitude) ||
      (prevLon >= longitude && nextLon <= longitude);
    if (crosses) return true;
  }
  return false;
}

function findVerticalBandCrossingIndex(routeCoordinates, longitude, minLat, maxLat) {
  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const [prevLat, prevLon] = routeCoordinates[index - 1];
    const [nextLat, nextLon] = routeCoordinates[index];
    const segmentMinLat = Math.min(prevLat, nextLat);
    const segmentMaxLat = Math.max(prevLat, nextLat);
    if (segmentMaxLat < minLat || segmentMinLat > maxLat) continue;
    const crosses =
      (prevLon <= longitude && nextLon >= longitude) ||
      (prevLon >= longitude && nextLon <= longitude);
    if (crosses) return index;
  }
  return -1;
}

function routeCrossesHorizontalBand(routeCoordinates, latitude, minLon, maxLon) {
  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const [prevLat, prevLon] = routeCoordinates[index - 1];
    const [nextLat, nextLon] = routeCoordinates[index];
    const segmentMinLon = Math.min(prevLon, nextLon);
    const segmentMaxLon = Math.max(prevLon, nextLon);
    if (segmentMaxLon < minLon || segmentMinLon > maxLon) continue;
    const crosses =
      (prevLat <= latitude && nextLat >= latitude) ||
      (prevLat >= latitude && nextLat <= latitude);
    if (crosses) return true;
  }
  return false;
}

function findHorizontalBandCrossingIndex(routeCoordinates, latitude, minLon, maxLon) {
  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const [prevLat, prevLon] = routeCoordinates[index - 1];
    const [nextLat, nextLon] = routeCoordinates[index];
    const segmentMinLon = Math.min(prevLon, nextLon);
    const segmentMaxLon = Math.max(prevLon, nextLon);
    if (segmentMaxLon < minLon || segmentMinLon > maxLon) continue;
    const crosses =
      (prevLat <= latitude && nextLat >= latitude) ||
      (prevLat >= latitude && nextLat <= latitude);
    if (crosses) return index;
  }
  return -1;
}

function routeTouchesArea(routeCoordinates, bounds) {
  return routeCoordinates.some(([lat, lon]) =>
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lon >= bounds.minLon &&
    lon <= bounds.maxLon
  );
}

function firstRoutePointBeyondDistance(routeCoordinates, targetDistanceMeters = 30) {
  if (routeCoordinates.length < 2) return null;
  const origin = routeCoordinates[0];
  for (let index = 1; index < routeCoordinates.length; index += 1) {
    if (haversineDistanceMeters(origin, routeCoordinates[index]) >= targetDistanceMeters) {
      return routeCoordinates[index];
    }
  }
  return routeCoordinates[routeCoordinates.length - 1];
}

function getBearingDegrees([lat1, lon1], [lat2, lon2]) {
  const toRadians = value => (value * Math.PI) / 180;
  const toDegrees = value => (value * 180) / Math.PI;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const lambda1 = toRadians(lon1);
  const lambda2 = toRadians(lon2);
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function bearingToCompassDirection(bearing) {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const index = Math.round(bearing / 45) % directions.length;
  return directions[index];
}

function inferRouteCrossingSteps(routeCoordinates) {
  if (routeCoordinates.length < 2) return [];

  const steps = [];
  const greenLaneCrossingIndex = findHorizontalBandCrossingIndex(routeCoordinates, 40.68172, -74.2372, -74.2342);
  const morrisAveCrossingIndex = findVerticalBandCrossingIndex(routeCoordinates, -74.23318, 40.6792, 40.6836);
  const vermellaWayCrossingIndex = findHorizontalBandCrossingIndex(routeCoordinates, 40.68296, -74.23395, -74.23135);
  const touchesTrainStationArea = routeTouchesArea(routeCoordinates, {
    minLat: 40.68245,
    maxLat: 40.68395,
    minLon: -74.2391,
    maxLon: -74.23635
  });

  if (greenLaneCrossingIndex >= 0) {
    steps.push({
      order: greenLaneCrossingIndex,
      text: "Cross Green Lane and continue on the campus-side walkway."
    });
  }
  if (morrisAveCrossingIndex >= 0) {
    steps.push({
      order: morrisAveCrossingIndex,
      text: "Cross Morris Avenue at a marked crossing to move between the main campus side and the east-side buildings."
    });
  }
  if (vermellaWayCrossingIndex >= 0) {
    steps.push({
      order: vermellaWayCrossingIndex,
      text: "Cross Vermella Way near the Hynes Hall and shopping-center side of campus."
    });
  }
  if (touchesTrainStationArea) {
    steps.push({
      order: routeCoordinates.length,
      text: "Use the train station crossing area to move safely between the station side and the campus walkways."
    });
  }

  return steps.sort((a, b) => a.order - b.order).map(step => step.text);
}

function buildChatRouteDirections(startLabel, endLabel, routeIds, routeCoordinates, locationsById, routeDistanceMeters) {
  if (!startLabel || !endLabel || routeIds.length < 2) return "";

  const notableStops = buildNotableRouteStops(routeIds, locationsById, startLabel, endLabel);
  const crossingSteps = inferRouteCrossingSteps(routeCoordinates);
  const firstHeadingPoint = firstRoutePointBeyondDistance(routeCoordinates);
  const headingDirection = firstHeadingPoint
    ? bearingToCompassDirection(getBearingDegrees(routeCoordinates[0], firstHeadingPoint))
    : "";
  const lines = [
    `Here are step-by-step directions from ${startLabel} to ${endLabel}:`,
    `1. Start at ${startLabel}.`
  ];

  if (headingDirection) {
    lines.push(`${lines.length}. Head ${headingDirection} on the campus walkways toward ${endLabel}.`);
  }

  crossingSteps.forEach(step => {
    lines.push(`${lines.length}. ${step}`);
  });

  if (notableStops.length > 0) {
    const [firstStop, secondStop] = notableStops;
    lines.push(`${lines.length}. Stay on the main pedestrian route toward ${endLabel}${firstStop ? `, passing ${firstStop}` : ""}.`);
    if (secondStop) {
      lines.push(`${lines.length}. Continue past ${secondStop} and follow the walkway signs toward ${endLabel}.`);
    } else if (notableStops.length > 1) {
      lines.push(`${lines.length}. Keep following the marked campus walkways toward ${endLabel}.`);
    }
  } else if (!headingDirection || crossingSteps.length === 0) {
    lines.push(`${lines.length}. Stay on the main campus walkways toward ${endLabel}.`);
  }

  lines.push(`${lines.length}. Arrive at ${endLabel}.`);

  if (routeDistanceMeters > 0) {
    const routeDistanceFeet = routeDistanceMeters * 3.28084;
    lines.push(`${lines.length}. The route is about ${Math.round(routeDistanceFeet)} feet long.`);
  }

  return lines.join("\n");
}

function RouteViewport({ routeCoordinates }) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates.length < 2) return;
    const timer = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
      const bounds = L.latLngBounds(routeCoordinates);
      const handleMoveEnd = () => {
        window.setTimeout(() => map.invalidateSize({ pan: false }), 60);
      };
      map.once("moveend", handleMoveEnd);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: MAP_DETAIL_ZOOM, animate: false });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [map, routeCoordinates]);

  return null;
}

function HighlightViewport({ destination, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !destination) return;
    const timer = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
      const handleMoveEnd = () => {
        window.setTimeout(() => map.invalidateSize({ pan: false }), 60);
      };
      map.once("moveend", handleMoveEnd);
      map.setView(destination, MAP_FOCUS_ZOOM, { animate: false });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [destination, enabled, map]);

  return null;
}

function MapSizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function MapResizeObserver() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === "undefined") return undefined;

    let frameId = 0;
    const observer = new ResizeObserver(() => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [map]);

  return null;
}

function MapPanel({ setShowMap, routeRequest, standalone = false, onRouteDirectionsChange }) {
  const MOBILE_MAP_BREAKPOINT = 720;
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [userPosition, setUserPosition] = useState(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [campusFilter, setCampusFilter] = useState("All Campuses");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [locationMode, setLocationMode] = useState("directions");
  const [showBuildingList, setShowBuildingList] = useState(true);
  const [showDirectoryPanel, setShowDirectoryPanel] = useState(false);
  const [locations, setLocations] = useState([]);
  const [pathEdges, setPathEdges] = useState([]);
  const [parkingLots, setParkingLots] = useState([]);
  const [dataError, setDataError] = useState("");
  const [highlightTargetId, setHighlightTargetId] = useState(null);
  const [routeChatPreface, setRouteChatPreface] = useState("");
  const [isResolvingCurrentStart, setIsResolvingCurrentStart] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_MAP_BREAKPOINT : false
  ));
  const [showMobileControls, setShowMobileControls] = useState(false);
  const lastAppliedRouteRequestRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      const nextIsMobile = window.innerWidth <= MOBILE_MAP_BREAKPOINT;
      setIsMobileViewport(nextIsMobile);
      if (!nextIsMobile) {
        setShowMobileControls(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    try {
      const parsedLocations = parseLocationRecords(campusLocationsData);
      const routingNodes = parseRoutingNodes(routingGraphData, parsedLocations);
      setLocations([...parsedLocations, ...routingNodes]);
      setParkingLots(parseParkingGeoJson(parkingLotsGeoJson));
      setPathEdges([...parsePathFeatures(pathsGeoJson), ...parseMissingPathRecords(missingPathsData)]);
      setDataError("");
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Map data failed to load.");
    }
  }, []);

  const locationsById = useMemo(() => {
    const map = new Map();
    locations.forEach(location => {
      map.set(location.id, location);
    });
    return map;
  }, [locations]);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    locations.forEach(location => {
      if (!location.parent) return;
      if (!map.has(location.parent)) map.set(location.parent, []);
      map.get(location.parent).push(location.id);
    });
    return map;
  }, [locations]);

  const routableLocationIds = useMemo(() => {
    const set = new Set();
    locations.forEach(location => {
      if (location.routable) set.add(location.id);
    });
    return set;
  }, [locations]);

  const aliasCandidatesByNormalizedId = useMemo(() => {
    const map = new Map();
    const addAlias = (alias, id) => {
      const normalized = normalizeId(alias);
      if (!normalized) return;
      if (!map.has(normalized)) map.set(normalized, []);
      if (!map.get(normalized).includes(id)) map.get(normalized).push(id);
    };

    locations.forEach(location => {
      const id = location.id;
      const normalizedId = normalizeId(id);
      addAlias(id, id);
      addAlias(normalizedId, id);
      addAlias(location.name, id);

      const base = normalizedId
        .replace(/_entrance_(front|rear|side)\d*$/g, "")
        .replace(/_(front|rear|side)\d*$/g, "")
        .replace(/_main\d*$/g, "")
        .replace(/_entrance$/g, "");
      if (base) {
        addAlias(base, id);
        addAlias(`${base}_main`, id);
      }
    });

    Object.entries(ROUTE_NODE_ALIASES).forEach(([sourceId, targetId]) => {
      addAlias(sourceId, targetId);
    });

    return map;
  }, [locations]);

  const resolveRoutableId = useMemo(() => {
    return (rawId, options = {}) => {
      if (!rawId) return null;
      const requested = String(rawId).trim();
      if (!requested) return null;
      const normalizedRequested = normalizeId(requested);
      const preferDestination = options.preferDestination === true;
      const preferredDestinationId = preferDestination ? PREFERRED_ROUTE_DESTINATION_IDS[normalizedRequested] : null;
      if (preferredDestinationId && routableLocationIds.has(preferredDestinationId)) {
        return preferredDestinationId;
      }

      const candidates = [];
      const pushCandidate = candidate => {
        if (!candidate) return;
        if (!candidates.includes(candidate)) candidates.push(candidate);
      };

      pushCandidate(MERGED_ROUTE_NODE_IDS[requested]);
      pushCandidate(requested);
      pushCandidate(ROUTE_NODE_ALIASES[requested]);

      const normalizedCandidates = aliasCandidatesByNormalizedId.get(normalizeId(requested)) || [];
      normalizedCandidates.forEach(pushCandidate);

      candidates.forEach(candidate => {
        const children = childrenByParent.get(candidate) || [];
        children.forEach(pushCandidate);
      });

      const rankedCandidates = candidates
        .filter(candidate => routableLocationIds.has(candidate))
        .map(candidate => ({
          id: candidate,
          score: scoreRoutableCandidate(candidate, requested, locationsById)
        }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

      return rankedCandidates[0]?.id || null;
    };
  }, [aliasCandidatesByNormalizedId, childrenByParent, locationsById, routableLocationIds]);

  const graphLocations = useMemo(() => locations.filter(location => location.routable), [locations]);

  const routableLocations = useMemo(
    () =>
      locations
        .filter(location => location.routable && location.type !== "route_node")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [locations]
  );

  const pointMarkers = useMemo(
    () =>
      locations.filter(
        location =>
          MARKER_LOCATION_TYPES.has(location.type) &&
          !HIDDEN_BUILDING_MARKER_IDS.has(location.id)
      ),
    [locations]
  );

  const entranceMarkers = useMemo(
    () => locations.filter(location => location.type === "entrance"),
    [locations]
  );

  const allParkingLots = useMemo(() => parkingLots, [parkingLots]);
  const parkingLabelAnchors = useMemo(() => {
    const anchors = new Map();
    allParkingLots.forEach(lot => {
      const override = getParkingLabelOverrides(lot.name);
      if (override.anchor) {
        anchors.set(lot.id, override.anchor);
        return;
      }

      const normalizedLotName = normalizeId(lot.name).replace(/_near_hynes$/, "");
      const matchingLocation = campusLocationsData.find(location => {
        if (String(location?.type || "").trim().toLowerCase() !== "parking") return false;
        const normalizedLocationName = normalizeId(location.name);
        return normalizedLocationName === normalizedLotName || normalizedLocationName.replace(/_near_hynes$/, "") === normalizedLotName;
      });

      if (matchingLocation) {
        const anchor = getLocationPosition(matchingLocation);
        if (anchor) {
          anchors.set(lot.id, anchor);
          return;
        }
      }

      const fallback = lot.polygon.reduce(
        (acc, [lat, lon]) => [acc[0] + lat, acc[1] + lon],
        [0, 0]
      );
      anchors.set(lot.id, [fallback[0] / lot.polygon.length, fallback[1] / lot.polygon.length]);
    });
    return anchors;
  }, [allParkingLots]);

  const directoryPlaces = useMemo(() => {
    return locations
      .filter(location => location.type !== "route_node")
      .map(location => {
        const resolvedDestinationId = resolveRoutableId(location.id);
        const parentName = location.parent ? locationsById.get(location.parent)?.name : null;
        const displayName = getLocationDisplayName(location, locationsById);
        return {
          id: location.id,
          name: displayName,
          rawName: location.name,
          campus: location.campus || "Main",
          category: LOCATION_TYPE_LABELS[location.type] || "Location",
          description: parentName
            ? `${LOCATION_TYPE_LABELS[location.type] || "Location"} for ${parentName}`
            : `${LOCATION_TYPE_LABELS[location.type] || "Location"} on campus`,
          locationType: location.type,
          destinationId: resolvedDestinationId || null
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, locationsById, resolveRoutableId]);

  const routeOptions = useMemo(() => {
    const byDestination = new Map();

    const getPriority = place => {
      if (place.locationType === "building") return 3;
      if (place.locationType === "parking") return 2;
      return 1;
    };

    directoryPlaces
      .filter(place => place.destinationId)
      .forEach(place => {
        const existing = byDestination.get(place.destinationId);
        if (!existing || getPriority(place) > getPriority(existing)) {
          byDestination.set(place.destinationId, place);
        }
      });

    return [...byDestination.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [directoryPlaces]);

  const routeOptionById = useMemo(() => {
    const map = new Map();
    routeOptions.forEach(option => {
      map.set(option.destinationId, option);
    });
    return map;
  }, [routeOptions]);
  const isRoutingDataReady = locations.length > 0 && pathEdges.length > 0 && routableLocationIds.size > 0;

  useEffect(() => {
    if (routableLocations.length === 0) return;

    const defaultStart =
      resolveRoutableId("kean_hall_entrance_front") ||
      resolveRoutableId("kean_hall_main") ||
      routableLocations[0].id;
    const defaultEnd =
      resolveRoutableId("library_main") ||
      resolveRoutableId("library") ||
      routableLocations[Math.min(1, routableLocations.length - 1)].id;

    setStartId(prev => resolveRoutableId(prev) || defaultStart);
    setEndId(prev => resolveRoutableId(prev) || defaultEnd);
  }, [resolveRoutableId, routableLocations]);

  const { graph, edgeGeometryByKey } = useMemo(
    () => buildGraph(graphLocations, locationsById, pathEdges, resolveRoutableId, routableLocationIds, childrenByParent),
    [childrenByParent, graphLocations, locationsById, pathEdges, resolveRoutableId, routableLocationIds]
  );

  const routeVariants = useMemo(
    () => buildRouteVariants(startId, endId, graph, edgeGeometryByKey, locationsById),
    [edgeGeometryByKey, endId, graph, locationsById, startId]
  );

  const routeBuildingIds = routeVariants[0]?.routeIds || [];
  const routeCoordinates = routeVariants[0]?.coordinates || [];

  const routeDistanceMeters = useMemo(() => {
    if (routeCoordinates.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < routeCoordinates.length; i += 1) {
      total += haversineDistanceMeters(routeCoordinates[i - 1], routeCoordinates[i]);
    }
    return total;
  }, [routeCoordinates]);

  const displayRouteCoordinates = useMemo(
    () => (locationMode === "highlight" ? [] : routeCoordinates),
    [locationMode, routeCoordinates]
  );
  const primaryRouteVariant = useMemo(
    () => (locationMode === "highlight" ? null : routeVariants[0] || null),
    [locationMode, routeVariants]
  );
  const routeOverlayKey = useMemo(
    () => `${startId}:${endId}:${primaryRouteVariant?.edgeKeys.join("|") || ""}`,
    [endId, primaryRouteVariant, startId]
  );
  const routeRequestKey = useMemo(
    () =>
      routeRequest
        ? [
            routeRequest.requestId || "",
            routeRequest.startId || "",
            routeRequest.destinationId || "",
            routeRequest.locationMode || "",
            routeRequest.useCurrentLocation ? "1" : "0"
          ].join("|")
        : "",
    [routeRequest]
  );
  const defaultCampusStartId = useMemo(
    () =>
      resolveRoutableId("wilkins_theatre_front") ||
      resolveRoutableId("wilkins_theatre_main") ||
      resolveRoutableId("wilkins_theatre") ||
      resolveRoutableId("morris_ave_student_lot") ||
      resolveRoutableId("glab_main") ||
      resolveRoutableId("glab") ||
      resolveRoutableId("miron_center_main") ||
      resolveRoutableId("miron_center") ||
      "",
    [resolveRoutableId]
  );
  const activeDirectionsRequest = useMemo(() => {
    if (!routeRequest || routeRequest.locationMode !== "directions") return null;

    const mappedDestination = resolveRoutableId(routeRequest.destinationId, { preferDestination: true });
    const mappedStart = resolveRoutableId(routeRequest.startId);
    const fallbackStart =
      !routeRequest.useCurrentLocation && !mappedStart && mappedDestination && defaultCampusStartId && defaultCampusStartId !== mappedDestination
        ? defaultCampusStartId
        : null;

    return {
      requestId: routeRequest.requestId || routeRequestKey,
      destinationId: mappedDestination || null,
      expectedStartId: routeRequest.useCurrentLocation ? null : mappedStart || fallbackStart || null,
      useDynamicStart: Boolean(routeRequest.useCurrentLocation)
    };
  }, [defaultCampusStartId, resolveRoutableId, routeRequest, routeRequestKey]);

  const campusOptions = useMemo(() => ["All Campuses", ...new Set(directoryPlaces.map(place => place.campus))], [directoryPlaces]);
  const filteredDirectoryPlaces = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return directoryPlaces.filter(place => {
      const matchesCampus = campusFilter === "All Campuses" || place.campus === campusFilter;
      if (!matchesCampus) return false;
      if (!query) return true;
      return (
        place.name.toLowerCase().includes(query) ||
        place.rawName.toLowerCase().includes(query) ||
        place.category.toLowerCase().includes(query) ||
        place.description.toLowerCase().includes(query)
      );
    });
  }, [campusFilter, directoryPlaces, directoryQuery]);

  const setMyLocationAsStart = useCallback(() => {
    if (routableLocations.length === 0) {
      setLocationStatus("Map data is still loading.");
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setUserPosition(coords);

        if (!isInsideCampus(coords)) {
          const fallbackStart = defaultCampusStartId || startId;
          if (fallbackStart) {
            setStartId(fallbackStart);
          }
          setLocationStatus("You appear to be outside the supported Kean walking area. Showing directions from a campus start point instead.");
          const fallbackName =
            routeOptionById.get(fallbackStart)?.name ||
            locationsById.get(fallbackStart)?.name ||
            "a campus starting point";
          setRouteChatPreface(
            `You appear to be outside the supported Kean walking area, so I opened directions starting from ${fallbackName}. If you are on or near campus, you can also use your current location there.`
          );
          setIsResolvingCurrentStart(false);
          return;
        }

        const nearest = getNearestLocation(coords, graphLocations);
        setStartId(nearest.id);
        setLocationStatus(`Using your location. Nearest start point: ${nearest.name}.`);
        setRouteChatPreface("I used your current location as the starting point.");
        setIsResolvingCurrentStart(false);
      },
      () => {
        setLocationStatus("Could not read your location. Check browser location permission.");
        setIsResolvingCurrentStart(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [defaultCampusStartId, endId, graphLocations, highlightTargetId, locationsById, onRouteDirectionsChange, routeOptionById, routableLocations.length, startId]);

  function swapRoute() {
    setLocationMode("directions");
    setHighlightTargetId(null);
    setRouteChatPreface("");
    setLocationStatus("");
    setStartId(endId);
    setEndId(startId);
  }

  function showDirections() {
    setLocationMode("directions");
    setHighlightTargetId(null);
    setRouteChatPreface("");
  }

  function handleStartChange(event) {
    setLocationMode("directions");
    setHighlightTargetId(null);
    setRouteChatPreface("");
    setLocationStatus("");
    setStartId(event.target.value);
  }

  function handleEndChange(event) {
    setLocationMode("directions");
    setHighlightTargetId(null);
    setRouteChatPreface("");
    setLocationStatus("");
    setEndId(event.target.value);
  }

  function routeToPlace(place) {
    const resolvedDestinationId = resolveRoutableId(place.destinationId, { preferDestination: true });
    if (!resolvedDestinationId) {
      setLocationStatus("Route data not set for this location yet. Select a mapped destination above.");
      return;
    }

    setLocationMode("directions");
    setEndId(resolvedDestinationId);
    setShowMap(true);
    setMyLocationAsStart();
  }

  const startBuilding = getLocationById(startId, locationsById);
  const endBuilding = getLocationById(endId, locationsById);
  const startLabel = routeOptionById.get(startId)?.name || startBuilding?.name;
  const endLabel = routeOptionById.get(endId)?.name || endBuilding?.name;
  const highlightTarget = getLocationById(highlightTargetId, locationsById) || endBuilding;
  const routeDirectionsText = useMemo(
    () => (
      locationMode === "highlight"
        ? ""
        : buildChatRouteDirections(startLabel, endLabel, routeBuildingIds, routeCoordinates, locationsById, routeDistanceMeters)
    ),
    [endLabel, locationMode, locationsById, routeBuildingIds, routeCoordinates, routeDistanceMeters, startLabel]
  );

  useEffect(() => {
    if (!routeRequest) return;
    if (!isRoutingDataReady) return;
    if (lastAppliedRouteRequestRef.current === routeRequestKey) return;

    const requestedStartId = String(routeRequest.startId || "").trim();
    const requestedDestinationId = String(routeRequest.destinationId || "").trim();
    const requestedDestination = routeRequest.destinationId ? getLocationById(routeRequest.destinationId, locationsById) : null;
    const mappedDestination = resolveRoutableId(routeRequest.destinationId, { preferDestination: true });
    const mappedStart = resolveRoutableId(routeRequest.startId);
    setRouteChatPreface("");
    if (mappedStart) {
      setStartId(mappedStart);
    }
    if (mappedDestination) {
      setEndId(mappedDestination);
    }
    setHighlightTargetId(routeRequest.destinationId || mappedDestination || null);

    const nextMode = routeRequest.locationMode === "directions" ? "directions" : "highlight";
    setLocationMode(nextMode);

    if (
      nextMode === "directions" &&
      ((requestedStartId && !mappedStart) || (requestedDestinationId && !mappedDestination))
    ) {
      setIsResolvingCurrentStart(false);
      setStartId(mappedStart || "");
      setEndId(mappedDestination || "");
      setLocationStatus("I could not match one of the requested route locations to a mapped campus entrance yet.");
      lastAppliedRouteRequestRef.current = routeRequestKey;
      return;
    }

    if (routeRequest.useCurrentLocation) {
      setLocationMode("directions");
      setIsResolvingCurrentStart(true);
      setStartId("");
      setMyLocationAsStart();
    } else if (mappedStart && mappedDestination) {
      setIsResolvingCurrentStart(false);
      setStartId(mappedStart);
      setLocationStatus("Loaded route in standalone map view.");
    } else if (mappedDestination) {
      setIsResolvingCurrentStart(false);
      const destination = requestedDestination || getLocationById(mappedDestination, locationsById);
      if (destination) {
        if (nextMode === "directions") {
          const fallbackStart = defaultCampusStartId && defaultCampusStartId !== mappedDestination ? defaultCampusStartId : "";
          if (fallbackStart) {
            setStartId(fallbackStart);
            setLocationStatus(`Loaded route to ${destination.name} from a campus starting point.`);
          } else {
            setLocationStatus(`Showing ${destination.name} on the map.`);
          }
        } else {
          setLocationStatus(`Showing ${destination.name} on the map.`);
        }
      }
    }
    lastAppliedRouteRequestRef.current = routeRequestKey;
  }, [defaultCampusStartId, isRoutingDataReady, locationsById, resolveRoutableId, routeRequest, routeRequestKey, setMyLocationAsStart]);

  useEffect(() => {
    if (typeof onRouteDirectionsChange !== "function") return;
    if (!routeRequest || locationMode !== "directions") return;
    if (isResolvingCurrentStart) return;
    if (activeDirectionsRequest?.destinationId && endId !== activeDirectionsRequest.destinationId) return;
    if (activeDirectionsRequest && !activeDirectionsRequest.useDynamicStart && activeDirectionsRequest.expectedStartId && startId !== activeDirectionsRequest.expectedStartId) {
      return;
    }
    if (activeDirectionsRequest?.useDynamicStart && !startId) return;
    if (startId && endId && routeCoordinates.length < 2) {
      onRouteDirectionsChange({
        id: `route-missing:${activeDirectionsRequest?.requestId || routeRequestKey}:${startId}:${endId}`,
        text: `I opened the map, but I could not generate a walking route from ${startLabel || "the starting point"} to ${endLabel || "the destination"} yet.`
      });
      return;
    }
    if (!routeDirectionsText) return;
    const combinedText = routeChatPreface
      ? `${routeChatPreface}\n${routeDirectionsText}`
      : routeDirectionsText;
    onRouteDirectionsChange({
      id: `route:${activeDirectionsRequest?.requestId || routeRequestKey}:${startId}:${endId}:${routeOverlayKey}:${routeChatPreface}`,
      text: combinedText
    });
  }, [activeDirectionsRequest, endId, endLabel, isResolvingCurrentStart, locationMode, onRouteDirectionsChange, routeChatPreface, routeCoordinates.length, routeDirectionsText, routeOverlayKey, routeRequest, routeRequestKey, startId, startLabel]);

  const standaloneMapUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (startId) params.set("start", startId);
    if (highlightTarget?.id) {
      params.set("destination", highlightTarget.id);
    } else if (endId) {
      params.set("destination", endId);
    }
    params.set("mode", locationMode === "highlight" ? "highlight" : "directions");
    const query = params.toString();
    return query ? `/map?${query}` : "/map";
  }, [endId, highlightTarget?.id, locationMode, startId]);

  const routeSummaryText =
    locationMode === "highlight"
      ? "Showing destination only"
      : routeCoordinates.length > 1
      ? `${Math.round(routeDistanceMeters)} m estimated path`
      : "No route found in campus graph";

  const shouldShowDesktopControls = !isMobileViewport;
  const shouldShowMobileControls = isMobileViewport && showMobileControls;
  const shouldRenderExpandedControls = shouldShowDesktopControls || shouldShowMobileControls;

  return (
    <div className="panel map-panel">
      <div className="map-header">
        <div className="map-header-copy">
          <h3 className="panel-title">Campus Map</h3>
          <div className="route-summary route-summary-inline">
            <strong>{startLabel}</strong> to <strong>{endLabel}</strong>
            {" - "}
            {routeSummaryText}
          </div>
        </div>
        {!isMobileViewport && (
          <div className="map-header-actions">
            {!standalone && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.open(standaloneMapUrl, "_blank", "noopener,noreferrer")}
              >
                Open in New Tab
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowBuildingList(prev => !prev)}
            >
              {showBuildingList ? "Hide Directions" : "Show Directions"}
            </button>
            {!standalone && (
              <button
                className="btn-secondary"
                onClick={() => setShowMap(false)}
              >
                Close Map
              </button>
            )}
          </div>
        )}
      </div>

      {isMobileViewport && (
        <div className="mobile-map-toolbar">
          <button
            type="button"
            className="btn-secondary mobile-map-toolbar-btn"
            onClick={() => setShowMobileControls(prev => !prev)}
          >
            {showMobileControls ? "Hide Map Controls" : "Show Map Controls"}
          </button>
        </div>
      )}

      {shouldRenderExpandedControls && (
        <div className="mobile-map-controls-shell">
          {isMobileViewport && (
            <div className="map-header-actions mobile-map-header-actions">
              {!standalone && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.open(standaloneMapUrl, "_blank", "noopener,noreferrer")}
                >
                  Open in New Tab
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowBuildingList(prev => !prev)}
              >
                {showBuildingList ? "Hide Directions" : "Show Directions"}
              </button>
              {!standalone && (
                <button
                  className="btn-secondary"
                  onClick={() => setShowMap(false)}
                >
                  Close Map
                </button>
              )}
            </div>
          )}

      {showBuildingList && shouldRenderExpandedControls && (
        <div className="route-controls">
          <label className="route-field">
            Start
            <select value={startId} onChange={handleStartChange}>
              {routeOptions.map(option => (
                <option key={option.destinationId} value={option.destinationId}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="btn-secondary route-swap" onClick={swapRoute}>
            Swap
          </button>

          <label className="route-field">
            Destination
            <select value={endId} onChange={handleEndChange}>
              {routeOptions.map(option => (
                <option key={option.destinationId} value={option.destinationId}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="route-actions">
        <button type="button" className="btn-primary" onClick={setMyLocationAsStart}>
          Use My Location
        </button>
        <button type="button" className="btn-secondary" onClick={showDirections}>
          Show Route
        </button>
        {dataError && <span className="route-note">{dataError}</span>}
        {locationStatus && <span className="route-note">{locationStatus}</span>}
      </div>
        </div>
      )}

      <div className="leaflet-wrapper">
        <MapContainer
          center={KEAN_MAIN_CAMPUS}
          zoom={MAP_DEFAULT_ZOOM}
          minZoom={17}
          maxZoom={MAP_FOCUS_ZOOM}
          zoomSnap={0.5}
          zoomDelta={0.5}
          className="leaflet-map"
        >
          <MapSizeInvalidator />
          <MapResizeObserver />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={MAP_TILE_NATIVE_MAX_ZOOM}
            maxZoom={MAP_FOCUS_ZOOM}
          />
          {allParkingLots.map(lot => (
            <Fragment key={lot.id}>
              <Polygon
                positions={lot.polygon}
                pathOptions={{
                  color: PARKING_TYPE_COLORS[lot.parkingType] || "#64748b",
                  fillColor: PARKING_TYPE_COLORS[lot.parkingType] || "#64748b",
                  fillOpacity: 0.24,
                  opacity: 0.82,
                  weight: 2
                }}
              >
                <Popup>
                  <strong>{lot.name}</strong>
                  <br />
                  {formatParkingTypeLabel(lot.parkingType)}
                  {lot.approximate ? " (approximate)" : ""}
                </Popup>
              </Polygon>
              <Marker position={parkingLabelAnchors.get(lot.id)} icon={parkingLabelAnchorIcon} interactive={false}>
                <Tooltip
                  permanent
                  direction={getParkingLabelOverrides(lot.name).direction}
                  offset={getParkingLabelOverrides(lot.name).offset}
                  className="parking-lot-label"
                  opacity={1}
                >
                  {lot.name}
                </Tooltip>
              </Marker>
            </Fragment>
          ))}
          {pointMarkers.map(location => {
            const profile = getLocationProfile(location);
            const imageSrc = getLocationImage(location);
            const imagePlaceholder = getLocationImagePlaceholder(location);
            return (
              <Marker key={location.id} position={location.position} icon={getLocationMarkerIcon(location)}>
                {location.type === "ev_charging_station" && (
                  <Tooltip permanent direction="top" offset={[0, -18]} className="special-point-label" opacity={1}>
                    EV Charging
                  </Tooltip>
                )}
                <Popup>
                  <div className="building-popup">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={location.name}
                        className="building-popup-image"
                        loading="lazy"
                      />
                    ) : imagePlaceholder ? (
                      <div className="building-popup-placeholder">
                        Image placeholder: <code>{imagePlaceholder}</code>
                      </div>
                    ) : null}
                    <h4 className="building-popup-title">{location.name}</h4>
                    <div className="building-popup-campus">
                      {location.campus || "Main"} Campus · {LOCATION_TYPE_LABELS[location.type] || "Location"}
                    </div>
                    <div className="building-popup-section">
                      <div className="building-popup-label">About</div>
                      <div className="building-popup-text">{profile?.usage}</div>
                    </div>
                    {profile?.departments?.length ? (
                      <div className="building-popup-section">
                        <div className="building-popup-label">Related</div>
                        <ul className="building-popup-list">
                          {profile.departments.map(department => (
                            <li key={department}>{department}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {profile?.notes ? (
                      <div className="building-popup-section">
                        <div className="building-popup-label">Relevant Info</div>
                        <div className="building-popup-text">{profile.notes}</div>
                      </div>
                    ) : null}
                    {imagePlaceholder && !imageSrc ? (
                      <div className="building-popup-section">
                        <div className="building-popup-label">Add Image Later</div>
                        <div className="building-popup-text">
                          Add a file with this name and it will be picked up automatically.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {entranceMarkers.map(entrance => (
            <CircleMarker
              key={entrance.id}
              center={entrance.position}
              radius={5}
              pathOptions={{ color: "#ffffff", fillColor: "#0b4ea2", fillOpacity: 1, opacity: 1, weight: 2 }}
            >
              <Popup>{entrance.name}</Popup>
            </CircleMarker>
          ))}
          <RouteViewport routeCoordinates={displayRouteCoordinates} />
          <HighlightViewport destination={highlightTarget?.position} enabled={locationMode === "highlight"} />
          {primaryRouteVariant && (
            <Fragment key={routeOverlayKey}>
              <Polyline
                key={`route-${primaryRouteVariant.routeIds.join("-")}`}
                positions={primaryRouteVariant.coordinates}
                pathOptions={{
                  color: ROUTE_LINE_COLORS[0],
                  weight: 8,
                  opacity: 0.96
                }}
              />
              <CircleMarker center={primaryRouteVariant.coordinates[0]} radius={8} pathOptions={{ color: "#16a34a", fillOpacity: 1 }}>
                <Popup>Route Start</Popup>
              </CircleMarker>
              <CircleMarker
                center={primaryRouteVariant.coordinates[primaryRouteVariant.coordinates.length - 1]}
                radius={8}
                pathOptions={{ color: "#dc2626", fillOpacity: 1 }}
              >
                <Popup>Route Destination</Popup>
              </CircleMarker>
            </Fragment>
          )}
          {locationMode === "highlight" && highlightTarget?.position && (
            <CircleMarker center={highlightTarget.position} radius={12} pathOptions={{ color: "#dc2626", fillOpacity: 0.25, weight: 3 }}>
              <Popup>{highlightTarget.name}</Popup>
            </CircleMarker>
          )}
          {userPosition && (
            <CircleMarker center={userPosition} radius={7} pathOptions={{ color: "#fdb813", fillOpacity: 0.9 }}>
              <Popup>Your current location</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      <div className="map-legend" aria-label="Parking map legend">
        <span className="map-legend-title">Parking Legend</span>
        <div className="map-legend-items">
          <span className="map-legend-item">
            <span className="map-legend-swatch student" aria-hidden="true"></span>
            Student
          </span>
          <span className="map-legend-item">
            <span className="map-legend-swatch faculty" aria-hidden="true"></span>
            Faculty/Staff
          </span>
          <span className="map-legend-item">
            <span className="map-legend-swatch visitor" aria-hidden="true"></span>
            Visitor
          </span>
          <span className="map-legend-item">
            <span className="map-legend-swatch overnight" aria-hidden="true"></span>
            Overnight
          </span>
        </div>
      </div>

      <div className="directory-panel">
        <div className="directory-head">
          <strong>{showDirectoryPanel ? "Kean Campus Directory" : "Directory Hidden"}</strong>
          <div className="directory-head-actions">
            <span>{filteredDirectoryPlaces.length} locations</span>
            <button
              type="button"
              className="btn-secondary directory-toggle-btn"
              onClick={() => setShowDirectoryPanel(prev => !prev)}
            >
              {showDirectoryPanel ? "Hide Directory" : "Show Directory"}
            </button>
          </div>
        </div>
        {showDirectoryPanel && (
          <>
            <div className="directory-controls">
              <select value={campusFilter} onChange={event => setCampusFilter(event.target.value)}>
                {campusOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={directoryQuery}
                onChange={event => setDirectoryQuery(event.target.value)}
                placeholder="Search building, service, or campus..."
              />
            </div>
            <div className="directory-list">
              {filteredDirectoryPlaces.map(place => (
                <div key={place.id} className="directory-item">
                  <div className="directory-item-main">
                    <div className="directory-item-name">{place.name}</div>
                    <div className="directory-item-meta">{place.campus} • {place.category}</div>
                    <div className="directory-item-desc">{place.description}</div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary directory-route-btn"
                    onClick={() => routeToPlace(place)}
                    disabled={!place.destinationId}
                  >
                    {place.destinationId ? "Route" : "Info Only"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MapPanel;
