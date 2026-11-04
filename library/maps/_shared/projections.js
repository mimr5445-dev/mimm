// library/maps/_shared/projections.js — helpers for map projections
// For now, 'custom' projection = direct logical units (no transform).
// Future: add equirectangular/mercator conversion here without touching map files.

export function project(lng, lat, bounds, size) {
  // Simple linear mapping for custom projection
  // bounds: [minX, minY, maxX, maxY] in source units
  // size: {w, h} target canvas size
  const [minX, minY, maxX, maxY] = bounds;
  const x = ((lng - minX) / (maxX - minX)) * size.w;
  const y = ((lat - minY) / (maxY - minY)) * size.h;
  return [x, y];
}

export function unproject(x, y, bounds, size) {
  const [minX, minY, maxX, maxY] = bounds;
  const lng = minX + (x / size.w) * (maxX - minX);
  const lat = minY + (y / size.h) * (maxY - minY);
  return [lng, lat];
}
