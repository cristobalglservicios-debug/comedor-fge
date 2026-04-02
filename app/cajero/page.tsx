'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, FileSpreadsheet, FileText, Scan, History, ClipboardList, Camera, Search, Utensils, CheckCircle2, CalendarPlus, Trash2, ChefHat, Plus, Minus, Layers, AlertOctagon, KeyRound, ShieldCheck, UtensilsCrossed, QrCode, X, Check, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'escanear' | 'menu' | 'cocina' | 'historial' | 'reportes';

const getHoyMerida = () => {
  const fecha = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Merida"}));
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function PantallaCajero() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('escanear');
  const [inputLectura, setInputLectura] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | 'quemado' | null, texto: string, empleado?: any, hora?: string, cantidad?: number }>({ tipo: null, texto: '' });
  const [stats, setStats] = useState({ canjeadosHoy: 0, transacciones: 0 });
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [miRol, setMiRol] = useState('');
  const [usarCamara, setUsarCamara] = useState(false);
  
  const [todosMenus, setTodosMenus] = useState<any[]>([]);
  const [todasReservas, setTodasReservas] = useState<any[]>([]);
  
  const [fechaPlan, setFechaPlan] = useState(getHoyMerida());
  const [fechaMonitor, setFechaMonitor] = useState(getHoyMerida());
  const [textosPlan, setTextosPlan] = useState({ desayuno: '', almuerzo: '', cena: '' });
  const [porcionesPlan, setPorcionesPlan] = useState({ desayuno: 20, almuerzo: 30, cena: 20 });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const inicializarCajero = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/dashboard'); return; }
      
      const email = session.user.email?.toLowerCase() || '';

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('email', email)
        .maybeSingle();

      const rol = perfil?.rol || 'empleado';
      setMiRol(rol);

      if (rol !== 'cajero' && rol !== 'admin' && rol !== 'dev') {
        router.push('/');
        return;
      }

      setUserEmail(email); 
      setLoadingAcceso(false); 
      await cargarDatosDia(); 
      await cargarDatosGlobales();
      
      setTimeout(() => inputRef.current?.focus(), 500);
    };

    inicializarCajero();
    const interval = setInterval(() => { cargarDatosGlobales(); }, 5000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (!usarCamara) return;
    let html5QrCode: any = null; let escaneando = false;
    const initScanner = async () => {
      const { Html5Qrcode } = await import('html5-qrcode'); html5QrCode = new Html5Qrcode("reader");
      try {
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, (decodedText: string) => {
          if (escaneando) return; escaneando = true;
          html5QrCode.stop().then(() => { html5QrCode.clear(); setUsarCamara(false); procesarEscaneo(null, decodedText); }).catch(console.error);
        }, undefined);
      } catch (err) { console.error("Error al iniciar cámara:", err); setUsarCamara(false); }
    }; initScanner();
    return () => { if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error); } };
  }, [usarCamara]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };
  
  const cargarDatosDia = async () => {
    const hoy = getHoyMerida();
    const { data } = await supabase.from('historial_comedor').select('*').gte('fecha_hora', `${hoy}T00:00:00`).order('fecha_hora', { ascending: false });
    if (data) { setHistorial(data); setStats({ canjeadosHoy: data.length, transacciones: data.length }); }
  };

  const cargarDatosGlobales = async () => {
    const hoy = getHoyMerida();
    const ahora = new Date().toISOString(); 
    const { data: menus } = await supabase.from('menu_comedor').select('*').gte('fecha', hoy).lte('creado_en', ahora).order('fecha', { ascending: true });
    
    if (menus) {
      setTodosMenus(menus);
      if (menus.length > 0) {
        const menuIds = menus.map(m => m.id);
        const { data: reservas } = await supabase.from('reservas_comedor').select('*, menu_comedor(platillo, fecha)').in('menu_id', menuIds).order('creado_en', { ascending: false });
        if (reservas) setTodasReservas(reservas);
      } else { 
        setTodasReservas([]); 
      }
    }
  };
  
  const hoyReal = getHoyMerida();
  const reservasHoy = todasReservas.filter(r => r.menu_comedor?.fecha === hoyReal);
  const menuMonitor = todosMenus.filter(m => m.fecha === fechaMonitor);
  const reservasMonitor = todasReservas.filter(r => r.menu_comedor?.fecha === fechaMonitor);

  // LÓGICA DE ESCANEO ULTRARRÁPIDO Y SEGURIDAD ZERO-TRUST
  const procesarEscaneo = async (e?: React.FormEvent | null, codigoDirecto?: string) => {
    if (e) e.preventDefault();
    const valorDOM = codigoDirecto || inputRef.current?.value || '';
    const uidCorto = valorDOM.trim(); 
    
    if (!uidCorto) return;
    if (uidCorto.length !== 10 || !/^\d+$/.test(uidCorto)) {
        setMensaje({ tipo: 'error', texto: `CÓDIGO DEBE SER DE 10 DÍGITOS. LECTURA: "${uidCorto}"` });
        if (inputRef.current) inputRef.current.value = '';
        return;
    }

    setMensaje({ tipo: null, texto: '' }); setCargando(true);

    // 1. Buscamos el vale en la tabla temporal vales_activos
    const { data: valeActivo } = await supabase.from('vales_activos').select('*').eq('id', uidCorto).maybeSingle();

    if (!valeActivo) {
        setMensaje({ tipo: 'quemado', texto: 'CÓDIGO NO EXISTE O YA FUE COBRADO/CANCELADO.' });
        setCargando(false);
        if (inputRef.current) inputRef.current.value = '';
        return;
    }

    // 2. Buscamos al empleado en la tabla perfiles
    const { data: empleado } = await supabase.from('perfiles').select('*').eq('nombre_completo', valeActivo.nombre_empleado).maybeSingle();

    if (!empleado) { 
      setMensaje({ tipo: 'error', texto: `ERROR: PERFIL INCOMPLETO PARA ${valeActivo.nombre_empleado}` }); 
    } 
    else if (empleado.tickets_restantes < valeActivo.cantidad) { 
      setMensaje({ tipo: 'error', texto: `${empleado.nombre_completo} NO TIENE SALDO PARA ESTE VALE.` }); 
    } 
    else {
      // 3. Ejecutamos el cobro
      await supabase.from('perfiles').update({ tickets_restantes: empleado.tickets_restantes - valeActivo.cantidad, tickets_canjeado: (empleado.tickets_canjeado || 0) + valeActivo.cantidad }).eq('id', empleado.id);
      
      const registrosHistorial = Array(valeActivo.cantidad).fill({ nombre_empleado: empleado.nombre_completo, dependencia: empleado.dependencia });
      await supabase.from('historial_comedor').insert(registrosHistorial);
      
      const reservaExistente = reservasHoy.find(r => r.nombre_empleado === empleado.nombre_completo && r.estado === 'APARTADO');
      if (reservaExistente) await supabase.from('reservas_comedor').update({ estado: 'CAPTURADO' }).eq('id', reservaExistente.id);

      // 4. DESTRUIMOS EL VALE TEMPORAL PARA QUE NO LO PUEDAN CLONAR NI REUSAR
      await supabase.from('vales_activos').delete().eq('id', uidCorto);

      setMensaje({ tipo: 'exito', texto: valeActivo.cantidad > 1 ? `CANJE MÚLTIPLE OK (${valeActivo.cantidad})` : '¡VALE CANJEADO EXITOSAMENTE!', empleado, cantidad: valeActivo.cantidad, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) });
      await cargarDatosDia(); await cargarDatosGlobales();
    }
    
    setCargando(false); 
    if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
    }
  };

  const procesarPlanificador = async () => {
    setCargando(true);
    let platillosAInsertar: any[] = [];
    const extraerLineas = (texto: string, tipo: string, porcionesDefecto: number) => {
      const lineas = texto.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 2);
      lineas.forEach(linea => { const platilloLimpio = linea.replace(/^[\*\-\.\d\s]+/, ''); platillosAInsertar.push({ fecha: fechaPlan, tipo_comida: tipo, platillo: platilloLimpio, descripcion: '', porciones_totales: porcionesDefecto, porciones_disponibles: porcionesDefecto }); });
    };
    extraerLineas(textosPlan.desayuno, 'DESAYUNO', porcionesPlan.desayuno); 
    extraerLineas(textosPlan.almuerzo, 'ALMUERZO', porcionesPlan.almuerzo); 
    extraerLineas(textosPlan.cena, 'CENA', porcionesPlan.cena);

    if (textosPlan.almuerzo.trim().length > 0) {
      platillosAInsertar.push(
        { fecha: fechaPlan, tipo_comida: 'ALMUERZO', platillo: 'PECHUGA A LA PLANCHA', descripcion: '', porciones_totales: 9999, porciones_disponibles: 9999 },
        { fecha: fechaPlan, tipo_comida: 'ALMUERZO', platillo: 'PECHUGA EMPANIZADA', descripcion: '', porciones_totales: 9999, porciones_disponibles: 9999 },
        { fecha: fechaPlan, tipo_comida: 'ALMUERZO', platillo: 'MILANESA A LA YUCATECA', descripcion: '', porciones_totales: 9999, porciones_disponibles: 9999 }
      );
    }

    if (platillosAInsertar.length > 0) {
      const { error } = await supabase.from('menu_comedor').insert(platillosAInsertar);
      if (error) { alert("❌ Error al guardar."); } else { alert(`✅ Se publicaron ${platillosAInsertar.length} platillos.`);
        setTextosPlan({ desayuno: '', almuerzo: '', cena: '' }); await cargarDatosGlobales();
      }
    } else { alert("⚠️ Escribe al menos un platillo."); }
    setCargando(false);
  };

  const eliminarPlatillo = async (id: string, platillo: string) => {
    if (!confirm(`⚠️ ¿ELIMINAR "${platillo}"?`)) return; setCargando(true);
    await supabase.from('menu_comedor').delete().eq('id', id); await cargarDatosGlobales(); setCargando(false);
  };

  const ajustarPorciones = async (id: string, actualesDisp: number, actualesTotales: number, ajuste: number) => {
    const nuevasDisp = actualesDisp + ajuste;
    const nuevasTotales = actualesTotales + ajuste; if (nuevasDisp < 0) return;
    setTodosMenus(prev => prev.map(m => m.id === id ? { ...m, porciones_disponibles: nuevasDisp, porciones_totales: nuevasTotales } : m));
    await supabase.from('menu_comedor').update({ porciones_disponibles: nuevasDisp, porciones_totales: nuevasTotales }).eq('id', id);
  };

  const marcarComoCapturado = async (id: string) => { 
    await supabase.from('reservas_comedor').update({ estado: 'CAPTURADO' }).eq('id', id);
    cargarDatosGlobales(); 
  };

  const cancelarReservaCajero = async (id: string, menu_id: string, nombre_empleado: string) => {
    if (!confirm(`⚠️ ¿Seguro que deseas CANCELAR el apartado de ${nombre_empleado}? La porción será devuelta al menú.`)) return;
    setCargando(true);
    const { error: errDelete } = await supabase.from('reservas_comedor').delete().eq('id', id);
    if (!errDelete) {
      const { data: menu } = await supabase.from('menu_comedor').select('porciones_disponibles').eq('id', menu_id).single();
      if (menu) { await supabase.from('menu_comedor').update({ porciones_disponibles: menu.porciones_disponibles + 1 }).eq('id', menu_id); }
      await cargarDatosGlobales();
    } else { alert("❌ Error al cancelar la reserva."); }
    setCargando(false);
  };

  const exportarExcel = () => {
    if (historial.length === 0) return alert("No hay datos hoy");
    const data = historial.map(h => ({ Empleado: h.nombre_empleado, Dependencia: h.dependencia, Fecha_Hora: new Date(h.fecha_hora).toLocaleString('es-MX') }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Canjes"); XLSX.writeFile(wb, `Reporte_Cajero_${new Date().getTime()}.xlsx`);
  };

  const generarPDF = (tipo: 'diario' | 'semanal') => {
    const doc = new jsPDF(); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("FISCALÍA GENERAL DEL ESTADO DE YUCATÁN", 105, 20, { align: "center" }); doc.setFontSize(11);
    doc.text(`REPORTE DE COMEDOR (${tipo.toUpperCase()}) - CONTROL CAJA`, 105, 28, { align: "center" });
    autoTable(doc, { startY: 40, head: [['#', 'Empleado', 'Dependencia', 'Fecha/Hora']], body: historial.map((h, i) => [i + 1, h.nombre_empleado, h.dependencia, new Date(h.fecha_hora).toLocaleString('es-MX')]), headStyles: { fillColor: [26, 39, 68] }, });
    const finalY = (doc as any).lastAutoTable.finalY + 35; doc.setFontSize(9); doc.line(25, finalY, 90, finalY);
    doc.text("AUTORIZA", 57, finalY + 5, { align: "center" }); doc.text("M.D. JOSE MANUEL FLORES ACOSTA", 57, finalY + 10, { align: "center" });
    doc.line(120, finalY, 185, finalY); doc.text("RECIBE", 152, finalY + 5, { align: "center" });
    doc.text("KARLA XACUR TAMAYO", 152, finalY + 10, { align: "center" }); doc.save(`Corte_Cajero_${tipo}.pdf`);
  };

  if (loadingAcceso) {
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
            <p className="text-[10px] font-black tracking-[0.3em] uppercase">Autenticando Cajero...</p>
          </div>
        </div>
      </div>
    );
  }
  
  const reservasPendientes = reservasHoy.filter(r => r.estado === 'APARTADO');
  const reservasCapturadas = reservasHoy.filter(r => r.estado === 'CAPTURADO');

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-10 relative">
      
      <div className="fixed top-0 left-0 w-full h-[30vh] bg-gradient-to-b from-[#1A2744] to-[#F8FAFC] -z-10"></div>
      <div className="fixed top-[-10%] right-[-5%] w-[40vh] h-[40vh] bg-amber-500/10 rounded-full blur-[80px] pointer-events-none z-0"></div>

      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50 shadow-sm flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-2xl rotate-3 flex items-center justify-center shadow-lg border border-slate-700/50 shrink-0 group hover:rotate-6 transition-transform duration-300">
            <UtensilsCrossed className="absolute text-white/10 w-6 h-6 -rotate-3" strokeWidth={1.5} />
            <ChefHat className="relative text-amber-400 -rotate-3 group-hover:scale-110 transition-transform duration-300" size={20} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight text-[#1A2744]">Punto de Canje</h1>
            <p className="text-amber-500 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">Comedor Fiscalía</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(miRol === 'admin' || miRol === 'dev') && (
            <button 
              onClick={() => router.push('/admin')} 
              className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl active:bg-indigo-100 transition-all border border-indigo-100 active:scale-95"
              title="Ir a Administración"
            >
              <ShieldCheck size={18} />
            </button>
          )}
          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-2.5 rounded-xl active:bg-red-100 transition-all border border-red-100 active:scale-95"><LogOut size={18} /></button>
        </div>
      </nav>

      <div className="w-full max-w-5xl mx-auto px-4 mt-8 relative z-10">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 anim-fade-up" style={{animationDelay: '100ms'}}>
          <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center hover:-translate-y-1 transition-transform">
            <h2 className="text-4xl font-black text-[#1A2744] drop-shadow-sm">{stats.canjeadosHoy}</h2>
            <p className="text-amber-500 text-[9px] font-black mt-1 uppercase tracking-[0.2em]">Canjeados Hoy</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center hover:-translate-y-1 transition-transform">
            <h2 className="text-4xl font-black text-emerald-500 drop-shadow-sm">{stats.transacciones}</h2>
            <p className="text-slate-400 text-[9px] font-black mt-1 uppercase tracking-[0.2em]">Sincronizados</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center hover:-translate-y-1 transition-transform md:col-span-2 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="bg-blue-500 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/30"><ChefHat size={28} /></div>
              <div>
                <h2 className="text-3xl font-black text-[#1A2744] leading-none">{reservasPendientes.length}</h2>
                <p className="text-blue-500 text-[9px] font-black uppercase tracking-[0.2em] mt-1">Pedidos por entregar</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white overflow-hidden anim-fade-up" style={{animationDelay: '200ms'}}>
          
          <div className="flex p-3 gap-2 overflow-x-auto bg-slate-50/50 border-b border-slate-100 no-scrollbar">
            {[
              { id: 'escanear', label: 'Escanear QR', icon: <Scan size={16}/> }, 
              { id: 'menu', label: 'Pedidos Live', icon: <Utensils size={16}/> }, 
              { id: 'cocina', label: 'Monitor Cocina', icon: <ChefHat size={16}/> }, 
              { id: 'historial', label: 'Historial', icon: <History size={16}/> }, 
              { id: 'reportes', label: 'Reportes', icon: <ClipboardList size={16}/> }
            ].map((t) => (
              <button 
                key={t.id} 
                onClick={() => { setActiveTab(t.id as Tab); if(t.id === 'escanear') setTimeout(() => inputRef.current?.focus(), 100); }} 
                className={`flex-1 min-w-[130px] py-3.5 px-4 rounded-[1.2rem] font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden ${activeTab === t.id ? 'bg-[#1A2744] text-amber-400 shadow-xl shadow-[#1A2744]/20 scale-100' : 'bg-transparent text-slate-500 hover:bg-slate-100 active:scale-95'}`}
              >
                {t.icon} <span className="mt-0.5">{t.label}</span>
                {t.id === 'menu' && reservasPendientes.length > 0 && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] animate-pulse shadow-sm">{reservasPendientes.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-10 min-h-[500px]">
            
            {activeTab === 'escanear' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center mb-8 text-center">
                  <div className="bg-amber-50 text-amber-500 p-3 rounded-2xl mb-3 shadow-sm border border-amber-100"><QrCode size={24}/></div>
                  <h3 className="text-[#1A2744] font-black text-lg sm:text-xl uppercase tracking-tight">Captura de Vale</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Escanea el QR del empleado</p>
                </div>
                
                <button type="button" onClick={() => setUsarCamara(!usarCamara)} className={`w-full max-w-md mx-auto mb-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all flex justify-center items-center gap-3 active:scale-95 ${usarCamara ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-white text-[#1A2744] hover:bg-slate-50 border-2 border-slate-100'}`}><Camera size={18}/> {usarCamara ? 'Cerrar Lente' : 'Activar Cámara Trasera'}</button>
                
                {usarCamara && (
                  <div className="mb-10 p-4 border-4 border-dashed border-[#1A2744]/20 rounded-[2rem] bg-slate-50 animate-in zoom-in duration-300 max-w-md mx-auto relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#1A2744]/5 to-transparent pointer-events-none"></div>
                    <div id="reader" className="w-full overflow-hidden rounded-2xl shadow-inner"></div>
                  </div>
                )}
                
                <form onSubmit={procesarEscaneo} className="flex flex-col gap-4 relative max-w-2xl mx-auto">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 relative">
                    <div className="flex-1 relative group">
                      <input ref={inputRef} type="text" defaultValue="" className="w-full p-5 pl-14 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg font-black outline-none focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all uppercase tracking-widest text-[#1A2744] placeholder:font-normal placeholder:text-slate-300" placeholder="ESPERANDO LECTURA DEL LÁSER..." autoFocus />
                      <Scan className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={22} />
                    </div>
                    <button type="submit" disabled={cargando} className="bg-[#1A2744] hover:bg-[#25365d] active:scale-95 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-[#1A2744]/20 transition-all shrink-0 flex items-center justify-center min-w-[140px] text-[10px]">
                      {cargando ? <Loader2 className="animate-spin text-amber-400" size={20} /> : 'Procesar'}
                    </button>
                  </div>
                </form>
                
                {mensaje.tipo === 'exito' && (
                  <div className="max-w-2xl mx-auto bg-gradient-to-b from-emerald-50 to-white border border-emerald-200 rounded-[2rem] p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-500 relative overflow-hidden mt-10 shadow-[0_20px_40px_rgba(16,185,129,0.15)]">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
                    
                    {mensaje.cantidad && mensaje.cantidad > 1 && (
                      <div className="absolute top-6 right-6 bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/30 flex items-center gap-2 animate-bounce">
                        <Layers size={14}/> {mensaje.cantidad} RACIONES
                      </div>
                    )}
                    <div className="bg-emerald-500 text-white p-4 rounded-[1.5rem] mb-6 shadow-[0_0_20px_rgba(16,185,129,0.4)] relative">
                      <CheckCircle2 size={40}/>
                      <div className="absolute inset-0 rounded-[1.5rem] border-4 border-emerald-400/30 animate-ping"></div>
                    </div>
                    <h2 className="text-2xl font-black text-emerald-950 uppercase mb-2 tracking-tight">{mensaje.texto}</h2>
                    <div className="bg-white px-6 py-4 rounded-2xl border border-emerald-100 shadow-sm w-full max-w-sm mt-2">
                      <p className="text-[#1A2744] font-black text-lg uppercase leading-tight mb-1">{mensaje.empleado.nombre_completo}</p>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{mensaje.empleado.dependencia}</p>
                    </div>
                    <p className="text-emerald-600/60 text-[9px] font-black uppercase tracking-[0.3em] mt-6 flex items-center gap-1.5"><Clock size={12}/> Autorizado: {mensaje.hora}</p>
                  </div>
                )}
                {mensaje.tipo === 'quemado' && (
                  <div className="max-w-xl mx-auto bg-red-50 border-2 border-red-500/20 rounded-[2rem] p-10 flex flex-col items-center text-center animate-in shake mt-10 shadow-2xl shadow-red-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                    <div className="bg-red-100 p-4 rounded-full mb-6">
                      <AlertOctagon size={56} className="text-red-500 drop-shadow-md" />
                    </div>
                    <h2 className="text-3xl font-black text-red-950 uppercase mb-3 tracking-tighter">ERROR EN VALE</h2>
                    <p className="text-red-600 font-bold text-[11px] uppercase tracking-widest leading-relaxed max-w-sm bg-white p-4 rounded-xl border border-red-100 shadow-sm">{mensaje.texto}</p>
                  </div>
                )}
                {mensaje.tipo === 'error' && (
                  <div className="max-w-xl mx-auto bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 text-white font-black text-[11px] tracking-widest text-center animate-in fade-in uppercase mt-8 flex flex-col items-center justify-center gap-2 shadow-xl">
                    <div className="flex items-center gap-2 text-red-400 mb-1"><X size={18}/> LECTURA RECHAZADA</div>
                    <p className="text-slate-300 break-all">{mensaje.texto}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'menu' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                  <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500"><Utensils size={20}/></div>
                  <div>
                    <h3 className="text-[#1A2744] font-black text-lg uppercase tracking-tight">Dashboard Live</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Control de Pedidos y Stock (Hoy)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="flex flex-col h-full">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[10px] font-black text-[#1A2744] uppercase tracking-[0.2em] flex items-center gap-2"><CalendarPlus size={16} className="text-amber-500"/> Carga Rápida</h4>
                      </div>
                      <div className="flex flex-col gap-4">
                        <input type="date" value={fechaPlan} onChange={e => setFechaPlan(e.target.value)} className="p-4 rounded-xl border border-slate-200 text-sm font-black text-[#1A2744] uppercase outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 w-full transition-all" />
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Desayunos</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Stock:</span>
                              <input type="number" min="1" value={porcionesPlan.desayuno} onChange={e => setPorcionesPlan({...porcionesPlan, desayuno: parseInt(e.target.value)||0})} className="w-14 p-1.5 text-xs font-black text-[#1A2744] text-center border border-slate-200 rounded-lg focus:border-amber-400 outline-none" />
                            </div>
                          </div>
                          <textarea rows={2} placeholder="Ej: Huevo a la Mexicana..." value={textosPlan.desayuno} onChange={e => setTextosPlan({...textosPlan, desayuno: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200 text-xs font-bold uppercase outline-none focus:border-amber-400 resize-none placeholder:font-normal" />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Almuerzos</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Stock:</span>
                              <input type="number" min="1" value={porcionesPlan.almuerzo} onChange={e => setPorcionesPlan({...porcionesPlan, almuerzo: parseInt(e.target.value)||0})} className="w-14 p-1.5 text-xs font-black text-[#1A2744] text-center border border-slate-200 rounded-lg focus:border-amber-400 outline-none" />
                            </div>
                          </div>
                          <textarea rows={3} placeholder="Ej: Mondongo Andaluza..." value={textosPlan.almuerzo} onChange={e => setTextosPlan({...textosPlan, almuerzo: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200 text-xs font-bold uppercase outline-none focus:border-amber-400 resize-none placeholder:font-normal" />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cenas</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Stock:</span>
                              <input type="number" min="1" value={porcionesPlan.cena} onChange={e => setPorcionesPlan({...porcionesPlan, cena: parseInt(e.target.value)||0})} className="w-14 p-1.5 text-xs font-black text-[#1A2744] text-center border border-slate-200 rounded-lg focus:border-amber-400 outline-none" />
                            </div>
                          </div>
                          <textarea rows={2} placeholder="Ej: Sopa Fria..." value={textosPlan.cena} onChange={e => setTextosPlan({...textosPlan, cena: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200 text-xs font-bold uppercase outline-none focus:border-amber-400 resize-none placeholder:font-normal" />
                        </div>

                        <button onClick={procesarPlanificador} disabled={cargando} className="w-full bg-[#1A2744] hover:bg-[#25365d] active:scale-95 text-white p-5 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-xl shadow-[#1A2744]/20 mt-2">
                          {cargando ? <Loader2 className="animate-spin text-amber-400" size={16}/> : 'Publicar Menú del Día'}
                        </button>
                      </div>
                    </div>

                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Stock Activo (Hoy)</h4>
                    <div className="space-y-3">
                      {todosMenus.filter(m => m.fecha === hoyReal).map((m, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center group hover:border-amber-200 transition-colors">
                          <div className="flex-1 pr-2">
                            <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-[0.2em]">{m.tipo_comida}</span>
                            <p className="font-black text-[#1A2744] text-xs mt-2 uppercase leading-tight">{m.platillo}</p>
                          </div>
                          <div className="flex items-center gap-1 mx-2 shrink-0 border border-slate-100 rounded-xl p-1 bg-slate-50">
                            <button onClick={() => ajustarPorciones(m.id, m.porciones_disponibles, m.porciones_totales, -1)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Minus size={14}/></button>
                            <div className="w-8 text-center"><p className="text-sm font-black text-[#1A2744]">{m.porciones_disponibles >= 9000 ? '∞' : m.porciones_disponibles}</p></div>
                            <button onClick={() => ajustarPorciones(m.id, m.porciones_disponibles, m.porciones_totales, 1)} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"><Plus size={14}/></button>
                          </div>
                          <button onClick={() => eliminarPlatillo(m.id, m.platillo)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors ml-1 active:scale-90" title="Eliminar Platillo"><Trash2 size={18} /></button>
                        </div>
                      ))}
                      {todosMenus.filter(m => m.fecha === hoyReal).length === 0 && (
                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Stock Vacío</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col h-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
                    
                    <h4 className="text-[10px] font-black text-[#1A2744] uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"></div> 
                      Fila de Entregas
                    </h4>
                    
                    <div className="space-y-4 flex-1 overflow-y-auto pr-2 min-h-[300px] mb-8 relative z-10 no-scrollbar">
                      {reservasPendientes.map((r, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-blue-100 shadow-[0_10px_20px_rgba(59,130,246,0.05)] flex justify-between items-center animate-in fade-in slide-in-from-right-4">
                          <div className="flex-1 pr-4">
                            <p className="font-black text-[#1A2744] text-xs uppercase truncate leading-tight mb-1">{r.nombre_empleado}</p>
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5"><Utensils size={10}/> {r.menu_comedor?.platillo}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <button onClick={() => marcarComoCapturado(r.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-600/30 active:scale-95 transition-all w-full flex items-center justify-center gap-1">Entregar <Check size={12}/></button>
                            <button onClick={() => cancelarReservaCajero(r.id, r.menu_id, r.nombre_empleado)} className="text-slate-400 hover:text-red-500 text-[9px] font-black uppercase tracking-widest px-2 active:scale-95 transition-colors">Cancelar</button>
                          </div>
                        </div>
                      ))}
                      {reservasPendientes.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                          <div className="bg-white p-4 rounded-full mb-4 shadow-sm border border-slate-100"><CheckCircle2 size={32} className="text-emerald-400"/></div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Fila Limpia</p>
                        </div>
                      )}
                    </div>
                    
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 relative z-10 pt-6 border-t border-slate-200">Historial Entregas (Hoy)</h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 relative z-10 no-scrollbar">
                      {reservasCapturadas.map((r, i) => (
                        <div key={i} className="bg-white p-3.5 rounded-xl border border-slate-100 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity">
                          <div className="flex-1 min-w-0 pr-2">
                              <p className="font-bold text-[#1A2744] text-[9px] uppercase truncate">{r.nombre_empleado}</p>
                              <p className="text-[8px] font-black text-slate-400 uppercase truncate mt-0.5">{r.menu_comedor?.platillo}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 uppercase tracking-widest">OK</span>
                              <CheckCircle2 size={14} className="text-emerald-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cocina' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-500"><ChefHat size={20}/></div>
                    <div>
                      <h3 className="text-[#1A2744] font-black text-lg uppercase tracking-tight">Monitor Pantalla</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Vista para el área de cocina</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl shadow-inner border border-slate-200">
                    <CalendarPlus size={16} className="text-indigo-500 ml-1" />
                    <input type="date" value={fechaMonitor} onChange={(e) => setFechaMonitor(e.target.value)} className="text-[10px] font-black text-[#1A2744] uppercase tracking-widest outline-none bg-transparent cursor-pointer" min={hoyReal} />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {menuMonitor.map((m) => {
                    const apartados = reservasMonitor.filter((r) => r.menu_id === m.id && r.estado === 'APARTADO');
                    const entregados = reservasMonitor.filter((r) => r.menu_id === m.id && r.estado === 'CAPTURADO');
                    return (
                      <div key={m.id} className="bg-white/80 backdrop-blur-md p-8 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-100 to-transparent rounded-bl-full opacity-50"></div>
                        <span className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.3em] mb-4 w-max">{m.tipo_comida}</span>
                        <h4 className="text-[#1A2744] font-black text-xl uppercase leading-tight mb-8 relative z-10">{m.platillo}</h4>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-center shadow-sm">
                              <p className="text-3xl font-black text-blue-600">{apartados.length}</p>
                              <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1">Fuego</p>
                          </div>
                          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 text-center shadow-sm">
                              <p className="text-3xl font-black text-emerald-600">{entregados.length}</p>
                              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1">Salieron</p>
                          </div>
                        </div>
                        
                        <div className="text-center bg-[#1A2744] p-4 rounded-2xl relative z-10 shadow-lg mt-auto">
                          <p className="text-3xl font-black text-amber-400">{m.porciones_disponibles >= 9000 ? '∞' : m.porciones_disponibles}</p>
                          <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mt-1">Stock Libre</p>
                        </div>
                      </div>
                    );
                  })}
                  {menuMonitor.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-[3rem] border border-slate-100">
                      <div className="bg-white p-5 rounded-[2rem] shadow-sm mb-4"><ChefHat size={40} className="text-slate-300" /></div>
                      <p className="text-[11px] font-black uppercase tracking-[0.3em]">Sin menú programado</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'historial' && (
              <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                  <div className="bg-slate-100 p-2.5 rounded-xl text-slate-500"><History size={20}/></div>
                  <div>
                    <h3 className="text-[#1A2744] font-black text-lg uppercase tracking-tight">Registro de Entradas</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Todos los canjes del día ({historial.length})</p>
                  </div>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-4 no-scrollbar">
                  {historial.map((h, i) => (
                    <div key={i} className="flex justify-between items-center p-5 bg-white rounded-[1.5rem] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-slate-200 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs border border-slate-100">{i+1}</div>
                        <div>
                          <p className="font-black text-sm text-[#1A2744] uppercase">{h.nombre_empleado}</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{h.dependencia}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-[#6366F1] uppercase">{new Date(h.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                        <span className="inline-block mt-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 text-[8px] font-black uppercase tracking-widest">Validado</span>
                      </div>
                    </div>
                  ))}
                  {historial.length === 0 && (
                    <div className="py-20 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No hay registros hoy</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'reportes' && (
              <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-10 border-b border-slate-100 pb-4">
                  <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-500"><ClipboardList size={20}/></div>
                  <div>
                    <h3 className="text-[#1A2744] font-black text-lg uppercase tracking-tight">Cortes y Auditoría</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Generación de documentación oficial</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <button onClick={exportarExcel} className="group flex flex-col items-center justify-center p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1)] hover:border-emerald-200 transition-all duration-300">
                    <div className="bg-emerald-50 text-emerald-500 p-5 rounded-[1.5rem] mb-6 group-hover:scale-110 transition-transform duration-300"><FileSpreadsheet size={40} strokeWidth={1.5}/></div>
                    <span className="font-black text-[#1A2744] text-xs uppercase tracking-widest mb-1">Data Excel</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Base en crudo</span>
                  </button>
                  
                  <button onClick={() => generarPDF('diario')} className="group flex flex-col items-center justify-center p-10 bg-[#1A2744] border border-[#2A3F6D] rounded-[2.5rem] shadow-[0_10px_30px_rgba(26,39,68,0.2)] hover:shadow-[0_20px_40px_rgba(26,39,68,0.4)] hover:bg-[#2A3F6D] transition-all duration-300 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="bg-blue-500/20 text-blue-400 p-5 rounded-[1.5rem] mb-6 group-hover:scale-110 transition-transform duration-300 border border-blue-500/30 relative z-10"><FileText size={40} strokeWidth={1.5}/></div>
                    <span className="font-black text-white text-xs uppercase tracking-widest mb-1 relative z-10">Corte Diario</span>
                    <span className="text-[9px] text-blue-300/70 font-bold uppercase tracking-widest relative z-10">PDF Oficial</span>
                  </button>

                  <button onClick={() => generarPDF('semanal')} className="group flex flex-col items-center justify-center p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(251,191,36,0.1)] hover:border-amber-200 transition-all duration-300">
                    <div className="bg-amber-50 text-amber-500 p-5 rounded-[1.5rem] mb-6 group-hover:scale-110 transition-transform duration-300"><FileText size={40} strokeWidth={1.5}/></div>
                    <span className="font-black text-[#1A2744] text-xs uppercase tracking-widest mb-1">Concentrado</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Semanal PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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