'use client'

import { useState, useEffect, useCallback } from 'react'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Estado {
  periodo: { id: string; mes: number; anio: number } | null
  fecha_tope?: string
  lectura_anterior?: number
  mi_lectura?: {
    lectura_actual: number
    estado_validacion: string
    motivo_rechazo: string | null
    foto_url: string | null
  } | null
}

export default function SubirLectura() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [lectura, setLectura] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch('/api/lecturas/informar')
    const data = await res.json()
    setEstado(data)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!estado?.periodo) return
    if (!foto) { setMensaje('❌ La foto del medidor es obligatoria'); return }
    setEnviando(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('periodo_id', estado.periodo.id)
    fd.append('lectura_actual', lectura)
    fd.append('foto', foto)
    const res = await fetch('/api/lecturas/informar', { method: 'POST', body: fd })
    const data = await res.json()
    setMensaje(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`)
    setEnviando(false)
    if (res.ok) await cargar()
  }

  if (!estado) return null
  if (!estado.periodo) return null

  const { periodo, fecha_tope, lectura_anterior, mi_lectura } = estado
  const nombrePeriodo = `${meses[periodo.mes - 1]} ${periodo.anio}`
  const tope = fecha_tope ? new Date(fecha_tope + 'T23:59:59') : null
  const diasRestantes = tope ? Math.ceil((tope.getTime() - Date.now()) / 86400000) : null
  const vencido = diasRestantes != null && diasRestantes < 0

  // Ya aprobada: solo mostrar confirmación
  if (mi_lectura?.estado_validacion === 'aprobada') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
        <p className="font-medium text-green-800">✅ Tu lectura de {nombrePeriodo} fue validada por el comité</p>
        <p className="text-sm text-gray-600 mt-1">Lectura registrada: <strong>{mi_lectura.lectura_actual}</strong> kWh</p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border p-5 mb-6 ${vencido ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="font-bold text-lg">📸 Subir mi lectura — {nombrePeriodo}</h2>
          {tope && (
            <p className={`text-sm ${vencido ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
              {vencido
                ? `⚠️ El plazo venció el ${tope.toLocaleDateString('es-CL')} — envíala ahora mismo`
                : `Plazo: hasta el ${tope.toLocaleDateString('es-CL')}${diasRestantes != null ? ` (quedan ${diasRestantes} días)` : ''}`}
            </p>
          )}
        </div>
        {mi_lectura?.estado_validacion === 'pendiente' && (
          <span className="text-xs bg-yellow-100 text-yellow-800 rounded-full px-3 py-1 font-medium">⏳ Enviada, esperando validación</span>
        )}
        {mi_lectura?.estado_validacion === 'rechazada' && (
          <span className="text-xs bg-red-100 text-red-700 rounded-full px-3 py-1 font-medium">✗ Rechazada — reenvíala</span>
        )}
      </div>

      {mi_lectura?.estado_validacion === 'rechazada' && mi_lectura.motivo_rechazo && (
        <p className="text-sm bg-red-100 text-red-800 rounded p-2 mb-3">
          Motivo del rechazo: {mi_lectura.motivo_rechazo}
        </p>
      )}

      {mensaje && <p className="text-sm bg-white rounded p-2 mb-3">{mensaje}</p>}

      {mi_lectura?.estado_validacion === 'pendiente' ? (
        <p className="text-sm text-gray-600">
          Informaste <strong>{mi_lectura.lectura_actual}</strong>.
          {mi_lectura.foto_url && <> <a href={mi_lectura.foto_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver mi foto</a>.</>}
          {' '}El comité la revisará pronto.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Lectura anterior</label>
              <p className="text-lg font-medium text-gray-500">{lectura_anterior}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Lectura actual del medidor *</label>
              <input
                type="number"
                value={lectura}
                onChange={e => setLectura(e.target.value)}
                required
                min={0}
                step="0.01"
                className="border rounded-lg px-3 py-2 text-lg font-medium w-36"
                placeholder="Ej: 4125"
              />
            </div>
            {lectura !== '' && lectura_anterior != null && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Consumo del mes</label>
                <p className={`text-lg font-bold ${Number(lectura) - lectura_anterior < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                  {(Number(lectura) - lectura_anterior).toFixed(0)} kWh
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Foto del medidor (obligatoria, que se vea el número) *</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => setFoto(e.target.files?.[0] || null)}
              required
              className="text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-600 file:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : '📤 Enviar lectura al comité'}
          </button>
        </form>
      )}
    </div>
  )
}
