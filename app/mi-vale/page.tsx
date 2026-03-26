'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Utensils, History, TicketCheck, ChefHat, Check, Calendar, Loader2, Sunrise, Sun, Moon, X, Lock, Minus, Plus, AlertTriangle, Layers, Clock, Hash, Flame, Star, Store, ChevronRight, Terminal, ShieldCheck, UtensilsCrossed } from 'lucide-react';
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

  // REGRESAMOS EL PAYLOAD EXACTO DEL PRINCIPIO PARA QUE FUNCIONE PERFECTO
  const valorQR = `${empleado?.nombre_completo}|${cantidadACanjear}|${tokenTimestamp}|${tokenSeguridad}`;

  if (estadoVista === 'cargando') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744]/5 to-transparent z-0"></div>
        <div className="relative z-10 flex flex-col items-center animate-pulse-slow">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="w-16 h-16 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-[1.5rem] rotate-3 flex items-center justify-center shadow-2xl">
              <ChefHat className="text-amber-400 -rotate-3" size={28} strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-[#1A2744]">
            <Loader2 className="animate-spin text-amber-500" size={16} />
            <p className="text-[10px] font-black tracking-[0.3em] uppercase">Verificando Perfil...</p>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
          .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        `}} />
      </div>
    );
  }

  // --- COMPONENTE DE TARJETA OPTIMIZADO PARA MÓVIL (TÁCTIL) ---
  const TarjetaPlatillo = ({ m, index }: { m: any, index: number }) => (
    <div 
      className="anim-fade-up bg-white p-5 rounded-3xl flex justify-between items-center border border-slate-100 shadow-sm active:scale-[0.98] active:bg-slate-50 transition-all duration-200 mb-3 relative overflow-hidden"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex-1 pr-4 relative z-10">
        <h3 className="text-[#1A2744] font-black text-sm uppercase leading-tight mb-1">{m.platillo}</h3>
        {m.descripcion && <p className="text-slate-400 text-[10px] leading-snug font-medium mb-1">{m.descripcion}</p>}
        {m.porciones_disponibles <= 15 && m.porciones_totales < 9000 && (
          <span className="text-red-500 text-[9px] font-black uppercase flex items-center gap-1 anim-latido mt-1 bg-red-50 inline-flex px-2 py-0.5 rounded-lg border border-red-100"><Flame size={12}/> ¡Quedan {m.porciones_disponibles}!</span>
        )}
      </div>
      
      <div className="flex flex-col items-center gap-3 shrink-0 relative z-10">
        <div className={`text-center flex flex-col items-center justify-center p-2 rounded-2xl w-14 h-14 border transition-colors duration-300 ${m.porciones_disponibles <= 15 ? 'bg-red-50 border-red-100 text-red-600 anim-latido' : 'bg-slate-50 border-slate-100 text-[#1A2744]'}`}>
          <p className="text-2xl font-black leading-none tracking-tighter">{m.porciones_disponibles}</p>
          <p className="text-[8px] font-black uppercase mt-0.5 opacity-60">Disp.</p>
        </div>
        <button 
          onClick={() => apartarComida(m)}
          disabled={cargandoApartado}
          className="relative overflow-hidden w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-white py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-[0_4px_10px_rgba(16,185,129,0.3)] active:scale-90 active:shadow-sm transition-all flex items-center justify-center gap-1 before:absolute before:inset-0 before:bg-white/30 before:-translate-x-full before:animate-[shimmer_3s_infinite]"
        >
          {cargandoApartado ? <Loader2 className="anim-girar relative z-10" size={14}/> : <><Plus size={14} className="relative z-10"/> <span className="relative z-10">Apartar</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-10 relative">
      
      {/* DECORACIÓN DE FONDO GLOBAL */}
      <div className="fixed top-[-10%] right-[-5%] w-[40vh] h-[40vh] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[30vh] h-[30vh] bg-amber-500/5 rounded-full blur-[80px] pointer-events-none z-0"></div>

      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50 shadow-sm flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-2xl rotate-3 flex items-center justify-center shadow-lg border border-slate-700/50 shrink-0 group hover:rotate-6 transition-transform duration-300">
            <UtensilsCrossed className="absolute text-white/10 w-6 h-6 -rotate-3" strokeWidth={1.5} />
            <ChefHat className="relative text-amber-400 -rotate-3" size={20} strokeWidth={1.5} />
          </div>
          <div className="overflow-hidden">
            <p className="text-amber-500 text-[8px] font-black tracking-[0.2em] uppercase mb-0.5">Comedor FGE</p>
            <h1 className="font-black text-xs md:text-sm uppercase tracking-wider leading-tight text-[#1A2744] truncate">
              {empleado ? empleado.nombre_completo : 'Panel Empleado'}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {(empleado?.rol === 'admin' || empleado?.rol === 'dev') && (
            <button 
              onClick={() => router.push('/admin')} 
              className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl active:bg-indigo-100 transition-all border border-indigo-100 active:scale-95"
              title="Panel Administración"
            >
              <ShieldCheck size={18} />
            </button>
          )}

          {empleado?.rol === 'dev' && (
            <button 
              onClick={() => router.push('/dev-panel')} 
              className="bg-amber-50 text-amber-600 p-2.5 rounded-xl active:bg-amber-100 transition-all border border-amber-100 anim-latido active:scale-95"
              title="Panel Developer"
            >
              <Terminal size={18} />
            </button>
          )}

          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-2.5 rounded-xl active:bg-red-100 transition-all border border-red-100 active:scale-95">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 mt-6 relative z-10">

        {estadoVista === 'cambiar_password' && empleado && (
          <form onSubmit={actualizarPasswordUsuario} className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 anim-fade-up text-center">
            <div className="w-20 h-20 bg-amber-50 border border-amber-100 text-amber-500 rounded-[2rem] rotate-3 flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Lock size={32} className="-rotate-3" />
            </div>
            <h2 className="text-2xl font-black text-[#1A2744] mb-2 uppercase tracking-tight">Seguridad FGE</h2>
            <p className="text-slate-500 mb-8 text-xs font-medium">Por tu seguridad, debes crear una contraseña personal para acceder a tus vales.</p>
            
            <div className="space-y-4 mb-8">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300"><Lock size={18} /></div>
                <input 
                  type="password" 
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  className="w-full pl-11 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 outline-none transition-all placeholder:font-normal placeholder:text-slate-300 tracking-widest"
                  placeholder="Nueva Contraseña"
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300"><Lock size={18} /></div>
                <input 
                  type="password" 
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  className="w-full pl-11 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 outline-none transition-all placeholder:font-normal placeholder:text-slate-300 tracking-widest"
                  placeholder="Confirmar Contraseña"
                  required
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={cargandoPassword}
              className="w-full bg-[#1A2744] text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl shadow-[#1A2744]/20 active:scale-[0.95] flex items-center justify-center gap-2"
            >
              {cargandoPassword ? <Loader2 className="animate-spin text-amber-400" size={18}/> : 'Guardar y Continuar'}
            </button>
            {errorPassword && <p className="text-red-500 mt-6 text-center text-xs font-black uppercase tracking-wider">{errorPassword}</p>}
          </form>
        )}

        {estadoVista === 'dashboard' && empleado && (
          <div className="flex flex-col gap-6 anim-fade-up">
            
            {mostrarBannerCierre && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-3xl flex items-start gap-3 anim-latido shadow-sm">
                <div className="bg-white border border-red-100 text-red-600 p-2 rounded-xl shrink-0 mt-0.5 shadow-sm">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-red-800 font-black text-xs uppercase tracking-wider mb-1">Cierre de Semana</h4>
                  <p className="text-red-600 text-[10px] font-bold leading-relaxed">
                    Aún tienes <span className="text-red-800 font-black bg-white px-1.5 py-0.5 rounded shadow-sm border border-red-100">{empleado.tickets_restantes} vales</span>. Aparta tu comida. Los vales no son acumulables.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                  <TicketCheck size={20} />
                </div>
                <h3 className="text-3xl font-black text-[#1A2744] mb-1">{empleado.tickets_canjeado || 0}</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Usados</p>
              </div>
              <div className="bg-[#1A2744] p-5 rounded-[2rem] shadow-xl shadow-[#1A2744]/20 border border-[#2A3F6D] flex flex-col items-center text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent opacity-50"></div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-10 h-10 bg-[#2A3F6D] text-amber-400 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                    <Utensils size={20} />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-1">{empleado.tickets_restantes || 0}</h3>
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Disponibles</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 relative overflow-hidden">
               <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-amber-500 shadow-sm"><QrCode size={20}/></div>
                   <div>
                     <h3 className="text-[#1A2744] font-black text-sm uppercase tracking-tight">Canje Rápido</h3>
                     <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Generar Vale Digital</p>
                   </div>
                 </div>

                 <div className="flex items-center justify-between bg-slate-50/80 p-3 rounded-3xl border border-slate-100 mb-6">
                    <button 
                      onClick={() => setCantidadACanjear(Math.max(1, cantidadACanjear - 1))}
                      className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 active:scale-90 active:bg-slate-100 transition-transform"
                    >
                      <Minus size={20} />
                    </button>
                    <div className="text-center flex-1">
                      <span className="text-4xl font-black text-[#1A2744]">{cantidadACanjear}</span>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Unidades</p>
                    </div>
                    <button 
                      onClick={() => setCantidadACanjear(Math.min(empleado.tickets_restantes, cantidadACanjear + 1))}
                      className="w-14 h-14 bg-[#1A2744] rounded-2xl flex items-center justify-center text-white shadow-md active:scale-90 active:bg-[#25365d] transition-transform"
                    >
                      <Plus size={20} />
                    </button>
                 </div>

                 <button 
                  onClick={iniciarGeneracion}
                  className="relative w-full bg-[#1A2744] text-white py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-[#1A2744]/20 active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden before:absolute before:inset-0 before:bg-white/10 before:-translate-x-full before:animate-[shimmer_3s_infinite]"
                >
                  <span className="relative z-10 flex items-center gap-2">Generar Vale <Check size={16} className="text-amber-400" /></span>
                </button>
               </div>
            </div>

            <div className="bg-gradient-to-br from-[#1A2744] to-[#25365d] rounded-[2.5rem] shadow-2xl p-6 border border-slate-700 relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-amber-400/10 rounded-full blur-[40px] pointer-events-none"></div>
              
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="bg-[#2A3F6D] p-3 rounded-2xl shadow-inner border border-slate-600/50">
                  <ChefHat className="text-amber-400" size={24}/>
                </div>
                <div>
                  <h2 className="text-white text-xl font-black uppercase tracking-wider">Menú FGE</h2>
                  <p className="text-amber-400/80 text-[9px] uppercase font-black tracking-[0.2em] mt-1">Planifica tus comidas</p>
                </div>
              </div>

              {fechasDisponibles.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-6 mb-2 no-scrollbar border-b border-white/5 relative z-10">
                  {fechasDisponibles.map(fecha => {
                    const { day, weekday } = formatearFechaPestaña(fecha);
                    const isActive = fechaActiva === fecha;
                    return (
                      <button 
                        key={fecha} 
                        onClick={() => setFechaActiva(fecha)}
                        className={`flex flex-col items-center justify-center rounded-[1.2rem] min-w-[70px] h-[85px] transition-all duration-300 border active:scale-95 ${isActive ? 'bg-amber-400 text-[#1A2744] shadow-lg shadow-amber-400/20 border-amber-300 scale-105' : 'bg-[#2A3F6D]/50 border-[#2A3F6D] text-slate-300'}`}
                      >
                        <span className="font-black text-2xl tracking-tighter">{day}</span>
                        <span className="text-[9px] font-black uppercase mt-1 tracking-widest opacity-80">{weekday}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* BANNER DE ANTOJITOS FIJOS */}
              <button 
                onClick={() => setMostrarMenuFijo(true)}
                className="relative z-10 w-full mb-8 bg-[#2A3F6D]/40 border border-[#2A3F6D] active:bg-[#2A3F6D] p-4 rounded-2xl flex items-center justify-between transition-all active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-[#1A2744] p-2.5 rounded-xl text-amber-400 shadow-inner">
                    <Store size={18}/>
                  </div>
                  <div className="text-left">
                    <h4 className="text-white font-black text-xs uppercase tracking-widest mb-0.5">Comida Rápida</h4>
                    <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Ver menú mostrador</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-500" size={20}/>
              </button>

              <div key={fechaActiva} className="min-h-[150px] relative z-10">
                
                {reservasDelDia.length > 0 && (
                  <div className="space-y-4 mb-8">
                    {reservasDelDia.map((reserva) => (
                      <div key={reserva.id} className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2rem] flex flex-col items-center text-center anim-fade-up relative overflow-hidden" style={{animationDelay: '0ms'}}>
                        <div className="bg-emerald-500 text-white p-3 rounded-2xl mb-4 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                          <Check size={24}/>
                        </div>
                        <p className="text-emerald-400 font-black uppercase text-[10px] tracking-[0.2em] mb-1">Apartado Confirmado</p>
                        <p className="text-white text-sm font-black uppercase leading-tight mt-2 mb-6 max-w-full">
                          {reserva.menu_comedor?.platillo}
                        </p>
                        <button 
                          onClick={() => cancelarReserva(reserva)}
                          disabled={cargandoApartado || reserva.estado === 'CAPTURADO'}
                          className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative z-10 ${reserva.estado === 'CAPTURADO' ? 'bg-[#1A2744] text-slate-500 cursor-not-allowed' : 'bg-red-500/10 active:bg-red-500 text-red-400 active:text-white border border-red-500/20'}`}
                        >
                          {cargandoApartado ? <Loader2 className="anim-girar" size={14}/> : reserva.estado === 'CAPTURADO' ? 'En preparación' : <><X size={14}/> Cancelar Apartado</>}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {menusParaMostrar.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-400 py-12 border-2 border-dashed border-[#2A3F6D] rounded-[2rem] bg-[#2A3F6D]/10">
                    <Calendar size={32} className="mb-4 opacity-40"/>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-center leading-relaxed">Menú no publicado<br/>para esta fecha</p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {desayunos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="bg-amber-400/10 p-2 rounded-lg"><Sunrise className="text-amber-400" size={18} /></div>
                          <h3 className="text-white font-black text-sm uppercase tracking-[0.2em]">Desayunos</h3>
                        </div>
                        <div className="space-y-3">
                          {desayunos.map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={i} />)}
                        </div>
                      </div>
                    )}

                    {almuerzos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="bg-emerald-400/10 p-2 rounded-lg"><Sun className="text-emerald-400" size={18} /></div>
                          <h3 className="text-white font-black text-sm uppercase tracking-[0.2em]">Almuerzos</h3>
                        </div>

                        {almuerzos.filter(m => m.porciones_totales < 9000).length > 0 && (
                          <div className="mb-10">
                             <div className="space-y-3">
                               {almuerzos.filter(m => m.porciones_totales < 9000).map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={desayunos.length + i} />)}
                             </div>
                          </div>
                        )}

                        {almuerzos.filter(m => m.porciones_totales >= 9000).length > 0 && (
                          <div className="bg-[#2A3F6D]/30 p-5 rounded-[2rem] border border-[#2A3F6D]">
                            <h4 className="text-slate-400 text-[9px] uppercase tracking-[0.2em] font-black mb-4 flex items-center gap-2"><Star size={12} className="text-amber-400"/> Menú Fijo</h4>
                            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar snap-x">
                               {almuerzos.filter(m => m.porciones_totales >= 9000).map((m, i) => (
                                 <div key={m.id} className="snap-start min-w-[240px] bg-white p-5 rounded-3xl flex flex-col justify-between border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.98] transition-all duration-200">
                                   <div>
                                       <h3 className="text-[#1A2744] font-black text-sm uppercase leading-tight mb-4">{m.platillo}</h3>
                                   </div>
                                   <div className="flex items-end justify-between gap-2 mt-auto">
                                       <div className="flex flex-col">
                                         <span className="text-emerald-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Check size={10}/> Siempre</span>
                                         <span className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">Disponible</span>
                                       </div>
                                       <button 
                                          onClick={() => apartarComida(m)} 
                                          disabled={cargandoApartado} 
                                          className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-emerald-400 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-[0_4px_10px_rgba(16,185,129,0.3)] active:scale-90 active:shadow-sm transition-all flex items-center justify-center gap-1 before:absolute before:inset-0 before:bg-white/30 before:-translate-x-full before:animate-[shimmer_3s_infinite]"
                                        >
                                         {cargandoApartado ? <Loader2 className="anim-girar relative z-10" size={12}/> : <><Plus size={12} className="relative z-10"/><span className="relative z-10">Apartar</span></>}
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
                        <div className="flex items-center gap-3 mb-6">
                          <div className="bg-blue-400/10 p-2 rounded-lg"><Moon className="text-blue-400" size={18} /></div>
                          <h3 className="text-white font-black text-sm uppercase tracking-[0.2em]">Cenas</h3>
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

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-slate-400"><History size={18} /></div>
                <h3 className="text-sm font-black text-[#1A2744] uppercase tracking-tight">Historial</h3>
              </div>
              <div className="flex flex-col gap-3">
                {historial.map((h, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-black text-[#1A2744] text-xs uppercase">{new Date(h.fecha_hora).toLocaleDateString('es-MX')}</p>
                      <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-1">🕒 {new Date(h.fecha_hora).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Canjeado</span>
                  </div>
                ))}
                {historial.length === 0 && <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest py-6 border-2 border-dashed border-slate-100 rounded-2xl">No hay canjes previos</p>}
              </div>
            </div>
          </div>
        )}

        {estadoVista === 'animando' && (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 bg-[#1A2744] rounded-[2rem] rotate-3 flex items-center justify-center mb-10 relative shadow-[0_15px_30px_rgba(26,39,68,0.2)] border border-slate-100">
              <QrCode size={36} className="text-amber-400 -rotate-3" />
              <div className="absolute inset-0 rounded-[2rem] border-4 border-amber-400/20 anim-latido"></div>
            </div>
            <h3 className="text-sm font-black text-[#1A2744] mb-8 uppercase tracking-[0.2em]">Generando Vale</h3>
            <div className="w-full flex flex-col gap-5">
              <PasoCheck visible={pasoAnimacion >= 1} texto="Verificando Identidad" completed={pasoAnimacion > 1} />
              <PasoCheck visible={pasoAnimacion >= 2} texto={`Aprobando ${cantidadACanjear} Raciones`} completed={pasoAnimacion > 2} />
              <PasoCheck visible={pasoAnimacion >= 3} texto="Asignando Token Seguro" completed={pasoAnimacion > 3} />
              <PasoCheck visible={pasoAnimacion >= 4} texto="Renderizando Código" completed={pasoAnimacion > 4} active={pasoAnimacion === 4} />
            </div>
          </div>
        )}

        {estadoVista === 'ticket' && (
          <div className="flex flex-col items-center gap-6 anim-fade-up">
            <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl w-full border border-slate-100 relative">
              
              <div className="bg-[#1A2744] p-8 text-center border-b-2 border-dashed border-slate-200 relative">
                <ChefHat className="text-amber-400/20 absolute top-4 left-4 w-16 h-16 -rotate-12" />
                <p className="text-amber-400 text-[9px] uppercase font-black tracking-[0.3em] mb-2 relative z-10">Comedor Fiscalía</p>
                <h2 className="text-white text-2xl font-black uppercase tracking-widest relative z-10">Vale Digital</h2>
                
                {/* Muescas del ticket */}
                <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-[#F8FAFC] rounded-full shadow-inner"></div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-[#F8FAFC] rounded-full shadow-inner"></div>
              </div>

              <div className="p-8 flex flex-col items-center relative">
                <div className="flex justify-between w-full mb-8 gap-4 text-center">
                  <div className="flex-1">
                    <p className="text-slate-400 text-[8px] uppercase font-black tracking-[0.2em] mb-1">Titular</p>
                    <p className="text-[#1A2744] text-xs font-black leading-tight uppercase truncate">{empleado.nombre_completo}</p>
                  </div>
                  <div className="flex-1 border-l border-slate-100">
                    <p className="text-slate-400 text-[8px] uppercase font-black tracking-[0.2em] mb-1">Fecha</p>
                    <p className="text-[#1A2744] text-xs font-black uppercase">{hoyCorto}</p>
                  </div>
                </div>

                <div className="w-full bg-slate-50 py-6 px-2 rounded-[2rem] flex flex-col items-center mb-8 border border-slate-100 relative overflow-hidden">
                   
                  {/* QUITAR CAJAS RESTRICTIVAS Y PONER WIDTH 1.5 PARA QUE EL LASER LO LEA PERFECTO */}
                  <div className="relative z-10 w-full flex justify-center bg-white py-4 mb-4">
                    <Barcode 
                      value={valorQR} 
                      format="CODE128"
                      width={1.5}
                      height={80}
                      displayValue={true}
                      fontSize={12}
                      background="#ffffff"
                      lineColor="#000000"
                      margin={0}
                    />
                  </div>
                  
                  <div className="relative z-10 bg-amber-400 text-[#1A2744] px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-amber-400/30 flex items-center gap-2">
                    <Layers size={14}/> {cantidadACanjear} RACIONES
                  </div>

                  <div className="relative z-10 mt-8 pt-6 border-t border-slate-200 w-full text-center">
                    <p className="text-slate-400 text-[8px] font-black uppercase tracking-[0.2em] mb-2">Token de Validación</p>
                    <div className="flex justify-center items-center gap-2 text-[#1A2744] font-black text-2xl tracking-[0.3em]">
                        <Hash size={20} className="text-slate-300"/> {tokenSeguridad}
                    </div>
                  </div>
                </div>

                <div className="w-full bg-emerald-50 text-emerald-600 p-4 rounded-xl text-center font-black text-[10px] uppercase tracking-[0.2em] border border-emerald-100 flex justify-center items-center gap-2 anim-latido">
                  <Check size={16}/> Muestre en Ventanilla
                </div>
              </div>
            </div>

            <button 
              onClick={() => { setEstadoVista('dashboard'); setCantidadACanjear(1); }} 
              className="bg-slate-200 active:bg-slate-300 text-slate-600 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all w-full"
            >
              Finalizar y Regresar
            </button>
          </div>
        )}

      </div>

      {/* MODAL BOTTOM SHEET: MENÚ DE ANTOJITOS */}
      {mostrarMenuFijo && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A2744]/90 backdrop-blur-sm anim-fade-up">
          <div className="bg-[#F8FAFC] w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] sm:rounded-[2.5rem] rounded-t-[2.5rem] overflow-hidden flex flex-col shadow-2xl relative">
            <div className="bg-white p-6 pb-4 shrink-0 border-b border-slate-100 relative z-10 rounded-t-[2.5rem] sm:rounded-t-[2rem]">
              <button 
                onClick={() => setMostrarMenuFijo(false)}
                className="absolute top-6 right-6 bg-slate-50 text-slate-400 active:text-red-500 active:bg-red-50 p-2.5 rounded-full transition-all border border-slate-100"
              >
                <X size={20} />
              </button>
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
              <h2 className="text-[#1A2744] text-lg font-black uppercase tracking-tight flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-xl text-amber-500 border border-amber-100"><Store size={20}/></div> 
                Comida Rápida
              </h2>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-2 ml-14">Disponibles todos los días</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar pb-20">
              {MENU_ANTOJITOS.map((categoria, i) => (
                <div key={i} className="bg-white rounded-[1.5rem] p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] anim-fade-up hover:border-amber-200 transition-colors group" style={{animationDelay: `${i * 50}ms`}}>
                  <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
                    <span className="text-2xl bg-slate-50 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 group-hover:bg-amber-50 group-hover:border-amber-100 transition-colors">{categoria.icono}</span>
                    <h3 className="text-[#1A2744] font-black text-xs uppercase tracking-wider">{categoria.categoria}</h3>
                  </div>
                  <ul className="space-y-3">
                    {categoria.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs font-bold text-slate-600">
                        <span className="text-amber-400 mt-0.5">•</span> 
                        <span className="leading-snug uppercase text-[10px] tracking-wide">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              
              <div className="bg-blue-50 p-5 rounded-[1.5rem] border border-blue-100 text-center mt-6">
                <p className="text-blue-800 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                  Estos platillos se preparan al momento. Solicítalos en ventanilla.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .anim-fade-up {
          opacity: 0;
          animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-scale-in {
          opacity: 0;
          animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-latido {
          animation: pulseSoft 2s ease-in-out infinite;
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
    <div className={`flex items-center gap-4 text-[10px] uppercase tracking-widest font-black transition-all duration-500 ${completed ? 'text-[#1A2744]' : active ? 'text-amber-500' : 'text-slate-300'}`}>
      <div className={`w-6 h-6 rounded-xl flex items-center justify-center text-[10px] transition-colors duration-500 ${completed ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' : active ? 'border-2 border-amber-400 bg-white' : 'bg-slate-50 border border-slate-100'}`}>
        {completed ? '✓' : ''} {active && <div className="w-2 h-2 bg-amber-400 rounded-full anim-latido"></div>}
      </div>
      {texto}
    </div>
  );
}