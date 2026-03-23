'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Utensils, History, TicketCheck, ChefHat, Check } from 'lucide-react';

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

  // NUEVOS ESTADOS MENÚ MERCADO
  const [menuHoy, setMenuHoy] = useState<any[]>([]);
  const [miReserva, setMiReserva] = useState<any>(null);

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
          await cargarMenuYReserva(data.nombre_completo);
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
      await cargarMenuYReserva(data.nombre_completo);
      setEstadoVista('dashboard');
    }
  };

  const cargarHistorialReciente = async (nombre: string) => {
    // Variable para burlar el caché de Next.js
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

  const cargarMenuYReserva = async (nombreEmpleado: string) => {
    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toISOString(); // Burlar caché

    // Fuerza a Next.js a traer datos frescos porque 'ahora' cambia cada milisegundo
    const { data: menu } = await supabase
      .from('menu_comedor')
      .select('*')
      .eq('fecha', hoy)
      .gt('porciones_disponibles', 0)
      .lte('creado_en', ahora); 
      
    if (menu) setMenuHoy(menu);

    const { data: reserva } = await supabase
      .from('reservas_comedor')
      .select('*, menu_comedor(platillo)')
      .eq('nombre_empleado', nombreEmpleado)
      .gte('creado_en', `${hoy}T00:00:00`)
      .lte('creado_en', ahora) 
      .maybeSingle();
      
    if (reserva) setMiReserva(reserva);
  };

  const apartarComida = async (menuItem: any) => {
    if (empleado.tickets_restantes <= 0) return alert("🚫 No tienes vales disponibles para apartar.");
    if (miReserva) return alert("⚠️ Ya aseguraste tu comida de hoy.");
    if (!confirm(`🍽 ¿Asegurar una porción de ${menuItem.platillo}?`)) return;

    // Reducir porción en el menú
    const { error: errUpdate } = await supabase.from('menu_comedor').update({ porciones_disponibles: menuItem.porciones_disponibles - 1 }).eq('id', menuItem.id);
    
    if (!errUpdate) {
      // Guardar reserva
      await supabase.from('reservas_comedor').insert({
        menu_id: menuItem.id,
        nombre_empleado: empleado.nombre_completo,
        dependencia: empleado.dependencia
      });
      alert("✅ ¡Platillo asegurado! Se respetará tu porción en el comedor.");
      await cargarMenuYReserva(empleado.nombre_completo);
    } else {
      alert("Hubo un error o el platillo se acaba de agotar.");
    }
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

  const hoyCorto = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hoyLargo = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const folioGenerado = `FGE-${empleado?.dependencia?.substring(0,3).toUpperCase() || 'EMP'}-00${empleado?.id || '1'}`;

  if (estadoVista === 'cargando') {
    return <div className="min-h-screen bg-[#F0F3F6] flex items-center justify-center font-bold text-slate-400 animate-pulse">Verificando acceso...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0F3F6] font-sans pb-10">
      
      {/* CABECERA */}
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8 relative z-50">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center border border-[#C9A84C]/30 shadow-inner shrink-0">
            <img 
              src="/logo-fge.png" 
              alt="FGE" 
              className="w-full h-full object-contain rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png"; }} 
            />
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

        {/* 📋 VISTA 2: DASHBOARD PRINCIPAL */}
        {estadoVista === 'dashboard' && empleado && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-500">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                  <TicketCheck size={18} />
                </div>
                <h3 className="text-2xl font-black text-[#1A2744]">{empleado.tickets_canjeado || 0}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Usados</p>
              </div>
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                <div className="w-8 h-8 bg-amber-50 text-[#C9A84C] rounded-full flex items-center justify-center mb-2">
                  <Utensils size={18} />
                </div>
                <h3 className="text-2xl font-black text-[#1A2744]">{empleado.tickets_restantes || 0}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disponibles</p>
              </div>
            </div>

            {/* SECCIÓN MERCADO (MENÚ DEL DÍA) */}
            <div className="bg-[#1A2744] rounded-3xl shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-10 translate-x-10 blur-2xl"></div>
              <div className="p-6 relative z-10">
                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                  <ChefHat className="text-[#C9A84C]" size={24}/>
                  <div>
                    <h2 className="text-white font-black uppercase tracking-widest">Menú de Hoy</h2>
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-[0.2em]">{hoyLargo}</p>
                  </div>
                </div>

                {miReserva ? (
                  <div className="bg-emerald-500/20 border border-emerald-500/30 p-5 rounded-2xl flex flex-col items-center text-center">
                    <Check className="text-emerald-400 mb-2" size={32}/>
                    <p className="text-white font-black uppercase text-sm mb-1">Tu porción está asegurada</p>
                    <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-widest bg-emerald-900/50 px-3 py-1 rounded-full mt-2">
                      {miReserva.menu_comedor?.platillo}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {menuHoy.map((m, i) => (
                      <div key={i} className="bg-white/10 border border-white/5 p-4 rounded-2xl flex justify-between items-center backdrop-blur-sm">
                        <div className="flex-1 pr-4">
                          <span className="text-[#C9A84C] text-[8px] font-black uppercase tracking-widest border border-[#C9A84C]/30 px-2 py-0.5 rounded-full mb-2 inline-block">
                            {m.tipo_comida}
                          </span>
                          <h3 className="text-white font-black text-sm uppercase leading-tight mb-1">{m.platillo}</h3>
                          {m.descripcion && <p className="text-slate-400 text-[10px] leading-snug">{m.descripcion}</p>}
                          <p className="text-emerald-400 text-[9px] font-bold mt-2 uppercase tracking-widest">Quedan {m.porciones_disponibles} porciones</p>
                        </div>
                        <button 
                          onClick={() => apartarComida(m)}
                          className="bg-[#C9A84C] hover:bg-amber-400 text-[#1A2744] px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-transform active:scale-95 shrink-0"
                        >
                          Apartar
                        </button>
                      </div>
                    ))}
                    {menuHoy.length === 0 && (
                      <p className="text-center text-slate-400 text-xs font-bold uppercase py-6 border-2 border-dashed border-white/10 rounded-2xl">
                        El menú aún no ha sido publicado
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={iniciarGeneracion}
              className="w-full bg-white border-2 border-[#1A2744] text-[#1A2744] hover:bg-slate-50 py-5 rounded-2xl font-black uppercase text-sm transition-all shadow-sm flex justify-center items-center gap-3 active:scale-95"
            >
              <QrCode size={20} /> Generar QR de Acceso
            </button>

            {/* HISTORIAL */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
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
                {historial.length === 0 && <p className="text-center text-slate-300 text-xs py-4">No hay canjes previos</p>}
              </div>
            </div>
          </div>
        )}

        {/* MANTENEMOS LAS VISTAS DE GENERACIÓN INTACTAS */}
        {estadoVista === 'busqueda' && (
          <form onSubmit={buscarEmpleadoManual} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-2xl font-black text-[#1A2744] mb-2">Comedor FGE</h2>
            <p className="text-slate-500 mb-6 text-sm">Ingresa tu nombre para ver tu vale.</p>
            <input 
              type="text" 
              value={nombreBusqueda}
              onChange={(e) => setNombreBusqueda(e.target.value)}
              className="w-full p-4 border border-slate-200 rounded-xl mb-4 uppercase font-bold text-slate-800 focus:border-[#C9A84C] outline-none"
              placeholder="NOMBRE COMPLETO..."
            />
            <button type="submit" className="w-full bg-[#C9A84C] hover:bg-amber-500 text-white py-4 rounded-xl font-bold transition-all shadow-md">Consultar Mi Vale</button>
            {error && <p className="text-red-500 mt-4 text-center text-sm font-medium">{error}</p>}
          </form>
        )}

        {estadoVista === 'animando' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-[#1A2744] rounded-full flex items-center justify-center text-3xl mb-8 relative shadow-lg">
              📊 <div className="absolute inset-0 rounded-full border-4 border-[#1A2744]/20 animate-ping"></div>
            </div>
            <h3 className="text-lg font-bold text-[#1A2744] mb-8 uppercase tracking-widest">Generando...</h3>
            <div className="w-full flex flex-col gap-4 mb-8">
              <PasoCheck visible={pasoAnimacion >= 1} texto="Verificando identidad..." completed={pasoAnimacion > 1} />
              <PasoCheck visible={pasoAnimacion >= 2} texto="Comprobando cuota..." completed={pasoAnimacion > 2} />
              <PasoCheck visible={pasoAnimacion >= 3} texto="Validando fecha..." completed={pasoAnimacion > 3} />
              <PasoCheck visible={pasoAnimacion >= 4} texto="Generando QR..." completed={pasoAnimacion > 4} active={pasoAnimacion === 4} />
              <PasoCheck visible={pasoAnimacion >= 5} texto="¡Vale generado!" completed={pasoAnimacion >= 5} />
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-[800ms] ease-out" style={{ width: `${pasoAnimacion * 20}%` }}></div>
            </div>
          </div>
        )}

        {estadoVista === 'ticket' && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
            <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl w-full border border-slate-100">
              <div className="bg-[#1A2744] p-6 text-center border-b-2 border-dashed border-slate-400/30 relative">
                <p className="text-[#C9A84C] text-[10px] uppercase font-bold tracking-[0.1em] mb-1">Fiscalía General de Yucatán</p>
                <h2 className="text-white text-lg font-black uppercase tracking-tight">Vale de Comida</h2>
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
                <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
              </div>
              <div className="p-8 flex flex-col items-center">
                <div className="flex justify-between w-full mb-8 gap-4">
                  <div className="text-center flex-1">
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Empleado</p>
                    <p className="text-[#1A2744] text-[11px] font-black leading-tight uppercase">{empleado.nombre_completo}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Fecha</p>
                    <p className="text-[#1A2744] text-xs font-black">{hoyCorto}</p>
                  </div>
                </div>
                <div className="w-full bg-[#F8FAFC] p-6 rounded-2xl flex flex-col items-center mb-6 border border-slate-50">
                  <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(empleado.nombre_completo)}&scale=3&rotate=N&includetext`} alt="QR" className="w-full h-20 object-contain mix-blend-multiply" />
                  <p className="text-slate-500 text-[10px] font-bold mt-3 tracking-widest uppercase">Folio: {folioGenerado}</p>
                </div>
                <div className="w-full bg-emerald-50 text-emerald-600 p-3 rounded-xl text-center font-black text-[10px] uppercase tracking-widest border border-emerald-100">✓ Vale Vigente Hoy</div>
              </div>
            </div>
            <button onClick={() => setEstadoVista('dashboard')} className="text-slate-400 text-xs font-black uppercase tracking-widest mt-4">Regresar</button>
          </div>
        )}

      </div>
    </div>
  );
}

function PasoCheck({ visible, texto, completed, active }: { visible: boolean, texto: string, completed: boolean, active?: boolean }) {
  if (!visible) return null;
  return (
    <div className={`flex items-center gap-3 text-xs font-bold transition-all duration-300 ${completed ? 'text-slate-700' : active ? 'text-indigo-600' : 'text-slate-300'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${completed ? 'bg-emerald-400 text-white' : active ? 'border-2 border-indigo-500' : 'bg-slate-100'}`}>
        {completed ? '✓' : ''} {active && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>}
      </div>
      {texto}
    </div>
  );
}