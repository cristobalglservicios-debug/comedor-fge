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
        setTimeout(() => setLoading(false), 1500);
      }
    };
    checkSession();
  }, []);

  const handleStart = () => {
    if (!userProfile) {
      router.push('/dashboard'); 
    } else {
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
        <p className="mt-6 text-slate-400 text-xs font-bold tracking-[0.3em] uppercase animate-pulse">Cargando Seguridad</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between p-8 font-sans">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        
        {/* CONTENEDOR DEL LOGO OFICIAL */}
        <div className="mb-10">
          <div className="bg-white w-32 h-32 rounded-full flex items-center justify-center shadow-2xl shadow-slate-200 border border-slate-50 p-2">
            {/* Aquí puedes reemplazar 'logo-fge.png' por la ruta real de tu imagen en la carpeta public */}
            <img 
              src="https://fge.yucatan.gob.mx/images/logo-fge-header.png" 
              alt="Logo FGE"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>

        {/* TEXTOS INSTITUCIONALES */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-black text-[#1A2744] leading-tight tracking-tighter italic">
            ADMINISTRACIÓN <br /> <span className="text-[#C9A84C] not-italic font-black">FISCALÍA</span>
          </h1>
          <div className="h-[2px] w-16 bg-[#C9A84C] mx-auto rounded-full"></div>
          <p className="text-slate-500 text-sm font-bold pt-2">
            {userProfile 
              ? `Bienvenido - ${userProfile.nombre_completo.split(' ')[0]}` 
              : 'Bienvenido - Administración FGE'}
          </p>
        </div>

        {/* BOTÓN DE ACCIÓN */}
        <button 
          onClick={handleStart}
          className="group mt-14 w-full bg-[#1A2744] text-white p-5 rounded-[1.5rem] font-bold flex items-center justify-between shadow-2xl shadow-blue-900/30 active:scale-[0.97] transition-all"
        >
          <span className="ml-4 tracking-[0.2em] text-[10px] uppercase font-black">
            {userProfile ? 'Acceder al Panel' : 'Ingresar al Sistema'}
          </span>
          <div className="bg-[#C9A84C] p-2 rounded-lg transition-transform group-hover:translate-x-1">
            <ChevronRight className="text-[#1A2744]" size={20} />
          </div>
        </button>
      </div>

      {/* FOOTER OFICIAL */}
      <div className="text-center pb-4">
        <p className="text-[9px] font-black tracking-[0.4em] text-slate-300 uppercase">
          Fiscalía General del Estado de Yucatán
        </p>
      </div>
    </div>
  );
}