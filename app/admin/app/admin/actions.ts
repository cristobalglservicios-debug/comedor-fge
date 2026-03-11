'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Usa la clave secreta que acabas de guardar
)

export async function crearUsuarioAdmin(email: string, nombre: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: 'FGE2026*', // Contraseña genérica
    email_confirm: true,
    user_metadata: { full_name: nombre }
  })

  if (error) {
    if (error.message.includes('already registered')) return { success: true, msg: 'Ya existe' };
    return { success: false, error: error.message };
  }

  return { success: true, data };
}