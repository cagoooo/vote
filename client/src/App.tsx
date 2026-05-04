import { useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { FloatingAdButton } from "@/components/floating-ad-button";
import { SwUpdatePrompt, VersionBadge } from "@/components/sw-update-prompt";
import { SiteFooter } from "@/components/site-footer";
import { auth, loginAnonymously } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Teacher from "@/pages/teacher";
import Student from "@/pages/student";
import Dashboard from "@/pages/dashboard";
import Join from "@/pages/join";
import Present from "@/pages/present";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Teacher} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/join" component={Join} />
      <Route path="/present/:id" component={Present} />
      <Route path="/:id" component={Student} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        loginAnonymously().catch(console.error);
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
