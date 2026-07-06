'use client'

import { useEffect } from 'react'

/**
 * Hace ordenables TODAS las tablas de la app por click en el encabezado.
 * Funciona por delegación de eventos sobre el DOM, así sirve tanto para
 * tablas renderizadas en el servidor como en el cliente.
 *
 * - 1er click: orden ascendente (▲)
 * - 2do click: descendente (▼)
 * - Detecta números, montos ($1.234), fechas (dd-mm-aaaa) y texto.
 */
export default function TablasOrdenables() {
  useEffect(() => {
    function valorCelda(fila: HTMLTableRowElement, idx: number): string {
      const celda = fila.cells[idx]
      return celda ? (celda.textContent || '').trim() : ''
    }

    function clave(texto: string): { tipo: 'num' | 'fecha' | 'texto'; valor: number | string } {
      // Monto o número: $1.234.567, -300, 78,5, #52
      const limpio = texto.replace(/[$.#\s]/g, '').replace(',', '.')
      if (limpio !== '' && !isNaN(Number(limpio))) return { tipo: 'num', valor: Number(limpio) }
      // Fecha chilena dd-mm-aaaa o dd/mm/aaaa
      const m = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
      if (m) return { tipo: 'fecha', valor: Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) }
      return { tipo: 'texto', valor: texto.toLowerCase() }
    }

    function onClick(e: MouseEvent) {
      const th = (e.target as HTMLElement).closest('th')
      if (!th) return
      const tabla = th.closest('table')
      const thead = th.closest('thead')
      const tbody = tabla?.querySelector('tbody')
      if (!tabla || !thead || !tbody) return
      if (!(th.textContent || '').trim()) return

      const idx = Array.from(th.parentElement!.children).indexOf(th)
      const asc = th.dataset.orden !== 'asc'

      // Limpiar indicadores de otros encabezados
      thead.querySelectorAll('th').forEach(o => {
        delete o.dataset.orden
        o.textContent = (o.textContent || '').replace(/ [▲▼]$/, '')
      })
      th.dataset.orden = asc ? 'asc' : 'desc'
      th.textContent = (th.textContent || '').replace(/ [▲▼]$/, '') + (asc ? ' ▲' : ' ▼')

      // Filas de datos (ignorar filas de "sin datos" con colspan)
      const filas = Array.from(tbody.querySelectorAll('tr')).filter(
        f => !f.querySelector('td[colspan]')
      ) as HTMLTableRowElement[]

      filas.sort((a, b) => {
        const ka = clave(valorCelda(a, idx))
        const kb = clave(valorCelda(b, idx))
        let cmp: number
        if (ka.tipo === 'texto' || kb.tipo === 'texto') {
          cmp = String(ka.valor).localeCompare(String(kb.valor), 'es')
        } else {
          cmp = Number(ka.valor) - Number(kb.valor)
        }
        return asc ? cmp : -cmp
      })

      filas.forEach(f => tbody.appendChild(f))
    }

    // Cursor de mano en encabezados
    const style = document.createElement('style')
    style.textContent = 'thead th { cursor: pointer; user-select: none; } thead th:hover { opacity: 0.75; }'
    document.head.appendChild(style)

    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      style.remove()
    }
  }, [])

  return null
}
