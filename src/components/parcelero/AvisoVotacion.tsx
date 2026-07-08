'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Votacion {
  id: string
  titulo: string
  fecha_cierre: string
}

// Aviso breve en la página principal cuando hay votaciones abiertas
// donde el parcelero aún no ha votado.
export default function AvisoVotacion() {
  const [votaciones, setVotaciones] = useState<Votacion[]>([])

  useEffect(() => {
    fetch('/api/votaciones/pendientes').then(r => r.json()).then(d => setVotaciones(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  if (votaciones.length === 0) return null

  const primera = votaciones[0]
  const diasCierre = Math.ceil((new Date(primera.fecha_cierre).getTime() - Date.now()) / 86400000)
  const urgente = diasCierre <= 2

  return (
    <Link
      href="/parcelero/votaciones"
      className={`block rounded-xl border p-4 mb-6 hover:opacity-90 transition-opacity ${
        urgente ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'
      }`}
    >
      <p className={`font-medium ${urgente ? 'text-red-800' : 'text-blue-800'}`}>
        🗳️ {votaciones.length === 1 ? 'Tienes una votación nueva por realizar' : `Tienes ${votaciones.length} votaciones nuevas por realizar`}
      </p>
      <p className="text-sm text-gray-600 mt-0.5">
        {primera.titulo} — {diasCierre <= 0 ? 'cierra hoy' : `cierra en ${diasCierre} día${diasCierre !== 1 ? 's' : ''}`}. Haz clic aquí para votar →
      </p>
    </Link>
  )
}
