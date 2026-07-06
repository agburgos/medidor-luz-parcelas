'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InformarPago({ cuentaId, saldo }: { cuentaId: string; saldo: number }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({
    monto: String(saldo),
    fecha: new Date().toISOString().slice(0, 10),
    metodo: 'transferencia',
    observacion: '',
  })
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('cuenta_id', cuentaId)
    fd.append('monto', form.monto)
    fd.append('fecha', form.fecha)
    fd.append('metodo', form.metodo)
    fd.append('observacion', form.observacion)
    if (comprobante) fd.append('comprobante', comprobante)

    const res = await fetch('/api/pagos/informar', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      setEnviando(false)
      return
    }
    setMensaje('✅ Pago informado. El comité lo validará y luego se reflejará en tu saldo.')
    setEnviando(false)
    setAbierto(false)
    router.refresh()
  }

  return (
    <div className="mt-4">
      {mensaje && <p className="mb-3 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}
      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          💸 Informar un pago
        </button>
      ) : (
        <form onSubmit={enviar} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-900">Informar pago realizado (el comité lo validará)</p>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Monto ($)</label>
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
            <label className="block text-xs text-gray-600 mb-1">Comprobante (foto o PDF, opcional pero recomendado)</label>
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
              placeholder="Ej: transferencia desde cuenta de mi esposa"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : 'Enviar al comité'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
