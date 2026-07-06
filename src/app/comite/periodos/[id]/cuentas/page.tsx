'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import EstadoBadge from '@/components/ui/EstadoBadge'
import { EstadoCuenta, CuentaParcela } from '@/types'

type CuentaConParcela = CuentaParcela & {
  parcela: { numero: number; nombre_dueno: string; email: string }
  periodo: { mes: number; anio: number; monto_total_factura: number }
}

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function CuentasPage() {
  const { id } = useParams() as { id: string }
  const [cuentas, setCuentas] = useState<CuentaConParcela[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ estado: '', monto_pagado: '', observaciones: '', fecha_pago: '' })
  const [guardando, setGuardando] = useState(false)
  const [filtro, setFiltro] = useState<EstadoCuenta | 'todos'>('todos')
  const [enviandoAlertas, setEnviandoAlertas] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargarCuentas = useCallback(async () => {
    const res = await fetch(`/api/periodos/${id}/cuentas`)
    const data = await res.json()
    setCuentas(data)
    setLoading(false)
  }, [id])

  useEffect(() => { cargarCuentas() }, [cargarCuentas])

  function iniciarEdicion(c: CuentaConParcela) {
    setEditando(c.id)
    setForm({
      estado: c.estado,
      monto_pagado: String(c.monto_pagado),
      observaciones: c.observaciones || '',
      fecha_pago: c.fecha_pago || '',
    })
  }

  async function guardarEdicion(cuentaId: string) {
    setGuardando(true)
    const res = await fetch(`/api/cuentas/${cuentaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      await cargarCuentas()
      setEditando(null)
    }
    setGuardando(false)
  }

  async function registrarPago(c: CuentaConParcela) {
    const saldo = c.monto_prorrateado - c.monto_pagado
    const input = window.prompt(
      `Registrar pago de #${c.parcela.numero} ${c.parcela.nombre_dueno}\nSaldo pendiente: $${saldo.toLocaleString('es-CL')}\n\nMonto del pago:`,
      String(saldo > 0 ? saldo : '')
    )
    if (!input) return
    const monto = Number(input.replace(/[.$\s]/g, ''))
    if (!monto || monto <= 0) { setMensaje('❌ Monto inválido'); return }
    const res = await fetch(`/api/cuentas/${c.id}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto }),
    })
    const data = await res.json()
    if (!res.ok) { setMensaje(`❌ ${data.error}`); return }
    setMensaje(`✅ Pago de $${monto.toLocaleString('es-CL')} registrado. ${data.saldo > 0 ? `Saldo restante: $${data.saldo.toLocaleString('es-CL')}` : 'Cuenta saldada.'}`)
    await cargarCuentas()
  }

  async function enviarAlertas() {
    setEnviandoAlertas(true)
    const res = await fetch('/api/cron/alertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodo_id: id, forzar: true }),
    })
    const data = await res.json()
    setMensaje(res.ok ? `✅ ${data.enviados} correos enviados` : `Error: ${data.error}`)
    setEnviandoAlertas(false)
  }

  const filtradas = filtro === 'todos' ? cuentas : cuentas.filter(c => c.estado === filtro)
  const periodo = cuentas[0]?.periodo

  const totales = {
    total: cuentas.reduce((s, c) => s + c.monto_prorrateado, 0),
    pagado: cuentas.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.monto_prorrateado, 0),
    mora: cuentas.filter(c => c.estado === 'mora').length,
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando cuentas...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Cuentas y pagos</h1>
          {periodo && <p className="text-gray-500 text-sm">{meses[periodo.mes - 1]} {periodo.anio} — Total factura: ${periodo.monto_total_factura?.toLocaleString('es-CL')}</p>}
        </div>
        <button
          onClick={enviarAlertas}
          disabled={enviandoAlertas}
          className="bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {enviandoAlertas ? 'Enviando...' : '📧 Enviar alertas'}
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm text-blue-700 bg-blue-50 rounded p-2">{mensaje}</p>}

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Recaudado</p>
          <p className="text-lg font-bold text-green-600">${totales.pagado.toLocaleString('es-CL')}</p>
          <p className="text-xs text-gray-400">de ${totales.total.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">En mora</p>
          <p className="text-lg font-bold text-red-600">{totales.mora}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Pendientes</p>
          <p className="text-lg font-bold text-yellow-600">{cuentas.filter(c => c.estado === 'pendiente').length}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['todos','pendiente','pagado','pago_parcial','mora'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${filtro === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {f === 'todos' ? 'Todos' : f === 'pago_parcial' ? 'Pago parcial' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'todos' && ` (${cuentas.filter(c => c.estado === f).length})`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dueño</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Pagado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(c => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                {editando === c.id ? (
                  <td colSpan={6} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">#{c.parcela.numero} {c.parcela.nombre_dueno}</span>
                      <select
                        value={form.estado}
                        onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="pagado">Pagado</option>
                        <option value="pago_parcial">Pago parcial</option>
                        <option value="mora">Mora</option>
                      </select>
                      <input
                        type="number"
                        value={form.monto_pagado}
                        onChange={e => setForm(f => ({ ...f, monto_pagado: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm w-28"
                        placeholder="Monto pagado"
                      />
                      <input
                        type="date"
                        value={form.fecha_pago}
                        onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <input
                        type="text"
                        value={form.observaciones}
                        onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm flex-1 min-w-32"
                        placeholder="Observaciones"
                      />
                      <button
                        onClick={() => guardarEdicion(c.id)}
                        disabled={guardando}
                        className="bg-green-600 text-white rounded px-3 py-1 text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="text-gray-500 text-sm hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2">#{c.parcela.numero}</td>
                    <td className="px-4 py-2">{c.parcela.nombre_dueno}</td>
                    <td className="px-4 py-2 text-right font-medium">${c.monto_prorrateado.toLocaleString('es-CL')}</td>
                    <td className="px-4 py-2 text-right">${c.monto_pagado.toLocaleString('es-CL')}</td>
                    <td className="px-4 py-2"><EstadoBadge estado={c.estado} /></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {c.estado !== 'pagado' && (
                          <button
                            onClick={() => registrarPago(c)}
                            className="text-xs bg-green-100 text-green-700 rounded px-2 py-1 hover:bg-green-200"
                          >
                            💰 Pago
                          </button>
                        )}
                        <button
                          onClick={() => iniciarEdicion(c)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin cuentas en este estado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
