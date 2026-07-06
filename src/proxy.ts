import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Redirigir no autenticados al login
  if (!user && (path.startsWith('/comite') || path.startsWith('/parcelero'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirigir login a home si ya está autenticado
  if (user && path === '/login') {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()
    const destino = perfil?.rol === 'comite' ? '/comite' : '/parcelero'
    return NextResponse.redirect(new URL(destino, request.url))
  }

  // Proteger rutas /comite solo para rol comité
  if (user && path.startsWith('/comite')) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()
    if (perfil?.rol !== 'comite') {
      return NextResponse.redirect(new URL('/parcelero', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron).*)'],
}
