"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        window.location.href = "/chat";
        return;
      }

      setLoading(false);
    }

    checkUser();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Email va parolni kiriting.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/chat";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b1520] flex items-center justify-center text-white">
        <div className="text-[#8fa8c1]">Yuklanmoqda...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1520] text-white flex items-center justify-center p-5">
      <div className="w-full max-w-[520px]">
        <div className="text-center mb-10">
          <div className="mx-auto mb-5 w-20 h-20 rounded-[25px] bg-[#3395e8] flex items-center justify-center text-4xl font-black">
            N
          </div>

          <h1 className="text-5xl font-black tracking-tight">NINA</h1>

          <p className="text-[#8fa8c1] text-xl mt-3">
            Tez. Oddiy. Zamonaviy messenger.
          </p>
        </div>

        <form
          onSubmit={login}
          className="bg-[#172431] border border-[#263442] rounded-[32px] p-8"
        >
          <h2 className="text-3xl font-bold mb-8">Kirish</h2>

          <label className="block text-[#9bb5ce] mb-2">Email</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            className="w-full bg-[#0d1824] border border-[#29394a] rounded-2xl px-5 py-5 outline-none focus:border-[#3395e8] mb-6"
          />

          <label className="block text-[#9bb5ce] mb-2">Parol</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kamida 6 ta belgi"
            className="w-full bg-[#0d1824] border border-[#29394a] rounded-2xl px-5 py-5 outline-none focus:border-[#3395e8]"
          />

          {message && (
            <div className="mt-5 bg-[#243342] rounded-xl p-4 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3395e8] rounded-2xl py-5 font-bold text-lg mt-6 disabled:opacity-50"
          >
            {loading ? "Kirilmoqda..." : "Kirish"}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/register")}
            className="w-full text-[#42a5f5] mt-7 text-lg"
          >
            Yangi akkaunt yaratish
          </button>
        </form>
      </div>
    </main>
  );
}

