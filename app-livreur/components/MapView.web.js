import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const GOOGLE_MAPS_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

const MapView = ({ children, style, initialRegion }) => {
  const mapRef = useRef(null);
  const [googleStatus, setGoogleStatus] = useState('loading'); // loading, ready, error

  useEffect(() => {
    const scriptId = 'google-maps-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry`;
      script.async = true;
      script.onload = () => setGoogleStatus('ready');
      script.onerror = () => setGoogleStatus('error');
      document.body.appendChild(script);
    } else {
      setGoogleStatus('ready');
    }
  }, []);

  useEffect(() => {
    if (googleStatus === 'ready' && mapRef.current && !mapRef.current.mapInstances) {
      mapRef.current.mapInstances = new window.google.maps.Map(mapRef.current, {
        center: { lat: initialRegion?.latitude || 14.7167, lng: initialRegion?.longitude || -17.4677 },
        zoom: 13,
        styles: [
          { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
          { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
        ],
        disableDefaultUI: true,
      });
    }
  }, [googleStatus, initialRegion]);

  if (googleStatus === 'error') {
     return (
       <View style={[style, { backgroundColor: '#1e1b4b', justifyContent: 'center', alignItems: 'center' }]}>
         <Ionicons name="alert-circle" size={50} color="red" />
         <Text style={{ color: 'white', marginTop: 10 }}>Erreur Carte</Text>
       </View>
     );
  }

  return (
    <View ref={mapRef} style={style}>
      {googleStatus === 'loading' && <Text style={{ color: 'white', alignSelf: 'center' }}>Chargement...</Text>}
      {children}
    </View>
  );
};

const Marker = ({ children, coordinate }) => {
  // En mode Web pur, l'affichage des marqueurs via le DOM au-dessus du Canvas est complexe.
  // Pour cette version, on laisse les composants React-Native-Web s'afficher par-dessus la carte.
  return (
    <View style={{ position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -20}, {translateY: -20}] }}>
      {children}
    </View>
  );
};

const Polyline = () => null;
const PROVIDER_GOOGLE = 'google';

export { Marker, Polyline, PROVIDER_GOOGLE };
export default MapView;
