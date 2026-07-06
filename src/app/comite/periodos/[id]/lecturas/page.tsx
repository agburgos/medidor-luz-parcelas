'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface LecturaFila {
  parcela_id: string
  numero: number
  nombre_dueno: string
  lectura_anterior: number
  lectura_actual: string
  estado: string
  foto: File | null
  fotoPreview: string | null
  ocrSugerido: number | null
  confirmado: boolean
  guardado: boolean
  error: string
}

export default function LecturasPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [filas, setFilas] = useState<LecturaFila[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetch(`/api/periodos/${id}/lecturas-iniciales`)
      .then(r => r.json())
      .then(data => {
        setFilas(data.map((p: { parcela_id: string; numero: number; nombre_dueno: string; lectura_anterior: number; lectura_actual: number | null; estado?: string; guardado: boolean }) => ({
          parcela_id: p.parcela_id,
          numero: p.numero,
          nombre_dueno: p.nombre_dueno,
          lectura_anterior: p.lectura_anterior ?? 0,
          lectura_actual: p.lectura_actual != null ? String(p.lectura_actual) : '',
          estado: p.estado || 'normal',
          foto: null,
          fotoPreview: null,
          ocrSugerido: null,
          confirmado: p.guardado,
          guardado: p.guardado,
          error: '',
        })))
        setLoading(false)
      })
  }, [id])

  async function handleOcr(parcelaId: string) {
    const fila = filas.find(f => f.parcela_id === parcelaId)
    if (!fila?.foto) return
    setFilas(prev => prev.map(f => f.parcela_id === parcelaId ? { ...f, error: 'Leyendo...' } : f))
    const fd = new FormData()
    fd.append('file', fila.foto)
    const res = await fetch('/api/ocr/medidor', { method: 'POST', body: fd })
    const data = await res.json()
    setFilas(prev => prev.map(f =>
      f.parcela_id === parcelaId
        ? { ...f, ocrSugerido: data.lectura ?? null, lectura_actual: String(data.lectura ?? f.lectura_actual), error: res.ok ? '' : (data.error || 'Error OCR') }
        : f
    ))
  }

  async function guardarTodas() {
    setGuardando(true)
    setMensaje('')
    const payload = filas
      .filter(f => f.lectura_actual !== '' || f.estado !== 'normal')
      .map(f => ({
        parcela_id: f.parcela_id,
        lectura_actual: f.lectura_actual !== '' ? Number(f.lectura_actual) : 0,
        lectura_anterior: f.lectura_anterior,
        estado: f.estado,
      }))
    const res = await fetch(`/api/periodos/${id}/lecturas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lecturas: payload }),
    })
    const data = await res.json()
    if (!res.ok) { setMensaje(data.error || 'Error guardando'); setGuardando(false); return }
    setMensaje(`✅ ${data.guardadas} lecturas guardadas`)
    setGuardando(false)
  }

  async function calcularProrrateo() {
    setGuardando(true)
    const res = await fetch(`/api/prorrateo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodo_id: id }),
    })
    const data = await res.json()
    if (!res.ok) { setMensaje(data.error || 'Error'); setGuardando(false); return }
    setMensaje(`✅ Prorrateo calculado para ${data.total} parcelas`)
    setGuardando(false)
    setTimeout(() => router.push(`/comite/periodos/${id}/cuentas`), 1200)
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando parcelas...</div>

  const completadas = filas.filter(f => f.lectura_actual !== '' || f.estado !== 'normal').length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Lecturas de medidores</h1>
        <span className="text-sm text-gray-500">{completadas}/{filas.length} ingresadas</span>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={guardarTodas}
          disabled={guardando || completadas === 0}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar lecturas'}
        </button>
        <button
          onClick={calcularProrrateo}
          disabled={guardando || completadas < filas.length}
          className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          title={completadas < filas.length ? `Faltan ${filas.length - completadas} lecturas` : ''}
        >
          Calcular prorrateo →
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm text-blue-700 bg-blue-50 rounded p-2">{mensaje}</p>}

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-left px-3 py-3 font-medium text-gray-600">Dueño</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600">Lect. anterior</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600">Lect. actual</th>
              <th className="text-right px-3 py-3 font-medium text-gray-600">Consumo</th>
              <th className="px-3 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-3 py-3 font-medium text-gray-600">Foto + OCR</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(fila => {
              const consumo = fila.lectura_actual !== '' ? Number(fila.lectura_actual) - fila.lectura_anterior : null
              return (
                <tr key={fila.parcela_id} className={`border-t ${fila.guardado ? 'bg-green-50' : ''}`}>
                  <td className="px-3 py-2 font-medium">#{fila.numero}</td>
                  <td className="px-3 py-2">{fila.nombre_dueno}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fila.lectura_anterior}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={fila.lectura_actual}
                      onChange={e => setFilas(prev => prev.map(f =>
                        f.parcela_id === fila.parcela_id ? { ...f, lectura_actual: e.target.value } : f
                      ))}
                      className="w-24 border rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                    {fila.ocrSugerido != null && (
                      <span className="ml-1 text-xs text-purple-600">(IA: {fila.ocrSugerido})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {consumo != null ? (consumo >= 0 ? consumo : <span className="text-red-500">{consumo}</span>) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={fila.estado}
                      onChange={e => setFilas(prev => prev.map(f =>
                        f.parcela_id === fila.parcela_id ? { ...f, estado: e.target.value } : f
                      ))}
                      className={`border rounded px-1 py-1 text-xs ${fila.estado !== 'normal' ? 'bg-yellow-50 border-yellow-300' : ''}`}
                    >
                      <option value="normal">Normal</option>
                      <option value="s_info">S/INFO</option>
                      <option value="nuevo">Nuevo</option>
                      <option value="saldo_af">Saldo a favor</option>
                      <option value="desconectado">Desconectado</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={el => { fileRefs.current[fila.parcela_id] = el }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0] || null
                          const preview = file ? URL.createObjectURL(file) : null
                          setFilas(prev => prev.map(f =>
                            f.parcela_id === fila.parcela_id ? { ...f, foto: file, fotoPreview: preview, ocrSugerido: null } : f
                          ))
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileRefs.current[fila.parcela_id]?.click()}
                        className="text-xs border rounded px-2 py-1 hover:bg-gray-50"
                      >
                        {fila.fotoPreview ? '📷 Cambiar' : '📷 Foto'}
                      </button>
                      {fila.foto && (
                        <button
                          type="button"
                          onClick={() => handleOcr(fila.parcela_id)}
                          className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-1 hover:bg-purple-200"
                        >
                          🤖 OCR
                        </button>
                      )}
                      {fila.fotoPreview && (
                        <a href={fila.fotoPreview} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">ver</a>
                      )}
                      {fila.error && <span className="text-xs text-red-500">{fila.error}</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
