'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, FileSpreadsheet, FileText, Scan, History, ClipboardList, Camera } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'escanear' | 'historial' | 'reportes';

export default function PantallaCajero() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('escanear');
  const [inputLectura, setInputLectura] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error' | null, texto: string, empleado?: any, hora?: string }>({ tipo: null, texto: '' });
  const [stats, setStats] = useState({ canjeadosHoy: 0, transacciones: 0 });
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  const [usarCamara, setUsarCamara] = useState(false);

  useEffect(() => {
    const inicializarCajero = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/dashboard'); return; }

      const email = session.user.email?.toLowerCase() || '';
      if (!email.includes('comedor') && !email.includes('cajero') && !email.includes('admin')) {
        router.push('/');
        return;
      }

      setUserEmail(email);
      setLoadingAcceso(false);
      await cargarDatosDia();
      setTimeout(() => inputRef.current?.focus(), 500);
    };
    inicializarCajero();
  }, [router]);

  // MOTOR DEL ESCÁNER DE CÁMARA (Bloqueo Anti-Doble Escaneo)
  useEffect(() => {
    if (!usarCamara) return;
    let scanner: any = null;
    let escaneando = false;

    const initScanner = async () => {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 } 
      }, false);
      
      scanner.render(
        (decodedText: string) => {
          if (escaneando) return; // Evita que lea 2 veces seguidas
          escaneando = true;

          scanner.clear().catch(console.error);
          setUsarCamara(false);
          setInputLectura(decodedText);
          procesarEscaneo(null, decodedText);
        },
        (err: any) => { /* errores silenciosos */ }
      );
    };

    initScanner();

    return () => {
      if (scanner) scanner.clear().catch(console.error);
    };
  }, [usarCamara]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const cargarDatosDia = async () => {
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('historial_comedor')
      .select('*')
      .gte('fecha_hora', `${hoy}T00:00:00`)
      .order('fecha_hora', { ascending: false });

    if (data) {
      setHistorial(data);
      setStats({ canjeadosHoy: data.length, transacciones: data.length });
    }
  };

  const procesarEscaneo = async (e?: React.FormEvent | null, codigoDirecto?: string) => {
    if (e) e.preventDefault();
    const nombreEscaneado = (codigoDirecto || inputLectura).trim().toUpperCase();
    if (!nombreEscaneado) return;

    setCargando(true);
    setMensaje({ tipo: null, texto: '' });

    const { data: empleado } = await supabase
      .from('perfiles')
      .select('*')
      .eq('nombre_completo', nombreEscaneado)
      .maybeSingle();

    if (!empleado) {
      setMensaje({ tipo: 'error', texto: `NO SE ENCONTRÓ: ${nombreEscaneado}` });
    } else if (empleado.tickets_restantes <= 0) {
      setMensaje({ tipo: 'error', texto: `${empleado.nombre_completo} SIN VALES DISPONIBLES.` });
    } else {
      
      const { error: errorUpdate } = await supabase
        .from('perfiles')
        .update({ 
          tickets_restantes: empleado.tickets_restantes - 1,
          tickets_canjeado: (empleado.tickets_canjeado || 0) + 1 
        })
        .eq('id', empleado.id);

      if (!errorUpdate) {
        // AQUÍ ESTABA EL ERROR: Regresamos a la estructura original de tu base de datos
        await supabase.from('historial_comedor').insert({
          nombre_empleado: empleado.nombre_completo,
          dependencia: empleado.dependencia
        });

        setMensaje({ 
          tipo: 'exito', 
          texto: '¡VALE CANJEADO!', 
          empleado: empleado,
          hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        });
        
        // Refrescar los números de la pantalla
        await cargarDatosDia();
      } else {
        setMensaje({ tipo: 'error', texto: 'ERROR AL ACTUALIZAR.' });
      }
    }
    setCargando(false);
    setInputLectura('');
    if (!usarCamara) inputRef.current?.focus();
  };

  const exportarExcel = () => {
    if (historial.length === 0) return alert("No hay datos hoy");
    const data = historial.map(h => ({ Empleado: h.nombre_empleado, Dependencia: h.dependencia, Fecha_Hora: new Date(h.fecha_hora).toLocaleString('es-MX') }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Canjes");
    XLSX.writeFile(wb, `Reporte_Cajero_${new Date().getTime()}.xlsx`);
  };

  const generarPDF = (tipo: 'diario' | 'semanal') => {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("FISCALÍA GENERAL DEL ESTADO DE YUCATÁN", 105, 20, { align: "center" });
    doc.setFontSize(11);
    doc.text(`REPORTE DE COMEDOR (${tipo.toUpperCase()}) - CONTROL CAJA`, 105, 28, { align: "center" });
    autoTable(doc, {
      startY: 40,
      head: [['#', 'Empleado', 'Dependencia', 'Fecha/Hora']],
      body: historial.map((h, i) => [i + 1, h.nombre_empleado, h.dependencia, new Date(h.fecha_hora).toLocaleString('es-MX')]),
      headStyles: { fillColor: [26, 39, 68] },
    });
    const finalY = (doc as any).lastAutoTable.finalY + 35;
    doc.setFontSize(9);
    doc.line(25, finalY, 90, finalY); doc.text("AUTORIZA", 57, finalY + 5, { align: "center" });
    doc.text("M.D. JOSE MANUEL FLORES ACOSTA", 57, finalY + 10, { align: "center" });
    doc.line(120, finalY, 185, finalY); doc.text("RECIBE", 152, finalY + 5, { align: "center" });
    doc.text("KARLA XACUR TAMAYO", 152, finalY + 10, { align: "center" });
    doc.save(`Corte_Cajero_${tipo}.pdf`);
  };

  if (loadingAcceso) return <div className="min-h-screen bg-[#F0F3F6] flex items-center justify-center"><Loader2 className="animate-spin text-[#1A2744]" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#F0F3F6] font-sans pb-10">
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8 relative z-50">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center shrink-0">
            <img src="/logo-fge.png" alt="FGE" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight">Punto de Canje</h1>
            <p className="text-[#C9A84C] text-[9px] md:text-xs font-bold tracking-widest">{userEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-white/10 p-2 rounded-xl hover:bg-red-500 transition-all border border-white/5"><LogOut size={18} /></button>
      </nav>

      <div className="w-full max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center">
            <h2 className="text-4xl font-black text-[#6366F1]">{stats.canjeadosHoy}</h2>
            <p className="text-slate-400 text-xs font-medium mt-1 uppercase tracking-tighter">Canjeados hoy</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center">
            <h2 className="text-4xl font-black text-emerald-500">{stats.transacciones}</h2>
            <p className="text-slate-400 text-xs font-medium mt-1 uppercase tracking-tighter">Sincronizados</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex bg-slate-50/50 p-2 gap-2">
            {[
              { id: 'escanear', label: 'Escanear', icon: <Scan size={18}/> },
              { id: 'historial', label: 'Historial', icon: <History size={18}/> },
              { id: 'reportes', label: 'Reportes', icon: <ClipboardList size={18}/> }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id as Tab); if(t.id === 'escanear') setTimeout(() => inputRef.current?.focus(), 100); }}
                className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${activeTab === t.id ? 'bg-[#6366F1] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'escanear' && (
            <div className="p-8 animate-fade-in">
              <h3 className="text-[#1A2744] font-bold text-sm sm:text-base mb-4">Escanear código de barras</h3>
              <form onSubmit={procesarEscaneo} className="flex flex-col sm:row gap-4">
                <div className="flex flex-1 gap-2 sm:gap-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputLectura}
                    onChange={(e) => setInputLectura(e.target.value)}
                    className="flex-1 w-full p-4 border-2 border-[#6366F1]/40 rounded-2xl text-lg font-mono outline-none focus:border-[#6366F1] transition-colors uppercase tracking-widest min-w-0"
                    placeholder="Escanea o escribe el código..."
                    autoFocus
                  />
                  <button 
                    type="button" 
                    onClick={() => setUsarCamara(!usarCamara)} 
                    className={`px-4 rounded-2xl transition-all shadow-sm ${usarCamara ? 'bg-red-500 text-white' : 'bg-slate-100 text-[#1A2744] hover:bg-slate-200'}`}
                    title="Usar Cámara del Celular"
                  >
                    <Camera size={24}/>
                  </button>
                  <button type="submit" disabled={cargando} className="bg-[#6366F1] text-white px-6 sm:px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">
                    {cargando ? '...' : 'Validar'}
                  </button>
                </div>
              </form>
              <p className="text-slate-400 text-[10px] mt-2 mb-8">El escáner USB o la cámara llenarán este campo automáticamente</p>

              {usarCamara && (
                <div className="mb-8 p-4 border-2 border-dashed border-[#6366F1]/40 rounded-3xl bg-slate-50 animate-fade-in">
                  <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl"></div>
                  <button type="button" onClick={() => setUsarCamara(false)} className="w-full mt-4 py-3 text-red-500 font-bold uppercase text-xs tracking-widest hover:bg-red-50 rounded-xl transition-colors">
                    Cancelar Cámara
                  </button>
                </div>
              )}

              {mensaje.tipo === 'exito' && (
                <div className="bg-emerald-50 border-2 border-emerald-500/20 rounded-3xl p-8 flex flex-col items-center text-center animate-fade-in">
                   <div className="bg-emerald-500 text-white p-3 rounded-full mb-4 shadow-lg"><FileText size={32}/></div>
                  <h2 className="text-2xl font-black text-[#1A2744] uppercase mb-1">{mensaje.texto}</h2>
                  <p className="text-slate-700 font-bold text-lg">{mensaje.empleado.nombre_completo}</p>
                  <p className="text-slate-400 text-xs font-bold uppercase mt-1">{mensaje.empleado.dependencia} — {mensaje.hora}</p>
                </div>
              )}

              {mensaje.tipo === 'error' && (
                <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-6 text-red-600 font-black text-center animate-fade-in uppercase">
                  ❌ {mensaje.texto}
                </div>
              )}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="p-8 animate-fade-in">
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-6 border-b pb-4">Canjes realizados hoy</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {historial.map((h, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-black text-xs text-[#1A2744] uppercase">{h.nombre_empleado}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{h.dependencia}</p>
                    </div>
                    <p className="text-[10px] font-black text-[#6366F1]">{new Date(h.fecha_hora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reportes' && (
            <div className="p-8 animate-fade-in">
              <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-8">Auditoría y Cierres</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={exportarExcel} className="flex flex-col items-center justify-center p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] text-emerald-600 hover:bg-emerald-100 transition-all gap-2">
                  <FileSpreadsheet size={32}/><span className="font-black text-[10px] uppercase">Excel</span>
                </button>
                <button onClick={() => generarPDF('diario')} className="flex flex-col items-center justify-center p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] text-blue-600 hover:bg-blue-100 transition-all gap-2">
                  <FileText size={32}/><span className="font-black text-[10px] uppercase">PDF Diario</span>
                </button>
                <button onClick={() => generarPDF('semanal')} className="flex flex-col items-center justify-center p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] text-amber-600 hover:bg-amber-100 transition-all gap-2">
                  <FileText size={32}/><span className="font-black text-[10px] uppercase">PDF Semanal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}} />
    </div>
  );
}