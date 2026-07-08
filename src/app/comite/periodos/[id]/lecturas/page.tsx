'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

interface PeriodoInfo {
  montoTotalFactura: number
  fechaVencimiento: string | null
  prorrateoCalculado: boolean
}

export default function LecturasPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [filas, setFilas] = useState<LecturaFila[]>([])
  const [periodo, setPeriodo] = useState<PeriodoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [esSuperadmin, setEsSuperadmin] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [formFactura, setFormFactura] = useState({ monto_total_factura: '', fecha_vencimiento: '', fecha_emision: '', fecha_corte: '' })
  const [guardandoFactura, setGuardandoFactura] = useState(false)
  const [archivoFactura, setArchivoFactura] = useState<File | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrSugeridoFactura, setOcrSugeridoFactura] = useState<{ monto: number; vencimiento: string; corte?: string } | null>(null)

  const cargar = useCallback(() => {
    fetch(`/api/periodos/${id}/lecturas-iniciales`)
      .then(r => r.json())
      .then(data => {
        setFilas(data.filas.map((p: { parcela_id: string; numero: number; nombre_dueno: string; lectura_anterior: number; lectura_actual: number | null; estado?: string; guardado: boolean }) => ({
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
        setPeriodo(data.periodo)
        setFormFactura(f => ({
          ...f,
          monto_total_factura: data.periodo.montoTotalFactura ? String(data.periodo.montoTotalFactura) : '',
          fecha_vencimiento: data.periodo.fechaVencimiento ?? '',
        }))
        setLoading(false)
      })
  }, [id])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    fetch('/api/sesion').then(r => r.json()).then(s => setEsSuperadmin(!!s.esSuperadmin)).catch(() => {})
  }, [])

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

  async function handleOcrFactura() {
    if (!archivoFactura) return
    setOcrLoading(true)
    setMensaje('')
    try {
      const fd = new FormData()
      fd.append('file', archivoFactura)
      const res = await fetch('/api/ocr/factura', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error OCR')
      setOcrSugeridoFactura(data)
      setFormFactura(f => ({
        ...f,
        monto_total_factura: String(data.monto ?? f.monto_total_factura),
        fecha_vencimiento: data.vencimiento ?? f.fecha_vencimiento,
        fecha_corte: data.corte ?? f.fecha_corte,
      }))
    } catch (e: unknown) {
      setMensaje(`❌ ${e instanceof Error ? e.message : 'Error leyendo la factura'}`)
    } finally {
      setOcrLoading(false)
    }
  }

  async function guardarFactura(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoFactura(true)
    setMensaje('')
    const fd = new FormData()
    Object.entries(formFactura).forEach(([k, v]) => fd.append(k, v))
    if (archivoFactura) fd.append('archivo', archivoFactura)
    const res = await fetch(`/api/periodos/${id}`, { method: 'PATCH', body: fd })
    const data = await res.json()
    if (!res.ok) { setMensaje(`❌ ${data.error}`); setGuardandoFactura(false); return }
    setMensaje('✅ Factura guardada')
    cargar()
    setGuardandoFactura(false)
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
    if (!res.ok) { setMensaje(`❌ ${data.error}`); setGuardando(false); return }
    setMensaje(`✅ ${data.guardadas} lecturas guardadas`)
    setGuardando(false)
  }

  async function calcularProrrateo() {
    setGuardando(true)
    setMensaje('')
    const res = await fetch(`/api/prorrateo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodo_id: id }),
    })
    const data = await res.json()
    if (!res.ok) { setMensaje(`❌ ${data.error}`); setGuardando(false); return }
    setMensaje(`✅ Prorrateo calculado para ${data.total} parcelas — tarifa derivada: $${data.tarifa_calculada}/kWh (consumo total ${data.consumo_total_kwh} kWh)`)
    setGuardando(false)
    setTimeout(() => router.push(`/comite/periodos/${id}/cuentas`), 1200)
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando parcelas...</div>

  const completadas = filas.filter(f => f.lectura_actual !== '' || f.estado !== 'normal').length
  const faltaFactura = !periodo?.montoTotalFactura || periodo.montoTotalFactura <= 0
  const cerrado = !!periodo?.prorrateoCalculado
  const bloqueado = cerrado && !esSuperadmin

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Lecturas de medidores</h1>
        <span className="text-sm text-gray-500">{completadas}/{filas.length} ingresadas</span>
      </div>

      {cerrado && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${bloqueado ? 'bg-gray-100 text-gray-700 border border-gray-300' : 'bg-yellow-50 text-yellow-800 border border-yellow-300'}`}>
          {bloqueado
            ? '🔒 El prorrateo de este período ya fue calculado. Las lecturas quedaron cerradas para edición. Solo un superadministrador puede reabrirlas.'
            : '⚠️ Estás editando un período con el prorrateo ya calculado (acceso de superadministrador). Si guardas o recalculas, se actualizarán los montos y cuentas ya generadas.'}
        </div>
      )}

      {faltaFactura && !cerrado && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-amber-900 mb-1">📄 Falta agregar la factura</h2>
          <p className="text-xs text-amber-700 mb-3">Puedes seguir cargando lecturas mientras llega. Antes de calcular el prorrateo, completa estos datos.</p>
          <form onSubmit={guardarFactura} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Factura (imagen o PDF, opcional)</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setArchivoFactura(e.target.files?.[0] || null)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-purple-50 file:text-purple-700"
                />
                <button
                  type="button"
                  onClick={handleOcrFactura}
                  disabled={!archivoFactura || ocrLoading}
                  className="bg-purple-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {ocrLoading ? 'Leyendo...' : '🤖 Leer con IA'}
                </button>
              </div>
              {ocrSugeridoFactura && (
                <p className="mt-1 text-xs text-purple-700 bg-purple-50 rounded p-2">
                  IA sugirió: monto ${ocrSugeridoFactura.monto?.toLocaleString('es-CL')}, vencimiento {ocrSugeridoFactura.vencimiento}. Revisa y corrige si es necesario.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Monto total factura ($)</label>
              <input
                type="number"
                value={formFactura.monto_total_factura}
                onChange={e => setFormFactura(f => ({ ...f, monto_total_factura: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Fecha vencimiento</label>
              <input
                type="date"
                value={formFactura.fecha_vencimiento}
                onChange={e => setFormFactura(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Fecha emisión</label>
              <input
                type="date"
                value={formFactura.fecha_emision}
                onChange={e => setFormFactura(f => ({ ...f, fecha_emision: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Fecha corte</label>
              <input
                type="date"
                value={formFactura.fecha_corte}
                onChange={e => setFormFactura(f => ({ ...f, fecha_corte: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={guardandoFactura}
                className="bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {guardandoFactura ? 'Guardando...' : 'Guardar factura'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <button
          onClick={guardarTodas}
          disabled={guardando || completadas === 0 || bloqueado}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar lecturas'}
        </button>
        <button
          onClick={calcularProrrateo}
          disabled={guardando || completadas < filas.length || bloqueado || faltaFactura}
          className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          title={faltaFactura ? 'Agrega la factura antes de calcular' : completadas < filas.length ? `Faltan ${filas.length - completadas} lecturas` : ''}
        >
          {cerrado ? '🔁 Recalcular prorrateo →' : 'Calcular prorrateo →'}
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
                      disabled={bloqueado}
                      onChange={e => setFilas(prev => prev.map(f =>
                        f.parcela_id === fila.parcela_id ? { ...f, lectura_actual: e.target.value } : f
                      ))}
                      className="w-24 border rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
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
                      disabled={bloqueado}
                      onChange={e => setFilas(prev => prev.map(f =>
                        f.parcela_id === fila.parcela_id ? { ...f, estado: e.target.value } : f
                      ))}
                      className={`border rounded px-1 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-400 ${fila.estado !== 'normal' ? 'bg-yellow-50 border-yellow-300' : ''}`}
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
                        disabled={bloqueado}
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
                        disabled={bloqueado}
                        onClick={() => fileRefs.current[fila.parcela_id]?.click()}
                        className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
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
