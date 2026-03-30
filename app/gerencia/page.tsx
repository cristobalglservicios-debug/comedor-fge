'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Wallet, Users, ShoppingCart, Plus, CheckCircle2, AlertTriangle, Calendar, DollarSign, FileText, Tag, User, MapPin, Clock, UserCheck, ShieldCheck, KeyRound, UserPlus } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'gastos' | 'ventas' | 'personal' | 'asistencia';

export default function GerenciaDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('asistencia');
  const [loadingAcceso, setLoadingAcceso] = useState(true);
  const [cargandoForm, setCargandoForm] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string, tipo: 'exito' | 'error' } | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Listas de datos
  const [gastosRecientes, setGastosRecientes] = useState<any[]>([]);
  const [ventasRecientes, setVentasRecientes] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState<any[]>([]);

  // Estados de los Formularios
  const [formGastos, setFormGastos] = useState({ fecha_gasto: '', categoria: 'Insumos Cocina', proveedor: '', concepto: '', monto: '', tipo_comprobante: 'Ticket' });
  const [formVentas, setFormVentas] = useState({ fecha_venta: '', categoria: 'Tienda (Refrescos/Botanas)', monto_vendido: '' });
  
  // Nuevo: Formulario de Personal
  const [formPersonal, setFormPersonal] = useState({ nombre_completo: '', puesto: 'Cocinero', sueldo_diario: '', bono_semanal: '300', hora_entrada: '07:00', minutos_tolerancia: '15', pin_acceso: '' });
  // Nuevo: Formulario Asistencia Manual (Contingencia)
  const [formAsistencia, setFormAsistencia] = useState({ empleado_id: '', estatus: 'OK (Manual)' });

  useEffect(() => {
    validarAcceso();
  }, []);

  const validarAcceso = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const email = session.user.email?.toLowerCase() || '';
    
    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('email', email).maybeSingle();
    const rol = perfil?.rol || 'empleado';

    if (rol !== 'dev' && rol !== 'socio' && rol !== 'gerente' && rol !== 'admin') {
      router.push('/dashboard');
      return;
    }
    
    setUserEmail(email);
    setLoadingAcceso(false);
    cargarDatosGenerales();
    
    const hoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    setFormGastos(prev => ({ ...prev, fecha_gasto: hoy }));
    setFormVentas(prev => ({ ...prev, fecha_venta: hoy }));
  };

  const cargarDatosGenerales = async () => {
    const hoy = new Date().toLocaleDateString('en-CA');

    const [reqGastos, reqVentas, reqEmpleados, reqAsistencia] = await Promise.all([
      supabase.from('finanzas_gastos').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('finanzas_ventas_extra').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('cat_empleados').select('*').order('nombre_completo', { ascending: true }),
      supabase.from('asistencia_diaria').select('*, cat_empleados(nombre_completo, puesto)').eq('fecha', hoy).order('hora_registro', { ascending: false })
    ]);

    if (reqGastos.data) setGastosRecientes(reqGastos.data);
    if (reqVentas.data) setVentasRecientes(reqVentas.data);
    if (reqEmpleados.data) {
        setEmpleados(reqEmpleados.data);
        if(reqEmpleados.data.length > 0) setFormAsistencia(prev => ({ ...prev, empleado_id: reqEmpleados.data[0].id }));
    }
    if (reqAsistencia.data) setAsistenciasHoy(reqAsistencia.data);
  };

  const mostrarMensaje = (texto: string, tipo: 'exito' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 4000);
  };

  const formatearMoneda = (cantidad: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cantidad || 0);
  };

  const generarPIN = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormPersonal(prev => ({...prev, pin_acceso: pin}));
  };

  // --- SUBMITS ---

  const submitGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargandoForm(true);
    const { error } = await supabase.from('finanzas_gastos').insert([{
      fecha_gasto: formGastos.fecha_gasto,
      categoria: formGastos.categoria,
      proveedor: formGastos.proveedor.toUpperCase(),
      concepto: formGastos.concepto.toUpperCase(),
      monto: parseFloat(formGastos.monto),
      tipo_comprobante: formGastos.tipo_comprobante,
      registrado_por: userEmail
    }]);

    if (error) { mostrarMensaje(error.message, 'error'); } 
    else {
      mostrarMensaje('Gasto registrado con éxito', 'exito');
      setFormGastos(prev => ({ ...prev, proveedor: '', concepto: '', monto: '' }));
      cargarDatosGenerales();
    }
    setCargandoForm(false);
  };

  const submitVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargandoForm(true);
    const { error } = await supabase.from('finanzas_ventas_extra').insert([{
      fecha_venta: formVentas.fecha_venta,
      categoria: formVentas.categoria,
      monto_vendido: parseFloat(formVentas.monto_vendido),
      registrado_por: userEmail
    }]);

    if (error) { mostrarMensaje(error.message, 'error'); } 
    else {
      mostrarMensaje('Venta registrada con éxito', 'exito');
      setFormVentas(prev => ({ ...prev, monto_vendido: '' }));
      cargarDatosGenerales();
    }
    setCargandoForm(false);
  };

  const submitPersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formPersonal.pin_acceso) { mostrarMensaje('Genera un PIN de acceso', 'error'); return; }
    setCargandoForm(true);
    
    const { error } = await supabase.from('cat_empleados').insert([{
      nombre_completo: formPersonal.nombre_completo.toUpperCase(),
      puesto: formPersonal.puesto.toUpperCase(),
      sueldo_diario: parseFloat(formPersonal.sueldo_diario),
      bono_semanal: parseFloat(formPersonal.bono_semanal),
      hora_entrada: formPersonal.hora_entrada + ':00',
      minutos_tolerancia: parseInt(formPersonal.minutos_tolerancia),
      pin_acceso: formPersonal.pin_acceso,
      registrado_por: userEmail
    }]);

    if (error) { mostrarMensaje(error.message, 'error'); } 
    else {
      mostrarMensaje('Empleado registrado con éxito', 'exito');
      setFormPersonal({ nombre_completo: '', puesto: 'Cocinero', sueldo_diario: '', bono_semanal: '300', hora_entrada: '07:00', minutos_tolerancia: '15', pin_acceso: '' });
      cargarDatosGenerales();
    }
    setCargandoForm(false);
  };

  const submitAsistenciaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargandoForm(true);
    const hoy = new Date().toLocaleDateString('en-CA');
    const horaAct = new Date().toLocaleTimeString('en-GB'); // HH:MM:SS
    
    const { error } = await supabase.from('asistencia_diaria').insert([{
      empleado_id: formAsistencia.empleado_id,
      fecha: hoy,
      hora_registro: horaAct,
      estatus: formAsistencia.estatus,
      registrado_desde_ip: 'EXCEPCION_MANUAL',
      coordenadas_gps: 'Autorizado por Gerencia'
    }]);

    if (error) { 
        if(error.code === '23505') mostrarMensaje('El empleado ya tiene registro hoy', 'error');
        else mostrarMensaje(error.message, 'error'); 
    } else {
      mostrarMensaje('Asistencia manual registrada', 'exito');
      cargarDatosGenerales();
    }
    setCargandoForm(false);
  };

  if (loadingAcceso) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative overflow-hidden">
        <Loader2 className="animate-spin text-amber-500 mb-4" size={32} />
        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#1A2744]">Cargando Portal Gerencial...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20 text-[#1A2744] relative">
      <div className="fixed top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[#1A2744] to-[#F8FAFC] -z-10"></div>
      
      {/* NAVEGACIÓN */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4 sticky top-0 z-50 shadow-sm flex flex-col sm:flex-row justify-between items-center px-4 md:px-8 gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            <Wallet className="text-white" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm md:text-lg uppercase tracking-wider leading-tight text-[#1A2744]">Gestión Operativa</h1>
              <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-[8px] font-black px-2 py-0.5 rounded-md tracking-widest">GERENCIA</span>
            </div>
            <p className="text-slate-500 text-[9px] font-black tracking-[0.2em] uppercase mt-0.5">{userEmail}</p>
          </div>
        </div>
        <button onClick={() => router.back()} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-[#1A2744] px-4 py-2.5 rounded-xl font-bold text-xs transition-all w-full sm:w-auto justify-center">
          <ArrowLeft size={16} /> Volver
        </button>
      </nav>

      {/* MENSAJES FLOTANTES */}
      {mensaje && (
        <div className={`fixed top-24 right-4 z-[100] p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-fade-in ${mensaje.tipo === 'exito' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
          {mensaje.tipo === 'exito' ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}
          <p className="text-xs font-black uppercase tracking-wide">{mensaje.texto}</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 relative z-10">
        
        {/* TABS DE NAVEGACIÓN */}
        <div className="flex bg-white rounded-2xl p-1.5 mb-8 shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('asistencia')} className={`flex-1 min-w-[150px] py-3.5 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'asistencia' ? 'bg-[#1A2744] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Clock size={16}/> Monitor Asistencia
          </button>
          <button onClick={() => setActiveTab('personal')} className={`flex-1 min-w-[150px] py-3.5 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'personal' ? 'bg-[#1A2744] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users size={16}/> Catálogo Personal
          </button>
          <button onClick={() => setActiveTab('gastos')} className={`flex-1 min-w-[150px] py-3.5 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'gastos' ? 'bg-[#1A2744] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <ShoppingCart size={16}/> Compras y Gastos
          </button>
          <button onClick={() => setActiveTab('ventas')} className={`flex-1 min-w-[150px] py-3.5 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'ventas' ? 'bg-[#1A2744] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <DollarSign size={16}/> Ventas Tienda
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 anim-fade-up">
          
          {/* PANEL IZQUIERDO: FORMULARIO */}
          <div className="lg:col-span-5">
            <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 sticky top-28">
              
              {/* === FORMULARIO ASISTENCIA MANUAL === */}
              {activeTab === 'asistencia' && (
                <form onSubmit={submitAsistenciaManual} className="space-y-5">
                  <div className="mb-6 border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-black text-[#1A2744] flex items-center gap-2"><ShieldCheck className="text-blue-500"/> Registro Excepcional</h2>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Si el empleado no tiene celular o datos</p>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Seleccionar Empleado</label>
                    <select required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold focus:border-blue-500 outline-none uppercase" value={formAsistencia.empleado_id} onChange={e => setFormAsistencia({...formAsistencia, empleado_id: e.target.value})}>
                      {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre_completo} - {emp.puesto}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Motivo de Registro</label>
                    <select required className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold focus:border-blue-500 outline-none uppercase" value={formAsistencia.estatus} onChange={e => setFormAsistencia({...formAsistencia, estatus: e.target.value})}>
                      <option value="OK (Manual)">Asistencia Manual (Sin Celular)</option>
                      <option value="FALTA (Manual)">Reportar Falta Injustificada</option>
                      <option value="ENF (Manual)">Enfermedad / Incapacidad</option>
                      <option value="DESCANSO">Día de Descanso Oficial</option>
                    </select>
                  </div>

                  <button disabled={cargandoForm || empleados.length === 0} type="submit" className="w-full bg-[#1A2744] hover:bg-[#2A3F6D] text-white p-4 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-6 transition-all active:scale-[0.98] shadow-lg">
                    {cargandoForm ? <Loader2 className="animate-spin" size={16}/> : <><UserCheck size={16}/> Autorizar Asistencia</>}
                  </button>
                </form>
              )}

              {/* === FORMULARIO PERSONAL === */}
              {activeTab === 'personal' && (
                <form onSubmit={submitPersonal} className="space-y-4">
                  <div className="mb-4 border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-black text-[#1A2744] flex items-center gap-2"><Users className="text-amber-500"/> Alta de Personal</h2>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Genera su PIN para el GPS</p>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Nombre Completo</label>
                    <input required type="text" placeholder="Ej: JUAN PÉREZ LOPEZ" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold focus:border-amber-500 outline-none uppercase" value={formPersonal.nombre_completo} onChange={e => setFormPersonal({...formPersonal, nombre_completo: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Puesto</label>
                      <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold focus:border-amber-500 outline-none uppercase" value={formPersonal.puesto} onChange={e => setFormPersonal({...formPersonal, puesto: e.target.value})}>
                        <option>Gerente</option><option>Chef</option><option>Cocinero</option><option>Cajera</option><option>Auxiliar</option><option>Lavaloza</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Sueldo Diario ($)</label>
                      <input required type="number" step="0.01" min="0" placeholder="400.00" className="w-full bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-xs font-black focus:border-amber-500 outline-none text-amber-700" value={formPersonal.sueldo_diario} onChange={e => setFormPersonal({...formPersonal, sueldo_diario: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Hora Entrada</label>
                      <input required type="time" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold focus:border-amber-500 outline-none" value={formPersonal.hora_entrada} onChange={e => setFormPersonal({...formPersonal, hora_entrada: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Tolerancia (Min)</label>
                      <input required type="number" min="0" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold focus:border-amber-500 outline-none" value={formPersonal.minutos_tolerancia} onChange={e => setFormPersonal({...formPersonal, minutos_tolerancia: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Bono Semanal ($)</label>
                      <input required type="number" step="0.01" min="0" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold focus:border-amber-500 outline-none text-slate-700" value={formPersonal.bono_semanal} onChange={e => setFormPersonal({...formPersonal, bono_semanal: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">PIN Celular</label>
                      <div className="flex gap-2">
                        <input readOnly type="text" placeholder="----" className="w-full bg-slate-800 text-white border-none p-3 rounded-xl text-center text-sm font-black tracking-widest" value={formPersonal.pin_acceso} />
                        <button type="button" onClick={generarPIN} className="bg-amber-100 text-amber-600 p-3 rounded-xl hover:bg-amber-200 transition-colors"><KeyRound size={18}/></button>
                      </div>
                    </div>
                  </div>

                  <button disabled={cargandoForm} type="submit" className="w-full bg-[#1A2744] hover:bg-[#2A3F6D] text-white p-4 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-4 transition-all active:scale-[0.98] shadow-lg">
                    {cargandoForm ? <Loader2 className="animate-spin" size={16}/> : <><UserPlus size={16}/> Registrar Empleado</>}
                  </button>
                </form>
              )}

              {/* === FORMULARIO GASTOS === */}
              {activeTab === 'gastos' && (
                <form onSubmit={submitGasto} className="space-y-5">
                  <div className="mb-6 border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-black text-[#1A2744] flex items-center gap-2"><ShoppingCart className="text-indigo-500"/> Registro de Gasto</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Fecha</label>
                      <input required type="date" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none" value={formGastos.fecha_gasto} onChange={e => setFormGastos({...formGastos, fecha_gasto: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Categoría</label>
                      <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none" value={formGastos.categoria} onChange={e => setFormGastos({...formGastos, categoria: e.target.value})}>
                        <option>Insumos Cocina</option><option>Panadería</option><option>Bebidas</option><option>Botanas y Galletas</option><option>Desechables</option><option>Limpieza / Químicos</option><option>Mantenimiento</option><option>Gas</option><option>Otros</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Proveedor</label>
                    <input required type="text" placeholder="Ej: VE CENTRAL" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none uppercase" value={formGastos.proveedor} onChange={e => setFormGastos({...formGastos, proveedor: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Concepto</label>
                    <input required type="text" placeholder="Ej: FRUTAS SEMANA 1" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none uppercase" value={formGastos.concepto} onChange={e => setFormGastos({...formGastos, concepto: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Monto ($)</label>
                      <input required type="number" step="0.01" min="0" placeholder="0.00" className="w-full bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl text-xs font-black outline-none text-indigo-700" value={formGastos.monto} onChange={e => setFormGastos({...formGastos, monto: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Comprobante</label>
                      <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none" value={formGastos.tipo_comprobante} onChange={e => setFormGastos({...formGastos, tipo_comprobante: e.target.value})}>
                        <option>Ticket</option><option>Factura</option><option>Nota Remisión</option><option>Sin Comprobante</option>
                      </select>
                    </div>
                  </div>
                  <button disabled={cargandoForm} type="submit" className="w-full bg-[#1A2744] hover:bg-[#2A3F6D] text-white p-4 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg">
                    {cargandoForm ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16}/> Guardar Gasto</>}
                  </button>
                </form>
              )}

              {/* === FORMULARIO VENTAS === */}
              {activeTab === 'ventas' && (
                <form onSubmit={submitVenta} className="space-y-5">
                  <div className="mb-6 border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-black text-[#1A2744] flex items-center gap-2"><DollarSign className="text-emerald-500"/> Ventas Extra</h2>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Fecha</label>
                    <input required type="date" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none" value={formVentas.fecha_venta} onChange={e => setFormVentas({...formVentas, fecha_venta: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Categoría</label>
                    <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none" value={formVentas.categoria} onChange={e => setFormVentas({...formVentas, categoria: e.target.value})}>
                      <option>Tienda (Refrescos/Botanas)</option><option>Desayunos Mostrador</option><option>Almuerzos Mostrador</option><option>Cenas Mostrador</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Monto Ingresado ($)</label>
                    <input required type="number" step="0.01" min="0" placeholder="0.00" className="w-full bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-xs font-black outline-none text-emerald-700" value={formVentas.monto_vendido} onChange={e => setFormVentas({...formVentas, monto_vendido: e.target.value})} />
                  </div>
                  <button disabled={cargandoForm} type="submit" className="w-full bg-[#1A2744] hover:bg-[#2A3F6D] text-white p-4 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg">
                    {cargandoForm ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16}/> Declarar Venta</>}
                  </button>
                </form>
              )}

            </div>
          </div>

          {/* PANEL DERECHO: HISTORIAL / AUDITORÍA */}
          <div className="lg:col-span-7">
            <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 min-h-full flex flex-col">
              
              <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                 <FileText className="text-slate-400" size={20} />
                 <div>
                    <h3 className="text-sm font-black text-[#1A2744] uppercase tracking-widest">Auditoría en Tiempo Real</h3>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Registros de {new Date().toLocaleDateString('es-MX')}</p>
                 </div>
              </div>

              <div className="overflow-x-auto flex-1 no-scrollbar">
                
                {/* LISTA ASISTENCIA */}
                {activeTab === 'asistencia' && (
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="text-[9px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                      <tr><th className="pb-3 pr-4">Empleado</th><th className="pb-3 pr-4">Hora</th><th className="pb-3 pr-4">IP / GPS</th><th className="pb-3 text-right">Estatus</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {asistenciasHoy.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase">Sin registros de entrada hoy</td></tr>}
                      {asistenciasHoy.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="py-4 pr-4">
                            <p className="text-[11px] font-black text-[#1A2744] uppercase">{a.cat_empleados?.nombre_completo}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{a.cat_empleados?.puesto}</p>
                          </td>
                          <td className="py-4 pr-4 text-[11px] font-black text-slate-500">{a.hora_registro.substring(0,5)}</td>
                          <td className="py-4 pr-4 text-[9px] font-bold text-slate-400">{a.registrado_desde_ip === 'EXCEPCION_MANUAL' ? 'Gerencia' : 'App GPS'}</td>
                          <td className="py-4 text-right">
                             <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${a.estatus.includes('OK') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                {a.estatus}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* LISTA PERSONAL */}
                {activeTab === 'personal' && (
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="text-[9px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                      <tr><th className="pb-3 pr-4">Empleado</th><th className="pb-3 pr-4">Sueldo / Bono</th><th className="pb-3 text-right">PIN Acceso</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {empleados.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase">Catálogo vacío</td></tr>}
                      {empleados.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50/50">
                          <td className="py-4 pr-4">
                            <p className="text-[11px] font-black text-[#1A2744] uppercase flex items-center gap-1">{emp.nombre_completo} {emp.activo ? <div className="w-2 h-2 bg-emerald-400 rounded-full"></div> : <div className="w-2 h-2 bg-red-400 rounded-full"></div>}</p>
                            <p className="text-[9px] font-bold text-amber-500 uppercase">{emp.puesto} | Entrada: {emp.hora_entrada.substring(0,5)}</p>
                          </td>
                          <td className="py-4 pr-4 text-[10px] font-black text-slate-500">
                             Día: {formatearMoneda(emp.sueldo_diario)} <br/>
                             <span className="text-emerald-500">Bono: {formatearMoneda(emp.bono_semanal)}</span>
                          </td>
                          <td className="py-4 text-right">
                             <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-black tracking-[0.2em] font-mono">
                                {emp.pin_acceso}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* LISTA GASTOS */}
                {activeTab === 'gastos' && (
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="text-[9px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                      <tr><th className="pb-3 pr-4">Fecha</th><th className="pb-3 pr-4">Proveedor / Concepto</th><th className="pb-3 text-right">Monto</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {gastosRecientes.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase">Sin registros</td></tr>}
                      {gastosRecientes.map(g => (
                        <tr key={g.id} className="hover:bg-slate-50/50">
                          <td className="py-4 pr-4 text-[10px] font-bold text-slate-500">{new Date(g.fecha_gasto).toLocaleDateString('es-MX')}</td>
                          <td className="py-4 pr-4"><p className="text-[11px] font-black text-[#1A2744] uppercase">{g.proveedor}</p><p className="text-[9px] font-bold text-indigo-500 uppercase">{g.concepto}</p></td>
                          <td className="py-4 text-right text-[11px] font-black text-red-500">-{formatearMoneda(g.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* LISTA VENTAS */}
                {activeTab === 'ventas' && (
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="text-[9px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                      <tr><th className="pb-3 pr-4">Fecha</th><th className="pb-3 pr-4">Categoría</th><th className="pb-3 text-right">Ingreso</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {ventasRecientes.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase">Sin registros</td></tr>}
                      {ventasRecientes.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50/50">
                          <td className="py-4 pr-4 text-[10px] font-bold text-slate-500">{new Date(v.fecha_venta).toLocaleDateString('es-MX')}</td>
                          <td className="py-4 pr-4 text-[11px] font-black text-[#1A2744] uppercase">{v.categoria}</td>
                          <td className="py-4 text-right text-[11px] font-black text-emerald-500">+{formatearMoneda(v.monto_vendido)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              </div>
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .anim-fade-up { opacity: 0; animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}