'use client';

import Link from 'next/link';
import { User, ShieldCheck, ChevronRight } from 'lucide-react'; // Necesitas instalar lucide-react

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      
      {/* SECCIÓN DE LOGO / ENCABEZADO */}
      <div className="mb-12 text-center">
        <div className="bg-[#1A2744] w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/20">
          <span className="text-white font-black text-2xl">CF</span>
        </div>
        <h1 className="text-2xl font-black text-[#1A2744] tracking-tight">COMEDOR FISCALÍA</h1>
        <p className="text-[#C9A84C] text-sm font-bold tracking-widest uppercase mt-1">Gestión de Cuotas</p>
      </div>

      {/* CONTENEDOR DE OPCIONES */}
      <div className="w-full max-w-sm space-y-4">
        
        {/* BOTÓN PERFIL CAJERO */}
        <Link href="/cajero">
          <div className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-[#C9A84C]/30 transition-all flex items-center justify-between active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="bg-slate-100 p-3 rounded-2xl group-hover:bg-amber-50 transition-colors">
                <User className="text-[#1A2744] group-hover:text-[#C9A84C] transition-colors" size={28} />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">Perfil Cajero</h2>
                <p className="text-slate-400 text-xs">Canje de tickets diarios</p>
              </div>
            </div>
            <ChevronRight className="text-slate-300 group-hover:text-[#C9A84C]" size={20} />
          </div>
        </Link>

        {/* BOTÓN PERFIL ADMIN */}
        <Link href="/admin">
          <div className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between active:scale-[0.98]">
            <div className="flex items-center gap-4">
              <div className="bg-slate-100 p-3 rounded-2xl group-hover:bg-blue-50 transition-colors">
                <ShieldCheck className="text-[#1A2744] group-hover:text-blue-600 transition-colors" size={28} />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">Administración</h2>
                <p className="text-slate-400 text-xs">Reportes y gestión de nómina</p>
              </div>
            </div>
            <ChevronRight className="text-slate-300 group-hover:text-blue-600" size={20} />
          </div>
        </Link>

      </div>

      {/* PIE DE PÁGINA */}
      <div className="mt-20 text-center">
        <p className="text-slate-300 text-[10px] font-bold tracking-widest uppercase">
          Fiscalía General del Estado de Yucatán
        </p>
        <div className="h-1 w-8 bg-[#C9A84C] mx-auto mt-2 rounded-full opacity-50"></div>
      </div>

    </div>
  );
}