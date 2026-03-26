'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, FileSpreadsheet, Search, UserCog, Key, Trash2, Download, UserPlus, FileText, ShieldCheck, RefreshCw, ChefHat, UtensilsCrossed, Users, Ticket, Building2, Terminal } from 'lucide-react';
import { crearUsuarioAdmin, eliminarUsuarioAdmin, actualizarPasswordAdmin, registrarLog } from './actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getLunesOpciones = () => {
  const hoy = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Merida"}));
  const dia = hoy.getDay();
  const dif = hoy.getDate() - dia + (dia === 0 ? -6 : 1); 
  const lunesActual = new Date(hoy.setDate(dif));
  
  const formatea = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dStr}`;
  };

  const l1 = new Date(lunesActual); l1.setDate(l1.getDate() + 7);
  const l2 = new Date(lunesActual); l2.setDate(l2.getDate() + 14);
  const l3 = new Date(lunesActual); l3.setDate(l3.getDate() + 21);

  return [
    { label: 'Semana Actual (Aplica de Inmediato)', value: 'actual' },
    { label: `Próxima Semana (Lunes ${formatea(l1)})`, value: formatea(l1) },
    { label: `En 2 Semanas (Lunes ${formatea(l2)})`, value: formatea(l2) },
    { label: `En 3 Semanas (Lunes ${formatea(l3)})`, value: formatea(l3) }
  ];
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('cuotas');
  const [historial, setHistorial] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [auditoriaLogs, setAuditoriaLogs] = useState<any[]>([]);
  const [cuotasProgramadas, setCuotasProgramadas] = useState<any[]>([]);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [stats, setStats] = useState({ total: 0, canjeados: 0, disponibles: 0, dependencias: 0 });
  const [cargando, setCargando] = useState(false);
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [empleadoEdit, setEmpleadoEdit] = useState<any>(null);
  const [nuevaPass, setNuevaPass] = useState('');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoEmp, setNuevoEmp] = useState({ nombre: '', dependencia: '', cuota: 1 });

  const [modalProgramar, setModalProgramar] = useState(false);
  const [datosPendientesExcel, setDatosPendientesExcel] = useState<any[]>([]);
  const [semanaDestino, setSemanaDestino] = useState('actual');

  useEffect(() => {
    const checkAccess = async () => {
      setTimeout(async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { router.push('/dashboard'); return; }
        
        const email = session.user.email?.toLowerCase() || '';
        
        // NUEVA SEGURIDAD POR ROLES
        const { data: miPerfil } = await supabase.from('perfiles').select('rol').eq('email', email).maybeSingle();
        const rol = miPerfil?.rol || 'empleado';

        const esTuCuenta = email === 'admin.cristobal@fge.gob.mx' || rol === 'dev';
        const esAdminOficial = rol === 'admin' || email.startsWith('admin.') || email.includes('.admin@'); 
        
        if (!esTuCuenta && !esAdminOficial) {
          router.push('/dashboard');
          return;
        }
        
        setIsSuperAdmin(esTuCuenta);
        setIsDev(rol === 'dev');
        setUserEmail(email);
        setLoadingAcceso(false);
        cargarDatosGenerales();
      }, 300); 
    };
    checkAccess();
  }, [router]);

  const cargarDatosGenerales = async () => {
    const { data: dataEmpleados } = await supabase.from('perfiles').select('*').order('nombre_completo', { ascending: true });
    
    if (dataEmpleados) {
      setEmpleados(dataEmpleados);
      
      // BLINDAJE MATEMÁTICO: IGNORAR CUENTAS DEV Y DE PRUEBA EN LAS ESTADÍSTICAS
      const empleadosReales = dataEmpleados.filter(e => e.rol !== 'dev' && !e.dependencia?.toUpperCase().includes('PRUEBA'));
      
      const dependenciasUnicas = new Set(empleadosReales.map(e => e.dependencia)).size;
      let totalAsignados = 0; 
      let totalCanjeados = 0;
      
      empleadosReales.forEach(emp => {
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

    const { data: dataHistorial } = await supabase.from('historial_comedor').select('*').order('fecha_hora', { ascending: false });
    if (dataHistorial) setHistorial(dataHistorial);

    const { data: dataLogs } = await supabase.from('auditoria_logs').select('*').order('creado_en', { ascending: false }).limit(200);
    if (dataLogs) setAuditoriaLogs(dataLogs);

    const { data: dataProg } = await supabase.from('cuotas_programadas').select('*');
    if (dataProg) setCuotasProgramadas(dataProg);
  };

  const generarEmail = (nombreCompleto: string) => {
    const limpio = nombreCompleto.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const partes = limpio.split(/\s+/);
    
    let nombre = "";
    let apellido = "";

    if (partes.length >= 3) {
      nombre = partes[0];
      apellido = partes[partes.length - 2]; 
    } else if (partes.length === 2) {
      nombre = partes[0];
      apellido = partes[1];
    } else {
      nombre = partes[0];
      apellido = "";
    }

    const baseEmail = apellido ? `${nombre}.${apellido}` : nombre;
    return `${baseEmail}@fge.gob.mx`;
  };

  const guardarNuevoEmpleado = async () => {
    if (nuevoEmp.nombre.length < 5) return alert("Ingresa el nombre completo");
    setCargando(true);
    const emailGen = generarEmail(nuevoEmp.nombre);
    
    const empData = { 
        nombre_completo: nuevoEmp.nombre.toUpperCase().trim(), 
        dependencia: nuevoEmp.dependencia.toUpperCase().trim() || 'GENERAL', 
        tickets_restantes: nuevoEmp.cuota, 
        tickets_canjeado: 0, 
        email: emailGen 
    };
    
    await supabase.from('perfiles').upsert(empData, { onConflict: 'nombre_completo' });
    await crearUsuarioAdmin(emailGen, empData.nombre_completo, userEmail || 'Sistema', 'FGE2026*');
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

  const procesarExcel = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    const reader = new FileReader();

    reader.onload = async (event: any) => {
      try {
        const bstr = event.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const dataRaw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let indexNombre = -1;
        let indexDependencia = -1;
        let indexCuotaDirecta = -1;
        let indicesDias: number[] = [];
        let filaInicio = -1;

        for (let i = 0; i < dataRaw.length; i++) {
          const fila = dataRaw[i];
          if (!fila) continue;

          const nomIdx = fila.findIndex(c => String(c).toUpperCase().includes('NOMBRE'));

          if (nomIdx !== -1) {
            indexNombre = nomIdx;
            filaInicio = i + 1;

            const diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'SÁBADO', 'DOMINGO'];

            fila.forEach((col, idx) => {
              const colUpper = String(col).toUpperCase();
              if (colUpper.includes('DEPENDENCIA') || colUpper.includes('AREA') || colUpper.includes('ADSCRIP')) {
                indexDependencia = idx;
              } else if (colUpper.match(/VALES|CUOTA|CANTIDAD|TICKET|TICEKT|RESTANTE/)) {
                indexCuotaDirecta = idx;
              } else if (diasSemana.some(d => colUpper.includes(d))) {
                indicesDias.push(idx);
              }
            });
            break;
          }
        }

        if (indexNombre === -1) {
          alert("❌ No se detectó la columna 'NOMBRE' en el Excel.");
          setCargando(false);
          return;
        }

        let ultimaDependencia = 'GENERAL';
        const empleadosExtraidos = [];

        for (let i = filaInicio; i < dataRaw.length; i++) {
          const fila = dataRaw[i];
          if (!fila || !fila[indexNombre]) continue;

          const nombreLimpio = String(fila[indexNombre]).toUpperCase().trim();
          if (nombreLimpio.length < 5 || nombreLimpio.includes('TOTAL') || nombreLimpio.includes('NOTA')) continue;

          const depRaw = indexDependencia !== -1 ? fila[indexDependencia] : null;
          if (depRaw && String(depRaw).trim() !== '') {
            ultimaDependencia = String(depRaw).toUpperCase().trim();
          }

          let totalValesCalculados = 0;

          if (indicesDias.length > 0) {
            indicesDias.forEach(idx => {
              const valorDia = String(fila[idx] || '').toUpperCase().trim();
              if (valorDia.includes('DOBLE') || valorDia === '2') {
                totalValesCalculados += 2;
              } else if (valorDia.includes('AM') || valorDia.includes('PM') || valorDia.includes('INTERMEDIO') || valorDia === '1') {
                totalValesCalculados += 1;
              }
            });
          } else if (indexCuotaDirecta !== -1) {
            totalValesCalculados = parseInt(String(fila[indexCuotaDirecta])) || 0;
          }

          empleadosExtraidos.push({
            nombre_completo: nombreLimpio,
            dependencia: ultimaDependencia,
            tickets_restantes: totalValesCalculados,
            emailGen: generarEmail(nombreLimpio)
          });
        }

        setDatosPendientesExcel(empleadosExtraidos);
        setModalProgramar(true);
        setCargando(false);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err) {
        console.error(err);
        alert("❌ Error interno al procesar el archivo. Revisa su formato.");
        setCargando(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmarCargaExcel = async () => {
    setCargando(true);
    let procesados = 0;
    
    try {
      if (semanaDestino === 'actual') {
        for (const empData of datosPendientesExcel) {
          await supabase.from('perfiles').upsert({
            nombre_completo: empData.nombre_completo,
            dependencia: empData.dependencia,
            tickets_restantes: empData.tickets_restantes,
            tickets_canjeado: 0,
            email: empData.emailGen
          }, { onConflict: 'nombre_completo' });
          
          await crearUsuarioAdmin(empData.emailGen, empData.nombre_completo, userEmail || 'Sistema', 'FGE2026*');
          procesados++;
        }
      } else {
        const { data: perfilesActuales } = await supabase.from('perfiles').select('id, nombre_completo');
        const mapaPerfiles = new Map(perfilesActuales?.map(p => [p.nombre_completo, p.id]) || []);

        for (const empData of datosPendientesExcel) {
          let empId = mapaPerfiles.get(empData.nombre_completo);

          if (!empId) {
            const { data: nuevoPerfil } = await supabase.from('perfiles').insert({
              nombre_completo: empData.nombre_completo,
              dependencia: empData.dependencia,
              tickets_restantes: 0, 
              tickets_canjeado: 0,
              email: empData.emailGen
            }).select('id').single();
            
            if (nuevoPerfil) {
              empId = nuevoPerfil.id;
              await crearUsuarioAdmin(empData.emailGen, empData.nombre_completo, userEmail || 'Sistema', 'FGE2026*');
            }
          }

          if (empId) {
            await supabase.from('cuotas_programadas').delete().match({ empleado_id: empId, fecha_lunes: semanaDestino });
            await supabase.from('cuotas_programadas').insert({ empleado_id: empId, fecha_lunes: semanaDestino, cuota: empData.tickets_restantes });
            procesados++;
          }
        }
      }

      await registrarLog(userEmail || 'Sistema', 'CARGAR_EXCEL', `Programó nómina: ${procesados} empleados (${semanaDestino === 'actual' ? 'Semana Actual' : semanaDestino})`);
      alert(`✅ Éxito: Se programaron ${procesados} empleados para ${semanaDestino === 'actual' ? 'la semana actual' : 'el lunes ' + semanaDestino}.`);
    } catch (err) {
       console.error(err);
       alert("❌ Error interno al programar cuotas.");
    } finally {
      setModalProgramar(false);
      setDatosPendientesExcel([]);
      cargarDatosGenerales();
      setCargando(false);
    }
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
    const data = historial.map(h => ({ Empleado: h.nombre_empleado, Dependencia: h.dependencia, Fecha_Hora: new Date(h.fecha_hora).toLocaleString('es-MX') }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Canjes"); XLSX.writeFile(wb, `Reporte_Cajero_${new Date().getTime()}.xlsx`);
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
  
  // BLINDAJE MATEMÁTICO: IGNORAR DEV/PRUEBAS EN LA TABLA DE DEPENDENCIAS
  const dependenciasArray = Object.entries(empleados.reduce((acc, emp) => {
    if (emp.rol === 'dev' || emp.dependencia?.toUpperCase().includes('PRUEBA')) return acc;
    
    const dep = emp.dependencia || 'Sin Asignar';
    if (!acc[dep]) acc[dep] = { asignados: 0, canjeados: 0, disponibles: 0 };
    acc[dep].asignados += (emp.tickets_restantes || 0) + (emp.tickets_canjeado || 0);
    acc[dep].canjeados += (emp.tickets_canjeado || 0);
    acc[dep].disponibles += (emp.tickets_restantes || 0);
    return acc;
  }, {} as any)).map(([nombre, vals]: [string, any]) => ({ nombre, ...vals })).sort((a, b) => b.asignados - a.asignados);

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
            <p className="text-[10px] font-black tracking-[0.3em] uppercase">Autenticando Administración...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A2744] font-sans pb-20 relative">
      
      {/* BACKGROUND DECORATION */}
      <div className="fixed top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[#1A2744] to-[#F8FAFC] -z-10"></div>
      <div className="fixed top-[-20%] right-[-10%] w-[60vh] h-[60vh] bg-amber-500/10 rounded-full blur-[100px] -z-10"></div>

      {/* NAVBAR PREMIUM */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50 shadow-sm flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-2xl rotate-3 flex items-center justify-center shadow-lg border border-slate-700/50 shrink-0 group hover:rotate-6 transition-transform duration-300">
            <UtensilsCrossed className="absolute text-white/10 w-6 h-6 -rotate-3" strokeWidth={1.5} />
            <ChefHat className="relative text-amber-400 -rotate-3 group-hover:scale-110 transition-transform duration-300" size={20} strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight text-[#1A2744]">Administración</h1>
              {isSuperAdmin && <span className="bg-amber-400 text-[#1A2744] text-[8px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm tracking-widest"><ShieldCheck size={10} /> SUPER ADMIN</span>}
            </div>
            <p className="text-amber-500 text-[9px] font-black tracking-[0.2em] uppercase mt-0.5">{userEmail}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* ACCESO SECRETO PARA DEV */}
          {isDev && (
            <button 
              onClick={() => router.push('/dev-panel')} 
              className="bg-amber-50 text-amber-600 p-2.5 rounded-xl active:bg-amber-100 transition-all border border-amber-100 anim-latido active:scale-95 hidden md:block"
              title="Panel Developer"
            >
              <Terminal size={18} />
            </button>
          )}
          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-100 active:scale-95 transition-all border border-red-100"><LogOut size={18} /></button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 relative z-10">
        
        {/* STATS HEADERS PREMIUM */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 anim-fade-up" style={{animationDelay: '100ms'}}>
          <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-slate-50 opacity-50 group-hover:scale-110 transition-transform"><Ticket size={100} /></div>
            <h2 className="text-4xl font-black text-[#1A2744] relative z-10">{stats.total}</h2>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mt-1 relative z-10">Vales Asignados</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-emerald-50 opacity-50 group-hover:scale-110 transition-transform"><CheckCircle2 size={100} /></div>
            <h2 className="text-4xl font-black text-emerald-500 relative z-10">{stats.canjeados}</h2>
            <p className="text-emerald-600/60 text-[9px] font-black uppercase tracking-[0.2em] mt-1 relative z-10">Vales Canjeados</p>
          </div>
          <div className="bg-[#1A2744] p-6 rounded-[2rem] shadow-xl shadow-[#1A2744]/20 border border-[#2A3F6D] flex flex-col items-center justify-center hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute -right-6 -top-6 text-white/5 group-hover:scale-110 transition-transform"><Layers size={100} /></div>
            <h2 className="text-4xl font-black text-white relative z-10">{stats.disponibles}</h2>
            <p className="text-amber-400 text-[9px] font-black uppercase tracking-[0.2em] mt-1 relative z-10">Stock Disponible</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 text-blue-50 opacity-50 group-hover:scale-110 transition-transform"><Building2 size={100} /></div>
            <h2 className="text-4xl font-black text-blue-600 relative z-10">{stats.dependencias}</h2>
            <p className="text-blue-500/60 text-[9px] font-black uppercase tracking-[0.2em] mt-1 relative z-10">Áreas Activas</p>
          </div>
        </div>

        {/* TABS STYLING PREMIUM */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white overflow-hidden anim-fade-up" style={{animationDelay: '200ms'}}>
          
          <div className="flex p-3 gap-2 overflow-x-auto bg-slate-50/50 border-b border-slate-100 no-scrollbar">
            {[
              { id: 'cuotas', label: 'Cuotas Globales', icon: <Building2 size={16}/> },
              { id: 'empleados', label: 'Plantilla Laboral', icon: <Users size={16}/> },
              { id: 'reportes', label: 'Reportes y Cierres', icon: <FileText size={16}/> },
              { id: 'auditoría', label: 'Security Logs', icon: <ShieldCheck size={16}/> }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)} 
                className={`flex-1 min-w-[150px] py-3.5 px-4 rounded-[1.2rem] font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden ${activeTab === tab.id ? 'bg-[#1A2744] text-amber-400 shadow-xl shadow-[#1A2744]/20 scale-100' : 'bg-transparent text-slate-500 hover:bg-slate-100 active:scale-95'}`}
              >
                {tab.icon} <span className="mt-0.5">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-10 min-h-[500px]">
            
            {activeTab === 'cuotas' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                  <div className="bg-blue-50 p-2.5 rounded-xl text-blue-500"><Building2 size={20}/></div>
                  <div>
                    <h3 className="text-[#1A2744] font-black text-lg uppercase tracking-tight">Desglose por Dependencia</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Control de cuotas asignadas</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {dependenciasArray.map((dep, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-200 transition-all group">
                      <div className="mb-4 sm:mb-0">
                        <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-[0.2em] mb-2 inline-block">Área / Depto</span>
                        <h4 className="font-black text-sm uppercase text-[#1A2744] group-hover:text-blue-600 transition-colors">{dep.nombre}</h4>
                      </div>
                      <div className="flex gap-3 sm:gap-6 justify-between sm:justify-end">
                        <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 text-center min-w-[80px]">
                          <p className="text-xl font-black text-[#1A2744] leading-none mb-1">{dep.asignados}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Asignados</p>
                        </div>
                        <div className="bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-100 text-center min-w-[80px]">
                          <p className="text-xl font-black text-emerald-600 leading-none mb-1">{dep.canjeados}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Canjeados</p>
                        </div>
                        <div className="bg-amber-50 px-4 py-3 rounded-2xl border border-amber-100 text-center min-w-[80px]">
                          <p className="text-xl font-black text-amber-500 leading-none mb-1">{dep.disponibles}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-amber-500/70">Disponibles</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {dependenciasArray.length === 0 && (
                    <div className="py-20 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin datos para contabilizar</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'empleados' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex flex-col xl:flex-row gap-4 mb-8">
                  <div className="relative flex-1 group/input">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-amber-500 transition-colors" size={20} />
                    <input type="text" placeholder="Buscar por nombre o dependencia..." value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} className="w-full pl-14 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all uppercase placeholder:font-normal placeholder:text-slate-400" />
                  </div>
                  <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                    <button onClick={() => setModalNuevo(true)} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"><UserPlus size={16}/> Alta Manual</button>
                    <input type="file" className="hidden" ref={fileInputRef} onChange={procesarExcel} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none bg-[#1A2744] hover:bg-[#25365d] active:scale-95 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-[#1A2744]/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                      {cargando ? <Loader2 className="animate-spin text-amber-400" size={16}/> : <FileSpreadsheet size={16} className="text-amber-400"/>} Cargar Nómina
                    </button>
                    <button onClick={descargarAccesos} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 active:scale-95 text-[#1A2744] px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 whitespace-nowrap border border-slate-200">
                      <Download size={16}/> Accesos
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto border border-slate-100 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] bg-white max-h-[600px] no-scrollbar">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0 text-[9px] tracking-[0.2em] uppercase font-black text-slate-400 border-b border-slate-100 z-10">
                      <tr>
                        <th className="p-5 pl-8">Empleado Registrado</th>
                        <th className="p-5">Correo Institucional</th>
                        <th className="p-5 text-center">Cuota Actual</th>
                        <th className="p-5 text-center">Programado (Futuro)</th>
                        <th className="p-5 text-right pr-8">Ajustes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {empleadosFiltrados.map((emp, i) => {
                        const cuotaFutura = cuotasProgramadas.find(c => c.empleado_id === emp.id);
                        return (
                          <tr key={i} className={`hover:bg-slate-50/50 transition-colors group ${emp.rol === 'dev' ? 'opacity-50 grayscale hover:opacity-100' : ''}`}>
                            <td className="p-5 pl-8">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs border border-slate-200 uppercase">{emp.nombre_completo.substring(0,2)}</div>
                                  <div>
                                    <p className="font-black text-[#1A2744] text-xs uppercase flex items-center gap-2">
                                      {emp.nombre_completo}
                                      {emp.rol === 'dev' && <span className="bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded tracking-widest shadow-sm">DEV</span>}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{emp.dependencia}</p>
                                  </div>
                                </div>
                            </td>
                            <td className="p-5 text-[10px] text-slate-500 font-bold">{emp.email}</td>
                            <td className="p-5">
                              <div className="flex items-center justify-center gap-2 bg-slate-50 w-max mx-auto p-1.5 rounded-2xl border border-slate-100">
                                <button onClick={() => actualizarCuota(emp.id, emp.tickets_restantes - 1)} className="w-8 h-8 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors flex items-center justify-center"><Minus size={14}/></button>
                                <span className="font-black text-[#1A2744] text-sm w-6 text-center">{emp.tickets_restantes}</span>
                                <button onClick={() => actualizarCuota(emp.id, emp.tickets_restantes + 1)} className="w-8 h-8 rounded-xl bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-colors flex items-center justify-center"><Plus size={14}/></button>
                              </div>
                            </td>
                            <td className="p-5 text-center">
                              {cuotaFutura ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                                    <Ticket size={12}/> {cuotaFutura.cuota} vales
                                  </span>
                                  <span className="text-slate-400 text-[8px] font-bold uppercase tracking-widest flex items-center gap-1"><CalendarPlus size={10}/> Lunes {cuotaFutura.fecha_lunes}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 bg-slate-50 px-3 py-1 rounded-md text-[10px] font-black border border-slate-100">-</span>
                              )}
                            </td>
                            <td className="p-5 text-right pr-8">
                                <button onClick={() => setEmpleadoEdit(emp)} className="text-slate-400 p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 hover:text-amber-500 hover:border-amber-200 active:scale-95 transition-all"><UserCog size={18}/></button>
                            </td>
                          </tr>
                        );
                      })}
                      {empleadosFiltrados.length === 0 && (
                        <tr><td colSpan={5} className="py-20 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">No se encontraron empleados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reportes' && (
              <div className="animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-slate-100 pb-6">
                  <div>
                    <h3 className="text-[#1A2744] font-black text-lg uppercase tracking-tight">Reportes y Auditoría</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Control y Cierres de Bitácora</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={reiniciarSemana} className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 transition-all border border-blue-200 active:scale-95"><RefreshCw size={16}/> Nueva Semana</button>
                    {isSuperAdmin && (
                      <button onClick={limpiarHistorialPruebas} className="bg-red-50 hover:bg-red-100 text-red-500 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 transition-all border border-red-200 active:scale-95"><Trash2 size={16}/> Purgar Todo</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                  <button onClick={exportarHistorialExcel} className="group flex flex-col items-center justify-center p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1)] hover:border-emerald-200 transition-all duration-300 active:scale-95">
                    <div className="bg-emerald-50 text-emerald-500 p-5 rounded-[1.5rem] mb-6 group-hover:scale-110 transition-transform duration-300"><FileSpreadsheet size={40} strokeWidth={1.5}/></div>
                    <span className="font-black text-[#1A2744] text-xs uppercase tracking-widest mb-1">Data Excel</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Base en crudo</span>
                  </button>
                  
                  <button onClick={() => generarCortePDF('diario')} className="group flex flex-col items-center justify-center p-10 bg-[#1A2744] border border-[#2A3F6D] rounded-[2.5rem] shadow-[0_10px_30px_rgba(26,39,68,0.2)] hover:shadow-[0_20px_40px_rgba(26,39,68,0.4)] hover:bg-[#2A3F6D] transition-all duration-300 relative overflow-hidden active:scale-95">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="bg-blue-500/20 text-blue-400 p-5 rounded-[1.5rem] mb-6 group-hover:scale-110 transition-transform duration-300 border border-blue-500/30 relative z-10"><FileText size={40} strokeWidth={1.5}/></div>
                    <span className="font-black text-white text-xs uppercase tracking-widest mb-1 relative z-10">Corte Diario</span>
                    <span className="text-[9px] text-blue-300/70 font-bold uppercase tracking-widest relative z-10">PDF Oficial</span>
                  </button>

                  <button onClick={() => generarCortePDF('semanal')} className="group flex flex-col items-center justify-center p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(251,191,36,0.1)] hover:border-amber-200 transition-all duration-300 active:scale-95">
                    <div className="bg-amber-50 text-amber-500 p-5 rounded-[1.5rem] mb-6 group-hover:scale-110 transition-transform duration-300"><FileText size={40} strokeWidth={1.5}/></div>
                    <span className="font-black text-[#1A2744] text-xs uppercase tracking-widest mb-1">Concentrado</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Semanal PDF</span>
                  </button>
                </div>

                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                    <History size={18} className="text-slate-400" />
                    <h4 className="text-xs font-black text-[#1A2744] uppercase tracking-widest">Pre-visualización de Canjes (Bitácora)</h4>
                  </div>
                  <div className="overflow-x-auto max-h-[300px] no-scrollbar">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 sticky top-0 text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] border-b border-slate-100 z-10">
                        <tr><th className="p-5 pl-8">Empleado Registrado</th><th className="p-5 text-right pr-8">Fecha y Hora de Canje</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {historial.map((h, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-5 pl-8 font-black text-xs text-[#1A2744] uppercase">{h.nombre_empleado}</td>
                            <td className="p-5 text-right pr-8 text-[10px] font-bold text-slate-500">{new Date(h.fecha_hora).toLocaleString('es-MX')}</td>
                          </tr>
                        ))}
                        {historial.length === 0 && <tr><td colSpan={2} className="py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin registros</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'auditoría' && (
              <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500"><ShieldCheck size={20}/></div>
                    <div>
                      <h3 className="text-[#1A2744] font-black text-lg uppercase tracking-tight">Security Logs</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Auditoría de acciones administrativas</p>
                    </div>
                  </div>
                  <button onClick={cargarDatosGenerales} className="text-[10px] font-black text-slate-400 hover:text-[#1A2744] flex items-center gap-1.5 transition-colors uppercase tracking-widest bg-white p-3 rounded-xl border border-slate-100 shadow-sm active:scale-95"><RefreshCw size={14}/> Sincronizar</button>
                </div>
                
                <div className="overflow-x-auto border border-slate-100 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] bg-white max-h-[600px] no-scrollbar">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0 text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] border-b border-slate-100 z-10">
                      <tr>
                        <th className="p-5 pl-8 w-48">Fecha / Hora</th>
                        <th className="p-5">Usuario Admin</th>
                        <th className="p-5">Acción Ejecutada</th>
                        <th className="p-5 pr-8">Detalle Técnico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {auditoriaLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-5 pl-8 whitespace-nowrap text-[10px] font-bold text-slate-500">{new Date(log.creado_en).toLocaleString('es-MX')}</td>
                          <td className="p-5 font-black text-xs text-[#1A2744] group-hover:text-amber-600 transition-colors">{log.admin_email}</td>
                          <td className="p-5">
                            <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase border border-slate-200 group-hover:border-slate-300 transition-colors">
                              {log.accion}
                            </span>
                          </td>
                          <td className="p-5 text-[10px] font-bold text-slate-500 uppercase pr-8 leading-relaxed">{log.detalle}</td>
                        </tr>
                      ))}
                      {auditoriaLogs.length === 0 && (
                        <tr><td colSpan={4} className="p-16 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">No hay movimientos en el registro</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* MODAL PROGRAMAR SEMANA */}
      {modalProgramar && (
        <div className="fixed inset-0 bg-[#1A2744]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-white/10">
            <div className="bg-slate-50 p-8 border-b border-slate-100 text-center relative">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-[1.5rem] rotate-3 flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-100"><CalendarPlus size={28} className="-rotate-3"/></div>
              <h2 className="text-xl font-black text-[#1A2744] uppercase tracking-tight">Programar Cuotas</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Nómina detectada: <span className="text-blue-600 font-black bg-blue-100 px-2 py-0.5 rounded">{datosPendientesExcel.length} Empleados</span></p>
            </div>
            
            <div className="p-8">
              <div className="space-y-3 mb-8">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block ml-1">Selecciona la semana de aplicación</label>
                <select 
                  value={semanaDestino} 
                  onChange={e => setSemanaDestino(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 p-4 rounded-2xl text-xs font-black text-[#1A2744] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10 transition-all uppercase cursor-pointer"
                >
                  {getLunesOpciones().map((op, i) => (
                    <option key={i} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <button onClick={() => { setModalProgramar(false); setDatosPendientesExcel([]); }} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-[#1A2744] transition-colors bg-slate-50 rounded-2xl hover:bg-slate-100">Cancelar</button>
                <button onClick={confirmarCargaExcel} disabled={cargando} className="flex-[2] bg-[#1A2744] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-[#25365d] active:scale-95 transition-all shadow-xl shadow-[#1A2744]/20 disabled:opacity-50 disabled:active:scale-100">
                  {cargando ? <Loader2 className="animate-spin text-amber-400" size={18} /> : 'Guardar y Procesar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIONAR EMPLEADO */}
      {empleadoEdit && (
        <div className="fixed inset-0 bg-[#1A2744]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-white/10">
            <div className="bg-gradient-to-b from-slate-50 to-white p-10 text-center relative border-b border-slate-100">
               <button onClick={() => setEmpleadoEdit(null)} className="absolute top-6 right-6 text-slate-400 hover:text-red-500 bg-white p-2 rounded-full shadow-sm border border-slate-100 transition-colors active:scale-90"><X size={16}/></button>
               <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2rem] rotate-3 flex items-center justify-center mx-auto mb-6 shadow-sm border border-amber-100"><UserCog size={36} className="-rotate-3"/></div>
               <h2 className="text-2xl font-black text-[#1A2744] uppercase mb-2 tracking-tight">Gestión de Identidad</h2>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-100 inline-block px-3 py-1 rounded-md">{empleadoEdit.nombre_completo}</p>
            </div>

            <div className="p-10 space-y-6">
              <div className="p-6 bg-slate-50/80 rounded-[2rem] border border-slate-100">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block mb-3 ml-1">Restablecer Contraseña</label>
                <div className="flex gap-3">
                  <input type="text" placeholder="Nueva Contraseña..." value={nuevaPass} onChange={e => setNuevaPass(e.target.value)} className="flex-1 bg-white border border-slate-200 p-4 rounded-xl text-xs font-bold outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all placeholder:text-slate-300" />
                  <button onClick={handleCambiarPassword} disabled={cargando} className="bg-[#1A2744] hover:bg-[#25365d] text-white w-14 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center shrink-0">
                    {cargando ? <Loader2 className="animate-spin text-amber-400" size={16} /> : <Key size={16} className="text-amber-400"/>}
                  </button>
                </div>
              </div>

              <div className="p-6 bg-red-50/50 rounded-[2rem] border border-red-100">
                <label className="text-[9px] font-black uppercase text-red-400 tracking-[0.2em] block mb-3 ml-1 flex items-center gap-1.5"><AlertOctagon size={12}/> Zona de Peligro</label>
                <button onClick={handleEliminarEmpleado} disabled={cargando} className="w-full bg-white hover:bg-red-500 text-red-500 hover:text-white border border-red-200 p-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95">
                  {cargando ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>} Dar de Baja Definitiva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALTA MANUAL */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-[#1A2744]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden border border-white/10">
            <div className="bg-gradient-to-b from-slate-50 to-white p-8 text-center relative border-b border-slate-100">
               <button onClick={() => setModalNuevo(false)} className="absolute top-6 right-6 text-slate-400 hover:text-red-500 bg-white p-2 rounded-full shadow-sm border border-slate-100 transition-colors active:scale-90"><X size={16}/></button>
               <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-[1.5rem] rotate-3 flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-100"><UserPlus size={28} className="-rotate-3"/></div>
               <h2 className="text-xl font-black text-[#1A2744] uppercase mb-1 tracking-tight">Alta Manual</h2>
               <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Registro Individual</p>
            </div>
            
            <div className="p-8 space-y-5">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block mb-2 ml-1">Nombre Completo</label>
                <input type="text" placeholder="Ej. JUAN PEREZ LOPEZ" value={nuevoEmp.nombre} onChange={e => setNuevoEmp({...nuevoEmp, nombre: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-black uppercase text-[#1A2744] outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all placeholder:font-normal placeholder:text-slate-300" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block mb-2 ml-1">Dependencia / Área</label>
                <input type="text" placeholder="Ej. ADMINISTRACION" value={nuevoEmp.dependencia} onChange={e => setNuevoEmp({...nuevoEmp, dependencia: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-black uppercase text-[#1A2744] outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all placeholder:font-normal placeholder:text-slate-300" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block mb-2 ml-1">Cuota Inicial (Vales)</label>
                <input type="number" min="0" value={nuevoEmp.cuota} onChange={e => setNuevoEmp({...nuevoEmp, cuota: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-lg text-center font-black text-[#1A2744] outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all" />
              </div>
              
              <button onClick={guardarNuevoEmpleado} disabled={cargando} className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:active:scale-100">
                {cargando ? <Loader2 className="animate-spin text-white" size={18} /> : <><CheckCircle2 size={16}/> Confirmar Alta</>}
              </button>
            </div>
          </div>
        </div>
      )}

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