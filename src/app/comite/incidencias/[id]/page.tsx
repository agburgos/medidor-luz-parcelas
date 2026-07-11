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
  confirmado_falsa_alarma: boolean
  fecha_activacion: string
  fecha_resolucion: string | null
  notas_resolucion: string | null
  notificaciones_enviadas: {
    modo_pruebas?: boolean
    email_parceleros?: number
    whatsapp_parceleros?: number
    email_porteria?: boolean
    whatsapp_porteria?: boolean
    whatsapp_disponible?: boolean
  } | null
  parcela: { numero: number; nombre_dueno: string; telefono: string | null; email: string | null }
  documentos: Documento[]
}

const CATEGORIAS: Record<string, string> = {
  intruso: '🔴 Intruso / Robo',
  emergencia_medica: '🏥 Emergencia médica',
  incendio: '🔥 Incendio / Gas',
  otro: '⚠️ Otro',
  falsa_alarma: 'Falsa alarma',
}

const ESTADOS = ['activa', 'investigando', 'resuelto', 'cancelado']
const ESTADOS_LABEL: Record<string, string> = {
  activa: '🔴 Activa',
  investigando: '🔎 Investigando',
  resuelto: '✅ Resuelto',
  cancelado: '⚪ Cancelado / Falsa alarma',
}

export default function DetalleIncidenciaPage() {
  const { id } = useParams() as { id: string }
  const [inc, setInc] = useState<Incidencia | null>(null)
  const [loading, setLoading] = useState(true)
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/incidencias/${id}`)
    const data = await res.json()
    if (res.ok) {
      setInc(data)
      setNotas(data.notas_resolucion || '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function cambiarEstado(estado: string) {
    setGuardando(true)
    setMensaje('')
    const res = await fetch(`/api/incidencias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, notas_resolucion: notas }),
    })
    const data = await res.json()
    setGuardando(false)
    if (!res.ok) { setMensaje(`❌ ${data.error}`); return }
    setMensaje('✅ Estado actualizado')
    cargar()
  }

  async function guardarNotas() {
    setGuardando(true)
    setMensaje('')
    const res = await fetch(`/api/incidencias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notas_resolucion: notas }),
    })
    setGuardando(false)
    setMensaje(res.ok ? '✅ Notas guardadas' : '❌ Error guardando notas')
    cargar()
  }

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
    if (!confirm('¿Marcar esta incidencia como falsa alarma / cancelada?')) return
    setGuardando(true)
    await fetch(`/api/incidencias/${id}/cancelar`, { method: 'POST' })
    setGuardando(false)
    cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>
  if (!inc) return <div className="p-8 text-red-600">Incidencia no encontrada</div>

  const mapa = inc.latitud != null && inc.longitud != null
    ? `https://www.google.com/maps?q=${inc.latitud},${inc.longitud}`
    : null

  const noti = inc.notificaciones_enviadas

  return (
    <div className="max-w-3xl">
      <Link href="/comite/incidencias" className="text-sm text-gray-600 hover:text-blue-700 mb-4 inline-block">← Volver</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{CATEGORIAS[inc.categoria] ?? inc.categoria}</h1>
          <p className="text-gray-500">Parcela #{inc.parcela.numero} — {inc.parcela.nombre_dueno}</p>
        </div>
        <span className="text-sm px-3 py-1 rounded-full font-medium bg-gray-100">{ESTADOS_LABEL[inc.estado]}</span>
      </div>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded-lg p-2">{mensaje}</p>}

      {/* Datos principales */}
      <div className="bg-white rounded-xl border p-5 mb-6 space-y-2 text-sm">
        <p><strong>Fecha activación:</strong> {new Date(inc.fecha_activacion).toLocaleString('es-CL')}</p>
        {inc.fecha_resolucion && <p><strong>Fecha resolución:</strong> {new Date(inc.fecha_resolucion).toLocaleString('es-CL')}</p>}
        <p><strong>Teléfono contacto:</strong> {inc.parcela.telefono || '—'}</p>
        {inc.descripcion && <p><strong>Descripción:</strong> {inc.descripcion}</p>}
        {mapa ? (
          <a href={mapa} target="_blank" rel="noreferrer" className="inline-block bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 mt-2">
            📍 Ver ubicación en el mapa
          </a>
        ) : (
          <p className="text-gray-400">Sin ubicación GPS registrada</p>
        )}
      </div>

      {/* Notificaciones enviadas */}
      {noti && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 text-sm">
          <h2 className="font-semibold mb-2">📨 Notificaciones enviadas</h2>
          {noti.modo_pruebas && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
              🧪 Se envió en modo de pruebas — solo llegó al correo de pruebas, no a vecinos reales.
            </p>
          )}
          <p>Email a vecinos: <strong>{noti.email_parceleros ?? 0}</strong></p>
          <p>WhatsApp a vecinos: <strong>{noti.whatsapp_parceleros ?? 0}</strong></p>
          <p>Portería — Email: <strong>{noti.email_porteria ? 'Sí' : 'No'}</strong> · WhatsApp: <strong>{noti.whatsapp_porteria ? 'Sí' : 'No'}</strong></p>
        </div>
      )}

      {/* Cambiar estado */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="font-semibold mb-3">Estado</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => cambiarEstado(e)}
              disabled={guardando || inc.estado === e}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-50 ${inc.estado === e ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
            >
              {ESTADOS_LABEL[e]}
            </button>
          ))}
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas de resolución</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
          placeholder="Detalles de cómo se resolvió, quién asistió, etc."
        />
        <button
          onClick={guardarNotas}
          disabled={guardando}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Guardar notas
        </button>

        {(inc.estado === 'activa' || inc.estado === 'investigando') && (
          <button
            onClick={cancelar}
            disabled={guardando}
            className="ml-2 bg-gray-100 hover:bg-red-50 text-red-600 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            ❌ Marcar como falsa alarma
          </button>
        )}
      </div>

      {/* Documentos */}
      <div className="bg-white rounded-xl border p-5 mb-6">
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
                <p className="text-xs text-gray-500 p-1 text-center">{new Date(d.fecha_subida).toLocaleDateString('es-CL')}</p>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-4">Sin documentos aún</p>
        )}
        <label className="inline-block bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
          {subiendo ? 'Subiendo...' : '📤 Subir foto o documento'}
          <input type="file" className="hidden" onChange={subirArchivo} disabled={subiendo} accept="image/*,.pdf,.doc,.docx" />
        </label>
      </div>

      <a
        href={`/api/incidencias/${id}/pdf`}
        target="_blank"
        rel="noreferrer"
        className="inline-block border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        📄 Descargar reporte PDF
      </a>
    </div>
  )
}
