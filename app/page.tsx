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
          // Buscamos el perfil con el ID de la sesión
          const { data: perfil, error: perfilError } = await supabase
            .from('perfiles')
            .select('rol, nombre_completo')
            .eq('id', session.user.id)
            .single();

          if (perfil) {
            console.log("Perfil detectado:", perfil.rol); // Para debug
            setUserProfile(perfil);
          }
        }
      } catch (err) {
        console.error("Error validando sesión:", err);
      } finally {
        setTimeout(() => setLoading(false), 1200);
      }
    };
    checkSession();
  }, []);

  const handleStart = () => {
    if (!userProfile) {
      router.push('/dashboard'); 
      return;
    }

    // LÓGICA DE REDIRECCIÓN ESTRICTA POR ROL
    const rol = userProfile.rol?.toLowerCase();
    
    if (rol === 'admin') {
      router.push('/admin');
    } else if (rol === 'cajero' || rol === 'comedor') {
      router.push('/cajero');
    } else {
      router.push('/mi-vale');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-[#1A2744] rounded-full animate-spin"></div>
          <ShieldCheck className="absolute text-[#C9A84C]" size={28} />
        </div>
        <p className="mt-6 text-slate-400 text-[9px] font-black tracking-[0.4em] uppercase animate-pulse">Autenticando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between p-8 font-sans">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        
        {/* LOGO FGE - CON RESPALDO SI FALLA EL LOCAL */}
        <div className="mb-12">
          <div className="bg-white w-40 h-40 rounded-full flex items-center justify-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border border-slate-50 p-2 overflow-hidden">
            <img 
              src="/Logo-FGE.jpg" 
              alt="Logo FGE"
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Si falla el local, carga el de la web oficial de la fiscalía
                target.src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png";
              }}
            />
          </div>
        </div>

        {/* TEXTOS */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-black text-[#1A2744] leading-tight tracking-tighter italic uppercase">
            ADMINISTRACIÓN <br /> <span className="text-[#C9A84C] not-italic font-black tracking-normal">FISCALÍA</span>
          </h1>
          <div className="h-[3px] w-12 bg-[#C9A84C] mx-auto rounded-full"></div>
          <p className="text-slate-500 text-sm font-bold pt-1">
            {userProfile 
              ? `Bienvenido - ${userProfile.nombre_completo?.split(' ')[0]}` 
              : 'Bienvenido - Administración FGE'}
          </p>
        </div>

        {/* BOTÓN */}
        <button 
          onClick={handleStart}
          className="group mt-16 w-full bg-[#1A2744] text-white p-5 rounded-[2rem] font-bold flex items-center justify-between shadow-2xl shadow-blue-900/40 active:scale-[0.96] transition-all"
        >
          <span className="ml-6 tracking-[0.25em] text-[10px] uppercase font-black">
            {userProfile ? 'Ingresar al Panel' : 'Ingresar al Sistema'}
          </span>
          <div className="bg-[#C9A84C] p-3 rounded-2xl transition-transform group-hover:translate-x-1">
            <ChevronRight className="text-[#1A2744]" size={20} />
          </div>
        </button>
      </div>

      <div className="text-center pb-6 opacity-30">
        <p className="text-[9px] font-black tracking-[0.5em] text-slate-400 uppercase">
          Fiscalía General del Estado de Yucatán
        </p>
      </div>
    </div>
  );
}