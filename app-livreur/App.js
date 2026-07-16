import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated, Easing, Alert, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import polyline from '@mapbox/polyline';

import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from './components/MapView';

const { width, height } = Dimensions.get('window');

// CONFIGURATION
const DEFAULT_API_URL = 'http://localhost:5000';
const PROD_API_URL = 'https://oumy-orpin.vercel.app/api'; // Modifier si different
const API_URL = (typeof window !== 'undefined' && window.location.hostname !== 'localhost') 
  ? (window.location.origin.includes('vercel.app') ? window.location.origin + '/api' : PROD_API_URL)
  : DEFAULT_API_URL;
const LOCATIONIQ_KEY = Constants.expoConfig.extra.LOCATIONIQ_API_KEY;

export default function App() {
  const [isOnline, setIsOnline] = useState(false);
  const [deliveryState, setDeliveryState] = useState('idle'); // 'idle', 'incoming', 'accepted', 'pickup', 'delivering', 'completed'
  const [location, setLocation] = useState(null);
  const [route, setRoute] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState({ tips: [], total: 0 });
  const [showTips, setShowTips] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(15400);

  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 1. INITIALISATION LOCATION & SOCKET
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission refusée", "L'accès à la localisation est requis.");
        return;
      }

      let currentLoc = await Location.getCurrentPositionAsync({});
      setLocation(currentLoc.coords);
      setLoading(false);

      // Monitoring permanent de la position
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLoc) => {
          setLocation(newLoc.coords);
          if (isOnline && socketRef.current) {
            socketRef.current.emit('courier_location', {
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
              orderId: order?.id
            });
          }
        }
      );
    })();

    // Simulation d'un Token (Normalement via Login)
    const token = "MOCK_TOKEN_LIVREUR"; 
    socketRef.current = io(API_URL, {
      auth: { token },
      transports: ['websocket']
    });

    socketRef.current.on('new_order_available', (newOrder) => {
      if (isOnline && deliveryState === 'idle') {
        setOrder(newOrder);
        setDeliveryState('incoming');
        showBottomSheet();
      }
    });

    return () => socketRef.current?.disconnect();
  }, [isOnline, order, deliveryState]);

  // 2. LOGIQUE ITINÉRAIRE (LocationIQ)
  const fetchRoute = async (destLat, destLon) => {
    if (!location) return;
    try {
      const url = `https://eu1.locationiq.com/v1/directions/driving/${location.longitude},${location.latitude};${destLon},${destLat}?key=${LOCATIONIQ_KEY}&overview=full&geometries=polyline`;
      const res = await axios.get(url);
      if (res.data.routes && res.data.routes[0]) {
        const points = polyline.decode(res.data.routes[0].geometry);
        const coords = points.map(p => ({ latitude: p[0], longitude: p[1] }));
        setRoute(coords);
        
        // Ajuster la vue de la carte
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
          animated: true,
        });
      }
    } catch (err) {
      console.error("Erreur Route:", err);
    }
  };

  const showBottomSheet = () => {
    Animated.spring(slideAnim, { toValue: height - 450, friction: 6, useNativeDriver: true }).start();
  };

  const handleToggleStatus = () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    if (nextStatus) {
      socketRef.current.emit('courier_available');
    } else {
      socketRef.current.emit('courier_offline');
      setDeliveryState('idle');
      setOrder(null);
      setRoute([]);
    }
  };

  const acceptOrder = () => {
    setDeliveryState('accepted');
    // Simuler destination Restaurant
    fetchRoute(14.6937, -17.4441); 
    Animated.spring(slideAnim, { toValue: height - 150, friction: 8, useNativeDriver: true }).start();
  };

  const updateStatus = (nextState) => {
    setDeliveryState(nextState);
    if (nextState === 'delivering') {
      // Simuler destination Client
      fetchRoute(14.7487, -17.5132); 
    }
    if (nextState === 'completed') {
      setRoute([]);
      setTodayEarnings(prev => prev + 2500);
      setTimeout(() => { setOrder(null); setDeliveryState('idle'); }, 3000);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#f97316" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || 14.6937,
          longitude: location?.longitude || -17.4441,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        customMapStyle={mapStyle}
      >
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.courierMarker}>
              <View style={styles.courierCore} />
            </View>
          </Marker>
        )}

        {route.length > 0 && (
          <Polyline coordinates={route} strokeWidth={6} strokeColor="#f97316" />
        )}

        {deliveryState === 'accepted' || deliveryState === 'pickup' ? (
           <Marker coordinate={{ latitude: 14.6937, longitude: -17.4441 }} title="Restaurant">
              <View style={styles.destMarker}><Ionicons name="storefront" size={20} color="white" /></View>
           </Marker>
        ) : deliveryState === 'delivering' ? (
           <Marker coordinate={{ latitude: 14.7487, longitude: -17.5132 }} title="Client">
              <View style={[styles.destMarker, { backgroundColor: '#10b981' }]}><Ionicons name="location" size={20} color="white" /></View>
           </Marker>
        ) : null}
      </MapView>

      {/* HEADER CONTROLS */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowTips(!showTips)}><Ionicons name="cash-outline" size={20} color={showTips ? '#f97316' : '#1f2937'} /></TouchableOpacity>
        <View style={styles.earningsCard}>
          <Text style={styles.earnLabel}>Solde du jour</Text>
          <Text style={styles.earnValue}>{todayEarnings.toLocaleString()} F</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}><Ionicons name="notifications" size={20} color="#1f2937" /></TouchableOpacity>
      </View>

      {/* OFFLINE OVERLAY */}
      {!isOnline && deliveryState === 'idle' && (
        <View style={styles.overlay}>
           <TouchableOpacity style={styles.goBtn} onPress={handleToggleStatus}>
             <Text style={styles.goText}>START</Text>
           </TouchableOpacity>
           <Text style={styles.statusMsg}>Hors ligne • Appuyez pour commencer</Text>
        </View>
      )}

      {isOnline && deliveryState === 'idle' && (
        <View style={styles.onlineStatus}>
           <TouchableOpacity style={styles.stopBtn} onPress={handleToggleStatus}>
             <Text style={styles.stopText}>STOP</Text>
           </TouchableOpacity>
           <View style={styles.searchBox}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.searchText}>Recherche de missions...</Text>
           </View>
        </View>
      )}

      {/* INCOMING ORDER SHEET */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHeader}>
           <Text style={styles.sheetTitle}>Nouvelle Livraison ! 📦</Text>
           {order?.is_express && <View style={styles.expressBadge}><Ionicons name="flash" size={12} color="#fff" /><Text style={styles.expressText}>EXPRESS</Text></View>}
           <View style={styles.timerBadge}><Text style={styles.timerText}>45s</Text></View>
        </View>
        <View style={styles.missionCard}>
           <Text style={styles.missionPrice}>+2 500 FCFA</Text>
           <View style={styles.locRow}>
              <View style={styles.dotResto} />
              <Text style={styles.locText}>Dark Kitchen Plateau (2.5km)</Text>
           </View>
           <View style={styles.line} />
           <View style={styles.locRow}>
              <View style={styles.dotClient} />
              <Text style={styles.locText}>Almadies Residence (8km)</Text>
           </View>
        </View>
        <View style={styles.btnRow}>
           <TouchableOpacity style={styles.decline} onPress={() => setDeliveryState('idle')}>
              <Text style={styles.declineText}>Ignorer</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.accept} onPress={acceptOrder}>
              <Text style={styles.acceptText}>ACCEPTER</Text>
           </TouchableOpacity>
        </View>
      </Animated.View>

      {/* TIPS PANEL */}
      {showTips && (
        <View style={styles.tipsPanel}>
          <Text style={styles.tipsPanelTitle}>Pourboires reçus</Text>
          <View style={styles.tipsTotalCard}>
            <Text style={styles.tipsTotalLabel}>Total pourboires</Text>
            <Text style={styles.tipsTotalValue}>{tips.total.toLocaleString()} F</Text>
          </View>
          {tips.tips.length === 0 && <Text style={styles.tipsEmpty}>Aucun pourboire pour le moment</Text>}
          {tips.tips.slice(0, 5).map((t, i) => (
            <View key={i} style={styles.tipRow}>
              <View>
                <Text style={styles.tipClient}>{t.client_name || 'Client'}</Text>
                <Text style={styles.tipDate}>{new Date(t.created_at).toLocaleDateString('fr-FR')}</Text>
              </View>
              <Text style={styles.tipAmount}>+{parseFloat(t.amount).toLocaleString()} F</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.tipsCloseBtn} onPress={() => setShowTips(false)}>
            <Text style={styles.tipsCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* COMPLETED OVERLAY */}
      {deliveryState === 'completed' && (
        <View style={styles.completedOverlay}>
          <View style={styles.completedCard}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Livraison terminée !</Text>
            <Text style={styles.completedAmount}>+2 500 F</Text>
            {order?.tip_amount > 0 && <Text style={styles.completedTip}>Pourboire: +{order.tip_amount} F</Text>}
          </View>
        </View>
      )}

      {/* ACTIVE BAR */}
      {deliveryState !== 'idle' && deliveryState !== 'incoming' && (
        <View style={styles.activeBar}>
           <View style={{ flex: 1 }}>
              <Text style={styles.activeType}>
                {deliveryState === 'accepted' ? 'Vers de resto' : deliveryState === 'delivering' ? 'Vers le client' : 'Arrivé !'}
              </Text>
              <Text style={styles.activeDest}>Dark Kitchen Ousmane</Text>
           </View>
           <TouchableOpacity style={styles.updateBtn} onPress={() => {
              if (deliveryState === 'accepted') updateStatus('pickup');
              else if (deliveryState === 'pickup') updateStatus('delivering');
              else if (deliveryState === 'delivering') updateStatus('completed');
           }}>
              <Text style={styles.updateText}>
                {deliveryState === 'accepted' ? 'ARRIVÉ' : deliveryState === 'pickup' ? 'RÉCUPÉRÉ' : 'LIVRÉ'}
              </Text>
           </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const mapStyle = [
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  header: {
    position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  iconBtn: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  earningsCard: { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  earnLabel: { fontSize: 10, color: '#9ca3af', fontWeight: 'bold' },
  earnValue: { fontSize: 16, fontWeight: '900', color: '#111827' },
  
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' },
  goBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  goText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  statusMsg: { marginTop: 20, color: '#374151', fontWeight: 'bold' },

  onlineStatus: { position: 'absolute', bottom: 40, alignSelf: 'center', alignItems: 'center' },
  stopBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  stopText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  searchBox: { marginTop: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, elevation: 5 },
  searchText: { marginLeft: 10, fontWeight: 'bold', color: '#10b981', fontSize: 12 },

  sheet: { position: 'absolute', left: 0, right: 0, height: 450, backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, elevation: 25 },
  sheetTitle: { fontSize: 22, fontBlack: '900', color: '#111827' },
  timerBadge: { position: 'absolute', right: 30, top: 30, backgroundColor: '#fee2e2', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 10 },
  timerText: { color: '#ef4444', fontWeight: 'bold' },
  missionCard: { backgroundColor: '#f9fafb', borderRadius: 25, padding: 25, marginVertical: 25 },
  missionPrice: { fontSize: 32, fontWeight: '900', color: '#10b981', textAlign: 'center', marginBottom: 20 },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  dotResto: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827', marginRight: 15 },
  dotClient: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f97316', marginRight: 15 },
  locText: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
  line: { width: 2, height: 30, backgroundColor: '#e5e7eb', marginLeft: 4, marginVertical: 5 },

  btnRow: { flexDirection: 'row', gap: 15 },
  decline: { flex: 1, paddingVertical: 18, alignItems: 'center' },
  declineText: { fontWeight: 'bold', color: '#6b7280' },
  accept: { flex: 2, backgroundColor: '#10b981', borderRadius: 20, paddingVertical: 18, alignItems: 'center', elevation: 5 },
  acceptText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  activeBar: { position: 'absolute', bottom: 30, left: 15, right: 15, backgroundColor: '#111827', borderRadius: 25, padding: 20, flexDirection: 'row', alignItems: 'center', elevation: 15 },
  activeType: { color: '#9ca3af', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  activeDest: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  updateBtn: { backgroundColor: '#f97316', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15 },
  updateText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  courierMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249, 115, 22, 0.2)', justifyContent: 'center', alignItems: 'center' },
  courierCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#f97316', borderWeight: 3, borderColor: '#fff' },
  destMarker: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', elevation: 5 },

  expressBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 10 },
  expressText: { color: '#fff', fontWeight: '900', fontSize: 10, marginLeft: 3 },

  tipsPanel: { position: 'absolute', top: 110, left: 15, right: 15, backgroundColor: '#fff', borderRadius: 25, padding: 25, elevation: 20, zIndex: 100 },
  tipsPanelTitle: { fontSize: 18, fontWeight: '900', color: '#111827', marginBottom: 15 },
  tipsTotalCard: { backgroundColor: '#f0fdf4', borderRadius: 15, padding: 15, alignItems: 'center', marginBottom: 15 },
  tipsTotalLabel: { fontSize: 10, color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' },
  tipsTotalValue: { fontSize: 28, fontWeight: '900', color: '#10b981', marginTop: 5 },
  tipsEmpty: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginVertical: 10 },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tipClient: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
  tipDate: { fontSize: 10, color: '#9ca3af' },
  tipAmount: { fontSize: 16, fontWeight: '900', color: '#10b981' },
  tipsCloseBtn: { marginTop: 15, paddingVertical: 12, alignItems: 'center' },
  tipsCloseText: { color: '#6b7280', fontWeight: 'bold', fontSize: 14 },

  completedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 90 },
  completedCard: { backgroundColor: '#fff', borderRadius: 30, padding: 40, alignItems: 'center', width: width * 0.8, elevation: 25 },
  completedEmoji: { fontSize: 50, marginBottom: 10 },
  completedTitle: { fontSize: 22, fontWeight: '900', color: '#111827' },
  completedAmount: { fontSize: 36, fontWeight: '900', color: '#10b981', marginTop: 10 },
  completedTip: { fontSize: 14, color: '#f97316', fontWeight: 'bold', marginTop: 5 },
});
