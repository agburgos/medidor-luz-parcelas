'use client'

import { useState, useEffect } from 'react'

interface Periodo {
  mes: number
  anio: number
  ingresos: number
  gastos: number
  flujo: number
}

export default function FlujoCajaPage() {
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const res = await fetch('/api/transparencia/flujo-caja')
      const data = await res.json()
      setPeriodos(Array.isArray(data) ? data : [])
      setLoading(false)
    }
    cargar()
  }, [])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  if (loading) return <div className="p-8 text-gray-500">Cargando flujo de caja...</div>

  const maxMonto = Math.max(...periodos.flatMap(p => [p.ingresos, p.gastos]), 1000000)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">💰 Flujo de Caja</h1>
      <p className="text-gray-500 text-sm mb-6">Historial de ingresos y gastos por período</p>

      {periodos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>Sin movimientos registrados aún</p>
        </div>
      ) : (
        <>
          {/* Gráfico de barras simple */}
          <div className="bg-white rounded-xl border p-6 mb-6 overflow-x-auto">
            <div className="min-w-full">
              {periodos.map(p => (
                <div key={`${p.anio}-${p.mes}`} className="mb-6 pb-6 border-b last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{meses[p.mes - 1]} {p.anio}</span>
                    <span className={`text-sm font-semibold ${p.flujo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      Flujo: {$(p.flujo)}
                    </span>
                  </div>

                  {/* Barras */}
                  <div className="flex items-end gap-4 h-20 mb-2">
                    {/* Barra de ingresos */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className="w-full bg-green-500 rounded-t transition-all"
                        style={{ height: `${(p.ingresos / maxMonto) * 100}%`, minHeight: p.ingresos > 0 ? '4px' : '0' }}
                      />
                      <span className="text-xs text-green-700 font-medium mt-1">{$(p.ingresos)}</span>
                    </div>

                    {/* Barra de gastos */}
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className="w-full bg-red-500 rounded-t transition-all"
                        style={{ height: `${(p.gastos / maxMonto) * 100}%`, minHeight: p.gastos > 0 ? '4px' : '0' }}
                      />
                      <span className="text-xs text-red-700 font-medium mt-1">{$(p.gastos)}</span>
                    </div>
                  </div>

                  {/* Etiquetas */}
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>📈 Ingresos</span>
                    <span>📉 Gastos</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Ingresos</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Gastos</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Flujo Neto</th>
                </tr>
              </thead>
              <tbody>
                {periodos.map(p => (
                  <tr key={`${p.anio}-${p.mes}`} className="border-t">
                    <td className="px-4 py-2 font-medium">{meses[p.mes - 1]} {p.anio}</td>
                    <td className="px-4 py-2 text-right text-green-700">{$(p.ingresos)}</td>
                    <td className="px-4 py-2 text-right text-red-700">{$(p.gastos)}</td>
                    <td className={`px-4 py-2 text-right font-bold ${p.flujo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {$(p.flujo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Cómo leer:</strong> El flujo de caja muestra ingresos (recaudación) menos gastos por período.
          Un flujo positivo significa superávit; negativo significa déficit.
        </p>
      </div>
    </div>
  )
}
