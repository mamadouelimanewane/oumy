import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ImageBackground, TouchableOpacity, Dimensions, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// MOCK DATA: Carte de Dakar en fond
const MAP_BG = 'https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

export default function App() {
  const [isOnline, setIsOnline] = useState(false);
  const [deliveryState, setDeliveryState] = useState('idle'); // 'idle', 'incoming', 'accepted', 'pickup', 'delivering', 'completed'
  const slideAnim = useRef(new Animated.Value(height)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation Pulse pour le bouton En Ligne
  useEffect(() => {
    if (isOnline && deliveryState === 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ).start();

      // Simulation réception de commande après 5s
      const timer = setTimeout(() => {
        setDeliveryState('incoming');
        Animated.spring(slideAnim, {
          toValue: height - 400,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, deliveryState]);

  const handleToggleStatus = () => {
    setIsOnline(!isOnline);
    setDeliveryState('idle');
  };

  const acceptOrder = () => {
    setDeliveryState('accepted');
    Animated.spring(slideAnim, {
      toValue: height - 150,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const updateStatus = (nextState) => {
    setDeliveryState(nextState);
    if (nextState === 'completed') {
      setTimeout(() => {
        setDeliveryState('idle');
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* MAP BACKGROUND (Simulée) */}
      <ImageBackground source={{ uri: MAP_BG }} style={styles.map} imageStyle={{ opacity: isOnline ? 0.9 : 0.6 }}>
        {/* OVERLAY SOMBRE SI HORS LIGNE */}
        {!isOnline && <View style={styles.offlineOverlay} />}

        {/* HEADER: GAINS ET PROFIL */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.profileBtn}>
            <Ionicons name="person-circle" size={32} color="#1f2937" />
          </TouchableOpacity>
          <View style={styles.earningsPill}>
            <Text style={styles.earningsLabel}>Gains (Jour)</Text>
            <Text style={styles.earningsAmount}>15 400 FCFA</Text>
          </View>
          <TouchableOpacity style={styles.menuBtn}>
             <Ionicons name="list" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* BOUTON GO / OFFLINE (Centre bas) */}
        {deliveryState === 'idle' && (
          <View style={styles.actionCenter}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: isOnline ? 0.3 : 0 }]} />
            <TouchableOpacity 
              style={[styles.goButton, isOnline ? styles.goOnline : styles.goOffline]} 
              onPress={handleToggleStatus}
            >
              <Text style={styles.goText}>{isOnline ? 'EN LIGNE' : 'START'}</Text>
            </TouchableOpacity>
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                {isOnline ? "Recherche de commandes..." : "Vous êtes hors ligne"}
              </Text>
            </View>
          </View>
        )}
      </ImageBackground>

      {/* POPUP: NOUVELLE COMMANDE */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: deliveryState === 'incoming' ? slideAnim : height }] }]}>
        <View style={styles.incomingHeader}>
          <View style={styles.ringBell}>
            <Ionicons name="notifications" size={24} color="#f97316" />
          </View>
          <Text style={styles.newOrderText}>Livraison Wave 🌊</Text>
          <Text style={styles.timer}>0:45</Text>
        </View>
        
        <View style={styles.orderDetails}>
          <Text style={styles.priceEstimate}>+2 000 FCFA</Text>
          <View style={styles.routeItem}>
             <Ionicons name="storefront" size={20} color="#374151" />
             <View style={styles.routeInfo}>
                <Text style={styles.routeMain}>Dark Kitchen Ousmane</Text>
                <Text style={styles.routeSub}>Plateau, 2.5 km (Trajet : 8 min)</Text>
             </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeItem}>
             <Ionicons name="location" size={20} color="#f97316" />
             <View style={styles.routeInfo}>
                <Text style={styles.routeMain}>Oumy D.</Text>
                <Text style={styles.routeSub}>Almadies, +8.2 km (Trajet : 15 min)</Text>
             </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineBtn} onPress={() => setDeliveryState('idle')}>
            <Text style={styles.declineText}>Ignorer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={acceptOrder}>
            <Text style={styles.acceptText}>ACCEPTER</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ACTIVE DELIVERY STATUS BAR */}
      {deliveryState !== 'idle' && deliveryState !== 'incoming' && (
        <Animated.View style={[styles.activeDeliveryBar]}>
          <View style={styles.activeContent}>
            <View style={styles.activeTextGroup}>
              <Text style={styles.activeTitle}>
                {deliveryState === 'accepted' ? 'En route vers le restaurant' : 
                 deliveryState === 'pickup' ? 'Récupération de la commande' : 
                 deliveryState === 'delivering' ? 'Livraison en cours' : 'Livraison Terminée ! 🎉'}
              </Text>
              <Text style={styles.activeAddress}>
                {deliveryState === 'accepted' || deliveryState === 'pickup' ? 'Dark Kitchen Ousmane, Plateau' : 
                 deliveryState === 'delivering' ? 'Mme Oumy, Résidence Almadies' : 'Paiement Wave reçu (+2000 FCFA)'}
              </Text>
            </View>
            <TouchableOpacity 
               style={styles.actionPill} 
               onPress={() => {
                 if (deliveryState === 'accepted') updateStatus('pickup');
                 else if (deliveryState === 'pickup') updateStatus('delivering');
                 else if (deliveryState === 'delivering') updateStatus('completed');
               }}>
              <Text style={styles.actionPillText}>
                {deliveryState === 'accepted' ? 'Arrivé' : 
                 deliveryState === 'pickup' ? 'Départ' : 
                 deliveryState === 'delivering' ? 'Livré' : 'OK'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  map: { flex: 1, width: '100%', height: '100%', resizeMode: 'cover' },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
  },
  menuBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
  },
  earningsPill: {
    backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
  },
  earningsLabel: { fontSize: 10, color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' },
  earningsAmount: { fontSize: 16, color: '#111827', fontWeight: '900' },

  actionCenter: { position: 'absolute', bottom: 100, alignSelf: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#10b981', top: -30,
  },
  goButton: {
    width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { height: 4, width: 0 }
  },
  goOnline: { backgroundColor: '#10b981' }, // Vert pour en ligne
  goOffline: { backgroundColor: '#1f2937' }, // Noir pour START
  goText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  
  statusBox: { marginTop: 20, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, elevation: 4 },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#374151' },

  bottomSheet: {
    position: 'absolute', left: 0, right: 0, height: 450, backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, elevation: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20,
  },
  incomingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  ringBell: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  newOrderText: { fontSize: 20, fontWeight: '900', color: '#111827', flex: 1 },
  timer: { fontSize: 24, fontWeight: 'bold', color: '#ef4444' },

  orderDetails: { backgroundColor: '#f9fafb', borderRadius: 20, padding: 20, marginBottom: 20 },
  priceEstimate: { fontSize: 28, fontWeight: '900', color: '#10b981', textAlign: 'center', marginBottom: 20 },
  routeItem: { flexDirection: 'row', alignItems: 'center' },
  routeInfo: { marginLeft: 15 },
  routeMain: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  routeSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  routeLine: { width: 2, height: 30, backgroundColor: '#e5e7eb', marginLeft: 9, marginVertical: 5 },

  actions: { flexDirection: 'row', justifyContent: 'center' },
  declineBtn: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15, marginRight: 10 },
  declineText: { fontSize: 16, fontWeight: 'bold', color: '#6b7280' },
  acceptBtn: { flex: 1, backgroundColor: '#10b981', paddingVertical: 15, borderRadius: 15, alignItems: 'center', elevation: 5 },
  acceptText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  activeDeliveryBar: {
    position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#111827',
    borderRadius: 20, padding: 20, elevation: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10
  },
  activeContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeTitle: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  activeAddress: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  actionPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f97316', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 30 },
  actionPillText: { color: '#fff', fontWeight: 'bold', marginRight: 5, fontSize: 14 }
});
