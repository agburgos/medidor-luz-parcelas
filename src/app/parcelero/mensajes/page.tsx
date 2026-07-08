'use client'

import { useState, useEffect, useCallback } from 'react'

interface Mensaje {
  id: string
  tipo: 'reclamo' | 'denuncia' | 'sugerencia' | 'felicitacion'
  asunto: string
  mensaje: string
  estado: 'abierto' | 'respondido' | 'cerrado'
  leido_parcelero: boolean
  created_at: string
}

interface Respuesta {
  id: string
  autor_tipo: 'comite' | 'parcelero'
  autor_nombre: string | null
  respuesta: string
  created_at: string
}

interface MensajeDetalle extends Mensaje {
  respuestas: Respuesta[]
}

const TIPOS: Record<string, { label: string; icon: string; color: string }> = {
  reclamo: { label: 'Reclamo', icon: '⚠️', color: 'bg-amber-100 text-amber-700' },
  denuncia: { label: 'Denuncia', icon: '🚨', color: 'bg-red-100 text-red-700' },
  sugerencia: { label: 'Sugerencia', icon: '💡', color: 'bg-blue-100 text-blue-700' },
  felicitacion: { label: 'Felicitación', icon: '🎉', color: 'bg-green-100 text-green-700' },
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  abierto: { label: 'Abierto', color: 'bg-gray-100 text-gray-700' },
  respondido: { label: 'Respondido', color: 'bg-blue-100 text-blue-700' },
  cerrado: { label: 'Cerrado', color: 'bg-gray-200 text-gray-500' },
}

export default function MensajesPage() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState({ tipo: 'sugerencia', asunto: '', mensaje: '' })

  const [seleccionado, setSeleccionado] = useState<MensajeDetalle | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/mensajes')
    const data = await res.json()
    setMensajes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const res = await fetch('/api/mensajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setMostrarForm(false)
      setForm({ tipo: 'sugerencia', asunto: '', mensaje: '' })
      await cargar()
    } else {
      const data = await res.json()
      alert('Error: ' + data.error)
    }
    setEnviando(false)
  }

  async function abrir(m: Mensaje) {
    const res = await fetch(`/api/mensajes/${m.id}`)
    const data = await res.json()
    setSeleccionado(data)
  }

  async function enviarRespuesta() {
    if (!seleccionado || !respuesta.trim()) return
    setEnviandoRespuesta(true)
    const res = await fetch(`/api/mensajes/${seleccionado.id}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuesta }),
    })
    if (res.ok) {
      setRespuesta('')
      await abrir(seleccionado)
      await cargar()
    } else {
      const data = await res.json()
      alert('Error: ' + data.error)
    }
    setEnviandoRespuesta(false)
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
          <p className="text-xs text-gray-400 mb-4">{new Date(seleccionado.created_at).toLocaleString('es-CL')}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-6">{seleccionado.mensaje}</p>

          <div className="space-y-3 mb-6">
            {seleccionado.respuestas.map(r => (
              <div key={r.id} className={`rounded-lg p-3 text-sm ${r.autor_tipo === 'comite' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <p className="font-medium text-xs mb-1">
                  {r.autor_tipo === 'comite' ? `🏛️ ${r.autor_nombre || 'Comité'}` : '🙋 Tú'}
                </p>
                <p className="whitespace-pre-wrap">{r.respuesta}</p>
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
                placeholder="Escribe una réplica..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              />
              <button
                onClick={enviarRespuesta}
                disabled={enviandoRespuesta || !respuesta.trim()}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {enviandoRespuesta ? 'Enviando...' : 'Enviar réplica'}
              </button>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">💬 Mensajería con el comité</h1>
          <p className="text-gray-500 text-sm">Reclamos, denuncias, sugerencias y felicitaciones</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          {mostrarForm ? '✕ Cancelar' : '+ Nuevo mensaje'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={crear} className="bg-white rounded-xl border p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(TIPOS).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: key }))}
                  className={`text-sm rounded-lg px-3 py-2 font-medium border ${
                    form.tipo === key ? t.color + ' border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Asunto</label>
            <input
              type="text"
              value={form.asunto}
              onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Resumen breve"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mensaje</label>
            <textarea
              value={form.mensaje}
              onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))}
              required
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Cuéntanos con detalle..."
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar al comité'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {mensajes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aún no has enviado mensajes</div>
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
                    {!m.leido_parcelero && <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5">Nueva respuesta</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                <p className="font-medium">{m.asunto}</p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
