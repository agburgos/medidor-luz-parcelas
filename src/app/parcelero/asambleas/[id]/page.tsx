'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Asamblea {
  titulo: string; tipo: string; fecha: string; hora_inicio: string | null; lugar: string | null; estado: string; resumen: string | null
}
interface Asistente { id: string; nombre: string; parcela: { numero: number } | null }
interface Acuerdo { id: string; descripcion: string; responsable: string | null; estado: string }
interface Documento { id: string; nombre: string; categoria: string; archivo_url: string }
interface Reacciones { likes: number; dislikes: number; mi_reaccion: 'like' | 'dislike' | null }

const CATEGORIAS: Record<string, string> = { acta: '📋 Acta', contable: '💰 Contable', reglamento: '📜 Reglamento', general: '📄 General' }
const ESTADOS_ACUERDO: Record<string, string> = { pendiente: 'bg-red-100 text-red-700', en_curso: 'bg-yellow-100 text-yellow-800', cumplido: 'bg-green-100 text-green-700' }

export default function DetalleAsambleaParceleroPage() {
  const { id } = useParams() as { id: string }
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [asistentes, setAsistentes] = useState<Asistente[]>([])
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [reacciones, setReacciones] = useState<Reacciones>({ likes: 0, dislikes: 0, mi_reaccion: null })
  const [loading, setLoading] = useState(true)
  const [votando, setVotando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/asambleas/${id}`)
    const data = await res.json()
    if (!res.ok) { setLoading(false); return }
    setAsamblea(data.asamblea)
    setAsistentes(data.asistentes)
    setAcuerdos(data.acuerdos)
    setDocumentos(data.documentos)
    setReacciones(data.reacciones)
    setLoading(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function votar(tipo: 'like' | 'dislike') {
    setVotando(true)
    const res = await fetch(`/api/asambleas/${id}/reaccion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    const data = await res.json()
    if (res.ok) setReacciones(data)
    setVotando(false)
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>
  if (!asamblea) return <div className="p-8 text-red-600">No se encontró la asamblea</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{asamblea.titulo}</h1>
        <p className="text-gray-500 text-sm">
          {new Date(asamblea.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
          {asamblea.hora_inicio ? ` · ${asamblea.hora_inicio.slice(0,5)}` : ''}
          {asamblea.lugar ? ` · ${asamblea.lugar}` : ''} · <span className="capitalize">{asamblea.tipo}</span>
        </p>
      </div>

      {asamblea.resumen && (
        <section>
          <h2 className="text-lg font-semibold mb-2">📝 Resumen</h2>
          <div className="bg-white rounded-xl border p-4 text-sm text-gray-700 whitespace-pre-wrap">{asamblea.resumen}</div>
        </section>
      )}

      {/* Reacciones */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => votar('like')}
          disabled={votando}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${reacciones.mi_reaccion === 'like' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          👍 {reacciones.likes}
        </button>
        <button
          onClick={() => votar('dislike')}
          disabled={votando}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${reacciones.mi_reaccion === 'dislike' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          👎 {reacciones.dislikes}
        </button>
      </div>

      {asistentes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">👥 Asistencia ({asistentes.length})</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {asistentes.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2">{a.nombre}</td>
                    <td className="px-4 py-2 text-gray-500">{a.parcela ? `#${a.parcela.numero}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {acuerdos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">✅ Acuerdos</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {acuerdos.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2">{a.descripcion}</td>
                    <td className="px-4 py-2 text-gray-500">{a.responsable || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADOS_ACUERDO[a.estado]}`}>
                        {a.estado === 'en_curso' ? 'En curso' : a.estado.charAt(0).toUpperCase() + a.estado.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {documentos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">📎 Documentos</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {documentos.map(d => (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-2">{d.nombre}</td>
                    <td className="px-4 py-2 text-gray-500">{CATEGORIAS[d.categoria] ?? d.categoria}</td>
                    <td className="px-4 py-2"><a href={d.archivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
