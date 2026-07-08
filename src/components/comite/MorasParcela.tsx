'use client'

import { useState, useEffect, useCallback } from 'react'

interface Mora {
  id: string
  descripcion: string
  monto: number
  monto_pagado: number
  estado: string
  fecha_origen: string | null
  tipo: string
}

const TIPOS: Record<string, string> = { luz: '⚡ Luz', gc: '🏘️ GC', otro: '📄 Otro' }
const TIPO_BADGE: Record<string, string> = { luz: 'bg-yellow-100 text-yellow-800', gc: 'bg-purple-100 text-purple-700', otro: 'bg-gray-100 text-gray-600' }

export default function MorasParcela({
  parcelaId,
  numero,
  nombre,
  onCerrar,
}: {
  parcelaId: string
  numero: number
  nombre: string
  onCerrar: () => void
}) {
  const [moras, setMoras] = useState<Mora[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState({ descripcion: '', monto: '', fecha_origen: '', tipo: 'luz' })
  const [guardando, setGuardando] = useState(false)
  const [formAbono, setFormAbono] = useState({ monto: '', fecha: new Date().toISOString().slice(0, 10), descripcion: '', tipo: '' })
  const [guardandoAbono, setGuardandoAbono] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/moras?parcela_id=${parcelaId}`)
    const data = await res.json()
    setMoras(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [parcelaId])

  useEffect(() => { cargar() }, [cargar])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje('')
    const res = await fetch('/api/moras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, parcela_id: parcelaId }),
    })
    const data = await res.json()
    if (!res.ok) setMensaje(`❌ ${data.error}`)
    else {
      setMensaje('✅ Mora registrada')
      setForm({ descripcion: '', monto: '', fecha_origen: '', tipo: 'luz' })
      await cargar()
    }
    setGuardando(false)
  }

  async function abonar(m: Mora) {
    const saldo = m.monto - m.monto_pagado
    const input = window.prompt(`Abono a "${m.descripcion}"\nSaldo: $${saldo.toLocaleString('es-CL')}\n\nMonto del abono:`, String(saldo))
    if (!input) return
    const abono = Number(input.replace(/[.$\s]/g, ''))
    if (!abono || abono <= 0) { setMensaje('❌ Monto inválido'); return }
    const res = await fetch(`/api/moras/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abono }),
    })
    const data = await res.json()
    setMensaje(res.ok ? `✅ Abono registrado (${data.estado === 'pagado' ? 'mora saldada' : 'pago parcial'})` : `❌ ${data.error}`)
    await cargar()
  }

  async function registrarAbonoGeneral(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoAbono(true)
    setMensaje('')
    const res = await fetch('/api/moras/abono-general', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcela_id: parcelaId, ...formAbono }),
    })
    const data = await res.json()
    if (!res.ok) setMensaje(`❌ ${data.error}`)
    else {
      const detalle = data.aplicaciones.length > 0
        ? `aplicado a ${data.aplicaciones.length} mora(s)${data.sobrante_sin_aplicar > 0 ? `, sobran ${$(data.sobrante_sin_aplicar)} sin mora a la cual aplicar` : ''}`
        : 'sin moras pendientes a las que aplicar (revisa el tipo elegido)'
      setMensaje(`✅ Abono de ${$(data.aplicado_total)} registrado — ${detalle}`)
      setFormAbono({ monto: '', fecha: new Date().toISOString().slice(0, 10), descripcion: '', tipo: '' })
      await cargar()
    }
    setGuardandoAbono(false)
  }

  async function eliminar(m: Mora) {
    if (!confirm(`¿Eliminar la mora "${m.descripcion}"?`)) return
    await fetch(`/api/moras/${m.id}`, { method: 'DELETE' })
    setMensaje('✅ Mora eliminada')
    await cargar()
  }

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const deuda = moras.filter(m => m.estado !== 'pagado').reduce((s, m) => s + (Number(m.monto) - Number(m.monto_pagado)), 0)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCerrar}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Moras anteriores — Parcela #{numero}</h2>
            <p className="text-sm text-gray-500">{nombre}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Deuda histórica</p>
            <p className={`text-lg font-bold ${deuda > 0 ? 'text-red-600' : 'text-green-600'}`}>{deuda > 0 ? $(deuda) : 'Sin deuda'}</p>
          </div>
        </div>

        {mensaje && <p className="mb-3 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

        {loading ? (
          <p className="text-gray-500 text-sm py-4">Cargando...</p>
        ) : (
          <>
            {moras.length > 0 && (
              <table className="w-full text-sm mb-5">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Descripción</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Origen</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Monto</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Saldo</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Estado</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {moras.map(m => {
                    const saldo = m.monto - m.monto_pagado
                    return (
                      <tr key={m.id} className={`border-t ${m.estado === 'pagado' ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[m.tipo] ?? TIPO_BADGE.otro}`}>{TIPOS[m.tipo] ?? m.tipo}</span>
                        </td>
                        <td className="px-3 py-2">{m.descripcion}</td>
                        <td className="px-3 py-2 text-gray-500">{m.fecha_origen ? new Date(m.fecha_origen + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
                        <td className="px-3 py-2 text-right">{$(m.monto)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${saldo > 0 ? 'text-red-600' : 'text-gray-400'}`}>{saldo > 0 ? $(saldo) : '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.estado === 'pagado' ? 'bg-green-100 text-green-700'
                            : m.estado === 'pago_parcial' ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {m.estado === 'pago_parcial' ? 'Parcial' : m.estado.charAt(0).toUpperCase() + m.estado.slice(1)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
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
                </tbody>
              </table>
            )}
            {moras.length === 0 && <p className="text-gray-400 text-sm mb-5">Esta parcela no tiene moras anteriores registradas.</p>}

            <form onSubmit={registrarAbonoGeneral} className="border-t pt-4 space-y-3 mb-5">
              <p className="text-sm font-medium">💰 Registrar abono nuevo (no asociado a un período)</p>
              <p className="text-xs text-gray-500 -mt-2">Se aplica automáticamente a la mora anterior pendiente más antigua de esta parcela.</p>
              <div className="flex flex-wrap gap-3">
                <select
                  value={formAbono.tipo}
                  onChange={e => setFormAbono(f => ({ ...f, tipo: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm"
                  title="Filtrar por tipo (opcional)"
                >
                  <option value="">Cualquier tipo</option>
                  <option value="luz">⚡ Luz</option>
                  <option value="gc">🏘️ Gastos Comunes</option>
                  <option value="otro">📄 Otro</option>
                </select>
                <input
                  type="number"
                  value={formAbono.monto}
                  onChange={e => setFormAbono(f => ({ ...f, monto: e.target.value }))}
                  required min={1}
                  placeholder="Monto del abono $"
                  className="border rounded-lg px-3 py-2 text-sm w-40"
                />
                <input
                  type="date"
                  value={formAbono.fecha}
                  onChange={e => setFormAbono(f => ({ ...f, fecha: e.target.value }))}
                  required
                  className="border rounded-lg px-3 py-2 text-sm"
                  title="Fecha del abono"
                />
                <input
                  type="text"
                  value={formAbono.descripcion}
                  onChange={e => setFormAbono(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Observación (opcional)"
                  className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={guardandoAbono}
                  className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {guardandoAbono ? '...' : 'Registrar abono'}
                </button>
              </div>
            </form>

            <form onSubmit={agregar} className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">+ Agregar mora a esta parcela</p>
              <div className="flex flex-wrap gap-3">
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="luz">⚡ Luz</option>
                  <option value="gc">🏘️ Gastos Comunes</option>
                  <option value="otro">📄 Otro</option>
                </select>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  required
                  placeholder="Descripción (ej: Consumos impagos Ene-Feb 2026)"
                  className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  required min={1}
                  placeholder="Monto $"
                  className="border rounded-lg px-3 py-2 text-sm w-28"
                />
                <input
                  type="date"
                  value={form.fecha_origen}
                  onChange={e => setForm(f => ({ ...f, fecha_origen: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm"
                  title="Fecha de origen"
                />
                <button
                  type="submit"
                  disabled={guardando}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? '...' : 'Agregar'}
                </button>
              </div>
            </form>
          </>
        )}

        <div className="mt-5 text-right">
          <button onClick={onCerrar} className="text-sm text-gray-500 hover:text-gray-700">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
