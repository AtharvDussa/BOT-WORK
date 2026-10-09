export type ApiProject = {
  id: number
  name: string
  description: string
  price: number
  grade: string
  difficulty: string
  category: string
  time: string
  image: string
  accent: string
  stock: number
  components?: string[]
  generic?: boolean
}

export type ApiOrder = {
  id: string
  studentId: string
  createdAt: string
  status: string
  paymentStatus: string
  paymentMethod: string
  items: { id: number; name: string; quantity: number; price: number; image: string }[]
  shippingAddress: Record<string, string>
  subtotal: number
  shipping: number
  tax: number
  total: number
}

type Student = { id: string; name: string; email: string; grade: string }

const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  "https://bot-work-production-44c5.up.railway.app"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("bot-token")
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload as T
}

export const getProducts = () => request<ApiProject[]>("/products")

export async function verifyGoogleStudent(credential: string) {
  return request<{ verificationToken: string; email: string }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  })
}

export async function login(email: string, studentId: string, password: string, verificationToken?: string) {
  const result = await request<{ token: string; student: Student }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, studentId, password, ...(verificationToken ? { verificationToken } : {}) }),
  })
  localStorage.setItem("bot-token", result.token)
  return result.student
}

export const requestPasswordReset = (studentId: string) =>
  request<{ message: string; resetToken?: string }>("/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ studentId }),
  })

export const resetPassword = (resetToken: string, newPassword: string) =>
  request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ resetToken, newPassword }),
  })

export const getOrders = () => request<ApiOrder[]>("/orders")

export const createOrder = (data: {
  items: { id: number; quantity: number }[]
  paymentMethod: string
  shippingAddress: Record<string, string>
}) => request<ApiOrder>("/orders", { method: "POST", body: JSON.stringify(data) })