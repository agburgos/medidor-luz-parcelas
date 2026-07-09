'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Asamblea {
  id: string; titulo: string; tipo: string; fecha: string
  hora_inicio: string | null; lugar: string | null; estado: string
}

export default function AsambleasPage() {
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState({ titulo: '', tipo: 'ordinaria', fecha: '', hora_inicio: '', lugar: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/asambleas')
    const data = await res.json()
    setAsambleas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const res = await fetch('/api/asambleas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) setMensaje(`❌ ${data.error}`)
    else { setModalAbierto(false); setForm({ titulo: '', tipo: 'ordinaria', fecha: '', hora_inicio: '', lugar: '' }) }
    setGuardando(false)
    await cargar()
  }

  const ESTADOS: Record<string, string> = { planificada: 'bg-blue-100 text-blue-700', realizada: 'bg-green-100 text-green-700', cancelada: 'bg-gray-100 text-gray-500' }

  if (loading) return <div className="p-8 text-gray-500">Cargando asambleas...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Asambleas y actas</h1>
        <button onClick={() => setModalAbierto(true)} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
          + Nueva asamblea
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Título</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lugar</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {asambleas.map(a => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2">{new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-CL')}{a.hora_inicio ? ` ${a.hora_inicio.slice(0,5)}` : ''}</td>
                <td className="px-4 py-2 font-medium">{a.titulo}</td>
                <td className="px-4 py-2 capitalize">{a.tipo === 'directiva' ? '🔒 Directiva' : a.tipo}</td>
                <td className="px-4 py-2 text-gray-500">{a.lugar || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADOS[a.estado]}`}>{a.estado}</span>
                </td>
                <td className="px-4 py-2"><Link href={`/comite/asambleas/${a.id}`} className="text-blue-600 hover:underline">Ver</Link></td>
              </tr>
            ))}
            {asambleas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin asambleas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Nueva asamblea</h2>
            <form onSubmit={crear} className="space-y-4">
              <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required placeholder="Título (ej: Asamblea Ordinaria Julio 2026)" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="ordinaria">Ordinaria</option>
                  <option value="extraordinaria">Extraordinaria</option>
                  <option value="directiva">🔒 Directiva (privada)</option>
                </select>
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
                <input type="text" value={form.lugar} onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} placeholder="Lugar" className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={guardando} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {guardando ? 'Creando...' : 'Crear'}
                </button>
                <button type="button" onClick={() => setModalAbierto(false)} className="px-4 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
