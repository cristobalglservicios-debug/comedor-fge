'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, Utensils } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      // 1. Verificamos si hay alguien logueado
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Si no hay nadie, al Login para que ponga sus credenciales
        router.push('/login');
      } else {
        // 2. Si ya entró, consultamos su perfil específico
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();

        // 3. Redirección inteligente según tus 3 perfiles
        if (perfil?.rol === 'admin') {
          router.push('/admin');
        } else if (perfil?.rol === 'cajero') {
          router.push('/cajero');
        } else if (perfil?.rol === 'empleado') {
          router.push('/empleado'); // O la ruta que uses para los empleados
        } else {
          // Si por algo no tiene rol asignado, mejor que vuelva a loguearse
          router.push('/login');
        }
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      {/* Animación de entrada elegante */}
      <div className="bg-[#1A2744] w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/20 mb-8">
        <Utensils className="text-[#C9A84C] animate-pulse" size={42} />
      </div>
      
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Loader2 className="text-[#1A2744] animate-spin" size={20} />
          <span className="text-[#1A2744] font-bold tracking-widest text-xs uppercase">
            Validando Perfil
          </span>
        </div>
        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-[0.3em]">
          Fiscalía General del Estado
        </p>
      </div>
    </div>
  );
}