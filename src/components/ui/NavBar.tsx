'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Rol } from '@/types'

interface ItemMenu { href: string; label: string }

function Dropdown({ label, items }: { label: string; items: ItemMenu[] }) {
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
        className="text-sm text-gray-600 hover:text-blue-700 flex items-center gap-1"
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

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href={rol === 'comite' ? '/comite' : '/parcelero'} className="font-bold text-blue-700 text-lg whitespace-nowrap">
            🏘️ COPOSA
          </Link>

          {rol === 'comite' && (
            <>
              <Link href="/comite" className="text-sm text-gray-600 hover:text-blue-700">Dashboard</Link>
              <Dropdown label="⚡ Luz" items={[
                { href: '/comite/periodos', label: 'Períodos' },
                { href: '/comite/lecturas', label: 'Validar lecturas' },
              ]} />
              <Dropdown label="🏘️ Gastos Comunes" items={[
                { href: '/comite/gastos-comunes', label: 'Períodos y config' },
              ]} />
              <Dropdown label="💰 Cobranza" items={[
                { href: '/comite/pagos', label: 'Validar pagos' },
                { href: '/comite/reportes', label: 'Reportes' },
              ]} />
              <Dropdown label="🗓️ Comunidad" items={[
                { href: '/comite/asambleas', label: 'Asambleas y actas' },
                { href: '/comite/registro', label: 'Registro personas/mascotas' },
              ]} />
              <Dropdown label="⚙️ Administración" items={[
                { href: '/comite/parcelas', label: 'Parcelas' },
                { href: '/comite/bitacora', label: 'Bitácora' },
                { href: '/comite/configuracion', label: 'Configuración' },
              ]} />
            </>
          )}

          {rol === 'parcelero' && (
            <Dropdown label="Mi macrolote" items={[
              { href: '/parcelero', label: '⚡ Cuenta de luz' },
              { href: '/parcelero/gastos-comunes', label: '🏘️ Gastos Comunes' },
              { href: '/parcelero/asambleas', label: '🗓️ Asambleas y actas' },
              { href: '/parcelero/documentos', label: '📎 Documentos' },
              { href: '/parcelero/registro', label: '👥 Mi registro' },
            ]} />
          )}
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors whitespace-nowrap"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
