// Google Maps JavaScript API helpers (used when the server provides a Maps key).
import { S } from './state.js';
import { sheet, esc, $ } from './ui.js';

let loading = null;
export const hasGoogle = () => !!S.config?.mapsKey;
export function loadGoogle() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!loading) {
    loading = new Promise((res, rej) => {
      window.__ecoMapsReady = () => res(window.google.maps);
      window.gm_authFailure = () => rej(new Error('Google Maps rejected the key. Check the key\'s website restrictions.'));
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(S.config.mapsKey)}&v=weekly&callback=__ecoMapsReady&loading=async`;
      s.async = true; s.onerror = () => { loading = null; rej(new Error('Google Maps could not load.')); };
      document.head.append(s);
    });
  }
  return loading;
}

// Quiet monochrome map styles that match the EcoSync look.
export function mapStyles() {
  const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
  return dark ? [
    { elementType: 'geometry', stylers: [{ color: '#121212' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a86' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#262626' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#333333' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1714' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#14201b' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  ] : [
    { elementType: 'geometry', stylers: [{ color: '#f2f1ec' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b66' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dce6e2' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#e2ebe4' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ];
}
export const pinIcon = (color) => ({
  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38"><path d="M15 37s13-11.6 13-22A13 13 0 0 0 2 15c0 10.4 13 22 13 22z" fill="${color}" stroke="#0a0a0a" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#0a0a0a"/></svg>`),
  scaledSize: new window.google.maps.Size(30, 38), anchor: new window.google.maps.Point(15, 37),
});
export const dotIcon = (color, r = 7) => ({ path: 0, scale: r, fillColor: color, fillOpacity: 1, strokeColor: '#0a0a0a', strokeWeight: 2 });

// "Look around": Street View inside the app at the nearest panorama to a point.
export async function lookAround(lat, lng, title = 'Look around') {
  const fallback = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  if (!hasGoogle()) { window.open(fallback, '_blank', 'noopener'); return; }
  sheet({
    title: 'Look around.', sub: esc(title), wide: true,
    body: `<div id="sv" style="height:min(62vh,520px);border-radius:12px;overflow:hidden;background:#111;display:grid;place-items:center;color:var(--muted)"><span class="row"><span class="spinner"></span>Finding street imagery…</span></div>
      <div class="row" style="justify-content:space-between"><span class="faint" style="font-size:11.5px">Imagery © Google</span><a class="link" href="${fallback}" target="_blank" rel="noopener" style="font-size:12.5px">Open in Google Maps ↗</a></div>`,
    async onMount(el) {
      try {
        const g = await loadGoogle();
        const svc = new g.StreetViewService();
        const { data } = await svc.getPanorama({ location: { lat, lng }, radius: 120, preference: g.StreetViewPreference.NEAREST, source: g.StreetViewSource.OUTDOOR });
        const box = $('#sv', el); box.innerHTML = '';
        new g.StreetViewPanorama(box, { pano: data.location.pano, pov: { heading: g.geometry ? 0 : 0, pitch: 0 }, addressControl: false, fullscreenControl: true, motionTracking: false, zoomControl: true });
      } catch (e) {
        $('#sv', el).innerHTML = `<div class="empty" style="border:0"><span class="serif">No street imagery here yet.</span><span>Google hasn't photographed this exact spot. Try a nearby road.</span></div>`;
      }
    },
  });
}
