import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { FloatingAdButton } from "@/components/floating-ad-button";
import { auth, loginAnonymously } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { SwUpdatePrompt, VersionBadge } from "@/components/sw-update-prompt";
import { SiteFooter } from "@/components/site-footer";
import Teacher from "@/pages/teacher";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import { errorDetails, reportServiceEvent } from "@/lib/telemetry";

// Lazy load 次要路由（首次載入只下載 Teacher 頁，其他頁面按需載入）
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Student = lazy(() => import("@/pages/student"));
const Join = lazy(() => import("@/pages/join"));
const Present = lazy(() => import("@/pages/present"));

const RouteFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
  </div>
);

function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Teacher} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/join" component={Join} />
        <Route path="/present/:id" component={Present} />
        <Route path="/:id" component={Student} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        loginAnonymously().catch((err) => {
          console.error(err);
          reportServiceEvent({
            status: "failed",
            title: "匿名登入失敗",
            context: "app.loginAnonymously",
            progress: "初始化登入失敗，可能影響投票與讀取題目",
            message: err?.message ?? "匿名登入失敗",
            details: errorDetails(err),
          });
        });
      }
    });
  }, []);

  const base = import.meta.env.VITE_GH_PAGES ? "/vote" : "";

  return (
    <QueryClientProvider client={queryClient}>
      <Router base={base}>
        <AppRouter />
        <SiteFooter />
      </Router>
      <FloatingAdButton />
      <SwUpdatePrompt />
      <VersionBadge />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
