'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function crearUsuarioAdmin(email: string, nombre: string) {
  // 1. Intentamos crearlo como nuevo
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: 'FGE2026*', 
    email_confirm: true,
    user_metadata: { full_name: nombre }
  })

  // 2. Si marca error porque "Ya existe", lo actualizamos a la fuerza
  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      
      // Buscamos su ID secreto
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const user = listData?.users.find(u => u.email === email);
      
      // Le inyectamos la clave correcta y lo activamos a la fuerza
      if (user) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, { 
          password: 'FGE2026*',
          email_confirm: true 
        });
      }
      return { success: true, msg: 'Cuenta reseteada y actualizada a FGE2026*' };
    }
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