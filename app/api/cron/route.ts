import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  // Validación de seguridad de Vercel (Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1. ELIMINACIÓN MASIVA: Se borra bitácora y se queman los vales sobrantes.
  await supabase.from('historial_comedor').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('perfiles').update({ tickets_restantes: 0, tickets_canjeado: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');

  // 2. DETECCIÓN DE SEMANA: ¿Qué fecha es hoy en Mérida?
  const hoy = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Merida"}));
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  const fechaHoy = `${y}-${m}-${d}`;

  // 3. RECUPERACIÓN DE SALA DE ESPERA: Buscamos si hay cuotas para este lunes
  const { data: cuotas } = await supabase.from('cuotas_programadas').select('*').eq('fecha_lunes', fechaHoy);

  if (cuotas && cuotas.length > 0) {
    // 4. INYECCIÓN DIRECTA: Les asignamos sus nuevos vales
    for (const c of cuotas) {
      await supabase.from('perfiles').update({ tickets_restantes: c.cuota }).eq('id', c.empleado_id);
    }
    // 5. LIMPIEZA DE ESPERA: Borramos las cuotas programadas porque ya se usaron
    await supabase.from('cuotas_programadas').delete().eq('fecha_lunes', fechaHoy);
  }

  // DEJAMOS HUELLA EN EL SISTEMA
  await supabase.from('auditoria_logs').insert([{ 
    admin_email: 'CRON_AUTO', 
    accion: 'CORTE_SEMANAL_AUTOMATICO', 
    detalle: `Corte realizado. ${cuotas?.length || 0} cuotas aplicadas.` 
  }]);

  return NextResponse.json({ success: true, message: 'Corte automático ejecutado', aplicadas: cuotas?.length || 0 });
}