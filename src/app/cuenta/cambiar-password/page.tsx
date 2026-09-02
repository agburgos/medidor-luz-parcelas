'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: errUpdate } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (errUpdate) {
      setError(errUpdate.message)
      return
    }
    setMensaje('✅ Contraseña actualizada correctamente')
    setPassword('')
    setPassword2('')
  }

  return (
    <div className="max-w-sm mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">🔑 Cambiar contraseña</h1>
      <p className="text-gray-500 text-sm mb-6">Define una nueva contraseña para tu cuenta.</p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded-xl p-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirma la contraseña</label>
          <input
            type="password"
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            required
            minLength={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {mensaje && <p className="text-emerald-700 text-sm">{mensaje}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
        >
          Volver
        </button>
      </form>
    </div>
  )
}
