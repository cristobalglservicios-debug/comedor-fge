'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, User, ArrowRight, ChefHat, UtensilsCrossed, LifeBuoy, Eye, EyeOff } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginScreen() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Estados para el efecto Parallax
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Calculamos el centro de la pantalla al montar
    setMousePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // === LÓGICA INTELIGENTE DE USUARIO CORTO ===
    let emailToLogin = usuario.toLowerCase().trim();
    // Si el usuario no escribió el '@', el sistema lo autocompleta
    if (emailToLogin && !emailToLogin.includes('@')) {
      emailToLogin = `${emailToLogin}@comedorfge.gob.mx`;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToLogin,
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
          router.push('/mi-vale'); // CORRECCIÓN: El admin ahora entra a su perfil de empleado primero
        } else if (rol === 'cajero') {
          router.push('/cajero');
        } else if (rol === 'socio') {
          router.push('/socios');
        } else if (rol === 'gerente') {
          router.push('/gerencia');
        } else {
          router.push('/mi-vale');
        }
      } catch (err) {
        console.error("Error consultando rol:", err);
        router.push('/mi-vale'); // Fallback seguro
      }
    }
  };

  // --- LÓGICA DE SOPORTE WHATSAPP ---
  const handleSoporte = () => {
    const numeroWhatsApp = "5219991190990"; 
    const texto = encodeURIComponent("Hola, tengo problemas para acceder a mi cuenta del Comedor FGE.");
    window.open(`https://wa.me/${numeroWhatsApp}?text=${texto}`, '_blank');
  };

  // Cálculos para el Parallax (movimiento inverso y suave)
  const parallaxX = (mousePos.x - (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)) * -0.05;
  const parallaxY = (mousePos.y - (typeof window !== 'undefined' ? window.innerHeight / 2 : 0)) * -0.05;

  return (
    <div 
      className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      
      {/* BACKGROUND DECORATION CON PARALLAX */}
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[#1A2744] to-[#F8FAFC] -z-10 transition-transform duration-1000 ease-out"
           style={{ transform: `translate(${parallaxX * 0.5}px, ${parallaxY * 0.5}px)` }}></div>
           
      <div className="absolute top-[-20%] right-[-10%] w-[60vh] h-[60vh] bg-amber-500/10 rounded-full blur-[100px] -z-10 transition-transform duration-1000 ease-out"
           style={{ transform: `translate(${parallaxX}px, ${parallaxY}px)` }}></div>
           
      <div className="absolute bottom-[-10%] left-[-10%] w-[40vh] h-[40vh] bg-blue-500/5 rounded-full blur-[80px] -z-10 transition-transform duration-1000 ease-out"
           style={{ transform: `translate(${parallaxX * -1.5}px, ${parallaxY * -1.5}px)` }}></div>

      <div className="w-full max-w-md flex flex-col items-center z-10">
        
        {/* LOGO DINÁMICO (PREMIUM + FLOAT) */}
        <div className="mb-6 group anim-scale-in" style={{animationDelay: '100ms'}}>
            <div className="relative w-24 h-24 bg-gradient-to-br from-[#1A2744] to-[#2A3F6D] rounded-[2rem] rotate-3 flex items-center justify-center shadow-2xl transition-all duration-500 hover:rotate-6 border border-slate-700/50 animate-float cursor-default">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 rounded-[2.5rem]"></div>
              <UtensilsCrossed className="absolute text-white/10 w-12 h-12 -rotate-3 transition-transform duration-500 group-hover:scale-110" strokeWidth={1} />
              <ChefHat className="relative text-amber-400 -rotate-3 drop-shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-transform duration-500 group-hover:scale-110" size={40} strokeWidth={1.5} />
            </div>
        </div>

        {/* Textos Institucionales */}
        <div className="text-center mb-8 anim-fade-up" style={{animationDelay: '200ms'}}>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase drop-shadow-sm">Acceso al Sistema</h1>
          <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mt-1">Comedor Fiscalía</p>
        </div>

        {/* Tarjeta del Formulario */}
        <div className="w-full bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white anim-fade-up transition-transform duration-500 hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]" style={{animationDelay: '300ms'}}>
          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Input Usuario */}
            <div className="space-y-2 group/input">
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase ml-2 group-focus-within/input:text-[#1A2744] transition-colors duration-300">Usuario (Nombre.Apellido)</label>
              <div className="relative overflow-hidden rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within/input:text-amber-500 transition-all duration-500 group-focus-within/input:scale-110 z-10">
                  <User size={18} className="transition-transform duration-300 group-focus-within/input:-rotate-6" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <input
                  type="text"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50/80 border border-slate-200 rounded-2xl text-[#1A2744] font-bold focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 outline-none transition-all duration-300 placeholder:font-normal placeholder:text-slate-300 relative z-0"
                  placeholder="juan.perez"
                />
              </div>
            </div>

            {/* Input Contraseña */}
            <div className="space-y-2 group/input">
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase ml-2 group-focus-within/input:text-[#1A2744] transition-colors duration-300">Contraseña</label>
              <div className="relative overflow-hidden rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within/input:text-amber-500 transition-all duration-500 group-focus-within/input:scale-110 z-10">
                  <Lock size={18} className="transition-transform duration-300 group-focus-within/input:rotate-6" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-4 bg-slate-50/80 border border-slate-200 rounded-2xl text-[#1A2744] font-bold focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 outline-none transition-all duration-300 placeholder:font-normal placeholder:text-slate-300 tracking-widest relative z-0"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-amber-500 focus:outline-none transition-colors z-10 active:scale-90"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Mensaje de Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-500 p-4 rounded-2xl text-[11px] uppercase tracking-wider font-black text-center animate-in shake flex items-center justify-center gap-2 shadow-inner">
                <Lock size={14} className="animate-pulse"/> {error}
              </div>
            )}

            {/* Botón de Submit */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full mt-4 bg-[#1A2744] hover:bg-[#25365d] active:scale-[0.98] text-white py-5 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex justify-center items-center gap-3 shadow-xl shadow-[#1A2744]/20 disabled:opacity-70 disabled:active:scale-100 overflow-hidden group/btn"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover/btn:animate-shimmer"></div>
              
              <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <><Loader2 className="animate-spin text-amber-400" size={16} /> Verificando Identidad...</>
                  ) : (
                    <>Iniciar Sesión <ArrowRight className="text-amber-400 transition-transform group-hover/btn:translate-x-1" size={16} /></>
                  )}
              </span>
            </button>
            
            {/* Botón Secundario de Soporte (WA) */}
            <button
              type="button"
              onClick={handleSoporte}
              className="w-full mt-2 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-500 transition-colors active:scale-95"
            >
              <LifeBuoy size={14} /> ¿Problemas con tu acceso?
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] font-black tracking-[0.5em] text-slate-400/60 uppercase mt-12 anim-fade-up" style={{animationDelay: '400ms'}}>
          FGE Yucatán • App Interna
        </p>
      </div>

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
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
        }
        .anim-fade-up {
          opacity: 0;
          animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-scale-in {
          opacity: 0;
          animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}} />
    </div>
  );
}