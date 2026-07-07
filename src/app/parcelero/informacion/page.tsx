'use client'

import { useState, useEffect } from 'react'

interface Info { id: string; titulo: string; contenido: string }

export default function InformacionParceleroPage() {
  const [items, setItems] = useState<Info[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/informacion-fija').then(r => r.json()).then(data => {
      setItems(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Información del macrolote</h1>
      <p className="text-gray-500 text-sm mb-6">Datos permanentes de interés (cuenta corriente, contactos, etc.)</p>

      <div className="space-y-4">
        {items.map(i => (
          <div key={i.id} className="bg-white rounded-xl border p-5">
            <h3 className="font-bold mb-2">{i.titulo}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{i.contenido}</p>
          </div>
        ))}
        {items.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Sin información publicada aún</div>
        )}
      </div>
    </div>
  )
}
