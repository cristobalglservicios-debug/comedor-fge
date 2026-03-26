'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Utensils, History, TicketCheck, ChefHat, Check, Calendar, Loader2, Sunrise, Sun, Moon, X, Lock, Minus, Plus, AlertTriangle, Layers, Clock, Hash, Flame, Star, Store, ChevronRight, Terminal, ShieldCheck } from 'lucide-react';
import Barcode from 'react-barcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EstadoVista = 'cargando' | 'busqueda' | 'dashboard' | 'animando' | 'ticket' | 'cambiar_password';

const getHoyMerida = () => {
  const fecha = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Merida"}));
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDiaSemanaMerida = () => {
  const fecha = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Merida"}));
  return fecha.getDay(); 
};

// --- DATA: MENÚ FIJO DE ANTOJITOS ---
const MENU_ANTOJITOS = [
  { categoria: 'Tortas', icono: '🥖', items: ['Asado', 'Empanizado', 'Cochinita', 'Pescado empanizado', 'Jamón y queso', 'Jamón, queso daysi y pastel mosaico'] },
  { categoria: 'Tacos', icono: '🌮', items: ['Asado', 'Empanizado', 'Cochinita', 'Pescado empanizado', 'Cherna'] },
  { categoria: 'Salbutes y Panuchos', icono: '🥙', items: ['Pollo', 'Empanizado', 'Picadillo', 'Huevo'] },
  { categoria: 'Empanadas', icono: '🥟', items: ['Queso Manchego', 'Picadillo', 'Queso y picadillo'] },
  { categoria: 'Huevos al gusto', icono: '🍳', items: ['Jamón', 'Longaniza', 'Chaya'] },
  { categoria: 'Sopes', icono: '🫓', items: ['Asado', 'Cochinita'] },
  { categoria: 'Tamales', icono: '🫔', items: ['Vaporcitos'] },
  { categoria: 'Otros', icono: '🍔', items: ['Sandwich club', 'Hamburguesa', 'Hotdogs'] }
];

export default function MiValePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nombreBusqueda, setNombreBusqueda] = useState('');
  const [empleado, setEmpleado] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [estadoVista, setEstadoVista] = useState<EstadoVista>('cargando');
  const [pasoAnimacion, setPasoAnimacion] = useState(0);

  const [menusFuturos, setMenusFuturos] = useState<any[]>([]);
  const [misReservas, setMisReservas] = useState<any[]>([]);
  const [fechasDisponibles, setFechasDisponibles] = useState<string[]>([]);
  const [fechaActiva, setFechaActiva] = useState<string>('');
  const [cargandoApartado, setCargandoApartado] = useState(false);

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [errorPassword, setErrorPassword] = useState('');
  const [cargandoPassword, setCargandoPassword] = useState(false);

  const [cantidadACanjear, setCantidadACanjear] = useState(1);
  const [tokenSeguridad, setTokenSeguridad] = useState('');
  const [tokenTimestamp, setTokenTimestamp] = useState(Date.now());

  // ESTADO PARA EL PANEL DE ANTOJITOS
  const [mostrarMenuFijo, setMostrarMenuFijo] = useState(false);

  useEffect(() => {
    const intentarAutoLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        setEstadoVista('busqueda');
        return;
      }

      const debeCambiar = localStorage.getItem('debe_cambiar_password_fge') === 'true';
      
      // Sincronización por Email
      const { data } = await supabase
        .from('perfiles')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      if (data) {
        localStorage.setItem('fge_empleado_nombre', data.nombre_completo); 
        setEmpleado(data);
        
        if (debeCambiar) {
          setEstadoVista('cambiar_password');
        } else {
          cargarHistorialReciente(data.nombre_completo);
          await cargarMenusYReservasFuturas(data.nombre_completo);
          setEstadoVista('dashboard');
        }
      } else {
        setEstadoVista('busqueda');
      }
    };
    intentarAutoLogin();
  }, []);

  const buscarEmpleadoManual = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setEstadoVista('dashboard');
  };

  const actualizarPasswordUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPassword('');

    if (nuevaPassword.length < 6) {
      setErrorPassword("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setErrorPassword("Las contraseñas no coinciden.");
      return;
    }

    setCargandoPassword(true);
    
    const { error } = await supabase.auth.updateUser({
      password: nuevaPassword
    });

    if (error) {
      setErrorPassword(error.message);
      setCargandoPassword(false);
      return;
    }

    localStorage.removeItem('debe_cambiar_password_fge');
    cargarHistorialReciente(empleado.nombre_completo);
    await cargarMenusYReservasFuturas(empleado.nombre_completo);
    setEstadoVista('dashboard');
    setCargandoPassword(false);
  };

  const cargarHistorialReciente = async (nombre: string) => {
    const { data } = await supabase
      .from('historial_comedor')
      .select('*')
      .eq('nombre_empleado', nombre)
      .order('fecha_hora', { ascending: false })
      .limit(5);
    if (data) setHistorial(data);
  };

  const cargarMenusYReservasFuturas = async (nombreEmpleado: string) => {
    const hoy = getHoyMerida();
    const ahora = new Date().toISOString();

    const { data: menus } = await supabase
      .from('menu_comedor')
      .select('*')
      .gte('fecha', hoy)
      .gt('porciones_disponibles', 0)
      .lte('creado_en', ahora) 
      .order('fecha', { ascending: true });
      
    if (menus) {
      setMenusFuturos(menus);
      const diasUnicos = Array.from(new Set(menus.map(m => m.fecha)));
      setFechasDisponibles(diasUnicos);
      if (diasUnicos.length > 0 && !fechaActiva) {
        setFechaActiva(diasUnicos[0]); 
      }
    }

    const { data: reservas } = await supabase
      .from('reservas_comedor')
      .select('*, menu_comedor(fecha, platillo)')
      .eq('nombre_empleado', nombreEmpleado);
      
    if (reservas) {
      const reservasActivas = reservas.filter(r => r.menu_comedor && r.menu_comedor.fecha >= hoy);
      setMisReservas(reservasActivas);
    }
  };

  const apartarComida = async (menuItem: any) => {
    const reservasActivas = misReservas.filter(r => r.estado === 'APARTADO').length;
    
    if (empleado.tickets_restantes - reservasActivas <= 0) {
      return alert("🚫 Tus vales disponibles ya están comprometidos en otras reservas. No puedes apartar más platillos.");
    }
    
    if (!confirm(`🍽 ¿Asegurar una porción de ${menuItem.platillo} para el ${formatearFechaDia(menuItem.fecha)}?`)) return;

    setCargandoApartado(true);

    const { error: rpcError } = await supabase.rpc('apartar_platillo', {
        p_menu_id: menuItem.id,
        p_nombre_empleado: empleado.nombre_completo,
        p_dependencia: empleado.dependencia
    });
    
    if (!rpcError) {
      alert("✅ ¡Platillo asegurado exitosamente!");
      await cargarMenusYReservasFuturas(empleado.nombre_completo);
    } else {
      if (rpcError.message.includes('AGOTADO')) {
          alert("❌ Lo sentimos, el platillo se acaba de agotar.");
      } else {
          alert("Hubo un error al procesar tu solicitud.");
      }
    }
    setCargandoApartado(false);
  };

  const cancelarReserva = async (reserva: any) => {
    if (reserva.estado === 'CAPTURADO') return alert("⚠️ Tu pedido ya está en cocina, no se puede cancelar.");
    if (!confirm(`⚠️ ¿Seguro que deseas cancelar tu reserva de ${reserva.menu_comedor?.platillo}?`)) return;

    setCargandoApartado(true);

    const { error: errDelete } = await supabase.from('reservas_comedor').delete().eq('id', reserva.id);
    
    if (!errDelete) {
      const { data: menu } = await supabase.from('menu_comedor').select('porciones_disponibles').eq('id', reserva.menu_id).single();
      if (menu) {
        await supabase.from('menu_comedor').update({ porciones_disponibles: menu.porciones_disponibles + 1 }).eq('id', reserva.menu_id);
      }
      alert("✅ Reserva cancelada. La porción ha sido devuelta al menú.");
      await cargarMenusYReservasFuturas(empleado.nombre_completo);
    } else {
      alert("❌ Error al cancelar la reserva.");
    }
    setCargandoApartado(false);
  };

  const iniciarGeneracion = () => {
    if (empleado.tickets_restantes < cantidadACanjear) {
      alert(`🚫 No tienes suficientes vales (${empleado.tickets_restantes} disponibles).`);
      return;
    }

    const uid = Math.random().toString(36).substring(2, 9).toUpperCase();
    setTokenSeguridad(uid);
    setTokenTimestamp(Date.now());

    setEstadoVista('animando');
    setPasoAnimacion(1);
    setTimeout(() => setPasoAnimacion(2), 800);
    setTimeout(() => setPasoAnimacion(3), 1600);
    setTimeout(() => setPasoAnimacion(4), 2400);
    setTimeout(() => {
      setPasoAnimacion(5);
      setEstadoVista('ticket');
    }, 3200);
  };

  const handleLogout = async () => {
    localStorage.removeItem('fge_empleado_nombre'); 
    localStorage.removeItem('debe_cambiar_password_fge');
    await supabase.auth.signOut();
    router.push('/');
  };

  const formatearFechaPestaña = (fechaISO: string) => {
    const date = new Date(fechaISO + 'T12:00:00Z');
    const day = date.getDate();
    const weekday = date.toLocaleDateString('es-MX', { weekday: 'short' });
    return { day, weekday };
  };

  const formatearFechaDia = (fechaISO: string) => {
    const date = new Date(fechaISO + 'T12:00:00Z');
    return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const hoyCorto = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Merida"})).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const menusParaMostrar = menusFuturos.filter(m => m.fecha === fechaActiva);
  const reservasDelDia = misReservas.filter(r => r.menu_comedor?.fecha === fechaActiva);

  const desayunos = menusParaMostrar.filter(m => m.tipo_comida === 'DESAYUNO');
  const almuerzos = menusParaMostrar.filter(m => m.tipo_comida === 'ALMUERZO');
  const cenas = menusParaMostrar.filter(m => m.tipo_comida === 'CENA');

  const diaSemana = getDiaSemanaMerida();
  const esFinDeSemana = diaSemana === 5 || diaSemana === 6 || diaSemana === 0;
  const mostrarBannerCierre = esFinDeSemana && empleado?.tickets_restantes > 0;

  const valorQR = `${empleado?.nombre_completo}|${cantidadACanjear}|${tokenTimestamp}|${tokenSeguridad}`;

  if (estadoVista === 'cargando') {
    return <div className="min-h-screen bg-[#F0F3F6] flex items-center justify-center font-bold text-slate-400">Verificando acceso...</div>;
  }

  const TarjetaPlatillo = ({ m, index }: { m: any, index: number }) => (
    <div 
      className="anim-cascada bg-white p-5 rounded-3xl flex justify-between items-center shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 transform hover:scale-[1.02] active:scale-[0.98] transition-all mb-3"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex-1 pr-4">
        <h3 className="text-[#1A2744] font-black text-sm uppercase leading-tight mb-1">{m.platillo}</h3>
        {m.descripcion && <p className="text-slate-400 text-[10px] leading-snug font-medium mb-1">{m.descripcion}</p>}
        {m.porciones_disponibles <= 15 && m.porciones_totales < 9000 && (
          <span className="text-red-500 text-[9px] font-black uppercase flex items-center gap-1 anim-latido mt-1"><Flame size={12}/> ¡Quedan {m.porciones_disponibles}!</span>
        )}
      </div>
      
      <div className="flex flex-col items-center gap-3 shrink-0">
        <div className={`text-center flex flex-col items-center justify-center p-2 rounded-xl w-14 h-14 ${m.porciones_disponibles <= 15 ? 'bg-red-50 text-red-600 anim-latido' : 'bg-indigo-50 text-[#6366F1]'}`}>
          <p className="text-3xl font-black leading-none tracking-tighter">{m.porciones_disponibles}</p>
          <p className="text-[8px] font-black uppercase mt-0.5 opacity-60">Disp.</p>
        </div>
        <button 
          onClick={() => apartarComida(m)}
          disabled={cargandoApartado}
          className="w-full bg-[#1A2744] hover:bg-[#C9A84C] text-white hover:text-[#1A2744] px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md transition-colors active:scale-95 flex items-center justify-center"
        >
          {cargandoApartado ? <Loader2 className="anim-girar" size={12}/> : 'Apartar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F3F6] font-sans pb-10">
      
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8 relative z-50">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center border border-[#C9A84C]/30 shadow-inner shrink-0">
            <img src="/logo-fge.png" alt="FGE" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-black text-sm uppercase tracking-wider leading-tight truncate">
              {empleado ? empleado.nombre_completo : 'Panel Empleado'}
            </h1>
            <p className="text-[#C9A84C] text-[9px] font-bold tracking-widest truncate uppercase">Fiscalía General</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* ACCESO DIRECCIÓN PARA ADMINS */}
          {(empleado?.rol === 'admin' || empleado?.rol === 'dev') && (
            <button 
              onClick={() => router.push('/admin')} 
              className="bg-indigo-500/20 text-indigo-300 p-2 rounded-xl hover:bg-indigo-500 hover:text-white transition-all border border-indigo-500/30"
              title="Panel Administración"
            >
              <ShieldCheck size={18} />
            </button>
          )}

          {/* ACCESO SECRETO PARA DEV */}
          {empleado?.rol === 'dev' && (
            <button 
              onClick={() => router.push('/dev-panel')} 
              className="bg-amber-500/20 text-amber-400 p-2 rounded-xl hover:bg-amber-500 hover:text-white transition-all border border-amber-500/30 anim-latido"
              title="Panel Developer"
            >
              <Terminal size={18} />
            </button>
          )}

          <button onClick={handleLogout} className="bg-white/10 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 mt-6">

        {estadoVista === 'cambiar_password' && empleado && (
          <form onSubmit={actualizarPasswordUsuario} className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 anim-entrada-suave text-center">
            <div className="w-16 h-16 bg-amber-50 text-[#C9A84C] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-black text-[#1A2744] mb-2 uppercase tracking-tight">Seguridad FGE</h2>
            <p className="text-slate-500 mb-6 text-xs font-medium">Por tu seguridad, debes crear una contraseña personal para acceder a tus vales de comida.</p>
            
            <div className="space-y-4 mb-6">
              <input 
                type="password" 
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-bold text-slate-800 focus:border-[#C9A84C] outline-none transition-colors"
                placeholder="Nueva Contraseña"
                required
              />
              <input 
                type="password" 
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-bold text-slate-800 focus:border-[#C9A84C] outline-none transition-colors"
                placeholder="Confirmar Contraseña"
                required
              />
            </div>
            
            <button 
              type="submit" 
              disabled={cargandoPassword}
              className="w-full bg-[#1A2744] hover:bg-[#C9A84C] text-white py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              {cargandoPassword ? <Loader2 className="animate-spin" size={18}/> : 'Guardar y Continuar'}
            </button>
            {errorPassword && <p className="text-red-500 mt-4 text-center text-sm font-medium">{errorPassword}</p>}
          </form>
        )}

        {estadoVista === 'dashboard' && empleado && (
          <div className="flex flex-col gap-5 anim-entrada-suave">
            
            {mostrarBannerCierre && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-3xl shadow-sm flex items-start gap-3 anim-latido shadow-sm">
                <div className="bg-red-100 text-red-600 p-2 rounded-full shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-red-800 font-black text-xs uppercase tracking-wider mb-1">¡Cierre de Semana!</h4>
                  <p className="text-red-600 text-[10px] font-bold leading-relaxed">
                    Aún te quedan <span className="text-red-800 text-xs font-black bg-red-100 px-1 rounded">{empleado.tickets_restantes} vales</span>. Recuerda apartar tu comida. Los vales no son acumulables y tu saldo se reiniciará el domingo.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                  <TicketCheck size={18} />
                </div>
                <h3 className="text-2xl font-black text-[#1A2744]">{empleado.tickets_canjeado || 0}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Usados</p>
              </div>
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-50/40 anim-latido opacity-50"></div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-8 h-8 bg-amber-50 text-[#C9A84C] rounded-full flex items-center justify-center mb-2">
                    <Utensils size={18} />
                  </div>
                  <h3 className="text-2xl font-black text-[#6366F1]">{empleado.tickets_restantes || 0}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disponibles</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100">
               <div className="flex items-center gap-3 mb-6">
                 <div className="bg-[#1A2744] p-2 rounded-xl text-[#C9A84C]"><QrCode size={20}/></div>
                 <div>
                   <h3 className="text-[#1A2744] font-black text-xs uppercase tracking-tight">Canje de Raciones</h3>
                   <p className="text-slate-400 text-[9px] font-bold uppercase">Selecciona cuántas raciones retirarás</p>
                 </div>
               </div>

               <div className="flex items-center justify-between bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-6">
                  <button 
                    onClick={() => setCantidadACanjear(Math.max(1, cantidadACanjear - 1))}
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#1A2744] shadow-sm active:scale-90 transition-transform"
                  >
                    <Minus size={20} />
                  </button>
                  <div className="text-center">
                    <span className="text-4xl font-black text-[#1A2744]">{cantidadACanjear}</span>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Unidades</p>
                  </div>
                  <button 
                    onClick={() => setCantidadACanjear(Math.min(empleado.tickets_restantes, cantidadACanjear + 1))}
                    className="w-12 h-12 bg-[#C9A84C] rounded-2xl flex items-center justify-center text-[#1A2744] shadow-sm active:scale-90 transition-transform"
                  >
                    <Plus size={20} />
                  </button>
               </div>

               <button 
                onClick={iniciarGeneracion}
                className="w-full bg-[#1A2744] text-white py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
              >
                Generar Vale Digital <Check size={16} className="text-[#C9A84C]" />
              </button>
            </div>

            <div className="bg-gradient-to-br from-[#1A2744] to-[#25365d] rounded-[2rem] shadow-2xl p-6 border border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl opacity-20"></div>
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <ChefHat className="text-[#C9A84C]" size={28}/>
                <div>
                  <h2 className="text-white text-xl font-black uppercase tracking-wider">Menú del Comedor</h2>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em]">Aparta tu platillo</p>
                </div>
              </div>

              {fechasDisponibles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar border-b border-white/10 relative z-10">
                  {fechasDisponibles.map(fecha => {
                    const { day, weekday } = formatearFechaPestaña(fecha);
                    const isActive = fechaActiva === fecha;
                    return (
                      <button 
                        key={fecha} 
                        onClick={() => setFechaActiva(fecha)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl min-w-[65px] h-[75px] transition-all duration-300 ${isActive ? 'bg-[#C9A84C] text-[#1A2744] shadow-lg scale-105' : 'bg-white/10 hover:bg-white/20 text-slate-300'}`}
                      >
                        <span className="font-black text-2xl">{day}</span>
                        <span className="text-[10px] font-bold uppercase mt-1 opacity-80">{weekday}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* BANNER DE ANTOJITOS FIJOS (ABRE EL MODAL) */}
              <button 
                onClick={() => setMostrarMenuFijo(true)}
                className="relative z-10 w-full mb-6 bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 hover:bg-amber-500/30 p-4 rounded-2xl flex items-center justify-between transition-all active:scale-95 group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/20 p-2 rounded-xl text-amber-400 group-hover:scale-110 transition-transform">
                    <Store size={20}/>
                  </div>
                  <div className="text-left">
                    <h4 className="text-amber-400 font-black text-xs uppercase tracking-widest">¿Antojo de algo más?</h4>
                    <p className="text-amber-200/70 text-[9px] font-bold uppercase">Ver menú fijo de comida rápida</p>
                  </div>
                </div>
                <ChevronRight className="text-amber-400/50" size={20}/>
              </button>

              <div key={fechaActiva} className="min-h-[150px] relative z-10">
                
                {reservasDelDia.length > 0 && (
                  <div className="space-y-4 mb-6">
                    {reservasDelDia.map((reserva) => (
                      <div key={reserva.id} className="bg-emerald-500/20 border border-emerald-500/30 p-6 rounded-3xl flex flex-col items-center text-center anim-cascada" style={{animationDelay: '0ms'}}>
                        <div className="bg-emerald-500 text-white p-3 rounded-full mb-3 shadow-lg">
                          <Check size={24}/>
                        </div>
                        <p className="text-white font-black uppercase text-xs mb-1">¡Buen provecho!</p>
                        <p className="text-emerald-200 text-sm font-black uppercase tracking-wide bg-emerald-900/60 border border-emerald-500/30 px-4 py-2 rounded-xl mt-2 mb-4 max-w-full truncate">
                          {reserva.menu_comedor?.platillo}
                        </p>
                        <button 
                          onClick={() => cancelarReserva(reserva)}
                          disabled={cargandoApartado || reserva.estado === 'CAPTURADO'}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${reserva.estado === 'CAPTURADO' ? 'bg-slate-500/50 text-slate-300 cursor-not-allowed' : 'bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/30'}`}
                        >
                          {cargandoApartado ? <Loader2 className="anim-girar" size={14}/> : reserva.estado === 'CAPTURADO' ? 'Pedido en preparación' : <><X size={14}/> Cancelar Reserva</>}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {menusParaMostrar.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-400 py-10 border-2 border-dashed border-white/10 rounded-3xl bg-white/5">
                    <Calendar size={32} className="mb-3 opacity-40"/>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-center">Menú no publicado para<br/>esta fecha</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {desayunos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                          <Sunrise className="text-[#C9A84C]" size={20} />
                          <h3 className="text-[#C9A84C] font-black text-xs uppercase tracking-[0.2em]">Desayunos</h3>
                        </div>
                        <div className="space-y-3">
                          {desayunos.map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={i} />)}
                        </div>
                      </div>
                    )}

                    {almuerzos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                          <Sun className="text-emerald-400" size={20} />
                          <h3 className="text-emerald-400 font-black text-xs uppercase tracking-[0.2em]">Almuerzos</h3>
                        </div>

                        {almuerzos.filter(m => m.porciones_totales < 9000).length > 0 && (
                          <div className="mb-8">
                             <h4 className="text-white/60 text-[9px] uppercase tracking-widest font-bold mb-3 flex items-center gap-1"><Flame size={12}/> Especialidades del Día</h4>
                             <div className="space-y-3">
                               {almuerzos.filter(m => m.porciones_totales < 9000).map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={desayunos.length + i} />)}
                             </div>
                          </div>
                        )}

                        {almuerzos.filter(m => m.porciones_totales >= 9000).length > 0 && (
                          <div>
                            <h4 className="text-white/60 text-[9px] uppercase tracking-widest font-bold mb-3 flex items-center gap-1"><Star size={12}/> Clásicos del comedor</h4>
                            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
                               {almuerzos.filter(m => m.porciones_totales >= 9000).map((m, i) => (
                                 <div key={m.id} className="snap-start min-w-[220px] bg-gradient-to-br from-[#1A2744] to-[#111A2E] p-5 rounded-3xl flex flex-col justify-between border border-[#C9A84C]/30 shadow-2xl transform hover:scale-105 transition-all">
                                   <div>
                                       <span className="text-[#C9A84C] text-[8px] font-black uppercase tracking-widest flex items-center gap-1 mb-2"><Star size={10} className="fill-[#C9A84C]"/> Menú Fijo</span>
                                       <h3 className="text-white font-black text-sm uppercase leading-tight mb-2">{m.platillo}</h3>
                                   </div>
                                   <div className="mt-2 flex items-end justify-between gap-2">
                                       <div className="flex flex-col">
                                         <span className="text-emerald-400 text-[10px] font-black uppercase flex items-center gap-1"><Check size={12}/> Siempre</span>
                                         <span className="text-emerald-400 text-[10px] font-black uppercase">Disponible</span>
                                       </div>
                                       <button onClick={() => apartarComida(m)} disabled={cargandoApartado} className="bg-[#C9A84C] hover:bg-white text-[#1A2744] px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-md active:scale-95 transition-all flex items-center gap-1">
                                         {cargandoApartado ? <Loader2 className="anim-girar" size={12}/> : 'Apartar'}
                                       </button>
                                   </div>
                                 </div>
                               ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {cenas.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                          <Moon className="text-blue-400" size={20} />
                          <h3 className="text-blue-400 font-black text-xs uppercase tracking-[0.2em]">Cenas</h3>
                        </div>
                        <div className="space-y-3">
                          {cenas.map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={desayunos.length + almuerzos.length + i} />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <History size={16} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Historial reciente</h3>
              </div>
              <div className="flex flex-col gap-4">
                {historial.map((h, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-[#1A2744] text-sm">{new Date(h.fecha_hora).toLocaleDateString('es-MX')}</p>
                      <p className="text-slate-400 text-[10px] font-medium uppercase tracking-tighter">🕒 {new Date(h.fecha_hora).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Canjeado</span>
                  </div>
                ))}
                {historial.length === 0 && <p className="text-center text-slate-300 text-xs py-4 border border-dashed rounded-xl">No hay canjes previos</p>}
              </div>
            </div>
          </div>
        )}

        {estadoVista === 'busqueda' && (
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 anim-entrada-suave">
            <h2 className="text-2xl font-black text-[#1A2744] mb-2 uppercase tracking-tight">Comedor FGE Yucatán</h2>
            <p className="text-slate-500 mb-6 text-sm">Inicia sesión desde la pantalla principal para continuar.</p>
          </div>
        )}

        {estadoVista === 'animando' && (
          <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-[#1A2744] rounded-full flex items-center justify-center text-3xl mb-8 relative shadow-lg">
              📊 <div className="absolute inset-0 rounded-full border-4 border-[#1A2744]/20 anim-latido"></div>
            </div>
            <h3 className="text-lg font-bold text-[#1A2744] mb-8 uppercase tracking-widest">Generando...</h3>
            <div className="w-full flex flex-col gap-4 mb-8">
              <PasoCheck visible={pasoAnimacion >= 1} texto="Verificando identidad..." completed={pasoAnimacion > 1} />
              <PasoCheck visible={pasoAnimacion >= 2} texto={`Solicitando ${cantidadACanjear} raciones...`} completed={pasoAnimacion > 2} />
              <PasoCheck visible={pasoAnimacion >= 3} texto="Validando ID único de canje..." completed={pasoAnimacion > 3} />
              <PasoCheck visible={pasoAnimacion >= 4} texto="Generando QR Seguro..." completed={pasoAnimacion > 4} active={pasoAnimacion === 4} />
              <PasoCheck visible={pasoAnimacion >= 5} texto="¡Vale generado!" completed={pasoAnimacion >= 5} />
            </div>
          </div>
        )}

        {estadoVista === 'ticket' && (
          <div className="flex flex-col items-center gap-4 anim-cascada" style={{animationDelay: '0ms'}}>
            <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl w-full border border-slate-100">
              <div className="bg-[#1A2744] p-6 text-center border-b-2 border-dashed border-slate-200 relative">
                <p className="text-[#C9A84C] text-[10px] uppercase font-bold tracking-[0.2em] mb-1">Fiscalía General del Estado</p>
                <h2 className="text-white text-xl font-black uppercase tracking-wider italic">Vale Digital</h2>
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
                <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
              </div>
              <div className="p-8 flex flex-col items-center">
                <div className="flex justify-between w-full mb-8 gap-4 text-center">
                  <div className="flex-1">
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Empleado</p>
                    <p className="text-[#1A2744] text-[11px] font-black leading-tight uppercase truncate">{empleado.nombre_completo}</p>
                  </div>
                  <div className="flex-1 border-l pl-4 border-slate-100">
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Fecha</p>
                    <p className="text-[#1A2744] text-xs font-black">{hoyCorto}</p>
                  </div>
                </div>
                <div className="w-full bg-[#F8FAFC] p-6 rounded-2xl flex flex-col items-center mb-6 border border-slate-50 relative overflow-hidden">
                   <div className="absolute inset-0 bg-indigo-50/50 anim-latido opacity-50"></div>
                  
                  <div className="relative z-10 w-full flex justify-center bg-white p-2 rounded-xl">
                    <Barcode 
                      value={valorQR} 
                      format="CODE128"
                      width={2.5}
                      height={80}
                      displayValue={false}
                      textAlign="center"
                      background="#ffffff"
                      lineColor="#000000"
                    />
                  </div>
                  
                  <div className="relative z-10 bg-[#1A2744] text-[#C9A84C] px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest mt-4 shadow-lg animate-bounce flex items-center gap-2">
                    <Layers size={14}/> {cantidadACanjear} RACIONES
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-slate-400 relative z-10">
                    <Clock size={12}/> <p className="text-[9px] font-black uppercase">VÁLIDO POR UN SOLO ESCANEO</p>
                  </div>

                  <div className="relative z-10 mt-6 pt-4 border-t border-slate-200 w-full text-center">
                    <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-1">Folio de Seguridad (Manual)</p>
                    <div className="flex justify-center items-center gap-2 text-[#1A2744] font-black text-xl tracking-[0.3em]">
                        <Hash size={16} className="text-[#C9A84C]"/> {tokenSeguridad}
                    </div>
                  </div>

                </div>
                <div className="w-full bg-emerald-50 text-emerald-600 p-3 rounded-2xl text-center font-black text-[11px] uppercase tracking-widest border border-emerald-100 anim-latido">✓ Muestre en Ventanilla</div>
              </div>
            </div>
            <button onClick={() => { setEstadoVista('dashboard'); setCantidadACanjear(1); }} className="bg-[#1A2744]/10 text-[#1A2744] px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest mt-4 active:scale-95 transition-all">Finalizar y Regresar</button>
          </div>
        )}

      </div>

      {/* MODAL BOTTOM SHEET: MENÚ DE ANTOJITOS */}
      {mostrarMenuFijo && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A2744]/80 backdrop-blur-sm anim-entrada-suave">
          <div className="bg-[#F8FAFC] w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] sm:rounded-[2rem] rounded-t-[2.5rem] overflow-hidden flex flex-col shadow-2xl relative">
            <div className="bg-white p-6 pb-4 shrink-0 border-b border-slate-100 relative z-10 rounded-t-[2.5rem] sm:rounded-t-[2rem]">
              <button 
                onClick={() => setMostrarMenuFijo(false)}
                className="absolute top-6 right-6 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
              >
                <X size={20} />
              </button>
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
              <h2 className="text-[#1A2744] text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Store className="text-[#C9A84C]" size={24}/> Menú de Antojitos
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Disponibles todos los días en mostrador</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 no-scrollbar pb-20">
              {MENU_ANTOJITOS.map((categoria, i) => (
                <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm anim-cascada" style={{animationDelay: `${i * 50}ms`}}>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                    <span className="text-2xl">{categoria.icono}</span>
                    <h3 className="text-[#1A2744] font-black text-sm uppercase tracking-wider">{categoria.categoria}</h3>
                  </div>
                  <ul className="space-y-2">
                    {categoria.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs font-bold text-slate-600">
                        <span className="text-[#C9A84C] mt-0.5">•</span> 
                        <span className="leading-snug uppercase text-[11px]">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              
              <div className="bg-amber-50 p-5 rounded-3xl border border-amber-200 text-center">
                <p className="text-amber-800 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                  ⚠️ Estos platillos se preparan al momento. Solicítalos directamente en ventanilla.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUpIn {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anim-entrada-suave {
          animation: fadeUpIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-cascada {
          opacity: 0;
          animation: fadeUpIn 0.5s ease-out forwards;
        }
        .anim-latido {
          animation: pulseSoft 2s infinite;
        }
        .anim-girar {
          animation: spinSlow 1s linear infinite;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}

function PasoCheck({ visible, texto, completed, active }: { visible: boolean, texto: string, completed: boolean, active?: boolean }) {
  if (!visible) return null;
  return (
    <div className={`flex items-center gap-3 text-xs font-bold transition-all duration-300 ${completed ? 'text-slate-700' : active ? 'text-[#6366F1]' : 'text-slate-300'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${completed ? 'bg-emerald-400 text-white' : active ? 'border-2 border-[#6366F1]' : 'bg-slate-100'}`}>
        {completed ? '✓' : ''} {active && <div className="w-2 h-2 bg-[#6366F1] rounded-full anim-latido"></div>}
      </div>
      {texto}
    </div>
  );
}