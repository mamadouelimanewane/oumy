// Frais de livraison (Haversine) : base + tarif/km configurables par l'admin
// (GET/PUT /admin/settings), repli sur le tarif de base si les coordonnées du
// restaurant ou du point de livraison manquent.
function calculateDeliveryFee(restLat, restLng, lat, lng, base = 500, perKm = 200) {
  if (!restLat || !restLng || !lat || !lng) return base;
  const R = 6371;
  const dLat = (parseFloat(lat) - parseFloat(restLat)) * Math.PI / 180;
  const dLng = (parseFloat(lng) - parseFloat(restLng)) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(parseFloat(restLat) * Math.PI / 180) *
            Math.cos(parseFloat(lat) * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance_km = Math.round(R * c * 10) / 10;
  return base + Math.round(distance_km * perKm);
}

module.exports = { calculateDeliveryFee };
