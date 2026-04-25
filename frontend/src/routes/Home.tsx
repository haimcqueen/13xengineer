import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

type Ping = { message: string }

export default function Home() {
  const [ping, setPing] = useState<string>("…")
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setError(null)
    try {
      const res = await api<Ping>("/api/ping")
      setPing(res.message)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">13xengineer</h1>
      <p className="text-muted-foreground">
        Backend says: <code className="rounded bg-muted px-2 py-1">{ping}</code>
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={refresh}>
        <Sparkles /> Ping backend
      </Button>
    </main>
  )
}
