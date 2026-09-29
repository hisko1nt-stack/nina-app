"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const cleanName = name.trim();
    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/\s+/g, "");

    if (!cleanName || !cleanUsername || !email.trim() || !password) {
      setMessage("Barcha maydonlarni to‘ldiring.");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage("Username kamida 3 ta belgidan iborat bo‘lsin.");
      return;
    }

    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      setMessage(
        "Username faqat lotin harflari, raqam, nuqta va _ dan iborat bo‘lsin."
      );
      return;
    }

    if (password.length < 6) {
      setMessage("Parol kamida 6 ta belgidan iborat bo‘lsin.");
      return;
    }

    setLoading(true);

    const { data: existing } = await supabase
      .from("nina_profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      setMessage("Bu username band. Boshqasini tanlang.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: cleanName,
          username: cleanUsername,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setMessage("Akkaunt yaratilmadi.");
      setLoading(false);
      return;
    }

    if (!data.session) {
      setMessage(
        "Akkaunt yaratildi. Email tasdiqlash yoqilgan bo‘lsa, emailingizni tasdiqlab keyin kiring."
      );
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("nina_profiles")
      .upsert(
        {
          id: data.user.id,
          name: cleanName,
          username: cleanUsername,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      setMessage("Profil yaratishda xato: " + profileError.message);
      setLoading(false);
      return;
    }

    window.location.href = "/chat";
  }

  return (
    <main className="min-h-screen bg-[#0b1520] text-white flex items-center justify-center p-5">
      <div className="w-full max-w-[560px] py-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 rounded-[20px] bg-[#3395e8] flex items-center justify-center text-3xl font-black">
            N
          </div>

          <h1 className="text-4xl font-black">NINA</h1>
          <p className="text-[#8fa8c1] mt-2">Yangi akkaunt yarating</p>
        </div>

        <form
          onSubmit={register}
          className="bg-[#172431] border border-[#263442] rounded-[32px] p-8"
        >
          <h2 className="text-3xl font-bold mb-7">Akkaunt yaratish</h2>

          <label className="block text-[#9bb5ce] mb-2">Ismingiz</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan: Test"
            className="w-full bg-[#0d1824] border border-[#29394a] rounded-2xl px-5 py-4 outline-none focus:border-[#3395e8] mb-5"
          />

          <label className="block text-[#9bb5ce] mb-2">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="test1"
            className="w-full bg-[#0d1824] border border-[#29394a] rounded-2xl px-5 py-4 outline-none focus:border-[#3395e8] mb-5"
          />

          <label className="block text-[#9bb5ce] mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="test@gmail.com"
            className="w-full bg-[#0d1824] border border-[#29394a] rounded-2xl px-5 py-4 outline-none focus:border-[#3395e8] mb-5"
          />

          <label className="block text-[#9bb5ce] mb-2">Parol</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kamida 6 ta belgi"
            className="w-full bg-[#0d1824] border border-[#29394a] rounded-2xl px-5 py-4 outline-none focus:border-[#3395e8]"
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
            {loading ? "Yaratilmoqda..." : "Ro‘yxatdan o‘tish"}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="w-full text-[#42a5f5] mt-6"
          >
            Akkauntim bor — kirish
          </button>
        </form>
      </div>
    </main>
  );
}

