const ALLOWED_VIEWS = new Set(['anterior', 'posterior']);
const ALLOWED_LATERALITY = new Set(['left', 'right', 'midline', 'bilateral']);

export const BODY_MAP_CATALOG = Object.freeze([
  { id: 'head', label: 'Cabeça', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.08], posterior: [0.5, 0.08] } },
  { id: 'cervical', label: 'Cervical', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.17], posterior: [0.5, 0.18] } },
  { id: 'shoulder', label: 'Ombro', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.24], posterior: [0.5, 0.24] } },
  { id: 'thoracic', label: 'Torácica', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.34], posterior: [0.5, 0.34] } },
  { id: 'lumbar', label: 'Lombar', views: ['posterior'], centers: { posterior: [0.5, 0.48] } },
  { id: 'upper_arm', label: 'Braço', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.35], posterior: [0.5, 0.35] } },
  { id: 'elbow', label: 'Cotovelo', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.43], posterior: [0.5, 0.43] } },
  { id: 'forearm', label: 'Antebraço', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.51], posterior: [0.5, 0.51] } },
  { id: 'hand', label: 'Mão', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.59], posterior: [0.5, 0.59] } },
  { id: 'hip', label: 'Quadril', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.58], posterior: [0.5, 0.58] } },
  { id: 'thigh', label: 'Coxa', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.69], posterior: [0.5, 0.69] } },
  { id: 'knee', label: 'Joelho', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.79], posterior: [0.5, 0.79] } },
  { id: 'lower_leg', label: 'Perna', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.88], posterior: [0.5, 0.88] } },
  { id: 'ankle_foot', label: 'Tornozelo e pé', views: ['anterior', 'posterior'], centers: { anterior: [0.5, 0.97], posterior: [0.5, 0.97] } }
].map((item) => Object.freeze({ ...item, views: Object.freeze([...item.views]), centers: Object.freeze({ ...item.centers }) })));

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function normalizeBodyMapPoint(input = {}) {
  const regionId = String(input.regionId ?? '').trim();
  const region = BODY_MAP_CATALOG.find((item) => item.id === regionId);
  if (!region) throw new Error('Body-map region is invalid');

  const view = String(input.view ?? '').trim().toLowerCase();
  if (!ALLOWED_VIEWS.has(view) || !region.views.includes(view)) throw new Error('Body-map view is invalid for this region');

  const laterality = String(input.laterality ?? '').trim().toLowerCase();
  if (!ALLOWED_LATERALITY.has(laterality)) throw new Error('Body-map laterality is invalid');

  const x = Number(input.x);
  const y = Number(input.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    throw new Error('Body-map coordinates must be normalized between 0 and 1');
  }

  return Object.freeze({
    regionId: region.id,
    regionLabel: region.label,
    view,
    laterality,
    x,
    y,
    anatomicalLabel: cleanNullable(input.anatomicalLabel) || region.label
  });
}
