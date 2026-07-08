'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Movimiento {
  id: string
  tipo: 'ingreso' | 'egreso'
  concepto: string
  monto: number
  fecha: string
  documento_url: string | null
  observacion: string | null
  created_at: string
}

export default function CajaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    tipo: 'ingreso' as 'ingreso' | 'egreso',
    concepto: '',
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    documento_url: '',
    observacion: '',
  })

  const cargar = useCallback(async () => {
    const res = await fetch('/api/caja/movimientos')
    const data = await res.json()
    setMovimientos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.concepto || !form.monto || !form.fecha) {
      setMensaje('❌ Concepto, monto y fecha son requeridos')
      return
    }
    setGuardando(true)
    setMensaje('')
    const res = await fetch('/api/caja/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
    } else {
      setMensaje(`✅ ${form.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`)
      setForm({ tipo: 'ingreso', concepto: '', monto: '', fecha: new Date().toISOString().slice(0, 10), documento_url: '', observacion: '' })
      await cargar()
    }
    setGuardando(false)
  }

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)
  const saldoActual = 169158 + totalIngresos - totalEgresos

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">💰 Caja y Tesorería</h1>
          <p className="text-gray-500 text-sm">Registro de ingresos y egresos de la comunidad</p>
        </div>
        <Link
          href="/comite/caja/libro-contable"
          className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700"
        >
          📊 Libro Contable
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Saldo Inicial</p>
          <p className="text-xl font-bold text-blue-700">$169.158</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total Ingresos</p>
          <p className="text-xl font-bold text-green-600">{$(totalIngresos)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total Egresos</p>
          <p className="text-xl font-bold text-red-600">{$(totalEgresos)}</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 mb-8">
        <p className="text-sm opacity-90">Saldo Actual</p>
        <p className="text-4xl font-bold">{$(saldoActual)}</p>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Nuevo Movimiento</h2>
        {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

        <form onSubmit={registrar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'ingreso' | 'egreso' }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="ingreso">📥 Ingreso</option>
                <option value="egreso">📤 Egreso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Concepto</label>
              <input
                type="text"
                value={form.concepto}
                onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                required
                placeholder="Ej: Pago IEL, Arriendo espacio"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Monto $</label>
              <input
                type="number"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                required min={1}
                placeholder="0"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Documento (URL opcional)</label>
            <input
              type="url"
              value={form.documento_url}
              onChange={e => setForm(f => ({ ...f, documento_url: e.target.value }))}
              placeholder="https://..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observación</label>
            <textarea
              value={form.observacion}
              onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
              placeholder="Comentarios adicionales..."
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Registrando...' : 'Registrar Movimiento'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Movimientos Recientes</h2>
        {loading ? (
          <div className="text-gray-500 text-sm p-8 text-center">Cargando movimientos...</div>
        ) : movimientos.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            No hay movimientos registrados
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Concepto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Observación</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.tipo === 'ingreso' ? '📥 Ingreso' : '📤 Egreso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.concepto}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{$(Number(m.monto))}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {m.observacion || (m.documento_url && '📎 Documento') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
