'use client'

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
}

export default function VotacionesPage() {
  const [votaciones, setVotaciones] = useState<Votacion[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo_conteo: 'unica' as 'unica' | 'multiple',
    es_secreta: true,
    visibilidad_resultados: 'en_vivo' as 'solo_al_cerrar' | 'en_vivo' | 'en_vivo_comite',
    fecha_inicio: new Date().toISOString(),
    fecha_cierre: '',
    opciones: [{ texto: '', foto: null as File | null }],
  })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    cargarVotaciones()
  }, [])

  async function cargarVotaciones() {
    const res = await fetch('/api/votaciones')
    const data = await res.json()
    setVotaciones(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function crearVotacion(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)

    // Subir fotos a Storage primero
    const opcionesConFotos = await Promise.all(
      formData.opciones.map(async (op) => {
        let foto_url = null
        if (op.foto) {
          const formData2 = new FormData()
          formData2.append('file', op.foto)
          formData2.append('bucket', 'votaciones')
          const resUpload = await fetch('/api/upload', { method: 'POST', body: formData2 })
          const dataUpload = await resUpload.json()
          foto_url = dataUpload.url
        }
        return { texto: op.texto, foto_url }
      })
    )

    // Crear votación
    const res = await fetch('/api/votaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: formData.titulo,
        descripcion: formData.descripcion || null,
        tipo_conteo: formData.tipo_conteo,
        es_secreta: formData.es_secreta,
        visibilidad_resultados: formData.visibilidad_resultados,
        fecha_inicio: formData.fecha_inicio,
        fecha_cierre: formData.fecha_cierre,
        opciones: opcionesConFotos,
      }),
    })

    if (res.ok) {
      alert('Votación creada exitosamente')
      setMostrarFormulario(false)
      setFormData({
        titulo: '',
        descripcion: '',
        tipo_conteo: 'unica',
        es_secreta: true,
        visibilidad_resultados: 'en_vivo',
        fecha_inicio: new Date().toISOString(),
        fecha_cierre: '',
        opciones: [{ texto: '', foto: null }],
      })
      cargarVotaciones()
    } else {
      const error = await res.json()
      alert('Error: ' + (error.error || 'no se pudo crear'))
    }
    setEnviando(false)
  }

  function agregarOpcion() {
    setFormData(f => ({
      ...f,
      opciones: [...f.opciones, { texto: '', foto: null }],
    }))
  }

  function eliminarOpcion(idx: number) {
    setFormData(f => ({
      ...f,
      opciones: f.opciones.filter((_, i) => i !== idx),
    }))
  }

  const hoy = new Date().toISOString().split('T')[0]

  if (loading) return <div className="p-8 text-gray-500">Cargando votaciones...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🗳️ Votaciones</h1>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {mostrarFormulario ? '✕ Cancelar' : '+ Nueva votación'}
        </button>
      </div>

      {mostrarFormulario && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Crear nueva votación</h2>

          <form onSubmit={crearVotacion} className="space-y-4">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium mb-1">Título *</label>
              <input
                type="text"
                value={formData.titulo}
                onChange={e => setFormData(f => ({ ...f, titulo: e.target.value }))}
                placeholder="ej: Asamblea 2024 - Elección de directiva"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={e => setFormData(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Detalles de la votación..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Tipo de conteo */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de conteo *</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="unica"
                    checked={formData.tipo_conteo === 'unica'}
                    onChange={e => setFormData(f => ({ ...f, tipo_conteo: e.target.value as 'unica' | 'multiple' }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Una opción (única)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="multiple"
                    checked={formData.tipo_conteo === 'multiple'}
                    onChange={e => setFormData(f => ({ ...f, tipo_conteo: e.target.value as 'unica' | 'multiple' }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Múltiples opciones</span>
                </label>
              </div>
            </div>

            {/* Secreta */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.es_secreta}
                  onChange={e => setFormData(f => ({ ...f, es_secreta: e.target.checked }))}
                  className="mr-2 rounded"
                />
                <span className="text-sm font-medium">Votación secreta (no se vé quién votó qué)</span>
              </label>
            </div>

            {/* Visibilidad de resultados */}
            <div>
              <label className="block text-sm font-medium mb-2">Visibilidad de resultados *</label>
              <select
                value={formData.visibilidad_resultados}
                onChange={e => setFormData(f => ({ ...f, visibilidad_resultados: e.target.value as any }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="solo_al_cerrar">Solo al cerrar la votación</option>
                <option value="en_vivo">En vivo (visible para todos)</option>
                <option value="en_vivo_comite">En vivo (solo comité)</option>
              </select>
            </div>

            {/* Fecha de cierre */}
            <div>
              <label className="block text-sm font-medium mb-1">Fecha y hora de cierre *</label>
              <input
                type="datetime-local"
                value={formData.fecha_cierre}
                onChange={e => setFormData(f => ({ ...f, fecha_cierre: e.target.value }))}
                min={hoy}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Opciones */}
            <div>
              <label className="block text-sm font-medium mb-2">Opciones de votación *</label>
              <div className="space-y-3">
                {formData.opciones.map((op, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={op.texto}
                        onChange={e => {
                          const nuevas = [...formData.opciones]
                          nuevas[idx].texto = e.target.value
                          setFormData(f => ({ ...f, opciones: nuevas }))
                        }}
                        placeholder={`Opción ${idx + 1}`}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="flex items-center px-3 py-2 border rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100">
                        <span className="text-xs text-gray-600">📷 Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            const nuevas = [...formData.opciones]
                            nuevas[idx].foto = e.target.files?.[0] || null
                            setFormData(f => ({ ...f, opciones: nuevas }))
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {formData.opciones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarOpcion(idx)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={agregarOpcion}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Agregar opción
              </button>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {enviando ? 'Creando...' : 'Crear votación'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                className="flex-1 px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Listado de votaciones */}
      <div className="space-y-4">
        {votaciones.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
            <p className="text-gray-500">Sin votaciones creadas aún</p>
            <p className="text-xs text-gray-400 mt-1">Crea la primera votación para la comunidad</p>
          </div>
        ) : (
          votaciones.map(v => (
            <div key={v.id} className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{v.titulo}</h3>
                  {v.descripcion && <p className="text-sm text-gray-600 mt-1">{v.descripcion}</p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  v.estado === 'abierta' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {v.estado === 'abierta' ? '🔓 Abierta' : '🔒 Cerrada'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600 mb-4">
                <div>
                  <span className="text-gray-500">Tipo:</span>
                  <p className="font-medium">{v.tipo_conteo === 'unica' ? 'Una opción' : 'Múltiples'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Privacidad:</span>
                  <p className="font-medium">{v.es_secreta ? 'Secreta' : 'Nominativa'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Resultados:</span>
                  <p className="font-medium text-xs">
                    {v.visibilidad_resultados === 'solo_al_cerrar' && 'Solo al cerrar'}
                    {v.visibilidad_resultados === 'en_vivo' && 'En vivo'}
                    {v.visibilidad_resultados === 'en_vivo_comite' && 'Vivo (comité)'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Cierra:</span>
                  <p className="font-medium">{new Date(v.fecha_cierre).toLocaleDateString('es-CL')}</p>
                </div>
              </div>

              <Link
                href={`/comite/votaciones/${v.id}`}
                className="inline-block px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
              >
                Ver detalles y resultados →
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
