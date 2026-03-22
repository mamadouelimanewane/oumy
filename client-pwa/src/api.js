const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper pour les requêtes API
const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const config = {
    ...options,
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

// Socket.IO connection
export const createSocketConnection = (token) => {
  const socket = io(API_URL.replace('/api', ''), {
    auth: { token },
  });
  
  return socket;
};

export default fetchWithAuth;
