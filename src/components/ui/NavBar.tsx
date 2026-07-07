'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Rol } from '@/types'

interface ItemMenu { href: string; label: string }
interface Grupo { label: string; items: ItemMenu[] }

const GRUPOS_COMITE: Grupo[] = [
  { label: '⚡ Luz', items: [
    { href: '/comite/periodos', label: 'Períodos' },
    { href: '/comite/lecturas', label: 'Validar lecturas' },
  ]},
  { label: '🏘️ Gastos Comunes', items: [
    { href: '/comite/gastos-comunes', label: 'Períodos y config' },
  ]},
  { label: '💰 Cobranza', items: [
    { href: '/comite/pagos', label: 'Validar pagos' },
    { href: '/comite/reportes', label: 'Reportes' },
  ]},
  { label: '🗓️ Comunidad', items: [
    { href: '/comite/asambleas', label: 'Asambleas y actas' },
    { href: '/comite/anuncios', label: 'Anuncios' },
    { href: '/comite/registro', label: 'Registro personas/mascotas' },
  ]},
  { label: '⚙️ Administración', items: [
    { href: '/comite/parcelas', label: 'Parcelas' },
    { href: '/comite/bitacora', label: 'Bitácora' },
    { href: '/comite/configuracion', label: 'Configuración' },
  ]},
]

const GRUPOS_PARCELERO: Grupo[] = [
  { label: 'Mi macrolote', items: [
    { href: '/parcelero', label: '⚡ Cuenta de luz' },
    { href: '/parcelero/gastos-comunes', label: '🏘️ Gastos Comunes' },
    { href: '/parcelero/asambleas', label: '🗓️ Asambleas y actas' },
    { href: '/parcelero/documentos', label: '📎 Documentos' },
    { href: '/parcelero/registro', label: '👥 Mi registro' },
  ]},
]

function Dropdown({ label, items }: Grupo) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('click', onClickFuera)
    return () => document.removeEventListener('click', onClickFuera)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(a => !a)}
        className="text-sm text-gray-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap"
      >
        {label}
        <span className={`text-xs transition-transform ${abierto ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {abierto && (
        <div className="absolute left-0 top-full mt-2 bg-white border rounded-lg shadow-lg py-1 min-w-44 z-50">
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-700 whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NavBar({ rol }: { rol: Rol }) {
  const router = useRouter()
  const [menuMovil, setMenuMovil] = useState(false)
  const grupos = rol === 'comite' ? GRUPOS_COMITE : GRUPOS_PARCELERO

  useEffect(() => {
    document.body.style.overflow = menuMovil ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuMovil])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 relative z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href={rol === 'comite' ? '/comite' : '/parcelero'} className="font-bold text-blue-700 text-lg whitespace-nowrap">
            🏘️ COPOSA
          </Link>

          {/* Desktop: dropdowns en línea */}
          <div className="hidden md:flex items-center gap-5">
            {rol === 'comite' && <Link href="/comite" className="text-sm text-gray-600 hover:text-blue-700">Dashboard</Link>}
            {grupos.map(g => <Dropdown key={g.label} label={g.label} items={g.items} />)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={logout}
            className="hidden md:block text-sm text-gray-500 hover:text-red-600 transition-colors whitespace-nowrap"
          >
            Cerrar sesión
          </button>
          {/* Mobile: botón hamburguesa */}
          <button
            onClick={() => setMenuMovil(m => !m)}
            className="md:hidden p-2 text-gray-600 hover:text-blue-700"
            aria-label="Abrir menú"
          >
            {menuMovil ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile: menú desplegado completo, fijo sobre toda la pantalla */}
      {menuMovil && (
        <div
          className="md:hidden fixed inset-0 top-[57px] bg-black/30 z-50"
          onClick={() => setMenuMovil(false)}
        >
          <div
            className="bg-white border-b shadow-lg max-h-[calc(100vh-57px)] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
          {rol === 'comite' && (
            <Link href="/comite" onClick={() => setMenuMovil(false)} className="block px-4 py-3 text-sm font-medium text-gray-700 border-b hover:bg-gray-50">
              Dashboard
            </Link>
          )}
          {grupos.map(g => (
            <div key={g.label} className="border-b">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">{g.label}</p>
              {g.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuMovil(false)}
                  className="block px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-700"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
            <button
              onClick={logout}
              className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
