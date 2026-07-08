'use client'

import { useState, useEffect, useCallback } from 'react'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface PagoPendiente {
  id: string
  monto: number
  fecha: string
  metodo: string
  observacion: string | null
  comprobante_url: string | null
  combinado: boolean
  created_at: string
  tipo: 'luz' | 'gc'
  cuenta: {
    id: string
    periodo_id?: string
    periodo_gc_id?: string
    monto_prorrateado?: number
    monto?: number
    monto_pagado: number
    parcela: { numero: number; nombre_dueno: string }
    periodo: { mes: number; anio: number; monto_total_factura?: number }
  }
  recaudado_periodo?: number | null
}

const TIPO_BADGE: Record<string, string> = { luz: 'bg-yellow-100 text-yellow-800', gc: 'bg-purple-100 text-purple-700' }
const TIPO_LABEL: Record<string, string> = { luz: '⚡ Luz', gc: '🏘️ Gastos Comunes' }

export default function ValidarPagosPage() {
  const [pagos, setPagos] = useState<PagoPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [procesando, setProcesando] = useState<string | null>(null)
  const [tab, setTab] = useState<'validar' | 'registrar'>('validar')
  const [formRegistro, setFormRegistro] = useState({
    cuenta_id: '',
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    metodo: 'transferencia',
    observacion: '',
    comprobante: null as File | null,
  })
  const [registrando, setRegistrando] = useState(false)
  const [cuentas, setCuentas] = useState<any[]>([])

  const cargar = useCallback(async () => {
    const [luzRes, gcRes, cuentasRes] = await Promise.all([
      fetch('/api/pagos/pendientes'),
      fetch('/api/gc/pagos/pendientes'),
      fetch('/api/cuentas/por-pagar'),
    ])
    const luz = await luzRes.json()
    const gc = await gcRes.json()
    const cuentasData = await cuentasRes.json()
    const combinados = [
      ...(Array.isArray(luz) ? luz.map((p: PagoPendiente) => ({ ...p, tipo: 'luz' as const })) : []),
      ...(Array.isArray(gc) ? gc.map((p: PagoPendiente) => ({ ...p, tipo: 'gc' as const })) : []),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    setPagos(combinados)
    setCuentas(Array.isArray(cuentasData) ? cuentasData : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function accion(pago: PagoPendiente, tipo: 'validar' | 'rechazar') {
    const verbo = tipo === 'validar' ? 'Validar' : 'RECHAZAR'
    if (!confirm(`¿${verbo} el pago de $${pago.monto.toLocaleString('es-CL')} (${TIPO_LABEL[pago.tipo]}) de #${pago.cuenta.parcela.numero} ${pago.cuenta.parcela.nombre_dueno}?`)) return
    setProcesando(pago.id)
    const endpoint = pago.tipo === 'gc' ? `/api/gc/pagos/${pago.id}/validar` : `/api/pagos/${pago.id}/validar`
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: tipo }),
    })
    const data = await res.json()
    setMensaje(res.ok
      ? tipo === 'validar'
        ? `✅ Pago validado. Estado de la cuenta: ${data.estado_cuenta}`
        : '🚫 Pago rechazado (no afecta el saldo)'
      : `❌ ${data.error}`)
    setProcesando(null)
    await cargar()
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault()
    if (!formRegistro.cuenta_id || !formRegistro.monto) {
      setMensaje('❌ Selecciona cuenta y monto')
      return
    }
    setRegistrando(true)
    setMensaje('')

    const fd = new FormData()
    fd.append('cuenta_id', formRegistro.cuenta_id)
    fd.append('monto', formRegistro.monto)
    fd.append('fecha', formRegistro.fecha)
    fd.append('metodo', formRegistro.metodo)
    fd.append('observacion', formRegistro.observacion)
    if (formRegistro.comprobante) fd.append('comprobante', formRegistro.comprobante)

    const res = await fetch('/api/comite/pagos/registrar', {
      method: 'POST',
      body: fd,
    })
    const data = await res.json()
    if (res.ok) {
      setMensaje(`✅ ${data.mensaje}`)
      setFormRegistro({
        cuenta_id: '',
        monto: '',
        fecha: new Date().toISOString().slice(0, 10),
        metodo: 'transferencia',
        observacion: '',
        comprobante: null,
      })
      await cargar()
    } else {
      setMensaje(`❌ ${data.error}`)
    }
    setRegistrando(false)
  }

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  if (loading) return <div className="p-8 text-gray-500">Cargando pagos por validar...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">💳 Pagos de Luz</h1>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${pagos.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
          {pagos.length} por validar
        </span>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setTab('validar')}
          className={`px-4 py-2 text-sm font-medium ${tab === 'validar' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          ✓ Validar pagos ({pagos.length})
        </button>
        <button
          onClick={() => setTab('registrar')}
          className={`px-4 py-2 text-sm font-medium ${tab === 'registrar' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          📝 Registrar pago (validado automático)
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      {tab === 'registrar' ? (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Registrar Pago (validado automáticamente)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Cuando el comité registra un pago, se valida automáticamente. Los comprobantes subidos por parceleros requieren validación manual.
          </p>
          <form onSubmit={registrarPago} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Parcela</label>
                <select
                  value={formRegistro.cuenta_id}
                  onChange={e => setFormRegistro(f => ({ ...f, cuenta_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Selecciona una parcela —</option>
                  {cuentas.map(c => (
                    <option key={c.id} value={c.id}>
                      #{c.parcela?.numero} {c.parcela?.nombre_dueno} (${Math.round((c.monto_prorrateado || c.monto || 0) - (c.monto_pagado || 0)).toLocaleString('es-CL')} falta)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Monto $</label>
                <input
                  type="number"
                  value={formRegistro.monto}
                  onChange={e => setFormRegistro(f => ({ ...f, monto: e.target.value }))}
                  required
                  min={1}
                  placeholder="0"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  value={formRegistro.fecha}
                  onChange={e => setFormRegistro(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Método</label>
                <select
                  value={formRegistro.metodo}
                  onChange={e => setFormRegistro(f => ({ ...f, metodo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Comprobante (opcional)</label>
              <input
                type="file"
                onChange={e => setFormRegistro(f => ({ ...f, comprobante: e.target.files?.[0] || null }))}
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {formRegistro.comprobante && <p className="text-xs text-gray-500 mt-1">📎 {formRegistro.comprobante.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observación</label>
              <textarea
                value={formRegistro.observacion}
                onChange={e => setFormRegistro(f => ({ ...f, observacion: e.target.value }))}
                placeholder="Comentarios (opcional)"
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={registrando}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {registrando ? 'Registrando...' : '✅ Registrar y validar pago'}
            </button>
          </form>
        </div>
      ) : pagos.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          🎉 No hay pagos pendientes de validación
        </div>
      ) : (
        <div className="space-y-3">
          {pagos.map(p => {
            const total = p.cuenta.monto_prorrateado ?? p.cuenta.monto ?? 0
            const saldo = total - p.cuenta.monto_pagado
            return (
              <div key={p.id} className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-48">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[p.tipo]}`}>{TIPO_LABEL[p.tipo]}</span>
                    {p.combinado && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">🔗 Combinado</span>}
                  </div>
                  <p className="font-medium">#{p.cuenta.parcela.numero} — {p.cuenta.parcela.nombre_dueno}</p>
                  <p className="text-sm text-gray-500">
                    {meses[p.cuenta.periodo.mes - 1]} {p.cuenta.periodo.anio} · informado el {new Date(p.created_at).toLocaleDateString('es-CL')}
                  </p>
                  {p.observacion && <p className="text-xs text-gray-400 mt-0.5">&ldquo;{p.observacion}&rdquo;</p>}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-700">{$(p.monto)}</p>
                  <p className="text-xs text-gray-500 capitalize">{p.metodo} · {new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</p>
                  <p className="text-xs text-gray-400">Saldo cuenta: {$(saldo)}</p>
                  {p.tipo === 'luz' && p.recaudado_periodo != null && p.cuenta.periodo.monto_total_factura != null && (
                    <p className="text-xs text-gray-400">
                      Factura: falta {$(Math.max(p.cuenta.periodo.monto_total_factura - p.recaudado_periodo, 0))} de {$(p.cuenta.periodo.monto_total_factura)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {p.comprobante_url && (
                    <a
                      href={p.comprobante_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs border rounded px-3 py-2 text-blue-600 hover:bg-blue-50"
                    >
                      📎 Comprobante
                    </a>
                  )}
                  <button
                    onClick={() => accion(p, 'validar')}
                    disabled={procesando === p.id}
                    className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ Validar
                  </button>
                  <button
                    onClick={() => accion(p, 'rechazar')}
                    disabled={procesando === p.id}
                    className="border border-red-300 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
