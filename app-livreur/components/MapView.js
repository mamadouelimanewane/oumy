import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

// Remplace react-native-maps (Google Maps, cle API requise) par une carte
// Leaflet + tuiles CartoDB (gratuites, sans cle) rendue dans une WebView.
// react-native-webview ne supporte pas le web (throw a l'execution) : on
// rend un <iframe> DOM natif sur cette plateforme, avec le meme protocole
// postMessage que le HTML Leaflet ci-dessous ecoute deja.

const MARKER_STYLES = {
  courier: { color: '#f97316', glyph: '' },
  restaurant: { color: '#111827', glyph: '🏪' },
  client: { color: '#10b981', glyph: '📍' },
};

function buildHtml(initialRegion) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e5e7eb; }
    .courier-dot { width: 22px; height: 22px; border-radius: 50%; background: rgba(249,115,22,0.25); display: flex; align-items: center; justify-content: center; }
    .courier-dot::after { content: ''; width: 12px; height: 12px; border-radius: 50%; background: #f97316; border: 2px solid white; }
    .pin-marker { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView(
      [${initialRegion.latitude}, ${initialRegion.longitude}], 14
    );
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
    }).addTo(map);

    let markers = {};
    let polyline = null;

    function markerIcon(type) {
      const styles = ${JSON.stringify(MARKER_STYLES)};
      const s = styles[type] || styles.client;
      if (type === 'courier') {
        return L.divIcon({ className: '', html: '<div class="courier-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
      }
      return L.divIcon({
        className: '',
        html: '<div class="pin-marker" style="background:' + s.color + '">' + s.glyph + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });
    }

    function applyState(state) {
      const seen = new Set();
      (state.markers || []).forEach(function (m) {
        seen.add(m.id);
        if (markers[m.id]) {
          markers[m.id].setLatLng([m.latitude, m.longitude]);
        } else {
          markers[m.id] = L.marker([m.latitude, m.longitude], { icon: markerIcon(m.type) }).addTo(map);
        }
      });
      Object.keys(markers).forEach(function (id) {
        if (!seen.has(id)) { map.removeLayer(markers[id]); delete markers[id]; }
      });

      if (polyline) { map.removeLayer(polyline); polyline = null; }
      if (state.polyline && state.polyline.length > 1) {
        polyline = L.polyline(state.polyline.map(function (p) { return [p.latitude, p.longitude]; }), {
          color: '#f97316', weight: 6,
        }).addTo(map);
      }
    }

    document.addEventListener('message', function (e) { handleMessage(e.data); });
    window.addEventListener('message', function (e) { handleMessage(e.data); });

    function handleMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'state') applyState(msg);
        if (msg.type === 'fitBounds' && msg.coords && msg.coords.length) {
          const bounds = L.latLngBounds(msg.coords.map(function (c) { return [c.latitude, c.longitude]; }));
          map.fitBounds(bounds, { paddingTopLeft: [msg.padding?.left || 40, msg.padding?.top || 40], paddingBottomRight: [msg.padding?.right || 40, msg.padding?.bottom || 40] });
        }
      } catch (err) {}
    }
  </script>
</body>
</html>`;
}

const MapView = forwardRef(function MapView({ style, initialRegion, children }, ref) {
  const webviewRef = useRef(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildHtml(initialRegion), []); // eslint-disable-line react-hooks/exhaustive-deps

  const { markers, polylineCoords } = useMemo(() => {
    const markers = [];
    let polylineCoords = null;
    React.Children.forEach(children, (child, index) => {
      if (!child) return;
      if (child.type === Marker) {
        markers.push({
          id: String(index),
          type: child.props.type || 'client',
          latitude: child.props.coordinate.latitude,
          longitude: child.props.coordinate.longitude,
        });
      } else if (child.type === Polyline) {
        polylineCoords = child.props.coordinates;
      }
    });
    return { markers, polylineCoords };
  }, [children]);

  const post = (payload) => {
    const msg = JSON.stringify(payload);
    if (Platform.OS === 'web') {
      webviewRef.current?.contentWindow?.postMessage(msg, '*');
    } else {
      webviewRef.current?.postMessage(msg);
    }
  };

  React.useEffect(() => {
    if (!ready) return;
    post({ type: 'state', markers, polyline: polylineCoords });
  }, [ready, markers, polylineCoords]);

  useImperativeHandle(ref, () => ({
    fitToCoordinates(coords, options = {}) {
      post({ type: 'fitBounds', coords, padding: options.edgePadding });
    },
  }));

  return (
    <View style={style}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={webviewRef}
          srcDoc={html}
          onLoad={() => setReady(true)}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%', backgroundColor: 'transparent' }}
        />
      ) : (
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html }}
          onLoadEnd={() => setReady(true)}
          style={{ flex: 1, backgroundColor: 'transparent' }}
        />
      )}
    </View>
  );
});

function Marker() { return null; }
function Polyline() { return null; }

export { Marker, Polyline };
export default MapView;
