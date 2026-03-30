'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Lock, Key, AlertCircle, Ticket, Calendar, Utensils, UtensilsCrossed, ChefHat, CheckCircle2, QrCode, AlertOctagon, X, Layers } from 'lucide-react';
import QRCode from 'react-qr-code';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getHoyMerida = () => {
  const fecha = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Merida"}));
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function UserDashboard() {
  const [session, setSession] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actualizandoPassword, setActualizandoPassword] = useState(false);
  const [debeCambiarPass, setDebeCambiarPass] = useState(false);
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmarPass, setConfirmarPass] = useState('');
  const [errorPass, setErrorPass] = useState('');
  const [qrValue, setQrValue] = useState<string>('');
  const [menuHoy, setMenuHoy] = useState<any[]>([]);
  const [misReservas, setMisReservas] = useState<any[]>([]);
  const [reservando, setReservando] = useState<string | null>(null);
  const router = useRouter();

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMousePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    
    // Verificación local (sin await) para agilizar UX
    const passLocal = localStorage.getItem('debe_cambiar_password_fge');
    if (passLocal === 'true') {
        setDebeCambiarPass(true);
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setSession(session);
      
      const emailLower = session.user.email?.toLowerCase().trim();
      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('*')
        .eq('email', emailLower)
        .maybeSingle();

      if (perfilData) {
        setPerfil(perfilData);
        generarQR(perfilData.nombre_completo, perfilData.tickets_restantes);
      } else {
        console.error("No se encontró perfil para:", emailLower);
      }
      
      await cargarMenuYReservas(perfilData?.nombre_completo);
      setLoading(false);
    };

    fetchSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/');
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const cargarMenuYReservas = async (nombreEmpleado: string) => {
      const hoy = getHoyMerida();
      const ahora = new Date().toISOString(); 
      
      const { data: menus } = await supabase
          .from('menu_comedor')
          .select('*')
          .gte('fecha', hoy)
          .lte('creado_en', ahora) 
          .order('fecha', { ascending: true });
          
      if (menus) setMenuHoy(menus);

      if (nombreEmpleado && menus && menus.length > 0) {
          const menuIds = menus.map(m => m.id);
          const { data: reservas } = await supabase
              .from('reservas_comedor')
              .select('*')
              .in('menu_id', menuIds)
              .eq('nombre_empleado', nombreEmpleado);
              
          if (reservas) setMisReservas(reservas);
      }
  };

  const generarQR = (nombre: string, restantes: number) => {
    if (!nombre) return;
    const cleanName = nombre.trim().toUpperCase().replace(/\|/g, ''); 
    const uidUnico = Math.random().toString(36).substring(2, 10);
    const cadenaQR = `${cleanName}|1|${Date.now()}|${uidUnico}`;
    setQrValue(cadenaQR);
  };

  const reservarPlatillo = async (menu: any) => {
      if (!perfil) return;
      
      const apartadosHoy = misReservas.filter(r => 
          menuHoy.find(m => m.id === r.menu_id && m.fecha === menu.fecha)
      ).length;

      if (apartadosHoy > 0) {
          alert("⚠️ Ya tienes un platillo apartado para el día de hoy.");
          return;
      }

      if (perfil.tickets_restantes <= 0) {
          alert("❌ No tienes vales suficientes para hacer un apartado.");
          return;
      }

      setReservando(menu.id);

      const { data: checkMenu } = await supabase
          .from('menu_comedor')
          .select('porciones_disponibles')
          .eq('id', menu.id)
          .single();

      if (!checkMenu || checkMenu.porciones_disponibles <= 0) {
          alert("😔 Lo sentimos, las porciones de este platillo se han agotado.");
          setReservando(null);
          await cargarMenuYReservas(perfil.nombre_completo);
          return;
      }

      const { error: errInsert } = await supabase
          .from('reservas_comedor')
          .insert({
              menu_id: menu.id,
              nombre_empleado: perfil.nombre_completo,
              estado: 'APARTADO'
          });

      if (!errInsert) {
          await supabase
              .from('menu_comedor')
              .update({ porciones_disponibles: checkMenu.porciones_disponibles - 1 })
              .eq('id', menu.id);
              
          alert("✅ ¡Platillo apartado con éxito! Muéstrale tu QR al cajero para entregarlo.");
          await cargarMenuYReservas(perfil.nombre_completo);
      } else {
          alert("❌ Error al reservar. Inténtalo de nuevo.");
      }

      setReservando(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nuevaPass.length < 6) return setErrorPass('Mínimo 6 caracteres');
    if (nuevaPass !== confirmarPass) return setErrorPass('Las contraseñas no coinciden');

    setActualizandoPassword(true);
    setErrorPass('');

    const { error } = await supabase.auth.updateUser({ password: nuevaPass });

    if (error) {
      setErrorPass(error.message);
      setActualizandoPassword(false);
      return;
    }

    localStorage.removeItem('debe_cambiar_password_fge');
    setDebeCambiarPass(false);
    setActualizandoPassword(false);
    alert("✅ Contraseña actualizada correctamente. Bienvenido al sistema.");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const parallaxX = (mousePos.x - (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)) * -0.02;
  const parallaxY = (mousePos.y - (typeof window !== 'undefined' ? window.innerHeight / 2 : 0)) * -0.02;

  if (loading) {
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
            <p className="text-[10px] font-black tracking-[0.3em] uppercase">Preparando su cuenta...</p>
          </div>
        </div>
      </div>
    );
  }

  if (debeCambiarPass) {
    return (
      <div className="min-h-screen bg-[#1A2744] flex items-center justify-center p-4 relative overflow-hidden" onMouseMove={handleMouseMove}>
        <div className="absolute top-0 right-0 w-[50vh] h-[50vh] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none transition-transform duration-1000" style={{ transform: `translate(${parallaxX}px, ${parallaxY}px)` }}></div>
        <div className="absolute bottom-0 left-0 w-[40vh] h-[40vh] bg-amber-500/10 rounded-full blur-[80px] pointer-events-none transition-transform duration-1000" style={{ transform: `translate(${parallaxX * -1}px, ${parallaxY * -1}px)` }}></div>

        <div className="w-full max-w-md bg-white/10 backdrop-blur-2xl p-8 md:p-10 rounded-[3rem] shadow-2xl border border-white/20 relative z-10 animate-in zoom-in-95 duration-500">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-400/30">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Seguridad Requerida</h2>
            <p className="text-amber-400/80 text-[10px] font-black uppercase tracking-widest bg-amber-400/10 inline-block px-3 py-1 rounded-lg">Cambio de Contraseña</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div className="space-y-2 group/input">
              <label className="text-[10px] font-black tracking-widest text-slate-300 uppercase ml-1">Nueva Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-amber-400 transition-colors" size={18} />
                <input
                  type="password"
                  required
                  value={nuevaPass}
                  onChange={(e) => setNuevaPass(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:bg-white/10 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all placeholder:text-white/20 tracking-widest"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2 group/input">
              <label className="text-[10px] font-black tracking-widest text-slate-300 uppercase ml-1">Confirmar Contraseña</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-amber-400 transition-colors" size={18} />
                <input
                  type="password"
                  required
                  value={confirmarPass}
                  onChange={(e) => setConfirmarPass(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:bg-white/10 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all placeholder:text-white/20 tracking-widest"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {errorPass && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-2xl text-[10px] uppercase tracking-widest font-black text-center flex items-center justify-center gap-2 animate-in shake">
                <AlertCircle size={14}/> {errorPass}
              </div>
            )}

            <button
              type="submit"
              disabled={actualizandoPassword}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-[#1A2744] py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.3)] disabled:opacity-50 disabled:active:scale-100 mt-4"
            >
              {actualizandoPassword ? <Loader2 className="animate-spin" size={18} /> : 'Guardar y Continuar'}
            </button>
          </form>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
          @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
          }
        `}} />
      </div>
    );
  }

  const hoyFormato = getHoyMerida();
  const menusAMostrar = menuHoy.filter(m => m.fecha === hoyFormato);
  const valesActivos = perfil?.tickets_restantes || 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-10 relative overflow-x-hidden" onMouseMove={handleMouseMove}>
      
      <div className="fixed top-0 left-0 w-full h-[35vh] bg-gradient-to-b from-[#1A2744] to-[#F8FAFC] -z-10 transition-transform duration-1000" style={{ transform: `translate(0px, ${parallaxY * 0.2}px)` }}></div>
      <div className="fixed top-[-10%] right-[-5%] w-[50vh] h-[50vh] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -z-10 transition-transform duration-1000" style={{ transform: `translate(${parallaxX * 0.5}px, ${parallaxY * 0.5}px)` }}></div>

      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50 shadow-sm flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-2xl rotate-3 flex items-center justify-center shadow-lg border border-slate-700/50 shrink-0 group hover:rotate-6 transition-transform duration-300">
            <UtensilsCrossed className="absolute text-white/10 w-6 h-6 -rotate-3" strokeWidth={1.5} />
            <ChefHat className="relative text-amber-400 -rotate-3 group-hover:scale-110 transition-transform duration-300" size={20} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight text-[#1A2744]">Mi Identidad</h1>
            <p className="text-amber-500 text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase">Comedor Fiscalía</p>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-100 active:scale-95 transition-all border border-red-100 group"><LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform"/></button>
      </nav>

      <div className="w-full max-w-4xl mx-auto px-4 mt-8 relative z-10">
        
        {/* IDENTIDAD EMPLEADO */}
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 mb-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left anim-fade-up" style={{animationDelay: '100ms'}}>
          <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-400 font-black text-2xl border-4 border-white shadow-lg shadow-slate-200/50 shrink-0 uppercase relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <span className="relative z-10">{perfil?.nombre_completo?.substring(0,2)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-[#1A2744] uppercase tracking-tight leading-tight truncate px-2 md:px-0" title={perfil?.nombre_completo}>{perfil?.nombre_completo}</h2>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4 mt-3">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">{perfil?.dependencia || 'Sin Área'}</p>
              <p className="text-slate-400 text-[10px] font-bold tracking-widest">{session?.user?.email}</p>
            </div>
          </div>
          <div className="bg-slate-50 px-8 py-5 rounded-[2rem] border border-slate-100 text-center shadow-inner min-w-[140px] shrink-0">
            <p className="text-4xl font-black text-[#1A2744] drop-shadow-sm mb-1">{valesActivos}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Vales Activos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* SECCIÓN QR */}
          <div className="flex flex-col h-full anim-fade-up" style={{animationDelay: '200ms'}}>
            <div className="bg-[#1A2744] rounded-[3rem] p-8 sm:p-10 text-center shadow-2xl shadow-[#1A2744]/20 border border-[#2A3F6D] relative overflow-hidden flex-1 flex flex-col group">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-[60px] group-hover:bg-blue-400/20 transition-colors duration-700"></div>
              
              <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2 relative z-10">Tu Pase Digital</h3>
              <p className="text-blue-300/70 text-[10px] font-black uppercase tracking-[0.2em] mb-10 relative z-10">Presenta este código en caja</p>
              
              <div className="relative mx-auto mt-auto mb-auto z-10 w-full max-w-[280px]">
                {valesActivos > 0 ? (
                  <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-[0_0_40px_rgba(0,0,0,0.3)] transition-transform duration-500 group-hover:scale-105 relative">
                    <div className="absolute inset-0 border-[6px] border-white/20 rounded-[2.5rem] scale-105 pointer-events-none group-hover:border-amber-400/30 transition-colors duration-500"></div>
                    <div className="w-full aspect-square bg-slate-50 flex items-center justify-center rounded-2xl overflow-hidden border border-slate-100">
                        {qrValue ? (
                          <QRCode value={qrValue} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox={`0 0 200 200`} fgColor="#1A2744" />
                        ) : (
                          <Loader2 className="animate-spin text-slate-300" size={32} />
                        )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center aspect-square shadow-inner">
                    <div className="bg-red-500/20 p-4 rounded-full mb-4 border border-red-500/30"><AlertOctagon size={40} className="text-red-400" /></div>
                    <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Cuota Agotada</p>
                    <p className="text-red-300/70 text-[9px] font-bold uppercase tracking-widest px-4">No tienes vales disponibles para canjear en este momento.</p>
                  </div>
                )}
              </div>
              
              <div className="mt-10 relative z-10">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${valesActivos > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {valesActivos > 0 ? <><CheckCircle2 size={14}/> Código Listo</> : <><X size={14}/> Inactivo</>}
                </span>
              </div>
            </div>
          </div>

          {/* SECCIÓN MENÚ DEL DÍA */}
          <div className="flex flex-col h-full anim-fade-up" style={{animationDelay: '300ms'}}>
            <div className="bg-white rounded-[3rem] p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-50">
                <div>
                  <h3 className="text-xl font-black text-[#1A2744] uppercase tracking-tight flex items-center gap-2">Menú del Día</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5"><Calendar size={12}/> {hoyFormato}</p>
                </div>
                <div className="bg-amber-50 text-amber-500 p-3 rounded-2xl shadow-sm border border-amber-100"><Utensils size={24}/></div>
              </div>

              {menusAMostrar.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                  <div className="bg-white p-4 rounded-2xl shadow-sm mb-4"><ChefHat size={32} className="text-slate-300" /></div>
                  <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">El menú de hoy no ha sido publicado aún.</p>
                </div>
              ) : (
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {menusAMostrar.map((menu, i) => {
                    const yaApartado = misReservas.some(r => r.menu_id === menu.id && r.estado === 'APARTADO');
                    const yaEntregado = misReservas.some(r => r.menu_id === menu.id && r.estado === 'CAPTURADO');
                    const agotado = menu.porciones_disponibles <= 0;

                    return (
                      <div key={i} className={`p-6 rounded-[2rem] border transition-all duration-300 group relative overflow-hidden ${yaApartado ? 'bg-blue-50 border-blue-200 shadow-md shadow-blue-500/10' : yaEntregado ? 'bg-emerald-50 border-emerald-200 opacity-70' : agotado ? 'bg-slate-50 border-slate-200 opacity-60 grayscale' : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200'}`}>
                        
                        {yaApartado && <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-bl-full pointer-events-none"></div>}
                        
                        <div className="flex justify-between items-start mb-4">
                          <span className={`text-[8px] font-black px-3 py-1 rounded-lg uppercase tracking-[0.3em] border ${yaApartado ? 'bg-blue-100 text-blue-600 border-blue-200' : yaEntregado ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{menu.tipo_comida}</span>
                          {!agotado && !yaApartado && !yaEntregado && (
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disp: <strong className="text-[#1A2744]">{menu.porciones_disponibles >= 9000 ? '∞' : menu.porciones_disponibles}</strong></span>
                          )}
                        </div>

                        <h4 className={`text-base sm:text-lg font-black uppercase leading-tight mb-5 ${yaApartado ? 'text-blue-900' : yaEntregado ? 'text-emerald-900' : agotado ? 'text-slate-500 line-through' : 'text-[#1A2744]'}`}>{menu.platillo}</h4>
                        
                        <div className="mt-auto">
                          {yaApartado ? (
                             <div className="w-full bg-white text-blue-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-blue-100 shadow-sm">
                               <CheckCircle2 size={16} className="animate-pulse"/> Apartado Listo
                             </div>
                          ) : yaEntregado ? (
                             <div className="w-full bg-white text-emerald-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-emerald-100">
                               <CheckCircle2 size={16}/> Entregado
                             </div>
                          ) : agotado ? (
                            <div className="w-full bg-slate-200 text-slate-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                               <AlertOctagon size={16}/> Agotado
                             </div>
                          ) : (
                            <button 
                              onClick={() => reservarPlatillo(menu)}
                              disabled={reservando === menu.id || valesActivos <= 0}
                              className="w-full bg-[#1A2744] text-white hover:bg-[#25365d] active:scale-95 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-md shadow-[#1A2744]/10 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
                            >
                              {reservando === menu.id ? <Loader2 className="animate-spin text-amber-400" size={16} /> : <><UtensilsCrossed size={14} className="text-amber-400"/> Apartar Platillo</>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-fade-up {
          opacity: 0;
          animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
}