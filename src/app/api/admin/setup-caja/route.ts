import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ENDPOINT ADMIN TEMPORAL SOLO PARA DESARROLLO
// En producción, ejecutar migraciones via Supabase o CLI
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-setup-secret')
  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const sql = `
      create table if not exists caja_movimientos (
        id uuid primary key default gen_random_uuid(),
        tipo text not null check (tipo in ('ingreso', 'egreso')),
        concepto text not null,
        monto numeric(15,2) not null check (monto > 0),
        fecha date not null default current_date,
        documento_url text,
        observacion text,
        usuario_id uuid not null references auth.users(id),
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now()
      );

      create table if not exists caja_saldos (
        id uuid primary key default gen_random_uuid(),
        fecha date not null,
        saldo_inicial numeric(15,2),
        saldo_final numeric(15,2) not null,
        total_ingresos numeric(15,2) default 0,
        total_egresos numeric(15,2) default 0,
        created_at timestamp with time zone default now()
      );

      create index if not exists idx_caja_movimientos_fecha on caja_movimientos(fecha);
      create index if not exists idx_caja_movimientos_tipo on caja_movimientos(tipo);
      create index if not exists idx_caja_saldos_fecha on caja_saldos(fecha);

      alter table caja_movimientos enable row level security;
      alter table caja_saldos enable row level security;

      create policy if not exists "comite_read_caja_movimientos" on caja_movimientos
        for select using (auth.jwt() ->> 'rol' = 'comite');

      create policy if not exists "comite_insert_caja_movimientos" on caja_movimientos
        for insert with check (auth.jwt() ->> 'rol' = 'comite' and usuario_id = auth.uid());

      create policy if not exists "comite_read_caja_saldos" on caja_saldos
        for select using (auth.jwt() ->> 'rol' = 'comite');

      insert into caja_saldos (fecha, saldo_inicial, saldo_final)
      values ('2026-07-01', 0, 169158.00)
      on conflict do nothing;
    `

    const { error } = await supabase.rpc('exec', { sql })
    if (error && !error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: 'Tablas de caja creadas/verificadas' })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
