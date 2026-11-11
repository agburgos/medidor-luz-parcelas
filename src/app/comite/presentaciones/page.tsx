'use client'

import { useState, useEffect, useCallback } from 'react'

interface Presentacion {
  id: string; nombre: string; archivo_url: string; created_at: string
  fecha: string | null; asamblea_id: string | null
}
interface Asamblea { id: string; titulo: string; fecha: string; tipo: string }

const fmtFecha = (f: string) => new Date(f.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-CL')
const esHtml = (url: string) => url.toLowerCase().endsWith('.html')

export default function PresentacionesPage() {
  const [items, setItems] = useState<Presentacion[]>([])
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [asambleaId, setAsambleaId] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch('/api/documentos?categoria=presentacion'),
      fetch('/api/asambleas'),
    ])
    const d1 = await r1.json()
    const d2 = await r2.json()
    const lista: Presentacion[] = Array.isArray(d1) ? d1 : []
    lista.sort((a, b) => (b.fecha ?? b.created_at).localeCompare(a.fecha ?? a.created_at))
    setItems(lista)
    setAsambleas(Array.isArray(d2) ? d2 : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function elegirAsamblea(id: string) {
    setAsambleaId(id)
    const a = asambleas.find(x => x.id === id)
    if (a && !fecha) setFecha(a.fecha.slice(0, 10))
  }

  async function subir(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo || !nombre || !fecha) return
    setSubiendo(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('archivo', archivo)
    fd.append('nombre', nombre)
    fd.append('categoria', 'presentacion')
    fd.append('fecha', fecha)
    fd.append('solo_comite', 'true')
    if (asambleaId) fd.append('asamblea_id', asambleaId)
    const res = await fetch('/api/documentos', { method: 'POST', body: fd })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Presentación guardada' : `❌ ${data.error}`)
    if (res.ok) { setNombre(''); setFecha(''); setAsambleaId(''); setArchivo(null) }
    setSubiendo(false)
    await cargar()
  }

  async function asociar(p: Presentacion, asamblea_id: string) {
    const res = await fetch(`/api/documentos/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asamblea_id: asamblea_id || null }),
    })
    setMensaje(res.ok ? '✅ Asamblea actualizada' : '❌ No se pudo actualizar')
    await cargar()
  }

  async function cambiarFecha(p: Presentacion, nueva: string) {
    if (!nueva) return
    await fetch(`/api/documentos/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: nueva }),
    })
    await cargar()
  }

  async function eliminar(p: Presentacion) {
    if (!confirm(`¿Eliminar la presentación "${p.nombre}"?`)) return
    await fetch(`/api/documentos/${p.id}`, { method: 'DELETE' })
    setMensaje('✅ Presentación eliminada')
    await cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando presentaciones...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">📽️ Presentaciones de asambleas</h1>
      <p className="text-gray-500 text-sm mb-6">Carpeta del comité con las presentaciones de cada asamblea. Solo las ve el comité.</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <form onSubmit={subir} className="bg-white rounded-xl border p-5 flex flex-wrap gap-3 items-end mb-6">
        <div className="flex-1 min-w-56">
          <label className="block text-xs text-gray-600 mb-1">Nombre</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ej: Presentación asamblea ordinaria diciembre" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Asamblea asociada</label>
          <select value={asambleaId} onChange={e => elegirAsamblea(e.target.value)} className="border rounded-lg px-3 py-2 text-sm max-w-64">
            <option value="">Sin asociar</option>
            {asambleas.map(a => <option key={a.id} value={a.id}>{fmtFecha(a.fecha)} · {a.titulo}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Archivo (HTML, PPT, PPTX o PDF)</label>
          <input type="file" required accept=".html,.ppt,.pptx,.pdf,.key" onChange={e => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
        </div>
        <button type="submit" disabled={subiendo} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {subiendo ? 'Subiendo...' : '+ Guardar'}
        </button>
      </form>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Presentación</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Asamblea asociada</th>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">
                  <input type="date" defaultValue={p.fecha?.slice(0, 10) ?? p.created_at.slice(0, 10)} onBlur={e => cambiarFecha(p, e.target.value)} className="border rounded px-2 py-1 text-xs" />
                </td>
                <td className="px-4 py-2 font-medium">{p.nombre}</td>
                <td className="px-4 py-2">
                  <select value={p.asamblea_id ?? ''} onChange={e => asociar(p, e.target.value)} className="border rounded px-2 py-1 text-xs max-w-64">
                    <option value="">Sin asociar</option>
                    {asambleas.map(a => <option key={a.id} value={a.id}>{fmtFecha(a.fecha)} · {a.titulo}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <a href={esHtml(p.archivo_url) ? `/api/documentos/${p.id}/ver` : p.archivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {esHtml(p.archivo_url) ? 'Presentar' : 'Abrir'}
                  </a>
                </td>
                <td className="px-4 py-2"><button onClick={() => eliminar(p)} className="text-xs text-red-500 hover:underline">Eliminar</button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Aún no hay presentaciones</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
