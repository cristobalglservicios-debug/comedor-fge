'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'escanear' | 'historial';

export default function PantallaCajero() {
  const [activeTab, setActiveTab] = useState<Tab>('escanear');
  const [inputLectura, setInputLectura] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | null, texto: string, empleado?: any, hora?: string }>({ tipo: null, texto: '' });
  const [stats, setStats] = useState({ canjeadosHoy: 0, transacciones: 0 });
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarDatosDia();
    inputRef.current?.focus();
  }, []);

  const cargarDatosDia = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('historial_comedor')
      .select('*')
      .gte('fecha_hora', `${hoy}T00:00:00`)
      .order('fecha_hora', { ascending: false });

    if (data) {
      setHistorial(data);
      setStats({
        canjeadosHoy: data.length,
        transacciones: data.length
      });
    }
  };

  const procesarEscaneo = async (e?: React.FormEvent, nombreFuerza?: string) => {
    if (e) e.preventDefault();
    
    const nombreEscaneado = nombreFuerza ? nombreFuerza.toUpperCase() : inputLectura.trim().toUpperCase();
    if (!nombreEscaneado) return;

    setCargando(true);
    setMensaje({ tipo: null, texto: '' });

    const { data: empleado, error: errorBusqueda } = await supabase
      .from('perfiles')
      .select('*')
      .eq('nombre_completo', nombreEscaneado)
      .maybeSingle();

    if (errorBusqueda || !empleado) {
      setMensaje({ tipo: 'error', texto: `No se encontró: ${nombreEscaneado}` });
      setCargando(false);
      setInputLectura('');
      inputRef.current?.focus();
      return;
    }

    if (empleado.tickets_restantes <= 0) {
      setMensaje({ tipo: 'error', texto: `${empleado.nombre_completo} sin vales disponibles.` });
      setCargando(false);
      setInputLectura('');
      inputRef.current?.focus();
      return;
    }

    const { error: errorUpdate } = await supabase
      .from('perfiles')
      .update({ 
        tickets_restantes: empleado.tickets_restantes - 1,
        tickets_canjeado: empleado.tickets_canjeado + 1 
      })
      .eq('nombre_completo', empleado.nombre_completo);

    if (!errorUpdate) {
      await supabase.from('historial_comedor').insert({
        nombre_empleado: empleado.nombre_completo,
        dependencia: empleado.dependencia
      });

      const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      
      setMensaje({ 
        tipo: 'exito', 
        texto: '¡Vale canjeado!', 
        empleado: empleado,
        hora: horaActual
      });
      
      cargarDatosDia();
    } else {
      setMensaje({ tipo: 'error', texto: 'Error de conexión.' });
    }

    setCargando(false);
    setInputLectura('');
    inputRef.current?.focus();
  };

  const hoyFormateado = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F0F3F6] font-sans pb-10">
      
      {/* CABECERA AZUL MARINO */}
      <div className="bg-[#1A2744] text-white p-3 sm:p-4 shadow-sm flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="hover:bg-white/10 p-1 sm:p-2 rounded-full transition-colors">
            ←
          </Link>
          <div>
            <h1 className="font-bold text-base sm:text-lg leading-tight truncate max-w-[150px] sm:max-w-none">Punto de Canje</h1>
            <p className="text-[#6366F1] text-[10px] sm:text-xs font-medium">La Ministerial</p>
          </div>
        </div>
        <div className="text-xs sm:text-sm font-medium text-slate-300">{hoyFormateado}</div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
        
        {/* KPIs SUPERIORES */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <h2 className="text-3xl sm:text-5xl font-black text-[#6366F1]">{stats.canjeadosHoy}</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1 sm:mt-2 leading-tight">Canjeados hoy</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <h2 className="text-3xl sm:text-5xl font-black text-emerald-500">{stats.transacciones}</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1 sm:mt-2 leading-tight">Transacciones</p>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL CON PESTAÑAS */}
        <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-1 sm:p-2 gap-1 sm:gap-2">
            <button 
              onClick={() => { setActiveTab('escanear'); inputRef.current?.focus(); }} 
              className={`flex-1 py-2 sm:py-3 px-2 sm:px-6 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 ${
                activeTab === 'escanear' ? 'bg-[#6366F1] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              Escanear
            </button>
            <button 
              onClick={() => setActiveTab('historial')} 
              className={`flex-1 py-2 sm:py-3 px-2 sm:px-6 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 ${
                activeTab === 'historial' ? 'bg-[#6366F1] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Historial
            </button>
          </div>

          {activeTab === 'escanear' && (
            <div className="p-4 sm:p-8">
              <h3 className="text-[#1A2744] font-bold text-sm sm:text-base mb-3 sm:mb-4">Escanear código de barras</h3>
              
              <form onSubmit={(e) => procesarEscaneo(e)} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-2">
                <input 
                  ref={inputRef}
                  type="text" 
                  value={inputLectura}
                  onChange={(e) => setInputLectura(e.target.value)}
                  className="flex-1 w-full p-3 sm:p-4 border-2 border-[#6366F1]/40 rounded-xl text-slate-800 font-mono text-sm sm:text-lg focus:border-[#6366F1] outline-none transition-colors uppercase tracking-wider"
                  placeholder="Escanea o escribe aquí..."
                  disabled={cargando}
                />
                <button 
                  type="submit" 
                  disabled={cargando}
                  className="w-full sm:w-auto bg-[#6366F1] hover:bg-indigo-600 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-xl font-bold transition-colors shadow-md text-base sm:text-lg"
                >
                  {cargando ? '...' : 'Validar Vale'}
                </button>
              </form>
              <p className="text-slate-400 text-[10px] sm:text-xs mb-6 sm:mb-8 text-center sm:text-left">El escáner USB llenará este campo automáticamente</p>

              {mensaje.tipo === 'exito' && mensaje.empleado && (
                <div className="w-full bg-emerald-50 border border-emerald-300 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center animate-fade-in">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 text-[#1A2744] mb-3 sm:mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1A2744] mb-1 sm:mb-2">{mensaje.texto}</h2>
                  <p className="text-[#1A2744] font-bold text-base sm:text-lg leading-tight">{mensaje.empleado.nombre_completo}</p>
                  <p className="text-slate-500 text-xs sm:text-sm mb-3 sm:mb-4 mt-1">
                    {mensaje.empleado.dependencia} — {mensaje.hora}
                  </p>
                  <p className="text-[#C9A84C] font-bold text-xs sm:text-sm uppercase tracking-wider">
                    {(mensaje.empleado.tickets_restantes + mensaje.empleado.tickets_canjeado) > 1 ? 'Recolector' : 'Empleado'}
                  </p>
                </div>
              )}

              {mensaje.tipo === 'error' && (
                <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-6 flex items-center justify-center text-red-600 font-bold text-sm sm:text-base text-center">
                  ❌ {mensaje.texto}
                </div>
              )}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="p-4 sm:p-8">
              <h3 className="text-[#1A2744] font-bold text-sm sm:text-base mb-4 sm:mb-6 border-b border-slate-100 pb-3 sm:pb-4">
                Canjes de hoy — {hoyFormateado}
              </h3>
              
              <div className="flex flex-col gap-4 sm:gap-6 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
                {historial.map((h, i) => (
                  <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-50 pb-3 sm:pb-4 last:border-0 gap-2 sm:gap-0">
                    <div>
                      <p className="font-bold text-[#1A2744] text-sm sm:text-base leading-tight">{h.nombre_empleado}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <p className="text-slate-400 text-xs sm:text-sm">{h.dependencia}</p>
                        {i % 3 === 0 && (
                          <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-100">Recolector</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-slate-800 font-medium text-xs sm:text-sm self-start sm:self-auto">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(h.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                
                {historial.length === 0 && (
                  <div className="text-center text-slate-400 py-8 sm:py-10 font-medium text-sm">
                    Aún no hay canjes registrados el día de hoy.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}} />
    </div>
  );
}