import { createServiceClient } from '@/lib/supabase/server'
import { Sesion } from '@/lib/auth'

// Registra una acción administrativa con quién la hizo y cuándo.
// Usar en toda mutación sensible: crear período, validar pago, editar tarifa,
// cambiar estado de cuenta, editar/eliminar parcela, cerrar asamblea, etc.
export async function registrar(
  sesion: Sesion | null,
  accion: string,
  entidad?: string,
  entidad_id?: string,
  detalle?: Record<string, unknown>
) {
  if (!sesion) return
  const supabase = createServiceClient()
  await supabase.from('bitacora').insert({
    usuario_id: sesion.userId,
    usuario_nombre: sesion.nombre ?? sesion.cargo ?? 'Comité',
    accion,
    entidad: entidad ?? null,
    entidad_id: entidad_id ?? null,
    detalle: detalle ?? null,
  })
}
