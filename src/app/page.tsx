"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  async function loginWithGoogle() {
    setMessage("");
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/chat`,
      },
    });

    if (error) {
      setMessage(error.message);
      setGoogleLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d18] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#26364d] border-t-[#7c5cff] animate-spin" />
          <div className="text-[#8fa8c1]">NINA yuklanmoqda...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#192548_0%,#0b1220_40%,#060a12_100%)] text-white flex items-center justify-center p-5">
      <div className="w-full max-w-[500px]">

        <div className="text-center mb-8">
          <div className="mx-auto mb-5 w-24 h-24 rounded-[30px] bg-gradient-to-br from-[#00bfff] via-[#665cff] to-[#d946ef] p-[2px] shadow-[0_0_45px_rgba(92,92,255,0.35)]">
            <div className="w-full h-full rounded-[28px] bg-[#10172a] flex items-center justify-center text-5xl font-black">
              N
            </div>
          </div>

          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-white via-[#cbd5ff] to-[#9d8cff] bg-clip-text text-transparent">
            NINA
          </h1>

          <p className="text-[#8fa8c1] text-lg mt-3">
            Tez. Oddiy. Zamonaviy messenger.
          </p>
        </div>

        <form
          onSubmit={login}
          className="bg-[#111a2a]/90 border border-[#26344b] rounded-[32px] p-7 sm:p-8 shadow-2xl backdrop-blur-xl"
        >
          <h2 className="text-3xl font-bold mb-2">Xush kelibsiz</h2>

          <p className="text-[#8092aa] mb-7">
            NINA akkauntingizga kiring
          </p>

          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={googleLoading}
            className="w-full bg-white hover:bg-[#f2f2f2] text-[#202124] rounded-2xl py-4 px-5 font-semibold flex items-center justify-center gap-3 transition active:scale-[0.99] disabled:opacity-60"
          >
            <svg width="23" height="23" viewBox="0 0 48 48">
              <path
                fill="#FFC107"
                d="M43.6 20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11.6 0 19.3-8.1 19.3-19.5 0-1.3-.1-2.7-.3-4.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2c3.6-3.3 5.9-8.2 5.9-14.3 0-1.3-.1-2.7-.3-4.5z"
              />
            </svg>

            {googleLoading
              ? "Google ochilmoqda..."
              : "Google bilan davom etish"}
          </button>

          <div className="flex items-center gap-4 my-7">
            <div className="h-px flex-1 bg-[#29364a]" />
            <span className="text-[#718198] text-sm">yoki</span>
            <div className="h-px flex-1 bg-[#29364a]" />
          </div>

          <label className="block text-[#9bb5ce] mb-2">
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            autoComplete="email"
            className="w-full bg-[#0b1320] border border-[#29394a] rounded-2xl px-5 py-4 outline-none focus:border-[#716cff] focus:ring-2 focus:ring-[#716cff]/20 mb-5 transition"
          />

          <label className="block text-[#9bb5ce] mb-2">
            Parol
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kamida 6 ta belgi"
            autoComplete="current-password"
            className="w-full bg-[#0b1320] border border-[#29394a] rounded-2xl px-5 py-4 outline-none focus:border-[#716cff] focus:ring-2 focus:ring-[#716cff]/20 transition"
          />

          {message && (
            <div className="mt-5 bg-[#251b2a] border border-[#65354e] rounded-xl p-4 text-sm text-[#ffb4c8]">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-gradient-to-r from-[#407cff] via-[#675cff] to-[#a855f7] hover:opacity-95 rounded-2xl py-4 font-bold text-lg mt-6 shadow-lg shadow-[#665cff]/20 transition active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "Kirilmoqda..." : "Kirish"}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/register")}
            className="w-full text-[#8fa7ff] hover:text-white mt-6 text-base transition"
          >
            Akkauntingiz yo'qmi?{" "}
            <span className="font-bold">Ro'yxatdan o'tish</span>
          </button>
        </form>

        <p className="text-center text-[#526277] text-sm mt-6">
          NINA Messenger
        </p>
      </div>
    </main>
  );
}
