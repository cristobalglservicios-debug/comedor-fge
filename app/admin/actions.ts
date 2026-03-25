'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

// Búsqueda segura sin límite de 1000 usuarios
async function buscarUsuarioPorEmail(email: string) {
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: page, perPage: 1000 });
    if (error || !data || data.users.length === 0) return null;
    
    const user = data.users.find(u => u.email === email);
    if (user) return user;
    
    if (data.users.length < 1000) return null; // Fin de los registros
    page++;
  }
}

// 1. NUEVA FUNCIÓN DE AUDITORÍA (ESPÍA)
export async function registrarLog(adminEmail: string, accion: string, detalle: string) {
  const { error } = await supabaseAdmin
    .from('auditoria_logs')
    .insert([{ admin_email: adminEmail, accion: accion, detalle: detalle }]);
  
  if (error) console.error("Error guardando log de auditoría:", error.message);
}

// 2. FUNCIONES EXISTENTES (AHORA CON REGISTRO INVISIBLE Y PAGINACIÓN SEGURA)
export async function crearUsuarioAdmin(email: string, nombre: string, adminEmail: string = 'Sistema', passwordInicial: string = 'FGE2026*') {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: passwordInicial, 
    email_confirm: true,
    user_metadata: { full_name: nombre }
  })

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      const user = await buscarUsuarioPorEmail(email);
      
      if (user) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, { 
          password: passwordInicial,
          email_confirm: true 
        });
        await registrarLog(adminEmail, 'RESETEO_ACCESO', `Fuerza clave ${passwordInicial} y activación para: ${email}`);
      }
      return { success: true, msg: `Cuenta reseteada y actualizada a ${passwordInicial}` };
    }
    return { success: false, error: error.message };
  }

  await registrarLog(adminEmail, 'CREAR_ACCESO', `Cuenta nueva creada para: ${email}`);
  return { success: true, data };
}

export async function eliminarUsuarioAdmin(email: string, adminEmail: string = 'Sistema') {
  const user = await buscarUsuarioPorEmail(email);
  
  if (user) {
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    await registrarLog(adminEmail, 'ELIMINAR_ACCESO', `Cuenta de acceso eliminada: ${email}`);
    return { success: true };
  }
  return { success: false, error: 'Usuario no encontrado' };
}

export async function actualizarPasswordAdmin(email: string, nuevaPass: string, adminEmail: string = 'Sistema') {
  const user = await buscarUsuarioPorEmail(email);
  if (!user) return { success: false, error: 'Usuario no encontrado en el sistema de acceso' };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: nuevaPass });
  if (error) return { success: false, error: error.message };
  
  await registrarLog(adminEmail, 'CAMBIO_PASSWORD', `Contraseña cambiada manualmente a: ${email}`);
  return { success: true };
}