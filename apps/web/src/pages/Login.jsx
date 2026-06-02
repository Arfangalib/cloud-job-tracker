import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cloud } from "lucide-react";
import { useAuth } from "../lib/auth-context.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs.jsx";
import { toast } from "../components/ui/toast.jsx";

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register({ name: data.name, email: data.email, password: data.password });
        toast.success("Account created. Please sign in.");
        setMode("login");
      } else {
        const user = await login({ email: data.email, password: data.password });
        toast.success(`Welcome, ${user.name}`);
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#dcefe8,#f7f4e7_55%,#e8eef7)] p-6">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-card/90 p-8 shadow-[0_20px_60px_rgba(24,32,28,0.12)] backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <Cloud size={34} className="text-primary" />
          <div>
            <strong className="block text-xl leading-tight">Cloud Job Tracker</strong>
            <span className="block text-sm text-muted-foreground">
              Apify ingestion · AWS-ready workers · ATS tailoring
            </span>
          </div>
        </div>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value={mode}>
            <form onSubmit={handleSubmit} className="grid gap-3">
              {mode === "register" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="Your name" required />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••••" required />
                {mode === "register" ? (
                  <p className="text-xs text-muted-foreground">At least 10 characters.</p>
                ) : null}
              </div>
              <Button type="submit" disabled={submitting} className="mt-1">
                {submitting ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
