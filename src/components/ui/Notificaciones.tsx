'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface Notificacion {
  id: string
  tipo: string
  urgencia: 'alta' | 'media' | 'baja'
  mensaje: string
  link: string
  fecha: string
}

const URGENCIA_COLOR: Record<string, string> = {
  alta: 'bg-red-500',
  media: 'bg-yellow-500',
  baja: 'bg-blue-400',
}

const STORAGE_KEY = 'notis_vistas'

// Guarda { [id]: mensaje } de las notificaciones marcadas como vistas. Si el
// mensaje de una notificación cambia (ej: "3 pagos por validar" -> "5 pagos
// por validar"), vuelve a aparecer porque ya no coincide con lo guardado.
function cargarVistas(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function Notificaciones() {
  const [abierto, setAbierto] = useState(false)
  const [notis, setNotis] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [vistas, setVistas] = useState<Record<string, string>>({})
  const ref = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/notificaciones')
      const data = await res.json()
      setNotis(Array.isArray(data) ? data : [])
    } catch {
      // silencioso
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setVistas(cargarVistas())
    cargar()
    const interval = setInterval(cargar, 90000)
    return () => clearInterval(interval)
  }, [cargar])

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('click', onClickFuera)
    return () => document.removeEventListener('click', onClickFuera)
  }, [])

  const notisNoVistas = notis.filter(n => vistas[n.id] !== n.mensaje)
  const alta = notisNoVistas.filter(n => n.urgencia === 'alta').length

  function marcarTodasVistas() {
    const nuevas = { ...vistas }
    for (const n of notis) nuevas[n.id] = n.mensaje
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevas))
    setVistas(nuevas)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(a => !a)}
        className="relative p-2 text-gray-600 hover:text-blue-700"
        aria-label="Notificaciones"
      >
        🔔
        {notisNoVistas.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${alta > 0 ? 'bg-red-600' : 'bg-blue-500'}`}>
            {notisNoVistas.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg w-80 max-h-96 overflow-auto z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <p className="text-xs font-semibold text-gray-400 uppercase">Notificaciones</p>
            {notis.length > 0 && (
              <button onClick={marcarTodasVistas} className="text-xs text-blue-600 hover:underline">
                Marcar todas como vistas
              </button>
            )}
          </div>
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Cargando...</p>
          ) : notis.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin novedades 🎉</p>
          ) : (
            notis.map(n => {
              const vista = vistas[n.id] === n.mensaje
              return (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => setAbierto(false)}
                  className={`flex items-start gap-2 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${vista ? 'opacity-50' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${URGENCIA_COLOR[n.urgencia]}`} />
                  <span className="text-sm text-gray-700">{n.mensaje}</span>
                </Link>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
