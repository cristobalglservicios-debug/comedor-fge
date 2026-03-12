'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, FileSpreadsheet, Search, UserCog, Key, Trash2, Download, UserPlus, FileText, ShieldCheck, RefreshCw } from 'lucide-react';
import { crearUsuarioAdmin, eliminarUsuarioAdmin, actualizarPasswordAdmin, registrarLog } from './actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('cuotas');
  const [historial, setHistorial] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [auditoriaLogs, setAuditoriaLogs] = useState<any[]>([]);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [stats, setStats] = useState({ total: 0, canjeados: 0, disponibles: 0, dependencias: 0 });
  const [cargando, setCargando] = useState(false);
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [empleadoEdit, setEmpleadoEdit] = useState<any>(null);
  const [nuevaPass, setNuevaPass] = useState('');
  
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoEmp, setNuevoEmp] = useState({ nombre: '', dependencia: '', cuota: 1 });

  useEffect(() => {
    const checkAccess = async () => {
      setTimeout(async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { router.push('/dashboard'); return; }
        
        const email = session.user.email?.toLowerCase() || '';
        const esTuCuenta = email === 'admin.cristobal@fge.gob.mx';
        const esAdminOficial = email.startsWith('admin.') || email.includes('.admin@');
        
        if (!esTuCuenta && !esAdminOficial) {
          router.push('/dashboard');
          return;
        }
        
        setIsSuperAdmin(esTuCuenta);
        setUserEmail(email);
        setLoadingAcceso(false);
        cargarDatosGenerales();
      }, 300); 
    };
    checkAccess();
  }, [router]);

  const cargarDatosGenerales = async () => {
    // Carga Empleados
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
    // Carga Historial Comedor
    const { data: dataHistorial } = await supabase.from('historial_comedor').select('*').order('fecha_hora', { ascending: false });
    if (dataHistorial) setHistorial(dataHistorial);

    // Carga Logs Auditoría
    const { data: dataLogs } = await supabase.from('auditoria_logs').select('*').order('creado_en', { ascending: false }).limit(200);
    if (dataLogs) setAuditoriaLogs(dataLogs);
  };

  const generarEmail = (nombre: string) => {
    return nombre.toLowerCase().trim().replace(/\s+/g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@fge.gob.mx";
  };

  const guardarNuevoEmpleado = async () => {
    if (nuevoEmp.nombre.length < 5) return alert("Ingresa el nombre completo");
    setCargando(true);
    const emailGen = generarEmail(nuevoEmp.nombre);
    const empData = { nombre_completo: nuevoEmp.nombre.toUpperCase().trim(), dependencia: nuevoEmp.dependencia.toUpperCase().trim() || 'GENERAL', tickets_restantes: nuevoEmp.cuota, tickets_canjeado: 0, email: emailGen };
    await supabase.from('perfiles').upsert(empData, { onConflict: 'nombre_completo' });
    await crearUsuarioAdmin(emailGen, empData.nombre_completo, userEmail || 'Sistema');
    await registrarLog(userEmail || 'Sistema', 'ALTA_MANUAL', `Agregó a ${empData.nombre_completo} (${nuevoEmp.cuota} vales)`);
    
    alert(`✅ Empleado agregado con acceso: ${emailGen}`);
    setNuevoEmp({ nombre: '', dependencia: '', cuota: 1 });
    setModalNuevo(false);
    cargarDatosGenerales();
    setCargando(false);
  };

  const handleEliminarEmpleado = async () => {
    if (!empleadoEdit) return;
    if (!confirm(`⚠️ ¿ELIMINAR DEFINITIVAMENTE a ${empleadoEdit.nombre_completo}?`)) return;
    setCargando(true);
    await supabase.from('perfiles').delete().eq('id', empleadoEdit.id);
    await eliminarUsuarioAdmin(empleadoEdit.email, userEmail || 'Sistema');
    await registrarLog(userEmail || 'Sistema', 'ELIMINAR_EMPLEADO', `Eliminó el perfil de ${empleadoEdit.nombre_completo}`);
    
    alert("✅ Empleado eliminado");
    setEmpleadoEdit(null);
    cargarDatosGenerales();
    setCargando(false);
  };

  const handleCambiarPassword = async () => {
    if (nuevaPass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");
    setCargando(true);
    const res = await actualizarPasswordAdmin(empleadoEdit.email, nuevaPass, userEmail || 'Sistema');
    setCargando(false);
    if (res.success) { alert("✅ Contraseña actualizada"); setNuevaPass(''); } else { alert("❌ Error: " + res.error); }
  };

  const procesarExcel = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const bstr = event.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const mapaEmpleados: Record<string, { dependencia: string, cuota: number }> = {};
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const dataRaw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let indexNombre = -1, indexDependencia = -1, indexCuota = -1, filaInicio = -1;
        for (let i = 0; i < dataRaw.length; i++) {
          const fila = dataRaw[i];
          const nomIdx = fila.findIndex(c => typeof c === 'string' && c.toLowerCase().includes('nombre'));
          const depIdx = fila.findIndex(c => typeof c === 'string' && (c.toLowerCase().includes('adscripción') || c.toLowerCase().includes('dependencia') || c.toLowerCase().includes('área')));
          const cuoIdx = fila.findIndex(c => typeof c === 'string' && (c.toLowerCase().includes('vales') || c.toLowerCase().includes('cuota') || c.toLowerCase().includes('cantidad')));
          if (nomIdx !== -1) { indexNombre = nomIdx; indexDependencia = depIdx; indexCuota = cuoIdx; filaInicio = i + 1; break; }
        }
        if (indexNombre !== -1) {
          let ultimaDependencia = 'GENERAL'; 
          for (let i = filaInicio; i < dataRaw.length; i++) {
            const fila = dataRaw[i];
            if (!fila) continue;
            const nombre = String(fila[indexNombre] || '').toUpperCase().trim();
            const depRaw = indexDependencia !== -1 ? fila[indexDependencia] : null;
            if (depRaw && String(depRaw).trim() !== '') { ultimaDependencia = String(depRaw).toUpperCase().trim(); }
            const cuota = parseInt(String(indexCuota !== -1 ? fila[indexCuota] : 0)) || 0;
            if (nombre.length > 5 && !['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO','TOTAL'].some(p => nombre.includes(p))) {
              if (mapaEmpleados[nombre]) { mapaEmpleados[nombre].cuota += cuota; }
              else { mapaEmpleados[nombre] = { dependencia: ultimaDependencia, cuota }; }
            }
          }
        }
      });
      const listaFinal = Object.entries(mapaEmpleados).map(([nombre, datos]) => ({ nombre_completo: nombre, dependencia: datos.dependencia, tickets_restantes: datos.cuota, tickets_canjeado: 0, email: generarEmail(nombre) }));
      for (const emp of listaFinal) { 
        await supabase.from('perfiles').upsert(emp, { onConflict: 'nombre_completo' }); 
        await crearUsuarioAdmin(emp.email, emp.nombre_completo, userEmail || 'Sistema'); 
      }
      
      await registrarLog(userEmail || 'Sistema', 'CARGAR_EXCEL', `Cargó/Actualizó nómina con ${listaFinal.length} empleados`);
      alert(`✅ Procesados ${listaFinal.length} empleados.`);
      cargarDatosGenerales(); setCargando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const descargarAccesos = () => {
    const data = empleados.map(e => ({ Nombre: e.nombre_completo, Correo: e.email, Password_Temporal: "FGE2026*" }));
    const hoja = XLSX.utils.json_to_sheet(data);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Accesos");
    XLSX.writeFile(libro, "Lista_Accesos_FGE.xlsx");
  };

  const exportarHistorialExcel = () => {
    if (historial.length === 0) return alert("No hay registros");
    const data = historial.map(h => ({ Empleado: h.nombre_empleado, Fecha_Hora: new Date(h.fecha_hora).toLocaleString('es-MX') }));
    const hoja = XLSX.utils.json_to_sheet(data);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Bitacora");
    XLSX.writeFile(libro, "Reporte_Comedor_FGE.xlsx");
  };

  const generarCortePDF = (tipo: 'diario' | 'semanal') => {
    const doc = new jsPDF();
    const fechaActual = new Date();
    let datosFiltrados = historial;
    if (tipo === 'diario') {
      const hoy = fechaActual.toLocaleDateString('es-MX');
      datosFiltrados = historial.filter(h => new Date(h.fecha_hora).toLocaleDateString('es-MX') === hoy);
    }
    if (datosFiltrados.length === 0) return alert("Sin registros.");
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("FISCALÍA GENERAL DEL ESTADO DE YUCATÁN", 105, 20, { align: "center" });
    doc.setFontSize(12); doc.text(`CORTE OFICIAL - ${tipo.toUpperCase()}`, 105, 28, { align: "center" });
    autoTable(doc, {
      startY: 52,
      head: [['#', 'Nombre del Empleado', 'Fecha y Hora de Canje']],
      body: datosFiltrados.map((h, i) => [i + 1, h.nombre_empleado, new Date(h.fecha_hora).toLocaleString('es-MX')]),
      headStyles: { fillColor: [26, 39, 68] }, 
      margin: { bottom: 60 } 
    });
    const finalY = (doc as any).lastAutoTable.finalY + 40;
    doc.setFontSize(9); doc.line(25, finalY, 95, finalY); doc.text("AUTORIZA", 60, finalY + 5, { align: "center" });
    doc.text("M.D. JOSE MANUEL FLORES ACOSTA", 60, finalY + 10, { align: "center" });
    doc.line(115, finalY, 185, finalY); doc.text("RECIBE", 150, finalY + 5, { align: "center" });
    doc.text("KARLA XACUR TAMAYO", 150, finalY + 10, { align: "center" });
    doc.save(`Corte_${tipo.toUpperCase()}.pdf`);
  };

  const reiniciarSemana = async () => {
    if (!confirm("🔵 ¿Reiniciar vales para la nueva semana? Esto pondrá los contadores en 0 pero conservará a los empleados.")) return;
    setCargando(true);
    await supabase.from('historial_comedor').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('perfiles').update({ tickets_restantes: 0, tickets_canjeado: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    await registrarLog(userEmail || 'Sistema', 'REINICIO_SEMANA', 'Reinició los contadores y vació la bitácora para la nueva semana');
    
    alert("✅ Sistema listo para cargar el nuevo Excel de la semana.");
    cargarDatosGenerales(); setCargando(false);
  };

  const limpiarHistorialPruebas = async () => {
    if (!confirm("⚠️ ¿BORRAR TODO EL SISTEMA? Se eliminarán empleados y bitácora.")) return;
    setCargando(true);
    await supabase.from('historial_comedor').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('perfiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await registrarLog(userEmail || 'Sistema', 'LIMPIEZA_TOTAL', 'Eliminó toda la base de datos (Empleados y Bitácora)');
    
    cargarDatosGenerales(); setCargando(false);
  };

  const actualizarCuota = async (id: string, n: number) => { 
    if (n >= 0) { 
      const emp = empleados.find(e => e.id === id);
      await supabase.from('perfiles').update({ tickets_restantes: n }).eq('id', id); 
      if (emp) await registrarLog(userEmail || 'Sistema', 'AJUSTE_CUOTA', `Modificó cuota de ${emp.nombre_completo} a ${n} vales`);
      cargarDatosGenerales(); 
    } 
  };
  
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/dashboard'); };
  const empleadosFiltrados = empleados.filter(e => e.nombre_completo.toLowerCase().includes(filtroNombre.toLowerCase()) || e.dependencia.toLowerCase().includes(filtroNombre.toLowerCase()));
  const dependenciasArray = Object.entries(empleados.reduce((acc, emp) => {
    const dep = emp.dependencia || 'Sin Asignar';
    if (!acc[dep]) acc[dep] = { asignados: 0, canjeados: 0, disponibles: 0 };
    acc[dep].asignados += (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
    acc[dep].canjeados += (emp.tickets_canjeado || 0);
    acc[dep].disponibles += (emp.tickets_restantes || 0);
    return acc;
  }, {} as any)).map(([nombre, vals]: [string, any]) => ({ nombre, ...vals })).sort((a, b) => b.asignados - a.asignados);

  if (loadingAcceso) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <nav className="bg-[#1A2744] text-white p-4 shadow-xl flex justify-between items-center px-4 md:px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-10 h-10 flex items-center justify-center border border-[#C9A84C]/30 shadow-inner"><img src="/logo-fge.png" alt="FGE" className="w-full h-full object-contain rounded-full" /></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm md:text-lg uppercase tracking-tight">Dirección Administración</h1>
              {isSuperAdmin && <span className="bg-[#C9A84C] text-[#1A2744] text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm"><ShieldCheck size={10} /> SUPER ADMIN</span>}
            </div>
            <p className="text-[#C9A84C] text-[9px] font-bold">{userEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-white/10 p-2 rounded-xl hover:bg-red-500 transition-all"><LogOut size={18} /></button>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Asignados" val={stats.total} color="bg-slate-50" text="text-[#1A2744]" />
          <StatCard title="Canjeados" val={stats.canjeados} color="bg-emerald-50" text="text-emerald-500" />
          <StatCard title="Disponibles" val={stats.disponibles} color="bg-amber-50" text="text-[#C9A84C]" />
          <StatCard title="Dependencias" val={stats.dependencias} color="bg-purple-50" text="text-purple-600" />
        </div>

        <div className="flex gap-4 border-b mb-6 overflow-x-auto">
          {['cuotas', 'empleados', 'reportes', 'auditoría'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 font-bold text-xs uppercase border-b-4 transition-all ${activeTab === tab ? 'border-[#1A2744] text-[#1A2744]' : 'border-transparent text-slate-400'}`}>{tab}</button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8">
          
          {activeTab === 'cuotas' && (
            <div className="divide-y">
              {dependenciasArray.map((dep, i) => (
                <div key={i} className="flex py-4 items-center">
                  <div className="flex-1 font-bold text-xs uppercase">{dep.nombre}</div>
                  <div className="flex gap-4 text-[10px] font-black uppercase text-center">
                    <div className="w-12">Asig <br/> {dep.asignados}</div>
                    <div className="w-12 text-emerald-500">Canj <br/> {dep.canjeados}</div>
                    <div className="w-12 text-[#C9A84C]">Disp <br/> {dep.disponibles}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'empleados' && (
            <div className="animate-in fade-in">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Buscar empleado..." value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-xl" />
                </div>
                <button onClick={() => setModalNuevo(true)} className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-emerald-900/10"><UserPlus size={16}/> Alta Manual</button>
                <input type="file" className="hidden" ref={fileInputRef} onChange={procesarExcel} />
                <button onClick={() => fileInputRef.current?.click()} className="bg-[#1A2744] text-white px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shrink-0 shadow-lg">
                  {cargando ? <Loader2 className="animate-spin" size={16}/> : <FileSpreadsheet size={16}/>} Cargar Nómina
                </button>
                <button onClick={descargarAccesos} className="bg-slate-100 text-[#1A2744] px-4 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 shrink-0 hover:bg-slate-200">
                  <Download size={16}/> Accesos
                </button>
              </div>
              <div className="overflow-x-auto border rounded-2xl max-h-[500px]">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 sticky top-0 text-[10px] uppercase font-bold border-b z-10">
                    <tr><th className="p-4">Empleado</th><th className="p-4">Correo Institucional</th><th className="p-4 text-center">Cuota</th><th className="p-4 text-right">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {empleadosFiltrados.map((emp, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-xs uppercase">{emp.nombre_completo}</td>
                        <td className="p-4 text-[10px] text-blue-600 font-bold">{emp.email}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => actualizarCuota(emp.id, emp.tickets_restantes - 1)} className="w-6 h-6 rounded bg-slate-100 font-bold">-</button>
                            <span className="font-black text-sm">{emp.tickets_restantes}</span>
                            <button onClick={() => actualizarCuota(emp.id, emp.tickets_restantes + 1)} className="w-6 h-6 rounded bg-slate-100 font-bold">+</button>
                          </div>
                        </td>
                        <td className="p-4 text-right"><button onClick={() => setEmpleadoEdit(emp)} className="text-slate-400 p-2 hover:text-[#C9A84C] transition-colors"><UserCog size={18}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reportes' && (
            <div className="animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h3 className="text-lg font-black uppercase">Control Bitácora</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={reiniciarSemana} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-md"><RefreshCw size={16}/> Reiniciar para Nueva Semana</button>
                  {isSuperAdmin && (
                    <button onClick={limpiarHistorialPruebas} className="border-2 border-red-100 text-red-500 px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16}/></button>
                  )}
                  <button onClick={exportarHistorialExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors"><FileSpreadsheet size={16}/> Excel</button>
                  <button onClick={() => generarCortePDF('diario')} className="bg-[#1A2744] hover:bg-[#2a3f6d] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors"><FileText size={16}/> PDF Diario</button>
                  <button onClick={() => generarCortePDF('semanal')} className="bg-[#C9A84C] hover:bg-[#e0bc5a] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors"><FileText size={16}/> PDF Semanal</button>
                </div>
              </div>
              <div className="overflow-x-auto border rounded-2xl max-h-[400px]">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold border-b">
                    <tr><th className="p-4">Empleado</th><th className="p-4">Fecha/Hora</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {historial.map((h, i) => (
                      <tr key={i} className="text-[11px]"><td className="p-4 font-bold uppercase">{h.nombre_empleado}</td><td className="p-4">{new Date(h.fecha_hora).toLocaleString('es-MX')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'auditoría' && (
            <div className="animate-in fade-in">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black uppercase flex items-center gap-2"><ShieldCheck className="text-[#C9A84C]" size={24} /> Registro de Seguridad</h3>
                <button onClick={cargarDatosGenerales} className="text-xs font-bold text-slate-400 hover:text-[#1A2744] flex items-center gap-1 transition-colors"><RefreshCw size={14}/> Actualizar</button>
              </div>
              <div className="overflow-x-auto border rounded-2xl max-h-[500px]">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 sticky top-0 text-[10px] uppercase font-bold border-b z-10">
                    <tr>
                      <th className="p-4 w-40">Fecha / Hora</th>
                      <th className="p-4">Administrador</th>
                      <th className="p-4">Acción</th>
                      <th className="p-4">Detalle del Movimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditoriaLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50 text-[11px]">
                        <td className="p-4 whitespace-nowrap text-slate-500 font-medium">{new Date(log.creado_en).toLocaleString('es-MX')}</td>
                        <td className="p-4 font-black text-[#1A2744]">{log.admin_email}</td>
                        <td className="p-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-black tracking-wider uppercase border border-slate-200">
                            {log.accion}
                          </span>
                        </td>
                        <td className="p-4 uppercase font-bold text-slate-500">{log.detalle}</td>
                      </tr>
                    ))}
                    {auditoriaLogs.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold uppercase text-xs">No hay movimientos registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODALES MANTENIDOS EXACTAMENTE IGUAL */}
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
                  <button onClick={handleCambiarPassword} disabled={cargando} className="bg-[#1A2744] hover:bg-[#C9A84C] text-white px-4 rounded-lg transition-colors flex items-center justify-center">{cargando ? <Loader2 className="animate-spin" size={16} /> : <Key size={16}/>}</button>
                </div>
              </div>
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <label className="text-[10px] font-black uppercase text-red-400 block mb-2">Zona de Peligro</label>
                <button onClick={handleEliminarEmpleado} disabled={cargando} className="w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors">{cargando ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>} Eliminar Empleado</button>
              </div>
              <button onClick={() => setEmpleadoEdit(null)} className="w-full py-4 text-xs font-black uppercase text-slate-400 hover:text-[#1A2744] transition-colors">Cerrar Ventana</button>
            </div>
          </div>
        </div>
      )}

      {modalNuevo && (
        <div className="fixed inset-0 bg-[#1A2744]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black text-[#1A2744] uppercase mb-6">Alta Manual de Empleado</h2>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre Completo</label><input type="text" placeholder="Ej. JUAN PEREZ LOPEZ" value={nuevoEmp.nombre} onChange={e => setNuevoEmp({...nuevoEmp, nombre: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm uppercase outline-none focus:border-[#C9A84C]" /></div>
              <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Dependencia</label><input type="text" placeholder="Ej. ADMINISTRACION" value={nuevoEmp.dependencia} onChange={e => setNuevoEmp({...nuevoEmp, dependencia: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm uppercase outline-none focus:border-[#C9A84C]" /></div>
              <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Cuota Semanal</label><input type="number" min="0" value={nuevoEmp.cuota} onChange={e => setNuevoEmp({...nuevoEmp, cuota: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-[#C9A84C]" /></div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setModalNuevo(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-400 hover:text-red-500 transition-colors">Cancelar</button>
                <button onClick={guardarNuevoEmpleado} disabled={cargando} className="flex-1 bg-[#1A2744] text-white py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors">{cargando ? <Loader2 className="animate-spin" size={16} /> : 'Guardar Empleado'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, val, color, text }: any) {
  return (
    <div className={`${color} p-5 rounded-3xl border shadow-sm`}>
      <h2 className={`text-3xl md:text-4xl font-black ${text}`}>{val}</h2>
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">{title}</p>
    </div>
  );
}