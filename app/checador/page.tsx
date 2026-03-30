'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, MapPin, Fingerprint, CheckCircle2, AlertTriangle, Clock, Navigation } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ChecadorMobile() {
  const [pin, setPin] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string, tipo: 'exito' | 'error' | 'info' } | null>(null);
  
  // Estados de GPS
  const [gpsActivo, setGpsActivo] = useState(false);
  const [coordenadas, setCoordenadas] = useState('');
  const [buscandoGps, setBuscandoGps] = useState(true);

  useEffect(() => {
    obtenerUbicacion();
  }, []);

  const obtenerUbicacion = () => {
    setBuscandoGps(true);
    if (!navigator.geolocation) {
      mostrarMensaje('Tu dispositivo no soporta GPS', 'error');
      setBuscandoGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordenadas(`${position.coords.latitude}, ${position.coords.longitude}`);
        setGpsActivo(true);
        setBuscandoGps(false);
      },
      (error) => {
        setGpsActivo(false);
        setBuscandoGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          mostrarMensaje('Debes permitir el acceso a tu ubicación para checar', 'error');
        } else {
          mostrarMensaje('Error al obtener ubicación. Intenta de nuevo.', 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const mostrarMensaje = (texto: string, tipo: 'exito' | 'error' | 'info') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 5000);
  };

  const manejarTeclado = (numero: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + numero);
    }
  };

  const borrarPin = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const registrarAsistencia = async () => {
    if (!pin) { mostrarMensaje('Ingresa tu PIN', 'error'); return; }
    if (!gpsActivo) { mostrarMensaje('Esperando señal de GPS...', 'error'); obtenerUbicacion(); return; }
    
    setCargando(true);
    const hoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const ahora = new Date();
    const horaActString = ahora.toLocaleTimeString('en-GB'); // HH:MM:SS

    try {
      // 1. Buscar empleado por PIN
      const { data: empleado, error: errEmp } = await supabase
        .from('cat_empleados')
        .select('*')
        .eq('pin_acceso', pin)
        .eq('activo', true)
        .maybeSingle();

      if (errEmp || !empleado) {
        mostrarMensaje('PIN incorrecto o empleado no encontrado', 'error');
        setPin('');
        setCargando(false);
        return;
      }

      // 2. Verificar si ya checó hoy
      const { data: yaCheco } = await supabase
        .from('asistencia_diaria')
        .select('id, hora_registro')
        .eq('empleado_id', empleado.id)
        .eq('fecha', hoy)
        .maybeSingle();

      if (yaCheco) {
        mostrarMensaje(`Ya registraste tu entrada hoy a las ${yaCheco.hora_registro.substring(0,5)}`, 'info');
        setPin('');
        setCargando(false);
        return;
      }

      // 3. Calcular si hay retardo
      let estatusFinal = 'OK';
      const [horaEntrada, minEntrada] = empleado.hora_entrada.split(':').map(Number);
      
      const limite = new Date();
      limite.setHours(horaEntrada, minEntrada + empleado.minutos_tolerancia, 0);

      if (ahora > limite) {
        estatusFinal = 'RETARDO';
      }

      // 4. Guardar registro
      const { error: errIns } = await supabase.from('asistencia_diaria').insert([{
        empleado_id: empleado.id,
        fecha: hoy,
        hora_registro: horaActString,
        estatus: estatusFinal,
        coordenadas_gps: coordenadas,
        registrado_desde_ip: 'APP_MOVIL'
      }]);

      if (errIns) throw errIns;

      // 5. Éxito
      mostrarMensaje(`¡Hola ${empleado.nombre_completo.split(' ')[0]}! Entrada registrada: ${horaActString.substring(0,5)} ${estatusFinal === 'RETARDO' ? '(Con Retardo)' : ''}`, 'exito');
      setPin('');

    } catch (error: any) {
      mostrarMensaje(error.message || 'Error al conectar con el servidor', 'error');
    }
    
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-[#1A2744] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Círculos decorativos de fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        
        {/* Cabecera */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/10 shadow-xl">
            <Clock className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-widest uppercase">Checador</h1>
          <p className="text-blue-300/80 text-[10px] font-black tracking-[0.3em] uppercase mt-1">Control de Asistencia</p>
        </div>

        {/* Indicador de GPS */}
        <div className={`mb-8 flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-widest transition-all ${buscandoGps ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : gpsActivo ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {buscandoGps ? <Loader2 size={14} className="animate-spin" /> : gpsActivo ? <Navigation size={14} /> : <MapPin size={14} />}
          {buscandoGps ? 'Localizando...' : gpsActivo ? 'GPS Activado' : 'GPS Requerido'}
        </div>

        {/* Mensajes */}
        {mensaje && (
          <div className={`w-full p-4 rounded-2xl mb-6 flex items-start gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 ${mensaje.tipo === 'exito' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : mensaje.tipo === 'info' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
            {mensaje.tipo === 'exito' ? <CheckCircle2 size={20} className="shrink-0 mt-0.5"/> : <AlertTriangle size={20} className="shrink-0 mt-0.5"/>}
            <p className="leading-tight">{mensaje.texto}</p>
          </div>
        )}

        {/* Display del PIN */}
        <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 mb-6 shadow-2xl backdrop-blur-md">
          <p className="text-center text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase mb-4">Ingresa tu PIN</p>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className={`w-14 h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${pin.length > index ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                {pin.length > index ? '•' : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Teclado Numérico */}
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button key={num} onClick={() => manejarTeclado(num)} disabled={cargando} className="bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-white text-xl font-black rounded-2xl py-5 transition-all active:scale-95">
              {num}
            </button>
          ))}
          <button onClick={borrarPin} disabled={cargando} className="bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 text-sm font-black uppercase tracking-widest rounded-2xl py-5 transition-all active:scale-95 flex items-center justify-center">
            DEL
          </button>
          <button onClick={() => manejarTeclado('0')} disabled={cargando} className="bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/5 text-white text-xl font-black rounded-2xl py-5 transition-all active:scale-95">
            0
          </button>
          <button onClick={obtenerUbicacion} disabled={cargando || gpsActivo} className="bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-400 text-sm font-black uppercase tracking-widest rounded-2xl py-5 transition-all active:scale-95 flex items-center justify-center">
            GPS
          </button>
        </div>

        {/* Botón Checar */}
        <button onClick={registrarAsistencia} disabled={cargando || !gpsActivo || pin.length === 0} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white py-5 rounded-2xl font-black text-sm tracking-[0.2em] uppercase shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3">
          {cargando ? <Loader2 size={20} className="animate-spin" /> : <Fingerprint size={20} />}
          {cargando ? 'Registrando...' : 'Registrar Entrada'}
        </button>

      </div>
    </div>
  );
}