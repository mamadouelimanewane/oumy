const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('admin_token');
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.reload();
    throw new Error('Session expirée');
  }

  return response;
};

export const authAPI = {
  login: async (phone, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    return res.json();
  },

  getMe: async () => {
    const res = await fetchWithAuth('/auth/me');
    return res.json();
  },
};

export const adminAPI = {
  getDashboard: async () => {
    const res = await fetchWithAuth('/admin/dashboard');
    return res.json();
  },

  getRestaurants: async (page = 1) => {
    const res = await fetchWithAuth(`/admin/restaurants?page=${page}&limit=20`);
    return res.json();
  },

  getCouriers: async (page = 1) => {
    const res = await fetchWithAuth(`/admin/couriers?page=${page}&limit=20`);
    return res.json();
  },

  getClients: async (page = 1) => {
    const res = await fetchWithAuth(`/admin/clients?page=${page}&limit=20`);
    return res.json();
  },

  getOrders: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetchWithAuth(`/admin/orders?${query}`);
    return res.json();
  },

  updateUserStatus: async (userId, isActive) => {
    const res = await fetchWithAuth(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
    return res.json();
  },
};

export const notificationsAPI = {
  getUnreadCount: async () => {
    const res = await fetchWithAuth('/notifications/unread-count');
    return res.json();
  },
};

export const createSocketConnection = async (token) => {
  const { io } = await import('socket.io-client');
  const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
};
