import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createAdminProduct,
  getAdminDashboard,
  getAdminProducts,
  getAdminQuery,
  getAdminQueries,
  getAdminOrders,
  getAdminUser,
  getAdminUsers,
  loginAdmin,
  logoutAdmin,
  replyToAdminQuery,
  updateAdminOrderStatus,
  updateAdminProduct,
  updateAdminQueryStatus,
  type AdminDashboard,
  type AdminOrder,
  type AdminProduct,
  type AdminUser,
  type SupportQuery,
} from "./adminApi"

type Section = "Dashboard" | "Users / Students" | "Orders" | "Queries / Messages" | "Products" | "Settings"
type UserDetail = { student: AdminUser; orders: AdminOrder[]; queries: SupportQuery[] }

const sections: Section[] = ["Dashboard", "Users / Students", "Orders", "Queries / Messages", "Products", "Settings"]
const orderStatuses = ["Pending", "Processing", "Shipped", "Delivered"]
const queryStatuses = ["Open", "In Progress", "Answered", "Closed"]
const blankProduct: Omit<AdminProduct, "id"> = {
  name: "", description: "", price: 0, category: "", grade: "", difficulty: "",
  time: "", image: "", accent: "mint", stock: 0, enabled: true,
}

function tokenFromSession() {
  try {
    return sessionStorage.getItem("bot-admin-token") || ""
  } catch {
    return ""
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

function statusClass(status: string) {
  return `admin-status admin-status-${status.toLowerCase().replaceAll(" ", "-")}`
}

function Icon({ children }: { children: string }) {
  return <span className="admin-nav-icon" aria-hidden="true">{children}</span>
}

export default function AdminPanel() {
  const [route, setRoute] = useState(() => window.location.pathname === "/admin" ? "dashboard" : "login")
  const [token, setToken] = useState(tokenFromSession)
  const [section, setSection] = useState<Section>("Dashboard")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [queries, setQueries] = useState<SupportQuery[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [userGrade, setUserGrade] = useState("")
  const [orderSearch, setOrderSearch] = useState("")
  const [orderFilter, setOrderFilter] = useState("")
  const [querySearch, setQuerySearch] = useState("")
  const [queryFilter, setQueryFilter] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [selectedQuery, setSelectedQuery] = useState<SupportQuery | null>(null)
  const [reply, setReply] = useState("")
  const [productDraft, setProductDraft] = useState<AdminProduct | null>(null)

  const setAdminRoute = useCallback((next: "login" | "dashboard") => {
    const nextPath = next === "dashboard" ? "/admin" : "/admin/login"
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath)
    setRoute(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const clearSession = useCallback(() => {
    try {
      sessionStorage.removeItem("bot-admin-token")
    } catch {
      setError("Could not clear the admin session from this browser.")
    }
    setToken("")
    setDashboard(null)
    setAdminRoute("login")
  }, [setAdminRoute])

  const loadPanelData = useCallback(async (sessionToken: string) => {
    const [nextDashboard, nextUsers, nextOrders, nextQueries, nextProducts] = await Promise.all([
      getAdminDashboard(sessionToken),
      getAdminUsers(sessionToken),
      getAdminOrders(sessionToken),
      getAdminQueries(sessionToken),
      getAdminProducts(sessionToken),
    ])
    setDashboard(nextDashboard)
    setUsers(nextUsers)
    setOrders(nextOrders)
    setQueries(nextQueries)
    setProducts(nextProducts)
  }, [])

  const refreshPanel = useCallback(async () => {
    if (!token) return
    setBusy(true)
    setError("")
    try {
      await loadPanelData(token)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load the admin workspace."
      if (message.includes("401")) clearSession()
      setError(message)
    } finally {
      setBusy(false)
    }
  }, [clearSession, loadPanelData, token])

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname === "/admin" ? "dashboard" : "login")
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (window.location.pathname === "/admin" && !token) {
      setAdminRoute("login")
      return
    }
    if (window.location.pathname === "/admin" && token) {
      setBusy(true)
      loadPanelData(token)
        .then(() => setRoute("dashboard"))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Admin session is no longer valid.")
          clearSession()
        })
        .finally(() => setBusy(false))
    }
  }, [clearSession, loadPanelData, setAdminRoute, token])

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const result = await loginAdmin(username, password)
      sessionStorage.setItem("bot-admin-token", result.token)
      setToken(result.token)
      setPassword("")
      await loadPanelData(result.token)
      setAdminRoute("dashboard")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin sign-in failed.")
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (token) {
      try {
        await logoutAdmin(token)
      } catch {
        setError("The server could not confirm logout; the local session has still been cleared.")
      }
    }
    clearSession()
  }

  const chooseSection = (next: Section) => {
    setSection(next)
    setError("")
    setNotice("")
    setSelectedUser(null)
    setSelectedOrder(null)
    setSelectedQuery(null)
  }

  const showUser = async (id: string) => {
    if (!token) return
    setBusy(true)
    setError("")
    try {
      setSelectedUser(await getAdminUser(token, id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load student details.")
    } finally {
      setBusy(false)
    }
  }

  const showQuery = async (query: SupportQuery) => {
    if (!token) return
    setBusy(true)
    setError("")
    try {
      const detailed = await getAdminQuery(token, query.queryId)
      setSelectedQuery(detailed)
      setReply(detailed.adminReply || "")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load query details.")
    } finally {
      setBusy(false)
    }
  }

  const submitReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !selectedQuery) return
    setBusy(true)
    setError("")
    try {
      await replyToAdminQuery(token, selectedQuery.queryId, reply)
      await refreshPanel()
      const updated = await getAdminQuery(token, selectedQuery.queryId)
      setSelectedQuery(updated)
      setNotice("Reply saved and query marked answered.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your reply.")
    } finally {
      setBusy(false)
    }
  }

  const changeQueryStatus = async (status: string) => {
    if (!token || !selectedQuery) return
    setBusy(true)
    setError("")
    try {
      await updateAdminQueryStatus(token, selectedQuery.queryId, status)
      const updated = { ...selectedQuery, status: status as SupportQuery["status"] }
      setSelectedQuery(updated)
      await refreshPanel()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update query status.")
    } finally {
      setBusy(false)
    }
  }

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !productDraft) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      if (productDraft.id) await updateAdminProduct(token, productDraft)
      else await createAdminProduct(token, productDraft)
      setProductDraft(null)
      await refreshPanel()
      setNotice("Product saved.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save product.")
    } finally {
      setBusy(false)
    }
  }

  const filteredUsers = useMemo(() => users.filter((user) =>
    (!userSearch || `${user.id} ${user.name} ${user.email}`.toLowerCase().includes(userSearch.toLowerCase())) &&
    (!userGrade || user.grade === userGrade),
  ), [userGrade, userSearch, users])
  const filteredOrders = useMemo(() => orders.filter((order) =>
    (!orderSearch || `${order.id} ${order.studentId} ${order.customerName}`.toLowerCase().includes(orderSearch.toLowerCase())) &&
    (!orderFilter || order.status === orderFilter),
  ), [orderFilter, orderSearch, orders])
  const filteredQueries = useMemo(() => queries.filter((query) =>
    (!querySearch || `${query.queryId} ${query.name} ${query.email} ${query.subject} ${query.message}`.toLowerCase().includes(querySearch.toLowerCase())) &&
    (!queryFilter || query.status === queryFilter),
  ), [queries, queryFilter, querySearch])
  const filteredProducts = useMemo(() => products.filter((product) =>
    !productSearch || `${product.name} ${product.category} ${product.grade}`.toLowerCase().includes(productSearch.toLowerCase()),
  ), [productSearch, products])

  const displayedRoute = route === "dashboard" && token
  if (!displayedRoute) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <span className="eyebrow">ROBO KIT / SECURE ADMIN</span>
          <h1>Administrator sign in</h1>
          <p>Use your administrator account to manage the Robo Kit website.</p>
          <form onSubmit={signIn}>
            <label className="field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
            <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            {error && <p className="admin-error" role="alert">{error}</p>}
            <button className="btn btn-primary full-width" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in securely"}</button>
          </form>
          <a href="/" className="admin-back-link">Return to the student website</a>
        </section>
      </main>
    )
  }

  const metricCards: { label: string; value: number; icon: string; hint: string }[] = dashboard ? [
    { label: "Registered users", value: dashboard.totalUsers, icon: "♙", hint: `${dashboard.activeUsers} active` },
    { label: "Total orders", value: dashboard.totalOrders, icon: "▣", hint: `${dashboard.pendingOrders} pending` },
    { label: "Completed orders", value: dashboard.completedOrders, icon: "✓", hint: "Delivered or complete" },
    { label: "Support queries", value: dashboard.totalQueries, icon: "✉", hint: `${dashboard.unansweredQueries} unanswered` },
    { label: "Products", value: dashboard.totalProducts, icon: "◇", hint: `${dashboard.lowStockProducts} low stock` },
  ] : []

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">ROBO<span>KIT</span></a>
        <span className="admin-caption">ADMIN WORKSPACE</span>
        <nav aria-label="Admin sections">
          {sections.map((item, index) => (
            <button key={item} className={section === item ? "active" : ""} onClick={() => chooseSection(item)}>
              <Icon>{["⌂", "♙", "▣", "✉", "◇", "⚙"][index]}</Icon>{item}
            </button>
          ))}
        </nav>
        <button className="admin-logout" onClick={() => void signOut()}><Icon>↪</Icon>Logout</button>
      </aside>

      <section className="admin-content">
        <header className="admin-top">
          <div><span className="eyebrow">BLACK ORANGE TALENT / ADMIN</span><h1>{section}</h1></div>
          <div className="admin-top-actions"><span>Secure administrator session</span><button className="admin-refresh" onClick={() => void refreshPanel()} disabled={busy}>↻ Refresh</button></div>
        </header>
        {(error || notice) && <p className={error ? "admin-error" : "admin-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}
        {busy && <p className="admin-loading" role="status">Loading…</p>}

        {section === "Dashboard" && (
          <>
            <div className="admin-stats admin-metrics">
              {metricCards.map((card) => <article className="admin-stat" key={card.label}>
                <div><span>{card.label}</span><span className="admin-metric-icon">{card.icon}</span></div>
                <strong>{card.value}</strong><small>{card.hint}</small>
              </article>)}
            </div>
            <section className="admin-panel">
              <div className="admin-panel-header"><div><h2>Needs attention</h2><p>Items that may need a response.</p></div></div>
              <div className="admin-attention-grid">
                <button onClick={() => chooseSection("Queries / Messages")}><strong>{dashboard?.unansweredQueries || 0}</strong><span>Open support queries</span></button>
                <button onClick={() => chooseSection("Orders")}><strong>{dashboard?.pendingOrders || 0}</strong><span>Pending orders</span></button>
                <button onClick={() => chooseSection("Products")}><strong>{dashboard?.lowStockProducts || 0}</strong><span>Low-stock products</span></button>
              </div>
            </section>
          </>
        )}

        {section === "Users / Students" && (
          <section className="admin-panel">
            <div className="admin-toolbar"><input aria-label="Search students" placeholder="Search ID, name, or email" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} /><select aria-label="Filter students by grade" value={userGrade} onChange={(event) => setUserGrade(event.target.value)}><option value="">All grades</option>{[...new Set(users.map((user) => user.grade).filter(Boolean))].sort().map((grade) => <option key={grade}>{grade}</option>)}</select></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Grade</th><th>Created</th><th /></tr></thead><tbody>
              {filteredUsers.map((user) => <tr key={user.id}><td>{user.id}</td><td>{user.name || "—"}</td><td>{user.email || "—"}</td><td>{user.grade || "—"}</td><td>{formatDate(user.createdAt)}</td><td><button className="admin-table-action" onClick={() => void showUser(user.id)}>Details</button></td></tr>)}
              {!filteredUsers.length && <tr><td colSpan={6} className="admin-empty">No students found.</td></tr>}
            </tbody></table></div>
            {selectedUser && <div className="admin-detail-card"><button className="admin-close" onClick={() => setSelectedUser(null)}>Close</button><h2>{selectedUser.student.name || selectedUser.student.id}</h2><p>{selectedUser.student.email} · {selectedUser.student.grade} · Joined {formatDate(selectedUser.student.createdAt)}</p><h3>Orders ({selectedUser.orders.length})</h3>{selectedUser.orders.map((order) => <p key={order.id}>{order.id} · {order.status} · ₹{order.total}</p>)}<h3>Queries ({selectedUser.queries.length})</h3>{selectedUser.queries.map((query) => <p key={query.queryId}>{query.queryId} · {query.subject} · {query.status}</p>)}</div>}
          </section>
        )}

        {section === "Orders" && (
          <section className="admin-panel">
            <div className="admin-toolbar"><input aria-label="Search orders" placeholder="Search order, student, or customer" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} /><select aria-label="Filter orders by status" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="">All statuses</option>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Student</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>
              {filteredOrders.map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.customerName || order.studentId}<small className="admin-cell-subtitle">{order.studentId}</small></td><td>{order.items?.map((item) => `${item.name} ×${item.quantity}`).join(", ") || "—"}</td><td>₹{order.total}</td><td>{order.paymentMethod} · {order.paymentStatus}</td><td><select aria-label={`Status for ${order.id}`} value={order.status} onChange={async (event) => { if (!token) return; try { await updateAdminOrderStatus(token, order.id, event.target.value); await refreshPanel() } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update order.") } }}>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></td><td>{formatDate(order.createdAt)}</td><td><button className="admin-table-action" onClick={() => setSelectedOrder(order)}>Details</button></td></tr>)}
              {!filteredOrders.length && <tr><td colSpan={8} className="admin-empty">No orders found.</td></tr>}
            </tbody></table></div>
            {selectedOrder && <div className="admin-detail-card"><button className="admin-close" onClick={() => setSelectedOrder(null)}>Close</button><h2>{selectedOrder.id}</h2><p>{selectedOrder.customerName || selectedOrder.studentId} · {selectedOrder.studentId} · {formatDate(selectedOrder.createdAt)}</p><h3>Items</h3>{selectedOrder.items?.map((item) => <p key={item.id}>{item.name} × {item.quantity} · ₹{item.price}</p>)}<h3>Payment and shipping</h3><p>{selectedOrder.paymentMethod} · {selectedOrder.paymentStatus} · {selectedOrder.status}</p><p>{Object.values(selectedOrder.shippingAddress || {}).filter(Boolean).join(", ") || "No shipping address on record."}</p><p>Subtotal ₹{selectedOrder.subtotal ?? "—"} · Shipping ₹{selectedOrder.shipping ?? "—"} · Tax ₹{selectedOrder.tax ?? "—"} · Total ₹{selectedOrder.total}</p></div>}
          </section>
        )}

        {section === "Queries / Messages" && (
          <section className="admin-panel">
            <div className="admin-toolbar"><input aria-label="Search queries" placeholder="Search query, student, email, or message" value={querySearch} onChange={(event) => setQuerySearch(event.target.value)} /><select aria-label="Filter queries by status" value={queryFilter} onChange={(event) => setQueryFilter(event.target.value)}><option value="">All statuses</option>{queryStatuses.map((status) => <option key={status}>{status}</option>)}</select></div>
            <div className="admin-query-layout">
              <div className="admin-query-list">{filteredQueries.map((query) => <button key={query.queryId} className={`admin-query-item ${selectedQuery?.queryId === query.queryId ? "selected" : ""}`} onClick={() => void showQuery(query)}><span className={statusClass(query.status)}>{query.status}</span><strong>{query.subject}</strong><span>{query.name} · {query.email}</span><small>{query.queryId} · {formatDate(query.createdAt)}</small></button>)}{!filteredQueries.length && <p className="admin-empty">No queries found.</p>}</div>
              {selectedQuery ? <article className="admin-query-detail"><div className="admin-panel-header"><div><h2>{selectedQuery.subject}</h2><p>{selectedQuery.name} · {selectedQuery.email} · {selectedQuery.studentId}</p></div><select aria-label="Query status" value={selectedQuery.status} onChange={(event) => void changeQueryStatus(event.target.value)}>{queryStatuses.map((status) => <option key={status}>{status}</option>)}</select></div><p className="admin-query-message">{selectedQuery.message}</p><small>Received {formatDate(selectedQuery.createdAt)}</small>{selectedQuery.adminReply && <div className="admin-reply-preview"><strong>Previous reply</strong><p>{selectedQuery.adminReply}</p></div>}<form onSubmit={(event) => void submitReply(event)}><label className="field"><span>Reply to student</span><textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} minLength={1} maxLength={5000} required /></label><button className="btn btn-primary" type="submit" disabled={busy}>Send reply and mark answered</button></form></article> : <div className="admin-query-detail admin-query-empty">Select a query to read and respond.</div>}
            </div>
          </section>
        )}

        {section === "Products" && (
          <section className="admin-panel">
            <div className="admin-panel-header"><div><h2>Product catalog</h2><p>Products referenced by orders are disabled, never deleted.</p></div><button className="btn btn-primary" onClick={() => setProductDraft({ ...blankProduct, id: 0 })}>Add product</button></div>
            <div className="admin-toolbar"><input aria-label="Search products" placeholder="Search products" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category / grade</th><th>Difficulty</th><th>Price</th><th>Stock</th><th>Availability</th><th /></tr></thead><tbody>
              {filteredProducts.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small className="admin-cell-subtitle">{product.description}</small></td><td>{product.category} · {product.grade}</td><td>{product.difficulty}</td><td>₹{product.price}</td><td>{product.stock}</td><td><span className={statusClass(product.enabled === false ? "Closed" : "Answered")}>{product.enabled === false ? "Disabled" : "Enabled"}</span></td><td><button className="admin-table-action" onClick={() => setProductDraft({ ...product, enabled: product.enabled !== false })}>Edit</button></td></tr>)}
              {!filteredProducts.length && <tr><td colSpan={7} className="admin-empty">No products found.</td></tr>}
            </tbody></table></div>
          </section>
        )}

        {section === "Settings" && (
          <section className="admin-panel admin-settings"><h2>Admin security</h2><p>Admin credentials are read from the backend environment and never sent to the browser. This session expires after eight hours and is held in session storage for this tab only.</p><p>Configure <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code> in the backend’s ignored <code>.env</code> file. Never commit that file.</p><button className="btn btn-outline" onClick={() => void signOut()}>Sign out</button></section>
        )}
      </section>

      {productDraft && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductDraft(null) }}><section className="admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="admin-product-title"><div className="admin-panel-header"><h2 id="admin-product-title">{productDraft.id ? "Edit product" : "Add product"}</h2><button className="admin-close" onClick={() => setProductDraft(null)}>Close</button></div><form onSubmit={(event) => void saveProduct(event)} className="admin-product-form">
        {([
          ["name", "Product name"], ["description", "Description"], ["category", "Category"], ["grade", "Grade"], ["difficulty", "Difficulty"], ["time", "Build time"], ["image", "Image URL"], ["accent", "Accent"],
        ] as const).map(([field, label]) => <label className="field" key={field}><span>{label}</span>{field === "description" ? <textarea value={productDraft[field]} onChange={(event) => setProductDraft({ ...productDraft, [field]: event.target.value })} required /> : <input value={productDraft[field]} onChange={(event) => setProductDraft({ ...productDraft, [field]: event.target.value })} required />}</label>)}
        <label className="field"><span>Price</span><input type="number" min="0" step="0.01" value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: Number(event.target.value) })} required /></label><label className="field"><span>Stock</span><input type="number" min="0" step="1" value={productDraft.stock} onChange={(event) => setProductDraft({ ...productDraft, stock: Number(event.target.value) })} required /></label>
        {productDraft.id > 0 && <label className="admin-checkbox"><input type="checkbox" checked={productDraft.enabled !== false} onChange={(event) => setProductDraft({ ...productDraft, enabled: event.target.checked })} />Available to students</label>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save product"}</button>
      </form></section></div>}
    </main>
  )
}
