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

export default function Notificaciones() {
  const [abierto, setAbierto] = useState(false)
  const [notis, setNotis] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
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

  const alta = notis.filter(n => n.urgencia === 'alta').length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(a => !a)}
        className="relative p-2 text-gray-600 hover:text-blue-700"
        aria-label="Notificaciones"
      >
        🔔
        {notis.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${alta > 0 ? 'bg-red-600' : 'bg-blue-500'}`}>
            {notis.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg w-80 max-h-96 overflow-auto z-50">
          <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b">Notificaciones</p>
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Cargando...</p>
          ) : notis.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin novedades 🎉</p>
          ) : (
            notis.map(n => (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => setAbierto(false)}
                className="flex items-start gap-2 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${URGENCIA_COLOR[n.urgencia]}`} />
                <span className="text-sm text-gray-700">{n.mensaje}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
