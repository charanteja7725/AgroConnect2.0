const isValidGeoPointArray = (coords) => {
  return Array.isArray(coords) && coords.length === 2 && coords.every((value) => typeof value === "number" && Number.isFinite(value));
};

const extractCoordinates = (value) => {
  if (isValidGeoPointArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    if (isValidGeoPointArray(value.coordinates)) {
      return value.coordinates;
    }

    if (typeof value.longitude === "number" && typeof value.latitude === "number") {
      return [value.longitude, value.latitude];
    }
  }

  return null;
};

const buildGeoPoint = (value, fallback = null) => {
  const coordinates = extractCoordinates(value);
  if (coordinates) {
    return {
      type: "Point",
      coordinates,
    };
  }

  if (fallback && isValidGeoPointArray(fallback)) {
    return {
      type: "Point",
      coordinates: fallback,
    };
  }

  return null;
};

module.exports = {
  isValidGeoPointArray,
  extractCoordinates,
  buildGeoPoint,
};
