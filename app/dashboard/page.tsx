'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Mail, ArrowRight } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password
    });

    if (error) {
      setError('Credenciales incorrectas. Verifica tu acceso.');
      setLoading(false);
      return;
    }

    // === INTERCEPCIÓN DE SEGURIDAD ===
    if (password === 'FGE2026*') {
      localStorage.setItem('debe_cambiar_password_fge', 'true');
    } else {
      localStorage.removeItem('debe_cambiar_password_fge');
    }

    if (data.user) {
      try {
        const userEmail = data.user.email?.toLowerCase().trim() || '';
        
        // CONSULTA ESTRICTA DE ROL EN LA BASE DE DATOS
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('email', userEmail)
          .maybeSingle();

        const rol = perfil?.rol || 'empleado';

        // REDIRECCIÓN INTELIGENTE BASADA EN EL ROL DE LA DB
        if (rol === 'dev') {
          router.push('/dev-panel');
        } else if (rol === 'admin') {
          router.push('/admin');
        } else if (rol === 'cajero') {
          router.push('/cajero');
        } else {
          router.push('/mi-vale');
        }
      } catch (err) {
        console.error("Error consultando rol:", err);
        router.push('/mi-vale'); // Fallback seguro
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      {/* Fondo decorativo sutil */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#1A2744]/5 to-transparent -z-10"></div>
      
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* LOGO OFICIAL FGE (Igual que en la portada) */}
        <div className="mb-8 flex justify-center">
          <div className="bg-white w-32 h-32 rounded-full flex items-center justify-center shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border border-slate-50 p-2 overflow-hidden">
            <img 
              src="/logo-fge.png" 
              alt="Fiscalía General del Estado de Yucatán"
              className="w-full h-full object-contain rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://fge.yucatan.gob.mx/images/logo-fge-header.png";
              }}
            />
          </div>
        </div>

        {/* Textos Institucionales */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-black text-[#1A2744] tracking-tight uppercase">Acceso al Sistema</h1>
          <p className="text-[#C9A84C] text-sm font-bold tracking-widest uppercase mt-2">Administración Fiscalía</p>
        </div>

        {/* Tarjeta del Formulario */}
        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Input Correo */}
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase ml-2">Correo Institucional</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-[#1A2744] transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-800 font-medium focus:bg-white focus:border-[#C9A84C] focus:ring-4 focus:ring-[#C9A84C]/10 outline-none transition-all"
                  placeholder="ejemplo@fge.gob.mx"
                />
              </div>
            </div>

            {/* Input Contraseña */}
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase ml-2">Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-[#1A2744] transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-800 font-medium focus:bg-white focus:border-[#C9A84C] focus:ring-4 focus:ring-[#C9A84C]/10 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Mensaje de Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-500 p-4 rounded-2xl text-xs font-bold text-center animate-in shake">
                {error}
              </div>
            )}

            {/* Botón de Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-[#1A2744] hover:bg-[#25365d] active:scale-[0.98] text-white py-4 px-6 rounded-2xl font-bold uppercase tracking-widest text-[11px] transition-all flex justify-center items-center gap-3 shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:active:scale-100"
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={16} /> Verificando Identidad...</>
              ) : (
                <>Iniciar Sesión <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] font-black tracking-[0.4em] text-slate-300 uppercase mt-12">
          Fiscalía General del Estado de Yucatán
        </p>
      </div>
    </div>
  );
}