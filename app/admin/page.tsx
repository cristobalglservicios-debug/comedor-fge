'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, AlertCircle } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('cuotas');
  const [historial, setHistorial] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, canjeados: 0, disponibles: 0, dependencias: 0 });
  const [cargando, setCargando] = useState(false);
  
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null); // NUEVO: Para ver el error
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkAccess = async () => {
      // Le damos medio segundo a Supabase para que termine de guardar la sesión en el celular
      setTimeout(async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setErrorAcceso(`Error de Supabase: ${error.message}`);
          setLoadingAcceso(false);
          return;
        }

        if (!session) {
          setErrorAcceso("El celular no guardó tu sesión. Supabase dice que no estás logueado.");
          setLoadingAcceso(false);
          return;
        }

        const email = session.user.email?.toLowerCase() || '';
        
        if (!email.includes('admin')) {
          setErrorAcceso(`Acceso denegado. Tu correo es: ${email} y no contiene la palabra 'admin'.`);
          setLoadingAcceso(false);
          return;
        }

        setUserEmail(email);
        setLoadingAcceso(false);
        cargarDatosGenerales();
      }, 500); // 500 milisegundos de espera
    };

    checkAccess();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/dashboard');
  };

  // --- LÓGICA DE DATOS ---
  const cargarDatosGenerales = async () => {
    const { data: dataEmpleados } = await supabase.from('perfiles').select('*');
    if (dataEmpleados) {
      setEmpleados(dataEmpleados);
      const dependenciasUnicas = new Set(dataEmpleados.map(e => e.dependencia)).size;
      let totalAsignados = 0; let totalCanjeados = 0;
      dataEmpleados.forEach(emp => {
        totalCanjeados += (emp.tickets_canjeado || 0);
        totalAsignados += (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
      });
      setStats({ total: totalAsignados, canjeados: totalCanjeados, disponibles: totalAsignados - totalCanjeados, dependencias: dependenciasUnicas });
    }

    const { data: dataHistorial } = await supabase.from('historial_comedor').select('*').order('fecha_hora', { ascending: false });
    if (dataHistorial) setHistorial(dataHistorial);
  };

  const procesarExcel = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const bstr = event.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      for (const fila of data as any[]) {
        if (fila.Nombre && fila.Dependencia) {
          await supabase.from('perfiles').upsert({
            nombre_completo: fila.Nombre.toUpperCase(),
            dependencia: fila.Dependencia,
            tickets_restantes: fila.Cuota || 1,
            tickets_canjeado: 0
          }, { onConflict: 'nombre_completo' });
        }
      }
      alert('✅ Nómina cargada exitosamente');
      cargarDatosGenerales(); 
      setCargando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const descargarReporte = () => {
    const hoja = XLSX.utils.json_to_sheet(historial);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Reportes");
    XLSX.writeFile(libro, `Reporte_Canjes_${new Date().toLocaleDateString()}.xlsx`);
  };

  const cuotasPorDependencia = empleados.reduce((acc, emp) => {
    const dep = emp.dependencia || 'Sin Asignar';
    if (!acc[dep]) acc[dep] = { asignados: 0, canjeados: 0, disponibles: 0 };
    acc[dep].asignados += (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
    acc[dep].canjeados += (emp.tickets_canjeado || 0);
    acc[dep].disponibles += (emp.tickets_restantes || 0);
    return acc;
  }, {} as any);

  const dependenciasArray = Object.keys(cuotasPorDependencia).map(key => ({ nombre: key, ...cuotasPorDependencia[key] })).sort((a, b) => b.asignados - a.asignados);
  const hoyFormateado = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // --- PANTALLA DE CARGA ---
  if (loadingAcceso) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="text-[#1A2744] animate-spin mb-4" size={40} />
        <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Verificando credenciales...</p>
      </div>
    );
  }

  // --- PANTALLA DE ERROR (ROMPE EL BUCLE) ---
  if (errorAcceso) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-black text-slate-800 mb-2 uppercase">Acceso Detenido</h2>
          <p className="text-slate-600 text-sm font-medium mb-8 bg-red-50 p-4 rounded-xl">{errorAcceso}</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#1A2744] text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
          >
            Regresar al Login
          </button>
        </div>
      </div>
    );
  }

  // --- EL PANEL PRINCIPAL ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center border border-[#C9A84C]/30">
            <img src="/Logo-FGE.jpg" alt="FGE" className="w-full h-full object-contain rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png"; }} />
          </div>
          <div>
            <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight">Panel Dirección</h1>
            <p className="text-[#C9A84C] text-[9px] md:text-xs font-bold tracking-widest">{userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs font-medium text-slate-300 hidden md:block">{hoyFormateado}</div>
          <button onClick={handleLogout} className="bg-white/10 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 mb-6 scrollbar-hide">
          <button onClick={() => setActiveTab('cuotas')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'cuotas' ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400'}`}>📊 Cuotas</button>
          <button onClick={() => setActiveTab('empleados')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'empleados' ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400'}`}>👥 Empleados</button>
          <button onClick={() => setActiveTab('reportes')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'reportes' ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400'}`}>📥 Reportes</button>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-4 md:p-8">
          
          {activeTab === 'cuotas' && (
            <div>
              <h3 className="text-lg font-black text-[#1A2744] uppercase mb-4">Cuotas por Dependencia</h3>
              <div className="divide-y divide-slate-50">
                {dependenciasArray.map((dep, index) => (
                  <div key={index} className="flex w-full py-4 items-center">
                    <div className="flex-1 font-bold text-[#1A2744] text-sm">{dep.nombre}</div>
                    <div className="w-16 text-center font-bold text-slate-400">{dep.asignados}</div>
                    <div className="w-16 text-center font-black text-emerald-500">{dep.canjeados}</div>
                    <div className="w-16 text-center font-black text-[#C9A84C]">{dep.disponibles}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'empleados' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-[#1A2744] uppercase">Plantilla Registrada ({empleados.length})</h3>
                <input type="file" accept=".xlsx" className="hidden" ref={fileInputRef} onChange={procesarExcel} />
                <button onClick={() => fileInputRef.current?.click()} className="bg-[#1A2744] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest">+ Cargar Excel</button>
              </div>
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                  <tr><th className="py-4">Nombre</th><th className="py-4">Dependencia</th><th className="py-4 text-center">Cuota</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {empleados.map((emp, i) => (
                    <tr key={i}>
                      <td className="py-3 font-bold text-sm">{emp.nombre_completo}</td>
                      <td className="py-3 text-sm text-slate-500">{emp.dependencia}</td>
                      <td className="py-3 font-black text-center text-[#C9A84C]">{emp.tickets_restantes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reportes' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-[#1A2744] uppercase">Bitácora de Consumo</h3>
                <button onClick={descargarReporte} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest">📥 Exportar Excel</button>
              </div>
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                  <tr><th className="py-4">Empleado</th><th className="py-4">Dependencia</th><th className="py-4">Fecha</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historial.map((h, i) => (
                    <tr key={i}>
                      <td className="py-3 font-bold text-sm">{h.nombre_empleado}</td>
                      <td className="py-3 text-sm text-slate-500">{h.dependencia}</td>
                      <td className="py-3 text-sm text-slate-600">{new Date(h.fecha_hora).toLocaleString('es-MX')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}