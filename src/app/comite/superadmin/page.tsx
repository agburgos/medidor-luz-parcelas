'use client'

import { useState, useEffect, useCallback } from 'react'

interface Usuario {
  id: string
  email: string | null
  rol: 'comite' | 'parcelero'
  nombre: string | null
  cargo: string | null
  esSuperadmin: boolean
  numeroParcela: number | null
}

const CARGOS = ['presidente', 'tesorero', 'secretario', 'director', 'admin']

export default function SuperadminPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [miId, setMiId] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 15

  const [cambiandoId, setCambiandoId] = useState<string | null>(null)
  const [nuevaPass, setNuevaPass] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formPerfil, setFormPerfil] = useState({ rol: 'parcelero' as 'comite' | 'parcelero', cargo: '', esSuperadmin: false })
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const sesionRes = await fetch('/api/sesion')
    const sesion = await sesionRes.json()
    if (!sesionRes.ok || !sesion.esSuperadmin) {
      setAutorizado(false)
      setLoading(false)
      return
    }
    setAutorizado(true)
    const res = await fetch('/api/admin/usuarios')
    const data = await res.json()
    setUsuarios(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    fetch('/api/sesion').then(r => r.json()).then(s => setMiId(s.userId ?? null)).catch(() => {})
  }, [])

  async function cambiarPassword(id: string) {
    if (!nuevaPass || nuevaPass.length < 6) {
      setMensaje('❌ La contraseña debe tener al menos 6 caracteres')
      return
    }
    setGuardando(true)
    setMensaje('')
    const res = await fetch(`/api/admin/usuarios/${id}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: nuevaPass }),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Contraseña actualizada' : `❌ ${data.error}`)
    if (res.ok) { setCambiandoId(null); setNuevaPass('') }
    setGuardando(false)
  }

  function iniciarEdicionPerfil(u: Usuario) {
    setEditandoId(u.id)
    setFormPerfil({ rol: u.rol, cargo: u.cargo ?? '', esSuperadmin: u.esSuperadmin })
    setMensaje('')
  }

  async function guardarPerfil(id: string) {
    setGuardando(true)
    setMensaje('')
    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rol: formPerfil.rol,
        cargo: formPerfil.rol === 'comite' ? (formPerfil.cargo || null) : null,
        esSuperadmin: formPerfil.esSuperadmin,
      }),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Perfil actualizado' : `❌ ${data.error}`)
    if (res.ok) { setEditandoId(null); await cargar() }
    setGuardando(false)
  }

  async function eliminarUsuario(u: Usuario) {
    if (!confirm(`¿Eliminar la cuenta de ${u.nombre || u.email}?\n\nEsto borra su acceso al sistema. Si tiene una parcela asociada, la parcela y su historial (lecturas, pagos, cuentas) NO se borran, solo queda sin usuario asignado.`)) return
    setEliminando(u.id)
    setMensaje('')
    const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Usuario eliminado' : `❌ ${data.error}`)
    if (res.ok) await cargar()
    setEliminando(null)
  }

  const q = busqueda.trim().toLowerCase()
  const filtrados = !q ? usuarios : usuarios.filter(u =>
    (u.nombre ?? '').toLowerCase().includes(q) ||
    (u.email ?? '').toLowerCase().includes(q) ||
    String(u.numeroParcela ?? '').includes(q)
  )
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>
  if (!autorizado) return <div className="p-8 text-red-600">🔒 Acceso exclusivo para superadministrador.</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">🔐 Administración de Usuarios</h1>
      <p className="text-gray-500 text-sm mb-6">Contraseñas, perfiles y eliminación de cuentas — acceso exclusivo de superadministrador</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <input
        type="text"
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
        placeholder="🔍 Buscar por nombre, email o #parcela..."
        className="border rounded-lg px-3 py-2 text-sm w-72 mb-4"
      />

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(u => (
              <>
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.rol === 'comite' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.rol === 'comite' ? '⚙️ Comité' : 'Parcelero'}
                    </span>
                    {u.esSuperadmin && <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">🔐 Superadmin</span>}
                  </td>
                  <td className="px-4 py-3 font-medium">{u.nombre || '—'}{u.cargo && <span className="text-gray-400 text-xs ml-1">({u.cargo})</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
                  <td className="px-4 py-3">{u.numeroParcela ? `#${u.numeroParcela}` : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {cambiandoId === u.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="text"
                          value={nuevaPass}
                          onChange={e => setNuevaPass(e.target.value)}
                          placeholder="Nueva contraseña"
                          className="border rounded px-2 py-1 text-sm w-36"
                        />
                        <button onClick={() => cambiarPassword(u.id)} disabled={guardando} className="bg-green-600 text-white rounded px-3 py-1 text-xs hover:bg-green-700 disabled:opacity-50">Guardar</button>
                        <button onClick={() => { setCambiandoId(null); setNuevaPass(''); setMensaje('') }} className="text-gray-500 text-xs hover:text-gray-700">Cancelar</button>
                      </div>
                    ) : editandoId === u.id ? null : (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setCambiandoId(u.id); setNuevaPass(''); setMensaje('') }} className="text-xs bg-yellow-100 text-yellow-800 rounded px-3 py-1.5 hover:bg-yellow-200">
                          🔑 Contraseña
                        </button>
                        <button onClick={() => iniciarEdicionPerfil(u)} className="text-xs bg-blue-100 text-blue-700 rounded px-3 py-1.5 hover:bg-blue-200">
                          ✏️ Perfil
                        </button>
                        <button
                          onClick={() => eliminarUsuario(u)}
                          disabled={eliminando === u.id || u.id === miId}
                          title={u.id === miId ? 'No puedes eliminar tu propia cuenta' : undefined}
                          className="text-xs bg-red-100 text-red-700 rounded px-3 py-1.5 hover:bg-red-200 disabled:opacity-40"
                        >
                          {eliminando === u.id ? '...' : '🗑️ Eliminar'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {editandoId === u.id && (
                  <tr className="border-t bg-blue-50/50">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Rol</label>
                          <select
                            value={formPerfil.rol}
                            onChange={e => setFormPerfil(f => ({ ...f, rol: e.target.value as 'comite' | 'parcelero' }))}
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="parcelero">Parcelero</option>
                            <option value="comite">Comité</option>
                          </select>
                        </div>
                        {formPerfil.rol === 'comite' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Cargo</label>
                            <select
                              value={formPerfil.cargo}
                              onChange={e => setFormPerfil(f => ({ ...f, cargo: e.target.value }))}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="">— Sin cargo —</option>
                              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formPerfil.esSuperadmin}
                            onChange={e => setFormPerfil(f => ({ ...f, esSuperadmin: e.target.checked }))}
                            disabled={u.id === miId}
                          />
                          🔐 Superadmin
                        </label>
                        <button onClick={() => guardarPerfil(u.id)} disabled={guardando} className="bg-green-600 text-white rounded px-3 py-1.5 text-sm hover:bg-green-700 disabled:opacity-50">
                          Guardar
                        </button>
                        <button onClick={() => { setEditandoId(null); setMensaje('') }} className="text-gray-500 text-sm hover:text-gray-700">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtrados.length > POR_PAGINA && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">
            Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
            <span className="text-gray-600">{paginaActual} / {totalPaginas}</span>
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50">Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  )
}
