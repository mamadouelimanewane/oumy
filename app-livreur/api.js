import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const DEFAULT_API_URL = 'http://localhost:5000/api';
const PROD_API_URL = 'https://oumy-orpin.vercel.app/api';

export const API_URL = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
  ? (window.location.origin.includes('vercel.app') ? window.location.origin + '/api' : PROD_API_URL)
  : DEFAULT_API_URL;
export const SOCKET_URL = API_URL.replace(/\/api$/, '');

export const TOKEN_KEY = 'livreur_token';
export const USER_KEY = 'livreur_user';

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  login: async (phone, password) => {
    const res = await client.post('/auth/login', { phone, password });
    return res.data;
  },
};

export const livreurAPI = {
  getCurrentOrders: async () => (await client.get('/livreur/orders/current')).data,
  getStats: async () => (await client.get('/livreur/stats')).data,
  acceptOrder: async (id) => (await client.post(`/livreur/orders/${id}/accept`)).data,
  completeOrder: async (id) => (await client.post(`/livreur/orders/${id}/complete`)).data,
};

export const tipsAPI = {
  getMine: async () => (await client.get('/tips/courier')).data,
};

export default client;
