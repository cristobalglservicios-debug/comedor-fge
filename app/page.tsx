'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, Utensils, ShieldCheck, User } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('Verificando credenciales...');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Si no hay sesión, al login
        router.push('/login');
        return;
      }

      // Si hay sesión, buscamos el rol en la tabla perfiles
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol, nombre_completo')
        .eq('id', session.user.id)
        .single();

      if (perfil) {
        setMensaje(`Bienvenido, ${perfil.nombre_completo}`);
        
        // Redirección automática por Rol
        setTimeout(() => {
          if (perfil.rol === 'admin') {
            router.push('/admin');
          } else if (perfil.rol === 'cajero') {
            router.push('/cajero');
          } else {
            router.push('/empleado'); // O la ruta que tengas para ellos
          }
        }, 1500);
      } else {
        setMensaje('Perfil no encontrado');
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* LOGO ANIMADO */}
      <div className="mb-8 relative">
        <div className="bg-[#1A2744] w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-900/20 animate-pulse">
          <Utensils className="text-[#C9A84C]" size={40} />
        </div>
        {loading && (
          <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-lg">
            <Loader2 className="text-[#1A2744] animate-spin" size={24} />
          </div>
        )}
      </div>

      {/* TEXTO DE ESTADO */}
      <div className="text-center">
        <h1 className="text-xl font-black text-[#1A2744] tracking-tight uppercase">
          Comedor Fiscalía
        </h1>
        <p className="text-slate-400 text-sm font-medium mt-2">
          {mensaje}
        </p>
      </div>

      {/* DECORACIÓN INFERIOR */}
      <div className="fixed bottom-10 flex flex-col items-center">
        <p className="text-[10px] font-black tracking-[0.2em] text-slate-300 uppercase">
          Gobierno del Estado de Yucatán
        </p>
        <div className="w-12 h-1 bg-[#C9A84C] mt-3 rounded-full opacity-40"></div>
      </div>

    </div>
  );
}