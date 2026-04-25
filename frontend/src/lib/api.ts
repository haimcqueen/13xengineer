const API_BASE = import.meta.env.VITE_API_BASE ?? ""

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`API ${path} ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}
