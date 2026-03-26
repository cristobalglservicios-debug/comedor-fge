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

// 1. FUNCIÓN DE AUDITORÍA
export async function registrarLog(adminEmail: string, accion: string, detalle: string) {
  const { error } = await supabaseAdmin
    .from('auditoria_logs')
    .insert([{ admin_email: adminEmail, accion: accion, detalle: detalle }]);
  
  if (error) console.error("Error guardando log de auditoría:", error.message);
}

// 2. FUNCIÓN MAESTRA PARA EL DEV PANEL (Crea Auth + Perfil con Rol)
export async function crearUsuarioGlobal(email: string, nombre: string, dependencia: string, rol: string, pass: string, adminEmail: string = 'Sistema-Dev') {
  try {
    // A. Crear el usuario en el módulo de Autenticación
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: nombre.toUpperCase().trim() }
    });

    if (authError) {
      // Si ya existe en Auth, intentamos recuperar el ID para sincronizar el perfil por si acaso
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        const existingUser = await buscarUsuarioPorEmail(email);
        if (existingUser) {
          // Si ya existe, actualizamos su perfil en la DB para asegurar que el ROL sea correcto
          const { error: syncError } = await supabaseAdmin
            .from('perfiles')
            .upsert({
              email: email.toLowerCase().trim(),
              nombre_completo: nombre.toUpperCase().trim(),
              dependencia: dependencia.toUpperCase().trim(),
              rol: rol,
              tickets_restantes: rol === 'empleado' ? 5 : 0,
              tickets_canjeado: 0
            }, { onConflict: 'email' });

          if (syncError) return { success: false, error: "Auth existe, pero falló sincronización de perfil: " + syncError.message };
          
          await registrarLog(adminEmail, 'SYNC_EXISTENTE', `Usuario ya existía. Se forzó rol ${rol} para: ${email}`);
          return { success: true, msg: "El usuario ya existía, pero se actualizó su rol y perfil correctamente." };
        }
      }
      return { success: false, error: authError.message };
    }

    // B. Crear el Perfil vinculado en la tabla 'perfiles'
    const { error: profileError } = await supabaseAdmin
      .from('perfiles')
      .upsert({
        email: email.toLowerCase().trim(),
        nombre_completo: nombre.toUpperCase().trim(),
        dependencia: dependencia.toUpperCase().trim(),
        rol: rol,
        tickets_restantes: rol === 'empleado' ? 5 : 0,
        tickets_canjeado: 0
      }, { onConflict: 'nombre_completo' });

    if (profileError) {
      // Si falla la DB, borramos el de Auth para no dejar basura inconsistente
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return { success: false, error: "Error al crear perfil de base de datos: " + profileError.message };
    }

    await registrarLog(adminEmail, 'ALTA_MAESTRA', `Usuario creado con rol ${rol.toUpperCase()}: ${email}`);
    return { success: true };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3. FUNCIONES DE ADMINISTRACIÓN EXISTENTES (RESGUARDADAS)
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