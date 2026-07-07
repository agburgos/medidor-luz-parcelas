'use client'

import { useState, useEffect, useCallback } from 'react'

interface Archivo { tipo: string; url: string; nombre: string | null }
interface Anuncio {
  id: string; titulo: string; contenido: string | null; created_at: string
  archivos: Archivo[]; likes: number; dislikes: number; mi_reaccion: 'like' | 'dislike' | null
}

export default function FeedAnuncios() {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [loading, setLoading] = useState(true)
  const [votando, setVotando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/anuncios')
    const data = await res.json()
    setAnuncios(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function votar(id: string, tipo: 'like' | 'dislike') {
    setVotando(id)
    const res = await fetch(`/api/anuncios/${id}/reaccion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    const data = await res.json()
    if (res.ok) {
      setAnuncios(prev => prev.map(a => a.id === id ? { ...a, likes: data.likes, dislikes: data.dislikes, mi_reaccion: data.mi_reaccion } : a))
    }
    setVotando(null)
  }

  if (loading || anuncios.length === 0) return null

  return (
    <div className="space-y-4 mb-8">
      <h2 className="text-lg font-semibold">📢 Anuncios del macrolote</h2>
      {anuncios.map(a => (
        <div key={a.id} className="bg-white rounded-xl border p-5">
          <h3 className="font-bold">{a.titulo}</h3>
          <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('es-CL')}</p>
          {a.contenido && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a.contenido}</p>}
          {a.archivos.filter(f => f.tipo === 'foto').length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {a.archivos.filter(f => f.tipo === 'foto').map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={f.url} alt="" className="h-32 rounded-lg border object-cover" />
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
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => votar(a.id, 'like')}
              disabled={votando === a.id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${a.mi_reaccion === 'like' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              👍 {a.likes}
            </button>
            <button
              onClick={() => votar(a.id, 'dislike')}
              disabled={votando === a.id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${a.mi_reaccion === 'dislike' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              👎 {a.dislikes}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
