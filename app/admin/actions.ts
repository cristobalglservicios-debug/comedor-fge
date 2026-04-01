'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

// Cliente secundario solo para leer y verificar tokens sin privilegios
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// BLINDAJE ORO + RADAR DE INTRUSOS: Verificación estricta de identidad y registro de ataques
async function verificarAdmin(token: string, accionIntento: string) {
  if (!token) {
    await supabaseAdmin.from('alertas_seguridad').insert([{ email_intruso: 'ANÓNIMO / SIN TOKEN', accion_intentada: accionIntento }]);
    throw new Error("Acceso denegado: No hay token de seguridad");
  }
  
  // 1. Validamos que el token sea real
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) {
    await supabaseAdmin.from('alertas_seguridad').insert([{ email_intruso: 'TOKEN FALSO / EXPIRADO', accion_intentada: accionIntento }]);
    throw new Error("Acceso denegado: Token inválido o falsificado");
  }

  // 2. Buscamos el perfil del usuario validado para comprobar su ROL exacto
  const { data: perfil } = await supabaseAdmin.from('perfiles').select('rol, email').eq('email', user.email).single();
  
  const esAdmin = perfil?.rol === 'admin' || perfil?.rol === 'dev' || user.email === 'cristobal.dev@fge.gob.mx' || user.email === 'admin.cristobal@fge.gob.mx';
  
  if (!esAdmin) {
    // DISPARO DEL RADAR: El usuario está logueado pero intentó hacer algo que no debe
    await supabaseAdmin.from('alertas_seguridad').insert([{ email_intruso: user.email, accion_intentada: accionIntento }]);
    throw new Error("Acceso denegado: Nivel de privilegios insuficiente. Intento bloqueado y reportado.");
  }

  return user.email; // Retornamos el email real y comprobado por el servidor
}

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
export async function registrarLog(adminToken: string, accion: string, detalle: string) {
  try {
    const adminEmailReal = await verificarAdmin(adminToken, `Intento de registrar log: ${accion}`);
    const { error } = await supabaseAdmin
      .from('auditoria_logs')
      .insert([{ admin_email: adminEmailReal, accion: accion, detalle: detalle }]);
    
    if (error) console.error("Error guardando log de auditoría:", error.message);
  } catch (e) {
    console.error("Intento de auditoría bloqueado por seguridad.");
  }
}

// ACTUALIZACIÓN: EDITAR PERFIL DESDE DEV PANEL (INCLUYE NOMBRE)
export async function actualizarPerfilGlobal(id: string, email: string, nuevoRol: string, nuevaDep: string, nuevoNombre: string, adminToken: string) {
  try {
    const adminEmailReal = await verificarAdmin(adminToken, `Intento de editar perfil de: ${email} a rol ${nuevoRol}`);
    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({ 
        rol: nuevoRol, 
        dependencia: nuevaDep.toUpperCase().trim(),
        nombre_completo: nuevoNombre.toUpperCase().trim()
      })
      .eq('id', id);

    if (error) throw error;

    await registrarLog(adminToken, 'EDICION_PERFIL_DEV', `Editó a ${email}: Nombre: ${nuevoNombre.toUpperCase()}, Rol: ${nuevoRol}, Dep: ${nuevaDep}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// NUEVA FUNCIÓN: ELIMINAR USUARIO TOTAL (AUTH + PERFIL)
export async function eliminarUsuarioGlobal(email: string, adminToken: string) {
  try {
    const adminEmailReal = await verificarAdmin(adminToken, `Intento de eliminar globalmente a: ${email}`);
    const user = await buscarUsuarioPorEmail(email);
    
    if (user) {
      // Eliminar de Auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (authError) throw authError;

      // Eliminar de Perfiles (por si no se borró por cascade)
      await supabaseAdmin.from('perfiles').delete().eq('email', email);

      await registrarLog(adminToken, 'ELIMINACION_TOTAL_DEV', `Eliminó permanentemente a: ${email}`);
      return { success: true };
    }
    return { success: false, error: 'Usuario no encontrado en Auth' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 2. FUNCIÓN MAESTRA PARA EL DEV PANEL (Crea Auth + Perfil con Rol)
export async function crearUsuarioGlobal(email: string, nombre: string, dependencia: string, rol: string, pass: string, adminToken: string) {
  try {
    const adminEmailReal = await verificarAdmin(adminToken, `Intento de crear usuario global: ${email} con rol ${rol}`);
    
    // A. Crear el usuario en el módulo de Autenticación
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: nombre.toUpperCase().trim() }
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        const existingUser = await buscarUsuarioPorEmail(email);
        if (existingUser) {
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
          
          await registrarLog(adminToken, 'SYNC_EXISTENTE', `Usuario ya existía. Se forzó rol ${rol} para: ${email}`);
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
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return { success: false, error: "Error al crear perfil de base de datos: " + profileError.message };
    }

    await registrarLog(adminToken, 'ALTA_MAESTRA', `Usuario creado con rol ${rol.toUpperCase()}: ${email}`);
    return { success: true };

  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 3. FUNCIONES DE ADMINISTRACIÓN EXISTENTES (RESGUARDADAS)
export async function crearUsuarioAdmin(email: string, nombre: string, adminToken: string, passwordInicial: string = 'FGE2026*') {
  try {
    const adminEmailReal = await verificarAdmin(adminToken, `Intento de crear usuario desde Admin: ${email}`);
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
          await registrarLog(adminToken, 'RESETEO_ACCESO', `Fuerza clave ${passwordInicial} y activación para: ${email}`);
        }
        return { success: true, msg: `Cuenta reseteada y actualizada a ${passwordInicial}` };
      }
      return { success: false, error: error.message };
    }

    await registrarLog(adminToken, 'CREAR_ACCESO', `Cuenta nueva creada para: ${email}`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function eliminarUsuarioAdmin(email: string, adminToken: string) {
  try {
    const adminEmailReal = await verificarAdmin(adminToken, `Intento de eliminar usuario desde Admin: ${email}`);
    const user = await buscarUsuarioPorEmail(email);
    
    if (user) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      await registrarLog(adminToken, 'ELIMINAR_ACCESO', `Cuenta de acceso eliminada: ${email}`);
      return { success: true };
    }
    return { success: false, error: 'Usuario no encontrado' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function actualizarPasswordAdmin(email: string, nuevaPass: string, adminToken: string) {
  try {
    const adminEmailReal = await verificarAdmin(adminToken, `Intento de cambiar contraseña a: ${email}`);
    const user = await buscarUsuarioPorEmail(email);
    if (!user) return { success: false, error: 'Usuario no encontrado en el sistema de acceso' };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: nuevaPass });
    if (error) return { success: false, error: error.message };
    
    await registrarLog(adminToken, 'CAMBIO_PASSWORD', `Contraseña cambiada manualmente a: ${email}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}