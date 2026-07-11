'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Documento { id: string; archivo_url: string; tipo: string; fecha_subida: string }

interface Incidencia {
  id: string
  categoria: string
  descripcion: string | null
  estado: string
  latitud: number | null
  longitud: number | null
  fecha_activacion: string
  fecha_resolucion: string | null
  notas_resolucion: string | null
  documentos: Documento[]
}

const CATEGORIAS: Record<string, string> = {
  intruso: '🔴 Intruso / Robo',
  emergencia_medica: '🏥 Emergencia médica',
  incendio: '🔥 Incendio / Gas',
  otro: '⚠️ Otro',
}

const ESTADOS_LABEL: Record<string, string> = {
  activa: '🔴 Activa',
  investigando: '🔎 En investigación por el comité',
  resuelto: '✅ Resuelto',
  cancelado: '⚪ Cancelado / Falsa alarma',
}

export default function MiIncidenciaDetallePage() {
  const { id } = useParams() as { id: string }
  const [inc, setInc] = useState<Incidencia | null>(null)
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/incidencias/${id}`)
    const data = await res.json()
    if (res.ok) setInc(data)
    setLoading(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    const fd = new FormData()
    fd.append('archivo', archivo)
    fd.append('tipo', archivo.type.startsWith('image/') ? 'foto' : 'documento')
    const res = await fetch(`/api/incidencias/${id}/documentos`, { method: 'POST', body: fd })
    setSubiendo(false)
    if (res.ok) cargar()
    e.target.value = ''
  }

  async function cancelar() {
    if (!confirm('¿Confirmas que fue una falsa alarma?')) return
    setCancelando(true)
    await fetch(`/api/incidencias/${id}/cancelar`, { method: 'POST' })
    setCancelando(false)
    cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>
  if (!inc) return <div className="p-8 text-red-600">Incidencia no encontrada</div>

  const mapa = inc.latitud != null && inc.longitud != null
    ? `https://www.google.com/maps?q=${inc.latitud},${inc.longitud}`
    : null

  return (
    <div className="max-w-2xl">
      <Link href="/parcelero/incidencias" className="text-sm text-gray-600 hover:text-blue-700 mb-4 inline-block">← Volver</Link>

      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-bold">{CATEGORIAS[inc.categoria] ?? inc.categoria}</h1>
        <span className="text-sm px-3 py-1 rounded-full font-medium bg-gray-100">{ESTADOS_LABEL[inc.estado]}</span>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-6 space-y-2 text-sm">
        <p><strong>Fecha:</strong> {new Date(inc.fecha_activacion).toLocaleString('es-CL')}</p>
        {inc.descripcion && <p><strong>Detalle:</strong> {inc.descripcion}</p>}
        {inc.notas_resolucion && <p><strong>Notas del comité:</strong> {inc.notas_resolucion}</p>}
        {mapa && (
          <a href={mapa} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline block mt-1">📍 Ver ubicación registrada</a>
        )}
      </div>

      {(inc.estado === 'activa' || inc.estado === 'investigando') && (
        <button
          onClick={cancelar}
          disabled={cancelando}
          className="mb-6 bg-white border border-red-300 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
        >
          {cancelando ? 'Cancelando...' : '❌ Fue un error — Marcar como falsa alarma'}
        </button>
      )}

      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold mb-3">📎 Fotos y documentos</h2>
        {inc.documentos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {inc.documentos.map(d => (
              <a key={d.id} href={d.archivo_url} target="_blank" rel="noreferrer" className="block border rounded-lg overflow-hidden hover:opacity-80">
                {d.tipo === 'foto' ? (
                  <img src={d.archivo_url} alt="" className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center bg-gray-50 text-2xl">📄</div>
                )}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-4">Sin documentos aún. Puedes subir fotos o partes policiales.</p>
        )}
        <label className="inline-block bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
          {subiendo ? 'Subiendo...' : '📤 Subir foto o documento'}
          <input type="file" className="hidden" onChange={subirArchivo} disabled={subiendo} accept="image/*,.pdf,.doc,.docx" />
        </label>
      </div>
    </div>
  )
}
