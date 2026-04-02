import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
<<<<<<< Updated upstream
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
=======
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
>>>>>>> Stashed changes
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

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

const BUILDINGS = [
  { id: "kean_hall", name: "Kean Hall", position: [40.6798, -74.2341] },
  { id: "glassman_hall", name: "Green Lane Academic Building (GLAB)", position: [40.6802, -74.2353] },
  { id: "library", name: "Nancy Thompson Library", position: [40.6791, -74.2328] },
  { id: "stem", name: "STEM Building", position: [40.6804, -74.2332] },
  { id: "downs_hall", name: "Downs Hall", position: [40.6811, -74.2347] },
  { id: "harwood", name: "Harwood Arena", position: [40.6788, -74.2356] },
  { id: "uc", name: "University Center", position: [40.6789, -74.2338] }
];

const CAMPUS_DIRECTORY = [
  {
    id: "administration_building",
    name: "Administration Building",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Student services offices (Financial Aid, Registrar, and related services)."
  },
  {
    id: "bruce_hall",
    name: "Bruce Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Science labs and classrooms."
  },
  {
    id: "green_lane_academic_building",
    name: "Green Lane Academic Building (GLAB)",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Classrooms and campus bookstore.",
    destinationId: "glassman_hall"
  },
  {
    id: "nancy_thompson_library",
    name: "Nancy Thompson Library (LIB)",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Campus library for research and study.",
    destinationId: "library"
  },
  {
    id: "maxine_jack_lane_cas",
    name: "Maxine & Jack Lane Center for Academic Success (CAS)",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Academic support and tutoring spaces."
  },
  {
    id: "north_avenue_academic_building",
    name: "North Avenue Academic Building (NAAB)",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Classrooms and labs."
  },
  {
    id: "technology_building",
    name: "Technology Building (TECH)",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Instructional classrooms and offices."
  },
  {
    id: "hynes_hall",
    name: "Hynes Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Business, public administration, and criminal justice space."
  },
  {
    id: "townsend_hall",
    name: "Townsend Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Classrooms and faculty offices."
  },
  {
    id: "cas_center",
    name: "Center for Academic Success (CAS)",
    campus: "Main Campus (Union, NJ)",
    category: "Academic & Administrative",
    description: "Conference, study, and support spaces."
  },
  {
    id: "nathan_weiss_ecb",
    name: "Nathan Weiss East Campus Building (ECB)",
    campus: "East Campus (Hillside, NJ)",
    category: "East Campus",
    description: "Home to multiple colleges and a recital hall."
  },
  {
    id: "east_campus_gym",
    name: "East Campus Gym",
    campus: "East Campus (Hillside, NJ)",
    category: "East Campus",
    description: "Athletic and recreation facility."
  },
  {
    id: "jacqueline_towns_court",
    name: "Jacqueline Towns Court (JTC)",
    campus: "East Campus (Hillside, NJ)",
    category: "East Campus",
    description: "Basketball court and training facility."
  },
  {
    id: "enlow_recital_hall",
    name: "Enlow Recital Hall",
    campus: "East Campus (Hillside, NJ)",
    category: "East Campus",
    description: "Performance space."
  },
  {
    id: "presidents_house",
    name: "President's House",
    campus: "East Campus (Hillside, NJ)",
    category: "East Campus",
    description: "Administrative residence."
  },
  {
    id: "ruth_horowitz_alumni_house",
    name: "Ruth Horowitz Alumni House",
    campus: "East Campus (Hillside, NJ)",
    category: "East Campus",
    description: "Alumni engagement building."
  },
  {
    id: "liberty_hall_museum",
    name: "Liberty Hall Museum / Mansion (LHM)",
    campus: "Liberty Hall Campus (Union, NJ)",
    category: "Liberty Hall",
    description: "Historic mansion and museum."
  },
  {
    id: "blue_house",
    name: "Blue House",
    campus: "Liberty Hall Campus (Union, NJ)",
    category: "Liberty Hall",
    description: "Historic site on Liberty Hall campus."
  },
  {
    id: "fire_house",
    name: "Fire House",
    campus: "Liberty Hall Campus (Union, NJ)",
    category: "Liberty Hall",
    description: "Historic structure on Liberty Hall campus."
  },
  {
    id: "carriage_house",
    name: "Carriage House",
    campus: "Liberty Hall Campus (Union, NJ)",
    category: "Liberty Hall",
    description: "Historic carriage house."
  },
  {
    id: "ursino",
    name: "Ursino",
    campus: "Liberty Hall Campus (Union, NJ)",
    category: "Liberty Hall",
    description: "Historic Liberty Hall structure."
  },
  {
    id: "cougar_hall",
    name: "Cougar Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "Freshman residence."
  },
  {
    id: "dougall_hall",
    name: "Dougall Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "Residence hall."
  },
  {
    id: "whiteman_hall",
    name: "Whiteman Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "Residence hall."
  },
  {
    id: "bartlett_hall",
    name: "Bartlett Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "Apartment-style upperclass housing."
  },
  {
    id: "burch_hall",
    name: "Burch Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "Apartment-style upperclass housing."
  },
  {
    id: "rogers_hall",
    name: "Rogers Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "Apartment-style upperclass housing."
  },
  {
    id: "sozio_hall",
    name: "Sozio Hall",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "Apartment-style upperclass housing."
  },
  {
    id: "upperclassman_residence_hall",
    name: "Upperclassman Residence Hall (URH)",
    campus: "Main Campus (Union, NJ)",
    category: "Residence Halls",
    description: "General apartment-like residence."
  },
  {
    id: "miron_student_center",
    name: "Miron Student Center (MSC)",
    campus: "Main Campus (Union, NJ)",
    category: "Student Life & Services",
    description: "Main student union with game room, food court, and meeting rooms.",
    destinationId: "uc"
  },
  {
    id: "wilkins_theatre",
    name: "Wilkins Theatre for the Performing Arts (WT)",
    campus: "Main Campus (Union, NJ)",
    category: "Student Life & Services",
    description: "Large campus theater."
  },
  {
    id: "center_for_academic_success",
    name: "Center for Academic Success (CAS)",
    campus: "Main Campus (Union, NJ)",
    category: "Student Life & Services",
    description: "Student tutoring and support."
  },
  {
    id: "human_rights_institute",
    name: "Human Rights Institute (HRI)",
    campus: "Main Campus (Union, NJ)",
    category: "Student Life & Services",
    description: "Academic and advocacy facility near library.",
    destinationId: "library"
  },
  {
    id: "child_study_institute",
    name: "Child Study Institute / Campus School (CSI / CS)",
    campus: "Main Campus (Union, NJ)",
    category: "Student Life & Services",
    description: "Education lab school facilities."
  },
  {
    id: "public_safety_hq",
    name: "Department of Public Safety / Police HQ",
    campus: "Main Campus (Union, NJ)",
    category: "Student Life & Services",
    description: "Campus police and safety operations."
  },
  {
    id: "dangola_gymnasium",
    name: "D'Angola Gymnasium",
    campus: "Main Campus (Union, NJ)",
    category: "Athletics & Recreation",
    description: "Fitness and indoor sports."
  },
  {
    id: "harwood_arena",
    name: "Harwood Arena",
    campus: "Main Campus (Union, NJ)",
    category: "Athletics & Recreation",
    description: "Multi-sport arena.",
    destinationId: "harwood"
  },
  {
    id: "alumni_stadium",
    name: "Alumni Stadium / Football Field",
    campus: "Main Campus (Union, NJ)",
    category: "Athletics & Recreation",
    description: "Outdoor field with track."
  },
  {
    id: "outdoor_courts",
    name: "Basketball & Volleyball Courts",
    campus: "Main Campus (Union, NJ)",
    category: "Athletics & Recreation",
    description: "Outdoor recreation courts."
  },
  {
    id: "turf_field",
    name: "Turf Field / Multipurpose Field",
    campus: "Main Campus (Union, NJ)",
    category: "Athletics & Recreation",
    description: "Multipurpose turf field."
  },
  {
    id: "parking_lots",
    name: "Parking Decks & Surface Lots",
    campus: "Main Campus (Union, NJ)",
    category: "Support & Infrastructure",
    description: "Numbered lots and parking structures across campus."
  },
  {
    id: "safety_comms",
    name: "Campus Safety Communication Systems",
    campus: "Main Campus (Union, NJ)",
    category: "Support & Infrastructure",
    description: "Campus warning and communication infrastructure."
  },
  {
    id: "james_townley_house",
    name: "James Townley House",
    campus: "Main Campus (Union, NJ)",
    category: "Historic & Other",
    description: "Historic farmhouse on campus."
  },
  {
    id: "union_townley_station",
    name: "Union/Townley Train Station Access",
    campus: "Main Campus (Union, NJ)",
    category: "Historic & Other",
    description: "Regional transit access point near campus."
  }
];

<<<<<<< Updated upstream
const CAMPUS_PATHS = [
  ["kean_hall", "library"],
  ["kean_hall", "glassman_hall"],
  ["kean_hall", "uc"],
  ["kean_hall", "harwood"],
  ["glassman_hall", "downs_hall"],
  ["library", "stem"],
  ["library", "uc"],
  ["stem", "downs_hall"],
  ["uc", "harwood"],
  ["uc", "library"],
  ["downs_hall", "kean_hall"]
];
=======
const ROUTE_NODE_ALIASES = {
  "downs_hall_entrance_front": "downs_hall_main",
  "kean_hall_entrance_front": "kean_hall_main",
  "kean_hall_entrance_side": "kean_hall_main",
  "miron_center_main": "miron_main",
  "naab_entrance_front": "naab_main",
  "north_ave_academic_main": "naab_main",
  "vaughn_eames_front": "vaughn_eames_main",
  "wilkins_theatre_front": "wilkins_theatre_main"
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
  kean_east_soccer_field_1: ["kean east soccer field 1", "kean soccer field east campus 1"],
  kean_east_soccer_field_2: ["kean east soccer field 2", "kean soccer field east campus 2"],
  kean_shuttle_bus: ["kean shuttle bus", "shuttle bus", "campus shuttle"],
  emergency_phone: ["emergency phone"],
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
const buildingImageRecords = buildBuildingImageRecords(buildingImageModules);
const HIDDEN_BUILDING_MARKER_IDS = new Set(["george_hennings_research", "kean_east_soccer_field", "msc_game_room"]);
>>>>>>> Stashed changes

const campusMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

<<<<<<< Updated upstream
=======
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

const MARKER_LOCATION_TYPES = new Set(["building", "field", "lawn", "landmark", "shuttle_stop", "emergency_phone"]);

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
      if (!id || !position || existingIds.has(id)) return null;
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
  return (data?.features || [])
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

      return {
        edgeId,
        fromId,
        toId,
        mode: String(properties.mode || "").trim().toLowerCase(),
        pathCoordinates,
        notes: String(properties.notes || "").trim(),
        source: String(properties.source || "").trim().toLowerCase()
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
  return {
    usage: "Campus point of interest.",
    departments: ["Campus Directory"],
    notes: "Additional details for this location are being added."
  };
}

>>>>>>> Stashed changes
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

function isInsideCampus([lat, lon]) {
  return (
    lat <= CAMPUS_BOUNDS.north &&
    lat >= CAMPUS_BOUNDS.south &&
    lon <= CAMPUS_BOUNDS.east &&
    lon >= CAMPUS_BOUNDS.west
  );
}

function getBuildingById(id) {
  return BUILDINGS.find(building => building.id === id);
}

function getNearestBuilding(position) {
  let nearest = BUILDINGS[0];
  let minDistance = Number.POSITIVE_INFINITY;

  BUILDINGS.forEach(building => {
    const distance = haversineDistanceMeters(position, building.position);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = building;
    }
  });

  return nearest;
}

function buildGraph() {
  const graph = {};

  BUILDINGS.forEach(building => {
    graph[building.id] = [];
  });

  CAMPUS_PATHS.forEach(([fromId, toId]) => {
    const from = getBuildingById(fromId);
    const to = getBuildingById(toId);
    const weight = haversineDistanceMeters(from.position, to.position);
    graph[fromId].push({ id: toId, weight });
    graph[toId].push({ id: fromId, weight });
  });

  return graph;
}

function dijkstra(startId, endId, graph) {
  if (startId === endId) return [startId];

  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(graph));

  Object.keys(graph).forEach(id => {
    distances[id] = Number.POSITIVE_INFINITY;
    previous[id] = null;
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

    graph[current].forEach(({ id: neighborId, weight }) => {
      if (!unvisited.has(neighborId)) return;
      const candidate = distances[current] + weight;
      if (candidate < distances[neighborId]) {
        distances[neighborId] = candidate;
        previous[neighborId] = current;
      }
    });
  }

  const route = [];
  let cursor = endId;

  while (cursor) {
    route.unshift(cursor);
    cursor = previous[cursor];
  }

  if (route[0] !== startId) return [];
  return route;
}

function RouteViewport({ routeCoordinates }) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates.length < 2) return;
<<<<<<< Updated upstream
    const bounds = L.latLngBounds(routeCoordinates);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
=======
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
>>>>>>> Stashed changes
  }, [map, routeCoordinates]);

  return null;
}

<<<<<<< Updated upstream
function MapPanel({ setShowMap, routeRequest }) {
  const [startId, setStartId] = useState("kean_hall");
  const [endId, setEndId] = useState("library");
=======
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

function MapPanel({ setShowMap, routeRequest, standalone = false }) {
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
>>>>>>> Stashed changes
  const [userPosition, setUserPosition] = useState(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [campusFilter, setCampusFilter] = useState("All Campuses");
  const [directoryQuery, setDirectoryQuery] = useState("");

  const graph = useMemo(() => buildGraph(), []);

  const routeBuildingIds = useMemo(() => dijkstra(startId, endId, graph), [endId, graph, startId]);

  const routeCoordinates = useMemo(
    () =>
      routeBuildingIds
        .map(id => getBuildingById(id))
        .filter(Boolean)
        .map(building => building.position),
    [routeBuildingIds]
  );

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
  const routeDistanceMeters = useMemo(() => {
    if (routeCoordinates.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < routeCoordinates.length; i += 1) {
      total += haversineDistanceMeters(routeCoordinates[i - 1], routeCoordinates[i]);
    }
    return total;
  }, [routeCoordinates]);
  const campusOptions = useMemo(
    () => ["All Campuses", ...new Set(CAMPUS_DIRECTORY.map(place => place.campus))],
    []
  );
  const filteredDirectoryPlaces = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return CAMPUS_DIRECTORY.filter(place => {
      const matchesCampus = campusFilter === "All Campuses" || place.campus === campusFilter;
      if (!matchesCampus) return false;
      if (!query) return true;
      return (
        place.name.toLowerCase().includes(query) ||
        place.category.toLowerCase().includes(query) ||
        place.description.toLowerCase().includes(query)
      );
    });
  }, [campusFilter, directoryQuery]);

  function setMyLocationAsStart() {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setUserPosition(coords);

        if (!isInsideCampus(coords)) {
          setLocationStatus("You are outside Kean campus bounds. Select buildings manually.");
          return;
        }

        const nearest = getNearestBuilding(coords);
        setStartId(nearest.id);
        setLocationStatus(`Using your location. Nearest start point: ${nearest.name}.`);
      },
      () => {
        setLocationStatus("Could not read your location. Check browser location permission.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function swapRoute() {
    setStartId(endId);
    setEndId(startId);
  }
  function routeToPlace(place) {
    if (!place.destinationId) {
      setLocationStatus("Route data not set for this location yet. Select a mapped destination above.");
      return;
    }

    setEndId(place.destinationId);
    setShowMap(true);
    setMyLocationAsStart();
  }

  const startBuilding = getBuildingById(startId);
  const endBuilding = getBuildingById(endId);

  useEffect(() => {
    if (!routeRequest) return;

<<<<<<< Updated upstream
    if (routeRequest.destinationId && getBuildingById(routeRequest.destinationId)) {
      setEndId(routeRequest.destinationId);
=======
    const requestedDestination = routeRequest.destinationId ? getLocationById(routeRequest.destinationId, locationsById) : null;
    const mappedDestination = resolveRoutableId(routeRequest.destinationId);
    const mappedStart = resolveRoutableId(routeRequest.startId);
    if (mappedStart) {
      setStartId(mappedStart);
    }
    if (mappedDestination) {
      setEndId(mappedDestination);
>>>>>>> Stashed changes
    }

    if (routeRequest.useCurrentLocation) {
      setMyLocationAsStart();
<<<<<<< Updated upstream
=======
    } else if (mappedStart && mappedDestination) {
      setStartId(mappedStart);
      setLocationStatus("Loaded route in standalone map view.");
    } else if (mappedDestination) {
      const destination = requestedDestination || getLocationById(mappedDestination, locationsById);
      if (destination) {
        setStartId(mappedDestination);
        setLocationStatus(`Showing ${destination.name} on the map.`);
      }
>>>>>>> Stashed changes
    }
  }, [routeRequest]);

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

  return (
    <div className="panel map-panel">
      <div className="map-header">
        <h3 className="panel-title">Campus Map</h3>
<<<<<<< Updated upstream

        <button
          className="btn-secondary"
          onClick={() => setShowMap(false)}
        >
          Close Map
        </button>
=======
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
>>>>>>> Stashed changes
      </div>

      <div className="route-controls">
        <label className="route-field">
          Start
          <select value={startId} onChange={event => setStartId(event.target.value)}>
            {BUILDINGS.map(building => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="btn-secondary route-swap" onClick={swapRoute}>
          Swap
        </button>

        <label className="route-field">
          Destination
          <select value={endId} onChange={event => setEndId(event.target.value)}>
            {BUILDINGS.map(building => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="route-actions">
        <button type="button" className="btn-primary" onClick={setMyLocationAsStart}>
          Use My Location
        </button>
        {locationStatus && <span className="route-note">{locationStatus}</span>}
      </div>

      <div className="route-summary">
        <strong>{startBuilding?.name}</strong> to <strong>{endBuilding?.name}</strong>
        {" - "}
        {routeCoordinates.length > 1
          ? `${Math.round(routeDistanceMeters)} m estimated path`
          : "No route found in campus graph"}
      </div>
<<<<<<< Updated upstream
=======

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
            <Polygon
              key={lot.id}
              positions={lot.polygon}
              pathOptions={{
                color: PARKING_TYPE_COLORS[lot.parkingType] || "#64748b",
                fillColor: PARKING_TYPE_COLORS[lot.parkingType] || "#64748b",
                fillOpacity: 0.34,
                opacity: 0.95,
                weight: 3
              }}
            >
              <Tooltip permanent direction="center" className="parking-lot-label" opacity={1}>
                {lot.name}
              </Tooltip>
              <Popup>
                <strong>{lot.name}</strong>
                <br />
                {formatParkingTypeLabel(lot.parkingType)}
                {lot.approximate ? " (approximate)" : ""}
              </Popup>
            </Polygon>
          ))}
          {pointMarkers.map(location => {
            const profile = getLocationProfile(location);
            const imageSrc = getLocationImage(location);
            const imagePlaceholder = getLocationImagePlaceholder(location);
            return (
              <Marker key={location.id} position={location.position} icon={getLocationMarkerIcon(location)}>
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
          {displayRouteVariants.length > 0 && (
            <Fragment key={routeOverlayKey}>
              {displayRouteVariants.map((variant, index) => (
                <Polyline
                  key={`route-${variant.routeIds.join("-")}`}
                  positions={variant.coordinates}
                  pathOptions={{
                    color: ROUTE_LINE_COLORS[index] || ROUTE_LINE_COLORS[ROUTE_LINE_COLORS.length - 1],
                    weight: index === 0 ? 8 : 6,
                    opacity: index === 0 ? 0.96 : 0.82
                  }}
                />
              ))}
              <CircleMarker center={displayRouteVariants[0].coordinates[0]} radius={8} pathOptions={{ color: "#16a34a", fillOpacity: 1 }}>
                <Popup>Route Start</Popup>
              </CircleMarker>
              <CircleMarker
                center={displayRouteVariants[0].coordinates[displayRouteVariants[0].coordinates.length - 1]}
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
>>>>>>> Stashed changes

      <div className="directory-panel">
        <div className="directory-head">
          <strong>Kean Campus Directory</strong>
          <span>{filteredDirectoryPlaces.length} locations</span>
        </div>
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
      </div>
<<<<<<< Updated upstream

      <div className="leaflet-wrapper">
        <MapContainer center={KEAN_MAIN_CAMPUS} zoom={16} className="leaflet-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {BUILDINGS.map(building => (
            <Marker key={building.id} position={building.position} icon={campusMarkerIcon}>
              <Popup>{building.name}</Popup>
            </Marker>
          ))}
          <RouteViewport routeCoordinates={routeCoordinates} />
          {routeCoordinates.length > 1 && (
            <>
              <Polyline positions={routeCoordinates} pathOptions={{ color: "#fdb813", weight: 10, opacity: 0.55 }} />
              <Polyline positions={routeCoordinates} pathOptions={{ color: "#003667", weight: 6, opacity: 0.95 }} />
              <CircleMarker center={routeCoordinates[0]} radius={8} pathOptions={{ color: "#16a34a", fillOpacity: 1 }}>
                <Popup>Route Start</Popup>
              </CircleMarker>
              <CircleMarker
                center={routeCoordinates[routeCoordinates.length - 1]}
                radius={8}
                pathOptions={{ color: "#dc2626", fillOpacity: 1 }}
              >
                <Popup>Route Destination</Popup>
              </CircleMarker>
            </>
          )}
          {userPosition && (
            <CircleMarker center={userPosition} radius={7} pathOptions={{ color: "#fdb813", fillOpacity: 0.9 }}>
              <Popup>Your current location</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
=======
>>>>>>> Stashed changes
    </div>
  );
}

export default MapPanel;