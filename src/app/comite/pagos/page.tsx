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
  created_at: string
  cuenta: {
    id: string
    monto_prorrateado: number
    monto_pagado: number
    parcela: { numero: number; nombre_dueno: string }
    periodo: { mes: number; anio: number }
  }
}

export default function ValidarPagosPage() {
  const [pagos, setPagos] = useState<PagoPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [procesando, setProcesando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/pagos/pendientes')
    const data = await res.json()
    setPagos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function accion(pago: PagoPendiente, tipo: 'validar' | 'rechazar') {
    const verbo = tipo === 'validar' ? 'Validar' : 'RECHAZAR'
    if (!confirm(`¿${verbo} el pago de $${pago.monto.toLocaleString('es-CL')} de #${pago.cuenta.parcela.numero} ${pago.cuenta.parcela.nombre_dueno}?`)) return
    setProcesando(pago.id)
    const res = await fetch(`/api/pagos/${pago.id}/validar`, {
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

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  if (loading) return <div className="p-8 text-gray-500">Cargando pagos por validar...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Validación de pagos</h1>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${pagos.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
          {pagos.length} por validar
        </span>
      </div>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      {pagos.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          🎉 No hay pagos pendientes de validación
        </div>
      ) : (
        <div className="space-y-3">
          {pagos.map(p => {
            const saldo = p.cuenta.monto_prorrateado - p.cuenta.monto_pagado
            return (
              <div key={p.id} className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-48">
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
