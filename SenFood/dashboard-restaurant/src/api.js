const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api');
export const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;

// Helper pour les requêtes authentifiées
const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('restaurant_token');
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    credentials: 'include', // Indispensable pour que Vercel SSO laisse passer l'API
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('restaurant_user');
    window.location.reload();
    throw new Error('Session expirée');
  }

  return response;
};

// Auth API
export const authAPI = {
  login: async (phone, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
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

// Restaurant API
export const restaurantAPI = {
  getActiveOrders: async () => {
    const res = await fetchWithAuth('/restaurant/orders/active');
    return res.json();
  },

  updateOrderStatus: async (orderId, status) => {
    const res = await fetchWithAuth(`/restaurant/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  getMenu: async () => {
    const res = await fetchWithAuth('/restaurant/menu');
    return res.json();
  },

  addMenuItem: async (item) => {
    const res = await fetchWithAuth('/restaurant/menu', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    return res.json();
  },

  updateMenuItem: async (id, data) => {
    const res = await fetchWithAuth(`/restaurant/menu/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteMenuItem: async (id) => {
    const res = await fetchWithAuth(`/restaurant/menu/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  getStats: async () => {
    const res = await fetchWithAuth('/restaurant/stats');
    return res.json();
  },

  getHours: async () => {
    const res = await fetchWithAuth('/restaurant/hours');
    return res.json();
  },

  updateHours: async (hours) => {
    const res = await fetchWithAuth('/restaurant/hours', {
      method: 'PUT',
      body: JSON.stringify({ hours }),
    });
    return res.json();
  },

  getAnalytics: async (period = '7d') => {
    const res = await fetchWithAuth(`/restaurant/analytics?period=${period}`);
    return res.json();
  },

  scheduleMenuItem: async (id, availableFrom, availableUntil) => {
    const res = await fetchWithAuth(`/restaurant/menu/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ available_from: availableFrom, available_until: availableUntil }),
    });
    return res.json();
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async (page = 1) => {
    const res = await fetchWithAuth(`/notifications?page=${page}`);
    return res.json();
  },

  getUnreadCount: async () => {
    const res = await fetchWithAuth('/notifications/unread-count');
    return res.json();
  },

  markRead: async (id) => {
    const res = await fetchWithAuth(`/notifications/${id}/read`, { method: 'PUT' });
    return res.json();
  },

  markAllRead: async () => {
    const res = await fetchWithAuth('/notifications/read-all', { method: 'PUT' });
    return res.json();
  },
};

// Promotions API
export const promotionsAPI = {
  getAll: async () => {
    const res = await fetchWithAuth('/promotions');
    return res.json();
  },
  create: async (data) => {
    const res = await fetchWithAuth('/promotions', { method: 'POST', body: JSON.stringify(data) });
    return res.json();
  },
  toggle: async (id) => {
    const res = await fetchWithAuth(`/promotions/${id}/toggle`, { method: 'PUT' });
    return res.json();
  },
  delete: async (id) => {
    const res = await fetchWithAuth(`/promotions/${id}`, { method: 'DELETE' });
    return res.json();
  },
};

// Payout API
export const payoutAPI = {
  request: async (amount, method) => {
    const res = await fetchWithAuth('/payouts/request', { method: 'POST', body: JSON.stringify({ amount, method }) });
    return res.json();
  },
  getHistory: async () => {
    const res = await fetchWithAuth('/payouts/history');
    return res.json();
  },
};

// Chat API
export const chatAPI = {
  getMessages: async (orderId) => {
    const res = await fetchWithAuth(`/chat/${orderId}`);
    return res.json();
  },
  sendMessage: async (orderId, message) => {
    const res = await fetchWithAuth(`/chat/${orderId}`, { method: 'POST', body: JSON.stringify({ message }) });
    return res.json();
  },
};

// ===== NEW FEATURE APIs =====

// Stock Management API
export const stockAPI = {
  getAll: async () => { const res = await fetchWithAuth('/stock'); return res.json(); },
  update: async (menuItemId, data) => { const res = await fetchWithAuth(`/stock/${menuItemId}`, { method: 'PUT', body: JSON.stringify(data) }); return res.json(); },
  getLowStock: async () => { const res = await fetchWithAuth('/stock/low'); return res.json(); },
};

// Customization API (menu item options)
export const customizationAPI = {
  getOptions: async (menuItemId) => { const res = await fetchWithAuth(`/customization/menu-item/${menuItemId}`); return res.json(); },
  createOption: async (data) => { const res = await fetchWithAuth('/customization/options', { method: 'POST', body: JSON.stringify(data) }); return res.json(); },
  updateOption: async (id, data) => { const res = await fetchWithAuth(`/customization/options/${id}`, { method: 'PUT', body: JSON.stringify(data) }); return res.json(); },
  deleteOption: async (id) => { const res = await fetchWithAuth(`/customization/options/${id}`, { method: 'DELETE' }); return res.json(); },
  addValue: async (optionId, data) => { const res = await fetchWithAuth(`/customization/options/${optionId}/values`, { method: 'POST', body: JSON.stringify(data) }); return res.json(); },
  updateValue: async (id, data) => { const res = await fetchWithAuth(`/customization/values/${id}`, { method: 'PUT', body: JSON.stringify(data) }); return res.json(); },
  deleteValue: async (id) => { const res = await fetchWithAuth(`/customization/values/${id}`, { method: 'DELETE' }); return res.json(); },
};

// Stories API
export const storiesAPI = {
  create: async (data) => { const res = await fetchWithAuth('/stories', { method: 'POST', body: JSON.stringify(data) }); return res.json(); },
  getActive: async () => { const res = await fetchWithAuth('/stories/active'); return res.json(); },
};

// QR Code API
export const qrCodeAPI = {
  generate: async (table_number) => { const res = await fetchWithAuth('/qrcodes/generate', { method: 'POST', body: JSON.stringify({ table_number }) }); return res.json(); },
  getMyQR: async () => { const res = await fetchWithAuth('/qrcodes/my'); return res.json(); },
  remove: async (id) => { const res = await fetchWithAuth(`/qrcodes/${id}`, { method: 'DELETE' }); return res.json(); },
};

// Catering API
export const cateringAPI = {
  getRequests: async (params = {}) => { const q = new URLSearchParams(params).toString(); const res = await fetchWithAuth(`/catering/restaurant?${q}`); return res.json(); },
  respond: async (id, status) => { const res = await fetchWithAuth(`/catering/${id}/respond`, { method: 'PUT', body: JSON.stringify({ status }) }); return res.json(); },
};

// Analytics API
export const analyticsAPI = {
  getOverview: async () => { const res = await fetchWithAuth('/analytics-restaurant/overview'); return res.json(); },
  getPopularItems: async () => { const res = await fetchWithAuth('/analytics-restaurant/popular-items'); return res.json(); },
  getPeakHours: async () => { const res = await fetchWithAuth('/analytics-restaurant/peak-hours'); return res.json(); },
  getRevenueChart: async () => { const res = await fetchWithAuth('/analytics-restaurant/revenue-chart'); return res.json(); },
};

// Socket.IO connection
export const createSocketConnection = async (token) => {
  const { io } = await import('socket.io-client');
  // Utilisation de SOCKET_URL exporté en haut du fichier
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
};
