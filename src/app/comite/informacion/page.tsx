'use client'

import { useState, useEffect, useCallback } from 'react'

interface Info { id: string; titulo: string; contenido: string; orden: number }

export default function InformacionFijaPage() {
  const [items, setItems] = useState<Info[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [editContenido, setEditContenido] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch('/api/informacion-fija')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const res = await fetch('/api/informacion-fija', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, contenido }),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Publicado' : `❌ ${data.error}`)
    if (res.ok) { setTitulo(''); setContenido('') }
    setGuardando(false)
    await cargar()
  }

  function iniciarEdicion(i: Info) {
    setEditando(i.id)
    setEditTitulo(i.titulo)
    setEditContenido(i.contenido)
  }

  async function guardarEdicion(id: string) {
    const res = await fetch(`/api/informacion-fija/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: editTitulo, contenido: editContenido }),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Actualizado' : `❌ ${data.error}`)
    if (res.ok) setEditando(null)
    await cargar()
  }

  async function eliminar(i: Info) {
    if (!confirm(`¿Eliminar "${i.titulo}"?`)) return
    await fetch(`/api/informacion-fija/${i.id}`, { method: 'DELETE' })
    setMensaje('✅ Eliminado')
    await cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Información fija</h1>
      <p className="text-gray-500 text-sm mb-6">Datos permanentes de interés: cuenta corriente, contactos del comité, etc. — visible siempre para los parceleros, no es un anuncio temporal</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <form onSubmit={agregar} className="bg-white rounded-xl border p-5 space-y-3 mb-8">
        <input
          type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
          required placeholder="Título (ej: Datos para transferencias - Tesorería)" className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={contenido} onChange={e => setContenido(e.target.value)}
          required rows={5} placeholder={"Contenido (ej:\nMelissa López Leiva\nRUT: 15512982-4\nMercado Pago - Cuenta Vista\nNúmero de cuenta: 1037800678\nmety.lo@gmail.com)"}
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
        />
        <button type="submit" disabled={guardando} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {guardando ? 'Publicando...' : '+ Publicar información'}
        </button>
      </form>

      <div className="space-y-4">
        {items.map(i => (
          <div key={i.id} className="bg-white rounded-xl border p-5">
            {editando === i.id ? (
              <div className="space-y-3">
                <input type="text" value={editTitulo} onChange={e => setEditTitulo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-medium" />
                <textarea value={editContenido} onChange={e => setEditContenido(e.target.value)} rows={5} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                <div className="flex gap-2">
                  <button onClick={() => guardarEdicion(i.id)} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700">Guardar</button>
                  <button onClick={() => setEditando(null)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold">{i.titulo}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => iniciarEdicion(i)} className="text-xs text-blue-600 hover:underline">Editar</button>
                    <button onClick={() => eliminar(i)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{i.contenido}</p>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Sin información publicada aún</div>
        )}
      </div>
    </div>
  )
}
