'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Terminal, ShieldAlert, Users, Database, Activity, Power, Trash2, LogOut, Search, UserPlus, AlertTriangle, CheckCircle2, Loader2, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { crearUsuarioGlobal } from '../admin/actions'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'roles' | 'switches' | 'danger' | 'auditoria';

export default function DevPanelPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('roles');
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string, tipo: 'exito' | 'error' } | null>(null);

  // Estados de Datos
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [perfilesFiltrados, setPerfilesFiltrados] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [configuraciones, setConfiguraciones] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // Estado Modal Nuevo Usuario
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoUser, setNuevoUser] = useState({ nombre: '', email: '', rol: 'empleado', dependencia: '', pass: 'FGE2026*' });

  useEffect(() => {
    validarAccesoDev();
  }, []);

  const validarAccesoDev = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }

    const email = session.user.email?.toLowerCase();
    const { data: miPerfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('email', email)
      .maybeSingle();

    // SEGURIDAD: Solo entra si tiene rol 'dev'
    if (miPerfil?.rol === 'dev') {
      setLoadingAcceso(false);
      cargarDatos();
    } else {
      router.push('/');
    }
  };

  const cargarDatos = async () => {
    // 1. Cargar Perfiles para Roles
    const { data: dataPerfiles } = await supabase.from('perfiles').select('*').order('nombre_completo', { ascending: true });
    if (dataPerfiles) {
      setPerfiles(dataPerfiles);
      setPerfilesFiltrados(dataPerfiles);
    }

    // 2. Cargar Switches de Configuración
    const { data: dataConfig } = await supabase.from('system_config').select('*').order('id', { ascending: true });
    if (dataConfig) setConfiguraciones(dataConfig);

    // 3. Cargar Logs de Auditoría (Últimos 50 movimientos)
    const { data: dataLogs } = await supabase.from('historial_comedor').select('*').order('fecha_hora', { ascending: false }).limit(50);
    if (dataLogs) setLogs(dataLogs);
  };

  const manejarBusqueda = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.toLowerCase();
    setBusqueda(valor);
    const filtrados = perfiles.filter(p => 
        p.nombre_completo.toLowerCase().includes(valor) || 
        (p.email && p.email.toLowerCase().includes(valor)) ||
        p.dependencia.toLowerCase().includes(valor)
    );
    setPerfilesFiltrados(filtrados);
  };

  const mostrarMensaje = (texto: string, tipo: 'exito' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 4000);
  };

  // --- ACCIÓN: CREAR USUARIO GLOBAL (AUTH + DB) ---
  const ejecutarCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargandoAccion(true);
    
    const res = await crearUsuarioGlobal(
        nuevoUser.email, 
        nuevoUser.nombre, 
        nuevoUser.dependencia, 
        nuevoUser.rol, 
        nuevoUser.pass
    );
    
    if (res.success) {
      mostrarMensaje(`Usuario ${nuevoUser.rol.toUpperCase()} creado con éxito`, 'exito');
      setModalNuevo(false);
      setNuevoUser({ nombre: '', email: '', rol: 'empleado', dependencia: '', pass: 'FGE2026*' });
      cargarDatos();
    } else {
      mostrarMensaje(res.error || 'Error al ejecutar alta', 'error');
    }
    setCargandoAccion(false);
  };

  // --- ACCIONES DE ROLES ---
  const actualizarRol = async (id: string, nuevoRol: string) => {
    setCargandoAccion(true);
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', id);
    if (error) {
      mostrarMensaje(`Error al actualizar rol: ${error.message}`, 'error');
    } else {
      mostrarMensaje('Rol actualizado correctamente', 'exito');
      cargarDatos();
    }
    setCargandoAccion(false);
  };

  // --- ACCIONES DE SWITCHES ---
  const toggleSwitch = async (id: string, valorActual: boolean) => {
    setCargandoAccion(true);
    const nuevoValor = !valorActual;
    const { error } = await supabase.from('system_config').update({ valor: nuevoValor }).eq('id', id);
    if (error) {
      mostrarMensaje(`Error al cambiar switch: ${error.message}`, 'error');
    } else {
      mostrarMensaje(`Switch ${id} cambiado a ${nuevoValor}`, 'exito');
      cargarDatos();
    }
    setCargandoAccion(false);
  };

  // --- ACCIONES DANGER ZONE (RAW DB) ---
  const purgarTabla = async (tabla: string) => {
    const confirmacion = window.prompt(`🔥 ADVERTENCIA CRÍTICA 🔥\nEstás a punto de vaciar la tabla '${tabla}'.\nEscribe "ELIMINAR" para confirmar:`);
    if (confirmacion !== 'ELIMINAR') {
      mostrarMensaje('Operación cancelada por seguridad', 'error');
      return;
    }

    setCargandoAccion(true);
    const { error } = await supabase.from(tabla).delete().neq('id', 'uuid-imposible-que-exista'); 
    
    if (error) {
      mostrarMensaje(`Error al purgar ${tabla}: ${error.message}`, 'error');
    } else {
      mostrarMensaje(`Tabla ${tabla} purgada exitosamente.`, 'exito');
      cargarDatos();
    }
    setCargandoAccion(false);
  };

  const reiniciarTicketsSemanales = async () => {
    const cantidad = window.prompt('¿A cuántos vales quieres reiniciar a TODOS los empleados? (Ej. 5)');
    const cantNum = parseInt(cantidad || '0');
    
    if (!cantNum || cantNum <= 0) return;

    if (!confirm(`¿Seguro que quieres poner a TODOS los empleados en ${cantNum} vales?`)) return;

    setCargandoAccion(true);
    const { error } = await supabase.from('perfiles').update({ tickets_restantes: cantNum, tickets_canjeado: 0 }).neq('id', '0');
    
    if (error) {
      mostrarMensaje(`Error al reiniciar: ${error.message}`, 'error');
    } else {
      mostrarMensaje(`Saldos reiniciados a ${cantNum} para toda la plantilla.`, 'exito');
      cargarDatos();
    }
    setCargandoAccion(false);
  };

  if (loadingAcceso) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-emerald-500 font-bold"><Loader2 className="animate-spin mr-3"/> INICIANDO PROTOCOLO DEV...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0F172A] font-mono text-slate-300 pb-10">
      
      <nav className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/50">
              <Terminal className="text-emerald-400" size={20} />
            </div>
            <div>
              <h1 className="text-white font-black uppercase tracking-widest text-sm">Dev_Panel<span className="text-emerald-500 animate-pulse">_</span></h1>
              <p className="text-[9px] text-slate-500 tracking-[0.3em] uppercase">Control Maestro FGE</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {cargandoAccion && <Loader2 className="animate-spin text-emerald-500" size={18} />}
            <button onClick={() => router.push('/mi-vale')} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all">
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>
      </nav>

      {mensaje && (
        <div className={`fixed top-20 right-4 z-[100] p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in ${mensaje.tipo === 'exito' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400' : 'bg-red-950/90 border-red-500/50 text-red-400'}`}>
          {mensaje.tipo === 'exito' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
          <p className="text-xs font-bold uppercase tracking-wide">{mensaje.texto}</p>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 mt-8">
        
        <div className="flex bg-slate-900 rounded-xl p-1 mb-8 border border-slate-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'roles', label: 'Gestión Roles', icon: <Users size={16}/> },
            { id: 'switches', label: 'Kill Switches', icon: <Power size={16}/> },
            { id: 'auditoria', label: 'Logs Auditoría', icon: <Activity size={16}/> },
            { id: 'danger', label: 'Danger Zone', icon: <ShieldAlert size={16}/> }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id as Tab)}
              className={`flex-1 min-w-[150px] py-3 rounded-lg text-[11px] font-bold uppercase flex items-center justify-center gap-2 transition-all ${activeTab === t.id ? 'bg-slate-800 text-emerald-400 shadow-inner' : 'text-slate-500 hover:bg-slate-800/50'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* --- TAB ROLES --- */}
        {activeTab === 'roles' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-black text-white uppercase tracking-widest">Usuarios</h2>
                <button 
                  onClick={() => setModalNuevo(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-lg"
                >
                  <UserPlus size={16} /> Nuevo Usuario
                </button>
              </div>
              <div className="relative w-full sm:w-72">
                <input type="text" value={busqueda} onChange={manejarBusqueda} placeholder="Buscar por nombre o correo..." className="w-full bg-slate-950 border border-slate-700 p-3 pl-10 rounded-xl text-xs text-white focus:border-emerald-500 outline-none transition-colors" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 uppercase font-black tracking-widest border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Dependencia</th>
                    <th className="px-6 py-4">Rol Actual</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {perfilesFiltrados.slice(0, 50).map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-white font-bold">{p.nombre_completo}</p>
                        <p className="text-[9px] text-slate-500">{p.email || 'Sin correo'}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-400 uppercase">{p.dependencia}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${p.rol === 'admin' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : p.rol === 'cajero' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : p.rol === 'dev' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {p.rol || 'empleado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select 
                          className="bg-slate-950 border border-slate-700 text-slate-300 p-2 rounded-lg text-xs outline-none focus:border-emerald-500 cursor-pointer"
                          value={p.rol || 'empleado'}
                          onChange={(e) => actualizarRol(p.id, e.target.value)}
                        >
                          <option value="empleado">Empleado</option>
                          <option value="cajero">Cajero</option>
                          <option value="admin">Administrador</option>
                          <option value="dev">Dev_Root</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'switches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {configuraciones.map(config => (
              <div key={config.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex justify-between items-center shadow-lg">
                <div className="pr-4">
                  <h3 className="text-white font-black text-sm uppercase tracking-wider mb-1">{config.id}</h3>
                  <p className="text-slate-500 text-[10px] uppercase leading-relaxed">{config.descripcion}</p>
                </div>
                <button 
                  onClick={() => toggleSwitch(config.id, config.valor)}
                  className={`relative w-16 h-8 rounded-full transition-colors flex-shrink-0 border ${config.valor ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-red-500/20 border-red-500/50'}`}
                >
                  <div className={`absolute top-1 bottom-1 w-6 bg-white rounded-full transition-all shadow-md ${config.valor ? 'left-9 bg-emerald-400' : 'left-1 bg-red-400'}`}></div>
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'auditoria' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Logs en crudo (RAW)</h2>
              <button onClick={cargarDatos} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-400 transition-colors"><RefreshCw size={16}/></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] whitespace-nowrap font-mono">
                <thead className="bg-slate-950/50 text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <tr><th className="px-6 py-4">Timestamp</th><th className="px-6 py-4">Empleado / Entidad</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-slate-400">
                  {logs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="px-6 py-3">{new Date(log.fecha_hora).toISOString()}</td>
                      <td className="px-6 py-3 text-white">{log.nombre_empleado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-red-950/20 border border-red-900/50 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><ShieldAlert size={150} className="text-red-500"/></div>
              <h2 className="text-xl font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Trash2 size={24}/> Limpieza de Base de Datos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                <button onClick={() => purgarTabla('vales_quemados')} className="bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/50 p-4 rounded-xl text-xs font-black uppercase transition-all">Purgar vales_quemados</button>
                <button onClick={() => purgarTabla('reservas_comedor')} className="bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/50 p-4 rounded-xl text-xs font-black uppercase transition-all">Purgar reservas_comedor</button>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-900/50 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
               <h2 className="text-xl font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Database size={24}/> Operaciones Masivas</h2>
               <button onClick={reiniciarTicketsSemanales} className="bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 border border-amber-500/50 p-4 rounded-xl text-xs font-black uppercase transition-all">Ejecutar Reinicio Global</button>
            </div>
          </div>
        )}

      </div>

      {/* MODAL NUEVO USUARIO (ALTA MAESTRA) */}
      {modalNuevo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-800 p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-white font-black uppercase text-sm tracking-widest flex items-center gap-2"><UserPlus size={20} className="text-emerald-500"/> Alta Global de Usuario</h2>
              <button onClick={() => setModalNuevo(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            <form onSubmit={ejecutarCrearUsuario} className="p-8 space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block ml-1 tracking-widest">Nombre Completo</label>
                <input required type="text" placeholder="Ej: JUAN PEREZ LOPEZ" className="w-full bg-slate-950 border border-white/5 p-3 rounded-xl text-xs text-white focus:border-emerald-500 outline-none transition-all uppercase" 
                value={nuevoUser.nombre} onChange={e => setNuevoUser({...nuevoUser, nombre: e.target.value})} />
              </div>
              
              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block ml-1 tracking-widest">Correo Institucional</label>
                <input required type="email" placeholder="ejemplo@fge.gob.mx" className="w-full bg-slate-950 border border-white/5 p-3 rounded-xl text-xs text-white focus:border-emerald-500 outline-none transition-all" 
                value={nuevoUser.email} onChange={e => setNuevoUser({...nuevoUser, email: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block ml-1 tracking-widest">Rol del Sistema</label>
                  <select className="w-full bg-slate-950 border border-white/5 p-3 rounded-xl text-xs text-white focus:border-emerald-500 outline-none transition-all uppercase"
                  value={nuevoUser.rol} onChange={e => setNuevoUser({...nuevoUser, rol: e.target.value})}>
                    <option value="empleado">Empleado</option>
                    <option value="cajero">Cajero</option>
                    <option value="admin">Administrador</option>
                    <option value="dev">Dev_Root</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block ml-1 tracking-widest">Contraseña Temp.</label>
                  <input readOnly type="text" className="w-full bg-slate-800/50 border border-white/5 p-3 rounded-xl text-xs text-slate-400 outline-none" value={nuevoUser.pass} />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block ml-1 tracking-widest">Dependencia / Área</label>
                <input required type="text" placeholder="Ej: ADMINISTRACION / COMEDOR" className="w-full bg-slate-950 border border-white/5 p-3 rounded-xl text-xs text-white focus:border-emerald-500 outline-none transition-all uppercase" 
                value={nuevoUser.dependencia} onChange={e => setNuevoUser({...nuevoUser, dependencia: e.target.value})} />
              </div>

              <button disabled={cargandoAccion} type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 mt-4">
                {cargandoAccion ? <Loader2 className="animate-spin" size={18}/> : 'Ejecutar Alta Global'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}