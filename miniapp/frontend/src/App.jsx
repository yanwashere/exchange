import React, { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Calculator from './pages/Calculator'
import Cabinet from './pages/Cabinet'
import Moderator from './pages/Moderator'
import { useTelegram } from './hooks/useTelegram'

const MODS = [7064365721]

function NavBar() {
  const { user } = useTelegram()
  const isMod = user && MODS.includes(user.id)
  const loc = useLocation()

  const link = (to, label, icon) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 text-xs font-medium transition-colors
         ${isActive ? 'text-deep' : 'text-muted/70'}`
      }
    >
      <span className="text-xl leading-none">{icon}</span>
      {label}
    </NavLink>
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50
                    bg-white/40 backdrop-blur-xl border-t border-white/40
                    flex justify-around items-center px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      {link('/', 'Обмен', '💱')}
      {link('/cabinet', 'Кабинет', '👤')}
      {isMod && link('/mod', 'Модератор', '🛡️')}
    </nav>
  )
}

export default function App() {
  return (
    <div className="min-h-dvh pb-20">
      <Routes>
        <Route path="/"        element={<Calculator />} />
        <Route path="/cabinet" element={<Cabinet />} />
        <Route path="/mod"     element={<Moderator />} />
      </Routes>
      <NavBar />
    </div>
  )
}
