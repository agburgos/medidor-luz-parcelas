# Setup para Migración Retroactiva de Pagos a Caja

El sistema de Caja está listo, pero necesita **dos pasos manuales en Supabase** para migrar los $766.468 en pagos que ya están registrados.

## Paso 1: Actualizar esquema de caja_movimientos

En el **SQL Editor** de Supabase, ejecuta esto:

```sql
-- Permitir usuario_id NULL para migración retroactiva
ALTER TABLE caja_movimientos ALTER COLUMN usuario_id DROP NOT NULL;

-- Actualizar política de insert para permitir NULL
DROP POLICY "comite_insert_caja_movimientos" ON caja_movimientos;

CREATE POLICY "comite_insert_caja_movimientos" ON caja_movimientos
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'rol' = 'comite' AND
    (usuario_id = auth.uid() OR usuario_id IS NULL)
  );
```

## Paso 2: Ejecutar migración retroactiva

Una vez ejecutado el SQL anterior, corre:

```bash
curl -X POST http://localhost:3002/api/admin/migrar-caja \
  -H "x-admin-secret: admin-setup-2026" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
```json
{
  "migrados": 21,
  "total": 21,
  "errores": [],
  "montoTotal": 766468
}
```

## Paso 3: Verificar en el dashboard

1. Abre http://localhost:3002/comite
2. Verifica que **Caja** ahora muestra: **$970.126** (= $169.158 + $766.468)
3. Abre http://localhost:3002/comite/caja/libro-contable y verifica 21 movimientos

## Notas

- Solo ejecuta el SQL una vez (es idempotente gracias al `DROP POLICY IF EXISTS`)
- El endpoint `/api/admin/migrar-caja` es temporal y se puede eliminar después de confirmar que todo funcionó
- El secret `admin-setup-2026` solo funciona durante este setup inicial
