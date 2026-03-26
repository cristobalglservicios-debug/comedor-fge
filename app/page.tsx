'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronRight, ShieldCheck } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setSession(data.session);
        }
      } catch (err) {
        console.error("Error validando sesión", err);
      } finally {
        // Delay para la animación institucional de carga
        setTimeout(() => setLoading(false), 1200);
      }
    };
    checkSession();
  }, []);

  const handleStart = async () => {
    if (!session) {
      router.push('/dashboard'); 
      return;
    }

    setLoading(true); // Mostrar carga mientras consultamos el rol real

    try {
      const email = session.user.email?.toLowerCase() || '';
      
      // CONSULTA DE ROL REAL EN BASE DE DATOS
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('email', email)
        .maybeSingle();

      const rol = perfil?.rol || 'empleado';

      // REDIRECCIÓN INTELIGENTE SEGÚN ROL
      if (rol === 'dev') {
        router.push('/dev-panel');
      } else if (rol === 'admin') {
        router.push('/admin');
      } else if (rol === 'cajero') {
        router.push('/cajero');
      } else {
        router.push('/mi-vale');
      }
    } catch (error) {
      console.error("Error en redirección:", error);
      router.push('/mi-vale'); // Fallback a perfil de empleado
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-[#1A2744] rounded-full animate-spin"></div>
          <ShieldCheck className="absolute text-[#C9A84C]" size={28} />
        </div>
        <p className="mt-6 text-slate-400 text-[10px] font-black tracking-[0.4em] uppercase animate-pulse">Autenticando Identidad</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between p-8 font-sans">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm animate-in fade-in duration-700">
        
        {/* LOGO FGE OFICIAL LOCAL */}
        <div className="mb-10 animate-fade-in">
          <div className="bg-white w-40 h-40 rounded-full flex items-center justify-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-50 p-2 overflow-hidden">
            <img 
              src="/logo-fge.png" 
              alt="Fiscalía General del Estado de Yucatán"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png"; 
              }}
            />
          </div>
        </div>

        {/* TEXTOS INSTITUCIONALES */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-black text-[#1A2744] leading-tight tracking-tighter italic uppercase">
            ADMINISTRACIÓN <br /> <span className="text-[#C9A84C] not-italic font-black tracking-normal">FISCALÍA</span>
          </h1>
          <div className="h-[3px] w-12 bg-[#C9A84C] mx-auto rounded-full"></div>
          
          <p className="text-slate-500 text-sm font-bold pt-1">
            Bienvenido
          </p>
        </div>

        {/* BOTÓN DE ACCIÓN REFINADO CON LOGICA DE ROLES */}
        <button 
          onClick={handleStart}
          className="group mt-16 w-full bg-[#1A2744] text-white p-5 rounded-full font-bold flex items-center justify-between shadow-2xl shadow-blue-900/40 active:scale-[0.96] transition-all hover:bg-[#25365d]"
        >
          <span className="ml-6 tracking-[0.25em] text-[10px] uppercase font-black">
            {session ? 'Ingresar al Panel' : 'Ingresar al Sistema'}
          </span>
          <div className="bg-[#C9A84C] p-3 rounded-full transition-transform group-hover:translate-x-1 shadow-inner">
            <ChevronRight className="text-[#1A2744]" size={20} />
          </div>
        </button>
      </div>

      {/* PIE DE PÁGINA (MARCA DE AGUA) */}
      <div className="text-center pb-6 opacity-30">
        <p className="text-[9px] font-black tracking-[0.5em] text-slate-400 uppercase">
          Fiscalía General del Estado de Yucatán
        </p>
      </div>
    </div>
  );
}