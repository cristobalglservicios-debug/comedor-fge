'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('cuotas');
  const [historial, setHistorial] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, canjeados: 0, disponibles: 0, dependencias: 0 });
  const [cargando, setCargando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarDatosGenerales();
  }, []);

  const cargarDatosGenerales = async () => {
    // 1. Cargar Empleados para calcular cuotas
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

    // 2. Cargar Historial para reportes
    const { data: dataHistorial } = await supabase
      .from('historial_comedor')
      .select('*')
      .order('fecha_hora', { ascending: false });
    if (dataHistorial) {
      setHistorial(dataHistorial);
    }
  };

  // --- LÓGICA PARA LEER EL EXCEL DE LA NÓMINA ---
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

      // Limpiamos la base de datos de perfiles anterior e insertamos los nuevos
      // (En un sistema real haríamos un "upsert", pero para este inicio lo simplificamos)
      for (const fila of data as any[]) {
        if (fila.Nombre && fila.Dependencia) {
          const cuota = fila.Cuota || 1; // Si no trae cuota, le damos 1 por defecto
          await supabase.from('perfiles').upsert({
            nombre_completo: fila.Nombre.toUpperCase(),
            dependencia: fila.Dependencia,
            tickets_restantes: cuota,
            tickets_canjeado: 0
          }, { onConflict: 'nombre_completo' });
        }
      }
      
      alert('✅ Nómina cargada exitosamente');
      cargarDatosGenerales(); // Recargamos la pantalla
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

  // Agrupamos datos para la vista de "Cuotas"
  const cuotasPorDependencia = empleados.reduce((acc, emp) => {
    const dep = emp.dependencia || 'Sin Asignar';
    if (!acc[dep]) acc[dep] = { asignados: 0, canjeados: 0, disponibles: 0 };
    const asignados = (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
    acc[dep].asignados += asignados;
    acc[dep].canjeados += (emp.tickets_canjeado || 0);
    acc[dep].disponibles += (emp.tickets_restantes || 0);
    return acc;
  }, {});

  const dependenciasArray = Object.keys(cuotasPorDependencia).map(key => ({
    nombre: key,
    ...cuotasPorDependencia[key]
  })).sort((a, b) => b.asignados - a.asignados); // Ordenar de mayor a menor

  const hoyFormateado = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* BARRA SUPERIOR */}
      <div className="bg-[#1A2744] text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:bg-white/10 p-2 rounded-full transition-colors">
            ←
          </Link>
          <div>
            <h1 className="font-bold text-lg leading-tight">Panel de Administración</h1>
            <p className="text-[#C9A84C] text-xs">Dirección de Administración</p>
          </div>
        </div>
        <div className="text-sm font-medium text-slate-300">{hoyFormateado}</div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* TARJETAS DE KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-4xl font-black text-[#1A2744]">{stats.total}</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Total Asignados</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-4xl font-black text-green-500">{stats.canjeados}</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Canjeados</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-4xl font-black text-[#C9A84C]">{stats.disponibles}</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Disponibles</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <h2 className="text-4xl font-black text-purple-600">{stats.dependencias}</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Dependencias</p>
          </div>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div className="flex border-b border-slate-200 mb-8">
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          
          {/* PESTAÑA 1: CUOTAS */}
          {activeTab === 'cuotas' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-700">Cuotas por Dependencia — {hoyFormateado}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase border-b border-slate-100">
                      <th className="py-4 font-bold">Dependencia</th>
                      <th className="py-4 font-bold text-center">Asignados</th>
                      <th className="py-4 font-bold text-center">Canjeados</th>
                      <th className="py-4 font-bold text-center">Disponibles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dependenciasArray.map((dep, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-medium text-slate-700">{dep.nombre}</td>
                        <td className="py-4 font-bold text-center text-[#1A2744]">{dep.asignados}</td>
                        <td className="py-4 font-bold text-center text-green-500">{dep.canjeados}</td>
                        <td className="py-4 font-bold text-center text-[#C9A84C]">{dep.disponibles}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dependenciasArray.length === 0 && <p className="text-center text-slate-400 py-10">No hay dependencias registradas.</p>}
              </div>
            </div>
          )}

          {/* PESTAÑA 2: EMPLEADOS (AQUÍ ESTÁ EL BOTÓN DE EXCEL) */}
          {activeTab === 'empleados' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-700">Empleados Registrados ({empleados.length})</h3>
                
                {/* BOTÓN OCULTO Y BOTÓN VISIBLE PARA EL EXCEL */}
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
                  className="bg-[#C9A84C] hover:bg-amber-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2"
                >
                  {cargando ? 'Cargando...' : '+ Cargar Nómina (Excel)'}
                </button>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-slate-400 text-xs uppercase border-b border-slate-100">
                      <th className="py-4 font-bold">Nombre</th>
                      <th className="py-4 font-bold">Dependencia</th>
                      <th className="py-4 font-bold text-center">Rol</th>
                      <th className="py-4 font-bold text-center">Disponibles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {empleados.map((emp, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-bold text-slate-700 text-sm">{emp.nombre_completo}</td>
                        <td className="py-3 text-slate-500 text-sm">{emp.dependencia}</td>
                        <td className="py-3 text-center">
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">Empleado</span>
                        </td>
                        <td className="py-3 font-bold text-center text-slate-600">{emp.tickets_restantes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: REPORTES */}
          {activeTab === 'reportes' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-700">Historial Detallado de Canjes</h3>
                <button 
                  onClick={descargarReporte}
                  className="bg-[#1A2744] hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2"
                >
                  📥 Exportar a Excel
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-slate-400 text-xs uppercase border-b border-slate-100">
                      <th className="py-4 font-bold">Empleado</th>
                      <th className="py-4 font-bold">Dependencia</th>
                      <th className="py-4 font-bold">Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {historial.map((h, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-bold text-slate-700 text-sm">{h.nombre_empleado}</td>
                        <td className="py-3 text-slate-500 text-sm">{h.dependencia}</td>
                        <td className="py-3 text-slate-500 text-sm">{new Date(h.fecha_hora).toLocaleString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historial.length === 0 && <p className="text-center text-slate-400 py-10">Aún no hay registros de canje.</p>}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}