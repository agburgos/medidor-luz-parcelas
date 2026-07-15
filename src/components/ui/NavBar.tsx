'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Notificaciones from '@/components/ui/Notificaciones'
import { Rol } from '@/types'

interface ItemMenu { href: string; label: string }
interface Grupo { label: string; items: ItemMenu[] }

const GRUPOS_COMITE: Grupo[] = [
  { label: '🚨 Incidencias', items: [
    { href: '/comite/incidencias', label: '🚨 Ver incidencias' },
  ]},
  { label: '⚡ Luz', items: [
    { href: '/comite/periodos', label: '🗓️ Períodos' },
    { href: '/comite/lecturas', label: '📸 Validar lecturas' },
    { href: '/comite/consumo-historico', label: '📊 Consumo Histórico' },
  ]},
  { label: '🏘️ Gasto Común COPOSA', items: [
    { href: '/comite/gastos-comunes', label: '🏘️ Períodos y config' },
  ]},
  { label: '💰 Cobranza', items: [
    { href: '/comite/pagos', label: '💳 Validar pagos' },
    { href: '/comite/reportes', label: '📊 Reportes' },
  ]},
  { label: '🏦 Caja y Tesorería', items: [
    { href: '/comite/caja', label: '🏦 Caja' },
    { href: '/comite/caja/libro-contable', label: '📊 Libro Contable' },
    { href: '/comite/estados-cuenta', label: '📋 Estados de cuenta' },
  ]},
  { label: '🗓️ Comunidad', items: [
    { href: '/comite/votaciones', label: '🗳️ Votaciones' },
    { href: '/comite/mensajes', label: '💬 Mensajería vecinal' },
    { href: '/comite/asambleas', label: '🗓️ Asambleas y actas' },
    { href: '/comite/anuncios', label: '📢 Anuncios' },
    { href: '/comite/documentos', label: '📎 Documentos' },
    { href: '/comite/informacion', label: 'ℹ️ Información fija' },
    { href: '/comite/registro', label: '👥 Registro personas/mascotas' },
  ]},
  { label: '⚙️ Administración', items: [
    { href: '/comite/parcelas', label: '🏡 Parcelas' },
    { href: '/comite/bitacora', label: '🕒 Bitácora' },
    { href: '/comite/configuracion', label: '⚙️ Configuración' },
    { href: '/comite/boveda', label: '🔐 Bóveda de Claves' },
  ]},
]

const GRUPOS_PARCELERO: Grupo[] = [
  { label: 'Mi macrolote', items: [
    { href: '/parcelero', label: '🏠 Inicio' },
    { href: '/parcelero/luz', label: '⚡ Cuenta de luz' },
    { href: '/parcelero/gastos-comunes', label: '🏘️ Gasto Común COPOSA' },
  ]},
  { label: '🏦 Caja y Tesorería', items: [
    { href: '/parcelero/caja', label: '🏦 Caja' },
    { href: '/parcelero/caja/libro-contable', label: '📊 Libro Contable' },
    { href: '/parcelero/estados-cuenta', label: '📋 Estados de cuenta' },
  ]},
  { label: '🗳️ Comunidad', items: [
    { href: '/parcelero/incidencias', label: '🚨 Mis incidencias' },
    { href: '/parcelero/votaciones', label: '🗳️ Votaciones' },
    { href: '/parcelero/mensajes', label: '💬 Mensajería con el comité' },
    { href: '/parcelero/asambleas', label: '🗓️ Asambleas y actas' },
    { href: '/parcelero/documentos', label: '📎 Documentos' },
    { href: '/parcelero/informacion', label: 'ℹ️ Información' },
    { href: '/parcelero/registro', label: '👥 Mi registro' },
    { href: '/parcelero/ayuda', label: '❓ Ayuda y FAQ' },
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

export default function NavBar({
  rol,
  tieneParcelaPropia = false,
  esComiteViendoSuParcela = false,
  esSuperadmin = false,
  suplantando = null,
}: {
  rol: Rol
  tieneParcelaPropia?: boolean
  esComiteViendoSuParcela?: boolean
  esSuperadmin?: boolean
  suplantando?: { parcelaId: string; numero: number; nombreDueno: string } | null
}) {
  const router = useRouter()
  const [menuMovil, setMenuMovil] = useState(false)
  const [saliendo, setSaliendo] = useState(false)

  async function salirSuplantacion() {
    setSaliendo(true)
    await fetch('/api/comite/suplantar', { method: 'DELETE' })
    router.push('/comite/parcelas')
    router.refresh()
  }
  const grupos = rol === 'comite'
    ? (esSuperadmin
        ? [...GRUPOS_COMITE, { label: '🔐 Superadmin', items: [{ href: '/comite/superadmin', label: 'Usuarios y contraseñas' }] }]
        : GRUPOS_COMITE)
    : GRUPOS_PARCELERO

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
      {suplantando && (
        <div className="-mx-4 -mt-3 mb-3 px-4 py-2 bg-purple-600 text-white text-sm flex items-center justify-between flex-wrap gap-2">
          <span>👤 Viendo como <strong>Parcela #{suplantando.numero}</strong> — {suplantando.nombreDueno}</span>
          <button
            onClick={salirSuplantacion}
            disabled={saliendo}
            className="bg-white text-purple-700 rounded-lg px-3 py-1 text-xs font-medium hover:bg-purple-50 disabled:opacity-50"
          >
            {saliendo ? 'Saliendo...' : '🔚 Salir de suplantación'}
          </button>
        </div>
      )}
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
          <Notificaciones />
          {rol === 'comite' && tieneParcelaPropia && (
            <Link
              href="/parcelero"
              className="hidden md:inline-block text-sm bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 font-medium hover:bg-blue-100 whitespace-nowrap"
            >
              🏠 Ver mi parcela
            </Link>
          )}
          {rol === 'parcelero' && esComiteViendoSuParcela && !suplantando && (
            <Link
              href="/comite"
              className="hidden md:inline-block text-sm bg-purple-50 text-purple-700 rounded-lg px-3 py-1.5 font-medium hover:bg-purple-100 whitespace-nowrap"
            >
              ← Volver al panel comité
            </Link>
          )}
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
          {rol === 'comite' && tieneParcelaPropia && (
            <Link href="/parcelero" onClick={() => setMenuMovil(false)} className="block px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 border-b hover:bg-blue-100">
              🏠 Ver mi parcela
            </Link>
          )}
          {rol === 'parcelero' && esComiteViendoSuParcela && (
            <Link href="/comite" onClick={() => setMenuMovil(false)} className="block px-4 py-3 text-sm font-medium text-purple-700 bg-purple-50 border-b hover:bg-purple-100">
              ← Volver al panel comité
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
