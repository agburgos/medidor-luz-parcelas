'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'ingresar' | 'registrar'>('ingresar')

  // Ingresar
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Registrar
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleIngresar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }
    router.refresh()
    router.push('/')
  }

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (regPassword !== regPassword2) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (regPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail, password: regPassword }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    // Cuenta creada — entra directo
    const supabase = createClient()
    const { error: errIngreso } = await supabase.auth.signInWithPassword({ email: regEmail, password: regPassword })
    setLoading(false)

    if (errIngreso) {
      setMensaje('✅ Cuenta creada. Ya puedes iniciar sesión.')
      setModo('ingresar')
      setEmail(regEmail)
      return
    }
    router.refresh()
    router.push('/')
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Fondo: bosque, con velo oscuro para que el formulario respire */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: "url('/login-bosque.jpg')" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,26,14,0.55) 0%, rgba(10,26,14,0.72) 55%, rgba(10,26,14,0.85) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white drop-shadow-sm">🏘️ Macrolote COPOSA</h1>
          <p className="text-emerald-100/90 text-sm mt-1">Luz · Gastos Comunes · Asambleas · Registro</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-7">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setModo('ingresar'); setError(''); setMensaje('') }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${modo === 'ingresar' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setModo('registrar'); setError(''); setMensaje('') }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${modo === 'registrar' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Registrarme
            </button>
          </div>

          {mensaje && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2.5 mb-4">{mensaje}</p>}

          {modo === 'ingresar' ? (
            <form onSubmit={handleIngresar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="tu@correo.cl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
              <p className="text-center">
                <a href="/auth/recuperar" className="text-sm text-emerald-700 hover:underline">¿Olvidaste tu contraseña?</a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegistrar} className="space-y-4">
              <p className="text-xs text-gray-500 -mt-1 mb-1">
                Usa el mismo correo que el comité ya registró para tu parcela.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="tu@correo.cl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Crea una contraseña</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirma la contraseña</label>
                <input
                  type="password"
                  value={regPassword2}
                  onChange={e => setRegPassword2(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
