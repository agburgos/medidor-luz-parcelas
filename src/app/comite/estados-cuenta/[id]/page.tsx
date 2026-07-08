'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Movimiento {
  fecha: string
  tipo: 'cargo' | 'pago'
  concepto: string
  monto: number
  categoria: 'luz' | 'gc' | 'mora'
  saldo_acumulado: number
}

interface EstadoCuenta {
  parcela: { id: string; numero: number; nombre_dueno: string; email: string | null; telefono: string | null }
  movimientos: Movimiento[]
  resumen: { total_cargos: number; total_pagos: number; saldo: number }
}

const CATEGORIA_BADGE: Record<string, string> = { luz: 'bg-yellow-100 text-yellow-800', gc: 'bg-purple-100 text-purple-700', mora: 'bg-red-100 text-red-700' }
const CATEGORIA_LABEL: Record<string, string> = { luz: '⚡ Luz', gc: '🏘️ GC', mora: '⚠️ Mora' }

export default function EstadoCuentaDetallePage() {
  const { id } = useParams() as { id: string }
  const [datos, setDatos] = useState<EstadoCuenta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 20

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/parcelas/${id}/estado-cuenta`)
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Error'); setLoading(false); return }
    setDatos(data)
    setLoading(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  if (loading) return <div className="p-8 text-gray-500">Cargando estado de cuenta...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!datos) return null

  const cronologico = [...datos.movimientos].reverse()
  const totalPaginas = Math.max(1, Math.ceil(cronologico.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = cronologico.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📄 Estado de Cuenta — Parcela #{datos.parcela.numero}</h1>
          <p className="text-gray-500 text-sm">{datos.parcela.nombre_dueno} {datos.parcela.email && `· ${datos.parcela.email}`}</p>
        </div>
        <Link href="/comite/estados-cuenta" className="border border-gray-400 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">
          ← Volver
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total cargado</p>
          <p className="text-xl font-bold">{$(datos.resumen.total_cargos)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total pagado</p>
          <p className="text-xl font-bold text-green-600">{$(datos.resumen.total_pagos)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${datos.resumen.saldo > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <p className="text-xs text-gray-500">Saldo pendiente</p>
          <p className={`text-xl font-bold ${datos.resumen.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {datos.resumen.saldo > 0 ? $(datos.resumen.saldo) : 'Al día ✓'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Historial completo ({cronologico.length})</h2>
          <span className="text-xs text-gray-400">Más reciente primero</span>
        </div>
        {cronologico.length === 0 ? (
          <p className="text-gray-400 text-sm p-8 text-center">Sin movimientos registrados</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Concepto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Movimiento</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((m, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-3">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORIA_BADGE[m.categoria]}`}>{CATEGORIA_LABEL[m.categoria]}</span>
                    </td>
                    <td className="px-4 py-3">{m.concepto}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.tipo === 'cargo' ? 'text-red-600' : 'text-green-600'}`}>
                      {m.tipo === 'cargo' ? '+' : '-'}{$(m.monto)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{$(m.saldo_acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cronologico.length > POR_PAGINA && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-gray-500">
              Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, cronologico.length)} de {cronologico.length}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
              <span className="text-gray-600">{paginaActual} / {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-right">
        <button onClick={() => window.print()} className="border border-gray-400 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">
          🖨 Imprimir / PDF
        </button>
      </div>
    </div>
  )
}
