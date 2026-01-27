import { useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { FloatingAdButton } from "@/components/floating-ad-button";
import { loginAnonymously } from "./lib/firebase";
import Teacher from "@/pages/teacher";
import Student from "@/pages/student";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Teacher} />
      <Route path="/:id" component={Student} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    loginAnonymously().catch(console.error);
  }, []);

  // 根據環境判斷 base path
  const base = import.meta.env.VITE_GH_PAGES ? "/vote" : "";

  return (
    <QueryClientProvider client={queryClient}>
      <Router base={base}>
        <AppRouter />
      </Router>
      <FloatingAdButton />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
