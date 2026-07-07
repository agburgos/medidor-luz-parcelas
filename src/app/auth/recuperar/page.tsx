'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/bienvenida`,
    })
    if (error) {
      setError('No se pudo enviar el correo. Verifica el email o intenta más tarde.')
      setLoading(false)
      return
    }
    setEnviado(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">🔑 Recuperar contraseña</h1>
          <p className="text-gray-500 text-sm mt-1">Te enviaremos un enlace para crear una nueva</p>
        </div>

        {enviado ? (
          <div className="text-center space-y-4">
            <p className="text-sm bg-green-50 text-green-800 rounded-lg p-3">
              ✅ Si el correo <strong>{email}</strong> está registrado, recibirás un enlace
              para restablecer tu contraseña. Revisa también la carpeta de spam.
            </p>
            <Link href="/login" className="text-blue-600 hover:underline text-sm">← Volver al inicio de sesión</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tu@correo.cl"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
            <p className="text-center">
              <Link href="/login" className="text-gray-500 hover:text-gray-700 text-sm">← Volver</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
