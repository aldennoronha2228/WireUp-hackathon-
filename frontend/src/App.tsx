//This file has been inspected and certified - but can change file names i.e BuildNewPage.tsx

import type { ReactNode } from "react";
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "./store/useAuthStore.ts";

const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const BuildNewPage = lazy(() => import("./pages/BuildNewPage.tsx"));


//spinner - can be improved
function RouteLoader(): ReactNode {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-5">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          className="h-10 w-10 rounded-full border-2 border-white/10 border-t-[#c8a0e0]"
        />
        <motion.p
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="text-xs font-medium text-[#8888a8]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Loading...
        </motion.p>
      </div>
    </div>
  );
}

function App(): ReactNode {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  // Handle redirect back from Google OAuth (?auth=success)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      checkAuth();
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (isCheckingAuth) {
    return <RouteLoader />;
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<RouteLoader />}>
        
        <Routes>
          {/* Home is public — auth modal appears inline when needed */}
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />

          {/* Project pipeline */}
          <Route
            path="/project/:id"
            element={authUser ? <BuildNewPage /> : <Navigate to="/" replace />}
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;