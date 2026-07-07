'use client'

import { useState, useEffect, useCallback } from 'react'

interface Archivo { tipo: string; url: string; nombre: string | null }
interface Anuncio {
  id: string; titulo: string; contenido: string | null; created_at: string
  archivos: Archivo[]; likes: number; dislikes: number
}

export default function AnunciosPage() {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [fotos, setFotos] = useState<FileList | null>(null)
  const [documentos, setDocumentos] = useState<FileList | null>(null)
  const [publicando, setPublicando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/anuncios')
    const data = await res.json()
    setAnuncios(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    setPublicando(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('titulo', titulo)
    fd.append('contenido', contenido)
    if (fotos) Array.from(fotos).forEach(f => fd.append('fotos', f))
    if (documentos) Array.from(documentos).forEach(f => fd.append('documentos', f))

    const res = await fetch('/api/anuncios', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) setMensaje(`❌ ${data.error}`)
    else {
      setMensaje('✅ Anuncio publicado')
      setTitulo(''); setContenido(''); setFotos(null); setDocumentos(null)
    }
    setPublicando(false)
    await cargar()
  }

  async function eliminar(a: Anuncio) {
    if (!confirm(`¿Eliminar el anuncio "${a.titulo}"?`)) return
    await fetch(`/api/anuncios/${a.id}`, { method: 'DELETE' })
    await cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando anuncios...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Anuncios</h1>
      <p className="text-gray-500 text-sm mb-6">Publicaciones visibles en la página principal de todos los parceleros</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <form onSubmit={publicar} className="bg-white rounded-xl border p-5 space-y-3 mb-8">
        <input
          type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
          required placeholder="Título del anuncio" className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={contenido} onChange={e => setContenido(e.target.value)}
          rows={3} placeholder="Contenido..." className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fotos</label>
            <input type="file" accept="image/*" multiple onChange={e => setFotos(e.target.files)} className="text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Documentos</label>
            <input type="file" multiple onChange={e => setDocumentos(e.target.files)} className="text-sm w-full" />
          </div>
        </div>
        <button type="submit" disabled={publicando} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {publicando ? 'Publicando...' : '📢 Publicar anuncio'}
        </button>
      </form>

      <div className="space-y-4">
        {anuncios.map(a => (
          <div key={a.id} className="bg-white rounded-xl border p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">{a.titulo}</h3>
                <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('es-CL')}</p>
              </div>
              <button onClick={() => eliminar(a)} className="text-xs text-red-500 hover:underline">Eliminar</button>
            </div>
            {a.contenido && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a.contenido}</p>}
            {a.archivos.filter(f => f.tipo === 'foto').length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {a.archivos.filter(f => f.tipo === 'foto').map((f, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={f.url} alt="" className="h-24 rounded-lg border object-cover" />
                ))}
              </div>
            )}
            {a.archivos.filter(f => f.tipo === 'documento').length > 0 && (
              <div className="flex gap-3 mt-3 flex-wrap">
                {a.archivos.filter(f => f.tipo === 'documento').map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer" className="text-xs border rounded px-3 py-1.5 text-blue-600 hover:bg-blue-50">
                    📎 {f.nombre}
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">👍 {a.likes} · 👎 {a.dislikes}</p>
          </div>
        ))}
        {anuncios.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Sin anuncios publicados aún</div>
        )}
      </div>
    </div>
  )
}
