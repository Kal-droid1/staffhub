"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/modules/core/components/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reasonMessage =
    reason === "deleted"
      ? "Your account is no longer active. Please contact your administrator."
      : reason === "deactivated"
        ? "Your account has been deactivated. Please contact your administrator."
        : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password");
      return;
    }

    const session = await fetch("/api/auth/session").then((r) => r.json());
    const isTeacher = session?.user?.isTeacher === true;
    const jobTitleName = session?.user?.jobTitleName ?? null;
    const role = session?.user?.role as string | undefined;
    const hasOrgRole = role === "MANAGER" || role === "ADMIN" || Boolean(jobTitleName);
    const isTeacherOnly = isTeacher && !hasOrgRole;

    router.push(isTeacherOnly ? "/my-class" : "/dashboard");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 420, margin: "120px auto", padding: "0 1.5rem" }}>
      <Card>
        <h1 className="page-title" style={{ textAlign: "center" }}>
          StaffHub
        </h1>
        <p className="text-center text-muted mb-2" style={{ fontSize: "0.85rem" }}>
          Sign in to your account
        </p>
        {reasonMessage && (
          <p
            className="form-error"
            style={{ marginBottom: "1rem" }}
            role="alert"
          >
            {reasonMessage}
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="form-error" style={{ marginBottom: "1rem" }}>{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
