'use client'

import { useState, useEffect, useCallback } from 'react'

interface Documento {
  id: string; nombre: string; categoria: string; archivo_url: string; created_at: string
  asamblea_id: string | null
}

const CATEGORIAS: Record<string, string> = { acta: '📋 Acta', contable: '💰 Contable', reglamento: '📜 Reglamento', general: '📄 General' }

export default function DocumentosComitePage() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [filtro, setFiltro] = useState<string>('todos')

  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('general')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/documentos')
    const data = await res.json()
    setDocumentos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function subir(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo || !nombre) return
    setSubiendo(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('archivo', archivo)
    fd.append('nombre', nombre)
    fd.append('categoria', categoria)
    const res = await fetch('/api/documentos', { method: 'POST', body: fd })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Documento publicado' : `❌ ${data.error}`)
    setNombre(''); setArchivo(null)
    setSubiendo(false)
    await cargar()
  }

  async function eliminar(d: Documento) {
    if (!confirm(`¿Eliminar el documento "${d.nombre}"?`)) return
    await fetch(`/api/documentos/${d.id}`, { method: 'DELETE' })
    setMensaje('✅ Documento eliminado')
    await cargar()
  }

  const filtrados = filtro === 'todos' ? documentos : documentos.filter(d => d.categoria === filtro)

  if (loading) return <div className="p-8 text-gray-500">Cargando documentos...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Documentos</h1>
      <p className="text-gray-500 text-sm mb-6">Actas, contables y reglamento — visibles y ordenados para todos los parceleros</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <form onSubmit={subir} className="bg-white rounded-xl border p-5 flex flex-wrap gap-3 items-end mb-6">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-gray-600 mb-1">Nombre del documento</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ej: Acta asamblea julio 2026" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Categoría</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="acta">Acta</option>
            <option value="contable">Contable</option>
            <option value="reglamento">Reglamento</option>
            <option value="general">General</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Archivo</label>
          <input type="file" required onChange={e => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
        </div>
        <button type="submit" disabled={subiendo} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {subiendo ? 'Subiendo...' : '+ Publicar'}
        </button>
      </form>

      <div className="flex gap-2 mb-4">
        {(['todos', 'acta', 'contable', 'reglamento', 'general'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${filtro === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {f === 'todos' ? 'Todos' : CATEGORIAS[f]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(d => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.nombre}{d.asamblea_id && <span className="ml-2 text-xs text-gray-400">(de asamblea)</span>}</td>
                <td className="px-4 py-2">{CATEGORIAS[d.categoria] ?? d.categoria}</td>
                <td className="px-4 py-2 text-gray-500">{new Date(d.created_at).toLocaleDateString('es-CL')}</td>
                <td className="px-4 py-2"><a href={d.archivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver</a></td>
                <td className="px-4 py-2"><button onClick={() => eliminar(d)} className="text-xs text-red-500 hover:underline">Eliminar</button></td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin documentos en esta categoría</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
