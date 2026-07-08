'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Votacion {
  id: string
  titulo: string
  descripcion: string | null
  tipo_conteo: 'unica' | 'multiple'
  es_secreta: boolean
  visibilidad_resultados: 'solo_al_cerrar' | 'en_vivo' | 'en_vivo_comite'
  fecha_inicio: string
  fecha_cierre: string
  estado: 'abierta' | 'cerrada'
}

interface Opcion {
  id: string
  texto: string
  foto_url: string | null
  votos: number
  porcentaje: number
}

interface Resultados {
  votacion: Votacion
  opciones: Opcion[]
  participacion: number
  totalVotos: number
}

export default function VotacionDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [datos, setDatos] = useState<Resultados | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const res = await fetch(`/api/votaciones/${id}/resultados`)
      if (res.ok) {
        const data = await res.json()
        setDatos(data)
      }
      setLoading(false)
    }
    cargar()
  }, [id])

  if (loading) return <div className="p-8 text-gray-500">Cargando votación...</div>
  if (!datos) return <div className="p-8 text-red-600">Error al cargar votación</div>

  const v = datos.votacion
  const diasRestantes = Math.ceil(
    (new Date(v.fecha_cierre).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div>
      <Link href="/comite/votaciones" className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block">
        ← Volver a votaciones
      </Link>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{v.titulo}</h1>
            {v.descripcion && <p className="text-gray-600 mt-2">{v.descripcion}</p>}
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
            v.estado === 'abierta' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {v.estado === 'abierta' ? '🔓 Abierta' : '🔒 Cerrada'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500 text-xs">Tipo</p>
            <p className="font-semibold">{v.tipo_conteo === 'unica' ? 'Una opción' : 'Múltiples'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500 text-xs">Privacidad</p>
            <p className="font-semibold">{v.es_secreta ? '🔐 Secreta' : '👁️ Nominativa'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500 text-xs">Resultados</p>
            <p className="font-semibold text-xs">
              {v.visibilidad_resultados === 'solo_al_cerrar' && 'Solo al cerrar'}
              {v.visibilidad_resultados === 'en_vivo' && 'En vivo'}
              {v.visibilidad_resultados === 'en_vivo_comite' && 'Vivo (comité)'}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500 text-xs">Cierra en</p>
            <p className="font-semibold">{diasRestantes > 0 ? `${diasRestantes}d` : 'Cerrada'}</p>
          </div>
        </div>
      </div>

      {/* Participación */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">📊 Participación</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-gray-500 text-xs">Total de votos</p>
            <p className="text-3xl font-bold text-blue-700">{datos.totalVotos}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-gray-500 text-xs">Participación</p>
            <p className="text-3xl font-bold text-purple-700">{datos.participacion}%</p>
          </div>
        </div>
      </div>

      {/* Resultados por opción */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">🗳️ Resultados</h2>
        <div className="space-y-4">
          {datos.opciones.map((op, idx) => (
            <div key={op.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  {op.foto_url && (
                    <img
                      src={op.foto_url}
                      alt={op.texto}
                      className="w-12 h-12 rounded-lg object-cover inline-block mr-2"
                    />
                  )}
                  <span className="font-medium">{op.texto}</span>
                </div>
                <span className="text-sm font-semibold text-gray-600">{op.votos} votos ({op.porcentaje}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all"
                  style={{ width: `${op.porcentaje}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-500 bg-gray-50 rounded-lg p-4">
        <p>
          <strong>Nota:</strong> Como comité, ves todos los resultados en tiempo real independientemente de la visibilidad configurada.
          Los parceleros verán esto según la opción de visibilidad elegida.
        </p>
      </div>
    </div>
  )
}
