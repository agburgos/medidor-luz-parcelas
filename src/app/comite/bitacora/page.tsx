'use client'

import { useState, useEffect } from 'react'

interface Registro {
  id: string
  usuario_nombre: string | null
  accion: string
  entidad: string | null
  entidad_id: string | null
  detalle: Record<string, unknown> | null
  created_at: string
}

const ETIQUETAS: Record<string, string> = {
  crear_periodo_luz: '⚡ Creó período de luz',
  editar_cuenta: '✏️ Editó una cuenta',
  validar_pago: '✅ Validó un pago',
  rechazar_pago: '🚫 Rechazó un pago',
  editar_parcela: '✏️ Editó una parcela',
  desactivar_parcela: '🔒 Desactivó una parcela',
  eliminar_parcela: '🗑️ Eliminó una parcela',
  crear_periodo_gc: '🏘️ Creó período de gastos comunes',
  editar_cuenta_gc: '✏️ Editó cuenta de gastos comunes',
  crear_asamblea: '🗓️ Creó una asamblea',
  cerrar_asamblea: '📋 Cerró una asamblea',
}

export default function BitacoraPage() {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    fetch('/api/bitacora')
      .then(r => r.json())
      .then(data => { setRegistros(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Cargando bitácora...</div>

  const filtrados = filtro
    ? registros.filter(r => (r.usuario_nombre ?? '').toLowerCase().includes(filtro.toLowerCase()))
    : registros

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bitácora de administración</h1>
          <p className="text-gray-500 text-sm">Registro de acciones de la directiva — quién, qué y cuándo</p>
        </div>
        <input
          type="text"
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          placeholder="Filtrar por admin..."
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha y hora</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Acción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 text-gray-500">{new Date(r.created_at).toLocaleString('es-CL')}</td>
                <td className="px-4 py-2 font-medium">{r.usuario_nombre || '—'}</td>
                <td className="px-4 py-2">{ETIQUETAS[r.accion] ?? r.accion}</td>
                <td className="px-4 py-2 text-gray-500 text-xs font-mono">
                  {r.detalle ? JSON.stringify(r.detalle) : ''}
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin registros aún</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
