const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function nombreMes(mes: number): string {
  return MESES[mes - 1]
}

/**
 * Un período de luz factura el consumo entre el 11 del mes anterior y el 10
 * del propio mes del período (así lo mide IEL) — nunca el mes calendario
 * completo. Ej.: el período "Junio 2026" corresponde a "11 de mayo al 10 de junio".
 */
export function rangoFechasPeriodo(mes: number, anio: number): string {
  const mesAnteriorIdx = mes === 1 ? 12 : mes - 1
  const anioAnterior = mes === 1 ? anio - 1 : anio
  return `11 de ${nombreMes(mesAnteriorIdx)}${anioAnterior !== anio ? ` ${anioAnterior}` : ''} al 10 de ${nombreMes(mes)} ${anio}`
}
