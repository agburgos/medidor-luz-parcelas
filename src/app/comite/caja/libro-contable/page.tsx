'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EstadoResultados {
  saldoInicial: number
  totalIngresos: number
  totalEgresos: number
  resultado: number
  saldoFinal: number
}

interface Movimiento {
  id: string
  tipo: 'ingreso' | 'egreso'
  concepto: string
  monto: number
  fecha: string
  saldo_acumulado: number
}

interface ResumenMensual {
  mes: string
  ingresos: { concepto: string; monto: number }[]
  totalIngresos: number
  egresos: { concepto: string; monto: number }[]
  totalEgresos: number
}

interface LibroContable {
  estadoResultados: EstadoResultados
  resumenMensual: ResumenMensual[]
  registroCronologico: Movimiento[]
}

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function LibroContablePage() {
  const [libro, setLibro] = useState<LibroContable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/caja/libro-contable')
      .then(r => r.json())
      .then(data => data.error ? setError(data.error) : setLibro(data))
      .finally(() => setLoading(false))
  }, [])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  if (loading) return <div className="p-8 text-gray-500">Generando libro contable...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!libro) return <div className="p-8 text-gray-500">No hay datos</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📊 Libro Contable</h1>
          <p className="text-gray-500 text-sm">Estado de resultados y movimientos de caja</p>
        </div>
        <Link
          href="/comite/caja"
          className="border border-gray-400 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          ← Volver
        </Link>
      </div>

      {/* ESTADO DE RESULTADOS */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Estado de Resultados</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Saldo Inicial</span>
            <span className="font-medium">{$(libro.estadoResultados.saldoInicial)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-center text-green-700">
            <span className="font-medium">+ Total Ingresos</span>
            <span className="font-bold">{$(libro.estadoResultados.totalIngresos)}</span>
          </div>
          <div className="flex justify-between items-center text-red-700">
            <span className="font-medium">- Total Egresos</span>
            <span className="font-bold">{$(libro.estadoResultados.totalEgresos)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="font-medium">Resultado del Período</span>
            <span className={`font-bold ${libro.estadoResultados.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {libro.estadoResultados.resultado >= 0 ? '+' : ''}{$(libro.estadoResultados.resultado)}
            </span>
          </div>
          <div className="border-t-2 border-black pt-2 flex justify-between items-center bg-blue-50 px-3 py-2 rounded">
            <span className="font-bold">Saldo Final</span>
            <span className="font-bold text-lg text-blue-700">{$(libro.estadoResultados.saldoFinal)}</span>
          </div>
        </div>
      </div>

      {/* RESUMEN MENSUAL */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Resumen Mensual por Concepto</h2>
        <div className="space-y-6">
          {libro.resumenMensual.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin movimientos</p>
          ) : (
            libro.resumenMensual.map((mes) => {
              const mesNum = parseInt(mes.mes.split('-')[1])
              const mesNombre = meses[mesNum - 1]
              return (
                <div key={mes.mes} className="border-b pb-6 last:border-b-0">
                  <h3 className="font-semibold mb-3">{mesNombre} {mes.mes.split('-')[0]}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-green-700 mb-2">Ingresos</h4>
                      <div className="space-y-1 text-sm">
                        {mes.ingresos.length === 0 ? (
                          <p className="text-gray-400">Sin ingresos</p>
                        ) : (
                          <>
                            {mes.ingresos.map((ing, i) => (
                              <div key={i} className="flex justify-between">
                                <span className="text-gray-600">{ing.concepto}</span>
                                <span className="font-medium text-green-700">{$(ing.monto)}</span>
                              </div>
                            ))}
                            <div className="border-t pt-1 flex justify-between font-bold text-green-700">
                              <span>Subtotal</span>
                              <span>{$(mes.totalIngresos)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-700 mb-2">Egresos</h4>
                      <div className="space-y-1 text-sm">
                        {mes.egresos.length === 0 ? (
                          <p className="text-gray-400">Sin egresos</p>
                        ) : (
                          <>
                            {mes.egresos.map((egr, i) => (
                              <div key={i} className="flex justify-between">
                                <span className="text-gray-600">{egr.concepto}</span>
                                <span className="font-medium text-red-700">{$(egr.monto)}</span>
                              </div>
                            ))}
                            <div className="border-t pt-1 flex justify-between font-bold text-red-700">
                              <span>Subtotal</span>
                              <span>{$(mes.totalEgresos)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* REGISTRO CRONOLÓGICO DETALLADO */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Registro Cronológico Detallado</h2>
        {libro.registroCronologico.length === 0 ? (
          <p className="text-gray-400 text-sm p-8 text-center">Sin movimientos</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Concepto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Movimiento</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {libro.registroCronologico.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.tipo === 'ingreso' ? '📥' : '📤'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{m.concepto}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{$(Number(m.monto))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{$(m.saldo_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 text-right">
        <button
          onClick={() => window.print()}
          className="border border-gray-400 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          🖨 Imprimir / PDF
        </button>
      </div>
    </div>
  )
}
