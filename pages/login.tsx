import { useState, useEffect } from "react";
import { supabase } from "../src/lib/supabaseClient";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme: "light" | "dark" = stored || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);

    const handleThemeChange = (event: Event) => {
        if (event instanceof CustomEvent) {
            const newTheme = event.detail as "light" | "dark";
            setTheme(newTheme);

        }
    };

    window.addEventListener("themeChange", handleThemeChange);

    return () => {
        window.removeEventListener("themeChange", handleThemeChange);
    };
}, []);


  // Google OAuth
  const signInWithGoogle = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  // Logowanie email + hasło
  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) return setError(error.message);

    router.push("/"); // przekierowanie na główną
  };

  // Rejestracja
  const handleRegister = async () => {
    if (password !== passwordRepeat) {
      return setError("Hasła nie są takie same.");
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) return setError(error.message);

    setMessage("Sprawdź email i potwierdź konto.");
  };

  // Reset hasła (wysyłka maila)
  const handleReset = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) return setError(error.message);

    setMessage("Wysłano link do resetowania hasła.");
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-[#f5f7fb] dark:bg-[#03060a]">
      {/* Tło neonowe */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/25 via-transparent to-cyan-900/15 dark:from-purple-900/40 dark:via-black dark:to-cyan-900/20 animate-pulse" />
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />

      {/* PANEL */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-white/10 rounded-2xl p-10 w-full max-w-md shadow-2xl"
      >


        {/* LOGO */}
        <div className="text-center mb-8">
          <img
                    src={theme === "dark" ? "/images/LOGO_NO_BG_WHITE_BG.png" : "/images/LOGO_WBG.png"}
                    alt="AlbumApp"
                    className="h-10 w-auto mx-auto"
                  />
        </div>

        {/* TYTUŁ */}
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
          {mode === "login" && "Zaloguj się"}
          {mode === "register" && "Utwórz konto"}
          {mode === "reset" && "Reset hasła"}
        </h2>

        {/* WIADOMOŚCI */}
        {error && (
          <p className="text-red-400 text-sm text-center mb-3">{error}</p>
        )}
        {message && (
          <p className="text-green-400 text-sm text-center mb-3">{message}</p>
        )}

        {/* EMAIL */}
        <input
          type="email"
          placeholder="Adres email"
          className="w-full mb-3 p-3 rounded-xl bg-white/80 dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-white/20 focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* PASSWORD */}
        {(mode === "login" || mode === "register") && (
          <input
            type="password"
            placeholder="Hasło"
            className="w-full mb-3 p-3 rounded-xl bg-white/80 dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-white/20 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {/* POWTÓRZ HASŁO */}
        {mode === "register" && (
          <input
            type="password"
            placeholder="Powtórz hasło"
            className="w-full mb-3 p-3 rounded-xl bg-white/80 dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-white/20 focus:outline-none"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
          />
        )}

        {/* PRZYCISK SUBMIT */}
        {mode === "login" && (
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl mb-4 transition-all"
          >
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>
        )}

        {mode === "register" && (
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl mb-4 transition-all"
          >
            {loading ? "Tworzenie konta..." : "Zarejestruj się"}
          </button>
        )}

        {mode === "reset" && (
          <button
            onClick={handleReset}
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 rounded-xl mb-4 transition-all"
          >
            {loading ? "Wysyłanie..." : "Resetuj hasło"}
          </button>
        )}

        {/* Google OAuth */}
        {mode !== "reset" && (
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3 rounded-xl shadow-lg hover:bg-gray-100 transition-all active:scale-[0.98]"
          >
            <img
              src="https://www.svgrepo.com/show/355037/google.svg"
              className="w-5 h-5"
              alt="Google"
            />
            {loading ? "..." : "Zaloguj przez Google"}
          </button>
        )}

        {/* PRZEŁĄCZNIKI */}
        <div className="text-center text-gray-300 dark:text-gray-300 mt-6 text-sm space-y-2">
          {mode === "login" && (
            <>
              <p
                className="cursor-pointer hover:text-white"
                onClick={() => setMode("reset")}
              >
                Zapomniałeś hasła?
              </p>
              <p
                className="cursor-pointer hover:text-white"
                onClick={() => setMode("register")}
              >
                Nie masz konta? Zarejestruj się →
              </p>
            </>
          )}

          {mode === "register" && (
            <p
              className="cursor-pointer hover:text-white"
              onClick={() => setMode("login")}
            >
              Masz już konto? Zaloguj się →
            </p>
          )}

          {mode === "reset" && (
            <p
              className="cursor-pointer hover:text-white"
              onClick={() => setMode("login")}
            >
              Powrót do logowania →
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
