import axios from 'axios';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000/api';

export async function signup(name, email, password) {
  if (!name || !email || !password) throw new Error('Missing signup parameters');
  const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password });
  return res.data;
}

export async function login(email, password) {
  if (!email || !password) throw new Error('Missing login parameters');
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  return res.data;
}

export async function getMe(token) {
  if (!token) throw new Error('Token required');
  const res = await axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
