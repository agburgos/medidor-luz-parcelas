'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Incidencia {
  id: string
  categoria: string
  descripcion: string | null
  estado: string
  latitud: number | null
  longitud: number | null
  confirmado_falsa_alarma: boolean
  fecha_activacion: string
  fecha_resolucion: string | null
  parcela: { numero: number; nombre_dueno: string; telefono: string | null }
}

const CATEGORIAS: Record<string, string> = {
  intruso: '🔴 Intruso / Robo',
  emergencia_medica: '🏥 Emergencia médica',
  incendio: '🔥 Incendio / Gas',
  otro: '⚠️ Otro',
  falsa_alarma: 'Falsa alarma',
}

const ESTADOS: Record<string, { label: string; clase: string }> = {
  activa: { label: '🔴 Activa', clase: 'bg-red-100 text-red-700' },
  investigando: { label: '🔎 Investigando', clase: 'bg-yellow-100 text-yellow-800' },
  resuelto: { label: '✅ Resuelto', clase: 'bg-green-100 text-green-700' },
  cancelado: { label: '⚪ Cancelado / Falsa alarma', clase: 'bg-gray-100 text-gray-600' },
}

export default function IncidenciasPage() {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [filtro, setFiltro] = useState<string>('todas')
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const url = filtro === 'todas' ? '/api/incidencias' : `/api/incidencias?estado=${filtro}`
    const res = await fetch(url)
    const data = await res.json()
    setIncidencias(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  const activas = incidencias.filter(i => i.estado === 'activa').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🚨 Incidencias</h1>
          <p className="text-gray-500 text-sm">Alertas de pánico y registro de incidentes</p>
        </div>
        {activas > 0 && (
          <div className="bg-red-100 text-red-700 rounded-full px-4 py-1.5 text-sm font-bold animate-pulse">
            {activas} activa{activas !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {['todas', 'activa', 'investigando', 'resuelto', 'cancelado'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border ${filtro === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {f === 'todas' ? 'Todas' : ESTADOS[f]?.label ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm p-8 text-center">Cargando...</div>
      ) : incidencias.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          No hay incidencias{filtro !== 'todas' ? ` con estado "${filtro}"` : ''}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {incidencias.map(inc => (
                <tr key={inc.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(inc.fecha_activacion).toLocaleString('es-CL')}</td>
                  <td className="px-4 py-3">#{inc.parcela.numero} — {inc.parcela.nombre_dueno}</td>
                  <td className="px-4 py-3">{CATEGORIAS[inc.categoria] ?? inc.categoria}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADOS[inc.estado]?.clase ?? ''}`}>
                      {ESTADOS[inc.estado]?.label ?? inc.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/comite/incidencias/${inc.id}`} className="text-blue-600 hover:underline">Ver detalle →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
