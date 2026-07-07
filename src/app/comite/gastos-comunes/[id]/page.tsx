'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import EstadoBadge from '@/components/ui/EstadoBadge'
import PagosCuenta from '@/components/comite/PagosCuenta'
import { EstadoCuenta } from '@/types'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface CuentaGC {
  id: string; monto: number; monto_pagado: number; estado: EstadoCuenta
  parcela: { numero: number; nombre_dueno: string }
  periodo: { mes: number; anio: number; valor_mensual: number }
}

export default function CuentasGCPage() {
  const { id } = useParams() as { id: string }
  const [cuentas, setCuentas] = useState<CuentaGC[]>([])
  const [loading, setLoading] = useState(true)
  const [pagosDe, setPagosDe] = useState<CuentaGC | null>(null)
  const [filtro, setFiltro] = useState<EstadoCuenta | 'todos'>('todos')

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/gc/periodos/${id}/cuentas`)
    const data = await res.json()
    setCuentas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return <div className="p-8 text-gray-500">Cargando cuentas...</div>

  const periodo = cuentas[0]?.periodo
  const filtradas = filtro === 'todos' ? cuentas : cuentas.filter(c => c.estado === filtro)
  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const totalRecaudado = cuentas.reduce((s, c) => s + c.monto_pagado, 0)
  const totalEsperado = cuentas.reduce((s, c) => s + c.monto, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Cuentas de Gastos Comunes</h1>
      {periodo && <p className="text-gray-500 text-sm mb-6">{meses[periodo.mes - 1]} {periodo.anio} — ${periodo.valor_mensual.toLocaleString('es-CL')} por parcela</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Recaudado</p>
          <p className="text-lg font-bold text-green-600">{$(totalRecaudado)}</p>
          <p className="text-xs text-gray-400">de {$(totalEsperado)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">En mora</p>
          <p className="text-lg font-bold text-red-600">{cuentas.filter(c => c.estado === 'mora').length}</p>
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
                <td className="px-4 py-2">#{c.parcela.numero}</td>
                <td className="px-4 py-2">{c.parcela.nombre_dueno}</td>
                <td className="px-4 py-2 text-right font-medium">{$(c.monto)}</td>
                <td className="px-4 py-2 text-right">{$(c.monto_pagado)}</td>
                <td className="px-4 py-2"><EstadoBadge estado={c.estado} /></td>
                <td className="px-4 py-2">
                  <button onClick={() => setPagosDe(c)} className="text-xs bg-green-100 text-green-700 rounded px-2 py-1 hover:bg-green-200">💰 Pagos</button>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin cuentas en este estado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pagosDe && (
        <PagosCuenta
          apiBase="/api/gc/cuentas"
          cuentaId={pagosDe.id}
          numero={pagosDe.parcela.numero}
          nombre={pagosDe.parcela.nombre_dueno}
          montoTotal={pagosDe.monto}
          montoPagado={pagosDe.monto_pagado}
          onCerrar={() => setPagosDe(null)}
          onActualizado={cargar}
        />
      )}
    </div>
  )
}
