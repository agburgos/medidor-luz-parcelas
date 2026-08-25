import { NextRequest, NextResponse } from 'next/server'
import { getSesion } from '@/lib/auth'
import { generarReporteMensualPDF } from '@/lib/reporteMensual'

// Descarga manual del reporte de transparencia. Sin periodo_id en la query,
// reporta sobre el período de luz abierto más reciente (o el cerrado más
// reciente si no hay ninguno abierto).
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const periodoId = req.nextUrl.searchParams.get('periodo_id') || undefined

  try {
    const pdfBuffer = await generarReporteMensualPDF(periodoId)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reporte-transparencia-coposa-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo generar el reporte' }, { status: 400 })
  }
}
