'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BienvenidaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sesionOk, setSesionOk] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    // El link de invitación trae tokens en el hash; el cliente los procesa automáticamente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesionOk(!!session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSesionOk(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/parcelero')
  }

  if (sesionOk === null) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Verificando invitación...</div>
  }

  if (!sesionOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm text-center">
          <h1 className="text-xl font-bold mb-2">Enlace inválido o expirado</h1>
          <p className="text-gray-500 text-sm">Pide al comité que te envíe una nueva invitación.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">⚡ Bienvenido</h1>
          <p className="text-gray-500 text-sm mt-1">Crea tu contraseña para acceder a tu cuenta</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repite la contraseña</label>
            <input
              type="password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Guardando...' : 'Crear contraseña y entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
