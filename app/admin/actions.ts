'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

// 1. NUEVA FUNCIÓN DE AUDITORÍA (ESPÍA)
export async function registrarLog(adminEmail: string, accion: string, detalle: string) {
  const { error } = await supabaseAdmin
    .from('auditoria_logs')
    .insert([{ admin_email: adminEmail, accion: accion, detalle: detalle }]);
  
  if (error) console.error("Error guardando log de auditoría:", error.message);
}

// 2. TUS FUNCIONES EXISTENTES (AHORA CON REGISTRO INVISIBLE)
export async function crearUsuarioAdmin(email: string, nombre: string, adminEmail: string = 'Sistema') {
  // Intentamos crearlo como nuevo
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: 'FGE2026*', 
    email_confirm: true,
    user_metadata: { full_name: nombre }
  })

  // Si marca error porque "Ya existe", lo actualizamos a la fuerza
  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const user = listData?.users.find(u => u.email === email);
      
      if (user) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, { 
          password: 'FGE2026*',
          email_confirm: true 
        });
        await registrarLog(adminEmail, 'RESETEO_ACCESO', `Fuerza clave FGE2026* y activación para: ${email}`);
      }
      return { success: true, msg: 'Cuenta reseteada y actualizada a FGE2026*' };
    }
    return { success: false, error: error.message };
  }

  await registrarLog(adminEmail, 'CREAR_ACCESO', `Cuenta nueva creada para: ${email}`);
  return { success: true, data };
}

export async function eliminarUsuarioAdmin(email: string, adminEmail: string = 'Sistema') {
  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return { success: false, error: listError.message };
  
  const user = data.users.find(u => u.email === email);
  if (user) {
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    await registrarLog(adminEmail, 'ELIMINAR_ACCESO', `Cuenta de acceso eliminada: ${email}`);
  }
  return { success: true };
}

export async function actualizarPasswordAdmin(email: string, nuevaPass: string, adminEmail: string = 'Sistema') {
  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return { success: false, error: listError.message };
  
  const user = data.users.find(u => u.email === email);
  if (!user) return { success: false, error: 'Usuario no encontrado en el sistema de acceso' };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: nuevaPass });
  if (error) return { success: false, error: error.message };
  
  await registrarLog(adminEmail, 'CAMBIO_PASSWORD', `Contraseña cambiada manualmente a: ${email}`);
  return { success: true };
}