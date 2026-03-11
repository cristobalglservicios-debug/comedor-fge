'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, Utensils, ChevronRight, Fingerprint } from 'lucide-react';

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
        // Un pequeño delay para que luzca la animación profesional
        setTimeout(() => setLoading(false), 1500);
      }
    };
    checkSession();
  }, []);

  const handleStart = () => {
    if (!userProfile) {
      // SEGÚN TU ESTRUCTURA: Te mando a /dashboard ya que no tienes carpeta /login
      router.push('/dashboard'); 
    } else {
      // REDIRECCIÓN POR ROL SEGÚN TUS CARPETAS REALES
      if (userProfile.rol === 'admin') router.push('/admin');
      else if (userProfile.rol === 'cajero') router.push('/cajero');
      else router.push('/mi-vale');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="bg-[#1A2744] w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl animate-pulse">
          <Utensils className="text-[#C9A84C]" size={42} />
        </div>
        <div className="mt-8 flex items-center gap-2">
          <Loader2 className="text-[#1A2744] animate-spin" size={20} />
          <p className="text-slate-400 text-xs font-bold tracking-[0.2em] uppercase">Sincronizando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between p-8 font-sans">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        
        {/* ESCUDO / LOGO */}
        <div className="relative mb-10">
          <div className="bg-[#1A2744] w-28 h-28 rounded-[2.8rem] flex items-center justify-center shadow-2xl shadow-blue-900/20">
            <Utensils className="text-[#C9A84C]" size={48} />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-2xl shadow-lg border border-slate-50">
            <Fingerprint className="text-[#1A2744]" size={20} />
          </div>
        </div>

        {/* TEXTOS */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-black text-[#1A2744] leading-tight tracking-tight">
            COMEDOR <br /> <span className="text-[#C9A84C]">FISCALÍA</span>
          </h1>
          <div className="h-1 w-12 bg-slate-100 mx-auto rounded-full"></div>
          <p className="text-slate-400 text-sm font-medium px-4">
            {userProfile 
              ? `Sesión activa como: ${userProfile.nombre_completo.split(' ')[0]}` 
              : 'Bienvenido al sistema de control de raciones digitales.'}
          </p>
        </div>

        {/* BOTÓN DE ACCIÓN */}
        <button 
          onClick={handleStart}
          className="group mt-14 w-full bg-[#1A2744] text-white p-5 rounded-[2rem] font-bold flex items-center justify-between shadow-xl shadow-blue-900/20 active:scale-[0.97] transition-all hover:bg-slate-800"
        >
          <span className="ml-4 tracking-[0.15em] text-xs uppercase font-black">
            {userProfile ? 'Ingresar al Panel' : 'Comenzar Ahora'}
          </span>
          <div className="bg-[#C9A84C] p-3 rounded-2xl transition-transform group-hover:translate-x-1">
            <ChevronRight className="text-[#1A2744]" size={20} />
          </div>
        </button>
      </div>

      {/* FOOTER GUBERNAMENTAL */}
      <div className="text-center pb-4 opacity-40">
        <p className="text-[9px] font-black tracking-[0.4em] text-slate-300 uppercase">
          Fiscalía General del Estado de Yucatán
        </p>
      </div>
    </div>
  );
}