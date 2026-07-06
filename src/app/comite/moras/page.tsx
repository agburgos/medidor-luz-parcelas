'use client'

import { useState, useEffect, useCallback } from 'react'

interface Mora {
  id: string
  descripcion: string
  monto: number
  monto_pagado: number
  estado: string
  fecha_origen: string | null
  parcela: { numero: number; nombre_dueno: string }
}

interface ParcelaOpcion { id: string; numero: number; nombre_dueno: string }

export default function MorasPage() {
  const [moras, setMoras] = useState<Mora[]>([])
  const [parcelas, setParcelas] = useState<ParcelaOpcion[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState({ parcela_id: '', descripcion: '', monto: '', fecha_origen: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [morasRes, parcelasRes] = await Promise.all([
      fetch('/api/moras'),
      fetch('/api/parcelas'),
    ])
    const morasData = await morasRes.json()
    const parcelasData = await parcelasRes.json()
    setMoras(Array.isArray(morasData) ? morasData : [])
    setParcelas(Array.isArray(parcelasData) ? parcelasData : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje('')
    const res = await fetch('/api/moras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) setMensaje(`❌ ${data.error}`)
    else {
      setMensaje('✅ Mora registrada')
      setForm({ parcela_id: '', descripcion: '', monto: '', fecha_origen: '' })
      await cargar()
    }
    setGuardando(false)
  }

  async function abonar(m: Mora) {
    const saldo = m.monto - m.monto_pagado
    const input = window.prompt(
      `Abono a mora de #${m.parcela.numero} ${m.parcela.nombre_dueno}\n"${m.descripcion}"\nSaldo: $${saldo.toLocaleString('es-CL')}\n\nMonto del abono:`,
      String(saldo)
    )
    if (!input) return
    const abono = Number(input.replace(/[.$\s]/g, ''))
    if (!abono || abono <= 0) { setMensaje('❌ Monto inválido'); return }
    const res = await fetch(`/api/moras/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abono }),
    })
    const data = await res.json()
    setMensaje(res.ok ? `✅ Abono registrado (${data.estado})` : `❌ ${data.error}`)
    await cargar()
  }

  async function eliminar(m: Mora) {
    if (!confirm(`¿Eliminar la mora "${m.descripcion}" de #${m.parcela.numero}?`)) return
    await fetch(`/api/moras/${m.id}`, { method: 'DELETE' })
    setMensaje('✅ Mora eliminada')
    await cargar()
  }

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const deudaTotal = moras.filter(m => m.estado !== 'pagado').reduce((s, m) => s + (m.monto - m.monto_pagado), 0)

  if (loading) return <div className="p-8 text-gray-500">Cargando moras...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Moras anteriores</h1>
        <span className="text-sm text-gray-500">Deuda histórica pendiente: <strong className="text-red-600">{$(deudaTotal)}</strong></span>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Registra aquí las deudas que los parceleros arrastran de antes de usar este sistema (meses impagos históricos, cuotas pendientes, etc.). Aparecen en la deuda del parcelero y en los reportes de cobranza.
      </p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <form onSubmit={agregar} className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Parcela *</label>
          <select
            value={form.parcela_id}
            onChange={e => setForm(f => ({ ...f, parcela_id: e.target.value }))}
            required
            className="border rounded-lg px-3 py-2 text-sm min-w-52"
          >
            <option value="">Seleccionar...</option>
            {parcelas.map(p => (
              <option key={p.id} value={p.id}>#{p.numero} — {p.nombre_dueno}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción *</label>
          <input
            type="text"
            value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            required
            placeholder="Ej: Consumos impagos Ene-Feb 2026"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Monto ($) *</label>
          <input
            type="number"
            value={form.monto}
            onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
            required min={1}
            className="border rounded-lg px-3 py-2 text-sm w-32"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha origen</label>
          <input
            type="date"
            value={form.fecha_origen}
            onChange={e => setForm(f => ({ ...f, fecha_origen: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : '+ Agregar mora'}
        </button>
      </form>

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Origen</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Abonado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {moras.map(m => {
              const saldo = m.monto - m.monto_pagado
              return (
                <tr key={m.id} className={`border-t ${m.estado === 'pagado' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 font-medium">#{m.parcela.numero} {m.parcela.nombre_dueno}</td>
                  <td className="px-4 py-2">{m.descripcion}</td>
                  <td className="px-4 py-2 text-gray-500">{m.fecha_origen ? new Date(m.fecha_origen + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
                  <td className="px-4 py-2 text-right">{$(m.monto)}</td>
                  <td className="px-4 py-2 text-right text-green-700">{$(m.monto_pagado)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${saldo > 0 ? 'text-red-600' : 'text-gray-400'}`}>{saldo > 0 ? $(saldo) : '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.estado === 'pagado' ? 'bg-green-100 text-green-700'
                      : m.estado === 'pago_parcial' ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {m.estado === 'pago_parcial' ? 'Pago parcial' : m.estado.charAt(0).toUpperCase() + m.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {m.estado !== 'pagado' && (
                        <button onClick={() => abonar(m)} className="text-xs bg-green-100 text-green-700 rounded px-2 py-1 hover:bg-green-200">💰 Abonar</button>
                      )}
                      <button onClick={() => eliminar(m)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {moras.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Sin moras anteriores registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
