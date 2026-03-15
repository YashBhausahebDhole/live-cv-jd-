import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) window.location.href = "/dashboard";
    })();
  }, []);

  async function submit() {
    setErr("");
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Email and password are required.");
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }

      window.location.href = "/dashboard";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen relative">
      <div className="bg-stars absolute inset-0 pointer-events-none" />

      <header className="relative mx-auto max-w-6xl px-6 py-6">
        <div className="text-sm tracking-widest text-white/80">KALIK</div>
      </header>

      <div className="relative mx-auto max-w-6xl px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="glass-border"
        >
          <div className="glass rounded-[24px] p-8">
            <div className="grid gap-10 md:grid-cols-2 items-center">
              <section>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  AI CV–Job Description Matcher
                </h1>
                <p className="mt-3 text-white/70 leading-relaxed">
                  Create an account, upload your CV and Job Description, and get an ATS-focused
                  score, missing skills, and AI-powered suggestions.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-white/70">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Supabase Auth</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Local history</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">PDF / DOCX / TXT</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Charts + AI tips</div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <button
                    className={`text-sm px-3 py-2 rounded-xl border ${
                      mode === "login" ? "border-white/25 bg-white/10" : "border-white/10 bg-white/5"
                    }`}
                    onClick={() => setMode("login")}
                  >
                    Login
                  </button>
                  <button
                    className={`text-sm px-3 py-2 rounded-xl border ${
                      mode === "signup" ? "border-white/25 bg-white/10" : "border-white/10 bg-white/5"
                    }`}
                    onClick={() => setMode("signup")}
                  >
                    Sign up
                  </button>
                </div>

                <h2 className="mt-5 text-xl font-semibold">Login / Sign up</h2>

                <div className="mt-4 space-y-3">
                  <input
                    className="input"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <input
                    className="input"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />

                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
                    onClick={submit}
                    disabled={loading}
                  >
                    {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
                  </motion.button>

                  {err && <p className="text-red-300 text-sm">{err}</p>}
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}