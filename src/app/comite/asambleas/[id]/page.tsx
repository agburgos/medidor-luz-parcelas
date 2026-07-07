'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Asamblea {
  id: string; titulo: string; tipo: string; fecha: string; hora_inicio: string | null; hora_termino: string | null
  lugar: string | null; estado: string; resumen: string | null
}
interface Asistente { id: string; nombre: string; presente: boolean; representado_por: string | null; parcela: { numero: number } | null }
interface Acuerdo { id: string; descripcion: string; responsable: string | null; fecha_limite: string | null; estado: string }
interface Documento { id: string; nombre: string; categoria: string; archivo_url: string }
interface Reacciones { likes: number; dislikes: number }

export default function DetalleAsambleaPage() {
  const { id } = useParams() as { id: string }
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [asistentes, setAsistentes] = useState<Asistente[]>([])
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [reacciones, setReacciones] = useState<Reacciones>({ likes: 0, dislikes: 0 })
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const [nombreAsistente, setNombreAsistente] = useState('')
  const [descAcuerdo, setDescAcuerdo] = useState('')
  const [respAcuerdo, setRespAcuerdo] = useState('')
  const [resumen, setResumen] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [nombreDoc, setNombreDoc] = useState('')
  const [categoriaDoc, setCategoriaDoc] = useState('acta')

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/asambleas/${id}`)
    const data = await res.json()
    if (!res.ok) { setMensaje(data.error); setLoading(false); return }
    setAsamblea(data.asamblea)
    setAsistentes(data.asistentes)
    setAcuerdos(data.acuerdos)
    setDocumentos(data.documentos)
    setReacciones(data.reacciones)
    setResumen(data.asamblea.resumen || '')
    setLoading(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function agregarAsistente(e: React.FormEvent) {
    e.preventDefault()
    if (!nombreAsistente) return
    await fetch(`/api/asambleas/${id}/asistentes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombreAsistente }),
    })
    setNombreAsistente('')
    await cargar()
  }

  async function agregarAcuerdo(e: React.FormEvent) {
    e.preventDefault()
    if (!descAcuerdo) return
    await fetch(`/api/asambleas/${id}/acuerdos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: descAcuerdo, responsable: respAcuerdo || null }),
    })
    setDescAcuerdo(''); setRespAcuerdo('')
    await cargar()
  }

  async function cambiarEstadoAcuerdo(acuerdoId: string, estado: string) {
    await fetch(`/api/asambleas/${id}/acuerdos/${acuerdoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    await cargar()
  }

  async function subirDocumento(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo || !nombreDoc) return
    const fd = new FormData()
    fd.append('archivo', archivo)
    fd.append('nombre', nombreDoc)
    fd.append('categoria', categoriaDoc)
    fd.append('asamblea_id', id)
    const res = await fetch('/api/documentos', { method: 'POST', body: fd })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Documento subido' : `❌ ${data.error}`)
    setArchivo(null); setNombreDoc('')
    await cargar()
  }

  async function guardarEstado(estado: string) {
    await fetch(`/api/asambleas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, resumen }),
    })
    setMensaje(estado === 'realizada' ? '✅ Asamblea marcada como realizada' : '✅ Actualizado')
    await cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>
  if (!asamblea) return <div className="p-8 text-red-600">{mensaje}</div>

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{asamblea.titulo}</h1>
          <p className="text-gray-500 text-sm">
            {new Date(asamblea.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
            {asamblea.hora_inicio ? ` · ${asamblea.hora_inicio.slice(0,5)}` : ''}
            {asamblea.lugar ? ` · ${asamblea.lugar}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">👍 {reacciones.likes} · 👎 {reacciones.dislikes}</span>
          {asamblea.estado !== 'realizada' && (
            <button onClick={() => guardarEstado('realizada')} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700">
              ✓ Marcar como realizada
            </button>
          )}
        </div>
      </div>

      {mensaje && <p className="text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      {/* Resumen / acta */}
      <section>
        <h2 className="text-lg font-semibold mb-2">📝 Resumen / minuta</h2>
        <textarea
          value={resumen}
          onChange={e => setResumen(e.target.value)}
          onBlur={() => guardarEstado(asamblea.estado)}
          rows={4}
          placeholder="Resumen de los temas tratados en la asamblea..."
          className="w-full border rounded-xl p-3 text-sm"
        />
      </section>

      {/* Asistencia */}
      <section>
        <h2 className="text-lg font-semibold mb-2">👥 Asistencia ({asistentes.length})</h2>
        <div className="bg-white rounded-xl border overflow-hidden mb-3">
          <table className="w-full text-sm">
            <tbody>
              {asistentes.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">{a.nombre}</td>
                  <td className="px-4 py-2 text-gray-500">{a.parcela ? `#${a.parcela.numero}` : ''}</td>
                </tr>
              ))}
              {asistentes.length === 0 && <tr><td className="px-4 py-4 text-center text-gray-400">Sin asistentes registrados</td></tr>}
            </tbody>
          </table>
        </div>
        <form onSubmit={agregarAsistente} className="flex gap-2">
          <input type="text" value={nombreAsistente} onChange={e => setNombreAsistente(e.target.value)} placeholder="Nombre del asistente" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">+ Agregar</button>
        </form>
      </section>

      {/* Acuerdos */}
      <section>
        <h2 className="text-lg font-semibold mb-2">✅ Acuerdos</h2>
        <div className="bg-white rounded-xl border overflow-hidden mb-3">
          <table className="w-full text-sm">
            <tbody>
              {acuerdos.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">{a.descripcion}</td>
                  <td className="px-4 py-2 text-gray-500">{a.responsable || '—'}</td>
                  <td className="px-4 py-2">
                    <select value={a.estado} onChange={e => cambiarEstadoAcuerdo(a.id, e.target.value)} className="text-xs border rounded px-2 py-1">
                      <option value="pendiente">Pendiente</option>
                      <option value="en_curso">En curso</option>
                      <option value="cumplido">Cumplido</option>
                    </select>
                  </td>
                </tr>
              ))}
              {acuerdos.length === 0 && <tr><td className="px-4 py-4 text-center text-gray-400">Sin acuerdos registrados</td></tr>}
            </tbody>
          </table>
        </div>
        <form onSubmit={agregarAcuerdo} className="flex gap-2 flex-wrap">
          <input type="text" value={descAcuerdo} onChange={e => setDescAcuerdo(e.target.value)} placeholder="Descripción del acuerdo" className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
          <input type="text" value={respAcuerdo} onChange={e => setRespAcuerdo(e.target.value)} placeholder="Responsable" className="border rounded-lg px-3 py-2 text-sm w-40" />
          <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">+ Agregar</button>
        </form>
      </section>

      {/* Documentos */}
      <section>
        <h2 className="text-lg font-semibold mb-2">📎 Documentos (acta, contables)</h2>
        <div className="bg-white rounded-xl border overflow-hidden mb-3">
          <table className="w-full text-sm">
            <tbody>
              {documentos.map(d => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-2">{d.nombre}</td>
                  <td className="px-4 py-2 text-gray-500 capitalize">{d.categoria}</td>
                  <td className="px-4 py-2"><a href={d.archivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver</a></td>
                </tr>
              ))}
              {documentos.length === 0 && <tr><td className="px-4 py-4 text-center text-gray-400">Sin documentos subidos</td></tr>}
            </tbody>
          </table>
        </div>
        <form onSubmit={subirDocumento} className="flex gap-2 flex-wrap items-center">
          <input type="text" value={nombreDoc} onChange={e => setNombreDoc(e.target.value)} placeholder="Nombre del documento" className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40" />
          <select value={categoriaDoc} onChange={e => setCategoriaDoc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="acta">Acta</option>
            <option value="contable">Contable</option>
            <option value="reglamento">Reglamento</option>
            <option value="general">General</option>
          </select>
          <input type="file" onChange={e => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
          <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">Subir</button>
        </form>
      </section>
    </div>
  )
}
