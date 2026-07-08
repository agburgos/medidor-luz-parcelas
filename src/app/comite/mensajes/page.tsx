'use client'

import { useState, useEffect, useCallback } from 'react'
import { TIPOS_MENSAJE as TIPOS, ESTADOS_MENSAJE as ESTADOS, subirAdjuntoMensaje as subirAdjunto } from '@/lib/mensajeria'

interface Mensaje {
  id: string
  tipo: 'reclamo' | 'denuncia' | 'sugerencia' | 'felicitacion'
  asunto: string
  mensaje: string
  adjunto_url: string | null
  estado: 'abierto' | 'respondido' | 'cerrado'
  leido_comite: boolean
  created_at: string
  parcela: { id: string; numero: number; nombre_dueno: string } | null
}

interface Respuesta {
  id: string
  autor_tipo: 'comite' | 'parcelero'
  autor_nombre: string | null
  respuesta: string
  adjunto_url: string | null
  created_at: string
}

interface MensajeDetalle extends Mensaje {
  respuestas: Respuesta[]
}

export default function MensajesComitePage() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [seleccionado, setSeleccionado] = useState<MensajeDetalle | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [adjuntoRespuesta, setAdjuntoRespuesta] = useState<File | null>(null)
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(false)

  const cargar = useCallback(async () => {
    const params = new URLSearchParams()
    if (filtroTipo) params.set('tipo', filtroTipo)
    if (filtroEstado) params.set('estado', filtroEstado)
    const res = await fetch(`/api/mensajes?${params}`)
    const data = await res.json()
    setMensajes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filtroTipo, filtroEstado])

  useEffect(() => { cargar() }, [cargar])

  async function abrir(m: Mensaje) {
    const res = await fetch(`/api/mensajes/${m.id}`)
    const data = await res.json()
    setSeleccionado(data)
    await cargar()
  }

  async function enviarRespuesta() {
    if (!seleccionado || !respuesta.trim()) return
    setEnviandoRespuesta(true)
    try {
      const adjunto_url = adjuntoRespuesta ? await subirAdjunto(adjuntoRespuesta) : null
      const res = await fetch(`/api/mensajes/${seleccionado.id}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta, adjunto_url }),
      })
      if (res.ok) {
        setRespuesta('')
        setAdjuntoRespuesta(null)
        const detalle = await fetch(`/api/mensajes/${seleccionado.id}`).then(r => r.json())
        setSeleccionado(detalle)
        await cargar()
      } else {
        const data = await res.json()
        alert('Error: ' + data.error)
      }
    } catch (err) {
      alert('Error: ' + (err as Error).message)
    }
    setEnviandoRespuesta(false)
  }

  async function cerrar() {
    if (!seleccionado || !confirm('¿Cerrar este mensaje? No se podrán agregar más respuestas.')) return
    const res = await fetch(`/api/mensajes/${seleccionado.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cerrado' }),
    })
    if (res.ok) {
      const detalle = await fetch(`/api/mensajes/${seleccionado.id}`).then(r => r.json())
      setSeleccionado(detalle)
      await cargar()
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando mensajes...</div>

  if (seleccionado) {
    const t = TIPOS[seleccionado.tipo]
    return (
      <div className="max-w-2xl">
        <button onClick={() => setSeleccionado(null)} className="mb-4 text-sm text-gray-600 hover:text-blue-700">
          ← Volver
        </button>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${t.color}`}>{t.icon} {t.label}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADOS[seleccionado.estado].color}`}>
              {ESTADOS[seleccionado.estado].label}
            </span>
          </div>
          <h1 className="text-xl font-bold mb-1">{seleccionado.asunto}</h1>
          <p className="text-xs text-gray-400 mb-1">
            Parcela #{seleccionado.parcela?.numero} — {seleccionado.parcela?.nombre_dueno}
          </p>
          <p className="text-xs text-gray-400 mb-4">{new Date(seleccionado.created_at).toLocaleString('es-CL')}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{seleccionado.mensaje}</p>
          {seleccionado.adjunto_url && (
            <a href={seleccionado.adjunto_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline mb-4">
              📎 Ver adjunto
            </a>
          )}

          <div className="space-y-3 mb-6 mt-4">
            {seleccionado.respuestas.map(r => (
              <div key={r.id} className={`rounded-lg p-3 text-sm ${r.autor_tipo === 'comite' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <p className="font-medium text-xs mb-1">
                  {r.autor_tipo === 'comite' ? `🏛️ ${r.autor_nombre || 'Comité'}` : `🙋 ${seleccionado.parcela?.nombre_dueno || 'Parcelero'}`}
                </p>
                <p className="whitespace-pre-wrap">{r.respuesta}</p>
                {r.adjunto_url && (
                  <a href={r.adjunto_url} target="_blank" rel="noreferrer" className="inline-block text-blue-600 hover:underline mt-1">
                    📎 Ver adjunto
                  </a>
                )}
                <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleString('es-CL')}</p>
              </div>
            ))}
            {seleccionado.respuestas.length === 0 && (
              <p className="text-sm text-gray-400">Sin respuestas aún</p>
            )}
          </div>

          {seleccionado.estado !== 'cerrado' ? (
            <div>
              <textarea
                value={respuesta}
                onChange={e => setRespuesta(e.target.value)}
                placeholder="Escribe tu respuesta..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              />
              <div className="mb-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <span className="bg-gray-100 rounded px-2 py-1 hover:bg-gray-200">📎 Adjuntar foto o archivo (opcional)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={e => setAdjuntoRespuesta(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  {adjuntoRespuesta && <span className="text-gray-500">{adjuntoRespuesta.name}</span>}
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={enviarRespuesta}
                  disabled={enviandoRespuesta || !respuesta.trim()}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {enviandoRespuesta ? 'Enviando...' : 'Enviar respuesta'}
                </button>
                <button
                  onClick={cerrar}
                  className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Cerrar mensaje
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Este mensaje está cerrado.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">💬 Mensajería vecinal</h1>
      <p className="text-gray-500 text-sm mb-6">Reclamos, denuncias, sugerencias y felicitaciones de los parceleros</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([key, t]) => (
            <option key={key} value={key}>{t.icon} {t.label}</option>
          ))}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([key, e]) => (
            <option key={key} value={key}>{e.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {mensajes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Sin mensajes</div>
        ) : (
          mensajes.map(m => {
            const t = TIPOS[m.tipo]
            return (
              <button
                key={m.id}
                onClick={() => abrir(m)}
                className="w-full text-left bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.icon} {t.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADOS[m.estado].color}`}>
                      {ESTADOS[m.estado].label}
                    </span>
                    {!m.leido_comite && <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5">Nuevo</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                <p className="font-medium">{m.asunto}</p>
                <p className="text-xs text-gray-500 mt-1">Parcela #{m.parcela?.numero} — {m.parcela?.nombre_dueno}</p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
