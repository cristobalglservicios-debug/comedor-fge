'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function crearUsuarioAdmin(email: string, nombre: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: 'FGE2026*', 
    email_confirm: true,
    user_metadata: { full_name: nombre }
  })

  if (error) {
    if (error.message.includes('already registered')) return { success: true, msg: 'Ya existe' };
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function eliminarUsuarioAdmin(email: string) {
  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return { success: false, error: listError.message };
  
  const user = data.users.find(u => u.email === email);
  if (user) {
    await supabaseAdmin.auth.admin.deleteUser(user.id);
  }
  return { success: true };
}

export async function actualizarPasswordAdmin(email: string, nuevaPass: string) {
  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return { success: false, error: listError.message };
  
  const user = data.users.find(u => u.email === email);
  if (!user) return { success: false, error: 'Usuario no encontrado en el sistema de acceso' };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: nuevaPass });
  if (error) return { success: false, error: error.message };
  
  return { success: true };
}