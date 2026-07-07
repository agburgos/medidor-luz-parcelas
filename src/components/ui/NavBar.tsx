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
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href={rol === 'comite' ? '/comite' : '/parcelero'} className="font-bold text-blue-700 text-lg">
          ⚡ COPOSA
        </Link>
        {rol === 'comite' && (
          <>
            <Link href="/comite" className="text-sm text-gray-600 hover:text-blue-700">Dashboard</Link>
            <Link href="/comite/periodos" className="text-sm text-gray-600 hover:text-blue-700">Períodos</Link>
            <Link href="/comite/parcelas" className="text-sm text-gray-600 hover:text-blue-700">Parcelas</Link>
            <Link href="/comite/lecturas" className="text-sm text-gray-600 hover:text-blue-700">Validar lecturas</Link>
            <Link href="/comite/pagos" className="text-sm text-gray-600 hover:text-blue-700">Validar pagos</Link>
            <Link href="/comite/reportes" className="text-sm text-gray-600 hover:text-blue-700">Reportes</Link>
            <Link href="/comite/registro" className="text-sm text-gray-600 hover:text-blue-700">Registro</Link>
            <Link href="/comite/configuracion" className="text-sm text-gray-600 hover:text-blue-700">Configuración</Link>
          </>
        )}
        {rol === 'parcelero' && (
          <>
            <Link href="/parcelero" className="text-sm text-gray-600 hover:text-blue-700">Mi cuenta</Link>
            <Link href="/parcelero/registro" className="text-sm text-gray-600 hover:text-blue-700">Mi registro</Link>
          </>
        )}
      </div>
      <button
        onClick={logout}
        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
      >
        Cerrar sesión
      </button>
    </nav>
  )
}
