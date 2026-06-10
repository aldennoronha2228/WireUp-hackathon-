//This file is inspected not certified, lots of changes to be done - ie: font, better background, better way to show logo, etc.
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.ts";
import forgeLogo from "../assets/wireup-logo.jpeg";

export default function AuthPage() {
  const { login, signup } = useAuthStore();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  const [data, setData] = useState({
    email: "",
    password: "",
    fullName: ""
  });

  const canSubmit = isLogin
    ? Boolean(data.email.trim() && data.password)
    : Boolean(data.fullName.trim() && data.email.trim() && data.password);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const submit = isLogin ? login(data) : signup(data);

    Promise.resolve(submit)
      .then(() => navigate("/home"))
      .catch(() => {
        // store already handles toast/errors
      });
  };

  return (
    <div className={`relative flex min-h-screen items-center justify-center px-4 py-10 ${
      isDark ? "bg-[rgb(0,0,0)] text-[#e5e5e5]" : "bg-[#f5f5f5] text-[#1a1a1a]"
    }`}>

      <img
        src={forgeLogo}
        alt="Forge logo"
        className="absolute left-6 top-6 h-26 w-auto object-contain"
      />


      {/* Toggle */}
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={`absolute top-6 right-6 rounded-lg px-4 py-2 text-xs font-semibold border transition ${
          isDark
            ? "border-yellow-300/10 hover:bg-yellow-300/10"
            : "border-yellow-300/10 hover:bg-yellow-300/5"
        }`}
      >
        {isDark ? "Light" : "Dark"}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`w-full max-w-md rounded-2xl p-6 sm:p-8 border ${
          isDark
            ? "bg-[#1a1a1a] border-black/10"
            : "bg-[#1a1a1a] border-black/10"
        }`}
      >
        <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${
          isDark ? "text-[#fff]" : "text-[#fff]"
        }`}>
          Account
        </p>

        <h2
          className="mt-3 text-4xl sm:text-5xl leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isLogin ? "Welcome back" : "Create your account"}
        </h2>

        <p className={`mt-2 text-sm ${
          isDark ? "text-[#ffffff]" : "text-[#555]"
        }`}>
          {isLogin ? "Sign in to continue." : "Sign up to start a new project."}
        </p>

        {/* Switch */}
        <div className={`mt-6 flex rounded-lg p-1 ${
          isDark ? "bg-[#1a1a1a]" : "bg-[#eaeaea]"
        }`}>
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              isLogin
                ? (isDark ? "bg-[#3a3a3a]" : "bg-white shadow")
                : ""
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
              !isLogin
                ? (isDark ? "bg-[#272727]" : "bg-white shadow")
                : ""
            }`}
          >
            Signup
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Inputs */}
          <div className="mt-5 space-y-3">
            {!isLogin && (
              <div className="space-y-1">
                <label className={`ml-1 text-xs ${
                  isDark ? "text-[#7c7c7c]" : "text-[#666]"
                }`}>
                  Full name
                </label>
                <input
                  placeholder="Your name"
                  value={data.fullName}
                  className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none border ${
                    isDark
                      ? "bg-[#1f1f1f] border-white/10 focus:bg-[#262626]"
                      : "bg-white border-black/10 focus:bg-[#fafafa]"
                  }`}
                  onChange={e => setData({ ...data, fullName: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-1">
              <label className={`ml-1 text-xs ${
                isDark ? "text-[#888]" : "text-[#666]"
              }`}>
                Email
              </label>
              <input
                placeholder="you@example.com"
                value={data.email}
                className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none border ${
                  isDark
                    ? "bg-[#1f1f1f] border-white/10 focus:bg-[#262626]"
                    : "bg-white border-black/10 focus:bg-[#fafafa]"
                }`}
                onChange={e => setData({ ...data, email: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className={`ml-1 text-xs ${
                isDark ? "text-[#888]" : "text-[#666]"
              }`}>
                Password
              </label>
              <input
                placeholder="••••••••"
                type="password"
                value={data.password}
                className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none border ${
                  isDark
                    ? "bg-[#1f1f1f] border-white/10 focus:bg-[#262626]"
                    : "bg-white border-black/10 focus:bg-[#fafafa]"
                }`}
                onChange={e => setData({ ...data, password: e.target.value })}
              />
            </div>
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition ${
              isDark
                ? "bg-[#3a3a3a] hover:bg-[#4a4a4a]"
                : "bg-[#1a1a1a] text-white hover:bg-[#2d2d2d]"
            } ${!canSubmit ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {isLogin ? "Login" : "Create account"}
          </button>
        </form>

        <p className={`mt-4 text-center text-xs ${
          isDark ? "text-[#888]" : "text-[#666]"
        }`}>
          
        </p>
      </motion.div>
    </div>
  );
}