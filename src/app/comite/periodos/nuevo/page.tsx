'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function NuevoPeriodoPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [error, setError] = useState('')

  const hoy = new Date()
  const [form, setForm] = useState({
    mes: hoy.getMonth() + 1,
    anio: hoy.getFullYear(),
    monto_total_factura: '',
    cargo_fijo: '5500',
    lectura_general_anterior: '',
    lectura_general_actual: '',
    fecha_emision: '',
    fecha_vencimiento: '',
    fecha_corte: '',
  })
  const [archivoFile, setArchivoFile] = useState<File | null>(null)
  const [ocrSugerido, setOcrSugerido] = useState<null | { monto: number; vencimiento: string; corte?: string }>(null)

  async function handleOcr() {
    if (!archivoFile) return
    setOcrLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', archivoFile)
      const res = await fetch('/api/ocr/factura', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error OCR')
      setOcrSugerido(data)
      setForm(f => ({
        ...f,
        monto_total_factura: String(data.monto ?? f.monto_total_factura),
        fecha_vencimiento: data.vencimiento ?? f.fecha_vencimiento,
        fecha_corte: data.corte ?? f.fecha_corte,
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error leyendo la factura')
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      if (archivoFile) fd.append('archivo', archivoFile)
      const res = await fetch('/api/periodos', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear período')
      router.push(`/comite/periodos/${data.id}/lecturas`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Nuevo período de facturación</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
            <select
              value={form.mes}
              onChange={e => setForm(f => ({ ...f, mes: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <input
              type="number"
              value={form.anio}
              onChange={e => setForm(f => ({ ...f, anio: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={2020} max={2099}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Factura (imagen o PDF)</label>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setArchivoFile(e.target.files?.[0] || null)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700"
            />
            <button
              type="button"
              onClick={handleOcr}
              disabled={!archivoFile || ocrLoading}
              className="bg-purple-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
            >
              {ocrLoading ? 'Leyendo...' : '🤖 Leer con IA'}
            </button>
          </div>
          {ocrSugerido && (
            <p className="mt-1 text-xs text-purple-700 bg-purple-50 rounded p-2">
              IA sugirió: monto ${ocrSugerido.monto?.toLocaleString('es-CL')}, vencimiento {ocrSugerido.vencimiento}. Revisa y corrige si es necesario.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto total factura ($)</label>
          <input
            type="number"
            value={form.monto_total_factura}
            onChange={e => setForm(f => ({ ...f, monto_total_factura: e.target.value }))}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 El <strong>costo por kWh se calcula automáticamente</strong>: (factura − cargos fijos) ÷ consumo total de todas las parcelas,
            una vez que estén todas las lecturas del mes. No se ingresa a mano.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cargo fijo por parcela ($)</label>
          <input
            type="number"
            value={form.cargo_fijo}
            onChange={e => setForm(f => ({ ...f, cargo_fijo: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lect. medidor general anterior</label>
            <input
              type="number"
              value={form.lectura_general_anterior}
              onChange={e => setForm(f => ({ ...f, lectura_general_anterior: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: 144800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lect. medidor general actual</label>
            <input
              type="number"
              value={form.lectura_general_actual}
              onChange={e => setForm(f => ({ ...f, lectura_general_actual: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: 149500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha emisión</label>
            <input
              type="date"
              value={form.fecha_emision}
              onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha vencimiento *</label>
            <input
              type="date"
              value={form.fecha_vencimiento}
              onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha corte de suministro</label>
          <input
            type="date"
            value={form.fecha_corte}
            onChange={e => setForm(f => ({ ...f, fecha_corte: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando...' : 'Crear período y cargar lecturas →'}
        </button>
      </form>
    </div>
  )
}
