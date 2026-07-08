'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NuevoPeriodoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hoy = new Date()
  const [form, setForm] = useState({
    mes: hoy.getMonth() + 1,
    anio: hoy.getFullYear(),
    cargo_fijo: '5500',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
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
      <h1 className="text-2xl font-bold mb-2">Nuevo período de facturación</h1>
      <p className="text-sm text-gray-500 mb-6">
        Abre el período apenas empiece el mes para comenzar a recibir lecturas. La factura
        (monto, vencimiento, corte) se agrega después, cuando llegue — la podrás cargar desde
        la pantalla de lecturas antes de calcular el prorrateo.
      </p>

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Cargo fijo por parcela ($)</label>
          <input
            type="number"
            value={form.cargo_fijo}
            onChange={e => setForm(f => ({ ...f, cargo_fijo: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 El <strong>costo por kWh se calcula automáticamente</strong> cuando llegue la factura y
            estén todas las lecturas del mes: (factura − cargos fijos) ÷ consumo total. No se ingresa a mano.
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creando...' : 'Crear período y empezar a cargar lecturas →'}
        </button>
      </form>
    </div>
  )
}
