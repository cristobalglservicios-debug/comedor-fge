'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, FileSpreadsheet, FileText, Scan, History, ClipboardList, Camera, Search, Utensils, CheckCircle2, CalendarPlus, Trash2, ChefHat, Plus, Minus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'escanear' | 'menu' | 'cocina' | 'historial' | 'reportes';

// FUNCIÓN PARA OBTENER LA FECHA REAL EN MÉRIDA
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
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | null, texto: string, empleado?: any, hora?: string }>({ tipo: null, texto: '' });
  const [stats, setStats] = useState({ canjeadosHoy: 0, transacciones: 0 });
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [usarCamara, setUsarCamara] = useState(false);
  const [directorio, setDirectorio] = useState<any[]>([]);
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  
  // ESTADOS GLOBALES DE MENÚS (HOY Y FUTUROS)
  const [todosMenus, setTodosMenus] = useState<any[]>([]);
  const [todasReservas, setTodasReservas] = useState<any[]>([]);
  
  // ESTADOS DEL PLANIFICADOR Y MONITOR
  const [fechaPlan, setFechaPlan] = useState(getHoyMerida());
  const [fechaMonitor, setFechaMonitor] = useState(getHoyMerida());
  const [textosPlan, setTextosPlan] = useState({ desayuno: '', almuerzo: '', cena: '' });
  const [porcionesPlan, setPorcionesPlan] = useState({ desayuno: 20, almuerzo: 30, cena: 20 });

  useEffect(() => {
    const inicializarCajero = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/dashboard'); return; }
      const email = session.user.email?.toLowerCase() || '';
      if (!email.includes('comedor') && !email.includes('cajero') && !email.includes('admin')) { router.push('/'); return; }
      setUserEmail(email); setLoadingAcceso(false); await cargarDatosDia(); await cargarDatosGlobales();
      const { data: perfiles } = await supabase.from('perfiles').select('nombre_completo, dependencia, tickets_restantes');
      if (perfiles) setDirectorio(perfiles);
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
          html5QrCode.stop().then(() => { html5QrCode.clear(); setUsarCamara(false); setInputLectura(decodedText); procesarEscaneo(null, decodedText); }).catch(console.error);
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
    // Traemos HOY y FUTUROS
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

  const manejarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase(); setInputLectura(val);
    if (val.length >= 3) { const resultados = directorio.filter(p => p.nombre_completo.includes(val)).slice(0, 5); setSugerencias(resultados); } else { setSugerencias([]); }
  };
  
  const seleccionarSugerencia = (nombre: string) => { setSugerencias([]); setInputLectura(nombre); procesarEscaneo(null, nombre); };
  
  const inputRef = useRef<HTMLInputElement>(null);

  // DERIVADOS PARA EL DÍA DE HOY (Escáner y Live)
  const hoyReal = getHoyMerida();
  const menuHoy = todosMenus.filter(m => m.fecha === hoyReal);
  const reservasHoy = todasReservas.filter(r => r.menu_comedor?.fecha === hoyReal);

  // DERIVADOS PARA EL MONITOR DE COCINA
  const menuMonitor = todosMenus.filter(m => m.fecha === fechaMonitor);
  const reservasMonitor = todasReservas.filter(r => r.menu_comedor?.fecha === fechaMonitor);

  const procesarEscaneo = async (e?: React.FormEvent | null, codigoDirecto?: string) => {
    if (e) e.preventDefault();
    const nombreEscaneado = (codigoDirecto || inputLectura).trim().toUpperCase(); if (!nombreEscaneado) return;
    setSugerencias([]); setCargando(true); setMensaje({ tipo: null, texto: '' });
    const { data: empleado } = await supabase.from('perfiles').select('*').eq('nombre_completo', nombreEscaneado).maybeSingle();

    if (!empleado) { setMensaje({ tipo: 'error', texto: `NO SE ENCONTRÓ: ${nombreEscaneado}` }); } 
    else if (empleado.tickets_restantes <= 0) { setMensaje({ tipo: 'error', texto: `${empleado.nombre_completo} SIN VALES DISPONIBLES.` }); } 
    else {
      const { error: errorUpdate } = await supabase.from('perfiles').update({ tickets_restantes: empleado.tickets_restantes - 1, tickets_canjeado: (empleado.tickets_canjeado || 0) + 1 }).eq('id', empleado.id);
      if (!errorUpdate) {
        await supabase.from('historial_comedor').insert({ nombre_empleado: empleado.nombre_completo, dependencia: empleado.dependencia });
        
        const reservaExistente = reservasHoy.find(r => r.nombre_empleado === empleado.nombre_completo && r.estado === 'APARTADO');
        
        if (reservaExistente) {
            await supabase.from('reservas_comedor').update({ estado: 'CAPTURADO' }).eq('id', reservaExistente.id);
        }

        const textoExito = reservaExistente ? `¡VALE CANJEADO! (PLATILLO: ${reservaExistente.menu_comedor?.platillo})` : '¡VALE CANJEADO!';
        setMensaje({ tipo: 'exito', texto: textoExito, empleado: empleado, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) });
        await cargarDatosDia();
        await cargarDatosGlobales();
        setDirectorio(prev => prev.map(p => p.nombre_completo === empleado.nombre_completo ? { ...p, tickets_restantes: p.tickets_restantes - 1 } : p));
      } else { setMensaje({ tipo: 'error', texto: 'ERROR AL ACTUALIZAR.' }); }
    }
    setCargando(false);
    setInputLectura(''); if (!usarCamara) inputRef.current?.focus();
  };

  const procesarPlanificador = async () => {
    setCargando(true);
    let platillosAInsertar: any[] = [];
    const extraerLineas = (texto: string, tipo: string, porcionesDefecto: number) => {
      const lineas = texto.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 2);
      lineas.forEach(linea => { const platilloLimpio = linea.replace(/^[\*\-\.\d\s]+/, ''); platillosAInsertar.push({ fecha: fechaPlan, tipo_comida: tipo, platillo: platilloLimpio, descripcion: '', porciones_totales: porcionesDefecto, porciones_disponibles: porcionesDefecto }); });
    };
    extraerLineas(textosPlan.desayuno, 'DESAYUNO', porcionesPlan.desayuno); extraerLineas(textosPlan.almuerzo, 'ALMUERZO', porcionesPlan.almuerzo); extraerLineas(textosPlan.cena, 'CENA', porcionesPlan.cena);
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

  if (loadingAcceso) return <div className="min-h-screen bg-[#F0F3F6] flex items-center justify-center"><Loader2 className="animate-spin text-[#1A2744]" size={40} /></div>;
  
  const reservasPendientes = reservasHoy.filter(r => r.estado === 'APARTADO');
  const reservasCapturadas = reservasHoy.filter(r => r.estado === 'CAPTURADO');

  return (
    <div className="min-h-screen bg-[#F0F3F6] font-sans pb-10">
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8 relative z-50">
        <div className="flex items-center gap-4"><div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center shrink-0"><img src="/logo-fge.png" alt="FGE" className="w-full h-full object-contain rounded-full" /></div><div><h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight">Punto de Canje</h1><p className="text-[#C9A84C] text-[9px] md:text-xs font-bold tracking-widest uppercase">Fiscalía General</p></div></div>
        <button onClick={handleLogout} className="bg-white/10 p-2 rounded-xl hover:bg-red-500 transition-all border border-white/5"><LogOut size={18} /></button>
      </nav>

      <div className="w-full max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center"><h2 className="text-4xl font-black text-[#6366F1]">{stats.canjeadosHoy}</h2><p className="text-slate-400 text-xs font-medium mt-1 uppercase tracking-tighter">Canjeados hoy</p></div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center"><h2 className="text-4xl font-black text-emerald-500">{stats.transacciones}</h2><p className="text-slate-400 text-xs font-medium mt-1 uppercase tracking-tighter">Sincronizados</p></div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex bg-slate-50/50 p-2 gap-2 overflow-x-auto">
            {[{ id: 'escanear', label: 'Escanear', icon: <Scan size={18}/> }, { id: 'menu', label: 'Pedidos Live', icon: <Utensils size={18}/> }, { id: 'cocina', label: 'Monitor Cocina', icon: <ChefHat size={18}/> }, { id: 'historial', label: 'Historial', icon: <History size={18}/> }, { id: 'reportes', label: 'Reportes', icon: <ClipboardList size={18}/> }].map((t) => (
              <button key={t.id} onClick={() => { setActiveTab(t.id as Tab); if(t.id === 'escanear') setTimeout(() => inputRef.current?.focus(), 100); }} className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeTab === t.id ? 'bg-[#6366F1] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t.icon} {t.label} {t.id === 'menu' && reservasPendientes.length > 0 && (<span className="bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[9px] animate-pulse absolute top-2 right-2 md:static">{reservasPendientes.length}</span>)}
              </button>
            ))}
          </div>

          {activeTab === 'escanear' && (
            <div className="p-8 animate-fade-in">
              <h3 className="text-[#1A2744] font-bold text-sm sm:text-base mb-4">Captura de Vale</h3>
              <button type="button" onClick={() => setUsarCamara(!usarCamara)} className={`w-full mb-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-sm transition-all flex justify-center items-center gap-3 ${usarCamara ? 'bg-red-50 text-white' : 'bg-slate-100 text-[#1A2744] hover:bg-slate-200 border-2 border-slate-200'}`}><Camera size={20}/> {usarCamara ? 'Cerrar Cámara' : 'Abrir Cámara del Celular'}</button>
              {usarCamara && (<div className="mb-8 p-4 border-2 border-dashed border-[#6366F1]/40 rounded-3xl bg-slate-50 animate-fade-in"><div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl"></div></div>)}
              <form onSubmit={procesarEscaneo} className="flex flex-col gap-4 relative">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 relative">
                  <div className="flex-1 relative">
                    <input ref={inputRef} type="text" value={inputLectura} onChange={manejarInput} className="w-full p-4 pl-12 border-2 border-[#6366F1]/40 rounded-2xl text-lg font-bold outline-none focus:border-[#6366F1] transition-colors uppercase tracking-widest" placeholder="Nombre o Código..." autoFocus />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    {sugerencias.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100">
                        {sugerencias.map((s, i) => (
                          <div key={i} onClick={() => seleccionarSugerencia(s.nombre_completo)} className="p-4 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors">
                            <div><p className="font-black text-sm text-[#1A2744] uppercase">{s.nombre_completo}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{s.dependencia}</p></div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${s.tickets_restantes > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{s.tickets_restantes} Vales</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={cargando} className="bg-[#6366F1] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all shrink-0">{cargando ? <Loader2 className="animate-spin" size={20} /> : 'Validar'}</button>
                </div>
              </form>
              <p className="text-slate-400 text-[10px] mt-3 mb-8 text-center sm:text-left">Si la cámara falla, teclea 3 letras del nombre y selecciónalo de la lista.</p>
              {mensaje.tipo === 'exito' && (<div className="bg-emerald-50 border-2 border-emerald-500/20 rounded-3xl p-8 flex flex-col items-center text-center animate-fade-in"><div className="bg-emerald-500 text-white p-3 rounded-full mb-4 shadow-lg"><CheckCircle2 size={32}/></div><h2 className="text-xl sm:text-2xl font-black text-[#1A2744] uppercase mb-1">{mensaje.texto}</h2><p className="text-slate-700 font-bold text-lg">{mensaje.empleado.nombre_completo}</p><p className="text-slate-400 text-xs font-bold uppercase mt-1">{mensaje.empleado.dependencia} — {mensaje.hora}</p></div>)}
              {mensaje.tipo === 'error' && (<div className="bg-red-50 border-2 border-red-200 rounded-3xl p-6 text-red-600 font-black text-center animate-fade-in uppercase">❌ {mensaje.texto}</div>)}
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="p-8 animate-fade-in">
              <h3 className="text-[#1A2744] font-bold text-sm sm:text-base mb-6 border-b pb-4">Dashboard Live: Pedidos y Menú (HOY)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><CalendarPlus size={14}/> Carga Rápida (Copiar y Pegar)</h4></div>
                    <div className="flex flex-col gap-3">
                      <input type="date" value={fechaPlan} onChange={e => setFechaPlan(e.target.value)} className="p-3 rounded-xl border border-slate-200 text-sm font-bold uppercase outline-none focus:border-[#6366F1] w-full" />
                      <div><div className="flex justify-between items-center mb-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Desayunos</label><div className="flex items-center gap-1"><span className="text-[9px] font-bold text-slate-400">P/D:</span><input type="number" min="1" value={porcionesPlan.desayuno} onChange={e => setPorcionesPlan({...porcionesPlan, desayuno: parseInt(e.target.value)||0})} className="w-12 p-1 text-xs text-center border border-slate-200 rounded-md focus:border-[#6366F1] outline-none" title="Porciones por defecto" /></div></div><textarea rows={2} placeholder="Ej: Huevo a la Mexicana..." value={textosPlan.desayuno} onChange={e => setTextosPlan({...textosPlan, desayuno: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-xs uppercase outline-none focus:border-[#6366F1] resize-none" /></div>
                      <div><div className="flex justify-between items-center mb-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Almuerzos</label><div className="flex items-center gap-1"><span className="text-[9px] font-bold text-slate-400">P/D:</span><input type="number" min="1" value={porcionesPlan.almuerzo} onChange={e => setPorcionesPlan({...porcionesPlan, almuerzo: parseInt(e.target.value)||0})} className="w-12 p-1 text-xs text-center border border-slate-200 rounded-md focus:border-[#6366F1] outline-none" title="Porciones por defecto" /></div></div><textarea rows={3} placeholder="Ej: Mondongo Andaluza..." value={textosPlan.almuerzo} onChange={e => setTextosPlan({...textosPlan, almuerzo: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-xs uppercase outline-none focus:border-[#6366F1] resize-none" /></div>
                      <div><div className="flex justify-between items-center mb-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Cenas</label><div className="flex items-center gap-1"><span className="text-[9px] font-bold text-slate-400">P/D:</span><input type="number" min="1" value={porcionesPlan.cena} onChange={e => setPorcionesPlan({...porcionesPlan, cena: parseInt(e.target.value)||0})} className="w-12 p-1 text-xs text-center border border-slate-200 rounded-md focus:border-[#6366F1] outline-none" title="Porciones por defecto" /></div></div><textarea rows={2} placeholder="Ej: Sopa Fria..." value={textosPlan.cena} onChange={e => setTextosPlan({...textosPlan, cena: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-xs uppercase outline-none focus:border-[#6366F1] resize-none" /></div>
                      <button onClick={procesarPlanificador} disabled={cargando} className="w-full bg-[#1A2744] hover:bg-slate-800 text-white p-3 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-md mt-2">{cargando ? <Loader2 className="animate-spin" size={16}/> : 'Publicar Día'}</button>
                    </div>
                  </div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Platillos Activos (Día de Hoy)</h4>
                  <div className="space-y-3">
                    {menuHoy.map((m, i) => (
                      <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center">
                        <div className="flex-1 pr-2"><span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">{m.tipo_comida}</span><p className="font-black text-[#1A2744] text-xs mt-1 uppercase leading-tight">{m.platillo}</p></div>
                        <div className="flex items-center gap-1 mx-2 shrink-0 border border-slate-100 rounded-xl p-1 bg-slate-50"><button onClick={() => ajustarPorciones(m.id, m.porciones_disponibles, m.porciones_totales, -1)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Minus size={14}/></button><div className="w-6 text-center"><p className="text-sm font-black text-[#6366F1]">{m.porciones_disponibles}</p></div><button onClick={() => ajustarPorciones(m.id, m.porciones_disponibles, m.porciones_totales, 1)} className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"><Plus size={14}/></button></div>
                        <button onClick={() => eliminarPlatillo(m.id, m.platillo)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1" title="Eliminar Platillo"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    {menuHoy.length === 0 && <p className="text-[10px] text-slate-400 text-center py-4 border border-dashed rounded-xl">Sin menú publicado hoy.</p>}
                  </div>
                </div>

                <div className="flex flex-col h-full">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div> Pendientes de Entregar (Hoy)</h4>
                  <div className="space-y-3 flex-1 overflow-y-auto pr-2 min-h-[250px] mb-6">
                    {reservasPendientes.map((r, i) => (
                      <div key={i} className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-400 shadow-md flex justify-between items-center animate-in fade-in slide-in-from-left-4">
                        <div className="flex-1 pr-2">
                          <p className="font-black text-[#1A2744] text-xs uppercase truncate">{r.nombre_empleado}</p>
                          <p className="text-[10px] font-black text-blue-700 uppercase mt-1">🍽 {r.menu_comedor?.platillo}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => marcarComoCapturado(r.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-wider shadow-md active:scale-95 transition-all">Entregado</button>
                          <button onClick={() => cancelarReservaCajero(r.id, r.menu_id, r.nombre_empleado)} className="bg-red-50 hover:bg-red-500 text-red-600 hover:text-white px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-wider shadow-sm active:scale-95 transition-all border border-red-200 hover:border-red-500" title="Cancelar y regresar porción al menú">Cancelar</button>
                        </div>
                      </div>
                    ))}
                    {reservasPendientes.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-3xl p-6"><CheckCircle2 size={32} className="mb-2 opacity-50"/><p className="text-xs font-bold uppercase tracking-widest">Todo entregado</p></div>)}
                  </div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Platillos ya entregados</h4>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 opacity-60">
                    {reservasCapturadas.map((r, i) => (
                      <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#1A2744] text-[10px] uppercase truncate">{r.nombre_empleado}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase truncate">{r.menu_comedor?.platillo}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">Entregado</span>
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cocina' && (
            <div className="p-8 animate-fade-in">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-[#1A2744] font-bold text-sm sm:text-base">Monitor Cocina</h3>
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                  <CalendarPlus size={16} className="text-[#6366F1]" />
                  <input 
                    type="date" 
                    value={fechaMonitor} 
                    onChange={(e) => setFechaMonitor(e.target.value)} 
                    className="text-xs font-bold text-[#1A2744] uppercase outline-none bg-transparent"
                    min={hoyReal}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuMonitor.map((m) => {
                  const apartados = reservasMonitor.filter((r) => r.menu_id === m.id && r.estado === 'APARTADO');
                  const entregados = reservasMonitor.filter((r) => r.menu_id === m.id && r.estado === 'CAPTURADO');
                  return (
                    <div key={m.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.tipo_comida}</span>
                      <h4 className="text-[#1A2744] font-black text-lg uppercase leading-tight mb-6">{m.platillo}</h4>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-center">
                            <p className="text-2xl font-black text-blue-600">{apartados.length}</p>
                            <p className="text-[8px] font-bold text-blue-400 uppercase">Por Entregar</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 text-center">
                            <p className="text-2xl font-black text-emerald-600">{entregados.length}</p>
                            <p className="text-[8px] font-bold text-emerald-400 uppercase">Entregados</p>
                        </div>
                      </div>
                      <div className="text-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <p className="text-2xl font-black text-slate-600">{m.porciones_disponibles}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Stock Libre</p>
                      </div>
                    </div>
                  );
                })}
                {menuMonitor.length === 0 && (<div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-3xl"><ChefHat size={40} className="mb-4 opacity-50" /><p className="text-xs font-bold uppercase tracking-widest">Sin menú para esta fecha</p></div>)}
              </div>
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="p-8 animate-fade-in">
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-6 border-b pb-4">Canjes realizados hoy</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {historial.map((h, i) => (<div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100"><div><p className="font-black text-xs text-[#1A2744] uppercase">{h.nombre_empleado}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{h.dependencia}</p></div><p className="text-[10px] font-black text-[#6366F1]">{new Date(h.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p></div>))}
              </div>
            </div>
          )}

          {activeTab === 'reportes' && (
            <div className="p-8 animate-fade-in">
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-8">Auditoría y Cierres</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={exportarExcel} className="flex flex-col items-center justify-center p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] text-emerald-600 hover:bg-emerald-100 transition-all gap-2"><FileSpreadsheet size={32}/><span className="font-black text-[10px] uppercase">Excel</span></button>
                <button onClick={() => generarPDF('diario')} className="flex flex-col items-center justify-center p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] text-blue-600 hover:bg-blue-100 transition-all gap-2"><FileText size={32}/><span className="font-black text-[10px] uppercase">PDF Diario</span></button>
                <button onClick={() => generarPDF('semanal')} className="flex flex-col items-center justify-center p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] text-amber-600 hover:bg-amber-100 transition-all gap-2"><FileText size={32}/><span className="font-black text-[10px] uppercase">PDF Semanal</span></button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }`}} />
    </div>
  );
}