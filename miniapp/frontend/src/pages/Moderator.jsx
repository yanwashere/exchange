import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useTelegram } from '../hooks/useTelegram'

const MODS = [7064365721]

const STATUS_MAP = {
  pending: { label: 'Ожидает',   cls: 'bg-amber-100 text-amber-700' },
  done:    { label: 'Завершена', cls: 'bg-emerald-100 text-emerald-700' },
  cancel:  { label: 'Отменена',  cls: 'bg-red-100 text-red-600' },
}

const TYPE_MAP = {
  rub_to_cny:  '₽ → ¥',
  usdt_to_cny: 'USDT → ¥',
  cny_to_rub:  '¥ → ₽',
}

function StatPill({ icon, label, value, accent }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xl">{icon}</span>
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-syne font-extrabold text-2xl ${accent || 'text-deep'}`}>{value}</p>
    </div>
  )
}

function OrderRow({ order, onClose, closing }) {
  const st  = STATUS_MAP[order.status] || { label: order.status, cls: 'bg-gray-100 text-gray-600' }
  const type = TYPE_MAP[order.exchange_type] || order.exchange_type
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-syne font-bold text-deep">#{order.order_id}</span>
          <span className="ml-2 text-xs text-muted">{type}</span>
        </div>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>

      {order.full_name && (
        <p className="text-sm text-deep font-medium mb-0.5">{order.full_name}</p>
      )}
      <p className="text-xs text-muted mb-2">ID: {order.user_id}{order.phone ? ` · ${order.phone}` : ''}</p>

      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">Сумма</span>
        <span className="font-semibold text-deep">
          {Number(order.amount).toLocaleString('ru-RU')}
          {order.exchange_type === 'rub_to_cny' ? ' ₽' : order.exchange_type === 'usdt_to_cny' ? ' USDT' : ' ¥'}
        </span>
      </div>
      {order.result_cny && (
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted">Получает</span>
          <span className="font-bold text-orange">{Number(order.result_cny).toLocaleString('ru-RU')} ¥</span>
        </div>
      )}

      {order.created_at && (
        <p className="text-xs text-muted/60 mb-3">{new Date(order.created_at).toLocaleString('ru-RU')}</p>
      )}

      {order.status === 'pending' && (
        <button
          className="btn-primary w-full text-sm"
          disabled={closing === order.order_id}
          onClick={() => onClose(order.order_id)}
        >
          {closing === order.order_id ? 'Закрываем…' : '✅ Закрыть заявку'}
        </button>
      )}
    </div>
  )
}

function UserRow({ user, onVerify, verifying }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="font-semibold text-deep text-sm">{user.full_name || '—'}</p>
          <p className="text-xs text-muted">ID: {user.user_id}</p>
        </div>
        <span className={`badge ${user.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {user.is_verified ? '✅ Верифицирован' : '⏳ Ожидает'}
        </span>
      </div>
      {user.phone && <p className="text-xs text-muted mb-2">📱 {user.phone}</p>}
      {user.created_at && (
        <p className="text-xs text-muted/60 mb-3">{new Date(user.created_at).toLocaleString('ru-RU')}</p>
      )}
      {!user.is_verified && (
        <button
          className="btn-primary w-full text-sm"
          disabled={verifying === user.user_id}
          onClick={() => onVerify(user.user_id)}
        >
          {verifying === user.user_id ? 'Верифицируем…' : '🛡️ Верифицировать'}
        </button>
      )}
    </div>
  )
}

export default function Moderator() {
  const { user, haptic } = useTelegram()
  const api = useApi()

  const [tab, setTab]       = useState('orders')
  const [orderStatus, setOrderStatus] = useState('pending')
  const [orders, setOrders] = useState([])
  const [users, setUsers]   = useState([])
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(null)
  const [verifying, setVerifying] = useState(null)

  const isMod = user && MODS.includes(user.id)

  useEffect(() => {
    if (!isMod) return
    api.getModStats().then(setStats).catch(() => {})
  }, [isMod])

  useEffect(() => {
    if (!isMod || tab !== 'orders') return
    setLoading(true)
    api.getModOrders(orderStatus).then(setOrders).finally(() => setLoading(false))
  }, [isMod, tab, orderStatus])

  useEffect(() => {
    if (!isMod || tab !== 'users') return
    setLoading(true)
    api.getModUsers().then(setUsers).finally(() => setLoading(false))
  }, [isMod, tab])

  async function closeOrder(id) {
    haptic('medium')
    setClosing(id)
    try {
      await api.closeOrder(id)
      setOrders(prev => prev.filter(o => o.order_id !== id))
      setStats(prev => prev ? { ...prev, orders_pending: prev.orders_pending - 1, orders_done: prev.orders_done + 1 } : prev)
      haptic('success')
    } catch {
      haptic('error')
    } finally {
      setClosing(null)
    }
  }

  async function verifyUser(uid) {
    haptic('medium')
    setVerifying(uid)
    try {
      await api.verifyUser(uid)
      setUsers(prev => prev.map(u => u.user_id === uid ? { ...u, is_verified: 1 } : u))
      haptic('success')
    } catch {
      haptic('error')
    } finally {
      setVerifying(null)
    }
  }

  if (!isMod) return (
    <div className="min-h-dvh flex items-center justify-center px-6 text-center">
      <div className="card p-8">
        <div className="text-4xl mb-3">🚫</div>
        <p className="font-syne font-bold text-deep text-lg">Доступ запрещён</p>
        <p className="text-muted text-sm mt-2">Эта страница только для модераторов.</p>
      </div>
    </div>
  )

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="font-syne font-extrabold text-2xl text-deep mb-5">🛡️ Панель модератора</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatPill icon="⏳" label="Ожидают обработки" value={stats.orders_pending} accent="text-amber-600" />
          <StatPill icon="✅" label="Завершено заявок"  value={stats.orders_done} accent="text-emerald-600" />
          <StatPill icon="👥" label="Всего пользователей" value={stats.users_total} />
          <StatPill icon="🆔" label="Ожидают верификации" value={stats.users_unverified} accent="text-orange" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[['orders', 'Заявки'], ['users', 'Пользователи']].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${tab === k ? 'bg-deep text-amber-100' : 'bg-white/40 text-muted border border-white/50'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Orders tab */}
      {tab === 'orders' && (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {['pending', 'done'].map(s => (
              <button
                key={s}
                onClick={() => setOrderStatus(s)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all
                  ${orderStatus === s ? 'bg-deep text-amber-100' : 'bg-white/40 text-muted border border-white/50'}`}
              >
                {s === 'pending' ? '⏳ Ожидают' : '✅ Завершённые'}
              </button>
            ))}
          </div>
          {loading
            ? <Spinner />
            : orders.length === 0
              ? <Empty text="Заявок нет" />
              : <div className="space-y-3">{orders.map(o => (
                  <OrderRow key={o.order_id} order={o} onClose={closeOrder} closing={closing} />
                ))}</div>
          }
        </>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <>
          {loading
            ? <Spinner />
            : users.length === 0
              ? <Empty text="Пользователей нет" />
              : <div className="space-y-3">{users.map(u => (
                  <UserRow key={u.user_id} user={u} onVerify={verifyUser} verifying={verifying} />
                ))}</div>
          }
        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 border-4 border-deep/20 border-t-deep rounded-full animate-spin" />
    </div>
  )
}

function Empty({ text }) {
  return (
    <div className="card p-8 text-center text-muted text-sm">{text}</div>
  )
}
