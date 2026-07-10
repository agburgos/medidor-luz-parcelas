'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Votacion {
  id: string
  titulo: string
  descripcion: string
  tipo_conteo: 'unica' | 'multiple'
  estado: 'abierta' | 'cerrada'
  fecha_cierre: string
  yaVoto?: boolean
  miVotoOpciones?: string[]
}

interface Opcion {
  id: string
  texto: string
  foto_url: string | null
  orden: number
}

export default function VotacionesPage() {
  const [votaciones, setVotaciones] = useState<Votacion[]>([])
  const [loading, setLoading] = useState(true)
  const [votacionSeleccionada, setVotacionSeleccionada] = useState<string | null>(null)
  const [opciones, setOpciones] = useState<Opcion[]>([])
  const [opcionesSeleccionadas, setOpcionesSeleccionadas] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch('/api/votaciones')
    const data = await res.json()
    setVotaciones(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function abrirVotacion(votacionId: string) {
    setVotacionSeleccionada(votacionId)
    const votacion = votaciones.find(v => v.id === votacionId)
    setOpcionesSeleccionadas(votacion?.miVotoOpciones?.map((opt: string) => {
      const opcion = opciones.find(o => o.texto === opt)
      return opcion?.id || ''
    }).filter(Boolean) || [])
    setMensaje('')

    const res = await fetch(`/api/votaciones/${votacionId}/opciones`)
    const data = await res.json()
    setOpciones(Array.isArray(data) ? data : [])
  }

  async function enviarVoto() {
    if (!votacionSeleccionada) return
    if (opcionesSeleccionadas.length === 0) {
      setMensaje('❌ Debes seleccionar al menos una opción')
      return
    }

    setEnviando(true)
    setMensaje('')

    const votacion = votaciones.find(v => v.id === votacionSeleccionada)
    const payload = votacion?.tipo_conteo === 'unica'
      ? { opcion_id: opcionesSeleccionadas[0] }
      : { opcion_ids: opcionesSeleccionadas }

    const res = await fetch(`/api/votaciones/${votacionSeleccionada}/votar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      setEnviando(false)
      return
    }

    setMensaje('✅ Voto registrado')
    setVotacionSeleccionada(null)
    setOpcionesSeleccionadas([])
    setEnviando(false)
    setTimeout(() => cargar(), 1000)
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando votaciones...</div>

  if (votacionSeleccionada) {
    const votacion = votaciones.find(v => v.id === votacionSeleccionada)
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => setVotacionSeleccionada(null)}
          className="mb-4 text-sm text-gray-600 hover:text-blue-700"
        >
          ← Volver
        </button>

        <div className="bg-white rounded-xl border p-6">
          <h1 className="text-2xl font-bold mb-2">🗳️ {votacion?.titulo}</h1>
          {votacion?.descripcion && (
            <p className="text-gray-600 mb-4">{votacion.descripcion}</p>
          )}

          {votacion?.yaVoto && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-900">✅ Ya votaste: <strong>{votacion.miVotoOpciones?.join(', ') || '—'}</strong></p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {opciones.map(opcion => (
              <label key={opcion.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                votacion?.yaVoto ? 'opacity-60 bg-gray-50' : 'hover:bg-blue-50'
              }`}>
                <input
                  type={votacion?.tipo_conteo === 'unica' ? 'radio' : 'checkbox'}
                  name="opciones"
                  value={opcion.id}
                  checked={opcionesSeleccionadas.includes(opcion.id)}
                  disabled={votacion?.yaVoto}
                  onChange={e => {
                    if (votacion?.tipo_conteo === 'unica') {
                      setOpcionesSeleccionadas([opcion.id])
                    } else {
                      setOpcionesSeleccionadas(prev =>
                        e.target.checked
                          ? [...prev, opcion.id]
                          : prev.filter(id => id !== opcion.id)
                      )
                    }
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  {opcion.foto_url && (
                    <img src={opcion.foto_url} alt={opcion.texto} className="w-full h-32 object-cover rounded mb-2" />
                  )}
                  <p className="font-medium">{opcion.texto}</p>
                </div>
              </label>
            ))}
          </div>

          {mensaje && <p className="mb-4 text-sm text-center text-gray-700 bg-blue-50 rounded p-2">{mensaje}</p>}

          <button
            onClick={enviarVoto}
            disabled={enviando || opcionesSeleccionadas.length === 0 || votacion?.yaVoto}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {votacion?.yaVoto ? '✓ Ya votaste' : enviando ? 'Registrando voto...' : '✓ Confirmar voto'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🗳️ Votaciones</h1>

      {votaciones.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No hay votaciones abiertas en este momento</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {votaciones.map(v => {
            const diasRestantes = Math.ceil((new Date(v.fecha_cierre).getTime() - Date.now()) / 86400000)
            return (
              <div key={v.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="font-bold text-lg">{v.titulo}</h2>
                  <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-3 py-1">
                    {v.tipo_conteo === 'unica' ? '1 opción' : 'Múltiples'}
                  </span>
                </div>
                {v.descripcion && <p className="text-sm text-gray-600 mb-3">{v.descripcion}</p>}
                {v.yaVoto ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <p className="text-sm text-green-800">
                      ✅ Ya votaste: <strong>{v.miVotoOpciones?.join(', ') || '—'}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Cierra en {diasRestantes} día{diasRestantes !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => abrirVotacion(v.id)}
                      className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700"
                    >
                      Votar →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
