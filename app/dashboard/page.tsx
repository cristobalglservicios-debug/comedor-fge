'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Intento de inicio de sesión con Supabase
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Correo o contraseña incorrectos.');
        setLoading(false);
        return;
      }

      // Si el login es exitoso, lo mandamos a la raíz ("/") 
      // para que tu página inteligente lo redirija a donde debe ir.
      router.push('/');
      
    } catch (err) {
      setError('Ocurrió un error de conexión.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm">
        
        {/* ENCABEZADO Y LOGO */}
        <div className="text-center mb-10">
          <div className="bg-white w-28 h-28 mx-auto rounded-full flex items-center justify-center shadow-xl shadow-slate-200 border border-slate-100 p-1 mb-6">
            <img 
              src="/Logo-FGE.jpg" 
              alt="Logo FGE"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png";
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-[#1A2744] tracking-tight uppercase">
            Acceso al Sistema
          </h1>
          <p className="text-[#C9A84C] text-sm font-bold tracking-widest mt-1">
            COMEDOR FISCALÍA
          </p>
        </div>

        {/* TARJETA DEL FORMULARIO */}
        <div className="bg-white p-8 rounded-[2rem] shadow-2xl shadow-blue-900/10 border border-slate-100">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* CAMPO CORREO */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
                Correo Institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-slate-300" size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium text-[#1A2744] focus:ring-2 focus:ring-[#C9A84C] transition-all outline-none"
                  placeholder="ejemplo@fge.gob.mx"
                  required
                />
              </div>
            </div>

            {/* CAMPO CONTRASEÑA */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="text-slate-300" size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium text-[#1A2744] focus:ring-2 focus:ring-[#C9A84C] transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* MENSAJE DE ERROR */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium animate-fade-in">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* BOTÓN DE SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A2744] text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-[#25365d] disabled:opacity-70 disabled:active:scale-100"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Verificando...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight size={18} className="text-[#C9A84C]" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* PIE DE PÁGINA */}
        <div className="mt-10 text-center opacity-40">
          <p className="text-[9px] font-black tracking-[0.4em] text-slate-400 uppercase">
            Fiscalía General del Estado de Yucatán
          </p>
        </div>

      </div>
    </div>
  );
}