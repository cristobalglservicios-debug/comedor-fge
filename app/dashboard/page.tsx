"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (data?.user) {
      // Si el correo es el de admin, mándalo a la carpeta /admin
      if (data.user.email === 'admin@fge.yuc.gob.mx') {
        window.location.href = "/admin";
      } else {
        window.location.href = "/cajero";
      }
    } else {
      alert("Error: Revisa tus datos o confirma el usuario en Supabase");
    }
  };

  return (
    <main className="min-h-screen bg-[#1A2744] flex items-center justify-center p-6 text-black font-sans">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-md border-b-[12px] border-[#C9A84C]">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-[#1A2744] uppercase italic">Administración FGE</h2>
          <p className="text-[#C9A84C] font-bold text-xs uppercase tracking-widest">Sistema de Vales</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="admin@fge.yuc.gob.mx" 
            className="w-full p-4 border-2 rounded-2xl outline-none focus:border-[#C9A84C]" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            className="w-full p-4 border-2 rounded-2xl outline-none focus:border-[#C9A84C]" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <button type="submit" className="w-full bg-[#1A2744] text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            Ingresar
          </button>
        </form>
      </div>
    </main>
  );
}