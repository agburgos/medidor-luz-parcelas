'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import EstadoBadge from '@/components/ui/EstadoBadge'
import { EstadoCuenta } from '@/types'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface CuentaGC {
  id: string; monto: number; monto_pagado: number; estado: EstadoCuenta
  periodo: { mes: number; anio: number; fecha_vencimiento: string; fecha_corte: string | null }
}

interface PeriodoGC { id: string; mes: number; anio: number; documento_url: string | null }

export default function MisGastosComunesPage() {
  const [cuentas, setCuentas] = useState<CuentaGC[]>([])
  const [facturas, setFacturas] = useState<PeriodoGC[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/gc/mi-cuenta').then(r => r.json()),
      fetch('/api/gc/periodos').then(r => r.json()),
    ]).then(([cuentasData, periodosData]) => {
      setCuentas(Array.isArray(cuentasData) ? cuentasData : [])
      setFacturas(Array.isArray(periodosData) ? periodosData.filter((p: PeriodoGC) => p.documento_url) : [])
      setLoading(false)
    })
  }, [])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const actual = cuentas[0]

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Gastos Comunes</h1>

      {actual && (
        <div className={`rounded-xl border p-5 mb-6 ${actual.estado === 'mora' ? 'border-red-300 bg-red-50' : actual.estado === 'pagado' ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">{meses[actual.periodo.mes - 1]} {actual.periodo.anio}</p>
              <p className="text-3xl font-bold">{$(actual.monto)}</p>
              {actual.monto_pagado > 0 && (
                <p className="text-sm text-gray-500 mt-1">Pagado: {$(actual.monto_pagado)} · Saldo: <strong className="text-red-600">{$(Math.max(actual.monto - actual.monto_pagado, 0))}</strong></p>
              )}
            </div>
            <EstadoBadge estado={actual.estado} />
          </div>
          <p className="text-sm text-gray-500 mt-2">Vencimiento: {new Date(actual.periodo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')}</p>
          {actual.estado !== 'pagado' && (
            <Link href="/parcelero/pagos/informar" className="inline-block mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
              💸 Informar un pago
            </Link>
          )}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Historial</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Pagado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map(c => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{meses[c.periodo.mes - 1]} {c.periodo.anio}</td>
                <td className="px-4 py-2 text-right">{$(c.monto)}</td>
                <td className="px-4 py-2 text-right">{$(c.monto_pagado)}</td>
                <td className="px-4 py-2"><EstadoBadge estado={c.estado} /></td>
              </tr>
            ))}
            {cuentas.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin cuentas de gastos comunes aún</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3 mt-8">📄 Facturas históricas</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {facturas.map(f => (
              <tr key={f.id} className="border-t">
                <td className="px-4 py-2">{meses[f.mes - 1]} {f.anio}</td>
                <td className="px-4 py-2"><a href={f.documento_url!} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">📎 Ver / descargar</a></td>
              </tr>
            ))}
            {facturas.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Sin facturas disponibles aún</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
