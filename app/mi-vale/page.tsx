'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Utensils, History, TicketCheck, ChefHat, Check, Calendar, Loader2, Sunrise, Sun, Moon } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EstadoVista = 'cargando' | 'busqueda' | 'dashboard' | 'animando' | 'ticket';

export default function MiValePage() {
  const router = useRouter();
  const [nombreBusqueda, setNombreBusqueda] = useState('');
  const [empleado, setEmpleado] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [estadoVista, setEstadoVista] = useState<EstadoVista>('cargando');
  const [pasoAnimacion, setPasoAnimacion] = useState(0);

  // ESTADOS MENÚ SEMANAL
  const [menusFuturos, setMenusFuturos] = useState<any[]>([]);
  const [misReservas, setMisReservas] = useState<any[]>([]);
  const [fechasDisponibles, setFechasDisponibles] = useState<string[]>([]);
  const [fechaActiva, setFechaActiva] = useState<string>('');
  const [cargandoApartado, setCargandoApartado] = useState(false);

  useEffect(() => {
    const intentarAutoLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const emailPrefijo = session.user.email.split('@')[0].replace(/\./g, ' ');
        const { data } = await supabase
          .from('perfiles')
          .select('*')
          .ilike('nombre_completo', `%${emailPrefijo}%`)
          .maybeSingle();

        if (data) {
          setEmpleado(data);
          cargarHistorialReciente(data.nombre_completo);
          await cargarMenusYReservasFuturas(data.nombre_completo);
          setEstadoVista('dashboard');
          return;
        }
      }
      setEstadoVista('busqueda');
    };
    intentarAutoLogin();
  }, []);

  const buscarEmpleadoManual = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const { data, error: sbError } = await supabase
      .from('perfiles')
      .select('*')
      .ilike('nombre_completo', `%${nombreBusqueda.trim().toUpperCase()}%`)
      .maybeSingle();

    if (sbError || !data) {
      setError('No se encontró el empleado. Verifica tu nombre en nómina.');
    } else {
      setEmpleado(data);
      cargarHistorialReciente(data.nombre_completo);
      await cargarMenusYReservasFuturas(data.nombre_completo);
      setEstadoVista('dashboard');
    }
  };

  const cargarHistorialReciente = async (nombre: string) => {
    const ahora = new Date().toISOString(); 
    const { data } = await supabase
      .from('historial_comedor')
      .select('*')
      .eq('nombre_empleado', nombre)
      .lte('fecha_hora', ahora) 
      .order('fecha_hora', { ascending: false })
      .limit(5);
    if (data) setHistorial(data);
  };

  const cargarMenusYReservasFuturas = async (nombreEmpleado: string) => {
    const hoy = new Date().toISOString().split('T')[0];
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
    if (empleado.tickets_restantes <= 0) return alert("🚫 No tienes vales disponibles para apartar.");
    
    const reservaExistente = misReservas.find(r => r.menu_comedor?.fecha === menuItem.fecha);
    if (reservaExistente) return alert("⚠️ Ya aseguraste tu comida para este día.");
    
    if (!confirm(`🍽 ¿Asegurar una porción de ${menuItem.platillo} para el ${formatearFechaDia(menuItem.fecha)}?`)) return;

    setCargandoApartado(true);
    const { error: errUpdate } = await supabase.from('menu_comedor').update({ porciones_disponibles: menuItem.porciones_disponibles - 1 }).eq('id', menuItem.id);
    
    if (!errUpdate) {
      await supabase.from('reservas_comedor').insert({
        menu_id: menuItem.id,
        nombre_empleado: empleado.nombre_completo,
        dependencia: empleado.dependencia
      });
      alert("✅ ¡Platillo asegurado exitosamente!");
      await cargarMenusYReservasFuturas(empleado.nombre_completo);
    } else {
      alert("Hubo un error o el platillo se acaba de agotar.");
    }
    setCargandoApartado(false);
  };

  const iniciarGeneracion = () => {
    if (empleado.tickets_restantes <= 0) {
      alert("🚫 Lo sentimos, ya no tienes vales disponibles para hoy.");
      return;
    }
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

  const hoyCorto = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const folioGenerado = `FGE-${empleado?.dependencia?.substring(0,3).toUpperCase() || 'EMP'}-00${empleado?.id || '1'}`;

  const menusParaMostrar = menusFuturos.filter(m => m.fecha === fechaActiva);
  const reservaDelDia = misReservas.find(r => r.menu_comedor?.fecha === fechaActiva);

  // AGRUPACIÓN DINÁMICA DE PLATILLOS
  const desayunos = menusParaMostrar.filter(m => m.tipo_comida === 'DESAYUNO');
  const almuerzos = menusParaMostrar.filter(m => m.tipo_comida === 'ALMUERZO');
  const cenas = menusParaMostrar.filter(m => m.tipo_comida === 'CENA');

  if (estadoVista === 'cargando') {
    return <div className="min-h-screen bg-[#F0F3F6] flex items-center justify-center font-bold text-slate-400">Verificando acceso...</div>;
  }

  // Componente interno para reutilizar la tarjeta de platillo
  const TarjetaPlatillo = ({ m, index }: { m: any, index: number }) => (
    <div 
      className="anim-cascada bg-white p-5 rounded-3xl flex justify-between items-center shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 transform hover:scale-[1.02] active:scale-[0.98] transition-all"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      <div className="flex-1 pr-4">
        <h3 className="text-[#1A2744] font-black text-sm uppercase leading-tight mb-1">{m.platillo}</h3>
        {m.descripcion && <p className="text-slate-400 text-[10px] leading-snug font-medium">{m.descripcion}</p>}
      </div>
      
      <div className="flex flex-col items-center gap-3 shrink-0">
        <div className={`text-center flex flex-col items-center justify-center p-2 rounded-xl w-14 h-14 ${m.porciones_disponibles <= 5 ? 'bg-red-50 text-red-600 anim-latido' : 'bg-indigo-50 text-[#6366F1]'}`}>
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
      
      {/* CABECERA */}
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
        <button onClick={handleLogout} className="bg-white/10 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all">
          <LogOut size={18} />
        </button>
      </nav>

      <div className="max-w-md mx-auto px-4 mt-6">

        {/* 📋 VISTA DASHBOARD */}
        {estadoVista === 'dashboard' && empleado && (
          <div className="flex flex-col gap-5 anim-entrada-suave">
            
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

            {/* SECCIÓN MENÚ DEL COMEDOR CON AGRUPACIÓN DINÁMICA */}
            <div className="bg-gradient-to-br from-[#1A2744] to-[#25365d] rounded-[2rem] shadow-2xl p-6 border border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10 blur-3xl"></div>
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <ChefHat className="text-[#C9A84C]" size={28}/>
                <div>
                  <h2 className="text-white text-xl font-black uppercase tracking-wider">Menú del Comedor</h2>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em]">Aparta tu platillo</p>
                </div>
              </div>

              {/* SELECTOR DE DÍAS */}
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

              {/* CONTENIDO DEL DÍA (AGRUPADO) */}
              <div key={fechaActiva} className="min-h-[150px] relative z-10">
                {reservaDelDia ? (
                  <div className="bg-emerald-500/20 border border-emerald-500/30 p-6 rounded-3xl flex flex-col items-center text-center anim-cascada" style={{animationDelay: '0ms'}}>
                    <div className="bg-emerald-500 text-white p-3 rounded-full mb-3 shadow-lg">
                      <Check size={24}/>
                    </div>
                    <p className="text-white font-black uppercase text-xs mb-1">¡Buen provecho!</p>
                    <p className="text-emerald-200 text-sm font-black uppercase tracking-wide bg-emerald-900/60 border border-emerald-500/30 px-4 py-2 rounded-xl mt-2 max-w-full truncate">
                      {reservaDelDia.menu_comedor?.platillo}
                    </p>
                  </div>
                ) : (
                  <>
                    {menusParaMostrar.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-slate-400 py-10 border-2 border-dashed border-white/10 rounded-3xl bg-white/5">
                        <Calendar size={32} className="mb-3 opacity-40"/>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-center">Menú no publicado para<br/>esta fecha</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {/* SECCIÓN DESAYUNOS */}
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

                        {/* SECCIÓN ALMUERZOS */}
                        {almuerzos.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
                              <Sun className="text-emerald-400" size={20} />
                              <h3 className="text-emerald-400 font-black text-xs uppercase tracking-[0.2em]">Almuerzos</h3>
                            </div>
                            <div className="space-y-3">
                              {almuerzos.map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={desayunos.length + i} />)}
                            </div>
                          </div>
                        )}

                        {/* SECCIÓN CENAS */}
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
                  </>
                )}
              </div>
            </div>

            <button 
              onClick={iniciarGeneracion}
              className="w-full bg-[#1A2744] text-white hover:bg-black py-5 rounded-3xl font-black uppercase text-sm transition-all shadow-xl flex justify-center items-center gap-3 active:scale-95 transform hover:-translate-y-0.5"
            >
              <QrCode size={20} className="text-[#C9A84C]" /> Generar QR de Acceso
            </button>

            {/* HISTORIAL */}
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

        {/* VISTAS MANTENIDAS */}
        {estadoVista === 'busqueda' && (
          <form onSubmit={buscarEmpleadoManual} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 anim-entrada-suave">
            <h2 className="text-2xl font-black text-[#1A2744] mb-2 uppercase tracking-tight">Comedor FGE Yucatán</h2>
            <p className="text-slate-500 mb-6 text-sm">Ingresa tu nombre como aparece en nómina.</p>
            <input 
              type="text" 
              value={nombreBusqueda}
              onChange={(e) => setNombreBusqueda(e.target.value)}
              className="w-full p-4 border-2 border-slate-100 rounded-2xl mb-4 uppercase font-bold text-slate-800 focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none transition-colors"
              placeholder="Ej. JOSE PEREZ PEREZ"
            />
            <button type="submit" className="w-full bg-[#C9A84C] hover:bg-amber-500 text-[#1A2744] py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-md active:scale-95">Ver Mi Vale</button>
            {error && <p className="text-red-500 mt-4 text-center text-sm font-medium uppercase text-xs">{error}</p>}
          </form>
        )}

        {estadoVista === 'animando' && (
          <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-[#1A2744] rounded-full flex items-center justify-center text-3xl mb-8 relative shadow-lg">
              📊 <div className="absolute inset-0 rounded-full border-4 border-[#1A2744]/20 anim-latido"></div>
            </div>
            <h3 className="text-lg font-bold text-[#1A2744] mb-8 uppercase tracking-widest">Generando...</h3>
            <div className="w-full flex flex-col gap-4 mb-8">
              <PasoCheck visible={pasoAnimacion >= 1} texto="Verificando identidad..." completed={pasoAnimacion > 1} />
              <PasoCheck visible={pasoAnimacion >= 2} texto="Comprobando cuota..." completed={pasoAnimacion > 2} />
              <PasoCheck visible={pasoAnimacion >= 3} texto="Validando fecha..." completed={pasoAnimacion > 3} />
              <PasoCheck visible={pasoAnimacion >= 4} texto="Generando QR..." completed={pasoAnimacion > 4} active={pasoAnimacion === 4} />
              <PasoCheck visible={pasoAnimacion >= 5} texto="¡Vale generado!" completed={pasoAnimacion >= 5} />
            </div>
          </div>
        )}

        {estadoVista === 'ticket' && (
          <div className="flex flex-col items-center gap-4 anim-cascada" style={{animationDelay: '0ms'}}>
            <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl w-full border border-slate-100">
              <div className="bg-[#1A2744] p-6 text-center border-b-2 border-dashed border-slate-200 relative">
                <p className="text-[#C9A84C] text-[10px] uppercase font-bold tracking-[0.2em] mb-1">Fiscalía General del Estado</p>
                <h2 className="text-white text-xl font-black uppercase tracking-wider">Vale Digital</h2>
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
                <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
              </div>
              <div className="p-8 flex flex-col items-center">
                <div className="flex justify-between w-full mb-8 gap-4">
                  <div className="text-center flex-1">
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Empleado</p>
                    <p className="text-[#1A2744] text-[11px] font-black leading-tight uppercase">{empleado.nombre_completo}</p>
                  </div>
                  <div className="text-center flex-1 border-l pl-4 border-slate-100">
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Fecha</p>
                    <p className="text-[#1A2744] text-xs font-black">{hoyCorto}</p>
                  </div>
                </div>
                <div className="w-full bg-[#F8FAFC] p-6 rounded-2xl flex flex-col items-center mb-6 border border-slate-50 relative overflow-hidden">
                   <div className="absolute inset-0 bg-indigo-50/50 anim-latido opacity-50"></div>
                  <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(empleado.nombre_completo)}&scale=3&rotate=N&includetext`} alt="QR" className="w-full h-20 object-contain mix-blend-multiply relative z-10" />
                  <p className="text-slate-500 text-[10px] font-bold mt-3 tracking-widest uppercase relative z-10">Folio: {folioGenerado}</p>
                </div>
                <div className="w-full bg-emerald-50 text-emerald-600 p-3 rounded-2xl text-center font-black text-[11px] uppercase tracking-widest border border-emerald-100 anim-latido">✓ Escanea en Caja</div>
              </div>
            </div>
            <button onClick={() => setEstadoVista('dashboard')} className="bg-[#1A2744]/10 text-[#1A2744] px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest mt-4 active:scale-95 transition-all">Regresar</button>
          </div>
        )}

      </div>

      {/* SISTEMA DE ANIMACIÓN 100% SEGURO */}
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
          animation: fadeUpIn 0.6s ease-out forwards;
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