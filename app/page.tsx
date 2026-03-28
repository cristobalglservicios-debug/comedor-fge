'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChefHat, UtensilsCrossed, Loader2 } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);

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
        // Delay para la animación premium
        setTimeout(() => setLoading(false), 1500);
      }
    };
    checkSession();
  }, []);

  const handleStart = async () => {
    if (!session) {
      router.push('/dashboard'); 
      return;
    }

    setIsRouting(true);

    try {
      const email = session.user.email?.toLowerCase().trim() || '';
      
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('email', email)
        .maybeSingle();

      const rol = perfil?.rol || 'empleado';

      if (rol === 'dev') {
        router.push('/dev-panel');
      } else if (rol === 'admin') {
        router.push('/admin');
      } else if (rol === 'cajero') {
        router.push('/cajero');
      } else if (rol === 'socio') {
        router.push('/socios');
      } else if (rol === 'gerente') {
        router.push('/gerencia');
      } else {
        router.push('/mi-vale');
      }
    } catch (error) {
      console.error("Error en redirección:", error);
      router.push('/mi-vale'); 
    }
  };

  if (loading || isRouting) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A2744]/5 to-transparent z-0"></div>
        <div className="relative z-10 flex flex-col items-center animate-pulse-slow">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="w-20 h-20 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-[2rem] rotate-3 flex items-center justify-center shadow-2xl">
              <ChefHat className="text-amber-400 -rotate-3" size={36} strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-[#1A2744]">
            <Loader2 className="animate-spin text-amber-500" size={20} />
            <p className="text-xs font-black tracking-[0.3em] uppercase">
              {isRouting ? 'Autenticando Identidad...' : 'Preparando Cocina...'}
            </p>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
          .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        `}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col relative overflow-hidden font-sans">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[#1A2744] to-[#F8FAFC] -z-10"></div>
      <div className="absolute top-[-20%] right-[-10%] w-[60vh] h-[60vh] bg-amber-500/10 rounded-full blur-[100px] -z-10"></div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto">
        
        <div className="w-full bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white flex flex-col items-center text-center anim-fade-up">
          
          {/* PREMIUM LOGO ICON */}
          <div className="relative mb-8 group anim-scale-in" style={{animationDelay: '100ms'}}>
            <div className="absolute inset-0 bg-amber-400 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="relative w-28 h-28 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-[2.5rem] rotate-3 flex items-center justify-center shadow-2xl transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105 border border-slate-700/50">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 rounded-[2.5rem]"></div>
              <UtensilsCrossed className="absolute text-white/10 w-16 h-16 -rotate-3" strokeWidth={1} />
              <ChefHat className="relative text-amber-400 -rotate-3 drop-shadow-lg" size={48} strokeWidth={1.5} />
            </div>
          </div>

          {/* MAIN TITLES */}
          <div className="space-y-1 mb-8 anim-fade-up" style={{animationDelay: '200ms'}}>
            <h2 className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">Servicio Interno</h2>
            <h1 className="text-4xl font-black text-[#1A2744] tracking-tight leading-none uppercase">
              Comedor
            </h1>
            <h1 className="text-4xl font-light text-amber-500 tracking-widest italic uppercase">
              Fiscalía
            </h1>
          </div>

          {/* DIVIDER */}
          <div className="w-12 h-1 bg-amber-400 rounded-full mb-10 anim-scale-in" style={{animationDelay: '300ms'}}></div>

          {/* ACTION BUTTON */}
          <button 
            onClick={handleStart}
            className="group relative w-full bg-[#1A2744] text-white p-5 rounded-2xl font-bold flex items-center justify-center shadow-xl shadow-[#1A2744]/20 active:scale-[0.98] transition-all hover:bg-[#25365d] overflow-hidden anim-fade-up"
            style={{animationDelay: '400ms'}}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-shimmer"></div>
            
            <span className="tracking-[0.2em] text-xs uppercase font-black z-10">
              {session ? 'Acceder al Menú' : 'Ingresar al Sistema'}
            </span>
            <ChevronRight className="absolute right-6 text-amber-400 transition-transform group-hover:translate-x-2 z-10" size={20} />
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="pb-8 text-center anim-fade-up" style={{animationDelay: '500ms'}}>
        <p className="text-[9px] font-black tracking-[0.5em] text-slate-400/60 uppercase">
          FGE Yucatán • App Interna
        </p>
      </div>

      {/* CUSTOM ANIMATIONS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .anim-fade-up {
          opacity: 0;
          animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-scale-in {
          opacity: 0;
          animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
}