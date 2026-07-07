'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Rol } from '@/types'

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
        <div className="flex items-center gap-5 flex-wrap">
          <Link href={rol === 'comite' ? '/comite' : '/parcelero'} className="font-bold text-blue-700 text-lg whitespace-nowrap">
            🏘️ COPOSA
          </Link>

          {rol === 'comite' && (
            <>
              <Link href="/comite" className="text-sm text-gray-600 hover:text-blue-700">Dashboard</Link>

              <span className="text-xs text-gray-400 hidden lg:inline">⚡ Luz:</span>
              <Link href="/comite/periodos" className="text-sm text-gray-600 hover:text-blue-700">Períodos</Link>
              <Link href="/comite/lecturas" className="text-sm text-gray-600 hover:text-blue-700">Lecturas</Link>

              <span className="text-xs text-gray-400 hidden lg:inline">🏘️ GC:</span>
              <Link href="/comite/gastos-comunes" className="text-sm text-gray-600 hover:text-blue-700">Gastos Comunes</Link>

              <Link href="/comite/pagos" className="text-sm text-gray-600 hover:text-blue-700">Validar pagos</Link>
              <Link href="/comite/asambleas" className="text-sm text-gray-600 hover:text-blue-700">Asambleas</Link>
              <Link href="/comite/reportes" className="text-sm text-gray-600 hover:text-blue-700">Reportes</Link>
              <Link href="/comite/parcelas" className="text-sm text-gray-600 hover:text-blue-700">Parcelas</Link>
              <Link href="/comite/registro" className="text-sm text-gray-600 hover:text-blue-700">Registro</Link>
              <Link href="/comite/bitacora" className="text-sm text-gray-600 hover:text-blue-700">Bitácora</Link>
              <Link href="/comite/configuracion" className="text-sm text-gray-600 hover:text-blue-700">Config</Link>
            </>
          )}

          {rol === 'parcelero' && (
            <>
              <Link href="/parcelero" className="text-sm text-gray-600 hover:text-blue-700">Mi cuenta luz</Link>
              <Link href="/parcelero/gastos-comunes" className="text-sm text-gray-600 hover:text-blue-700">Gastos Comunes</Link>
              <Link href="/parcelero/registro" className="text-sm text-gray-600 hover:text-blue-700">Mi registro</Link>
              <Link href="/parcelero/documentos" className="text-sm text-gray-600 hover:text-blue-700">Documentos</Link>
            </>
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
