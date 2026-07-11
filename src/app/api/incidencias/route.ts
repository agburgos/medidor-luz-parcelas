import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: listado de incidencias. Comité ve todas (con filtro opcional de estado);
// un parcelero ve solo las de su propia parcela.
// ?propia=1 fuerza el filtro por la parcela de la sesión actual incluso si es
// comité (usado por el botón de pánico, para no mostrar/cancelar alertas ajenas
// cuando un miembro del comité está viendo su propia parcela).
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const estado = req.nextUrl.searchParams.get('estado')
  const soloPropia = req.nextUrl.searchParams.get('propia') === '1'

  let query = supabase
    .from('incidencias')
    .select('id, categoria, descripcion, estado, latitud, longitud, confirmado_falsa_alarma, fecha_activacion, fecha_resolucion, parcela:parcelas(numero, nombre_dueno, telefono)')
    .order('fecha_activacion', { ascending: false })

  if (sesion.rol !== 'comite' || soloPropia) {
    if (!sesion.parcelaId) return NextResponse.json([])
    query = query.eq('parcela_id', sesion.parcelaId)
  }

  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}
