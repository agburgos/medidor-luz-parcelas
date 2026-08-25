import { NextRequest, NextResponse } from 'next/server'
import { getSesion } from '@/lib/auth'
import { generarReporteMensualPDF } from '@/lib/reporteMensual'

// Descarga manual del reporte mensual de transparencia. Sin mes/anio en la
// query, usa el mes calendario anterior (el último mes ya cerrado).
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const hoy = new Date()
  let mes = Number(req.nextUrl.searchParams.get('mes'))
  let anio = Number(req.nextUrl.searchParams.get('anio'))
  if (!mes || !anio) {
    mes = hoy.getMonth() === 0 ? 12 : hoy.getMonth()
    anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear()
  }

  const pdfBuffer = await generarReporteMensualPDF(mes, anio)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-mensual-coposa-${anio}-${String(mes).padStart(2, '0')}.pdf"`,
    },
  })
}
