import dns from 'node:dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);
import "dotenv/config"
import { createServer } from "node:http"
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { MongoClient } from "mongodb"
import nodemailer from "nodemailer"
import { pathToFileURL } from "node:url"
import { OAuth2Client } from "google-auth-library"

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017"
const databaseName = process.env.MONGODB_DATABASE || "robo_kit"
const port = Number(process.env.PORT || 5000)
const mongoClient = new MongoClient(mongoUri)
const googleAuthClient = new OAuth2Client()
let database
const sessions = new Map()
const emailVerificationTokens = new Map()
const adminSessions = new Map()
const orderStatuses = ["Pending", "Processing", "Shipped", "Delivered"]
const queryStatuses = ["Open", "In Progress", "Answered", "Closed"]
const paymentMethods = ["UPI", "Card", "Net Banking", "QR Code", "Cash on Delivery"]

const projects = [
  { id: 1, name: "Smart Plant Monitor", description: "Build a sensor-powered system that cares for your plants.", price: 1499, grade: "Grade 8", difficulty: "Intermediate", category: "IoT", time: "4–6 hours", image: "https://images.unsplash.com/photo-1631378297854-185cff6b0986?auto=format&fit=crop&w=900&q=85", accent: "mint", stock: 18 },
  { id: 2, name: "Robo Rover Kit", description: "Assemble and program your very own mini rover.", price: 2199, grade: "Grade 8", difficulty: "Intermediate", category: "Robotics", time: "6–8 hours", image: "https://images.unsplash.com/photo-1518314916381-77a37c2a49ae?auto=format&fit=crop&w=900&q=85", accent: "lavender", stock: 12 },
  { id: 3, name: "Circuit Explorer", description: "Discover the magic of electricity, one circuit at a time.", price: 999, grade: "Grade 8", difficulty: "Beginner", category: "Electronics", time: "2–3 hours", image: "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?auto=format&fit=crop&w=900&q=85", accent: "peach", stock: 25 },
  { id: 4, name: "Weather Station", description: "Measure the world around you with real-time sensors.", price: 1799, grade: "Grade 8", difficulty: "Intermediate", category: "Science", time: "4–5 hours", image: "https://images.unsplash.com/photo-1603732551658-5fabbafa84eb?auto=format&fit=crop&w=900&q=85", accent: "sky", stock: 9 },
  { id: 5, name: "LED Art Studio", description: "Bring your ideas to life with light and simple circuits.", price: 799, grade: "All Grades", difficulty: "Beginner", category: "Electronics", time: "2–3 hours", image: "https://images.unsplash.com/photo-1553408226-42ecf81a214c?auto=format&fit=crop&w=900&q=85", accent: "lavender", stock: 16, generic: true },
  { id: 6, name: "Code & Create Kit", description: "Make your first interactive invention from scratch.", price: 1299, grade: "All Grades", difficulty: "Beginner", category: "Programming", time: "3–4 hours", image: "https://images.unsplash.com/photo-1577962144759-8dec6b55c952?auto=format&fit=crop&w=900&q=85", accent: "mint", stock: 14, generic: true },
  { id: 7, name: "Solar Discovery Kit", description: "Explore clean energy with hands-on experiments.", price: 1199, grade: "All Grades", difficulty: "Beginner", category: "Science", time: "3–5 hours", image: "https://images.unsplash.com/photo-1586920740142-346aea2a2124?auto=format&fit=crop&w=900&q=85", accent: "peach", stock: 0, generic: true },
  { id: 8, name: "Sensor Lab Pro", description: "Experiment with motion, light, and sound sensors.", price: 1899, grade: "Grade 9", difficulty: "Advanced", category: "IoT", time: "6–8 hours", image: "https://images.unsplash.com/photo-1649959168260-2eb9702d7b69?auto=format&fit=crop&w=900&q=85", accent: "sky", stock: 7 },
]

async function connectDatabase() {
  await mongoClient.connect()
  database = mongoClient.db(databaseName)

  const students = database.collection("students")
  const productsCollection = database.collection("products")
  const orders = database.collection("orders")
  const queries = database.collection("queries")
  await Promise.all([
    students.createIndex({ id: 1 }, { unique: true }),
    productsCollection.createIndex({ id: 1 }, { unique: true }),
    orders.createIndex({ studentId: 1, createdAt: -1 }),
    queries.createIndex({ queryId: 1 }, { unique: true }),
    queries.createIndex({ studentId: 1, createdAt: -1 }),
    queries.createIndex({ status: 1, createdAt: -1 }),
  ])

  await Promise.all(
    projects.map(({ stock, ...product }) =>
      productsCollection.updateOne(
        { id: product.id },
        { $setOnInsert: { ...product, stock, createdAt: new Date() } },
        { upsert: true },
      ),
    ),
  )
}

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  let body = ""
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new Error("Request body is too large")
  }
  return body ? JSON.parse(body) : {}
}

function authenticatedStudent(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "")
  return token ? sessions.get(token) : undefined
}

function authenticatedAdmin(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "")
  const session = token ? adminSessions.get(token) : undefined
  if (!session) return undefined
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token)
    return undefined
  }
  return session
}

function verifyPassword(password, salt, expectedHash) {
  const actualHash = scryptSync(password, salt, 64)
  const storedHash = Buffer.from(expectedHash, "hex")
  return actualHash.length === storedHash.length && timingSafeEqual(actualHash, storedHash)
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function matchesSearch(fields, value) {
  if (!value) return {}
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return { $or: fields.map((field) => ({ [field]: { $regex: escaped, $options: "i" } })) }
}

function combineFilters(...filters) {
  const active = filters.filter((filter) => Object.keys(filter).length > 0)
  if (active.length === 0) return {}
  if (active.length === 1) return active[0]
  return { $and: active }
}

function safeStringEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validateProduct(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Product details must be an object.")
  }
  const fields = {
    name: { max: 160 },
    description: { max: 5000 },
    category: { max: 80 },
    grade: { max: 80 },
    difficulty: { max: 80 },
    time: { max: 80 },
    image: { max: 1000 },
    accent: { max: 40 },
  }
  const product = {}
  for (const [field, config] of Object.entries(fields)) {
    if (body[field] === undefined && partial) continue
    if (typeof body[field] !== "string" || !body[field].trim() || body[field].length > config.max) {
      throw new ApiError(400, `${field} is required and must be no more than ${config.max} characters.`)
    }
    product[field] = body[field].trim()
  }
  for (const field of ["price", "stock"]) {
    if (body[field] === undefined && partial) continue
    const value = Number(body[field])
    if (!Number.isFinite(value) || value < 0 || (field === "stock" && !Number.isInteger(value))) {
      throw new ApiError(400, `Enter a valid ${field}.`)
    }
    product[field] = value
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") throw new ApiError(400, "Product enabled must be true or false.")
    product.enabled = body.enabled
  }
  return product
}

export function createApiServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`)
    const origin = request.headers.origin
    const allowedOrigins = new Set([
      "http://localhost:8443",
      ...(process.env.CORS_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean),
      ...(process.env.FRONTEND_URL ? [new URL(process.env.FRONTEND_URL).origin] : []),
    ])

    if (origin && !allowedOrigins.has(origin)) {
      console.warn("[cors] Rejected request from an unconfigured origin.")
      return send(response, 403, { error: "This website origin is not allowed to access the API." })
    }
    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin)
      response.setHeader("Vary", "Origin")
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204)
      return response.end()
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        await database.command({ ping: 1 })
        return send(response, 200, { status: "ok", database: "connected" })
      }
      if (request.method === "GET" && url.pathname === "/api/products") {
        const products = await database.collection("products")
          .find({ enabled: { $ne: false } }, { projection: { _id: 0, createdAt: 0 } })
          .sort({ id: 1 })
          .toArray()
        return send(response, 200, products)
      }
      if (request.method === "POST" && ["/api/auth/google", "/api/auth/verify-google"].includes(url.pathname)) {
        const body = await readJson(request)
        const googleClientId = process.env.GOOGLE_CLIENT_ID
        if (!googleClientId) {
          console.error("[google-auth] GOOGLE_CLIENT_ID is missing from the backend environment.")
          throw new ApiError(503, "Google sign-in is not configured. Please contact your administrator.")
        }
        if (typeof body.credential !== "string" || body.credential.length > 10_000) {
          console.warn("[google-auth] Google credential was missing or malformed.")
          throw new ApiError(400, "Complete Google sign-in to continue.")
        }
        let googlePayload
        try {
          const ticket = await googleAuthClient.verifyIdToken({
            idToken: body.credential,
            audience: googleClientId,
          })
          googlePayload = ticket.getPayload()
        } catch (error) {
          const detail = error instanceof Error ? error.message : ""
          const category = /expir|too late/i.test(detail)
            ? "expired ID token"
            : /audience|recipient/i.test(detail)
              ? "wrong token audience; check GOOGLE_CLIENT_ID against the frontend Client ID"
              : "invalid ID token signature or claims"
          console.warn(`[google-auth] Rejected ${category}.`)
          return send(response, 401, { error: "Google sign-in could not be verified. Please try again." })
        }
        if (!googlePayload?.email || googlePayload.email_verified !== true) {
          console.warn("[google-auth] Verified token did not include a verified email claim.")
          return send(response, 401, { error: "Google sign-in could not be verified. Please try again." })
        }
        const email = normalizeEmail(googlePayload.email)
        const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const student = await database.collection("students").findOne(
          { email: { $regex: `^${escapedEmail}$`, $options: "i" } },
          { projection: { _id: 0, email: 1 } },
        )
        if (!student) {
          console.info("[google-auth] Google account is valid, but its email is not registered as a student.")
          return send(response, 401, { error: "This email is not registered. Please contact your administrator." })
        }
        const now = Date.now()
        for (const [token, verification] of emailVerificationTokens) {
          if (verification.expiresAt <= now) emailVerificationTokens.delete(token)
        }
        const verificationToken = randomBytes(32).toString("hex")
        emailVerificationTokens.set(verificationToken, { email, expiresAt: now + 10 * 60 * 1000 })
        return send(response, 200, { verificationToken, email })
      }
      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        const body = await readJson(request)
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : ""
        const verificationToken = typeof body.verificationToken === "string" && body.verificationToken
          ? body.verificationToken
          : undefined
        const verification = verificationToken ? emailVerificationTokens.get(verificationToken) : undefined
        if (verificationToken && (!verification || verification.expiresAt <= Date.now() || verification.email !== email)) {
          emailVerificationTokens.delete(verificationToken)
          return send(response, 401, { error: "Email verification expired. Please verify your email again." })
        }
        const studentId = typeof body.studentId === "string" ? body.studentId.trim().toUpperCase() : ""
        const student = await database.collection("students").findOne({ id: studentId })
        if (
          !student ||
          typeof student.email !== "string" ||
          (verificationToken && normalizeEmail(student.email) !== email) ||
          typeof body.password !== "string" ||
          !verifyPassword(body.password, student.salt, student.passwordHash)
        ) {
          return send(response, 401, { error: "Student ID or password is incorrect." })
        }
        const token = randomBytes(32).toString("hex")
        const publicStudent = { id: student.id, name: student.name, email: student.email, grade: student.grade }
        sessions.set(token, publicStudent)
        if (verificationToken) emailVerificationTokens.delete(verificationToken)
        return send(response, 200, { token, student: publicStudent })
      }
      if (request.method === "POST" && url.pathname === "/api/admin/login") {
        const body = await readJson(request)
        const adminUsername = process.env.ADMIN_USERNAME
        const adminPassword = process.env.ADMIN_PASSWORD
        if (!adminUsername || !adminPassword) {
          throw new ApiError(503, "Admin login is not configured on the server.")
        }
        const submittedUsername = typeof body.username === "string" ? body.username : ""
        const submittedPassword = typeof body.password === "string" ? body.password : ""
        const usernameMatches = safeStringEqual(submittedUsername, adminUsername)
        const passwordMatches = safeStringEqual(submittedPassword, adminPassword)
        if (!usernameMatches || !passwordMatches) {
          return send(response, 401, { error: "Admin username or password is incorrect." })
        }
        const token = randomBytes(32).toString("hex")
        adminSessions.set(token, { expiresAt: Date.now() + 8 * 60 * 60 * 1000 })
        return send(response, 200, { token })
      }
      if (url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) {
        const adminSession = authenticatedAdmin(request)
        if (!adminSession) return send(response, 401, { error: "Admin authentication is required." })
        if (request.method === "POST" && url.pathname === "/api/admin/logout") {
          const token = request.headers.authorization?.replace(/^Bearer\s+/i, "")
          if (token) adminSessions.delete(token)
          return send(response, 200, { message: "Signed out." })
        }

        const students = database.collection("students")
        const orders = database.collection("orders")
        const queries = database.collection("queries")
        const products = database.collection("products")

        if (request.method === "GET" && url.pathname === "/api/admin/dashboard") {
          const [
            totalUsers,
            activeUsers,
            totalOrders,
            pendingOrders,
            completedOrders,
            totalQueries,
            unansweredQueries,
            totalProducts,
            lowStockProducts,
          ] = await Promise.all([
            students.countDocuments(),
            students.countDocuments({ status: { $nin: ["Inactive", "Disabled"] } }),
            orders.countDocuments(),
            orders.countDocuments({ status: { $in: ["Pending", "Processing"] } }),
            orders.countDocuments({ status: { $in: ["Completed", "Delivered"] } }),
            queries.countDocuments(),
            queries.countDocuments({ status: { $in: ["Open", "In Progress"] } }),
            products.countDocuments(),
            products.countDocuments({ stock: { $lte: 5 }, enabled: { $ne: false } }),
          ])
          return send(response, 200, {
            totalUsers, activeUsers, totalOrders, pendingOrders, completedOrders,
            totalQueries, unansweredQueries, totalProducts, lowStockProducts,
          })
        }

        if (request.method === "GET" && url.pathname === "/api/admin/users") {
          const filters = [
            matchesSearch(["id", "name", "email"], url.searchParams.get("search")?.trim() || ""),
          ]
          const grade = url.searchParams.get("grade")?.trim()
          if (grade) filters.push({ grade })
          const users = await students.find(combineFilters(...filters), {
            projection: { _id: 0, id: 1, name: 1, email: 1, grade: 1, createdAt: 1 },
          }).sort({ createdAt: -1 }).limit(500).toArray()
          return send(response, 200, users)
        }
        const userDetailMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
        if (request.method === "GET" && userDetailMatch) {
          const id = decodeURIComponent(userDetailMatch[1])
          const student = await students.findOne({ id }, {
            projection: { _id: 0, id: 1, name: 1, email: 1, grade: 1, createdAt: 1 },
          })
          if (!student) throw new ApiError(404, "Student not found.")
          const [studentOrders, studentQueries] = await Promise.all([
            orders.find({ studentId: id }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
            queries.find({ studentId: id }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
          ])
          return send(response, 200, { student, orders: studentOrders, queries: studentQueries })
        }
        if (request.method === "GET" && url.pathname === "/api/admin/orders") {
          const search = url.searchParams.get("search")?.trim() || ""
          const status = url.searchParams.get("status")?.trim()
          const paymentStatus = url.searchParams.get("paymentStatus")?.trim()
          const orderFilter = combineFilters(
            matchesSearch(["id", "studentId"], search),
            status ? { status } : {},
            paymentStatus ? { paymentStatus } : {},
          )
          const result = await orders.find(orderFilter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(500).toArray()
          const studentIds = [...new Set(result.map((order) => order.studentId))]
          const users = await students.find({ id: { $in: studentIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
          const names = new Map(users.map((user) => [user.id, user.name || ""]))
          return send(response, 200, result.map((order) => ({ ...order, customerName: names.get(order.studentId) || "" })))
        }
        const orderStatusMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/)
        if (request.method === "PUT" && orderStatusMatch) {
          const orderId = decodeURIComponent(orderStatusMatch[1])
          const body = await readJson(request)
          if (!orderStatuses.includes(body.status)) throw new ApiError(400, "Choose a valid order status.")
          const result = await orders.updateOne({ id: orderId }, { $set: { status: body.status, updatedAt: new Date() } })
          if (result.matchedCount === 0) throw new ApiError(404, "Order not found.")
          return send(response, 200, { message: "Order status updated." })
        }
        if (request.method === "GET" && url.pathname === "/api/admin/queries") {
          const search = url.searchParams.get("search")?.trim() || ""
          const status = url.searchParams.get("status")?.trim()
          const filter = combineFilters(
            matchesSearch(["queryId", "studentId", "name", "email", "subject", "message"], search),
            status && status !== "All" ? { status } : {},
          )
          const result = await queries.find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(500).toArray()
          return send(response, 200, result)
        }
        const queryDetailMatch = url.pathname.match(/^\/api\/admin\/queries\/([^/]+)$/)
        if (request.method === "GET" && queryDetailMatch) {
          const query = await queries.findOne({ queryId: decodeURIComponent(queryDetailMatch[1]) }, { projection: { _id: 0 } })
          if (!query) throw new ApiError(404, "Query not found.")
          return send(response, 200, query)
        }
        const queryReplyMatch = url.pathname.match(/^\/api\/admin\/queries\/([^/]+)\/reply$/)
        if (request.method === "PUT" && queryReplyMatch) {
          const queryId = decodeURIComponent(queryReplyMatch[1])
          const body = await readJson(request)
          if (typeof body.adminReply !== "string" || !body.adminReply.trim() || body.adminReply.length > 5000) {
            throw new ApiError(400, "Enter a reply of no more than 5000 characters.")
          }
          const result = await queries.updateOne(
            { queryId },
            { $set: { adminReply: body.adminReply.trim(), repliedAt: new Date(), status: "Answered" } },
          )
          if (result.matchedCount === 0) throw new ApiError(404, "Query not found.")
          return send(response, 200, { message: "Reply saved and query marked answered." })
        }
        const queryStatusMatch = url.pathname.match(/^\/api\/admin\/queries\/([^/]+)\/status$/)
        if (request.method === "PUT" && queryStatusMatch) {
          const queryId = decodeURIComponent(queryStatusMatch[1])
          const body = await readJson(request)
          if (!queryStatuses.includes(body.status)) throw new ApiError(400, "Choose a valid query status.")
          const result = await queries.updateOne({ queryId }, { $set: { status: body.status } })
          if (result.matchedCount === 0) throw new ApiError(404, "Query not found.")
          return send(response, 200, { message: "Query status updated." })
        }
        if (request.method === "GET" && url.pathname === "/api/admin/products") {
          const result = await products.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray()
          return send(response, 200, result)
        }
        if (request.method === "POST" && url.pathname === "/api/admin/products") {
          const body = await readJson(request)
          const product = validateProduct(body)
          const lastProduct = await products.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).next()
          product.id = (lastProduct?.id || 0) + 1
          product.createdAt = new Date()
          product.enabled = true
          await products.insertOne(product)
          const { _id, ...publicProduct } = product
          return send(response, 201, publicProduct)
        }
        const productMatch = url.pathname.match(/^\/api\/admin\/products\/(\d+)$/)
        if (request.method === "PUT" && productMatch) {
          const id = Number(productMatch[1])
          const body = await readJson(request)
          const product = validateProduct(body, true)
          const result = await products.updateOne({ id }, { $set: { ...product, updatedAt: new Date() } })
          if (result.matchedCount === 0) throw new ApiError(404, "Product not found.")
          return send(response, 200, { message: "Product updated." })
        }
        if (request.method === "GET" && url.pathname === "/api/admin/settings") {
          return send(response, 200, { database: databaseName, sessionExpiresInHours: 8 })
        }
        return send(response, 404, { error: "Admin endpoint not found." })
      }
      if (request.method === "POST" && url.pathname === "/api/auth/request-password-reset") {
        const smtpHost = process.env.SMTP_HOST
        const smtpPort = Number(process.env.SMTP_PORT || 587)
        const smtpUser = process.env.SMTP_USER
        const smtpPassword = process.env.SMTP_PASSWORD
        const smtpFrom = process.env.SMTP_FROM || smtpUser
        const emailConfigured = Boolean(smtpHost && smtpUser && smtpPassword && smtpFrom && process.env.FRONTEND_URL)
        if (!emailConfigured && process.env.NODE_ENV === "production") {
          throw new ApiError(503, "Password reset email is not configured. Please contact your administrator.")
        }

        const body = await readJson(request)
        const studentId = String(body.studentId || "").trim().toUpperCase()
        if (!studentId) throw new ApiError(400, "Enter your Student ID to request a reset link.")

        const student = await database.collection("students").findOne({ id: studentId })
        if (!student || typeof student.email !== "string" || !student.email) {
          return send(response, 200, { message: "If that Student ID is registered, a password reset link has been sent to its email address." })
        }

        const resetToken = randomBytes(32).toString("hex")
        const resetTokenHash = createHash("sha256").update(resetToken).digest("hex")
        const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
        await database.collection("students").updateOne(
          { _id: student._id },
          { $set: { passwordResetTokenHash: resetTokenHash, passwordResetExpiresAt: resetExpiresAt } },
        )

        if (!emailConfigured) {
          return send(response, 200, {
            message: "Development reset link created. It expires in one hour.",
            resetToken,
          })
        }

        const resetUrl = new URL("/", process.env.FRONTEND_URL)
        resetUrl.searchParams.set("resetToken", resetToken)
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPassword },
        })
        try {
          await transporter.sendMail({
            from: smtpFrom,
            to: student.email,
            subject: "Reset your Robo Kit password",
            text: `Use this link within one hour to reset your password:\n\n${resetUrl}\n\nIf you did not request this reset, you can ignore this email.`,
          })
        } catch (error) {
          console.error("Password reset email delivery failed:", error)
          await database.collection("students").updateOne(
            { _id: student._id, passwordResetTokenHash: resetTokenHash },
            { $unset: { passwordResetTokenHash: "", passwordResetExpiresAt: "" } },
          )
          throw new ApiError(503, "Could not send a reset email right now. Please try again later.")
        }

        return send(response, 200, { message: "If that Student ID is registered, a password reset link has been sent to its email address." })
      }
      if (request.method === "POST" && url.pathname === "/api/auth/reset-password") {
        const body = await readJson(request)
        if (typeof body.resetToken !== "string" || !body.resetToken || typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 128) {
          throw new ApiError(400, "Use a valid reset link and choose a password between 8 and 128 characters.")
        }

        const resetTokenHash = createHash("sha256").update(body.resetToken).digest("hex")
        const students = database.collection("students")
        const student = await students.findOne({
          passwordResetTokenHash: resetTokenHash,
          passwordResetExpiresAt: { $gt: new Date() },
        })
        if (!student) throw new ApiError(400, "This password reset link is invalid or has expired. Request a new link.")

        const salt = randomBytes(16).toString("hex")
        const passwordHash = scryptSync(body.newPassword, salt, 64).toString("hex")
        const result = await students.updateOne(
          {
            _id: student._id,
            passwordResetTokenHash: resetTokenHash,
            passwordResetExpiresAt: { $gt: new Date() },
          },
          {
            $set: { salt, passwordHash },
            $unset: { passwordResetTokenHash: "", passwordResetExpiresAt: "" },
          },
        )
        if (result.modifiedCount !== 1) {
          throw new ApiError(400, "This password reset link is invalid or has expired. Request a new link.")
        }
        for (const [sessionToken, session] of sessions) {
          if (session.id === student.id) sessions.delete(sessionToken)
        }
        return send(response, 200, { message: "Your password has been reset. You can now sign in." })
      }

      const currentStudent = authenticatedStudent(request)
      if (!currentStudent) return send(response, 401, { error: "Please sign in to continue." })

      if (request.method === "GET" && url.pathname === "/api/orders") {
        const orders = await database.collection("orders")
          .find({ studentId: currentStudent.id }, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .toArray()
        return send(response, 200, orders)
      }
      if (request.method === "POST" && url.pathname === "/api/queries") {
        const body = await readJson(request)
        const subject = typeof body.subject === "string" ? body.subject.trim() : ""
        const message = typeof body.message === "string" ? body.message.trim() : ""
        if (subject.length < 3 || subject.length > 160 || message.length < 10 || message.length > 5000) {
          throw new ApiError(400, "Enter a subject (3–160 characters) and a message (10–5000 characters).")
        }
        const query = {
          queryId: `QRY-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`,
          studentId: currentStudent.id,
          name: currentStudent.name,
          email: currentStudent.email,
          subject,
          message,
          status: "Open",
          adminReply: "",
          createdAt: new Date(),
          repliedAt: null,
        }
        await database.collection("queries").insertOne(query)
        const { _id, ...publicQuery } = query
        return send(response, 201, publicQuery)
      }
      if (request.method === "GET" && url.pathname === "/api/queries") {
        const studentQueries = await database.collection("queries")
          .find({ studentId: currentStudent.id }, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()
        return send(response, 200, studentQueries)
      }
      if (request.method === "POST" && url.pathname === "/api/orders") {
        const body = await readJson(request)
        if (!Array.isArray(body.items) || body.items.length === 0) {
          return send(response, 400, { error: "Add at least one kit before placing an order." })
        }
        if (!paymentMethods.includes(body.paymentMethod)) {
          throw new ApiError(400, "Choose a valid payment method.")
        }

        const requestedQuantities = new Map()
        for (const item of body.items) {
          const id = Number(item.id)
          const quantity = Number(item.quantity)
          if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) {
            return send(response, 400, { error: "One or more order items are invalid." })
          }
          requestedQuantities.set(id, (requestedQuantities.get(id) || 0) + quantity)
        }

        const productsCollection = database.collection("products")
        const items = []
        for (const [id, quantity] of requestedQuantities) {
          const product = await productsCollection.findOne({ id, enabled: { $ne: false } }, { projection: { _id: 0 } })
          if (!product) return send(response, 400, { error: "One or more order items are invalid." })
          items.push({ id: product.id, name: product.name, quantity, price: product.price, image: product.image })
        }

        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        const shipping = subtotal >= 1999 ? 0 : 99
        const tax = Math.round(subtotal * 0.05)
        const order = {
          id: `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
          studentId: currentStudent.id,
          createdAt: new Date(),
          status: "Processing",
          paymentStatus: body.paymentMethod === "Cash on Delivery" ? "Pending" : "Demo",
          paymentMethod: body.paymentMethod,
          items,
          shippingAddress: body.shippingAddress || {},
          subtotal,
          shipping,
          tax,
          total: subtotal + shipping + tax,
        }
        const reservedItems = []
        try {
          for (const item of items) {
            const reservation = await productsCollection.updateOne(
              { id: item.id, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } },
            )
            if (reservation.modifiedCount !== 1) {
              const product = await productsCollection.findOne({ id: item.id }, { projection: { stock: 1 } })
              throw new ApiError(409, `${item.name} has only ${product?.stock || 0} kit(s) in stock.`)
            }
            reservedItems.push(item)
          }
          await database.collection("orders").insertOne(order)
          return send(response, 201, order)
        } catch (error) {
          await Promise.all(reservedItems.map((item) =>
            productsCollection.updateOne({ id: item.id }, { $inc: { stock: item.quantity } }),
          ))
          throw error
        }
      }

      return send(response, 404, { error: "Endpoint not found." })
    } catch (error) {
      const status = error instanceof ApiError ? error.status : error instanceof SyntaxError ? 400 : 500
      const message = error instanceof ApiError
        ? error.message
        : status === 400
          ? "Request body must be valid JSON."
          : "The server could not complete the request."
      if (status === 500) {
        const category = error?.name === "MongoServerError" || error?.name === "MongoNetworkError" || error?.name === "MongoServerSelectionError"
          ? "MongoDB request failed"
          : "API request failed"
        console.error(`[api] ${category} on ${request.method} ${url.pathname} (${error instanceof Error ? error.name : "UnknownError"}).`)
      }
      return send(response, status, { error: message })
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  connectDatabase()
    .then(() => {
      createApiServer().listen(port, "0.0.0.0", () => {
        console.log(`Robo Kit API listening on http://localhost:${port} with MongoDB database "${databaseName}"`)
      })
    })
    .catch(async (error) => {
      console.error("Could not connect to MongoDB:", error.message)
      await mongoClient.close()
      process.exitCode = 1
    })
}