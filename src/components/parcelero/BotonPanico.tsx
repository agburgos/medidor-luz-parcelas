'use client'

import { useState, useEffect, useCallback } from 'react'

interface IncidenciaActiva {
  id: string
  categoria: string
  estado: string
  fecha_activacion: string
}

interface ResultadoNoti {
  modo_pruebas: boolean
  email_parceleros: number
  whatsapp_parceleros: number
  email_porteria: boolean
  whatsapp_porteria: boolean
  whatsapp_disponible: boolean
}

const CATEGORIAS = [
  { valor: 'intruso', label: '🔴 Intruso / Robo' },
  { valor: 'emergencia_medica', label: '🏥 Emergencia médica' },
  { valor: 'incendio', label: '🔥 Incendio / Gas' },
  { valor: 'otro', label: '⚠️ Otro' },
]

function obtenerUbicacion(): Promise<{ latitud: number | null; longitud: number | null }> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ latitud: null, longitud: null })
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
      () => resolve({ latitud: null, longitud: null }),
      { timeout: 5000, maximumAge: 0 }
    )
  })
}

export default function BotonPanico() {
  const [activas, setActivas] = useState<IncidenciaActiva[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [paso, setPaso] = useState<'categoria' | 'confirmar' | 'enviando' | 'resultado'>('categoria')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [resultado, setResultado] = useState<ResultadoNoti | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [error, setError] = useState('')

  const cargarActivas = useCallback(async () => {
    const res = await fetch('/api/incidencias?estado=activa&propia=1')
    const data = await res.json()
    setActivas(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { cargarActivas() }, [cargarActivas])

  function abrirModal() {
    setPaso('categoria')
    setCategoria(null)
    setDescripcion('')
    setError('')
    setModalAbierto(true)
  }

  function elegirCategoria(c: string) {
    setCategoria(c)
    setPaso('confirmar')
  }

  async function confirmarEnvio() {
    setPaso('enviando')
    setError('')
    const { latitud, longitud } = await obtenerUbicacion()

    const res = await fetch('/api/incidencias/activar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria, descripcion: descripcion.trim() || null, latitud, longitud }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al enviar la alerta')
      setPaso('confirmar')
      return
    }

    setResultado(data.notificaciones)
    setPaso('resultado')
    cargarActivas()
  }

  async function cancelar(id: string) {
    setCancelando(id)
    await fetch(`/api/incidencias/${id}/cancelar`, { method: 'POST' })
    setCancelando(null)
    setModalAbierto(false)
    cargarActivas()
  }

  return (
    <>
      {/* Banner de incidencias activas propias */}
      {activas.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">
              🚨 Tienes {activas.length} alerta{activas.length !== 1 ? 's' : ''} de pánico activa{activas.length !== 1 ? 's' : ''}
              {' — '}{new Date(activas[0].fecha_activacion).toLocaleTimeString('es-CL')}
            </span>
            <button
              onClick={() => cancelar(activas[0].id)}
              disabled={cancelando === activas[0].id}
              className="bg-white text-red-700 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-red-50 disabled:opacity-50"
            >
              {cancelando === activas[0].id ? 'Cancelando...' : '❌ Fue un error — Falsa alarma'}
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={abrirModal}
        className="fixed bottom-6 right-6 z-40 bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 shadow-2xl flex flex-col items-center justify-center font-bold text-xs animate-pulse hover:animate-none"
        aria-label="Botón de pánico"
      >
        🚨<span className="text-[10px] mt-0.5">PÁNICO</span>
      </button>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => paso !== 'enviando' && setModalAbierto(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            {paso === 'categoria' && (
              <>
                <h2 className="text-xl font-bold mb-1">🚨 Alerta de Pánico</h2>
                <p className="text-sm text-gray-500 mb-4">¿Qué tipo de emergencia es?</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {CATEGORIAS.map(c => (
                    <button
                      key={c.valor}
                      onClick={() => elegirCategoria(c.valor)}
                      className="border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 rounded-xl p-4 text-sm font-medium transition-colors"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setModalAbierto(false)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
                  Cancelar
                </button>
              </>
            )}

            {paso === 'confirmar' && (
              <>
                <h2 className="text-xl font-bold mb-1 text-red-600">⚠️ Confirmar alerta</h2>
                <p className="text-sm text-gray-700 mb-3">
                  Se notificará <strong>de inmediato</strong> por email (y WhatsApp si corresponde) a todos los vecinos y a portería, con tu ubicación y datos de parcela.
                </p>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Detalles adicionales (opcional)"
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
                />
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2 mb-3">{error}</p>}
                <button
                  onClick={confirmarEnvio}
                  className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3.5 font-bold text-lg mb-2"
                >
                  🚨 SÍ, ES REAL — ENVIAR ALERTA
                </button>
                <button onClick={() => setPaso('categoria')} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
                  ← Volver
                </button>
              </>
            )}

            {paso === 'enviando' && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3 animate-pulse">🚨</div>
                <p className="font-medium">Enviando alerta...</p>
                <p className="text-sm text-gray-500 mt-1">Notificando a vecinos y portería</p>
              </div>
            )}

            {paso === 'resultado' && resultado && (
              <>
                <h2 className="text-xl font-bold mb-3 text-green-600">✅ Alerta enviada</h2>
                {resultado.modo_pruebas && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 mb-3">
                    🧪 Modo de pruebas activo: la alerta solo llegó al correo de pruebas, no a los vecinos reales.
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 mb-4">
                  <p>📧 Email a vecinos: <strong>{resultado.email_parceleros}</strong></p>
                  {resultado.whatsapp_disponible && <p>💬 WhatsApp a vecinos: <strong>{resultado.whatsapp_parceleros}</strong></p>}
                  <p>🏢 Portería (email): <strong>{resultado.email_porteria ? 'Notificada ✓' : 'No configurada'}</strong></p>
                  {resultado.whatsapp_disponible && <p>🏢 Portería (WhatsApp): <strong>{resultado.whatsapp_porteria ? 'Notificada ✓' : 'No configurada'}</strong></p>}
                  {!resultado.whatsapp_disponible && (
                    <p className="text-xs text-gray-400 pt-1">WhatsApp aún no está configurado en el sistema.</p>
                  )}
                </div>
                <button
                  onClick={() => setModalAbierto(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-3 font-medium"
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
