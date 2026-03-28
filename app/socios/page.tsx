'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, FileSpreadsheet, FileText, PieChart, TrendingUp, TrendingDown, DollarSign, Activity, ShieldCheck, History } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PRECIO_VALE = 92.80;
const LIMITE_MENSUAL = 5500;

export default function SociosDashboard() {
  const router = useRouter();
  const [historial, setHistorial] = useState<any[]>([]);
  const [cierres, setCierres] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, canjeados: 0, disponibles: 0 });
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      setTimeout(async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { router.push('/'); return; }
        
        const email = session.user.email?.toLowerCase() || '';
        
        const { data: miPerfil } = await supabase.from('perfiles').select('rol').eq('email', email).maybeSingle();
        const rol = miPerfil?.rol || 'empleado';

        // Acceso EXCLUSIVO a socios y devs (Bloqueamos a la Fiscalía/admin)
        if (rol !== 'socio' && rol !== 'dev') {
          router.push('/dashboard');
          return;
        }
        
        setUserEmail(email);
        setLoadingAcceso(false);
        cargarDatosGenerales();
      }, 300); 
    };
    checkAccess();
  }, [router]);

  const cargarDatosGenerales = async () => {
    const { data: dataEmpleados } = await supabase.from('perfiles').select('tickets_restantes, tickets_canjeado, rol, dependencia');
    
    if (dataEmpleados) {
      const empleadosReales = dataEmpleados.filter(e => e.rol !== 'dev' && !e.dependencia?.toUpperCase().includes('PRUEBA'));
      
      let totalAsignados = 0; 
      let totalCanjeados = 0;
      
      empleadosReales.forEach(emp => {
        totalCanjeados += (emp.tickets_canjeado || 0);
        totalAsignados += (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
      });
      
      setStats({ 
        total: totalAsignados, 
        canjeados: totalCanjeados, 
        disponibles: totalAsignados - totalCanjeados 
      });
    }

    const { data: dataHistorial } = await supabase.from('historial_comedor').select('*').order('fecha_hora', { ascending: false });
    if (dataHistorial) setHistorial(dataHistorial);

    const { data: dataCierres } = await supabase.from('cierres_semanales').select('*').order('fecha_cierre', { ascending: false });
    if (dataCierres) setCierres(dataCierres);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };

  const exportarHistorialExcel = () => {
    if (historial.length === 0) return alert("No hay registros");
    const data = historial.map(h => ({ Empleado: h.nombre_empleado, Dependencia: h.dependencia, Fecha_Hora: new Date(h.fecha_hora).toLocaleString('es-MX') }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Canjes"); XLSX.writeFile(wb, `Auditoria_Comedor_${new Date().getTime()}.xlsx`);
  };

  const generarCortePDF = (tipo: 'diario' | 'semanal') => {
    const doc = new jsPDF();
    const fechaActual = new Date();
    let datosFiltrados = historial;
    
    if (tipo === 'diario') {
      const hoy = fechaActual.toLocaleDateString('es-MX');
      datosFiltrados = historial.filter(h => new Date(h.fecha_hora).toLocaleDateString('es-MX') === hoy);
    }
    
    if (datosFiltrados.length === 0) return alert("Sin registros para este periodo.");
    
    const facturacion = datosFiltrados.length * PRECIO_VALE;

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("COMEDOR FISCALÍA - REPORTE GERENCIAL", 105, 20, { align: "center" });
    doc.setFontSize(12); doc.text(`CORTE DE AUDITORÍA - ${tipo.toUpperCase()}`, 105, 28, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Total Raciones: ${datosFiltrados.length}`, 14, 40);
    doc.text(`Monto a Facturar: ${formatearMoneda(facturacion)} MXN`, 14, 46);

    autoTable(doc, {
      startY: 52,
      head: [['#', 'Nombre del Empleado', 'Fecha y Hora de Canje']],
      body: datosFiltrados.map((h, i) => [i + 1, h.nombre_empleado, new Date(h.fecha_hora).toLocaleString('es-MX')]),
      headStyles: { fillColor: [26, 39, 68] }, 
      margin: { bottom: 60 } 
    });
    
    doc.save(`Corte_Financiero_${tipo.toUpperCase()}.pdf`);
  };

  const formatearMoneda = (cantidad: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cantidad);
  };

  // --- CÁLCULOS FINANCIEROS ---
  const ingresoSemana = stats.canjeados * PRECIO_VALE;
  const mermaSemana = stats.disponibles * PRECIO_VALE;

  const mesActual = new Date().getMonth();
  const anioActual = new Date().getFullYear();
  let canjeadosMesHistorial = 0;
  let sobrantesMesHistorial = 0;

  cierres.forEach(c => {
    const d = new Date(c.fecha_cierre);
    if(d.getMonth() === mesActual && d.getFullYear() === anioActual) {
       canjeadosMesHistorial += c.vales_canjeados;
       sobrantesMesHistorial += c.vales_sobrantes;
    }
  });

  const totalCanjeadosMes = canjeadosMesHistorial + stats.canjeados;
  const totalSobrantesMes = sobrantesMesHistorial + stats.disponibles;
  const ingresoMes = totalCanjeadosMes * PRECIO_VALE;
  const proyeccionMaximaMes = LIMITE_MENSUAL * PRECIO_VALE;

  if (loadingAcceso) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744]/5 to-transparent z-0"></div>
        <div className="relative z-10 flex flex-col items-center animate-pulse-slow">
          <Loader2 className="animate-spin text-amber-500 mb-4" size={32} />
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#1A2744]">Autenticando Gerencia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A2744] font-sans pb-20 relative">
      <div className="fixed top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[#1A2744] to-[#F8FAFC] -z-10"></div>
      
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50 shadow-sm flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg border border-amber-200 shrink-0">
            <DollarSign className="text-white" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight text-[#1A2744]">Portal Financiero</h1>
              <span className="bg-[#1A2744] text-amber-400 text-[8px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm tracking-widest"><ShieldCheck size={10} /> LECTURA</span>
            </div>
            <p className="text-slate-500 text-[9px] font-black tracking-[0.2em] uppercase mt-0.5">{userEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-100 active:scale-95 transition-all border border-red-100"><LogOut size={18} /></button>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 relative z-10">
        
        {/* MÉTRICAS FINANCIERAS DE LA SEMANA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 anim-fade-up">
          <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Facturación Actual (Semana)</p>
              <div className="bg-emerald-50 text-emerald-500 p-2 rounded-xl"><TrendingUp size={20}/></div>
            </div>
            <h2 className="text-4xl font-black text-emerald-500">{formatearMoneda(ingresoSemana)}</h2>
            <p className="text-[#1A2744] text-[10px] font-bold mt-2 bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">
               Generado por {stats.canjeados} vales a {formatearMoneda(PRECIO_VALE)}
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Pérdida / Merma (Semana)</p>
              <div className="bg-red-50 text-red-500 p-2 rounded-xl"><TrendingDown size={20}/></div>
            </div>
            <h2 className="text-4xl font-black text-red-500">{formatearMoneda(mermaSemana)}</h2>
            <p className="text-[#1A2744] text-[10px] font-bold mt-2 bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">
               {stats.disponibles} vales no canjeados aún
            </p>
          </div>

          <div className="bg-[#1A2744] p-8 rounded-[2rem] shadow-xl shadow-[#1A2744]/20 border border-[#2A3F6D] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent"></div>
            <div className="relative z-10 flex justify-between items-start mb-4">
              <p className="text-amber-400 text-[10px] font-black uppercase tracking-[0.2em]">Ingreso Mensual Acumulado</p>
              <div className="bg-[#2A3F6D] text-amber-400 p-2 rounded-xl"><Activity size={20}/></div>
            </div>
            <h2 className="text-4xl font-black text-white relative z-10">{formatearMoneda(ingresoMes)}</h2>
            <p className="text-blue-200/60 text-[10px] font-bold mt-2 bg-[#2A3F6D]/50 inline-block px-3 py-1 rounded-lg border border-white/5 relative z-10">
               {totalCanjeadosMes} vales facturados este mes
            </p>
          </div>
        </div>

        {/* DASHBOARD CONTROL MENSUAL */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 mb-8 anim-fade-up" style={{animationDelay: '100ms'}}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-lg font-black text-[#1A2744] uppercase tracking-tight flex items-center gap-2">
                <PieChart size={24} className="text-blue-500"/> Avance de Facturación (Tope Mensual)
              </h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Límite establecido por Fiscalía: {LIMITE_MENSUAL} vales ({formatearMoneda(proyeccionMaximaMes)})</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Margen Restante de Facturación</p>
              <p className="text-2xl font-black text-[#1A2744]">{formatearMoneda(proyeccionMaximaMes - ingresoMes)}</p>
            </div>
          </div>
          
          <div className="bg-slate-100 h-6 rounded-full overflow-hidden flex shadow-inner mb-3">
            <div style={{width: `${Math.min(100, (totalCanjeadosMes / LIMITE_MENSUAL) * 100)}%`}} className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full transition-all duration-1000 flex items-center justify-end pr-2">
                {totalCanjeadosMes > 500 && <span className="text-[8px] font-black text-white uppercase tracking-widest">{((totalCanjeadosMes / LIMITE_MENSUAL) * 100).toFixed(1)}%</span>}
            </div>
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>$0.00</span>
            <span className={totalCanjeadosMes > 5000 ? "text-red-500" : ""}>{formatearMoneda(proyeccionMaximaMes)}</span>
          </div>
        </div>

        {/* AUDITORÍA Y DESCARGAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 anim-fade-up" style={{animationDelay: '200ms'}}>
          
          <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-8">
            <h3 className="text-[#1A2744] font-black text-sm uppercase tracking-tight mb-6">Herramientas de Conciliación</h3>
            
            <div className="flex flex-col gap-4">
              <button onClick={() => generarCortePDF('diario')} className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm text-blue-500"><FileText size={20}/></div>
                  <div className="text-left">
                    <p className="font-black text-xs text-[#1A2744] uppercase tracking-widest">Corte Financiero Diario</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">PDF con desglose económico</p>
                  </div>
                </div>
              </button>
              
              <button onClick={() => generarCortePDF('semanal')} className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm text-emerald-500"><FileText size={20}/></div>
                  <div className="text-left">
                    <p className="font-black text-xs text-[#1A2744] uppercase tracking-widest">Concentrado Semanal</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Resumen para facturación a FGE</p>
                  </div>
                </div>
              </button>

              <button onClick={exportarHistorialExcel} className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-amber-50 hover:border-amber-200 transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-xl shadow-sm text-amber-500"><FileSpreadsheet size={20}/></div>
                  <div className="text-left">
                    <p className="font-black text-xs text-[#1A2744] uppercase tracking-widest">Exportar Base (Excel)</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Datos crudos de la semana activa</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-50 flex items-center gap-3 shrink-0">
              <History size={20} className="text-slate-400" />
              <div>
                 <h4 className="text-xs font-black text-[#1A2744] uppercase tracking-widest">Monitor en Tiempo Real</h4>
                 <p className="text-[9px] font-bold text-slate-400 uppercase">Últimos consumos registrados</p>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[350px] flex-1 no-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 text-[8px] uppercase font-black text-slate-400 tracking-[0.2em] border-b border-slate-100 z-10">
                  <tr><th className="p-4 pl-6">Beneficiario</th><th className="p-4 text-right pr-6">Impacto Financiero</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historial.map((h, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6">
                         <p className="font-black text-[10px] text-[#1A2744] uppercase leading-tight">{h.nombre_empleado}</p>
                         <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{new Date(h.fecha_hora).toLocaleString('es-MX')}</p>
                      </td>
                      <td className="p-4 text-right pr-6 text-[10px] font-black text-emerald-500">
                         +{formatearMoneda(PRECIO_VALE)}
                      </td>
                    </tr>
                  ))}
                  {historial.length === 0 && <tr><td colSpan={2} className="py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin registros</td></tr>}
                </tbody>
              </table>
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
          animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}