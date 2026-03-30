'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Utensils, History, TicketCheck, ChefHat, Check, Calendar, Loader2, Sunrise, Sun, Moon, X, Lock, Minus, Plus, AlertTriangle, Layers, Clock, Hash, Flame, Star, Store, ChevronRight, Terminal, ShieldCheck, UtensilsCrossed, MessageCircle, Download } from 'lucide-react';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';

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
      alert(rpcError.message.includes('AGOTADO') ? "❌ Lo sentimos, el platillo se acaba de agotar." : "Hubo un error al procesar tu solicitud.");
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
      alert("✅ Reserva cancelada.");
      await cargarMenusYReservasFuturas(empleado.nombre_completo);
    }
    setCargandoApartado(false);
  };

  const iniciarGeneracion = () => {
    if (empleado.tickets_restantes < cantidadACanjear) {
      alert(`🚫 No tienes suficientes vales (${empleado.tickets_restantes} disponibles).`);
      return;
    }
    const uid = Math.random().toString(36).substring(2, 6).toUpperCase() + Math.floor(Math.random() * 100);
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

  const descargarValePDF = () => {
    if (!empleado) return;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(26, 39, 68);
    doc.text("VALE DIGITAL FGE", 105, 40, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Empleado: ${empleado.nombre_completo}`, 20, 60);
    doc.text(`Unidades: ${cantidadACanjear}`, 20, 70);
    doc.text(`Token: ${tokenSeguridad}`, 20, 80);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 20, 90);
    doc.save(`Vale_FGE_${tokenSeguridad}.pdf`);
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
  const valorQR = empleado?.nombre_completo || 'EMP';

  if (estadoVista === 'cargando') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-amber-500 mb-4" size={40} />
        <p className="text-[10px] font-black tracking-widest text-[#1A2744] uppercase">Cargando Perfil...</p>
      </div>
    );
  }

  const TarjetaPlatillo = ({ m, index }: { m: any, index: number }) => (
    <div 
      className="anim-fade-up bg-white p-5 rounded-3xl flex justify-between items-center border border-slate-100 shadow-sm active:scale-[0.98] transition-all duration-200 mb-3"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex-1 pr-4">
        <h3 className="text-[#1A2744] font-black text-sm uppercase leading-tight mb-1">{m.platillo}</h3>
        {m.descripcion && <p className="text-slate-400 text-[10px] font-medium">{m.descripcion}</p>}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className={`text-center p-2 rounded-2xl w-14 h-14 border flex flex-col justify-center ${m.porciones_disponibles <= 15 ? 'bg-red-50 border-red-100 text-red-600 anim-latido' : 'bg-slate-50 border-slate-100 text-[#1A2744]'}`}>
          <p className="text-2xl font-black leading-none">{m.porciones_disponibles}</p>
          <p className="text-[8px] font-black uppercase opacity-60">Disp.</p>
        </div>
        <button onClick={() => apartarComida(m)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest">Apartar</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-10 relative">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#1A2744] rounded-xl flex items-center justify-center shadow-lg"><ChefHat className="text-amber-400" size={20} /></div>
          <div><h1 className="font-black text-xs uppercase text-[#1A2744]">{empleado?.nombre_completo}</h1></div>
        </div>
        <div className="flex gap-2">
          {empleado?.rol === 'admin' && <button onClick={() => router.push('/admin')} className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl border border-indigo-100"><ShieldCheck size={18} /></button>}
          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-2.5 rounded-xl border border-red-100"><LogOut size={18} /></button>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 mt-6">
        {estadoVista === 'cambiar_password' && (
          <form onSubmit={actualizarPasswordUsuario} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 anim-fade-up text-center">
            <h2 className="text-2xl font-black text-[#1A2744] mb-8 uppercase">Actualizar Seguridad</h2>
            <input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-4" placeholder="Nueva Contraseña" />
            <input type="password" value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-8" placeholder="Confirmar Contraseña" />
            <button type="submit" className="w-full bg-[#1A2744] text-white py-5 rounded-2xl font-black uppercase">Guardar</button>
          </form>
        )}

        {estadoVista === 'dashboard' && (
          <div className="flex flex-col gap-6 anim-fade-up">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 text-center">
                <h3 className="text-3xl font-black text-[#1A2744]">{empleado.tickets_canjeado || 0}</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase">Usados</p>
              </div>
              <div className="bg-[#1A2744] p-5 rounded-[2rem] text-center">
                <h3 className="text-3xl font-black text-amber-400">{empleado.tickets_restantes || 0}</h3>
                <p className="text-[9px] font-black text-white/60 uppercase">Disponibles</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setCantidadACanjear(Math.max(1, cantidadACanjear - 1))} className="w-12 h-12 bg-slate-50 rounded-xl border flex items-center justify-center"><Minus size={20}/></button>
                <div className="text-center"><span className="text-4xl font-black text-[#1A2744]">{cantidadACanjear}</span></div>
                <button onClick={() => setCantidadACanjear(Math.min(empleado.tickets_restantes, cantidadACanjear + 1))} className="w-12 h-12 bg-[#1A2744] text-white rounded-xl flex items-center justify-center"><Plus size={20}/></button>
              </div>
              <button onClick={iniciarGeneracion} className="w-full bg-[#1A2744] text-white py-5 rounded-2xl font-black uppercase">Generar Vale Digital</button>
            </div>

            <div className="bg-[#1A2744] rounded-[2.5rem] p-6 relative overflow-hidden">
              <h2 className="text-white text-xl font-black uppercase mb-6 flex gap-2"><ChefHat className="text-amber-400"/> Menú FGE</h2>
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                {fechasDisponibles.map(fecha => {
                  const { day, weekday } = formatearFechaPestaña(fecha);
                  const isActive = fechaActiva === fecha;
                  return (
                    <button key={fecha} onClick={() => setFechaActiva(fecha)} className={`flex flex-col items-center justify-center rounded-2xl min-w-[65px] h-[80px] border ${isActive ? 'bg-amber-400 text-[#1A2744] border-amber-300' : 'bg-[#2A3F6D] border-[#2A3F6D] text-slate-300'}`}>
                      <span className="font-black text-2xl">{day}</span>
                      <span className="text-[9px] font-black uppercase">{weekday}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6">
                {reservasDelDia.map(r => (
                  <div key={r.id} className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl text-center mb-4">
                    <p className="text-white text-sm font-black uppercase mb-4">{r.menu_comedor?.platillo}</p>
                    <button onClick={() => cancelarReserva(r)} className="text-red-400 text-[9px] font-black uppercase">Cancelar Apartado</button>
                  </div>
                ))}
                {desayunos.map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={i} />)}
                {almuerzos.map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={i} />)}
                {cenas.map((m, i) => <TarjetaPlatillo key={m.id} m={m} index={i} />)}
              </div>
            </div>
          </div>
        )}

        {estadoVista === 'animando' && (
          <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="animate-spin text-amber-500 mb-6" size={48} />
            <p className="text-sm font-black text-[#1A2744] uppercase">Generando Vale Seguro...</p>
          </div>
        )}

        {estadoVista === 'ticket' && (
          <div className="flex flex-col items-center gap-6 anim-fade-up">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full border overflow-hidden">
              <div className="bg-[#1A2744] p-8 text-center"><h2 className="text-white text-2xl font-black uppercase">Vale de Comedor</h2></div>
              <div className="p-8 flex flex-col items-center">
                <div className="bg-white p-4 border rounded-xl mb-6">
                  <Barcode value={valorQR} format="CODE128" width={1.5} height={80} displayValue={true} />
                </div>
                <div className="bg-amber-400 px-6 py-2 rounded-xl font-black text-xs mb-6 uppercase">{cantidadACanjear} RACIONES</div>
                <div className="text-center mb-8">
                   <p className="text-slate-400 text-[8px] font-black uppercase">Token de Validación</p>
                   <p className="text-[#1A2744] font-black text-2xl tracking-[0.2em]">{tokenSeguridad}</p>
                </div>
                <button onClick={descargarValePDF} className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase"><Download size={16}/> Descargar PDF</button>
              </div>
            </div>
            <button onClick={() => setEstadoVista('dashboard')} className="w-full py-4 text-[10px] font-black uppercase text-slate-400">Regresar al Inicio</button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .anim-fade-up { animation: fadeUp 0.6s ease-out forwards; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}