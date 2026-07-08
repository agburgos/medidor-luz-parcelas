'use client'

import { useState, useEffect } from 'react'

interface ResumenConsolidado {
  totalParcelas: number
  parcelasAlDia: number
  parcelasEnDeuda: number
  deudaTotalConsolidada: number
}

export default function EstadosCuentaPage() {
  const [datos, setDatos] = useState<ResumenConsolidado | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/transparencia/estados-cuenta')
      .then(r => r.json())
      .then(d => { setDatos(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>
  if (!datos) return <div className="p-8 text-red-600">Error al cargar datos</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">📊 Estados de Cuenta</h1>
      <p className="text-gray-500 text-sm mb-6">Resumen consolidado de deuda de la comunidad (Luz + Gastos Comunes + moras anteriores)</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total parcelas</p>
          <p className="text-xl font-bold">{datos.totalParcelas}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Deuda total consolidada</p>
          <p className="text-xl font-bold text-red-600">{$(datos.deudaTotalConsolidada)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Parcelas al día</p>
          <p className="text-2xl font-bold text-green-700">{datos.parcelasAlDia}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Parcelas con deuda</p>
          <p className="text-2xl font-bold text-red-700">{datos.parcelasEnDeuda}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Privacidad:</strong> Por transparencia se muestra el estado consolidado de la comunidad, sin identificar
          la situación financiera individual de cada parcela. Para ver tu propio estado de cuenta, revisa "Cuenta de luz" y
          "Gastos Comunes" en el menú "Mi macrolote".
        </p>
      </div>
    </div>
  )
}
