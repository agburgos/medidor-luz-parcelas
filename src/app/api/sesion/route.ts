import { NextResponse } from 'next/server'
import { getSesion } from '@/lib/auth'

// Info liviana de la sesión actual para componentes cliente (mostrar/ocultar
// acciones según permisos, sin exponer datos sensibles).
export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  return NextResponse.json({
    rol: sesion.rol,
    nombre: sesion.nombre,
    esSuperadmin: sesion.esSuperadmin,
  })
}
