'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginUnico() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    // 1. Revisamos si la llave abre el candado
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo.trim(), // Le quitamos espacios accidentales
      password: password,
    });

    if (error) {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.');
      setCargando(false);
      return;
    }

    // 2. EL CEREBRO DEL ENRUTAMIENTO (Ahora más inteligente)
    const emailUsuario = data.user?.email?.toLowerCase() || '';

    // Si el correo contiene la palabra "admin"
    if (emailUsuario.includes('admin')) {
      router.push('/admin');
    } 
    // Si el correo contiene la palabra "comedor"
    else if (emailUsuario.includes('comedor')) {
      router.push('/cajero');
    } 
    // Si es cualquier otra persona
    else {
      router.push('/mi-vale');
    }
  };

  return (
    <div className="min-h-screen bg-[#1A2744] flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black text-white mb-2 tracking-tight">COMEDOR FGE</h1>
        <p className="text-[#C9A84C] font-bold tracking-[0.2em] uppercase text-sm">Acceso Seguro</p>
      </div>

      <form onSubmit={iniciarSesion} className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md">
        <div className="mb-6">
          <label className="block text-slate-500 text-xs font-bold mb-2 uppercase tracking-wider">
            Correo Electrónico
          </label>
          <input 
            type="email" 
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full p-4 border-2 border-slate-100 rounded-2xl text-slate-700 focus:border-blue-500 outline-none transition-colors"
            placeholder="ejemplo@fge.yuc.gob.mx"
            required
          />
        </div>

        <div className="mb-8">
          <label className="block text-slate-500 text-xs font-bold mb-2 uppercase tracking-wider">
            Contraseña
          </label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border-2 border-slate-100 rounded-2xl text-slate-700 focus:border-blue-500 outline-none transition-colors"
            placeholder="••••••••"
            required
          />
        </div>

        <button 
          type="submit"
          disabled={cargando}
          className="w-full bg-[#C9A84C] hover:bg-amber-500 text-[#1A2744] py-4 rounded-2xl font-black text-lg transition-all shadow-lg flex justify-center items-center"
        >
          {cargando ? 'VERIFICANDO...' : 'ENTRAR AL SISTEMA'}
        </button>

        {error && (
          <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 text-red-500 text-sm text-center font-medium">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}