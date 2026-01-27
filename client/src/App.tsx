import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { FloatingAdButton } from "@/components/floating-ad-button";
import { loginAnonymously } from "./lib/firebase";
import Teacher from "@/pages/teacher";
import Student from "@/pages/student";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Teacher} />
      <Route path="/vote/:id" component={Student} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    loginAnonymously().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <FloatingAdButton />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
