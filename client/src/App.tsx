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

// 匿名登入遇到網路錯誤的重試間隔（共約 12 秒）
const LOGIN_RETRY_DELAYS_MS = [1000, 3000, 8000];

function App() {
  useEffect(() => {
    // 匿名登入：網路一時斷線（auth/network-request-failed）時自動重試，
    // 避免學生頁永遠停在等待登入；手機離線就等「恢復連線」再試，不發告警。
    let cancelled = false;
    let inFlight = false;
    let attempt = 0;
    let timer: number | undefined;
    let reportedNetworkFailure = false;

    const tryLogin = () => {
      if (cancelled || inFlight || auth.currentUser) return;
      inFlight = true;
      loginAnonymously()
        .then(() => { attempt = 0; })
        .catch((err) => {
          const errorCode = typeof err?.code === "string" ? err.code : "";
          const isNetwork = errorCode === "auth/network-request-failed";
          if (isNetwork) {
            if (attempt < LOGIN_RETRY_DELAYS_MS.length) {
              timer = window.setTimeout(tryLogin, LOGIN_RETRY_DELAYS_MS[attempt++]);
              return;
            }
            // 裝置自己離線不是系統問題；恢復連線時 online 事件會再試
            if (!navigator.onLine || reportedNetworkFailure) return;
            reportedNetworkFailure = true;
          }
          const isReferrerBlocked = errorCode.startsWith("auth/requests-from-referrer-");
          reportServiceEvent({
            status: isNetwork ? "warning" : "failed",
            title: "匿名登入失敗",
            context: "app.loginAnonymously",
            progress: isReferrerBlocked
              ? "Firebase API Key 網站來源限制拒絕登入（請求 Referer 為空或不符）"
              : isNetwork
                ? `已自動重試 ${LOGIN_RETRY_DELAYS_MS.length} 次仍連不上登入服務（裝置顯示有網路）`
                : "初始化登入失敗，可能影響投票與讀取題目",
            message: err?.message ?? "匿名登入失敗",
            details: errorDetails(err),
          });
        })
        .finally(() => { inFlight = false; });
    };

    const onOnline = () => {
      attempt = 0;
      window.clearTimeout(timer);
      tryLogin();
    };
    window.addEventListener("online", onOnline);
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) tryLogin();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      unsubAuth();
    };
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
