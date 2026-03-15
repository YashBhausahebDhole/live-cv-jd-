import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    setErr("");
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Email and password are required.");
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      window.location.href = "/dashboard";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <div className="bg-grid absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-lg px-6 py-14">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur"
        >
          <h1 className="text-3xl font-semibold">Create account</h1>
          <p className="mt-1 text-white/60 text-sm">
            Your analysis history is stored per signed-in user on this browser.
          </p>

          <div className="mt-5 space-y-3">
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-indigo-400/60"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-indigo-400/60"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              onClick={onSignup}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create account"}
            </motion.button>

            {err && <p className="text-red-300 text-sm">{err}</p>}

            <p className="text-sm text-white/70">
              Already have an account?{" "}
              <a className="underline" href="/login">
                Login
              </a>
            </p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}