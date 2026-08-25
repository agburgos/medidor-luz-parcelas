'use client'

import { useState, useEffect } from 'react'

interface ItemMenu { href: string; label: string }
interface Grupo { label: string; items: ItemMenu[] }

// Mismas opciones que existen en NavBar.tsx — si agregas una sección nueva ahí,
// agrégala también aquí para poder ocultarla.
const GRUPOS_COMITE: Grupo[] = [
  { label: '🚨 Incidencias', items: [
    { href: '/comite/incidencias', label: '🚨 Ver incidencias' },
  ]},
  { label: '⚡ Luz', items: [
    { href: '/comite/periodos', label: '🗓️ Períodos' },
    { href: '/comite/lecturas', label: '📸 Validar lecturas' },
    { href: '/comite/consumo-historico', label: '📊 Consumo Histórico' },
  ]},
  { label: '🏘️ Gasto Común COPOSA', items: [
    { href: '/comite/gastos-comunes', label: '🏘️ Períodos y config' },
  ]},
  { label: '💰 Cobranza', items: [
    { href: '/comite/pagos', label: '💳 Validar pagos' },
    { href: '/comite/reportes', label: '📊 Reportes' },
  ]},
  { label: '🏦 Caja y Tesorería', items: [
    { href: '/comite/caja', label: '🏦 Caja' },
    { href: '/comite/caja/libro-contable', label: '📊 Libro Contable' },
    { href: '/comite/estados-cuenta', label: '📋 Estados de cuenta' },
  ]},
  { label: '🗓️ Comunidad', items: [
    { href: '/comite/votaciones', label: '🗳️ Votaciones' },
    { href: '/comite/mensajes', label: '💬 Mensajería vecinal' },
    { href: '/comite/asambleas', label: '🗓️ Asambleas y actas' },
    { href: '/comite/anuncios', label: '📢 Anuncios' },
    { href: '/comite/documentos', label: '📎 Documentos' },
    { href: '/comite/informacion', label: 'ℹ️ Información fija' },
    { href: '/comite/registro', label: '👥 Registro personas/mascotas' },
  ]},
  { label: '⚙️ Administración', items: [
    { href: '/comite/parcelas', label: '🏡 Parcelas' },
    { href: '/comite/bitacora', label: '🕒 Bitácora' },
    { href: '/comite/configuracion', label: '⚙️ Configuración' },
    { href: '/comite/boveda', label: '🔐 Bóveda de Claves' },
  ]},
]

const GRUPOS_PARCELERO: Grupo[] = [
  { label: 'Mi macrolote', items: [
    { href: '/parcelero', label: '🏠 Inicio' },
    { href: '/parcelero/luz', label: '⚡ Cuenta de luz' },
    { href: '/parcelero/gastos-comunes', label: '🏘️ Gasto Común COPOSA' },
  ]},
  { label: '🏦 Caja y Tesorería', items: [
    { href: '/parcelero/caja', label: '🏦 Caja' },
    { href: '/parcelero/caja/libro-contable', label: '📊 Libro Contable' },
    { href: '/parcelero/estados-cuenta', label: '📋 Estados de cuenta' },
  ]},
  { label: '🗳️ Comunidad', items: [
    { href: '/parcelero/incidencias', label: '🚨 Mis incidencias' },
    { href: '/parcelero/votaciones', label: '🗳️ Votaciones' },
    { href: '/parcelero/mensajes', label: '💬 Mensajería con el comité' },
    { href: '/parcelero/asambleas', label: '🗓️ Asambleas y actas' },
    { href: '/parcelero/documentos', label: '📎 Documentos' },
    { href: '/parcelero/informacion', label: 'ℹ️ Información' },
    { href: '/parcelero/registro', label: '👥 Mi registro' },
    { href: '/parcelero/ayuda', label: '❓ Ayuda y FAQ' },
  ]},
]

function Switch({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${activo ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${activo ? 'left-7' : 'left-1'}`} />
    </button>
  )
}

export default function MenuVisiblePage() {
  const [ocultos, setOcultos] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/menu-oculto')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setOcultos(new Set(data.ocultos))
        setCargando(false)
      })
  }, [])

  async function toggle(href: string, ocultoActual: boolean) {
    const nuevo = new Set(ocultos)
    if (ocultoActual) nuevo.delete(href); else nuevo.add(href)
    setOcultos(nuevo)

    const res = await fetch('/api/menu-oculto', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ href, oculto: !ocultoActual }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'No se pudo guardar')
    }
  }

  function renderGrupos(titulo: string, grupos: Grupo[]) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{titulo}</h2>
        <div className="space-y-3">
          {grupos.map(g => (
            <div key={g.label} className="bg-white rounded-lg border p-4">
              <p className="text-sm font-medium text-gray-500 mb-2">{g.label}</p>
              <div className="divide-y">
                {g.items.map(item => {
                  const oculto = ocultos.has(item.href)
                  return (
                    <div key={item.href} className="flex items-center justify-between py-2">
                      <span className={oculto ? 'text-gray-400 line-through' : 'text-gray-800'}>{item.label}</span>
                      <Switch activo={!oculto} onClick={() => toggle(item.href, oculto)} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (cargando) return <p className="p-6 text-gray-500">Cargando...</p>

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">🧩 Mostrar / Ocultar menú</h1>
      <p className="text-sm text-gray-500 mb-6">
        Apaga una opción para que desaparezca del menú de todos los usuarios (por ejemplo, mientras una sección no está lista). No bloquea el acceso directo por link, solo la oculta de la navegación.
      </p>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {renderGrupos('Menú Comité', GRUPOS_COMITE)}
      {renderGrupos('Menú Parcelero', GRUPOS_PARCELERO)}
    </div>
  )
}
