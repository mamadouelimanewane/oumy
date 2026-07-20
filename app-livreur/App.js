import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Dimensions, Animated, Alert, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import polyline from '@mapbox/polyline';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MapView, { Marker, Polyline } from './components/MapView';
import { SOCKET_URL, TOKEN_KEY, USER_KEY, authAPI, livreurAPI, tipsAPI } from './api';

const { width, height } = Dimensions.get('window');

const LOCATIONIQ_KEY = Constants.expoConfig.extra.LOCATIONIQ_API_KEY;
const DAKAR_CENTER = { latitude: 14.6937, longitude: -17.4441 };

function haversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export default function App() {
  // AUTH
  const [authChecked, setAuthChecked] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // APP STATE
  const [isOnline, setIsOnline] = useState(false);
  const [deliveryState, setDeliveryState] = useState('idle'); // 'idle', 'incoming', 'accepted', 'pickup', 'delivering', 'completed'
  const [location, setLocation] = useState(null);
  const [route, setRoute] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState({ tips: [], total: 0 });
  const [showTips, setShowTips] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);

  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Refs miroir pour eviter de recreer le socket a chaque changement d'etat
  // (le handler 'new_order_available' doit toujours lire l'etat le plus recent).
  const isOnlineRef = useRef(isOnline);
  const deliveryStateRef = useRef(deliveryState);
  const orderRef = useRef(order);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { deliveryStateRef.current = deliveryState; }, [deliveryState]);
  useEffect(() => { orderRef.current = order; }, [order]);

  // 0. RESTAURATION DE SESSION
  useEffect(() => {
    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (token && userJson) {
          setAuthToken(token);
          setAuthUser(JSON.parse(userJson));
        }
      } catch (err) {
        console.error('Erreur session:', err);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // 1. GÉOLOCALISATION
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert("Permission refusée", "L'accès à la localisation est requis.");
          return;
        }

        let currentLoc = await Location.getCurrentPositionAsync({});
        setLocation(currentLoc.coords);

        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (newLoc) => {
            setLocation(newLoc.coords);
            if (isOnlineRef.current && socketRef.current) {
              socketRef.current.emit('courier_location', {
                latitude: newLoc.coords.latitude,
                longitude: newLoc.coords.longitude,
                orderId: orderRef.current?.id,
              });
            }
          }
        );
      } catch (err) {
        console.error("Erreur localisation:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2. SOCKET.IO — connexion reelle une fois authentifie (JWT, plus de mock)
  useEffect(() => {
    if (!authToken) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ['websocket'],
    });

    socketRef.current.on('new_order_available', (newOrder) => {
      if (isOnlineRef.current && deliveryStateRef.current === 'idle') {
        setOrder(newOrder);
        setDeliveryState('incoming');
        showBottomSheet();
      }
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [authToken]);

  // 3. DONNÉES INITIALES : gains du jour + livraison deja en cours (reprise apres fermeture app)
  useEffect(() => {
    if (!authToken) return;
    (async () => {
      try {
        const stats = await livreurAPI.getStats();
        setTodayEarnings(parseFloat(stats?.today?.total_amount) || 0);
      } catch (err) {
        console.error('Erreur stats:', err);
      }
      try {
        const current = await livreurAPI.getCurrentOrders();
        const active = current.find((o) => o.status === 'en_route');
        if (active) {
          setOrder(active);
          setDeliveryState('accepted');
          Animated.spring(slideAnim, { toValue: height - 150, friction: 8, useNativeDriver: true }).start();
        }
      } catch (err) {
        console.error('Erreur commandes en cours:', err);
      }
    })();
  }, [authToken]);

  // 4. ITINÉRAIRE (LocationIQ)
  const fetchRoute = async (destLat, destLon) => {
    if (!location || !destLat || !destLon) return;
    try {
      const url = `https://eu1.locationiq.com/v1/directions/driving/${location.longitude},${location.latitude};${destLon},${destLat}?key=${LOCATIONIQ_KEY}&overview=full&geometries=polyline`;
      const res = await axios.get(url);
      if (res.data.routes && res.data.routes[0]) {
        const points = polyline.decode(res.data.routes[0].geometry);
        const coords = points.map(p => ({ latitude: p[0], longitude: p[1] }));
        setRoute(coords);

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

  const hideBottomSheet = () => {
    Animated.spring(slideAnim, { toValue: height, friction: 6, useNativeDriver: true }).start();
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password) {
      setAuthError('Téléphone et mot de passe requis');
      return;
    }
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const data = await authAPI.login(phone.trim(), password);
      if (!data.token || !data.user) {
        setAuthError(data.error || 'Identifiants invalides');
        return;
      }
      if (data.user.role !== 'livreur') {
        setAuthError("Ce compte n'est pas un compte livreur.");
        return;
      }
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setAuthToken(data.token);
      setAuthUser(data.user);
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setIsOnline(false);
    setDeliveryState('idle');
    setOrder(null);
    setRoute([]);
    setTodayEarnings(0);
    hideBottomSheet();
  };

  const handleToggleStatus = () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    if (nextStatus) {
      socketRef.current?.emit('courier_available');
    } else {
      socketRef.current?.emit('courier_offline');
      setDeliveryState('idle');
      setOrder(null);
      setRoute([]);
      hideBottomSheet();
    }
  };

  const acceptOrder = async () => {
    if (!order) return;
    try {
      await livreurAPI.acceptOrder(order.id);
    } catch (err) {
      Alert.alert('Trop tard !', err.response?.data?.error || "Cette commande n'est plus disponible.");
      setDeliveryState('idle');
      setOrder(null);
      hideBottomSheet();
      return;
    }
    setDeliveryState('accepted');
    fetchRoute(order.restaurant_lat, order.restaurant_lng);
    Animated.spring(slideAnim, { toValue: height - 150, friction: 8, useNativeDriver: true }).start();
  };

  const declineOrder = () => {
    setDeliveryState('idle');
    setOrder(null);
    hideBottomSheet();
  };

  const updateStatus = async (nextState) => {
    if (nextState === 'delivering') {
      setDeliveryState(nextState);
      fetchRoute(order?.latitude, order?.longitude);
      return;
    }
    if (nextState === 'completed') {
      try {
        await livreurAPI.completeOrder(order.id);
      } catch (err) {
        Alert.alert('Erreur', err.response?.data?.error || 'Impossible de finaliser la livraison.');
        return;
      }
      setDeliveryState('completed');
      setRoute([]);
      try {
        const stats = await livreurAPI.getStats();
        setTodayEarnings(parseFloat(stats?.today?.total_amount) || 0);
      } catch (err) {
        console.error('Erreur stats:', err);
      }
      setTimeout(() => {
        setOrder(null);
        setDeliveryState('idle');
        hideBottomSheet();
      }, 3000);
      return;
    }
    setDeliveryState(nextState);
  };

  const toggleTips = async () => {
    const next = !showTips;
    setShowTips(next);
    if (next) {
      try {
        const data = await tipsAPI.getMine();
        setTips({ tips: data.tips || [], total: parseFloat(data.total) || 0 });
      } catch (err) {
        console.error('Erreur pourboires:', err);
      }
    }
  };

  if (!authChecked) {
    return <View style={styles.loader}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  if (!authToken || !authUser) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar style="dark" />
        <Text style={styles.loginEmoji}>🛵</Text>
        <Text style={styles.loginTitle}>NOOR EAT Livreur</Text>
        <Text style={styles.loginSubtitle}>Connectez-vous pour commencer</Text>
        <TextInput
          style={styles.loginInput}
          placeholder="Téléphone (+221...)"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          autoCapitalize="none"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.loginInput}
          placeholder="Mot de passe"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {!!authError && <Text style={styles.loginError}>{authError}</Text>}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={authSubmitting}>
          {authSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>SE CONNECTER</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#f97316" /></View>;

  const restoDist = haversineKm(location?.latitude, location?.longitude, order?.restaurant_lat, order?.restaurant_lng);
  const clientDist = haversineKm(order?.restaurant_lat, order?.restaurant_lng, order?.latitude, order?.longitude);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || DAKAR_CENTER.latitude,
          longitude: location?.longitude || DAKAR_CENTER.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {location && (
          <Marker type="courier" coordinate={location} anchor={{ x: 0.5, y: 0.5 }} />
        )}

        {route.length > 0 && (
          <Polyline coordinates={route} strokeWidth={6} strokeColor="#f97316" />
        )}

        {(deliveryState === 'accepted' || deliveryState === 'pickup') && order?.restaurant_lat ? (
           <Marker type="restaurant" coordinate={{ latitude: order.restaurant_lat, longitude: order.restaurant_lng }} title={order.restaurant_name} />
        ) : deliveryState === 'delivering' && order?.latitude ? (
           <Marker type="client" coordinate={{ latitude: order.latitude, longitude: order.longitude }} title={order.client_name} />
        ) : null}
      </MapView>

      {/* HEADER CONTROLS */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleTips}><Ionicons name="cash-outline" size={20} color={showTips ? '#f97316' : '#1f2937'} /></TouchableOpacity>
        <View style={styles.earningsCard}>
          <Text style={styles.earnLabel}>Solde du jour</Text>
          <Text style={styles.earnValue}>{todayEarnings.toLocaleString()} F</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}><Ionicons name="log-out-outline" size={20} color="#1f2937" /></TouchableOpacity>
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
           <Text style={styles.missionPrice}>+{Number(order?.delivery_fee || 0).toLocaleString()} FCFA</Text>
           <View style={styles.locRow}>
              <View style={styles.dotResto} />
              <Text style={styles.locText}>{order?.restaurant_name || 'Restaurant'}{restoDist != null ? ` (${restoDist}km)` : ''}</Text>
           </View>
           <View style={styles.line} />
           <View style={styles.locRow}>
              <View style={styles.dotClient} />
              <Text style={styles.locText}>{order?.delivery_address || 'Client'}{clientDist != null ? ` (${clientDist}km)` : ''}</Text>
           </View>
        </View>
        <View style={styles.btnRow}>
           <TouchableOpacity style={styles.decline} onPress={declineOrder}>
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
            <Text style={styles.completedAmount}>+{Number(order?.delivery_fee || 0).toLocaleString()} F</Text>
            {order?.tip_amount > 0 && <Text style={styles.completedTip}>Pourboire: +{order.tip_amount} F</Text>}
          </View>
        </View>
      )}

      {/* ACTIVE BAR */}
      {deliveryState !== 'idle' && deliveryState !== 'incoming' && deliveryState !== 'completed' && (
        <View style={styles.activeBar}>
           <View style={{ flex: 1 }}>
              <Text style={styles.activeType}>
                {deliveryState === 'accepted' ? 'Vers le resto' : deliveryState === 'delivering' ? 'Vers le client' : 'Arrivé !'}
              </Text>
              <Text style={styles.activeDest}>
                {deliveryState === 'delivering' ? (order?.delivery_address || 'Client') : (order?.restaurant_name || 'Restaurant')}
              </Text>
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

  loginContainer: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 30 },
  loginEmoji: { fontSize: 60, marginBottom: 10 },
  loginTitle: { fontSize: 26, fontWeight: '900', color: '#111827' },
  loginSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, marginBottom: 30 },
  loginInput: { width: '100%', backgroundColor: '#f9fafb', borderRadius: 15, paddingHorizontal: 20, paddingVertical: 14, fontSize: 15, color: '#111827', marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb' },
  loginError: { color: '#ef4444', fontWeight: 'bold', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  loginButton: { width: '100%', backgroundColor: '#f97316', borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 5 },
  loginButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },

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
