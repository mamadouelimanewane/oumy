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
  getRestaurants: () => fetchWithAuth('/client/restaurants'),
  getRestaurant: (id) => fetchWithAuth(`/client/restaurants/${id}`),
  getPlats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetchWithAuth(`/client/plats?${queryString}`);
  },
  createOrder: (orderData) => fetchWithAuth('/client/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }),
  getOrders: () => fetchWithAuth('/client/orders'),
  trackOrder: (id) => fetchWithAuth(`/client/orders/${id}/track`),
};

// Socket.IO connection
export const createSocketConnection = (token) => {
  const socket = io(API_URL.replace('/api', ''), {
    auth: { token },
  });
  
  return socket;
};

export default fetchWithAuth;
