'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Incidencia {
  id: string
  categoria: string
  estado: string
  fecha_activacion: string
}

const CATEGORIAS: Record<string, string> = {
  intruso: '🔴 Intruso / Robo',
  emergencia_medica: '🏥 Emergencia médica',
  incendio: '🔥 Incendio / Gas',
  otro: '⚠️ Otro',
}

const ESTADOS: Record<string, string> = {
  activa: '🔴 Activa',
  investigando: '🔎 Investigando',
  resuelto: '✅ Resuelto',
  cancelado: '⚪ Falsa alarma',
}

export default function MisIncidenciasPage() {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/incidencias')
      .then(r => r.json())
      .then(data => setIncidencias(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">🚨 Mis incidencias reportadas</h1>
      <p className="text-gray-500 text-sm mb-6">Historial de alertas de pánico activadas desde tu parcela</p>

      {loading ? (
        <div className="text-gray-500 text-sm p-8 text-center">Cargando...</div>
      ) : incidencias.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          No has reportado ninguna incidencia
        </div>
      ) : (
        <div className="space-y-3">
          {incidencias.map(inc => (
            <Link
              key={inc.id}
              href={`/parcelero/incidencias/${inc.id}`}
              className="block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{CATEGORIAS[inc.categoria] ?? inc.categoria}</p>
                  <p className="text-sm text-gray-500">{new Date(inc.fecha_activacion).toLocaleString('es-CL')}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100">{ESTADOS[inc.estado] ?? inc.estado}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
