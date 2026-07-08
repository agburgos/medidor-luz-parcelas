'use client'

import { useState, useEffect } from 'react'

interface EstadoResultados {
  periodo: string
  ingresos: { detalles: Record<string, number>; total: number }
  gastos: { detalles: Record<string, number>; total: number }
  resultadoNeto: number
}

export default function EstadoResultadosPage() {
  const [datos, setDatos] = useState<EstadoResultados | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/transparencia/estado-resultados')
      .then(r => r.json())
      .then(d => { setDatos(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  if (loading) return <div className="p-8 text-gray-500">Cargando estado de resultados...</div>

  if (!datos) return <div className="p-8 text-red-600">Error al cargar datos</div>

  const labels: Record<string, string> = {
    recaudacion_luz: 'Recaudación Luz',
    recaudacion_gc: 'Recaudación Gastos Comunes',
    otros_ingresos: 'Otros ingresos',
    pago_compania: 'Pago compañía eléctrica',
    mantenimiento: 'Mantenimiento',
    administracion: 'Administración',
    otros_gastos: 'Otros gastos',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">📊 Estado de Resultados</h1>
      <p className="text-gray-500 text-sm mb-6">Situación consolidada de la comunidad (mes actual)</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Ingresos</p>
          <p className="text-2xl font-bold text-green-700">{$(datos.ingresos.total)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Gastos</p>
          <p className="text-2xl font-bold text-red-700">{$(datos.gastos.total)}</p>
        </div>
        <div className={`${datos.resultadoNeto >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-xl p-4`}>
          <p className="text-xs text-gray-500">Resultado Neto</p>
          <p className={`text-2xl font-bold ${datos.resultadoNeto >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {$(datos.resultadoNeto)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingresos */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4 text-green-700">📈 Ingresos</h2>
          <div className="space-y-2">
            {Object.entries(datos.ingresos.detalles).map(([key, monto]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-gray-600">{labels[key as keyof typeof labels] || key}</span>
                <span className="font-medium">{$(monto)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>Total Ingresos</span>
              <span className="text-green-700">{$(datos.ingresos.total)}</span>
            </div>
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-700">📉 Gastos</h2>
          <div className="space-y-2">
            {Object.entries(datos.gastos.detalles).map(([key, monto]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-gray-600">{labels[key as keyof typeof labels] || key}</span>
                <span className="font-medium">{$(monto)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>Total Gastos</span>
              <span className="text-red-700">{$(datos.gastos.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Transparencia:</strong> Este estado refleja la situación financiera consolidada de toda la comunidad.
          Cada parcelero puede ver cómo se distribuyen ingresos y gastos para garantizar que todo cuadre con el prorrateo de cada periodo.
        </p>
      </div>
    </div>
  )
}
