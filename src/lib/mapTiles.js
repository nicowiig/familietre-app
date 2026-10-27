// Felles kartfliser for alle Leaflet-kart i appen.
// CARTO krever nå API-nøkkel («API KEY REQUIRED»), så vi bruker OpenStreetMaps egne fliser.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsytere'
export const TILE_MAX_ZOOM = 19
