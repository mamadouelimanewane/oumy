const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api');

// Helper pour les requêtes API
const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Erreur serveur');
  }

  return data;
};

// Auth API
export const authAPI = {
  login: (phone, password) => fetchWithAuth('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  }),
  
  register: (userData) => fetchWithAuth('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  
  getMe: () => fetchWithAuth('/auth/me'),
  
  updateProfile: (data) => fetchWithAuth('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// Client API
export const clientAPI = {
  getRestaurants: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/client/restaurants?${queryString}`);
  },
  getRestaurant: (id) => fetchWithAuth(`/client/restaurants/${id}`),
  getPlats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/client/plats?${queryString}`);
  },
  createOrder: (orderData) => fetchWithAuth('/client/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }),
  getOrders: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/client/orders?${queryString}`);
  },
  trackOrder: (id) => fetchWithAuth(`/client/orders/${id}/track`),
  cancelOrder: (id) => fetchWithAuth(`/client/orders/${id}/cancel`, { method: 'PUT' }),
  getDeliveryFee: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/client/delivery-fee?${queryString}`);
  },
};

// Favorites API
export const favoritesAPI = {
  toggle: (restaurantId) => fetchWithAuth(`/favorites/${restaurantId}`, { method: 'POST' }),
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/favorites?${queryString}`);
  },
  check: (restaurantId) => fetchWithAuth(`/favorites/check/${restaurantId}`),
};

// Ratings API
export const ratingsAPI = {
  create: (data) => fetchWithAuth('/ratings', { method: 'POST', body: JSON.stringify(data) }),
  getForRestaurant: (id, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/ratings/restaurant/${id}?${queryString}`);
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: (page = 1) => fetchWithAuth(`/notifications?page=${page}`),
  getUnreadCount: () => fetchWithAuth('/notifications/unread-count'),
  markRead: (id) => fetchWithAuth(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => fetchWithAuth('/notifications/read-all', { method: 'PUT' }),
};

// Promotions API
export const promotionsAPI = {
  validate: (code, order_amount, restaurant_id) => fetchWithAuth('/promotions/validate', {
    method: 'POST',
    body: JSON.stringify({ code, order_amount, restaurant_id }),
  }),
};

// Addresses API
export const addressesAPI = {
  getAll: () => fetchWithAuth('/addresses'),
  add: (data) => fetchWithAuth('/addresses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchWithAuth(`/addresses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => fetchWithAuth(`/addresses/${id}`, { method: 'DELETE' }),
  setDefault: (id) => fetchWithAuth(`/addresses/${id}/default`, { method: 'PUT' }),
};

// Chat API
export const chatAPI = {
  getMessages: (orderId) => fetchWithAuth(`/chat/${orderId}`),
  sendMessage: (orderId, message) => fetchWithAuth(`/chat/${orderId}`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),
};

// Loyalty API
export const loyaltyAPI = {
  getBalance: () => fetchWithAuth('/loyalty/balance'),
  getHistory: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/loyalty/history?${queryString}`);
  },
  redeem: (points) => fetchWithAuth('/loyalty/redeem', {
    method: 'POST',
    body: JSON.stringify({ points }),
  }),
  getReferralCode: () => fetchWithAuth('/loyalty/referral-code'),
  applyReferral: (code) => fetchWithAuth('/loyalty/apply-referral', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }),
};

// Reorder & Delivery Time
export const orderExtrasAPI = {
  reorder: (orderId, data = {}) => fetchWithAuth(`/client/orders/${orderId}/reorder`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getDeliveryTime: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/client/delivery-time?${queryString}`);
  },
};

// ===== NEW FEATURE APIs =====

// Wallet API
export const walletAPI = {
  getBalance: () => fetchWithAuth('/wallet/balance'),
  deposit: (amount, payment_method, transaction_ref) => fetchWithAuth('/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount, payment_method, transaction_ref }) }),
  withdraw: (amount, payment_method, phone_number) => fetchWithAuth('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount, payment_method, phone_number }) }),
  getTransactions: (params = {}) => { const q = new URLSearchParams(params).toString(); return fetchWithAuth(`/wallet/transactions?${q}`); },
  pay: (order_id, amount) => fetchWithAuth('/wallet/pay', { method: 'POST', body: JSON.stringify({ order_id, amount }) }),
};

// Customization API (menu item options)
export const customizationAPI = {
  getOptions: (menuItemId) => fetchWithAuth(`/customization/menu-item/${menuItemId}`),
  createOption: (data) => fetchWithAuth('/customization/options', { method: 'POST', body: JSON.stringify(data) }),
  updateOption: (id, data) => fetchWithAuth(`/customization/options/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOption: (id) => fetchWithAuth(`/customization/options/${id}`, { method: 'DELETE' }),
  addValue: (optionId, data) => fetchWithAuth(`/customization/options/${optionId}/values`, { method: 'POST', body: JSON.stringify(data) }),
  updateValue: (id, data) => fetchWithAuth(`/customization/values/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteValue: (id) => fetchWithAuth(`/customization/values/${id}`, { method: 'DELETE' }),
};

// Scheduled Orders API
export const scheduledAPI = {
  createOrder: (data) => fetchWithAuth('/scheduled/orders', { method: 'POST', body: JSON.stringify(data) }),
  getOrders: (params = {}) => { const q = new URLSearchParams(params).toString(); return fetchWithAuth(`/scheduled/orders?${q}`); },
  cancelOrder: (id) => fetchWithAuth(`/scheduled/orders/${id}/cancel`, { method: 'PUT' }),
};

// Gamification API
export const gamificationAPI = {
  getBadges: () => fetchWithAuth('/gamification/badges'),
  getMyBadges: () => fetchWithAuth('/gamification/my-badges'),
  getChallenges: () => fetchWithAuth('/gamification/challenges'),
  getMyChallenges: () => fetchWithAuth('/gamification/my-challenges'),
  joinChallenge: (id) => fetchWithAuth(`/gamification/challenges/${id}/join`, { method: 'POST' }),
};

// Gift Cards API
export const giftCardAPI = {
  create: (data) => fetchWithAuth('/giftcards', { method: 'POST', body: JSON.stringify(data) }),
  redeem: (code) => fetchWithAuth('/giftcards/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  getSent: () => fetchWithAuth('/giftcards/sent'),
  check: (code) => fetchWithAuth(`/giftcards/check/${code}`),
};

// Tips API
export const tipsAPI = {
  create: (order_id, amount) => fetchWithAuth('/tips', { method: 'POST', body: JSON.stringify({ order_id, amount }) }),
  getCourierTips: () => fetchWithAuth('/tips/courier'),
};

// Support Tickets API
export const supportAPI = {
  create: (data) => fetchWithAuth('/support', { method: 'POST', body: JSON.stringify(data) }),
  getMyTickets: (params = {}) => { const q = new URLSearchParams(params).toString(); return fetchWithAuth(`/support/my?${q}`); },
  getTicket: (id) => fetchWithAuth(`/support/${id}`),
  reply: (id, message) => fetchWithAuth(`/support/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),
  close: (id) => fetchWithAuth(`/support/${id}/close`, { method: 'PUT' }),
};

// Subscriptions API
export const subscriptionAPI = {
  getPlans: () => fetchWithAuth('/subscriptions/plans'),
  subscribe: (planId) => fetchWithAuth('/subscriptions/subscribe', { method: 'POST', body: JSON.stringify({ plan_id: planId }) }),
  getMySubscription: () => fetchWithAuth('/subscriptions/my'),
  pause: () => fetchWithAuth('/subscriptions/pause', { method: 'PUT' }),
  cancel: () => fetchWithAuth('/subscriptions/cancel', { method: 'PUT' }),
};

// Stories API
export const storiesAPI = {
  getActive: () => fetchWithAuth('/stories/active'),
  create: (data) => fetchWithAuth('/stories', { method: 'POST', body: JSON.stringify(data) }),
  view: (id) => fetchWithAuth(`/stories/${id}/view`, { method: 'POST' }),
};

// Social Feed API
export const socialAPI = {
  getFeed: (params = {}) => { const q = new URLSearchParams(params).toString(); return fetchWithAuth(`/social/feed?${q}`); },
  getRankings: (category) => fetchWithAuth(`/social/rankings${category ? `?category=${category}` : ''}`),
  getAmbassador: () => fetchWithAuth('/social/ambassador'),
  getLeaderboard: () => fetchWithAuth('/social/ambassador/leaderboard'),
};

// Delivery Zones API
export const deliveryZoneAPI = {
  getZones: () => fetchWithAuth('/delivery-zones'),
  calculateFee: (data) => fetchWithAuth('/delivery-zones/calculate', { method: 'POST', body: JSON.stringify(data) }),
  getRelayPoints: () => fetchWithAuth('/delivery-zones/relay-points'),
};

// Stock Management API
export const stockAPI = {
  getStock: () => fetchWithAuth('/stock'),
  updateStock: (menuItemId, data) => fetchWithAuth(`/stock/${menuItemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getLowStock: () => fetchWithAuth('/stock/low'),
};

// Catering API
export const cateringAPI = {
  create: (data) => fetchWithAuth('/catering', { method: 'POST', body: JSON.stringify(data) }),
  getMyRequests: () => fetchWithAuth('/catering/my'),
  getRestaurantRequests: (params = {}) => { const q = new URLSearchParams(params).toString(); return fetchWithAuth(`/catering/restaurant?${q}`); },
  respond: (id, status) => fetchWithAuth(`/catering/${id}/respond`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

// QR Codes API
export const qrCodeAPI = {
  generate: (table_number) => fetchWithAuth('/qrcodes/generate', { method: 'POST', body: JSON.stringify({ table_number }) }),
  getMyQR: () => fetchWithAuth('/qrcodes/my'),
  scan: (id) => fetchWithAuth(`/qrcodes/scan/${id}`),
  remove: (id) => fetchWithAuth(`/qrcodes/${id}`, { method: 'DELETE' }),
};

// Recommendations API
export const recommendationAPI = {
  getPersonalized: () => fetchWithAuth('/recommendations/personalized'),
  getPopular: () => fetchWithAuth('/recommendations/popular'),
  getSurprise: () => fetchWithAuth('/recommendations/surprise'),
};

// Fraud API (Admin)
export const fraudAPI = {
  getAlerts: (params = {}) => { const q = new URLSearchParams(params).toString(); return fetchWithAuth(`/fraud/alerts?${q}`); },
  resolve: (id) => fetchWithAuth(`/fraud/alerts/${id}/resolve`, { method: 'PUT' }),
  checkOrder: (orderId) => fetchWithAuth(`/fraud/check/${orderId}`, { method: 'POST' }),
};

// Reorder API
export const reorderAPI = {
  getHistory: () => fetchWithAuth('/reorder/history'),
  reorder: (orderId) => fetchWithAuth(`/reorder/${orderId}`, { method: 'POST' }),
};

// Chat Live API
export const chatLiveAPI = {
  getMessages: (orderId) => fetchWithAuth(`/chat-live/${orderId}`),
  sendMessage: (orderId, message) => fetchWithAuth(`/chat-live/${orderId}`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),
};

// Preferences API
export const preferencesAPI = {
  get: () => fetchWithAuth('/preferences'),
  update: (data) => fetchWithAuth('/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  getAddresses: () => fetchWithAuth('/preferences/addresses'),
  saveAddress: (data) => fetchWithAuth('/preferences/addresses', { method: 'POST', body: JSON.stringify(data) }),
  deleteAddress: (id) => fetchWithAuth(`/preferences/addresses/${id}`, { method: 'DELETE' }),
};

// Referral API
export const referralAPI = {
  getMyCode: () => fetchWithAuth('/referral/my-code'),
  apply: (code) => fetchWithAuth('/referral/apply', { method: 'POST', body: JSON.stringify({ code }) }),
  getStats: () => fetchWithAuth('/referral/stats'),
};

// Group Order API
export const groupOrderAPI = {
  create: (data) => fetchWithAuth('/group-order', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => fetchWithAuth(`/group-order/${id}`),
  join: (id, items) => fetchWithAuth(`/group-order/${id}/join`, { method: 'POST', body: JSON.stringify({ items }) }),
  finalize: (id) => fetchWithAuth(`/group-order/${id}/finalize`, { method: 'POST' }),
};

// Meal Plan API
export const mealPlanAPI = {
  getAll: () => fetchWithAuth('/meal-plans'),
  create: (data) => fetchWithAuth('/meal-plans', { method: 'POST', body: JSON.stringify(data) }),
  activate: (id) => fetchWithAuth(`/meal-plans/${id}/activate`, { method: 'PUT' }),
  remove: (id) => fetchWithAuth(`/meal-plans/${id}`, { method: 'DELETE' }),
};

// Mini Game API
export const miniGameAPI = {
  spinWheel: () => fetchWithAuth('/mini-games/spin-wheel', { method: 'POST' }),
  scratchCard: () => fetchWithAuth('/mini-games/scratch-card', { method: 'POST' }),
  getPrizes: () => fetchWithAuth('/mini-games/prizes'),
  claimPrize: (id) => fetchWithAuth(`/mini-games/prizes/${id}/claim`, { method: 'POST' }),
};

// Analytics Restaurant API
export const analyticsRestaurantAPI = {
  getOverview: () => fetchWithAuth('/analytics-restaurant/overview'),
  getPopularItems: () => fetchWithAuth('/analytics-restaurant/popular-items'),
  getPeakHours: () => fetchWithAuth('/analytics-restaurant/peak-hours'),
  getRevenueChart: () => fetchWithAuth('/analytics-restaurant/revenue-chart'),
};

// Price Alert API
export const priceAlertAPI = {
  getAll: () => fetchWithAuth('/price-alerts'),
  create: (data) => fetchWithAuth('/price-alerts', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => fetchWithAuth(`/price-alerts/${id}`, { method: 'DELETE' }),
};

// Split Payment API
export const splitPaymentAPI = {
  create: (data) => fetchWithAuth('/split-payment', { method: 'POST', body: JSON.stringify(data) }),
  getStatus: (orderId) => fetchWithAuth(`/split-payment/${orderId}`),
  payShare: (orderId) => fetchWithAuth(`/split-payment/${orderId}/pay`, { method: 'POST' }),
};

// Photo Reviews API
export const photoReviewAPI = {
  create: (data) => fetchWithAuth('/photo-reviews', { method: 'POST', body: JSON.stringify(data) }),
  getForRestaurant: (id) => fetchWithAuth(`/photo-reviews/restaurant/${id}`),
  getForOrder: (id) => fetchWithAuth(`/photo-reviews/order/${id}`),
};

// Push Notifications API
export const pushNotificationsAPI = {
  getVapidKey: () => fetchWithAuth('/notifications-push/vapid-public-key'),
  subscribe: (subscription) => fetchWithAuth('/notifications-push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),
  getAll: () => fetchWithAuth('/notifications-push'),
  markRead: (id) => fetchWithAuth(`/notifications-push/${id}/read`, { method: 'PUT' }),
  markAllRead: () => fetchWithAuth('/notifications-push/read-all', { method: 'PUT' }),
};

// Active les vraies notifications push navigateur : demande la permission,
// s'abonne via le Service Worker deja enregistre (voir index.html/sw.js) avec
// la cle publique VAPID du serveur, puis enregistre l'abonnement cote backend.
export async function enableBrowserPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error("Les notifications push ne sont pas supportées par ce navigateur");
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission refusée');
  }
  const { publicKey } = await pushNotificationsAPI.getVapidKey();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await pushNotificationsAPI.subscribe(subscription.toJSON());
  return subscription;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Voice Order API
export const voiceOrderAPI = {
  search: (text) => fetchWithAuth('/voice-order/search', { method: 'POST', body: JSON.stringify({ text }) }),
};

// 2FA API
export const twofaAPI = {
  sendOTP: () => fetchWithAuth('/2fa/send-otp', { method: 'POST' }),
  verifyOTP: (otp) => fetchWithAuth('/2fa/verify-otp', { method: 'POST', body: JSON.stringify({ otp }) }),
};

export default fetchWithAuth;
