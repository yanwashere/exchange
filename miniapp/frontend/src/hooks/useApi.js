import axios from 'axios'
import { useTelegram } from './useTelegram'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

export function useApi() {
  const { initData } = useTelegram()

  const headers = { 'x-init-data': initData }

  return {
    getRates:      ()           => api.get('/rates').then(r => r.data),
    getMe:         ()           => api.get('/me', { headers }).then(r => r.data),
    getMyOrders:   ()           => api.get('/me/orders', { headers }).then(r => r.data),
    getReferral:   ()           => api.get('/me/referral', { headers }).then(r => r.data),
    createOrder:   (body)       => api.post('/orders', body, { headers }).then(r => r.data),

    // Moderator
    getModOrders:  (status)     => api.get(`/mod/orders?status=${status}`, { headers }).then(r => r.data),
    getModUsers:   (verified)   => api.get(`/mod/users${verified !== undefined ? `?verified=${verified}` : ''}`, { headers }).then(r => r.data),
    getModStats:   ()           => api.get('/mod/stats', { headers }).then(r => r.data),
    closeOrder:    (id)         => api.post(`/mod/orders/${id}/close`, {}, { headers }).then(r => r.data),
    verifyUser:    (id)         => api.post(`/mod/users/${id}/verify`, {}, { headers }).then(r => r.data),
  }
}
