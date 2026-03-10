'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EstadoVista = 'cargando' | 'busqueda' | 'dashboard' | 'animando' | 'ticket';

export default function MiValePage() {
  const [nombreBusqueda, setNombreBusqueda] = useState('');
  const [empleado, setEmpleado] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [estadoVista, setEstadoVista] = useState<EstadoVista>('cargando');
  const [pasoAnimacion, setPasoAnimacion] = useState(0);

  // 1. AUTO-LOGIN INTELIGENTE AL ENTRAR
  useEffect(() => {
    const intentarAutoLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.email) {
        // Extraemos el nombre del correo (ej: "juan.perez@fge..." -> "juan perez")
        const emailPrefijo = session.user.email.split('@')[0].replace(/\./g, ' ');
        
        const { data } = await supabase
          .from('perfiles')
          .select('*')
          .ilike('nombre_completo', `%${emailPrefijo}%`)
          .maybeSingle();

        if (data) {
          setEmpleado(data);
          cargarHistorialReciente(data.nombre_completo);
          setEstadoVista('dashboard');
          return; // Si lo encuentra, termina aquí y muestra el dashboard
        }
      }
      // Si no hay sesión o no encontró coincidencia, muestra el buscador manual
      setEstadoVista('busqueda');
    };

    intentarAutoLogin();
  }, []);

  // 2. BÚSQUEDA MANUAL (PLAN B)
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
      setEstadoVista('dashboard');
    }
  };

  const cargarHistorialReciente = async (nombre: string) => {
    const { data } = await supabase
      .from('historial_comedor')
      .select('*')
      .eq('nombre_empleado', nombre)
      .order('fecha_hora', { ascending: false })
      .limit(3);
    if (data) setHistorial(data);
  };

  // 3. SECUENCIA DE ANIMACIÓN
  const iniciarGeneracion = () => {
    if (empleado.tickets_restantes <= 0) {
      alert("🚫 Lo sentimos, ya no tienes vales disponibles para hoy.");
      return;
    }
    setEstadoVista('animando');
    setPasoAnimacion(1);

    setTimeout(() => setPasoAnimacion(2), 800);  // Comprobando cuota...
    setTimeout(() => setPasoAnimacion(3), 1600); // Validando fecha...
    setTimeout(() => setPasoAnimacion(4), 2400); // Generando código de barras...
    setTimeout(() => {
      setPasoAnimacion(5); // ¡Vale generado!
      setEstadoVista('ticket'); // Salto al ticket final
    }, 3200);
  };

  // Formateadores de fecha para que se vea como en tu captura
  const hoyCorto = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hoyLargo = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const folioGenerado = `FGE-${empleado?.dependencia?.substring(0,3).toUpperCase() || 'EMP'}-00${empleado?.id || '1'}`;

  // --- PANTALLA DE CARGA INICIAL ---
  if (estadoVista === 'cargando') {
    return <div className="min-h-screen bg-[#F0F3F6] flex items-center justify-center font-bold text-slate-400 animate-pulse">Verificando acceso...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F0F3F6] font-sans pb-10">
      
      {/* CABECERA (Estilo App Móvil) */}
      <div className="bg-[#1A2744] text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="hover:bg-white/10 p-2 rounded-full transition-colors font-bold text-xl">
              ←
            </Link>
            <div>
              <h1 className="font-bold text-base leading-tight">
                {empleado ? empleado.nombre_completo : 'Acceso Empleados'}
              </h1>
              <p className="text-teal-400 text-xs font-medium truncate max-w-[200px]">
                {empleado ? empleado.dependencia : 'Comedor FGE'}
              </p>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-300">{hoyCorto}</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6">

        {/* 🔓 VISTA 1: BÚSQUEDA MANUAL (Solo si falla el auto-login) */}
        {estadoVista === 'busqueda' && (
          <form onSubmit={buscarEmpleadoManual} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-2xl font-black text-[#1A2744] mb-2">Comedor FGE Yucatán</h2>
            <p className="text-slate-500 mb-6 text-sm">Ingresa tu nombre completo para ver tu vale.</p>
            <input 
              type="text" 
              value={nombreBusqueda}
              onChange={(e) => setNombreBusqueda(e.target.value)}
              className="w-full p-4 border border-slate-200 rounded-xl mb-4 uppercase font-bold text-slate-800 focus:border-[#C9A84C] outline-none"
              placeholder="ESCRIBE TU NOMBRE..."
            />
            <button type="submit" className="w-full bg-[#C9A84C] hover:bg-amber-500 text-white py-4 rounded-xl font-bold transition-all shadow-md">
              Consultar Mi Vale
            </button>
            {error && <p className="text-red-500 mt-4 text-center text-sm font-medium">{error}</p>}
          </form>
        )}

        {/* 📋 VISTA 2: DASHBOARD PRINCIPAL */}
        {estadoVista === 'dashboard' && (
          <div className="flex flex-col gap-6">
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <p className="text-slate-400 text-xs font-medium mb-1 capitalize">{hoyLargo}</p>
              <h2 className="text-2xl font-black text-[#1A2744] mb-6">Vale de Comida</h2>
              <div className="w-full bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100">
                <p className="font-bold text-base mb-1">Vale disponible</p>
                <p className="text-emerald-600/80 text-xs">Tienes {empleado.tickets_restantes} comida + 1 refresco disponible para hoy</p>
              </div>
            </div>

            <button 
              onClick={iniciarGeneracion}
              className="w-full bg-[#1A2744] hover:bg-slate-800 text-white py-5 rounded-2xl font-bold text-lg transition-all shadow-lg flex justify-center items-center gap-2"
            >
              <span className="text-xl">🔲</span> Generar Vale del Día
            </button>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-medium text-slate-700 mb-4">Historial reciente</h3>
              <div className="flex flex-col gap-4">
                {historial.map((h, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{new Date(h.fecha_hora).toLocaleDateString('es-MX')}</p>
                      <p className="text-slate-400 text-xs">🕒 {new Date(h.fecha_hora).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-xs font-bold">Canjeado</span>
                  </div>
                ))}
                {/* Elemento decorativo visual simulando uno no utilizado como en tu captura */}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Ayer</p>
                    <p className="text-slate-400 text-xs">🕒 --:--</p>
                  </div>
                  <span className="bg-red-50 text-red-500 border border-red-100 px-3 py-1 rounded-full text-xs font-bold">No utilizado</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ⏳ VISTA 3: ANIMACIÓN DE GENERACIÓN */}
        {estadoVista === 'animando' && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-[#1A2744] rounded-full flex items-center justify-center text-3xl mb-8 relative shadow-lg">
              📊
              <div className="absolute inset-0 rounded-full border-4 border-[#1A2744]/20 animate-ping"></div>
            </div>
            
            <h3 className="text-lg font-bold text-[#1A2744] mb-8">Generando código de barras...</h3>

            <div className="w-full flex flex-col gap-4 mb-8">
              <PasoCheck visible={pasoAnimacion >= 1} texto="Verificando identidad..." completed={pasoAnimacion > 1} />
              <PasoCheck visible={pasoAnimacion >= 2} texto="Comprobando cuota de dependencia..." completed={pasoAnimacion > 2} />
              <PasoCheck visible={pasoAnimacion >= 3} texto="Validando fecha..." completed={pasoAnimacion > 3} />
              <PasoCheck visible={pasoAnimacion >= 4} texto="Generando código de barras..." completed={pasoAnimacion > 4} active={pasoAnimacion === 4} />
              <PasoCheck visible={pasoAnimacion >= 5} texto="¡Vale generado!" completed={pasoAnimacion >= 5} />
            </div>

            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-[800ms] ease-out" style={{ width: `${pasoAnimacion * 20}%` }}></div>
            </div>
          </div>
        )}

        {/* 🎟️ VISTA 4: TICKET FINAL VIGENTE */}
        {estadoVista === 'ticket' && (
          <div className="flex flex-col items-center gap-4">
            
            <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl w-full border border-slate-100">
              {/* Header Ticket */}
              <div className="bg-[#1A2744] p-6 text-center border-b-2 border-dashed border-slate-400/30 relative">
                <p className="text-[#C9A84C] text-[10px] uppercase font-bold tracking-[0.1em] mb-1">Fiscalía General del Estado de Yucatán</p>
                <h2 className="text-white text-lg font-black uppercase tracking-tight">Vale por una Comida<br/><span className="text-[#C9A84C] text-xs">Y UN REFRESCO</span></h2>
                {/* Muescas del ticket */}
                <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
                <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#F0F3F6] rounded-full"></div>
              </div>

              {/* Body Ticket */}
              <div className="p-8 flex flex-col items-center relative">
                <div className="text-center mb-6 w-full">
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Dependencia</p>
                  <p className="text-[#1A2744] text-sm font-bold">{empleado.dependencia}</p>
                </div>

                <div className="flex justify-between w-full mb-8 gap-4">
                  <div className="text-center flex-1">
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Empleado</p>
                    <p className="text-[#1A2744] text-sm font-bold leading-tight">{empleado.nombre_completo}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Fecha</p>
                    <p className="text-[#1A2744] text-sm font-bold">{hoyCorto}</p>
                  </div>
                </div>

                {/* Código de Barras */}
                <div className="w-full bg-[#F8FAFC] p-6 rounded-2xl flex flex-col items-center mb-6">
                  <img 
                    src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(empleado.nombre_completo)}&scale=3&rotate=N&includetext`} 
                    alt="Código de Barras"
                    className="w-full h-20 object-contain mix-blend-multiply"
                  />
                  <p className="text-slate-500 text-[10px] font-bold mt-3 tracking-widest">Folio: {folioGenerado}</p>
                </div>

                <div className="w-full bg-emerald-50 text-emerald-600 p-3 rounded-xl text-center font-bold text-sm">
                  ✓ VALE VIGENTE — Válido solo para hoy
                </div>
              </div>
            </div>

            {/* Banner Informativo Inferior */}
            <div className="w-full bg-indigo-50/50 p-5 rounded-2xl flex items-center gap-4 border border-indigo-100/50">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-500 shrink-0">📱</div>
              <p className="text-indigo-900/80 text-xs font-medium leading-relaxed">
                <strong className="text-indigo-900">Presenta este código</strong> en el comedor para canjear tu comida del día.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

// Componente para la lista de checks de la animación
function PasoCheck({ visible, texto, completed, active }: { visible: boolean, texto: string, completed: boolean, active?: boolean }) {
  if (!visible) return null;
  return (
    <div className={`flex items-center gap-3 text-sm font-medium transition-all duration-300 ${completed ? 'text-slate-700' : active ? 'text-indigo-600' : 'text-slate-300'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${completed ? 'bg-emerald-400 text-white' : active ? 'border-2 border-indigo-500' : 'bg-slate-100'}`}>
        {completed ? '✓' : ''}
        {active && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>}
      </div>
      {texto}
    </div>
  );
}