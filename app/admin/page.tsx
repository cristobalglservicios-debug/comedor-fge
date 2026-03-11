'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, FileSpreadsheet, Search, Plus, UserCog, Key, Trash2, Save } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('cuotas');
  const [historial, setHistorial] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [stats, setStats] = useState({ total: 0, canjeados: 0, disponibles: 0, dependencias: 0 });
  const [cargando, setCargando] = useState(false);
  
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Modal de Edición
  const [empleadoEdit, setEmpleadoEdit] = useState<any>(null);
  const [nuevaPass, setNuevaPass] = useState('');

  useEffect(() => {
    const checkAccess = async () => {
      setTimeout(async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { router.push('/dashboard'); return; }
        const email = session.user.email?.toLowerCase() || '';
        if (!email.includes('admin')) { router.push('/'); return; }
        setUserEmail(email);
        setLoadingAcceso(false);
        cargarDatosGenerales();
      }, 300); 
    };
    checkAccess();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/dashboard');
  };

  const cargarDatosGenerales = async () => {
    const { data: dataEmpleados } = await supabase.from('perfiles').select('*').order('nombre_completo', { ascending: true });
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

  const actualizarCuota = async (id: string, nuevaCuota: number) => {
    if (nuevaCuota < 0) return;
    const { error } = await supabase.from('perfiles').update({ tickets_restantes: nuevaCuota }).eq('id', id);
    if (!error) cargarDatosGenerales();
  };

  const resetPassword = async (email: string) => {
    if (!nuevaPass || nuevaPass.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    // Nota: Para resetear passwords de otros usuarios en Supabase Auth se requiere el Service Role Key.
    // Como medida de autonomía cliente, notificamos que se debe usar el panel de Supabase o implementar Edge Function.
    alert(`Solicitud recibida. Para cambiar pass de ${email}, usa el panel de Auth o contacta a soporte técnico.`);
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

  const empleadosFiltrados = empleados.filter(emp => 
    emp.nombre_completo.toLowerCase().includes(filtroNombre.toLowerCase()) ||
    emp.dependencia.toLowerCase().includes(filtroNombre.toLowerCase())
  );

  const dependenciasArray = Object.entries(
    empleados.reduce((acc, emp) => {
      const dep = emp.dependencia || 'Sin Asignar';
      if (!acc[dep]) acc[dep] = { asignados: 0, canjeados: 0, disponibles: 0 };
      acc[dep].asignados += (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
      acc[dep].canjeados += (emp.tickets_canjeado || 0);
      acc[dep].disponibles += (emp.tickets_restantes || 0);
      return acc;
    }, {} as any)
  ).map(([nombre, vals]: [string, any]) => ({ nombre, ...vals })).sort((a, b) => b.asignados - a.asignados);

  if (loadingAcceso) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <Loader2 className="text-[#1A2744] animate-spin mb-4" size={40} />
      <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Cargando Panel...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center border border-[#C9A84C]/30 shadow-inner">
            <img src="/logo-fge.png" alt="FGE" className="w-full h-full object-contain rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png"; }} />
          </div>
          <div><h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight">Dirección Administración</h1><p className="text-[#C9A84C] text-[9px] md:text-xs font-bold tracking-widest">{userEmail}</p></div>
        </div>
        <button onClick={handleLogout} className="bg-white/10 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={18} /></button>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
          <StatCard title="Asignados" val={stats.total} color="bg-slate-50" text="text-[#1A2744]" />
          <StatCard title="Canjeados" val={stats.canjeados} color="bg-emerald-50" text="text-emerald-500" />
          <StatCard title="Disponibles" val={stats.disponibles} color="bg-amber-50" text="text-[#C9A84C]" />
          <StatCard title="Dependencias" val={stats.dependencias} color="bg-purple-50" text="text-purple-600" />
        </div>

        <div className="flex overflow-x-auto border-b border-slate-200 mb-6 bg-white sticky top-[72px] z-40 px-4 rounded-t-2xl">
          {['cuotas', 'empleados', 'reportes'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 font-bold text-xs uppercase tracking-widest transition-all border-b-4 ${activeTab === tab ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400'}`}>{tab}</button>
          ))}
        </div>

        <div className="bg-white rounded-b-2xl shadow-xl p-4 md:p-8">
          {activeTab === 'cuotas' && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-lg font-black text-[#1A2744] uppercase mb-6">Distribución por Dependencia</h3>
              <div className="divide-y divide-slate-50">
                {dependenciasArray.map((dep, i) => (
                  <div key={i} className="flex py-4 items-center px-2 hover:bg-slate-50 rounded-xl">
                    <div className="flex-1 font-bold text-[#1A2744] text-xs sm:text-sm">{dep.nombre}</div>
                    <div className="flex gap-4 text-center text-xs font-black uppercase">
                      <div className="w-16"><p className="text-slate-400">Asig</p><p>{dep.asignados}</p></div>
                      <div className="w-16"><p className="text-emerald-500">Canj</p><p>{dep.canjeados}</p></div>
                      <div className="w-16"><p className="text-[#C9A84C]">Disp</p><p>{dep.disponibles}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'empleados' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Buscar empleado o dependencia..." value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#C9A84C]" />
                </div>
                <input type="file" className="hidden" ref={fileInputRef} onChange={procesarExcel} />
                <button onClick={() => fileInputRef.current?.click()} className="bg-[#1A2744] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center gap-2 justify-center shrink-0">
                  <FileSpreadsheet size={16}/> Cargar Excel
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b">
                    <tr><th className="p-4">Nombre Completo</th><th className="p-4">Dependencia</th><th className="p-4 text-center">Cuota Hoy</th><th className="p-4 text-right">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {empleadosFiltrados.map((emp, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-xs text-[#1A2744] uppercase">{emp.nombre_completo}</td>
                        <td className="p-4 text-[10px] text-slate-500 uppercase">{emp.dependencia}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-3">
                            <button onClick={() => actualizarCuota(emp.id, emp.tickets_restantes - 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-bold hover:bg-red-100 text-red-600 transition-colors">-</button>
                            <span className="font-black text-sm w-4 text-center">{emp.tickets_restantes}</span>
                            <button onClick={() => actualizarCuota(emp.id, emp.tickets_restantes + 1)} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-bold hover:bg-emerald-100 text-emerald-600 transition-colors">+</button>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => setEmpleadoEdit(emp)} className="text-slate-400 hover:text-[#C9A84C] p-2 transition-colors"><UserCog size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reportes' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-[#1A2744] uppercase">Bitácora Global</h3>
                <button onClick={descargarReporte} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center gap-2">📥 Exportar Reporte</button>
              </div>
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b">
                    <tr><th className="p-4">Empleado</th><th className="p-4">Dependencia</th><th className="p-4">Fecha/Hora</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {historial.map((h, i) => (
                      <tr key={i} className="text-xs">
                        <td className="p-4 font-bold uppercase">{h.nombre_empleado}</td>
                        <td className="p-4 uppercase text-slate-500">{h.dependencia}</td>
                        <td className="p-4">{new Date(h.fecha_hora).toLocaleString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE AUTONOMÍA: EDICIÓN DE USUARIO */}
      {empleadoEdit && (
        <div className="fixed inset-0 bg-[#1A2744]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black text-[#1A2744] uppercase mb-2">Gestionar Usuario</h2>
            <p className="text-xs text-slate-400 font-bold uppercase mb-6">{empleadoEdit.nombre_completo}</p>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Reiniciar Contraseña</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nueva contraseña" value={nuevaPass} onChange={e => setNuevaPass(e.target.value)} className="flex-1 bg-white border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-[#C9A84C]" />
                  <button onClick={() => resetPassword(empleadoEdit.nombre_completo)} className="bg-[#1A2744] text-white p-2 rounded-lg"><Key size={16}/></button>
                </div>
              </div>
              <button onClick={() => setEmpleadoEdit(null)} className="w-full py-4 text-xs font-black uppercase text-slate-400 hover:text-red-500 transition-colors">Cerrar Ventana</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, val, color, text }: any) {
  return (
    <div className={`${color} p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden`}>
      <h2 className={`text-3xl md:text-4xl font-black ${text} relative z-10`}>{val}</h2>
      <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">{title}</p>
    </div>
  );
}