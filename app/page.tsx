'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, Utensils, AlertCircle, Fingerprint } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const router = useRouter();
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // 1. Verificamos sesión activa con delay para la animación
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setTimeout(() => router.push('/login'), 1800);
          return;
        }

        // 2. Buscamos el perfil
        const { data: perfil, error: perfilError } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();

        if (perfilError || !perfil) {
          setTimeout(() => setErrorStatus("No se encontró tu perfil en la base de datos."), 1500);
          return;
        }

        // 3. Redirección Inteligente con delay suave
        setTimeout(() => {
          if (perfil.rol === 'admin') {
            router.push('/admin');
          } else if (perfil.rol === 'cajero') {
            router.push('/cajero');
          } else {
            router.push('/mi-vale');
          }
        }, 1800);

      } catch (err) {
        setTimeout(() => setErrorStatus("Ocurrió un error inesperado al validar tu cuenta."), 1500);
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* SECCIÓN CENTRAL CON ANIMACIÓN */}
      {!errorStatus ? (
        <div className="flex flex-col items-center justify-center text-center">
          {/* LOGO FISCALÍA ESTILO MODERNO Y ANIMADO */}
          <div className="relative mb-12 group">
            {/* Círculo de fondo con pulso de sombra */}
            <div className="bg-[#1A2744] w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/10 animate-pulse-slow">
              <Utensils className="text-[#C9A84C]" size={48} />
            </div>
            {/* Icono de carga giratorio */}
            <div className="absolute -bottom-3 -right-3 bg-white p-1 rounded-full shadow-lg border-2 border-slate-50">
              <Loader2 className="text-[#1A2744] animate-spin-slow" size={28} />
            </div>
          </div>

          {/* TEXTO DE ESTADO CON ANIMACIÓN SUAVE */}
          <div className="space-y-3 animate-fade-in-up">
            <h1 className="text-2xl font-black text-[#1A2744] tracking-tight uppercase">
              Comedor Fiscalía
            </h1>
            <div className="flex items-center gap-3 justify-center text-slate-400">
              <Fingerprint className="text-[#C9A84C]/50" size={16} />
              <p className="text-sm font-bold tracking-[0.2em] uppercase opacity-70">
                Verificando Identidad...
              </p>
            </div>
          </div>
        </div>
      ) : (
        {/* VISTA DE ERROR */}
        <div className="text-center flex flex-col items-center gap-5 max-w-sm animate-fade-in">
          <div className="bg-red-50 p-4 rounded-3xl border border-red-100 shadow-inner">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-800">Acceso Restringido</h2>
            <p className="text-slate-600 font-medium text-sm leading-relaxed pr-4 pl-4">{errorStatus}</p>
          </div>
          <button 
            onClick={() => router.push('/login')}
            className="mt-4 bg-[#1A2744] text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all w-full flex items-center justify-center gap-2"
          >
            Volver al Inicio de Sesión
          </button>
        </div>
      )}

      {/* FOOTER CORPORATIVO CON LOGO GOBIERNO */}
      <div className="fixed bottom-12 flex flex-col items-center pointer-events-none opacity-40">
        <p className="text-[10px] font-black tracking-[0.3em] text-slate-300 uppercase">
          Fiscalía General del Estado de Yucatán
        </p>
        <div className="w-8 h-[2px] bg-[#C9A84C] mt-2 rounded-full"></div>
      </div>

    </div>
  );
}