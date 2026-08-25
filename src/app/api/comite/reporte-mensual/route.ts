import { NextRequest, NextResponse } from 'next/server'
import { getSesion } from '@/lib/auth'
import { generarReporteMensualPDF } from '@/lib/reporteMensual'

// Descarga el reporte de transparencia del mes elegido (ingresos y egresos de
// caja de ese mes calendario, más el avance del período de luz/GC si existe).
// Sin mes/anio en la query, usa el mes calendario actual.
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const hoy = new Date()
  const mes = Number(req.nextUrl.searchParams.get('mes')) || hoy.getMonth() + 1
  const anio = Number(req.nextUrl.searchParams.get('anio')) || hoy.getFullYear()

  try {
    const pdfBuffer = await generarReporteMensualPDF(mes, anio)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reporte-transparencia-coposa-${anio}-${String(mes).padStart(2, '0')}.pdf"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo generar el reporte' }, { status: 400 })
  }
}
