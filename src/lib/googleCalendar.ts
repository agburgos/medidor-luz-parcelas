// Genera un link "Agregar a Google Calendar" con el evento prellenado.
// No requiere API keys ni OAuth: es la URL pública de plantilla de Google Calendar.
export function googleCalendarLink(d: {
  titulo: string
  fecha: string // YYYY-MM-DD
  horaInicio?: string | null // HH:MM
  horaTermino?: string | null // HH:MM
  lugar?: string | null
  descripcion?: string | null
}): string {
  const soloFecha = d.fecha.replace(/-/g, '')

  let dates: string
  if (d.horaInicio) {
    const inicio = d.horaInicio.replace(':', '').padEnd(6, '0')
    const fin = d.horaTermino
      ? d.horaTermino.replace(':', '').padEnd(6, '0')
      : String(Math.min(23, Number(d.horaInicio.slice(0, 2)) + 1)).padStart(2, '0') + d.horaInicio.slice(3, 5) + '00'
    dates = `${soloFecha}T${inicio}/${soloFecha}T${fin}`
  } else {
    // Evento de todo el día: la fecha de término debe ser el día siguiente
    const fin = new Date(d.fecha + 'T00:00:00')
    fin.setDate(fin.getDate() + 1)
    const finStr = fin.toISOString().slice(0, 10).replace(/-/g, '')
    dates = `${soloFecha}/${finStr}`
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: d.titulo,
    dates,
    ctz: 'America/Santiago',
  })
  if (d.lugar) params.set('location', d.lugar)
  if (d.descripcion) params.set('details', d.descripcion)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
