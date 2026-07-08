# Setup de Módulo de Caja y Tesorería

## Pasos para activar el módulo de Caja

### IMPORTANTE: Paso 1 - Actualizar esquema

Debido a cambios en la migración 015, necesitas ejecutar este SQL en Supabase **ANTES** de proceder:

1. Abre [Supabase Dashboard](https://app.supabase.com/)
2. Ve a **SQL Editor**
3. Pega el siguiente SQL:

```sql
-- Si la tabla ya existe, actualizarla para hacer usuario_id nullable
ALTER TABLE IF EXISTS caja_movimientos ALTER COLUMN usuario_id DROP NOT NULL;

-- Recrear políticas con usuario_id nullable
DROP POLICY IF EXISTS "comite_insert_caja_movimientos" ON caja_movimientos;

CREATE POLICY "comite_insert_caja_movimientos" ON caja_movimientos
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'rol' = 'comite' AND
    (usuario_id = auth.uid() OR usuario_id IS NULL)
  );
```

4. Presiona **Cmd+Enter** para ejecutar

### Paso 2: Ejecutar la migración SQL completa

1. Abre el archivo: `supabase/migration-015-caja.sql`
2. Copia TODO el contenido
3. En Supabase SQL Editor, pega el SQL
4. Ejecuta con **Cmd+Enter**

### Paso 3: Migrar pagos existentes

Una vez ejecutado el SQL, ejecuta la migración retroactiva:

```bash
curl -X POST http://localhost:3002/api/admin/migrar-caja \
  -H "x-admin-secret: admin-setup-2026" \
  -H "Content-Type: application/json"
```

**Resultado esperado:** Los 21 pagos validados ($766.468) se registran en caja_movimientos

### Paso 4: Acceder al módulo en la app

Una vez completados los pasos anteriores:

- **Comité:** Ve a `/comite/caja`
  - Registra ingresos y egresos manualmente
  - Accede al **Libro Contable** desde el botón en la esquina superior derecha

- **Funcionalidades:**
  - ✅ Registro de ingresos (con concepto, monto, fecha, documento opcional)
  - ✅ Registro de egresos (igual estructura)
  - ✅ Saldo actual en tiempo real (Inicial + Ingresos - Egresos)
  - ✅ Historial de movimientos recientes
  - ✅ **Libro Contable** con 3 vistas:
    1. **Estado de Resultados** — Saldo inicial + ingresos - egresos = saldo final
    2. **Resumen Mensual** — Ingresos/egresos agrupados por mes y concepto
    3. **Registro Cronológico** — Todos los movimientos ordenados por fecha con saldo acumulado
  - ✅ Impresión/PDF desde el libro contable

### Datos iniciales

- **Saldo Inicial:** $169.158 (registrado en `caja_saldos` al 2026-07-01)
- **Pagos Luz:** Migrador automáticamente en `/comite/caja/libro-contable`
- **Nuevos movimientos:** Los que registres manualmente en `/comite/caja`

### Validación

Para verificar que todo funciona:

1. Abre http://localhost:3002/comite/caja (con sesión de comité)
2. Verifica que ves:
   - Saldo Inicial: $169.158
   - Total Ingresos: $766.468+ (según pagos migrados + cualquier otro ingreso)
   - Total Egresos: $0 (o más si registraste)
   - Saldo Actual: correcto
3. Abre el **Libro Contable** y verifica los movimientos de pago migrados

### Errores comunes

- **"Could not find the table 'public.caja_movimientos'"** → No ejecutaste la migración SQL aún
- **"No autorizado"** → Asegúrate de estar logueado como comité, no como parcelero
- **"null value in column usuario_id violates not-null constraint"** → Ejecuta el SQL del Paso 1
- El saldo no cambios después de migrar → Recarga la página (F5)

## Notas

- Todos los movimientos quedan registrados en la bitácora (`bitacora` tabla)
- Los documentos se suben a Storage bucket "archivos"
- El libro contable se genera automáticamente a partir de los movimientos
- El endpoint `/api/admin/migrar-caja` es temporal y solo funciona con secret `admin-setup-2026`
