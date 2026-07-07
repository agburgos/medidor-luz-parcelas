'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Asamblea {
  id: string; titulo: string; tipo: string; fecha: string; lugar: string | null; estado: string
}

const ESTADOS: Record<string, string> = { planificada: 'bg-blue-100 text-blue-700', realizada: 'bg-green-100 text-green-700', cancelada: 'bg-gray-100 text-gray-500' }

export default function AsambleasParceleroPage() {
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/asambleas').then(r => r.json()).then(data => {
      setAsambleas(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Cargando asambleas...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Asambleas y actas</h1>
      <p className="text-gray-500 text-sm mb-6">Reuniones, acuerdos y documentos de la directiva</p>

      <div className="space-y-3">
        {asambleas.map(a => (
          <Link key={a.id} href={`/parcelero/asambleas/${a.id}`} className="block bg-white rounded-xl border p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{a.titulo}</p>
                <p className="text-sm text-gray-500">
                  {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
                  {a.lugar ? ` · ${a.lugar}` : ''} · <span className="capitalize">{a.tipo}</span>
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADOS[a.estado]}`}>{a.estado}</span>
            </div>
          </Link>
        ))}
        {asambleas.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Aún no hay asambleas registradas</div>
        )}
      </div>
    </div>
  )
}
