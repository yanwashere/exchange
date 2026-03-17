import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useTelegram } from '../hooks/useTelegram'

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

function Avatar({ user }) {
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('') || '?'
  return (
    <div className="w-16 h-16 rounded-2xl bg-deep flex items-center justify-center
                    text-amber-100 font-syne font-bold text-2xl shadow-lg">
      {initials}
    </div>
  )
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-syne font-bold text-lg text-deep leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted/70">{sub}</p>}
      </div>
    </div>
  )
}

function OrderCard({ order }) {
  const st = STATUS_MAP[order.status] || { label: order.status, cls: 'bg-gray-100 text-gray-600' }
  const type = TYPE_MAP[order.exchange_type] || order.exchange_type
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-syne font-bold text-deep text-sm">#{order.order_id}</span>
          <span className="ml-2 text-xs text-muted">{type}</span>
        </div>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Сумма</span>
        <span className="font-semibold text-deep">
          {Number(order.amount).toLocaleString('ru-RU')}
          {order.exchange_type === 'rub_to_cny' ? ' ₽' : order.exchange_type === 'usdt_to_cny' ? ' USDT' : ' ¥'}
        </span>
      </div>
      {order.result_cny && (
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted">Получает</span>
          <span className="font-bold text-orange">{Number(order.result_cny).toLocaleString('ru-RU')} ¥</span>
        </div>
      )}
      {order.created_at && (
        <p className="text-xs text-muted/60 mt-2">{new Date(order.created_at).toLocaleString('ru-RU')}</p>
      )}
    </div>
  )
}

export default function Cabinet() {
  const { user, showAlert } = useTelegram()
  const api = useApi()

  const [me, setMe]         = useState(null)
  const [orders, setOrders] = useState([])
  const [ref, setRef]       = useState(null)
  const [tab, setTab]       = useState('orders')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    Promise.all([
      api.getMe().catch(() => null),
      api.getMyOrders().catch(() => []),
      api.getReferral().catch(() => null),
    ]).then(([me, orders, ref]) => {
      setMe(me)
      setOrders(orders)
      setRef(ref)
      setLoading(false)
    })
  }, [])

  function copyRef() {
    const link = `https://t.me/YOUR_BOT?start=${user?.id}`
    navigator.clipboard?.writeText(link)
    showAlert('Реферальная ссылка скопирована!')
  }

  if (!user) return (
    <div className="min-h-dvh flex items-center justify-center px-6 text-center">
      <div className="card p-8">
        <div className="text-4xl mb-3">🔒</div>
        <p className="font-syne font-bold text-deep text-lg mb-2">Откройте через Telegram</p>
        <p className="text-muted text-sm">Личный кабинет доступен только внутри Telegram Mini App.</p>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-deep/20 border-t-deep rounded-full animate-spin" />
        <p className="text-sm text-muted">Загрузка…</p>
      </div>
    </div>
  )

  const verif = me?.is_verified === 1
  const doneOrders = orders.filter(o => o.status === 'done').length

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Profile block */}
      <div className="card p-5 mb-5 flex items-center gap-4">
        <Avatar user={user} />
        <div className="flex-1 min-w-0">
          <h2 className="font-syne font-bold text-xl text-deep truncate">
            {user.first_name} {user.last_name || ''}
          </h2>
          {me?.full_name && <p className="text-sm text-muted truncate">{me.full_name}</p>}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`badge ${verif ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {verif ? '✅ Верифицирован' : '⏳ Не верифицирован'}
            </span>
            {me?.is_vip === 1 && (
              <span className="badge bg-purple-100 text-purple-700">⭐ VIP</span>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard icon="💰" label="Бонусный баланс" value={`${me?.bonus_balance || 0} ₽`} sub="до 30% от обмена" />
        <StatCard icon="📦" label="Завершено заявок" value={doneOrders} sub={`Всего: ${orders.length}`} />
        <StatCard icon="👥" label="Рефералов" value={ref?.referral_count || 0} sub="+80 ₽ за каждого" />
        {me?.phone && (
          <StatCard icon="📱" label="Телефон" value={me.phone} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[['orders', 'Заявки'], ['referral', 'Реферал']].map(([k, l]) => (
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
        <div className="space-y-3">
          {orders.length === 0
            ? <div className="card p-8 text-center text-muted">Заявок пока нет</div>
            : orders.map(o => <OrderCard key={o.order_id} order={o} />)
          }
        </div>
      )}

      {/* Referral tab */}
      {tab === 'referral' && (
        <div className="space-y-3">
          <div className="card p-5">
            <h3 className="font-syne font-bold text-deep text-lg mb-2">Реферальная программа</h3>
            <p className="text-sm text-muted mb-4">
              Приглашайте друзей и получайте <span className="text-deep font-bold">+80 бонусных рублей</span> за каждую завершённую заявку реферала.
            </p>
            <div className="bg-deep/10 rounded-xl p-4 mb-4">
              <p className="text-xs text-muted mb-1">Ваших рефералов</p>
              <p className="font-syne font-extrabold text-4xl text-deep">{ref?.referral_count || 0}</p>
            </div>
            <div className="bg-amber-50/60 rounded-xl p-4 mb-4">
              <p className="text-xs text-muted mb-1">Бонусный баланс</p>
              <p className="font-syne font-extrabold text-4xl text-orange">{ref?.bonus_balance || 0} ₽</p>
            </div>
            <button className="btn-primary w-full" onClick={copyRef}>
              📋 Скопировать реферальную ссылку
            </button>
          </div>
          <div className="card p-4 text-xs text-muted leading-relaxed">
            Бонусы можно использовать для скидки до 30% от суммы обмена. Бонусы начисляются после завершения заявки вашего реферала.
          </div>
        </div>
      )}
    </div>
  )
}
