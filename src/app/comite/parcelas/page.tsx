import { createClient } from '@/lib/supabase/server'

export default async function ParcelasPage() {
  const supabase = await createClient()
  const { data: parcelas } = await supabase
    .from('parcelas')
    .select('*')
    .order('numero')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Parcelas</h1>
        <span className="text-sm text-gray-500">{parcelas?.length ?? 0} registradas</span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">N°</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dueño</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Usuario activo</th>
            </tr>
          </thead>
          <tbody>
            {parcelas?.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">#{p.numero}</td>
                <td className="px-4 py-2">{p.nombre_dueno}</td>
                <td className="px-4 py-2 text-gray-500">{p.email}</td>
                <td className="px-4 py-2 text-gray-500">{p.telefono || '—'}</td>
                <td className="px-4 py-2 text-center">{p.user_id ? '✅' : '—'}</td>
              </tr>
            ))}
            {(!parcelas || parcelas.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Sin parcelas registradas. Ejecuta el script de seed con el archivo CSV de parcelas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Para agregar o editar parcelas, ejecutar el script <code>scripts/seed-parcelas.ts</code> con el archivo <code>scripts/parcelas.csv</code>.
      </p>
    </div>
  )
}
