/**
 * Builds a self-contained HTML document that renders ONE Google map with every
 * passed location highlighted by a soft orange "area" blob (concentric
 * google.maps.Circle rings, matching the Airbnb-style preview used elsewhere).
 *
 * The same HTML is used on web (<iframe srcDoc>) and native (<WebView html>),
 * so the map behaves identically on both. Requires the **Maps JavaScript API**
 * to be enabled for the API key (separate from the Maps Embed API).
 */

export type MapPoint = { lat: number; lng: number; label?: string };

// Dark map theme — real styled-map JSON, so the orange circles stay orange
// (the old approach inverted the whole document via CSS, which would flip the
// highlight colour to blue once we draw real overlays).
const DARK_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#F8F8FC' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#F8F8FC' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#7A7C90' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F8F8FC' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#D8D8E4' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F8F8FC' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#EEEEF2' }] },
];

// Concentric rings → soft radial-blob look (radius in metres, fill opacity).
const RINGS = [
    { r: 900, o: 0.06 },
    { r: 650, o: 0.12 },
    { r: 420, o: 0.20 },
    { r: 220, o: 0.34 },
];

export function buildLocationsMapHtml(points: MapPoint[], apiKey: string): string {
    const valid = points.filter((p) => p && p.lat !== 0 && p.lng !== 0);
    const pointsJson = JSON.stringify(valid);
    const styleJson = JSON.stringify(DARK_STYLE);
    const ringsJson = JSON.stringify(RINGS);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>html,body,#map{height:100%;margin:0;padding:0;background:#F8F8FC;}</style>
</head>
<body>
<div id="map"></div>
<script>
  var POINTS = ${pointsJson};
  var STYLE = ${styleJson};
  var RINGS = ${ringsJson};

  // Crisp white text label pinned over a location (custom overlay so we can
  // use a readable text-shadow, which marker labels don't support).
  function addLabel(map, position, text) {
    var overlay = new google.maps.OverlayView();
    overlay.onAdd = function () {
      var div = document.createElement('div');
      div.textContent = text;
      div.style.position = 'absolute';
      div.style.transform = 'translate(-50%, -50%)';
      div.style.color = 'rgba(255,255,255,1)';
      div.style.opacity = '1';
      div.style.fontFamily = '-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif';
      div.style.fontSize = '13px';
      div.style.fontWeight = '700';
      div.style.letterSpacing = '0.2px';
      div.style.whiteSpace = 'nowrap';
      div.style.pointerEvents = 'none';
      // Solid 1px outline (opaque) so the white text always reads at full
      // strength over the orange blobs, plus a soft drop for depth.
      div.style.textShadow = [
        '-1px -1px 0 rgba(0,0,0,1)', '1px -1px 0 rgba(0,0,0,1)',
        '-1px 1px 0 rgba(0,0,0,1)', '1px 1px 0 rgba(0,0,0,1)',
        '0 2px 4px rgba(0,0,0,0.9)'
      ].join(', ');
      this._div = div;
      this.getPanes().overlayLayer.appendChild(div);
    };
    overlay.draw = function () {
      var p = this.getProjection().fromLatLngToDivPixel(
        new google.maps.LatLng(position.lat, position.lng)
      );
      if (p && this._div) { this._div.style.left = p.x + 'px'; this._div.style.top = p.y + 'px'; }
    };
    overlay.onRemove = function () {
      if (this._div && this._div.parentNode) { this._div.parentNode.removeChild(this._div); }
      this._div = null;
    };
    overlay.setMap(map);
  }

  function initMap() {
    var map = new google.maps.Map(document.getElementById('map'), {
      styles: STYLE,
      disableDefaultUI: true,
      zoomControl: true,        // +/- buttons
      fullscreenControl: true,  // expand to fill the section / screen
      gestureHandling: 'greedy',// one-finger pan + pinch-zoom inside the map
      backgroundColor: '#F8F8FC',
      clickableIcons: false,
      zoom: 11,
      center: { lat: 0, lng: 0 }
    });
    if (!POINTS.length) { map.setZoom(2); return; }
    var bounds = new google.maps.LatLngBounds();
    POINTS.forEach(function (p) {
      var center = { lat: p.lat, lng: p.lng };
      bounds.extend(center);
      RINGS.forEach(function (ring) {
        new google.maps.Circle({
          map: map, center: center, radius: ring.r,
          fillColor: '#F25912', fillOpacity: ring.o,
          strokeOpacity: 0, clickable: false,
          zIndex: Math.round(ring.o * 100)
        });
      });
      if (p.label) { addLabel(map, center, p.label); }
    });
    if (POINTS.length === 1) {
      map.setCenter({ lat: POINTS[0].lat, lng: POINTS[0].lng });
      map.setZoom(12);
    } else {
      map.fitBounds(bounds, 48);
      google.maps.event.addListenerOnce(map, 'idle', function () {
        if (map.getZoom() > 14) map.setZoom(14);
      });
    }
  }
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap"></script>
</body>
</html>`;
}
