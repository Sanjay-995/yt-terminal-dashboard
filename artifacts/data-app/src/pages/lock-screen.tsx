import { useState } from "react";
import { Activity, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/auth/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        onUnlock();
      } else {
        setError(true);
        setCode("");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="w-7 h-7" />
            <span className="text-2xl font-bold tracking-tight">YT Terminal</span>
          </div>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mt-2">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Access required</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the access code to continue
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Access code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(false);
            }}
            className={`text-center tracking-widest text-base ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
            autoFocus
            autoComplete="off"
          />
          {error && (
            <p className="text-sm text-destructive text-center">
              Incorrect access code. Try again.
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || code.length === 0}
          >
            {loading ? "Verifying…" : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}
