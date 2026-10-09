# Robo Kit API

Run MongoDB locally, or create a MongoDB Atlas cluster. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string. The existing `MONGO_URI` variable is also supported; `MONGODB_URI` takes precedence if both are set. Keep `.env` private and never commit it.

Install dependencies with `npm install`, then run the API from this directory with `npm start` (Node.js 20 or newer). It listens on port `5000` by default; set `PORT` to change it. The API waits for MongoDB to connect before accepting requests.

The frontend's Vite development server listens on port `8443` by default. Its `.env.local` sets `VITE_API_URL=http://localhost:5000`, so API requests go directly to the backend. The backend allows CORS from `http://localhost:8443` by default; set `CORS_ORIGINS` to a comma-separated list to add other allowed origins. Start the API and frontend in separate terminals.

Google student sign-in requires a Google OAuth 2.0 **Web application** client. In Google Cloud Console, configure the OAuth consent screen and add each development/production website origin to **Authorized JavaScript origins**. The default development origin is `http://localhost:8443`; also authorize the exact host and port used by any alternate development server (for example, `http://127.0.0.1:8444`). Put the client ID in `GOOGLE_CLIENT_ID` in the backend `.env` and the same public client ID in `VITE_GOOGLE_CLIENT_ID` in the frontend `.env.local` (copy `.env.example`); restart both servers and rebuild the frontend after setting it. No client secret is needed for this GIS ID-token flow. Use HTTPS for deployed sites; localhost is allowed for development. The backend verifies the ID token signature, issuer, audience, and verified-email claim with Google's auth library before checking the registered student email. This proves Google-account ownership; merely entering an email does not.

Password-reset emails use SMTP. Set `FRONTEND_URL` to the public frontend URL and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` in the backend `.env` file; optionally set `SMTP_FROM` to the sender address (otherwise `SMTP_USER` is used). Use port `465` for implicit TLS or `587` for STARTTLS. Reset links expire after one hour. Outside production, if SMTP is not configured, the API provides a development reset link directly in the frontend; this fallback is disabled in production. Each student account must have a deliverable email address for email-based recovery.

Admin authentication uses `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the private backend `.env` file. The API does not start admin sessions unless both are configured. Admin bearer sessions expire after eight hours and are held in server memory; the browser keeps the opaque admin token in tab-scoped `sessionStorage`, never the admin password. Do not use the example placeholder values as real credentials.

MongoDB database `robo_kit` is selected by default; set `MONGODB_DATABASE` to use a different database name. The API creates `students`, `products`, and `orders` collections and indexes automatically. It seeds the starter catalog only when those records do not already exist. Student accounts must be provisioned in the `students` collection; no demo account is created automatically.

Available endpoints:

- `GET /api/health`
- `GET /api/products`
- `POST /api/auth/google` with `{ "credential": "<Google ID token>" }`; verifies the Google account and returns a ten-minute, server-held challenge only for a registered student email, or the generic not-registered error
- `POST /api/auth/login` with `{ "email": "student@example.com", "studentId": "your-student-id", "password": "your-password", "verificationToken": "..." }`; requires the matching unexpired email challenge
- `POST /api/auth/request-password-reset` with `{ "studentId": "your-student-id" }`
- `POST /api/auth/reset-password` with `{ "resetToken": "...", "newPassword": "..." }`
- `GET /api/orders` with the returned bearer token
- `POST /api/orders` with `{ "items": [{ "id": 1, "quantity": 1 }], "paymentMethod": "UPI", "shippingAddress": {} }` and the bearer token
- `POST /api/queries` with `{ "subject": "...", "message": "..." }` and the student bearer token
- `GET /api/queries` with the student bearer token; only that student's queries are returned
- `POST /api/admin/login` with `{ "username": "...", "password": "..." }`
- `POST /api/admin/logout` and all other `/api/admin/*` routes with the admin bearer token
- `GET /api/admin/dashboard`, `/api/admin/users`, `/api/admin/users/:id`, `/api/admin/orders`, `/api/admin/queries`, `/api/admin/queries/:id`, `/api/admin/products`, `/api/admin/settings`
- `PUT /api/admin/orders/:id/status`, `/api/admin/queries/:id/reply`, `/api/admin/queries/:id/status`, and `/api/admin/products/:id`
- `POST /api/admin/products`

Student passwords must be stored as salted hashes using Node.js `scrypt` (64 bytes, hex-encoded), with each account's salt stored alongside the hash. Authentication sessions and short-lived Google-verification challenges are held in memory, so users must sign in again after restarting the backend. Payments are demo-only; no real payment is processed.

Database indexes are created at startup: unique student ID, unique product ID, order lookup by student/date, unique query ID, and query lookup by student/date and status/date. Existing product documents without an `enabled` field stay visible; setting `enabled: false` hides a product from the storefront without deleting order-referenced data.