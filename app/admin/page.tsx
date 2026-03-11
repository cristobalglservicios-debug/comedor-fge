'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. NUEVA LÓGICA DE SEGURIDAD (El Cadenero) ---
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/dashboard');
        return;
      }

      const email = session.user.email?.toLowerCase() || '';
      
      // Si NO es el admin, lo regresamos a su lugar (para evitar el bucle)
      if (!email.includes('admin')) {
        router.push('/');
        return;
      }

      setUserEmail(email);
      setLoadingAcceso(false);
      cargarDatosGenerales(); // Cargamos los datos solo si pasó el filtro
    };

    checkAccess();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/dashboard');
  };

  // --- 2. TU LÓGICA ORIGINAL DE DATOS Y EXCEL ---
  const cargarDatosGenerales = async () => {
    const { data: dataEmpleados } = await supabase.from('perfiles').select('*');
    if (dataEmpleados) {
      setEmpleados(dataEmpleados);
      
      const dependenciasUnicas = new Set(dataEmpleados.map(e => e.dependencia)).size;
      let totalAsignados = 0;
      let totalCanjeados = 0;

      dataEmpleados.forEach(emp => {
        totalCanjeados += (emp.tickets_canjeado || 0);
        totalAsignados += (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
      });

      setStats({
        total: totalAsignados,
        canjeados: totalCanjeados,
        disponibles: totalAsignados - totalCanjeados,
        dependencias: dependenciasUnicas
      });
    }

    const { data: dataHistorial } = await supabase
      .from('historial_comedor')
      .select('*')
      .order('fecha_hora', { ascending: false });
    if (dataHistorial) {
      setHistorial(dataHistorial);
    }
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
          const cuota = fila.Cuota || 1; 
          await supabase.from('perfiles').upsert({
            nombre_completo: fila.Nombre.toUpperCase(),
            dependencia: fila.Dependencia,
            tickets_restantes: cuota,
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
    const asignados = (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
    acc[dep].asignados += asignados;
    acc[dep].canjeados += (emp.tickets_canjeado || 0);
    acc[dep].disponibles += (emp.tickets_restantes || 0);
    return acc;
  }, {} as any);

  const dependenciasArray = Object.keys(cuotasPorDependencia).map(key => ({
    nombre: key,
    ...cuotasPorDependencia[key]
  })).sort((a, b) => b.asignados - a.asignados);

  const hoyFormateado = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (loadingAcceso) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="text-[#1A2744] animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* BARRA SUPERIOR NUEVA Y OFICIAL */}
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center border border-[#C9A84C]/30">
            <img 
              src="/Logo-FGE.jpg" 
              alt="FGE" 
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png";
              }}
            />
          </div>
          <div>
            <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight">Panel Dirección</h1>
            <p className="text-[#C9A84C] text-[9px] md:text-xs font-bold tracking-widest">{userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs font-medium text-slate-300 hidden md:block">{hoyFormateado}</div>
          <button 
            onClick={handleLogout}
            className="bg-white/10 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-white/5"
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* TARJETAS DE KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-3xl md:text-4xl font-black text-[#1A2744]">{stats.total}</h2>
            <p className="text-slate-400 text-[10px] md:text-sm font-bold uppercase tracking-wider mt-1">Total Asignados</p>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-3xl md:text-4xl font-black text-emerald-500">{stats.canjeados}</h2>
            <p className="text-slate-400 text-[10px] md:text-sm font-bold uppercase tracking-wider mt-1">Canjeados</p>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-3xl md:text-4xl font-black text-[#C9A84C]">{stats.disponibles}</h2>
            <p className="text-slate-400 text-[10px] md:text-sm font-bold uppercase tracking-wider mt-1">Disponibles</p>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-3xl md:text-4xl font-black text-[#1A2744]/70">{stats.dependencias}</h2>
            <p className="text-slate-400 text-[10px] md:text-sm font-bold uppercase tracking-wider mt-1">Dependencias</p>
          </div>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div className="flex overflow-x-auto whitespace-nowrap border-b border-slate-200 mb-6 scrollbar-hide">
          <button onClick={() => setActiveTab('cuotas')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'cuotas' ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            📊 Cuotas
          </button>
          <button onClick={() => setActiveTab('empleados')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'empleados' ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            👥 Empleados
          </button>
          <button onClick={() => setActiveTab('reportes')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'reportes' ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            📥 Reportes
          </button>
        </div>

        {/* CONTENIDO DE LAS PESTAÑAS */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 p-4 md:p-8">
          
          {/* PESTAÑA 1: CUOTAS */}
          {activeTab === 'cuotas' && (
            <div className="animate-in fade-in duration-300">
              <div className="mb-6">
                <h3 className="text-base md:text-lg font-black text-[#1A2744] uppercase tracking-wide">Cuotas por Dependencia</h3>
                <p className="text-[#C9A84C] text-xs font-bold tracking-widest">{hoyFormateado}</p>
              </div>
              <div className="w-full">
                <div className="flex w-full text-slate-400 text-[10px] sm:text-xs uppercase border-b border-slate-100 pb-2 px-2 tracking-wider">
                  <div className="flex-1 font-bold">Dependencia</div>
                  <div className="w-12 sm:w-16 text-center font-bold">Asig.</div>
                  <div className="w-12 sm:w-16 text-center font-bold">Canj.</div>
                  <div className="w-12 sm:w-16 text-center font-bold">Disp.</div>
                </div>
                
                <div className="divide-y divide-slate-50">
                  {dependenciasArray.map((dep, index) => (
                    <div key={index} className="flex w-full py-4 items-center hover:bg-slate-50 transition-colors px-2 rounded-xl">
                      <div className="flex-1 font-bold text-[#1A2744] text-xs sm:text-sm pr-2 break-words leading-tight">
                        {dep.nombre}
                      </div>
                      <div className="w-12 sm:w-16 text-center font-bold text-slate-400 text-sm">{dep.asignados}</div>
                      <div className="w-12 sm:w-16 text-center font-black text-emerald-500 text-sm">{dep.canjeados}</div>
                      <div className="w-12 sm:w-16 text-center font-black text-[#C9A84C] text-sm">{dep.disponibles}</div>
                    </div>
                  ))}
                </div>
                {dependenciasArray.length === 0 && <p className="text-center text-slate-400 py-10">No hay dependencias registradas.</p>}
              </div>
            </div>
          )}

          {/* PESTAÑA 2: EMPLEADOS */}
          {activeTab === 'empleados' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-base md:text-lg font-black text-[#1A2744] uppercase tracking-wide">Plantilla Registrada</h3>
                  <p className="text-slate-400 text-xs font-bold">{empleados.length} Empleados en base de datos</p>
                </div>
                
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={procesarExcel} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={cargando}
                  className="bg-[#1A2744] hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
                >
                  {cargando ? 'Procesando...' : '+ Cargar Nómina Excel'}
                </button>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[500px] text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                    <tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                      <th className="py-4 px-4 font-bold">Nombre del Empleado</th>
                      <th className="py-4 px-4 font-bold">Dependencia</th>
                      <th className="py-4 px-4 font-bold text-center">Estatus</th>
                      <th className="py-4 px-4 font-bold text-center">Cuota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {empleados.map((emp, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#1A2744] text-xs uppercase">{emp.nombre_completo}</td>
                        <td className="py-3 px-4 text-slate-500 text-xs uppercase">{emp.dependencia}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Activo</span>
                        </td>
                        <td className="py-3 px-4 font-black text-center text-[#C9A84C]">{emp.tickets_restantes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: REPORTES */}
          {activeTab === 'reportes' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-base md:text-lg font-black text-[#1A2744] uppercase tracking-wide">Bitácora de Consumo</h3>
                  <p className="text-slate-400 text-xs font-bold">Historial de canjes registrados en sistema</p>
                </div>
                <button 
                  onClick={descargarReporte}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
                >
                  📥 Exportar Excel Oficial
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[500px] text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                    <tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                      <th className="py-4 px-4 font-bold">Empleado</th>
                      <th className="py-4 px-4 font-bold">Dependencia</th>
                      <th className="py-4 px-4 font-bold">Fecha y Hora Exactor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {historial.map((h, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#1A2744] text-xs uppercase">{h.nombre_empleado}</td>
                        <td className="py-3 px-4 text-slate-500 text-xs uppercase">{h.dependencia}</td>
                        <td className="py-3 px-4 text-slate-600 text-xs font-medium tracking-wide">{new Date(h.fecha_hora).toLocaleString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historial.length === 0 && <p className="text-center text-slate-400 py-10 font-medium">Aún no hay registros de consumo en la bitácora.</p>}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}