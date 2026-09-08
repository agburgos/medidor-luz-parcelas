'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface PendienteLuz { cuenta_id: string; etiqueta: string; saldo: number }
interface ResumenLuz { etiqueta: string | null; saldo: number; saldoCuentas: number; deudaMoras: number; estado: string; totalFactura: number; recaudado: number; faltante: number; pendientes?: PendienteLuz[] }
interface ResumenGC { etiqueta: string | null; saldo: number; estado: string }

export default function InformarPagoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cuentaPreseleccionada = searchParams.get('cuenta')
  const [aplicaA, setAplicaA] = useState<'luz' | 'gc' | 'ambos'>('luz')
  const [cuentaLuzId, setCuentaLuzId] = useState('')
  const [pagarTodo, setPagarTodo] = useState(true)
  const [form, setForm] = useState({
    monto_luz: '', monto_gc: '',
    fecha: new Date().toISOString().slice(0, 10),
    metodo: 'transferencia', observacion: '',
  })
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [resumen, setResumen] = useState<{ luz: ResumenLuz | null; gc: ResumenGC | null } | null>(null)

  useEffect(() => {
    fetch('/api/pagos/mi-resumen').then(r => r.json()).then(data => {
      setResumen(data)
      const pendientes: PendienteLuz[] = data?.luz?.pendientes ?? []
      if (pendientes.length > 0) {
        const preseleccionada = cuentaPreseleccionada && pendientes.some(p => p.cuenta_id === cuentaPreseleccionada)
          ? cuentaPreseleccionada
          : pendientes[0].cuenta_id
        setCuentaLuzId(preseleccionada)
        // Por defecto "Pagar todo" está marcado: si hay varios períodos
        // pendientes, se sugiere la suma completa. Al desmarcarlo, queda solo
        // el monto del período elegido.
        const elegida = pendientes.find(p => p.cuenta_id === preseleccionada)
        const monto = pagarTodo ? data?.luz?.saldo : elegida?.saldo
        if (monto != null) setForm(f => ({ ...f, monto_luz: String(monto) }))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaPreseleccionada])

  function elegirCuenta(id: string) {
    setCuentaLuzId(id)
    if (pagarTodo) return // el monto ya es la suma total, no cambia según el período elegido
    const elegida = resumen?.luz?.pendientes?.find(p => p.cuenta_id === id)
    if (elegida) setForm(f => ({ ...f, monto_luz: String(elegida.saldo) }))
  }

  function togglePagarTodo(checked: boolean) {
    setPagarTodo(checked)
    if (checked) {
      if (resumen?.luz?.saldo != null) setForm(f => ({ ...f, monto_luz: String(resumen.luz!.saldo) }))
    } else {
      const elegida = resumen?.luz?.pendientes?.find(p => p.cuenta_id === cuentaLuzId)
      if (elegida) setForm(f => ({ ...f, monto_luz: String(elegida.saldo) }))
    }
  }

  const pendienteSeleccionada = resumen?.luz?.pendientes?.find(p => p.cuenta_id === cuentaLuzId)

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('aplica_a', aplicaA)
    if (pagarTodo && resumen?.luz?.pendientes && resumen.luz.pendientes.length > 1) {
      // Un pago por cada período pendiente, cada uno por su propio saldo —
      // así al validarse quedan TODOS marcados como pagados, no solo uno.
      fd.append('cuentas_luz', JSON.stringify(resumen.luz.pendientes.map(p => ({ cuenta_id: p.cuenta_id, monto: p.saldo }))))
    } else if (cuentaLuzId) {
      fd.append('cuenta_id_luz', cuentaLuzId)
    }
    fd.append('monto_luz', form.monto_luz)
    fd.append('monto_gc', form.monto_gc)
    fd.append('fecha', form.fecha)
    fd.append('metodo', form.metodo)
    fd.append('observacion', form.observacion)
    if (comprobante) fd.append('comprobante', comprobante)

    const res = await fetch('/api/pagos/informar-unificado', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { setMensaje(`❌ ${data.error}`); setEnviando(false); return }
    setMensaje(`✅ ${data.mensaje}`)
    setEnviando(false)
    setTimeout(() => router.push('/parcelero'), 1800)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Informar un pago</h1>
      <p className="text-gray-500 text-sm mb-6">Indica a qué corresponde tu comprobante antes de subirlo</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      {resumen && (resumen.luz || resumen.gc) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {resumen.luz && (aplicaA === 'luz' || aplicaA === 'ambos') && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-900 mb-1">⚡ Luz — {pagarTodo ? resumen.luz.etiqueta : (pendienteSeleccionada?.etiqueta ?? resumen.luz.etiqueta)}</p>
              <p className="text-sm text-gray-700">
                {pagarTodo ? 'Deuda total de luz: ' : 'Saldo de este período: '}
                <strong>{$(pagarTodo ? resumen.luz.saldo : (pendienteSeleccionada?.saldo ?? resumen.luz.saldo))}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Factura total {$(resumen.luz.totalFactura)} · recaudado por el macrolote {$(resumen.luz.recaudado)} · falta {resumen.luz.faltante > 0 ? $(resumen.luz.faltante) : '✓ cubierto'}
              </p>
            </div>
          )}
          {resumen.gc && (aplicaA === 'gc' || aplicaA === 'ambos') && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-900 mb-1">🏘️ Gastos Comunes — {resumen.gc.etiqueta}</p>
              <p className="text-sm text-gray-700">Tu saldo pendiente: <strong>{$(resumen.gc.saldo)}</strong></p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={enviar} className="bg-white rounded-xl border p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Este comprobante corresponde a:</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              { v: 'luz', l: '⚡ Solo Luz' },
              { v: 'gc', l: '🏘️ Solo Gastos Comunes' },
              { v: 'ambos', l: '🔗 Ambos' },
            ] as const).map(op => (
              <button
                key={op.v}
                type="button"
                onClick={() => setAplicaA(op.v)}
                className={`border rounded-lg py-2 text-sm font-medium transition-colors ${aplicaA === op.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {op.l}
              </button>
            ))}
          </div>
        </div>

        {(aplicaA === 'luz' || aplicaA === 'ambos') && (
          <div className="space-y-3">
            {resumen?.luz?.pendientes && resumen.luz.pendientes.length > 1 && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input
                    type="checkbox"
                    checked={pagarTodo}
                    onChange={e => togglePagarTodo(e.target.checked)}
                    className="rounded"
                  />
                  Pagar todo (suma los {resumen.luz.pendientes.length} períodos pendientes)
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {pagarTodo ? 'Este comprobante cubre desde:' : '¿A qué período corresponde este comprobante?'}
                </label>
                <select
                  value={cuentaLuzId}
                  onChange={e => elegirCuenta(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {resumen.luz.pendientes.map(p => (
                    <option key={p.cuenta_id} value={p.cuenta_id}>{p.etiqueta} — saldo {$(p.saldo)}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {pagarTodo
                    ? 'Desmarca "Pagar todo" si tu comprobante es solo por un período.'
                    : `Tienes ${resumen.luz.pendientes.length} períodos de luz pendientes. Si subes varios comprobantes, indica cada vez a cuál corresponde.`}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto para Luz ($)</label>
              <input
                type="number" value={form.monto_luz}
                onChange={e => setForm(f => ({ ...f, monto_luz: e.target.value }))}
                required min={1}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {(aplicaA === 'gc' || aplicaA === 'ambos') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto para Gastos Comunes ($)</label>
            <input
              type="number" value={form.monto_gc}
              onChange={e => setForm(f => ({ ...f, monto_gc: e.target.value }))}
              required min={1}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del pago</label>
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
            <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante (foto o PDF) *</label>
          <input
            type="file" accept="image/*,application/pdf" required
            onChange={e => setComprobante(e.target.files?.[0] || null)}
            className="w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-100 file:text-blue-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
          <input type="text" value={form.observacion} onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))} placeholder="Opcional" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <button type="submit" disabled={enviando} className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {enviando ? 'Enviando...' : 'Enviar al comité'}
        </button>
      </form>
    </div>
  )
}
