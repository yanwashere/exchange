const tg = window.Telegram?.WebApp

export function useTelegram() {
  const user = tg?.initDataUnsafe?.user || null
  const initData = tg?.initData || ''

  function haptic(style = 'light') {
    tg?.HapticFeedback?.impactOccurred(style)
  }

  function showAlert(msg) {
    tg?.showAlert ? tg.showAlert(msg) : alert(msg)
  }

  function close() {
    tg?.close()
  }

  return { tg, user, initData, haptic, showAlert, close }
}
