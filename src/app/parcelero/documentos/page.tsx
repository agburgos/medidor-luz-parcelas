'use client'

import { useState, useEffect } from 'react'

interface Documento { id: string; nombre: string; categoria: string; archivo_url: string; created_at: string }

const CATEGORIAS: Record<string, string> = { acta: '📋 Acta', contable: '💰 Contable', reglamento: '📜 Reglamento', general: '📄 General' }

export default function DocumentosParceleroPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/documentos').then(r => r.json()).then(data => {
      setDocumentos(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Cargando documentos...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Documentos del macrolote</h1>
      <p className="text-gray-500 text-sm mb-6">Actas de asamblea, documentos contables y reglamento</p>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {documentos.map(d => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.nombre}</td>
                <td className="px-4 py-2">{CATEGORIAS[d.categoria] ?? d.categoria}</td>
                <td className="px-4 py-2 text-gray-500">{new Date(d.created_at).toLocaleDateString('es-CL')}</td>
                <td className="px-4 py-2"><a href={d.archivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver</a></td>
              </tr>
            ))}
            {documentos.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aún no hay documentos publicados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
