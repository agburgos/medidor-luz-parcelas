'use client'

import { useState, useEffect, useCallback } from 'react'

interface Parcela {
  id: string
  numero: number
  nombre_dueno: string
  email: string | null
  telefono: string | null
  user_id: string | null
  activa: boolean
}

const formVacio = { numero: '', nombre_dueno: '', email: '', telefono: '' }

export default function ParcelasPage() {
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(formVacio)
  const [guardando, setGuardando] = useState(false)
  const [invitando, setInvitando] = useState<string | null>(null)
  const [mostrarInactivas, setMostrarInactivas] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/parcelas')
    const data = await res.json()
    setParcelas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function abrirNueva() {
    setEditandoId(null)
    setForm(formVacio)
    setModalAbierto(true)
  }

  function abrirEdicion(p: Parcela) {
    setEditandoId(p.id)
    setForm({
      numero: String(p.numero),
      nombre_dueno: p.nombre_dueno,
      email: p.email || '',
      telefono: p.telefono || '',
    })
    setModalAbierto(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje('')
    const url = editandoId ? `/api/parcelas/${editandoId}` : '/api/parcelas'
    const method = editandoId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
    } else {
      setMensaje(editandoId ? '✅ Parcela actualizada' : '✅ Parcela creada')
      setModalAbierto(false)
      await cargar()
    }
    setGuardando(false)
  }

  async function eliminar(p: Parcela) {
    if (!confirm(`¿Eliminar la parcela #${p.numero} de ${p.nombre_dueno}?`)) return
    const res = await fetch(`/api/parcelas/${p.id}`, { method: 'DELETE' })
    const data = await res.json()
    setMensaje(res.ok ? `✅ ${data.mensaje || 'Parcela eliminada'}` : `❌ ${data.error}`)
    await cargar()
  }

  async function reactivar(p: Parcela) {
    await fetch(`/api/parcelas/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activa: true }),
    })
    setMensaje('✅ Parcela reactivada')
    await cargar()
  }

  async function resetPassword(p: Parcela) {
    if (!confirm(`¿Generar nueva contraseña temporal para ${p.nombre_dueno}? La actual dejará de funcionar.`)) return
    setMensaje('')
    const res = await fetch(`/api/parcelas/${p.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'temporal' }),
    })
    const data = await res.json()
    if (!res.ok) { setMensaje(`❌ ${data.error}`); return }
    setMensaje(`🔑 Contraseña temporal de ${p.nombre_dueno} (parcela #${p.numero}): ${data.password_temporal} — cópiala ahora, no se volverá a mostrar.`)
  }

  async function invitar(p: Parcela) {
    setInvitando(p.id)
    setMensaje('')
    const res = await fetch(`/api/parcelas/${p.id}/invitar`, { method: 'POST' })
    const data = await res.json()
    setMensaje(res.ok
      ? `✅ ${data.mensaje || `Invitación enviada a ${data.email}`}`
      : `❌ ${data.error}`)
    setInvitando(null)
    await cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando parcelas...</div>

  const visibles = mostrarInactivas ? parcelas : parcelas.filter(p => p.activa)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mantenedor de parcelas</h1>
          <p className="text-sm text-gray-500">{parcelas.filter(p => p.activa).length} activas de {parcelas.length} registradas</p>
        </div>
        <button onClick={abrirNueva} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
          + Nueva parcela
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <label className="flex items-center gap-2 mb-3 text-sm text-gray-600">
        <input type="checkbox" checked={mostrarInactivas} onChange={e => setMostrarInactivas(e.target.checked)} />
        Mostrar parcelas desactivadas
      </label>

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">N°</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dueño</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Usuario</th>
              <th className="px-4 py-3 font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(p => (
              <tr key={p.id} className={`border-t hover:bg-gray-50 ${!p.activa ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 font-medium">#{p.numero}</td>
                <td className="px-4 py-2">{p.nombre_dueno}{!p.activa && <span className="ml-2 text-xs text-red-500">(desactivada)</span>}</td>
                <td className="px-4 py-2 text-gray-500">{p.email}</td>
                <td className="px-4 py-2 text-gray-500">{p.telefono || '—'}</td>
                <td className="px-4 py-2 text-center">
                  {p.user_id
                    ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-green-600 text-xs font-medium">✅ Activo</span>
                        <button
                          onClick={() => resetPassword(p)}
                          className="text-xs bg-orange-100 text-orange-700 rounded px-2 py-1 hover:bg-orange-200"
                          title="Generar contraseña temporal"
                        >
                          🔑 Reset
                        </button>
                      </div>
                    )
                    : p.email ? (
                      <button
                        onClick={() => invitar(p)}
                        disabled={invitando === p.id}
                        className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-1 hover:bg-purple-200 disabled:opacity-50"
                      >
                        {invitando === p.id ? 'Enviando...' : '✉️ Invitar'}
                      </button>
                    ) : <span className="text-xs text-gray-400" title="Agrega el email editando la parcela">sin email</span>}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <button onClick={() => abrirEdicion(p)} className="text-blue-600 hover:underline">Editar</button>
                    {p.activa
                      ? <button onClick={() => eliminar(p)} className="text-red-500 hover:underline">Eliminar</button>
                      : <button onClick={() => reactivar(p)} className="text-green-600 hover:underline">Reactivar</button>}
                  </div>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin parcelas. Crea la primera con el botón &quot;+ Nueva parcela&quot;.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editandoId ? 'Editar parcela' : 'Nueva parcela'}</h2>
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de parcela *</label>
                <input
                  type="number"
                  value={form.numero}
                  onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                  required min={1}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del dueño *</label>
                <input
                  type="text"
                  value={form.nombre_dueno}
                  onChange={e => setForm(f => ({ ...f, nombre_dueno: e.target.value }))}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (necesario para invitar)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+569..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
