import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Dimensions, Animated, Alert, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import polyline from '@mapbox/polyline';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MapView, { Marker, Polyline } from './components/MapView';
import { TOKEN_KEY, USER_KEY, authAPI, livreurAPI, tipsAPI } from './api';

// Le backend est deploye en fonctions serverless Vercel (voir api/index.js :
// seul `app`, pas le `http.Server`, y est exporte, et server.listen() est
// desactive quand process.env.VERCEL est present). Socket.IO a besoin d'une
// connexion persistante (WebSocket ou polling avec affinite de session) que
// ce type de deploiement ne peut pas fournir — verifie en confirmant que la
// negociation Socket.IO echoue en prod, meme sur le chemin /socket.io/.
// Le "temps reel" est donc remplace ici par un polling REST classique.
const AVAILABLE_ORDERS_POLL_MS = 6000;

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

// Le backend ne suit qu'un statut global ('en_route') par commande — le
// sous-etat "recupere au resto vs pas encore" (pickedUp) est purement local
// a l'app, propre a chaque commande active independamment des autres.
function nextStop(order) {
  return order.pickedUp
    ? { lat: order.latitude, lng: order.longitude, label: order.delivery_address || 'Client', type: 'client' }
    : { lat: order.restaurant_lat, lng: order.restaurant_lng, label: order.restaurant_name || 'Restaurant', type: 'restaurant' };
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
  const [location, setLocation] = useState(null);
  const [route, setRoute] = useState([]);
  // Livraisons multiples : le livreur peut accepter une nouvelle offre sans
  // avoir termine la precedente, et choisit lui-meme l'ordre des arrets.
  const [activeOrders, setActiveOrders] = useState([]); // [{...order, pickedUp}]
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [justCompleted, setJustCompleted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState({ tips: [], total: 0 });
  const [showTips, setShowTips] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);

  const mapRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  // Offres refusees ("Ignorer") a ne pas re-proposer au prochain sondage tant
  // qu'elles restent disponibles.
  const declinedIdsRef = useRef(new Set());

  const isOnlineRef = useRef(isOnline);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

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
            if (isOnlineRef.current) {
              livreurAPI.updateLocation(newLoc.coords.latitude, newLoc.coords.longitude).catch(() => {});
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

  // 2. SONDAGE DES MISSIONS DISPONIBLES (remplace le push Socket.IO,
  // indisponible sur ce deploiement). Continue meme si le livreur a deja des
  // livraisons actives, pour lui permettre d'en enchainer plusieurs sur le
  // meme trajet — une seule offre a la fois est proposee (pas d'empilement
  // de sheets tant que la precedente n'a pas ete traitee).
  useEffect(() => {
    if (!authToken || !isOnline || incomingOffer) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const available = await livreurAPI.getAvailableOrders();
        if (cancelled) return;
        const availableIds = new Set(available.map((o) => o.id));
        declinedIdsRef.current.forEach((id) => { if (!availableIds.has(id)) declinedIdsRef.current.delete(id); });
        const next = available.find((o) => !declinedIdsRef.current.has(o.id));
        if (next) {
          setIncomingOffer(next);
          showBottomSheet();
        }
      } catch (err) {
        console.error('Erreur recherche missions:', err);
      }
    };

    poll();
    const interval = setInterval(poll, AVAILABLE_ORDERS_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [authToken, isOnline, incomingOffer]);

  // 3. DONNÉES INITIALES : gains du jour + livraisons deja en cours (reprise apres fermeture app)
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
        const active = current.filter((o) => o.status === 'en_route').map((o) => ({ ...o, pickedUp: false }));
        if (active.length > 0) {
          setActiveOrders(active);
          selectOrder(active[0]);
        }
      } catch (err) {
        console.error('Erreur commandes en cours:', err);
      }
    })();
  }, [authToken]);

  // 4. ITINÉRAIRE (LocationIQ) — trace toujours l'itineraire de la commande selectionnee
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

  const selectOrder = (orderObj) => {
    setSelectedOrderId(orderObj.id);
    const stop = nextStop(orderObj);
    if (stop.lat && stop.lng) fetchRoute(stop.lat, stop.lng);
    else setRoute([]);
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
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setAuthToken(null);
    setAuthUser(null);
    setIsOnline(false);
    setActiveOrders([]);
    setSelectedOrderId(null);
    setIncomingOffer(null);
    setJustCompleted(null);
    setRoute([]);
    setTodayEarnings(0);
    hideBottomSheet();
  };

  const handleToggleStatus = () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    livreurAPI.setStatus(nextStatus).catch((err) => console.error('Erreur statut en ligne:', err));
    if (!nextStatus && incomingOffer) {
      setIncomingOffer(null);
      hideBottomSheet();
    }
  };

  const acceptOffer = async () => {
    if (!incomingOffer) return;
    const offer = incomingOffer;
    try {
      await livreurAPI.acceptOrder(offer.id);
    } catch (err) {
      Alert.alert('Trop tard !', err.response?.data?.error || "Cette commande n'est plus disponible.");
      setIncomingOffer(null);
      hideBottomSheet();
      return;
    }
    const accepted = { ...offer, pickedUp: false };
    setActiveOrders((prev) => [...prev, accepted]);
    setIncomingOffer(null);
    hideBottomSheet();
    selectOrder(accepted);
  };

  const declineOffer = () => {
    if (incomingOffer) declinedIdsRef.current.add(incomingOffer.id);
    setIncomingOffer(null);
    hideBottomSheet();
  };

  const markPickedUp = (orderObj) => {
    const updated = { ...orderObj, pickedUp: true };
    setActiveOrders((prev) => prev.map((o) => (o.id === orderObj.id ? updated : o)));
    if (orderObj.id === selectedOrderId) selectOrder(updated);
  };

  const completeDelivery = async (orderObj) => {
    try {
      await livreurAPI.completeOrder(orderObj.id);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Impossible de finaliser la livraison.');
      return;
    }
    setJustCompleted(orderObj);
    setTimeout(() => setJustCompleted(null), 3000);

    const remaining = activeOrders.filter((o) => o.id !== orderObj.id);
    setActiveOrders(remaining);
    if (orderObj.id === selectedOrderId) {
      if (remaining.length > 0) selectOrder(remaining[0]);
      else { setSelectedOrderId(null); setRoute([]); }
    }
    try {
      const stats = await livreurAPI.getStats();
      setTodayEarnings(parseFloat(stats?.today?.total_amount) || 0);
    } catch (err) {
      console.error('Erreur stats:', err);
    }
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

  const restoDist = haversineKm(location?.latitude, location?.longitude, incomingOffer?.restaurant_lat, incomingOffer?.restaurant_lng);
  const clientDist = haversineKm(incomingOffer?.restaurant_lat, incomingOffer?.restaurant_lng, incomingOffer?.latitude, incomingOffer?.longitude);

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

        {activeOrders.map((o) => {
          const stop = nextStop(o);
          if (!stop.lat || !stop.lng) return null;
          return (
            <Marker
              key={o.id}
              type={stop.type}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={stop.label}
            />
          );
        })}
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

      {/* STATUT EN LIGNE / HORS LIGNE — toujours visible, independant du nombre de livraisons en cours */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#9ca3af' }]} />
        <Text style={styles.statusBarText}>
          {isOnline ? (activeOrders.length > 0 ? 'En ligne • autres missions' : 'En ligne • recherche...') : 'Hors ligne'}
        </Text>
        <TouchableOpacity style={[styles.statusToggleBtn, isOnline && styles.statusToggleBtnActive]} onPress={handleToggleStatus}>
          <Text style={styles.statusToggleText}>{isOnline ? 'STOP' : 'START'}</Text>
        </TouchableOpacity>
      </View>

      {/* INCOMING ORDER SHEET */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHeader}>
           <Text style={styles.sheetTitle}>Nouvelle Livraison ! 📦</Text>
           {incomingOffer?.is_express && <View style={styles.expressBadge}><Ionicons name="flash" size={12} color="#fff" /><Text style={styles.expressText}>EXPRESS</Text></View>}
           <View style={styles.timerBadge}><Text style={styles.timerText}>45s</Text></View>
        </View>
        <View style={styles.missionCard}>
           <Text style={styles.missionPrice}>+{Number(incomingOffer?.delivery_fee || 0).toLocaleString()} FCFA</Text>
           <View style={styles.locRow}>
              <View style={styles.dotResto} />
              <Text style={styles.locText}>{incomingOffer?.restaurant_name || 'Restaurant'}{restoDist != null ? ` (${restoDist}km)` : ''}</Text>
           </View>
           <View style={styles.line} />
           <View style={styles.locRow}>
              <View style={styles.dotClient} />
              <Text style={styles.locText}>{incomingOffer?.delivery_address || 'Client'}{clientDist != null ? ` (${clientDist}km)` : ''}</Text>
           </View>
        </View>
        <View style={styles.btnRow}>
           <TouchableOpacity style={styles.decline} onPress={declineOffer}>
              <Text style={styles.declineText}>Ignorer</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.accept} onPress={acceptOffer}>
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
      {justCompleted && (
        <View style={styles.completedOverlay}>
          <View style={styles.completedCard}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Livraison terminée !</Text>
            <Text style={styles.completedAmount}>+{Number(justCompleted?.delivery_fee || 0).toLocaleString()} F</Text>
            {justCompleted?.tip_amount > 0 && <Text style={styles.completedTip}>Pourboire: +{justCompleted.tip_amount} F</Text>}
          </View>
        </View>
      )}

      {/* LIVRAISONS ACTIVES — liste, le livreur choisit lui-meme l'ordre des arrets */}
      {activeOrders.length > 0 && (
        <View style={styles.ordersPanel}>
          <Text style={styles.ordersPanelTitle}>
            {activeOrders.length} livraison{activeOrders.length > 1 ? 's' : ''} en cours
          </Text>
          <ScrollView style={styles.ordersScroll} showsVerticalScrollIndicator={false}>
            {activeOrders.map((o) => {
              const stop = nextStop(o);
              const isSelected = o.id === selectedOrderId;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.orderCard, isSelected && styles.orderCardSelected]}
                  onPress={() => selectOrder(o)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderCardType}>{o.pickedUp ? 'VERS LE CLIENT' : 'VERS LE RESTO'}</Text>
                    <Text style={styles.orderCardDest} numberOfLines={1}>{stop.label}</Text>
                    <Text style={styles.orderCardPrice}>+{Number(o.delivery_fee || 0).toLocaleString()} FCFA</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.orderCardBtn, o.pickedUp && styles.orderCardBtnDeliver]}
                    onPress={() => (o.pickedUp ? completeDelivery(o) : markPickedUp(o))}
                  >
                    <Text style={styles.orderCardBtnText}>{o.pickedUp ? 'LIVRÉ' : 'RÉCUPÉRÉ'}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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

  statusBar: { position: 'absolute', top: 105, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusBarText: { flex: 1, fontSize: 12, fontWeight: 'bold', color: '#374151' },
  statusToggleBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  statusToggleBtnActive: { backgroundColor: '#ef4444' },
  statusToggleText: { color: '#fff', fontWeight: '900', fontSize: 11 },

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

  expressBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 10 },
  expressText: { color: '#fff', fontWeight: '900', fontSize: 10, marginLeft: 3 },

  tipsPanel: { position: 'absolute', top: 160, left: 15, right: 15, backgroundColor: '#fff', borderRadius: 25, padding: 25, elevation: 20, zIndex: 100 },
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

  ordersPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10, elevation: 20, maxHeight: 320 },
  ordersPanelTitle: { fontSize: 13, fontWeight: '900', color: '#111827', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  ordersScroll: { maxHeight: 250 },
  orderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  orderCardSelected: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  orderCardType: { fontSize: 9, fontWeight: '900', color: '#9ca3af', letterSpacing: 0.5 },
  orderCardDest: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginTop: 2 },
  orderCardPrice: { fontSize: 12, fontWeight: '900', color: '#10b981', marginTop: 4 },
  orderCardBtn: { backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, marginLeft: 10 },
  orderCardBtnDeliver: { backgroundColor: '#f97316' },
  orderCardBtnText: { color: '#fff', fontWeight: '900', fontSize: 11 },
});
