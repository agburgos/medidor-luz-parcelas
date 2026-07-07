'use client'

import { useState, useEffect, useCallback } from 'react'

interface Persona {
  id: string
  nombre: string
  relacion: string
  rut: string | null
  telefono: string | null
  email: string | null
  parcela?: { numero: number; nombre_dueno: string }
}

interface Mascota {
  id: string
  nombre: string
  especie: string
  raza: string | null
  color: string | null
  chip: string | null
  parcela?: { numero: number; nombre_dueno: string }
}

const RELACIONES: Record<string, string> = {
  dueno: 'Dueño/a', familiar: 'Familiar', arrendatario: 'Arrendatario/a',
  trabajador: 'Trabajador/a', otro: 'Otro',
}
const ESPECIES: Record<string, string> = { perro: '🐕 Perro', gato: '🐈 Gato', otro: '🐾 Otro' }

// Registro de personas y mascotas de una parcela.
// Si parcelaId es null (parcelero), la API usa su propia parcela.
export default function RegistroParcela({ parcelaId, mostrarParcela = false }: { parcelaId?: string | null; mostrarParcela?: boolean }) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [mascotas, setMascotas] = useState<Mascota[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const [formP, setFormP] = useState({ nombre: '', relacion: 'familiar', rut: '', telefono: '', email: '' })
  const [formM, setFormM] = useState({ nombre: '', especie: 'perro', raza: '', color: '', chip: '' })
  const [guardandoP, setGuardandoP] = useState(false)
  const [guardandoM, setGuardandoM] = useState(false)

  const query = parcelaId ? `?parcela_id=${parcelaId}` : mostrarParcela ? '?todas=1' : ''
  // undefined = vista "todas las parcelas" (solo lectura); null o id = se puede agregar
  const puedeAgregar = parcelaId !== undefined

  const cargar = useCallback(async () => {
    const [pRes, mRes] = await Promise.all([
      fetch(`/api/registro/personas${query}`),
      fetch(`/api/registro/mascotas${query}`),
    ])
    const p = await pRes.json()
    const m = await mRes.json()
    setPersonas(Array.isArray(p) ? p : [])
    setMascotas(Array.isArray(m) ? m : [])
    setLoading(false)
  }, [query])

  useEffect(() => { cargar() }, [cargar])

  async function agregarPersona(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoP(true)
    const res = await fetch('/api/registro/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formP, parcela_id: parcelaId }),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Persona agregada' : `❌ ${data.error}`)
    if (res.ok) setFormP({ nombre: '', relacion: 'familiar', rut: '', telefono: '', email: '' })
    setGuardandoP(false)
    await cargar()
  }

  async function agregarMascota(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoM(true)
    const res = await fetch('/api/registro/mascotas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formM, parcela_id: parcelaId }),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Mascota agregada' : `❌ ${data.error}`)
    if (res.ok) setFormM({ nombre: '', especie: 'perro', raza: '', color: '', chip: '' })
    setGuardandoM(false)
    await cargar()
  }

  async function eliminar(tipo: 'personas' | 'mascotas', id: string, nombre: string) {
    if (!confirm(`¿Eliminar a ${nombre} del registro?`)) return
    await fetch(`/api/registro/${tipo}/${id}`, { method: 'DELETE' })
    setMensaje('✅ Eliminado del registro')
    await cargar()
  }

  if (loading) return <p className="text-gray-500 text-sm py-4">Cargando registro...</p>

  return (
    <div className="space-y-8">
      {mensaje && <p className="text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      {/* PERSONAS */}
      <section>
        <h2 className="text-lg font-semibold mb-3">👥 Personas de la parcela</h2>
        <div className="bg-white rounded-xl border overflow-auto mb-3">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {mostrarParcela && <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Relación</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">RUT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {personas.map(p => (
                <tr key={p.id} className="border-t">
                  {mostrarParcela && <td className="px-4 py-2 font-medium">#{p.parcela?.numero}</td>}
                  <td className="px-4 py-2">{p.nombre}</td>
                  <td className="px-4 py-2 text-gray-600">{RELACIONES[p.relacion] ?? p.relacion}</td>
                  <td className="px-4 py-2 text-gray-500">{p.rut || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{p.telefono || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{p.email || '—'}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => eliminar('personas', p.id, p.nombre)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
              {personas.length === 0 && (
                <tr><td colSpan={mostrarParcela ? 7 : 6} className="px-4 py-5 text-center text-gray-400">Sin personas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {puedeAgregar ? (
          <form onSubmit={agregarPersona} className="bg-white rounded-xl border p-4 flex flex-wrap items-end gap-3">
            <input type="text" value={formP.nombre} onChange={e => setFormP(f => ({ ...f, nombre: e.target.value }))} required placeholder="Nombre completo *" className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm" />
            <select value={formP.relacion} onChange={e => setFormP(f => ({ ...f, relacion: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              {Object.entries(RELACIONES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="text" value={formP.rut} onChange={e => setFormP(f => ({ ...f, rut: e.target.value }))} placeholder="RUT" className="border rounded-lg px-3 py-2 text-sm w-32" />
            <input type="tel" value={formP.telefono} onChange={e => setFormP(f => ({ ...f, telefono: e.target.value }))} placeholder="Teléfono" className="border rounded-lg px-3 py-2 text-sm w-36" />
            <input type="email" value={formP.email} onChange={e => setFormP(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="border rounded-lg px-3 py-2 text-sm w-48" />
            <button type="submit" disabled={guardandoP} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {guardandoP ? '...' : '+ Agregar'}
            </button>
          </form>
        ) : null}
      </section>

      {/* MASCOTAS */}
      <section>
        <h2 className="text-lg font-semibold mb-3">🐾 Mascotas</h2>
        <div className="bg-white rounded-xl border overflow-auto mb-3">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {mostrarParcela && <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Especie</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Raza</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Color</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">N° Chip</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mascotas.map(m => (
                <tr key={m.id} className="border-t">
                  {mostrarParcela && <td className="px-4 py-2 font-medium">#{m.parcela?.numero}</td>}
                  <td className="px-4 py-2">{m.nombre}</td>
                  <td className="px-4 py-2">{ESPECIES[m.especie] ?? m.especie}</td>
                  <td className="px-4 py-2 text-gray-500">{m.raza || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{m.color || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{m.chip || '—'}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => eliminar('mascotas', m.id, m.nombre)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
              {mascotas.length === 0 && (
                <tr><td colSpan={mostrarParcela ? 7 : 6} className="px-4 py-5 text-center text-gray-400">Sin mascotas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {puedeAgregar && (
        <form onSubmit={agregarMascota} className="bg-white rounded-xl border p-4 flex flex-wrap items-end gap-3">
          <input type="text" value={formM.nombre} onChange={e => setFormM(f => ({ ...f, nombre: e.target.value }))} required placeholder="Nombre *" className="flex-1 min-w-32 border rounded-lg px-3 py-2 text-sm" />
          <select value={formM.especie} onChange={e => setFormM(f => ({ ...f, especie: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
            {Object.entries(ESPECIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="text" value={formM.raza} onChange={e => setFormM(f => ({ ...f, raza: e.target.value }))} placeholder="Raza" className="border rounded-lg px-3 py-2 text-sm w-32" />
          <input type="text" value={formM.color} onChange={e => setFormM(f => ({ ...f, color: e.target.value }))} placeholder="Color" className="border rounded-lg px-3 py-2 text-sm w-28" />
          <input type="text" value={formM.chip} onChange={e => setFormM(f => ({ ...f, chip: e.target.value }))} placeholder="N° chip" className="border rounded-lg px-3 py-2 text-sm w-32" />
          <button type="submit" disabled={guardandoM} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {guardandoM ? '...' : '+ Agregar'}
          </button>
        </form>
        )}
      </section>
    </div>
  )
}
