 export type AdminUser = {
  id: string
  name: string
  email: string
  grade: string
  createdAt: string | null
}

export type AdminOrder = {
  id: string
  studentId: string
  customerName: string
  createdAt: string
  status: string
  paymentStatus: string
  paymentMethod: string
  items: { id: number; name: string; quantity: number; price: number }[]
  shippingAddress?: Record<string, string>
  subtotal?: number
  shipping?: number
  tax?: number
  total: number
}

export type SupportQuery = {
  queryId: string
  studentId: string
  name: string
  email: string
  subject: string
  message: string
  status: "Open" | "In Progress" | "Answered" | "Closed"
  adminReply: string
  createdAt: string
  repliedAt: string | null
}

export type AdminProduct = {
  id: number
  name: string
  description: string
  price: number
  category: string
  grade: string
  difficulty: string
  time: string
  image: string
  accent: string
  stock: number
  enabled?: boolean
}

export type AdminDashboard = {
  totalUsers: number
  activeUsers: number
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  totalQueries: number
  unansweredQueries: number
  totalProducts: number
  lowStockProducts: number
}

const apiBaseUrl = import.meta.env.VITE_API_URL || ""

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${response.status}: ${payload.error || `Request failed (${response.status})`}`)
  return payload as T
}

export const loginAdmin = (username: string, password: string) =>
  request<{ token: string }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })

export const getAdminDashboard = (token: string) =>
  request<AdminDashboard>("/admin/dashboard", {}, token)

export const getAdminUsers = (token: string, search = "", grade = "") => {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (grade) params.set("grade", grade)
  return request<AdminUser[]>(`/admin/users?${params}`, {}, token)
}

export const getAdminUser = (token: string, id: string) =>
  request<{ student: AdminUser; orders: AdminOrder[]; queries: SupportQuery[] }>(
    `/admin/users/${encodeURIComponent(id)}`,
    {},
    token,
  )

export const getAdminOrders = (token: string) => request<AdminOrder[]>("/admin/orders", {}, token)

export const updateAdminOrderStatus = (token: string, id: string, status: string) =>
  request<{ message: string }>(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  }, token)

export const getAdminQueries = (token: string) => request<SupportQuery[]>("/admin/queries", {}, token)

export const getAdminQuery = (token: string, id: string) =>
  request<SupportQuery>(`/admin/queries/${encodeURIComponent(id)}`, {}, token)

export const replyToAdminQuery = (token: string, id: string, adminReply: string) =>
  request<{ message: string }>(`/admin/queries/${encodeURIComponent(id)}/reply`, {
    method: "PUT",
    body: JSON.stringify({ adminReply }),
  }, token)

export const updateAdminQueryStatus = (token: string, id: string, status: string) =>
  request<{ message: string }>(`/admin/queries/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  }, token)

export const getAdminProducts = (token: string) => request<AdminProduct[]>("/admin/products", {}, token)

export const createAdminProduct = (token: string, product: Omit<AdminProduct, "id">) =>
  request<AdminProduct>("/admin/products", {
    method: "POST",
    body: JSON.stringify(product),
  }, token)

export const updateAdminProduct = (token: string, product: AdminProduct) =>
  request<{ message: string }>(`/admin/products/${product.id}`, {
    method: "PUT",
    body: JSON.stringify(product),
  }, token)

export const logoutAdmin = (token: string) =>
  request<{ message: string }>("/admin/logout", { method: "POST" }, token)

export const submitStudentQuery = (token: string, subject: string, message: string) =>
  request<SupportQuery>("/queries", {
    method: "POST",
    body: JSON.stringify({ subject, message }),
  }, token)

export const getStudentQueries = (token: string) => request<SupportQuery[]>("/queries", {}, token)
