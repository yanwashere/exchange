import React, { useState, useEffect, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import { useTelegram } from '../hooks/useTelegram'

function correctRound(n) {
  const r = Math.round(n)
  return (Math.round(n * 100) / 100) - r > 0.5 ? r + 1 : r
}

function WorkBadge({ wt }) {
  if (!wt) return null
  const pad = h => String(h).padStart(2, '0')
  const toMsk = h => (h - 5 + 24) % 24
  const now = new Date()
  const bjH = (now.getUTCHours() + 8) % 24
  const bjM = bjH * 60 + now.getUTCMinutes()
  const isAllDay = wt.start_h === 0 && wt.end_h === 23
  const isOpen = isAllDay || (bjM >= wt.start_h * 60 && bjM <= wt.end_h * 60 + 60)
  const label = isAllDay ? 'Круглосуточно' : `${pad(wt.start_h)}:00–${pad(wt.end_h)}:00 Пекин / ${pad(toMsk(wt.start_h))}:00–${pad(toMsk(wt.end_h))}:00 МСК`

  return (
    <span className={`badge ${isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
      {isOpen ? 'Открыто' : 'Закрыто'} · {label}
    </span>
  )
}

export default function Calculator() {
  const api = useApi()
  const { user, haptic, showAlert } = useTelegram()

  const [rates, setRates]       = useState(null)
  const [from, setFrom]         = useState('RUB')
  const [amount, setAmount]     = useState('')
  const [bonus, setBonus]       = useState(0)
  const [useBonus, setUseBonus] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)

  useEffect(() => {
    api.getRates().then(setRates)
    const id = setInterval(() => api.getRates().then(setRates), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (user) {
      api.getReferral().then(d => setBonus(d.bonus_balance || 0)).catch(() => {})
    }
  }, [user])

  const cny = useCallback(() => {
    if (!rates || !amount) return null
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) return null
    let raw = from === 'RUB' ? n / rates.rub : from === 'USDT' ? n * rates.usdt_cny : n
    if (useBonus && bonus > 0) {
      const maxDiscount = raw * 0.3
      const bonusDiscount = Math.min(bonus / rates.rub, maxDiscount)
      raw -= bonusDiscount
    }
    return correctRound(raw)
  }, [rates, amount, from, useBonus, bonus])

  const result_cny = cny()

  async function handleOrder() {
    if (!user) { showAlert('Откройте через Telegram'); return }
    if (!result_cny || result_cny <= 0) return
    haptic('medium')
    setLoading(true)
    try {
      const data = await api.createOrder({
        exchange_type: from === 'RUB' ? 'rub_to_cny' : from === 'USDT' ? 'usdt_to_cny' : 'cny_to_rub',
        amount: parseFloat(amount),
        used_bonus: useBonus ? Math.min(bonus, parseFloat(amount) * 0.3) : 0,
      })
      setResult(data)
      haptic('success')
    } catch (e) {
      showAlert(e?.response?.data?.detail || 'Ошибка при создании заявки')
      haptic('error')
    } finally {
      setLoading(false)
    }
  }

  if (result) return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="card p-7 text-center max-w-sm w-full">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="font-syne text-2xl font-bold text-deep mb-2">Заявка создана!</h2>
        <p className="text-muted text-sm mb-5">Менеджер скоро свяжется с вами в боте.</p>
        <div className="bg-white/60 rounded-xl p-4 mb-5 text-left space-y-2">
          <Row label="№ заявки" value={`#${result.order_id}`} />
          <Row label="Получите" value={`${result.result_cny.toLocaleString('ru-RU')} ¥`} bold />
          <Row label="Статус" value="Ожидает обработки" />
        </div>
        <button className="btn-primary w-full" onClick={() => { setResult(null); setAmount('') }}>
          Новая заявка
        </button>
      </div>
    </div>
  )

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-syne text-3xl font-extrabold text-deep tracking-tight">RY<span className="text-orange">Exchange</span></h1>
        <p className="text-muted text-sm mt-1">Обменник рублей и USDT на юани</p>
      </div>

      {/* Work status */}
      <div className="mb-4">
        <WorkBadge wt={rates?.work_time} />
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: '1 ¥ = ? ₽', value: rates ? `${rates.rub.toFixed(2)} ₽` : '…', icon: '🇨🇳' },
          { label: '1 USDT = ? ¥', value: rates ? `${rates.usdt_cny.toFixed(2)} ¥` : '…', icon: '💵' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-xs text-muted mb-0.5">{c.label}</div>
            <div className="font-syne font-bold text-xl text-deep">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Calculator card */}
      <div className="card p-5 mb-4">
        <h2 className="font-syne font-bold text-lg text-deep mb-4">Калькулятор</h2>

        {/* Currency selector */}
        <div className="flex gap-2 mb-4">
          {['RUB', 'USDT'].map(cur => (
            <button
              key={cur}
              onClick={() => { setFrom(cur); setAmount('') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${from === cur
                  ? 'bg-deep text-amber-100 shadow-md'
                  : 'bg-white/40 text-muted border border-white/50'}`}
            >
              {cur === 'RUB' ? '₽ Рубли' : '💵 USDT'}
            </button>
          ))}
        </div>

        <div className="relative mb-3">
          <input
            className="input pr-16"
            type="number"
            inputMode="decimal"
            placeholder={from === 'RUB' ? 'Сумма в рублях' : 'Сумма в USDT'}
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-semibold text-sm">
            {from === 'RUB' ? '₽' : 'USDT'}
          </span>
        </div>

        {/* Limits */}
        {rates && (
          <p className="text-xs text-muted/80 mb-4">
            Мин: {rates.min_amount.toLocaleString('ru-RU')} ¥ (~{correctRound(rates.min_amount * rates.rub).toLocaleString('ru-RU')} ₽)
            &nbsp;·&nbsp;
            Макс: {rates.max_amount.toLocaleString('ru-RU')} ¥ (~{correctRound(rates.max_amount * rates.rub).toLocaleString('ru-RU')} ₽)
          </p>
        )}

        {/* Bonus toggle */}
        {bonus > 0 && (
          <label className="flex items-center gap-3 mb-4 cursor-pointer select-none">
            <div
              onClick={() => setUseBonus(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${useBonus ? 'bg-deep' : 'bg-white/50 border border-white/60'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${useBonus ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-deep font-medium">
              Использовать бонусы <span className="text-orange font-bold">{bonus} ₽</span>
            </span>
          </label>
        )}

        {/* Result */}
        <div className={`rounded-xl p-4 mb-4 transition-all ${result_cny ? 'bg-deep/10' : 'bg-white/30'}`}>
          <p className="text-xs text-muted mb-1">Получите юаней</p>
          <p className="font-syne font-extrabold text-3xl text-deep">
            {result_cny ? `${result_cny.toLocaleString('ru-RU')} ¥` : '—'}
          </p>
        </div>

        <button
          className="btn-primary w-full text-base"
          disabled={!result_cny || loading}
          onClick={handleOrder}
        >
          {loading ? 'Создаём заявку…' : 'Создать заявку →'}
        </button>
      </div>

      {/* Note */}
      <p className="text-xs text-center text-muted/70 px-4">
        После создания заявки менеджер свяжется с вами через Telegram-бота.
      </p>
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={`text-deep ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  )
}
