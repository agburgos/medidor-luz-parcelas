'use client'

import { useState, useEffect, useCallback } from 'react'

interface Pago {
  id: string
  monto: number
  fecha: string
  metodo: string
  estado: string
  observacion: string | null
  comprobante_url: string | null
  created_at: string
}

export default function PagosCuenta({
  cuentaId,
  numero,
  nombre,
  montoTotal,
  montoPagado,
  onCerrar,
  onActualizado,
  apiBase = '/api/cuentas',
}: {
  cuentaId: string
  numero: number
  nombre: string
  montoTotal: number
  montoPagado: number
  onCerrar: () => void
  onActualizado: () => void
  apiBase?: string
}) {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const saldoInicial = Math.max(montoTotal - montoPagado, 0)
  const [form, setForm] = useState({
    monto: String(saldoInicial || ''),
    fecha: new Date().toISOString().slice(0, 10),
    metodo: 'transferencia',
    observacion: '',
  })
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const pagoApiBase = apiBase.includes('/gc/') ? '/api/gc/pagos' : '/api/pagos'

  const cargar = useCallback(async () => {
    const res = await fetch(`${apiBase}/${cuentaId}/pagos`)
    const data = await res.json()
    setPagos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [cuentaId])

  useEffect(() => { cargar() }, [cargar])

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('monto', form.monto)
    fd.append('fecha', form.fecha)
    fd.append('metodo', form.metodo)
    fd.append('observacion', form.observacion)
    if (comprobante) fd.append('comprobante', comprobante)

    const res = await fetch(`${apiBase}/${cuentaId}/pagos`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
    } else {
      setMensaje(data.saldo > 0
        ? `✅ Pago registrado. Saldo restante: $${data.saldo.toLocaleString('es-CL')}`
        : '✅ Pago registrado. Cuenta saldada.')
      setForm(f => ({ ...f, monto: String(data.saldo || ''), observacion: '' }))
      setComprobante(null)
      await cargar()
      onActualizado()
    }
    setGuardando(false)
  }

  async function eliminar(pago: Pago) {
    if (!confirm(`¿Eliminar este pago de ${$(pago.monto)} (${new Date(pago.fecha + 'T00:00:00').toLocaleDateString('es-CL')})?\n\nEsto también quitará el movimiento correspondiente de Caja y recalculará el saldo de la cuenta.`)) return
    setEliminando(pago.id)
    setMensaje('')
    const res = await fetch(`${pagoApiBase}/${pago.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
    } else {
      setMensaje(`✅ Pago eliminado. Nuevo saldo: ${$(data.saldo)}`)
      await cargar()
      onActualizado()
    }
    setEliminando(null)
  }

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const totalValidado = pagos.filter(p => p.estado === 'validado').reduce((s, p) => s + Number(p.monto), 0)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCerrar}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Pagos — Parcela #{numero}</h2>
            <p className="text-sm text-gray-500">{nombre}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-500">Total cuenta: <strong>{$(montoTotal)}</strong></p>
            <p className="text-green-700">Pagado: <strong>{$(totalValidado)}</strong></p>
            <p className={montoTotal - totalValidado > 0 ? 'text-red-600' : 'text-green-600'}>
              Saldo: <strong>{$(Math.max(montoTotal - totalValidado, 0))}</strong>
            </p>
          </div>
        </div>

        {mensaje && <p className="mb-3 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

        {/* Historial auditable */}
        {loading ? (
          <p className="text-gray-500 text-sm py-4">Cargando historial...</p>
        ) : pagos.length > 0 ? (
          <div className="mb-5">
            <p className="text-sm font-medium mb-2">Historial de pagos (auditable)</p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Fecha</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Monto</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Método</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Comprobante</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Obs.</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id} className={`border-t ${p.estado === 'rechazado' ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2">{new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                    <td className="px-3 py-2 text-right font-medium">{$(p.monto)}</td>
                    <td className="px-3 py-2 capitalize">{p.metodo}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.estado === 'validado' ? 'bg-green-100 text-green-700'
                        : p.estado === 'rechazado' ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.estado === 'validado' ? '✓ Validado' : p.estado === 'rechazado' ? '✗ Rechazado' : '⏳ Por validar'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.comprobante_url
                        ? <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">📎 Ver</a>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{p.observacion || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => eliminar(p)}
                        disabled={eliminando === p.id}
                        className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-40"
                      >
                        {eliminando === p.id ? '...' : '🗑️ Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm mb-5">Sin pagos registrados en esta cuenta.</p>
        )}

        {/* Registrar nuevo pago */}
        <form onSubmit={registrar} className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">+ Registrar pago (en nombre del vecino)</p>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Monto ($) *</label>
              <input
                type="number"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                required min={1}
                className="border rounded-lg px-3 py-2 text-sm w-32"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Fecha del pago</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                required
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Método</label>
              <select
                value={form.metodo}
                onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Comprobante (foto o PDF — recomendado para auditoría)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setComprobante(e.target.files?.[0] || null)}
              className="text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-100 file:text-blue-700"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Observación</label>
            <input
              type="text"
              value={form.observacion}
              onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
              placeholder="Ej: pagó en efectivo en reunión del comité"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : '💰 Registrar pago'}
            </button>
            <button type="button" onClick={onCerrar} className="text-sm text-gray-500 hover:text-gray-700">Cerrar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
