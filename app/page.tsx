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
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('rol, nombre_completo')
            .eq('id', session.user.id)
            .single();
          if (perfil) setUserProfile(perfil);
        }
      } catch (err) {
        console.error("Error validando sesión", err);
      } finally {
        // Delay para lucir la animación de carga institucional
        setTimeout(() => setLoading(false), 1500);
      }
    };
    checkSession();
  }, []);

  const handleStart = () => {
    if (!userProfile) {
      // Redirige a dashboard según tu estructura de carpetas
      router.push('/dashboard'); 
    } else {
      // Lógica de roles según tu Plan Maestro
      if (userProfile.rol === 'admin') router.push('/admin');
      else if (userProfile.rol === 'cajero') router.push('/cajero');
      else router.push('/mi-vale');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 border-4 border-slate-100 border-t-[#1A2744] rounded-full animate-spin"></div>
          <ShieldCheck className="absolute text-[#C9A84C]" size={32} />
        </div>
        <p className="mt-6 text-slate-400 text-[10px] font-black tracking-[0.4em] uppercase animate-pulse">Sincronizando Seguridad</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between p-8 font-sans">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm animate-in fade-in zoom-in duration-700">
        
        {/* LOGO OFICIAL FGE */}
        <div className="mb-12">
          <div className="bg-white w-40 h-40 rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-50 p-1">
            <img 
              src="/Logo-FGE.jpg" 
              alt="Fiscalía General del Estado de Yucatán"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://via.placeholder.com/150?text=FGE+LOGO"; // Imagen de respaldo si falla
              }}
            />
          </div>
        </div>

        {/* TEXTOS INSTITUCIONALES */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-black text-[#1A2744] leading-tight tracking-tighter italic uppercase">
            ADMINISTRACIÓN <br /> <span className="text-[#C9A84C] not-italic font-black tracking-normal">FISCALÍA</span>
          </h1>
          <div className="h-[3px] w-12 bg-[#C9A84C] mx-auto rounded-full"></div>
          <p className="text-slate-500 text-sm font-bold pt-1 tracking-tight">
            {userProfile 
              ? `Bienvenido - ${userProfile.nombre_completo.split(' ')[0]}` 
              : 'Bienvenido - Administración FGE'}
          </p>
        </div>

        {/* BOTÓN DE ACCIÓN MODERNO */}
        <button 
          onClick={handleStart}
          className="group mt-16 w-full bg-[#1A2744] text-white p-5 rounded-[2rem] font-bold flex items-center justify-between shadow-2xl shadow-blue-900/40 active:scale-[0.96] transition-all hover:bg-[#25365d]"
        >
          <span className="ml-6 tracking-[0.25em] text-[10px] uppercase font-black">
            {userProfile ? 'Ingresar al Panel' : 'Ingresar al Sistema'}
          </span>
          <div className="bg-[#C9A84C] p-3 rounded-2xl transition-transform group-hover:translate-x-1 shadow-inner">
            <ChevronRight className="text-[#1A2744]" size={20} />
          </div>
        </button>
      </div>

      {/* PIE DE PÁGINA */}
      <div className="text-center pb-6 opacity-30">
        <p className="text-[9px] font-black tracking-[0.5em] text-slate-400 uppercase">
          Fiscalía General del Estado de Yucatán
        </p>
      </div>
    </div>
  );
}