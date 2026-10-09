import { useEffect, useMemo, useRef, useState } from "react"
import logo from "./assets/brand-logo.png"
import { createInvoicePdf } from "./invoicePdf"
import { createOrder, getOrders, getProducts, login as authenticateStudent, requestPasswordReset, resetPassword, verifyGoogleStudent, type ApiOrder, type ApiProject } from "./api"
import { getStudentQueries, submitStudentQuery, type SupportQuery } from "./adminApi"
import AdminPanel from "./AdminPanel"

type Page = "landing" | "login" | "verify" | "invalid" | "reset-password" | "home" | "projects" | "interesting" | "details" | "cart" | "checkout" | "payment" | "processing" | "success" | "failed" | "pending" | "invoice" | "orders" | "order-detail" | "profile" | "admin" | "design-system" | "help"
type Project = ApiProject
type CartItem = { id: number; quantity: number }
type Theme = "light" | "dark"
type DeliveryUpdate = {
  step: string
  message: string
  createdAt: string
}

type GoogleCredentialResponse = { credential?: string }

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string
            auto_select?: boolean
            callback: (response: GoogleCredentialResponse) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: { type: "standard"; theme: "outline"; size: "large"; text: "continue_with"; shape: "rectangular"; width: number },
          ) => void
        }
      }
    }
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
const googleScriptUrl = "https://accounts.google.com/gsi/client"
let googleScriptPromise: Promise<void> | undefined

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${googleScriptUrl}"]`)
  const script = existingScript ?? document.createElement("script")
  if (!existingScript) {
    script.src = googleScriptUrl
    script.async = true
    script.defer = true
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener("load", handleLoad)
      script.removeEventListener("error", handleError)
    }
    const handleLoad = () => {
      cleanup()
      if (window.google?.accounts.id) {
        resolve()
      } else {
        googleScriptPromise = undefined
        reject(new Error("Google Identity Services loaded without its sign-in API."))
      }
    }
    const handleError = () => {
      cleanup()
      script.remove()
      googleScriptPromise = undefined
      reject(new Error("Google Identity Services could not be loaded."))
    }

    script.addEventListener("load", handleLoad, { once: true })
    script.addEventListener("error", handleError, { once: true })
    if (!existingScript) document.head.append(script)
  })

  return googleScriptPromise
}

const photo = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`
const initialProjects: Project[] = [
  {
    id: 1,
    name: "Smart Plant Monitor",
    description: "Build a sensor-powered system that cares for your plants.",
    price: 1499,
    grade: "Grade 8",
    difficulty: "Intermediate",
    category: "IoT",
    time: "4–6 hours",
    image: photo("photo-1631378297854-185cff6b0986"),
    accent: "mint",
    stock: 18,
    components: [
      "Arduino-compatible board",
      "Soil moisture sensor",
      "Breadboard",
      "Jumper wires",
      "Resistors",
      "USB cable",
    ],
  },
  {
    id: 2,
    name: "Robo Rover Kit",
    description: "Assemble and program your very own mini rover.",
    price: 2199,
    grade: "Grade 8",
    difficulty: "Intermediate",
    category: "Robotics",
    time: "6–8 hours",
    image: photo("photo-1518314916381-77a37c2a49ae"),
    accent: "lavender",
    stock: 12,
    components: [
      "Microcontroller board",
      "Rover chassis and wheels",
      "DC motors",
      "Motor driver",
      "Ultrasonic sensor",
      "Jumper wires",
      "Battery pack",
    ],
  },
  {
    id: 3,
    name: "Circuit Explorer",
    description: "Discover the magic of electricity, one circuit at a time.",
    price: 999,
    grade: "Grade 8",
    difficulty: "Beginner",
    category: "Electronics",
    time: "2–3 hours",
    image: photo("photo-1555664424-778a1e5e1b48"),
    accent: "peach",
    stock: 25,
    components: [
      "Breadboard",
      "LEDs",
      "Resistors",
      "Push buttons",
      "Jumper wires",
      "Battery holder",
    ],
  },
  {
    id: 4,
    name: "Weather Station",
    description: "Measure the world around you with real-time sensors.",
    price: 1799,
    grade: "Grade 8",
    difficulty: "Intermediate",
    category: "Science",
    time: "4–5 hours",
    image: photo("photo-1603732551658-5fabbafa84eb"),
    accent: "sky",
    stock: 9,
    components: [
      "Microcontroller board",
      "Temperature and humidity sensor",
      "Barometric pressure sensor",
      "Light sensor",
      "Breadboard",
      "Jumper wires",
    ],
  },
  {
    id: 5,
    name: "LED Art Studio",
    description: "Bring your ideas to life with light and simple circuits.",
    price: 799,
    grade: "All Grades",
    difficulty: "Beginner",
    category: "Electronics",
    time: "2–3 hours",
    image: photo("photo-1553408226-42ecf81a214c"),
    accent: "lavender",
    stock: 16,
    generic: true,
    components: [
      "LEDs",
      "Resistors",
      "Coin-cell battery",
      "Connecting wires",
      "Alligator clips",
      "Craft base",
    ],
  },
  {
    id: 6,
    name: "Code & Create Kit",
    description: "Make your first interactive invention from scratch.",
    price: 1299,
    grade: "All Grades",
    difficulty: "Beginner",
    category: "Programming",
    time: "3–4 hours",
    image: photo("photo-1577962144759-8dec6b55c952"),
    accent: "mint",
    stock: 14,
    generic: true,
    components: [
      "Microcontroller board",
      "USB cable",
      "Breadboard",
      "LEDs",
      "Resistors",
      "Push button",
      "Jumper wires",
    ],
  },
  {
    id: 7,
    name: "Solar Discovery Kit",
    description: "Explore clean energy with hands-on experiments.",
    price: 1199,
    grade: "All Grades",
    difficulty: "Beginner",
    category: "Science",
    time: "3–5 hours",
    image: photo("photo-1586920740142-346aea2a2124"),
    accent: "peach",
    stock: 0,
    generic: true,
    components: [
      "Mini solar panel",
      "DC motor",
      "Propeller",
      "LEDs",
      "Connecting wires",
      "Battery holder",
    ],
  },
  {
    id: 8,
    name: "Sensor Lab Pro",
    description: "Experiment with motion, light, and sound sensors.",
    price: 1899,
    grade: "Grade 9",
    difficulty: "Advanced",
    category: "IoT",
    time: "6–8 hours",
    image: photo("photo-1649959168260-2eb9702d7b69"),
    accent: "sky",
    stock: 7,
    components: [
      "Microcontroller board",
      "PIR motion sensor",
      "Light sensor",
      "Sound sensor",
      "Breadboard",
      "Resistors",
      "Jumper wires",
    ],
  },
]

function createDemoQrMatrix() {
  const size = 25
  const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false))

  const finderOrigins: [number, number][] = [[0, 0], [size - 7, 0], [0, size - 7]]
  for (const [originX, originY] of finderOrigins) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const cellX = originX + x
        const cellY = originY + y
        if (cellX < 0 || cellX >= size || cellY < 0 || cellY >= size) continue
        reserved[cellY][cellX] = true
        matrix[cellY][cellX] =
          x >= 0 &&
          x < 7 &&
          y >= 0 &&
          y < 7 &&
          (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))
      }
    }
  }

  for (let index = 8; index < size - 8; index++) {
    reserved[6][index] = true
    reserved[index][6] = true
    matrix[6][index] = index % 2 === 0
    matrix[index][6] = index % 2 === 0
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y][x]) matrix[y][x] = Math.random() > 0.5
    }
  }
  return matrix
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`
const kitNotice =
  "Please note: This kit contains the components/materials required to build the project. It does not include a pre-built or ready-made project."
const companyAddress = "ISBM College, Nande, Tal. Moshi, Pune"

function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
}: {
  name: string
  size?: number
  strokeWidth?: number
}) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    left: (
      <>
        <path d="M19 12H5" />
        <path d="m11 18-6-6 6-6" />
      </>
    ),
    cart: (
      <>
        <circle cx="9" cy="20" r="1" />
        <circle cx="19" cy="20" r="1" />
        <path d="M2 3h2l2.4 12h13l2.1-9H5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 5 5" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    close: (
      <>
        <path d="M5 5 19 19M19 5 5 19" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    heart: (
      <path d="M20.8 8.6c0 4.3-8.8 10.4-8.8 10.4S3.2 12.9 3.2 8.6a4.8 4.8 0 0 1 8.8-2.4 4.8 4.8 0 0 1 8.8 2.4Z" />
    ),
    spark: (
      <>
        <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
        <path d="m19 17 .8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    box: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10" />
      </>
    ),
    book: (
      <>
        <path d="M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1ZM12 6v14" />
      </>
    ),
    truck: (
      <>
        <path d="M2 6h12v12H2zM14 10h4l4 4v4h-8" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="12" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    trash: (
      <>
        <path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V3h12v6M6 18H4V9h16v9h-2M6 15h12v6H6z" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="16" cy="17" r="2" fill="currentColor" />
      </>
    ),
    chart: (
      <>
        <path d="M3 20h18M6 16V9M12 16V4M18 16v-6" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    moon: (
      <>
        <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5a9 9 0 1 0 12 12Z" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.spark}
    </svg>
  )
}

function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="21" height="21">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.75-.07-1.47-.19-2.16H12v4.09h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.02Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.73l-3.56-2.77c-.99.66-2.24 1.06-3.72 1.06-2.87 0-5.3-1.94-6.17-4.55H2.15v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.83 14.01A6.6 6.6 0 0 1 5.48 12c0-.7.12-1.38.35-2.01V7.15H2.15A11 11 0 0 0 1 12c0 1.78.43 3.46 1.15 4.85l3.68-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.44c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.94 10.94 0 0 0 12 1a11 11 0 0 0-9.85 6.15l3.68 2.84C6.7 7.38 9.13 5.44 12 5.44Z"
        />
      </svg>
    </span>
  )
}
function Button({
  children,
  onClick,
  variant = "primary",
  icon,
  disabled = false,
  className = "",
  type = "button",
  ariaExpanded,
  ariaPressed,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "outline" | "ghost" | "dark" | "danger"
  icon?: string
  disabled?: boolean
  className?: string
  type?: "button" | "submit"
  ariaExpanded?: boolean
  ariaPressed?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
    >
      {children}
      {icon && <Icon name={icon} size={18} />}
    </button>
  )
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: string
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="brand"
      onClick={onClick}
      aria-label="Black Orange Talent home"
    >
      <img src={logo} alt="Black Orange Talent" />
    </button>
  )
}

function ProjectCard({
  project,
  onView,
  onAdd,
  selected = false,
}: {
  project: Project
  onView: () => void
  onAdd: () => void
  selected?: boolean
}) {
  return (
    <article className={`project-card ${selected ? "is-selected" : ""}`}>
      <button
        className={`project-image accent-${project.accent}`}
        onClick={onView}
        aria-label={`View ${project.name}`}
      >
        <img
          src={project.image}
          alt={`${project.name} DIY electronic kit components`}
        />
        <span className="image-label">
          {project.generic ? "OPEN TO ALL GRADES" : "GRADE 8 PICK"}
        </span>
      </button>
      <div className="project-body">
        <div className="card-badges">
          <Badge tone={project.generic ? "violet" : "orange"}>
            {project.generic ? "All Grades" : project.grade}
          </Badge>
          <Badge tone="neutral">{project.difficulty}</Badge>
        </div>
        <button className="project-name" onClick={onView}>
          {project.name}
        </button>
        <p>{project.description}</p>
        <div className="project-meta">
          <span>
            <Icon name="box" size={15} /> DIY Component Kit
          </span>
          <span>
            <Icon name="clock" size={15} /> {project.time}
          </span>
        </div>
        <div className="project-bottom">
          <div>
            <small>Starting at</small>
            <strong>{money(project.price)}</strong>
          </div>
          <div className="card-actions">
            <button className="card-view" onClick={onView}>
              View Details <Icon name="arrow" size={16} />
            </button>
            <button
              className="square-add"
              disabled={!project.stock}
              onClick={onAdd}
              aria-label={`Add ${project.name} to cart`}
              title={project.stock ? "Add to cart" : "Out of stock"}
            >
              <Icon name={project.stock ? "plus" : "close"} size={19} />
            </button>
          </div>
        </div>
        {!project.stock && (
          <div className="stock-note">Currently out of stock</div>
        )}
      </div>
    </article>
  )
}
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
function Quantity({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="quantity">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Decrease quantity"
      >
        <Icon name="minus" size={16} />
      </button>
      <span>{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  readOnly = false,
  autoComplete,
}: {
  label: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  readOnly?: boolean
  autoComplete?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || label}
        required={required}
        readOnly={readOnly}
        autoComplete={autoComplete}
      />
    </label>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(() =>
    new URLSearchParams(window.location.search).has("resetToken") ? "reset-password" : "login",
  )
  const [authenticated, setAuthenticated] = useState(false)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedId, setSelectedId] = useState(1)
  const [quantity, setQuantity] = useState(1)
  const [tab, setTab] = useState("Overview")
  const [studentId, setStudentId] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "")
  const [resetRequestMessage, setResetRequestMessage] = useState("")
  const [resetRequestError, setResetRequestError] = useState("")
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("")
  const [resetRequestPending, setResetRequestPending] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resetPasswordError, setResetPasswordError] = useState("")
  const [resetPasswordComplete, setResetPasswordComplete] = useState(false)
  const [resetPasswordPending, setResetPasswordPending] = useState(false)
  const [helpTopic, setHelpTopic] = useState("Order & delivery")
  const [helpMessage, setHelpMessage] = useState("")
  const [helpOrderId, setHelpOrderId] = useState("")
  const [helpSubmitted, setHelpSubmitted] = useState(false)
  const [helpQueries, setHelpQueries] = useState<SupportQuery[]>([])
  const [helpError, setHelpError] = useState("")
  const [helpQueryError, setHelpQueryError] = useState("")
  const [helpPending, setHelpPending] = useState(false)
  const [openReplyQueryId, setOpenReplyQueryId] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All Categories")
  const [difficulty, setDifficulty] = useState("All Levels")
  const [gradeFilter, setGradeFilter] = useState("All Grades")
  const [sort, setSort] = useState("Recommended")
  const [paymentMethod, setPaymentMethod] = useState("UPI")
  const [demoQrMatrix] = useState(createDemoQrMatrix)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState("")
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileName, setProfileName] = useState("Student")
  const [profileEmail, setProfileEmail] = useState("")
  const [profileGrade, setProfileGrade] = useState("")
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem("bot-theme") === "dark" ? "dark" : "light"
    } catch {
      return "light"
    }
  })
  const [deliveryUpdates, setDeliveryUpdates] = useState<DeliveryUpdate[]>([])
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [stateName, setStateName] = useState("")
  const [pin, setPin] = useState("")
  const [adminTab, setAdminTab] = useState("Dashboard")
  const [adminStatus, setAdminStatus] = useState("Processing")
  const [adminProjectName, setAdminProjectName] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [emailVerificationToken, setEmailVerificationToken] = useState("")
  const [emailVerificationPending, setEmailVerificationPending] = useState(false)
  const [emailVerificationError, setEmailVerificationError] = useState("")
  const [googleButtonReady, setGoogleButtonReady] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const googleInitializedRef = useRef(false)
  const googleCredentialHandlerRef = useRef<(response: GoogleCredentialResponse) => void>(() => {})
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [signInPending, setSignInPending] = useState(false)

  const navigate = (next: Page, afterSignIn = false) => {
    if (!authenticated && !afterSignIn && !["landing", "login", "verify", "invalid"].includes(next)) {
      setPage("login")
      return
    }
    setPage(next)
    if (next === "projects" || next === "interesting") {
      setGradeFilter("All Grades")
      setCategory("All Categories")
      setDifficulty("All Levels")
    }
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const notify = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(""), 3500)
  }
  const signIn = async () => {
    setLoginError("")
    setSignInPending(true)
    try {
      const student = await authenticateStudent(studentEmail, studentId, password, emailVerificationToken)
      setStudentId(student.id)
      setProfileName(student.name)
      setProfileEmail(student.email)
      setProfileGrade(student.grade)
      setPassword("")
      setAuthenticated(true)
      const savedOrders = await getOrders().catch(() => [])
      setOrders(savedOrders)
      setSelectedOrder(savedOrders[0] || null)
      setOrderPlaced(savedOrders.length > 0)
      navigate("home", true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in."
      if (message.includes("email verification expired")) {
        setEmailVerificationToken("")
        setPassword("")
        setEmailVerificationError(message)
        setPage("login")
      } else {
        setLoginError(message)
      }
    } finally {
      setSignInPending(false)
    }

  }
  const continueWithGoogle = async (credential: string) => {
    setEmailVerificationError("")
    setEmailVerificationPending(true)
    try {
      const result = await verifyGoogleStudent(credential)
      setStudentEmail(result.email)
      setEmailVerificationToken(result.verificationToken)
      setStudentId("")
      setPassword("")
      setLoginError("")
      setResetRequestMessage("")
      setResetRequestError("")
      setDevelopmentResetUrl("")
      setPage("verify")
    } catch (error) {
      setEmailVerificationError(error instanceof Error ? error.message : "Google sign-in could not be verified. Please try again.")
    } finally {
      setEmailVerificationPending(false)
    }
  }
  const changeVerifiedEmail = () => {
    setEmailVerificationToken("")
    setStudentId("")
    setPassword("")
    setPasswordVisible(false)
    setLoginError("")
    setResetRequestMessage("")
    setResetRequestError("")
    setDevelopmentResetUrl("")
    setEmailVerificationError("")
    setPage("login")
  }
  googleCredentialHandlerRef.current = (response) => {
    console.log("Google credential returned:", Boolean(response.credential))
    if (response.credential) {
      void continueWithGoogle(response.credential)
    } else {
      setEmailVerificationError("Google did not return a sign-in credential. Please try again.")
    }
  }
  useEffect(() => {
    if (page !== "login") return
    setGoogleButtonReady(false)
    if (!googleClientId) {
      setEmailVerificationError("Google sign-in is not configured. Please contact your administrator.")
      return
    }

    let active = true
    const renderGoogleButton = () => {
      if (!active || !googleButtonRef.current || !window.google?.accounts.id) return
      try {
        const buttonContainer = googleButtonRef.current
        buttonContainer.replaceChildren()
        if (!googleInitializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            auto_select: false,
            callback: (response) => googleCredentialHandlerRef.current(response),
          })
          googleInitializedRef.current = true
        }
        window.google.accounts.id.renderButton(buttonContainer, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: Math.min(Math.floor(buttonContainer.clientWidth), 400),
        })
        setGoogleButtonReady(true)
      } catch (error) {
        console.error("Google sign-in could not be initialized.", error)
        setEmailVerificationError("Google sign-in could not be initialized. Please reload and try again.")
      }
    }

    void loadGoogleIdentityServices().then(renderGoogleButton).catch((error: unknown) => {
      if (!active) return
      console.error("Google sign-in could not load.", error)
      setEmailVerificationError("Google sign-in could not load. Check your connection and try again.")
    })

    return () => {
      active = false
      googleButtonRef.current?.replaceChildren()
    }
  }, [page])
  const sendPasswordReset = async () => {
    setResetRequestMessage("")
    setResetRequestError("")
    setDevelopmentResetUrl("")
    if (!studentId.trim()) {
      setResetRequestError("Enter your Student ID first.")
      return
    }

    setResetRequestPending(true)
    try {
      const result = await requestPasswordReset(studentId)
      setResetRequestMessage(result.message)
      if (result.resetToken) {
        const resetUrl = new URL(window.location.pathname, window.location.origin)
        resetUrl.searchParams.set("resetToken", result.resetToken)
        setDevelopmentResetUrl(resetUrl.toString())
      }
    } catch (error) {
      setResetRequestError(error instanceof Error ? error.message : "Unable to request a password reset.")
    } finally {
      setResetRequestPending(false)
    }
  }
  const submitPasswordReset = async () => {
    setResetPasswordError("")
    if (newPassword.length < 8) {
      setResetPasswordError("Choose a password with at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setResetPasswordError("The passwords do not match.")
      return
    }

    setResetPasswordPending(true)
    try {
      await resetPassword(resetToken, newPassword)
      setResetPasswordComplete(true)
      setNewPassword("")
      setConfirmPassword("")
      window.history.replaceState({}, "", window.location.pathname)
    } catch (error) {
      setResetPasswordError(error instanceof Error ? error.message : "Unable to reset your password.")
    } finally {
      setResetPasswordPending(false)
    }
  }
  const selected = projects.find((p) => p.id === selectedId) || projects[0]
  const relatedProjects = projects
    .filter((project) => project.id !== selected.id)
    .sort(
      (first, second) =>
        Number(second.category === selected.category) -
        Number(first.category === selected.category),
    )
    .slice(0, 4)
  const count = cart.reduce((total, item) => total + item.quantity, 0)
  const subtotal = cart.reduce(
    (total, item) =>
      total +
      (projects.find((p) => p.id === item.id)?.price || 0) * item.quantity,
    0,
  )
  const shipping = subtotal >= 1999 || !subtotal ? 0 : 99
  const tax = Math.round(subtotal * 0.05)
  const total = subtotal + shipping + tax
  const currentOrder = selectedOrder || orders[0]
  const invoiceItems = currentOrder?.items || cart.map((item) => {
    const project = projects.find((candidate) => candidate.id === item.id)!
    return { name: project.name, quantity: item.quantity, price: project.price, id: item.id, image: project.image }
  })
  const invoiceSubtotal = currentOrder?.subtotal ?? subtotal
  const invoiceShipping = currentOrder?.shipping ?? shipping
  const invoiceTax = currentOrder?.tax ?? tax
  const invoiceTotal = currentOrder?.total ?? total
  const addToCart = (id: number, amount = 1) => {
    setCart((current) => {
      const item = current.find((i) => i.id === id)
      return item
        ? current.map((i) =>
            i.id === id ? { ...i, quantity: i.quantity + amount } : i,
          )
        : [...current, { id, quantity: amount }]
    })
    notify("DIY component kit added to your cart")
  }
  const changeCart = (id: number, amount: number) =>
    setCart((current) =>
      current.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(1, amount) } : i,
      ),
    )
  const openProject = (id: number) => {
    if (!authenticated || !projects.some((p) => p.id === id)) return
    setSelectedId(id)
    setQuantity(1)
    setTab("Overview")
    navigate("details")
  }
  const filtered = useMemo(() => {
    let list = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()),
    )
    if (page === "projects") list = list.filter((p) => p.grade === profileGrade)
    if (category !== "All Categories")
      list = list.filter((p) => p.category === category)
    if (difficulty !== "All Levels")
      list = list.filter((p) => p.difficulty === difficulty)
    if (gradeFilter === "My Grade")
      list = list.filter((p) => p.grade === profileGrade)
    if (gradeFilter === "Other")
      list = list.filter((p) => p.grade !== profileGrade)
    if (sort === "Price: Low to High") list.sort((a, b) => a.price - b.price)
    if (sort === "Price: High to Low") list.sort((a, b) => b.price - a.price)
    if (sort === "Newest") list.reverse()
    return list
  }, [query, category, difficulty, gradeFilter, sort, page, profileGrade])
  useEffect(() => {
    document.title = "Black Orange Talent — Build what you imagine"
    try {
      const savedProfile = JSON.parse(localStorage.getItem("bot-profile") || "null")
      if (savedProfile) {
        setProfileName(savedProfile.name || "Aarav Sharma")
        setProfileEmail(savedProfile.email || "aarav.sharma@example.com")
        setProfileGrade(savedProfile.grade || "Grade 8")
        setPhone(savedProfile.phone || "")
        setAddress(savedProfile.address || "")
        setCity(savedProfile.city || "")
        setStateName(savedProfile.stateName || "")
        setPin(savedProfile.pin || "")
      }
    } catch {
      // Invalid or unavailable local storage falls back to the demo profile.
    }
  }, [])
  useEffect(() => {
    getProducts()
      .then((loadedProjects) => {
        setProjects(
          loadedProjects.map((project) => ({
            ...project,
            components:
              project.components ??
              initialProjects.find((initialProject) => initialProject.id === project.id)?.components ??
              [],
          })),
        )
      })
      .catch(() => notify("Could not load kits from the server. Showing saved catalog."))
  }, [])
  useEffect(() => {
    if (page !== "help" || !authenticated) return
    let active = true
    const refreshQueries = () => {
      const token = localStorage.getItem("bot-token")
      if (!token) {
        setHelpQueryError("Please sign in again to check your support queries.")
        return
      }
      getStudentQueries(token)
        .then((queries) => {
          if (active) {
            setHelpQueries(queries)
            setHelpQueryError("")
          }
        })
        .catch((error) => {
          if (active) setHelpQueryError(error instanceof Error ? error.message : "Could not load your support queries.")
        })
    }
    refreshQueries()
    const intervalId = window.setInterval(refreshQueries, 15000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [authenticated, page])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem("bot-theme", theme)
    } catch {
      // The selected theme still applies for this session.
    }
  }, [theme])
  useEffect(() => {
    if (!currentOrder) return
    const statusIndex =
      currentOrder.status === "Delivered" ? 4 : currentOrder.status === "Shipped" ? 3 : 2
    const steps = [
      ["Order Placed", `Your order #${currentOrder.id} has been received.`],
      ["Payment Confirmed", `Payment for order #${currentOrder.id} has been confirmed.`],
      ["Processing", "Your DIY kits are being prepared for dispatch."],
      ["Shipped", "Your package has left our facility and is on the way."],
      ["Delivered", "Your package has been delivered."],
    ]
    setDeliveryUpdates((current) => {
      const next = steps.slice(0, statusIndex + 1).map(([step, message]) => {
        const existing = current.find((update) => update.step === step)
        return existing || { step, message, createdAt: new Date().toISOString() }
      })
      try {
        localStorage.setItem("bot-delivery-updates", JSON.stringify(next))
      } catch {
        // In-app delivery updates still work when storage is unavailable.
      }
      return next
    })
  }, [currentOrder])
  const downloadInvoice = async () => {
    try {
      await createInvoicePdf({
        logo, companyAddress, studentId,
        phone: currentOrder?.shippingAddress.phone || phone,
        address: currentOrder?.shippingAddress.address || address,
        city: currentOrder?.shippingAddress.city || city,
        stateName: currentOrder?.shippingAddress.state || stateName,
        pin: currentOrder?.shippingAddress.pin || pin,
        customerName: profileName,
        customerEmail: profileEmail,
        items: invoiceItems,
        subtotal: invoiceSubtotal,
        shipping: invoiceShipping,
        tax: invoiceTax,
        total: invoiceTotal,
        kitNotice,
      })
      notify("PDF invoice downloaded")
    } catch {
      notify("Could not create the PDF. Please try printing the invoice.")
    }
  }
  const submitOrder = async () => {
    navigate("processing")
    try {
      const order = await createOrder({
        items: cart.map(({ id, quantity }) => ({ id, quantity })),
        paymentMethod,
        shippingAddress: { phone, address, city, state: stateName, pin },
      })
      setSelectedOrder(order)
      setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)])
      setOrderPlaced(true)
      setPage("success")
      setLoginError("")
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not place your order.")
      setPage("failed")
    }
  }
  const isCashOnDelivery = paymentMethod === "Cash on Delivery"

  const isAuth = ["landing", "login", "verify", "invalid"].includes(page)
  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")
  if (isAdminRoute) return <AdminPanel />
  const navItems: { label: string; target: Page }[] = [
    { label: "Home", target: "home" },
    { label: "Projects", target: "projects" },
    { label: "More Interesting", target: "interesting" },
    { label: "My Orders", target: "orders" },
    { label: "Help Desk", target: "help" },
  ]
  const header = (
    <header className="site-header">
      <div className="header-inner container">
        <Brand onClick={() => navigate(isAuth ? "landing" : "home")} />
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={page === item.target ? "active" : ""}
              onClick={() => navigate(item.target)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <button
            className="icon-button search-trigger"
            onClick={() => navigate("projects")}
            aria-label="Search projects"
          >
            <Icon name="search" size={21} />
          </button>
          <button
            className="icon-button cart-trigger"
            onClick={() => navigate("cart")}
            aria-label={`Cart with ${count} items`}
          >
            <Icon name="cart" size={21} />
            {count > 0 && <span className="cart-count">{count}</span>}
          </button>
          <button
            className="avatar"
            onClick={() => navigate("profile")}
            aria-label="View profile"
          >
            AS
          </button>
          <button
            className="icon-button mobile-toggle"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle menu"
          >
            <Icon name={mobileMenu ? "close" : "menu"} size={23} />
          </button>
        </div>
      </div>
      {mobileMenu && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <button key={item.label} onClick={() => navigate(item.target)}>
              {item.label}
              <Icon name="arrow" size={17} />
            </button>
          ))}
          <button onClick={() => navigate("profile")}>
            My Profile
            <Icon name="arrow" size={17} />
          </button>
        </nav>
      )}
    </header>
  )
  const authHeader = (
    <header className="auth-header container">
    </header>
  )
  const footer = (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Brand onClick={() => navigate("home")} />
          <p>
            Building tomorrow's thinkers, makers, and problem solvers. One
            component kit at a time.
          </p>
        </div>
        <div>
          <strong>Explore</strong>
          <button onClick={() => navigate("projects")}>All project kits</button>
          <button onClick={() => navigate("interesting")}>
            More interesting
          </button>
          <button onClick={() => navigate("orders")}>My orders</button>
        </div>
        <div>
          <strong>Support</strong>
          <button onClick={() => navigate("help")}>Help desk</button>
          <button onClick={() => navigate("design-system")}>
            Design system
          </button>
          <button onClick={() => window.location.assign("/admin/login")}>Admin login</button>
        </div>
        <div className="footer-news">
          <strong>Keep making things.</strong>
          <p>Real materials. Real learning. All yours to build.</p>
          <span>Build it yourself, brilliantly.</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Black Orange Talent. All rights reserved.</span>
        <span>Educational component kits • Not pre-built projects</span>
      </div>
    </footer>
  )
  const summary = (
    <aside className="summary-card">
      <h3>Order summary</h3>
      <div className="summary-lines">
        <div>
          <span>Subtotal ({count} items)</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <div>
          <span>Shipping</span>
          <strong>{shipping ? money(shipping) : "FREE"}</strong>
        </div>
        <div>
          <span>Estimated tax (5%)</span>
          <strong>{money(tax)}</strong>
        </div>
      </div>
      <div className="summary-total">
        <span>Total</span>
        <strong>{money(total)}</strong>
      </div>
      <div className="summary-perk">
        <Icon name="truck" size={19} />
        <span>
          {subtotal >= 1999
            ? "You've unlocked free shipping!"
            : `Add ${money(Math.max(0, 1999 - subtotal))} more for free shipping`}
        </span>
      </div>
    </aside>
  )
  const progress = (step: number) => (
    <div className="checkout-progress">
      {["Cart", "Details", "Payment", "Confirmation"].map((label, i) => (
        <div
          key={label}
          className={`progress-step ${i <= step ? "reached" : ""}`}
        >
          <span>
            {i < step ? <Icon name="check" size={15} /> : `0${i + 1}`}
          </span>
          {label}
        </div>
      ))}
    </div>
  )

  return (
    <div className="app-shell">
      {isAuth ? authHeader : page === "admin" ? null : header}
      <div className="page-transition" key={page}>
      {page === "landing" && (
        <>
          <main>
            <section className="landing-hero">
              <div className="container landing-grid">
                <div className="landing-copy">
                  <div className="pill-intro">
                    <span className="pulse-dot" /> LEARNING STARTS WITH MAKING{" "}
                    <Icon name="arrow" size={14} />
                  </div>
                  <h1>
                    Build. Learn.
                    <br />
                    <em>Create.</em>
                  </h1>
                  <p className="hero-lead">
                    Explore hands-on educational project kits designed for your
                    learning journey.
                  </p>
                  <p className="hero-support">
                    Not a ready-made project. A box of possibilities, ready for{" "}
                    <strong>you</strong> to build.
                  </p>
                  <div className="landing-actions">
                    <Button
                      onClick={() => navigate("login")}
                      className="google-cta"
                    >
                      <GoogleMark /> Login with Google{" "}
                      <Icon name="arrow" size={18} />
                    </Button>
                    <span>
                      <Icon name="lock" size={15} /> Secure, quick &
                      student-friendly
                    </span>
                  </div>
                  <p className="login-hint">
                    Login with your Google account to access projects available
                    for your grade.
                  </p>
                  <div className="hero-stats">
                    <div>
                      <strong>50+</strong>
                      <span>Hands-on kits</span>
                    </div>
                    <div>
                      <strong>1,200+</strong>
                      <span>Young makers</span>
                    </div>
                    <div>
                      <strong>100%</strong>
                      <span>Build it yourself</span>
                    </div>
                  </div>
                </div>
                <div className="hero-visual">
                  <div className="hero-orbit orbit-one" />
                  <div className="hero-orbit orbit-two" />
                  <div className="hero-photo">
                    <img
                      src={photo("photo-1745571479662-54a2ad1c747f", 1200)}
                      alt="Maker working with electronic circuit components"
                    />
                    <div className="photo-shade" />
                  </div>
                  <div className="floating-card float-top">
                    <span className="float-icon">
                      <Icon name="spark" size={20} />
                    </span>
                    <div>
                      <strong>Curiosity included</strong>
                      <small>Everything else? You'll build it.</small>
                    </div>
                  </div>
                  <div className="floating-card float-bottom">
                    <div className="mini-circles">
                      <span>
                        <Icon name="spark" size={17} />
                      </span>
                      <span>
                        <Icon name="box" size={18} />
                      </span>
                    </div>
                    <div>
                      <strong>Learn by doing</strong>
                      <small>Real components. Real discoveries.</small>
                    </div>
                  </div>
                  <span className="visual-cross cross-one">+</span>
                  <span className="visual-cross cross-two">+</span>
                </div>
              </div>
            </section>
            <section className="trust-strip">
              <div className="container trust-inner">
                <span>
                  <Icon name="shield" size={20} /> Safe, grade-appropriate
                  learning
                </span>
                <span>
                  <Icon name="box" size={20} /> Real components, never pre-built
                </span>
                <span>
                  <Icon name="book" size={20} /> Skills that stick with you
                </span>
              </div>
            </section>
            <section className="container landing-feature">
              <div className="feature-copy">
                <span className="eyebrow">A BETTER WAY TO LEARN</span>
                <h2>
                  Big ideas start
                  <br />
                  with small parts.
                </h2>
                <p>
                  Every kit gives you the components and confidence to turn
                  curiosity into something real. Explore circuits, coding,
                  robotics and more at your own pace.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate("login")}
                  icon="arrow"
                >
                  Start your journey
                </Button>
              </div>
              <div className="feature-tiles">
                <div>
                  <Icon name="box" size={27} />
                  <strong>Unbox the possibilities</strong>
                  <span>All the components you need, thoughtfully packed.</span>
                </div>
                <div>
                  <Icon name="spark" size={27} />
                  <strong>Make it yours</strong>
                  <span>Build, experiment, and find your own way.</span>
                </div>
                <div>
                  <Icon name="book" size={27} />
                  <strong>Learn for real</strong>
                  <span>Skills that go far beyond the classroom.</span>
                </div>
              </div>
            </section>
          </main>
          {footer}
        </>
      )}
      {(["login", "verify", "invalid", "reset-password"] as Page[]).includes(page) && (
        <main className="auth-main">
          <div className="auth-decor decor-one" />
          <div className="auth-decor decor-two" />
          <div className="auth-card">
            <div
              className={`auth-illustration ${
                page === "invalid" ? "error-illustration" : ""
              }`}
            >
              <div className={`illustration-core ${page === "login" || page === "verify" ? "auth-logo-core" : ""}`}>
                {page === "login" || page === "verify" ? (
                  <img className="auth-logo" src={logo} alt="Black Orange Talent" />
                ) : (
                  <Icon
                    name={
                      page === "invalid"
                        ? "warning"
                        : page === "reset-password"
                          ? "lock"
                          : "box"
                    }
                    size={49}
                  />
                )}
              </div>
              <span className="illus-orb orb-a" />
              <span className="illus-orb orb-b" />
              <span className="illus-line line-a" />
              <span className="illus-line line-b" />
            </div>
            <div className="auth-step">
              {page === "reset-password" ? "ACCOUNT RECOVERY" : page === "invalid" ? "LET'S TRY THAT AGAIN" : page === "login" ? "STUDENT EMAIL VERIFICATION" : "STUDENT ACCESS"}
            </div>
            <h1>
              {page === "reset-password"
                ? resetPasswordComplete ? "Password updated" : "Create a new password"
                : page === "login"
                  ? "Sign in"
                  : page === "verify"
                    ? "Student Login"
                    : "Sign In Not Verified"}
            </h1>
            <p>
              {page === "reset-password"
                ? resetPasswordComplete
                  ? "Your password has been changed. Sign in with your new password."
                  : "Choose a new password for your Robo Kit account."
                : page === "login"
                  ? "Use your Google account to continue"
                  : page === "verify"
                      ? studentEmail
                        ? <>Signing in as <a className="verified-email" href={`mailto:${studentEmail}`}>{studentEmail}</a></>
                        : "Sign in with your Student ID and password"
                    : "We couldn't verify your Student ID. Please check your ID and password, then try again."}
            </p>
            {page === "reset-password" ? (
              resetPasswordComplete ? (
                <Button className="full-width" onClick={() => navigate("login")}>
                  Back to Sign In <Icon name="arrow" size={17} />
                </Button>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); void submitPasswordReset() }}>
                  <Field
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="At least 8 characters"
                    required
                  />
                  <div className="auth-password">
                    <Field
                      label="Confirm new password"
                      type="password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Enter your new password again"
                      required
                    />
                  </div>
                  {resetPasswordError && <p className="login-error" role="alert"><Icon name="warning" size={16} /> {resetPasswordError}</p>}
                  <Button type="submit" className="full-width auth-reset-submit" disabled={resetPasswordPending}>
                    {resetPasswordPending ? "Updating password..." : "Update Password"} <Icon name="arrow" size={17} />
                  </Button>
                  <button type="button" className="auth-text-button" onClick={() => navigate("login")}>
                    Back to sign in
                  </button>
                </form>
              )
            ) : page === "login" ? (
              <div className="google-auth-step">
                <div className="google-signin-button" ref={googleButtonRef} />
                {!googleButtonReady && !emailVerificationError && (
                  <p className="google-loading" role="status">Loading Google sign-in…</p>
                )}
                {emailVerificationPending && <p className="google-loading" role="status">Verifying your Google account…</p>}
                {emailVerificationError && <p className="login-error" role="alert"><Icon name="warning" size={16} /> {emailVerificationError}</p>}
                <div className="auth-note">Only registered student emails can continue.</div>
              </div>
            ) : page === "verify" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void signIn()
                }}
              >
                <button
                  type="button"
                  className="auth-change-email"
                  onClick={emailVerificationToken ? changeVerifiedEmail : () => navigate("login")}
                >
                  {emailVerificationToken ? "Use a different email" : "Use Google sign-in"}
                </button>
                <Field
                  label="Student ID"
                  value={studentId}
                  onChange={(value) => {
                    setStudentId(value)
                    setLoginError("")
                    setResetRequestMessage("")
                    setResetRequestError("")
                    setDevelopmentResetUrl("")
                  }}
                  placeholder="Enter your Student ID"
                  autoComplete="username"
                  required
                />
                <div className="password-input-wrap">
                  <Field label="Password" type={passwordVisible ? "text" : "password"} value={password} onChange={(value) => { setPassword(value); setLoginError("") }} placeholder="Enter your password" autoComplete="current-password" required />
                  <button type="button" className="password-visibility-toggle" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible}>
                    {passwordVisible ? "Hide" : "Show"}
                  </button>
                </div>
                {loginError && <p className="login-error" role="alert"><Icon name="warning" size={16} /> {loginError}</p>}
                <div className="auth-forgot-row">
                  <button type="button" className="auth-text-button" onClick={() => void sendPasswordReset()} disabled={resetRequestPending}>
                    {resetRequestPending ? "Sending reset link..." : "Forgot password?"}
                  </button>
                </div>
                {resetRequestMessage && <p className="auth-reset-message" role="status">{resetRequestMessage}</p>}
                {developmentResetUrl && (
                  <a className="auth-reset-link" href={developmentResetUrl}>
                    Continue to reset password <Icon name="arrow" size={15} />
                  </a>
                )}
                {resetRequestError && <p className="login-error" role="alert"><Icon name="warning" size={16} /> {resetRequestError}</p>}
                <Button type="submit" className="full-width" disabled={signInPending}>
                  {signInPending ? "Signing in..." : "Login"} <Icon name="arrow" size={17} />
                </Button>
                <div className="auth-note">
                  <Icon name="shield" size={16} /> Sign in with the credentials provided for your account.
                </div>
              </form>
            ) : (
              <div className="auth-error-actions">
                <Button onClick={() => navigate("login")}>
                  Try Again <Icon name="arrow" size={17} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStudentId("")
                    setPassword("")
                    setLoginError("")
                    navigate("login")
                  }}
                >
                  Logout
                </Button>
              </div>
            )}
          </div>
          <div className="auth-bottom">
            Build it yourself. Discover what you're capable of.
            {page === "verify" && (
              <a className="student-admin-link" href="/admin/login">Admin login</a>
            )}
          </div>
        </main>
      )}
      {page === "home" && (
        <main>
          <section className="dashboard-hero">
            <div className="container dashboard-hero-grid">
              <div className="dashboard-hero-copy">
                <div className="eyebrow light-eyebrow">
                  <span className="pulse-dot" /> YOUR MAKER SPACE
                </div>
                <h1>
                  Welcome back,
                  <br />
                  <em>{profileName.split(" ")[0]}.</em>
                </h1>
                <p>
                  Discover projects designed for {profileGrade}. Your next big idea
                  starts with a little curiosity.
                </p>
                <div className="hero-buttons">
                  <Button onClick={() => navigate("projects")} icon="arrow">
                    Explore Projects
                  </Button>
                  <button
                    className="text-link light-link"
                    onClick={() => navigate("interesting")}
                  >
                    Explore all-grade kits <Icon name="arrow" size={17} />
                  </button>
                  <Button
                    variant="outline"
                    className="theme-toggle"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    ariaPressed={theme === "dark"}
                    ariaLabel={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
                  >
                    <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
                    {theme === "light" ? "Dark theme" : "Light theme"}
                  </Button>
                </div>
                <div className="hero-micro">
                  <span>
                    <Icon name="check" size={15} /> Curated for your grade
                  </span>
                  <span>
                    <Icon name="check" size={15} /> Built by you
                  </span>
                </div>
              </div>
              <div className="dashboard-art">
                <div className="dashboard-art-frame">
                  <img
                    src={photo("photo-1577962144759-8dec6b55c952", 1200)}
                    alt="Electronic components and circuit board for DIY learning"
                  />
                </div>
                <div className="art-sticker sticker-one">
                  <Icon name="spark" size={18} /> Let's make something.
                </div>
                <div className="art-sticker sticker-two">
                  <span>{profileGrade.match(/\d+/)?.[0]?.padStart(2, "0") ?? "--"}</span> YOUR GRADE
                </div>
              </div>
            </div>
          </section>
          <div className="container content-flow">
            <div className="maker-banner">
              <div className="maker-banner-icon">
                <Icon name="box" size={26} />
              </div>
              <div>
                <strong>You're the maker. We're the toolkit.</strong>
                <span>
                  Every project is a DIY component kit — not a finished or
                  pre-built product.
                </span>
              </div>
              <Icon name="spark" size={24} />
            </div>
            <section className="section-space">
              <SectionHeading
                eyebrow="MADE FOR YOUR LEVEL"
                title="Projects For Your Grade"
                subtitle="Hands-on project kits selected for your learning level."
                action={
                  <button
                    className="text-link"
                    onClick={() => navigate("projects")}
                  >
                    View all projects <Icon name="arrow" size={18} />
                  </button>
                }
              />
              <div className="project-grid">
                {projects.slice(0, 4).map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onView={() => openProject(p.id)}
                    onAdd={() => addToCart(p.id)}
                    selected={cart.some((i) => i.id === p.id)}
                  />
                ))}
              </div>
            </section>
            <section className="section-space discover-section">
              <div className="discover-text">
                <span className="eyebrow">BEYOND THE CLASSROOM</span>
                <h2>
                  Curiosity has
                  <br />
                  <em>no grade limit.</em>
                </h2>
                <p>
                  Branch out, try something unexpected, and make a discovery of
                  your own.
                </p>
                <Button
                  variant="dark"
                  onClick={() => navigate("interesting")}
                  icon="arrow"
                >
                  Explore more kits
                </Button>
              </div>
              <div className="discover-photo">
                <img
                  src={photo("photo-1555664424-778a1e5e1b48", 1000)}
                  alt="Close-up of electronics board components"
                />
                <span>OPEN TO ALL GRADES</span>
              </div>
            </section>
            <section className="section-space">
              <SectionHeading
                eyebrow="KEEP EXPLORING"
                title="More Interesting Projects"
                subtitle="Explore additional projects and discover something new to build."
                action={
                  <button
                    className="text-link"
                    onClick={() => navigate("interesting")}
                  >
                    Explore all <Icon name="arrow" size={18} />
                  </button>
                }
              />
              <div className="project-grid">
                {projects.slice(4, 8).map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onView={() => openProject(p.id)}
                    onAdd={() => addToCart(p.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        </main>
      )}
      {(page === "projects" || page === "interesting") && (
        <main className="container page-main">
          <div className="page-intro">
            <span className="eyebrow">THE MAKER COLLECTION</span>
            <h1>
              {page === "interesting"
                ? "More Interesting Projects"
                : "Explore Projects"}
              <span className="title-dot">.</span>
            </h1>
            <p>
              {page === "interesting"
                ? "Explore DIY component kits for every grade, including all-grade discoveries."
                : `These hands-on DIY component kits are selected for your ${profileGrade} learning level.`}
            </p>
          </div>
          <div className="catalog-layout">
            <aside className="filter-panel">
              <div className="filter-title">
                <strong>Filters</strong>
                <Icon name="sliders" size={20} />
              </div>
              {page === "interesting" ? <div className="filter-group">
                <h3>Grade</h3>
                {["All Grades", "My Grade", "Other"].map((g) => (
                  <label className="filter-radio" key={g}>
                    <input type="radio" checked={gradeFilter === g} onChange={() => setGradeFilter(g)} /> {g}
                  </label>
                ))}
              </div> : <div className="grade-only-note"><Icon name="shield" size={18} /> {profileGrade} projects only</div>}
              <div className="filter-group">
                <h3>Category</h3>
                {[
                  "All Categories",
                  "Robotics",
                  "Electronics",
                  "IoT",
                  "Science",
                  "Programming",
                ].map((c) => (
                  <label className="filter-radio" key={c}>
                    <input
                      type="radio"
                      checked={category === c}
                      onChange={() => setCategory(c)}
                    />{" "}
                    {c}
                  </label>
                ))}
              </div>
              <div className="filter-group">
                <h3>Difficulty</h3>
                {["All Levels", "Beginner", "Intermediate", "Advanced"].map(
                  (d) => (
                    <label className="filter-radio" key={d}>
                      <input
                        type="radio"
                        checked={difficulty === d}
                        onChange={() => setDifficulty(d)}
                      />{" "}
                      {d}
                    </label>
                  ),
                )}
              </div>
              <div className="filter-group">
                <h3>Price range</h3>
                <p className="price-note">Kits from ₹799 to ₹2,199</p>
                <div className="price-track">
                  <span />
                </div>
                <div className="price-labels">
                  <span>₹799</span>
                  <span>₹2,199</span>
                </div>
              </div>
              <button
                className="reset-filters"
                onClick={() => {
                  setQuery("")
                  setCategory("All Categories")
                  setDifficulty("All Levels")
                  setGradeFilter("All Grades")
                }}
              >
                Clear all filters
              </button>
            </aside>
            <div className="catalog-content">
              <div className="catalog-toolbar">
                <label className="search-field">
                  <Icon name="search" size={20} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects..."
                    aria-label="Search projects"
                  />
                </label>
                <label className="sort-field">
                  Sort by{" "}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option>Recommended</option>
                    <option>Price: Low to High</option>
                    <option>Price: High to Low</option>
                    <option>Newest</option>
                  </select>
                </label>
              </div>
              <div className="catalog-results">
                <span>
                  Showing <strong>{filtered.length}</strong> DIY project kits
                </span>
                <span>
                  Made to be made by you <Icon name="spark" size={16} />
                </span>
              </div>
              {filtered.length ? (
                <div className="project-grid catalog-grid">
                  {filtered.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onView={() => openProject(p.id)}
                      onAdd={() => addToCart(p.id)}
                      selected={cart.some((i) => i.id === p.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-results">
                  <Icon name="search" size={40} />
                  <h3>No kits found</h3>
                  <p>Try a different search or clear your filters.</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("")
                      setCategory("All Categories")
                      setDifficulty("All Levels")
                      setGradeFilter("All Grades")
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      )}
      {page === "details" && (
        <main className="container page-main">
          <div className="breadcrumbs">
            <button onClick={() => navigate("home")}>Home</button>
            <span>/</span>
            <button onClick={() => navigate("projects")}>Projects</button>
            <span>/</span>
            <strong>{selected.name}</strong>
          </div>
          <div className="detail-layout">
            <div className="detail-gallery">
              <div className={`detail-main-image accent-${selected.accent}`}>
                <img
                  src={selected.image}
                  alt={`${selected.name} electronics components`}
                />
                <span className="image-label">DIY PROJECT KIT</span>
              </div>
              <div className="detail-thumbs">
                <button className="selected-thumb">
                  <img src={selected.image} alt="Kit image view" />
                </button>
                {selected.components?.length ? (
                  <button
                    onClick={() =>
                      document
                        .getElementById("detail-components")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                  >
                    <Icon name="box" size={26} />
                    <span>Inside the kit</span>
                  </button>
                ) : null}
                <button onClick={() => setTab("Learning Outcomes")}>
                  <Icon name="spark" size={26} />
                  <span>What you'll learn</span>
                </button>
              </div>
            </div>
            <div className="detail-info">
              <div className="eyebrow">
                BUILD IT YOURSELF / {selected.category.toUpperCase()}
              </div>
              <h1>{selected.name}</h1>
              {selected.components?.length ? (
                <div className="detail-components" id="detail-components">
                  <strong>Components used in this project</strong>
                  <ul>
                    {selected.components.map((component) => (
                      <li key={component}>{component}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="rating">
                <span className="stars">★★★★★</span>
                <strong>4.8</strong>
                <span>(24 maker reviews)</span>
              </div>
              <div className="detail-badges">
                <Badge tone={selected.generic ? "violet" : "orange"}>
                  {selected.generic ? "Open to All Grades" : selected.grade}
                </Badge>
                <Badge tone="neutral">{selected.difficulty}</Badge>
                <Badge tone="mint">DIY Component Kit</Badge>
              </div>
              <p className="detail-description">
                {selected.description} Get everything you need to explore,
                experiment, and create with your own hands.
              </p>
              <div className="detail-price">
                <strong>{money(selected.price)}</strong>
                <span>Inclusive of all taxes</span>
              </div>
              <div className="important-notice">
                <Icon name="warning" size={21} />
                <p>
                  <strong>Make it, don't just buy it.</strong> This product
                  contains the components/materials required to build the
                  project. It is NOT a ready-made or pre-built project.
                </p>
              </div>
              <div className="detail-buy">
                <span>Quantity</span>
                <Quantity value={quantity} onChange={setQuantity} />
                <span className={selected.stock ? "in-stock" : "out-stock"}>
                  {selected.stock
                    ? `${selected.stock} kits in stock`
                    : "Out of stock"}
                </span>
              </div>
              <div className="detail-actions">
                <Button
                  disabled={!selected.stock}
                  onClick={() => addToCart(selected.id, quantity)}
                >
                  <Icon name="cart" size={19} /> Add to Cart
                </Button>
                <Button
                  variant="outline"
                  disabled={!selected.stock}
                  onClick={() => {
                    addToCart(selected.id, quantity)
                    navigate("cart")
                  }}
                >
                  Buy Now <Icon name="arrow" size={18} />
                </Button>
              </div>
              <div className="detail-assurances">
                <span>
                  <Icon name="truck" size={19} /> Delivered to your door
                </span>
                <span>
                  <Icon name="shield" size={19} /> Secure checkout
                </span>
                <span>
                  <Icon name="book" size={19} /> Learn by building
                </span>
              </div>
            </div>
          </div>
          {relatedProjects.length > 0 && (
            <section className="section-space related-products">
              <SectionHeading
                eyebrow="KEEP EXPLORING"
                title="Related projects"
                subtitle="Explore more hands-on project kits for your next build."
              />
              <div className="project-grid">
                {relatedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onView={() => openProject(project.id)}
                    onAdd={() => addToCart(project.id)}
                    selected={cart.some((item) => item.id === project.id)}
                  />
                ))}
              </div>
            </section>
          )}
          <div className="detail-lower">
            <div className="tabs" role="tablist">
              {[
                "Overview",
                "Learning Outcomes",
                "Specifications",
              ].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? "current" : ""}
                  onClick={() => {
                    setTab(t)
                    document
                      .getElementById("detail-tabs")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div id="detail-tabs" className="tab-panel">
              {tab === "Overview" && (
                <div className="overview-content">
                  <div>
                    <span className="eyebrow">FROM COMPONENTS TO CREATION</span>
                    <h2>Everything you need to make it yours.</h2>
                    <p>
                      Open the box, explore each component, and follow your
                      curiosity. This hands-on kit is designed to help you
                      understand how things work while building a project you
                      can truly call your own.
                    </p>
                    <p>{kitNotice}</p>
                  </div>
                  <div className="overview-highlight">
                    <Icon name="spark" size={34} />
                    <strong>
                      Imagine it.
                      <br />
                      Build it.
                      <br />
                      Understand it.
                    </strong>
                  </div>
                </div>
              )}
              {tab === "Learning Outcomes" && (
                <>
                  <h2>What you'll learn</h2>
                  <p className="tab-subtitle">
                    Every connection is a chance to learn something new.
                  </p>
                  <div className="outcome-grid">
                    {[
                      "Learn basic electronics",
                      "Understand sensors",
                      "Practice circuit building",
                      "Develop problem-solving skills",
                    ].map((outcome, i) => (
                      <div key={outcome}>
                        <span>0{i + 1}</span>
                        <Icon name="check" size={20} />
                        <strong>{outcome}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "Specifications" && (
                <>
                  <h2>Kit specifications</h2>
                  <div className="spec-list">
                    {[
                      ["Grade", selected.grade],
                      ["Difficulty", selected.difficulty],
                      ["Estimated Build Time", selected.time],
                      ["Project Category", selected.category],
                      ["Kit type", "DIY educational component kit"],
                    ].map(([key, value]) => (
                      <div key={key}>
                        <span>{key}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}
      {page === "cart" && (
        <main className="container page-main">
          <div className="page-intro compact">
            <span className="eyebrow">YOUR MAKER BAG</span>
            <h1>
              Your Cart<span className="title-dot">.</span>
            </h1>
            <p>You're one step closer to making something incredible.</p>
          </div>
          {cart.length ? (
            <>
              <div className="checkout-grid">
                <div>
                  <div className="cart-items">
                    {cart.map((item) => {
                      const p = projects.find(
                        (project) => project.id === item.id,
                      )!
                      return (
                        <div className="cart-item" key={item.id}>
                          <img src={p.image} alt={`${p.name} kit components`} />
                          <div className="cart-item-info">
                            <Badge tone="orange">DIY Project Kit</Badge>
                            <button onClick={() => openProject(p.id)}>
                              {p.name}
                            </button>
                            <span>
                              {p.grade} · {p.difficulty}
                            </span>
                            <button
                              className="remove-link"
                              onClick={() =>
                                setCart((current) =>
                                  current.filter((i) => i.id !== item.id),
                                )
                              }
                            >
                              <Icon name="trash" size={15} /> Remove
                            </button>
                          </div>
                          <div className="cart-item-end">
                            <strong>{money(p.price * item.quantity)}</strong>
                            <Quantity
                              value={item.quantity}
                              onChange={(value) => changeCart(item.id, value)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    className="continue-link"
                    onClick={() => navigate("projects")}
                  >
                    <Icon name="left" size={18} /> Continue Shopping
                  </button>
                  <div className="kit-reminder">
                    <Icon name="box" size={19} /> {kitNotice}
                  </div>
                </div>
                <div>
                  {summary}
                  <Button
                    className="full-width checkout-button"
                    onClick={() => navigate("checkout")}
                  >
                    Proceed to Checkout <Icon name="arrow" size={18} />
                  </Button>
                  <p className="secure-line">
                    <Icon name="lock" size={15} /> Safe & secure checkout
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-cart">
              <div className="empty-art">
                <Icon name="cart" size={61} />
                <span>+</span>
                <span>✦</span>
              </div>
              <h2>Your Cart is Empty</h2>
              <p>
                Start exploring projects and add your favorite project kits to
                your cart.
              </p>
              <Button onClick={() => navigate("projects")} icon="arrow">
                Explore Projects
              </Button>
            </div>
          )}
        </main>
      )}
      {page === "checkout" && (
        <main className="container page-main checkout-page">
          <div className="page-intro compact">
            <span className="eyebrow">ALMOST TIME TO BUILD</span>
            <h1>
              Checkout<span className="title-dot">.</span>
            </h1>
          </div>
          {progress(1)}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              navigate("payment")
            }}
            className="checkout-grid"
          >
            <div className="checkout-forms">
              <section className="form-card">
                <div className="form-card-title">
                  <span>01</span>
                  <div>
                    <h2>Customer Details</h2>
                    <p>Let's make sure we have the right maker.</p>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Student Name" value={profileName} readOnly />
                  <Field
                    label="Email"
                    value={profileEmail}
                    readOnly
                  />
                  <Field
                    label="Student ID"
                    value={studentId}
                    readOnly
                  />
                  <Field
                    label="Phone Number"
                    value={phone}
                    onChange={setPhone}
                    placeholder="Your phone number"
                    type="tel"
                    required
                  />
                </div>
              </section>
              <section className="form-card">
                <div className="form-card-title">
                  <span>02</span>
                  <div>
                    <h2>Shipping Address</h2>
                    <p>Where should we send your kit?</p>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="span-two">
                    <Field
                      label="Address"
                      value={address}
                      onChange={setAddress}
                      placeholder="House number, street, area"
                      required
                    />
                  </div>
                  <Field
                    label="City"
                    value={city}
                    onChange={setCity}
                    required
                  />
                  <Field
                    label="State"
                    value={stateName}
                    onChange={setStateName}
                    required
                  />
                  <Field
                    label="PIN Code"
                    value={pin}
                    onChange={setPin}
                    placeholder="6-digit PIN code"
                    required
                  />
                </div>
              </section>
            </div>
            <div>
              <div className="summary-card checkout-summary">
                <h3>Your kits</h3>
                {cart.map((item) => {
                  const p = projects.find((project) => project.id === item.id)!
                  return (
                    <div className="checkout-product" key={item.id}>
                      <img src={p.image} alt="" />
                      <div>
                        <strong>{p.name}</strong>
                        <small>DIY Component Kit · Qty {item.quantity}</small>
                      </div>
                      <span>{money(p.price * item.quantity)}</span>
                    </div>
                  )
                })}
                <div className="summary-lines">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </div>
                  <div>
                    <span>Shipping</span>
                    <strong>{shipping ? money(shipping) : "FREE"}</strong>
                  </div>
                  <div>
                    <span>Tax</span>
                    <strong>{money(tax)}</strong>
                  </div>
                </div>
                <div className="summary-total">
                  <span>Total</span>
                  <strong>{money(total)}</strong>
                </div>
              </div>
              <Button type="submit" className="full-width checkout-button">
                Continue to Payment <Icon name="arrow" size={18} />
              </Button>
              <p className="secure-line">
                <Icon name="shield" size={15} /> Your details are securely
                protected
              </p>
            </div>
          </form>
        </main>
      )}
      {page === "payment" && (
        <main className="container page-main checkout-page">
          <div className="page-intro compact">
            <span className="eyebrow">SAFE & SIMPLE</span>
            <h1>
              Secure Payment<span className="title-dot">.</span>
            </h1>
          </div>
          {progress(2)}
          <div className="checkout-grid">
            <div className="form-card payment-card">
              <div className="payment-head">
                <div className="payment-lock">
                  <Icon name="lock" size={25} />
                </div>
                <div>
                  <h2>Choose how to pay</h2>
                  <p>Select a demo payment method or pay when your order arrives.</p>
                </div>
              </div>
              <div className="payment-methods">
                {[
                  ["UPI", "Pay with any UPI app"],
                  ["Card", "Credit or debit card"],
                  ["Net Banking", "Pay through your bank"],
                  ["QR Code", "Scan a demo QR code"],
                  ["Cash on Delivery", "Pay when your order arrives"],
                ].map(([method, desc]) => (
                  <button
                    key={method}
                    type="button"
                    className={paymentMethod === method ? "chosen" : ""}
                    onClick={() => setPaymentMethod(method)}
                  >
                    <span className="method-radio" />
                    <span>
                      <strong>{method}</strong>
                      <small>{desc}</small>
                    </span>
                    <Icon
                      name={
                        method === "Cash on Delivery"
                          ? "truck"
                          : method === "Card"
                            ? "shield"
                            : method === "UPI" || method === "QR Code"
                              ? "spark"
                              : "lock"
                      }
                      size={22}
                    />
                  </button>
                ))}
              </div>
              {paymentMethod === "QR Code" && (
                <div className="demo-qr-panel">
                  <svg className="demo-qr" viewBox="0 0 25 25" role="img" aria-label="Random demo QR pattern, not scannable">
                    <rect width="25" height="25" fill="white" />
                    {demoQrMatrix.flatMap((row, y) =>
                      row.map((isDark, x) =>
                        isDark ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#151c2b" /> : null,
                      ),
                    )}
                  </svg>
                  <div>
                    <strong>Demo QR code</strong>
                    <p>This random QR-style pattern is for checkout preview only. It cannot be scanned and no real payment will be taken.</p>
                  </div>
                </div>
              )}
              <div className="payment-demo-note">
                <Icon name="shield" size={17} />
                <span>{isCashOnDelivery ? "Pay the delivery partner when your order arrives." : "Prototype payment: no real charge will be made."}</span>
              </div>
              <Button
                className="full-width"
                onClick={() => void submitOrder()}
              >
                {isCashOnDelivery ? "Place order" : paymentMethod === "QR Code" ? "Process demo payment" : `Pay ${money(total)}`} <Icon name="arrow" size={18} />
              </Button>
              <div className="payment-test-links">
                <button onClick={() => navigate("failed")}>
                  Preview failed payment
                </button>
                <button onClick={() => navigate("pending")}>
                  Preview pending payment
                </button>
              </div>
            </div>
            <div>
              <div className="summary-card">
                <div className="payment-order-id">
                  <span>ORDER ID</span>
                  <strong>{currentOrder ? `#${currentOrder.id}` : isCashOnDelivery ? "Created when order is placed" : "Created after payment"}</strong>
                </div>
                <h3>{isCashOnDelivery ? "Amount due on delivery" : "Amount payable"}</h3>
                <strong className="payable-amount">{money(total)}</strong>
                <div className="summary-lines">
                  <div>
                    <span>
                      {count} DIY component kit{count !== 1 ? "s" : ""}
                    </span>
                    <strong>{money(subtotal)}</strong>
                  </div>
                  <div>
                    <span>Shipping + tax</span>
                    <strong>{money(shipping + tax)}</strong>
                  </div>
                </div>
                <div className="summary-perk">
                  <Icon name={isCashOnDelivery ? "truck" : "lock"} size={18} /> {isCashOnDelivery ? "Cash collected when your order arrives" : "Demo checkout; no real payment is taken"}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
      {(["processing", "success", "failed", "pending"] as Page[]).includes(
        page,
      ) && (
        <main className="status-page container">
          {progress(page === "success" ? 3 : 2)}
          <div className={`status-card status-${page}`}>
            <div className="status-art">
              {page === "processing" || page === "pending" ? (
                <div className="spinner" />
              ) : (
                <Icon
                  name={page === "success" ? "check" : "warning"}
                  size={46}
                  strokeWidth={2.4}
                />
              )}
            </div>
            <span className="eyebrow">
              {page === "success"
                ? "LET THE MAKING BEGIN"
                : page === "failed"
                  ? "LET'S GET THIS SORTED"
                  : "ONE MOMENT PLEASE"}
            </span>
            <h1>
              {page === "success"
                ? "Order Placed!"
                : page === "failed"
                  ? "Payment Failed"
                  : page === "processing"
                    ? isCashOnDelivery
                      ? "Placing Your Order..."
                      : "Processing Payment..."
                    : "Payment Processing"}
            </h1>
            <p>
              {page === "success"
                ? isCashOnDelivery
                  ? "Your order has been placed. Pay the delivery partner when your order arrives."
                  : "Your demo order has been placed. No real payment was charged."
                : page === "failed"
                  ? "We couldn't complete your payment. Your order has not been confirmed."
                  : page === "processing"
                    ? isCashOnDelivery
                      ? "Please wait while we place your order."
                      : "Please wait while we confirm your payment. Do not close this window."
                    : "We're waiting for confirmation from the payment gateway."}
            </p>
            {page === "success" && (
              <div className="status-details">
                {[
                  ["Order ID", currentOrder ? `#${currentOrder.id}` : ""],
                  ["Payment", currentOrder?.paymentMethod || paymentMethod],
                  [isCashOnDelivery ? "Amount Due" : "Amount Paid", money(currentOrder?.total ?? total)],
                  [
                    "Date",
                    new Date().toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}
            {page === "failed" && (
              <div className="status-details">
                <div>
                  <span>Order ID</span>
                  <strong>{currentOrder ? `#${currentOrder.id}` : "Not created"}</strong>
                </div>
              </div>
            )}
            {page === "success" ? (
              <div className="status-actions">
                <Button onClick={() => navigate("order-detail")}>
                  View Order <Icon name="arrow" size={17} />
                </Button>
                <Button variant="outline" onClick={() => navigate("invoice")}>
                  View Invoice
                </Button>
                <button
                  className="text-link"
                  onClick={() => navigate("invoice")}
                >
                  Download Invoice <Icon name="download" size={17} />
                </button>
                <button
                  className="text-link"
                  onClick={() => navigate("projects")}
                >
                  Continue Shopping <Icon name="arrow" size={17} />
                </button>
              </div>
            ) : page === "failed" ? (
              <div className="status-actions">
                <Button onClick={() => navigate("payment")}>
                  Try Again <Icon name="arrow" size={17} />
                </Button>
                <Button variant="outline" onClick={() => navigate("cart")}>
                  Return to Cart
                </Button>
                <button className="text-link" onClick={() => navigate("home")}>
                  Go to Dashboard
                </button>
              </div>
            ) : page === "pending" ? (
              <div className="status-actions">
                <Button
                  onClick={() => void submitOrder()}
                >
                  Check Payment Status <Icon name="arrow" size={17} />
                </Button>
                <button
                  className="text-link"
                  onClick={() => navigate("orders")}
                >
                  Go to Orders
                </button>
              </div>
            ) : null}
          </div>
        </main>
      )}
      {page === "invoice" && (
        <main className="container page-main invoice-page">
          <div className="page-intro compact invoice-intro">
            <div>
              <span className="eyebrow">YOUR DOCUMENTS</span>
              <h1>
                Invoice Preview<span className="title-dot">.</span>
              </h1>
            </div>
            <div className="invoice-actions">
              <Button variant="outline" onClick={() => window.print()}>
                <Icon name="print" size={17} /> Print Invoice
              </Button>
              <Button onClick={downloadInvoice}>
                <Icon name="download" size={17} /> Download Invoice
              </Button>
            </div>
          </div>
          <div className="invoice-sheet">
            <div className="invoice-top">
              <Brand onClick={() => navigate("home")} />
              <div>
                <strong>INVOICE</strong>
                <span>#INV-102938</span>
              </div>
            </div>
            <div className="invoice-address">
              <p>
                Black Orange Talent
                <br />
                {companyAddress}
              </p>
              <div>
                <Badge tone="mint">DEMO ORDER</Badge>
              </div>
            </div>
            <div className="invoice-columns">
              <div>
                <span className="invoice-label">BILLED & SHIPPED TO</span>
                <strong>{profileName}</strong>
                <p>
                  {studentId && <>Student ID: {studentId}<br /></>}
                  {profileEmail}
                  <br />
                  {phone || "+91 98765 43210"}
                  <br />
                  {address || "12 Maker Street"}, {city || "Bengaluru"}
                  <br />
                  {stateName || "Karnataka"} {pin || "560001"}
                </p>
              </div>
              <div>
                <div>
                  <span>Invoice Date</span>
                  <strong>
                    {new Date().toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </div>
                <div>
                  <span>Order ID</span>
                  <strong>{currentOrder ? `#${currentOrder.id}` : "Not created"}</strong>
                </div>
                <div>
                  <span>Payment Method</span>
                  <strong>{currentOrder?.paymentMethod || paymentMethod}</strong>
                </div>
              </div>
            </div>
            <div className="invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>PROJECT KIT</th>
                    <th>QTY</th>
                    <th>UNIT PRICE</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                      {invoiceItems.map((item) => (
                          <tr key={item.id}>
                        <td>
                              <strong>{item.name}</strong>
                          <small>DIY Educational Component Kit</small>
                        </td>
                        <td>{item.quantity}</td>
                            <td>{money(item.price)}</td>
                            <td>{money(item.price * item.quantity)}</td>
                      </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div className="invoice-totals">
              <div>
                <span>Subtotal</span>
                <strong>{money(invoiceSubtotal)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>{money(invoiceShipping)}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{money(invoiceTax)}</strong>
              </div>
              <div className="grand-total">
                <span>Grand Total</span>
                <strong>{money(invoiceTotal)}</strong>
              </div>
            </div>
            <div className="invoice-note">
              <Icon name="box" size={20} />
              <span>
                This invoice is for an educational project component kit. The
                kit contains components/materials and does not include a
                pre-built project.
              </span>
            </div>
            <div className="invoice-thanks">
              Thank you for choosing to build with us.
            </div>
          </div>
        </main>
      )}
      {page === "orders" && (
        <main className="container page-main">
          <div className="page-intro compact">
            <span className="eyebrow">YOUR MAKER JOURNEY</span>
            <h1>
              My Orders<span className="title-dot">.</span>
            </h1>
            <p>
              Track the component kits you've ordered and what you'll build
              next.
            </p>
          </div>
          <div className="orders-toolbar">
            <label className="search-field">
              <Icon name="search" size={19} />
              <input
                placeholder="Search orders..."
                aria-label="Search orders"
              />
            </label>
            <select aria-label="Filter orders">
              <option>All orders</option>
              <option>Processing</option>
              <option>Delivered</option>
            </select>
          </div>
          {orders.length > 0 ? (
            <div className="order-list">
              {orders.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="order-card-top">
                  <div>
                    <small>
                      ORDER PLACED ·{" "}
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </small>
                    <h3>#{order.id}</h3>
                  </div>
                  <div>
                    <Badge tone="mint">{order.paymentStatus}</Badge>
                    <Badge tone="orange">{order.status}</Badge>
                  </div>
                </div>
                <div className="order-card-body">
                  <div className="order-thumbnails">
                    {order.items.map((item) => (
                      <img
                        key={item.id}
                        src={item.image}
                        alt="Ordered kit"
                      />
                    ))}
                  </div>
                  <div>
                    <strong>{order.items.map((item) => item.name).join(", ")}</strong>
                    <span>
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)} DIY component kit{order.items.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? "s" : ""} · {money(order.total)}
                    </span>
                  </div>
                  <div className="order-card-actions">
                    <Button
                      variant="outline"
                      onClick={() => { setSelectedOrder(order); navigate("order-detail") }}
                    >
                      View Order
                    </Button>
                    <button
                      className="text-link"
                      onClick={() => navigate("invoice")}
                    >
                      Download Invoice <Icon name="download" size={16} />
                    </button>
                  </div>
                </div>
              </div>
              ))}
            </div>
          ) : (
            <div className="empty-cart orders-empty">
              <div className="empty-art">
                <Icon name="box" size={55} />
              </div>
              <h2>No orders yet</h2>
              <p>Your first DIY kit is waiting to be discovered.</p>
              <Button onClick={() => navigate("projects")} icon="arrow">
                Explore Projects
              </Button>
            </div>
          )}
        </main>
      )}
      {page === "order-detail" && (
        <main className="container page-main">
          <div className="breadcrumbs">
            <button onClick={() => navigate("orders")}>My Orders</button>
            <span>/</span>
            <strong>#{selectedOrder?.id || orders[0]?.id || ""}</strong>
          </div>
          <div className="page-intro compact">
            <span className="eyebrow">ORDER DETAILS</span>
            <h1>
              Order #{selectedOrder?.id || orders[0]?.id || ""}<span className="title-dot">.</span>
            </h1>
            <p>
              Placed on{" "}
              {new Date(selectedOrder?.createdAt || orders[0]?.createdAt || Date.now()).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · {selectedOrder?.paymentMethod || orders[0]?.paymentMethod || "UPI"}
            </p>
          </div>
          <div className="checkout-grid">
            <div className="order-detail-stack">
              <section className="form-card">
                <div className="section-heading small-heading">
                  <h2>Your project kits</h2>
                  <Badge tone="orange">{selectedOrder?.status || orders[0]?.status || adminStatus}</Badge>
                </div>
                {(selectedOrder || orders[0])?.items.map((item) => {
                  return (
                    <div className="checkout-product larger" key={`${item.id}-${item.name}`}>
                      <img src={item.image} alt="" />
                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          DIY Component Kit · Quantity {item.quantity}
                        </small>
                      </div>
                      <span>{money(item.price * item.quantity)}</span>
                    </div>
                  )
                })}
              </section>
              <section className="form-card">
                <h2>Order status</h2>
                <div className="timeline">
                  {[
                    "Order Placed",
                    "Payment Confirmed",
                    "Processing",
                    "Shipped",
                    "Delivered",
                  ].map((step, i) => (
                    <div
                      className={
                        i <=
                        (adminStatus === "Delivered"
                          ? 4
                          : adminStatus === "Shipped"
                            ? 3
                            : 2)
                          ? "done"
                          : ""
                      }
                      key={step}
                    >
                      <span className="timeline-node">
                        {i <=
                        (adminStatus === "Delivered"
                          ? 4
                          : adminStatus === "Shipped"
                            ? 3
                            : 2) ? <Icon name="check" size={13} /> : ""}
                      </span>
                      <strong>{step}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className="form-card delivery-notifications">
                <div className="section-heading small-heading">
                  <div>
                    <h2>Delivery notifications</h2>
                    <p>Every completed shipping step appears here.</p>
                  </div>
                  <Icon name="bell" size={22} />
                </div>
                <div className="notification-channel">
                  <Icon name="shield" size={17} />
                  <span>
                    Demo updates for {profileEmail}
                    {phone ? ` and ${phone}` : ""}. No real email or SMS is sent.
                  </span>
                </div>
                <div className="delivery-update-list">
                  {deliveryUpdates.map((update) => (
                    <div className="delivery-update" key={update.step}>
                      <span><Icon name="check" size={13} /></span>
                      <div>
                        <strong>{update.step}</strong>
                        <p>{update.message}</p>
                        <small>
                          {new Date(update.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div>
              <div className="summary-card">
                <h3>Shipping information</h3>
                <p className="info-text">
                  {profileName}
                  <br />
                  {currentOrder?.shippingAddress.address || address || "12 Maker Street"}
                  <br />
                  {currentOrder?.shippingAddress.city || city || "Bengaluru"}, {currentOrder?.shippingAddress.state || stateName || "Karnataka"}{" "}
                  {currentOrder?.shippingAddress.pin || pin || "560001"}
                  <br />
                  {currentOrder?.shippingAddress.phone || phone || "+91 98765 43210"}
                </p>
                <div className="summary-lines">
                  <div>
                    <span>Payment</span>
                    <strong>Demo · not charged</strong>
                  </div>
                  <div>
                    <span>Order total</span>
                    <strong>{money(currentOrder?.total ?? total)}</strong>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => navigate("invoice")}
                className="full-width checkout-button"
              >
                <Icon name="download" size={18} /> Download Invoice
              </Button>
            </div>
          </div>
        </main>
      )}
      {page === "help" && (
        <main className="container page-main help-page">
          <div className="help-hero">
            <div className="help-hero-copy">
              <span className="eyebrow">MAKER SUPPORT / HERE FOR YOU</span>
              <h1>How can we help<span className="title-dot">?</span></h1>
              <p>Questions about a kit, your order, or getting started? We're here to help you keep building.</p>
            </div>
            <img className="help-hero-photo" src={photo("photo-1745571479662-54a2ad1c747f", 1100)} alt="Maker working on an electronics circuit board" />
          </div>
          <div className="help-layout">
            <section className="help-form-card">
              <span className="eyebrow">SEND A QUERY</span>
              <h2>Tell us what's on your mind.</h2>
              <p>Send a private support query to our team. You can follow its status below.</p>
              {helpSubmitted ? (
                <div className="help-confirmation" role="status">
                  <span><Icon name="check" size={27} /></span>
                  <h3>Query sent</h3>
                  <p>Your message has been saved to your account and is ready for the support team.</p>
                  <Button variant="outline" onClick={() => { setHelpSubmitted(false); setHelpMessage(""); setHelpOrderId("") }}>Ask another question</Button>
                </div>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault()
                  if (!authenticated) {
                    navigate("login")
                    return
                  }
                  setHelpPending(true)
                  setHelpError("")
                  const message = helpOrderId.trim()
                    ? `Order ID: ${helpOrderId.trim()}\n\n${helpMessage.trim()}`
                    : helpMessage.trim()
                  submitStudentQuery(localStorage.getItem("bot-token") || "", helpTopic, message)
                    .then((savedQuery) => {
                      setHelpQueries((current) => [savedQuery, ...current])
                      setHelpSubmitted(true)
                    })
                    .catch((error) => setHelpError(error instanceof Error ? error.message : "Could not submit your query."))
                    .finally(() => setHelpPending(false))
                }}>
                  <label className="field"><span>What is this about?</span><select value={helpTopic} onChange={(e) => setHelpTopic(e.target.value)}><option>Order & delivery</option><option>Kit components</option><option>Payments & invoice</option><option>Student account</option><option>Something else</option></select></label>
                  <Field label="Order ID (optional)" value={helpOrderId} onChange={setHelpOrderId} placeholder="e.g. ORD-102938" />
                  <label className="field"><span>Your question</span><textarea value={helpMessage} onChange={(e) => setHelpMessage(e.target.value)} placeholder="Tell us what happened or what you'd like to know..." rows={5} required minLength={10} /></label>
                  {helpError && <p className="login-error" role="alert">{helpError}</p>}
                  <Button type="submit" icon="arrow" disabled={helpPending}>{helpPending ? "Sending..." : "Submit Query"}</Button>
                  <span className="help-demo-note">Your query is linked to your signed-in student account.</span>
                </form>
              )}
              {!!helpQueries.length || helpQueryError ? <div className="student-query-list"><h3>Your support queries</h3>{helpQueryError && <p className="login-error" role="alert">{helpQueryError}</p>}{helpQueries.map((item) => {
                const replyIsOpen = openReplyQueryId === item.queryId
                return <article key={item.queryId}><div><strong>{item.subject}</strong><span className={`admin-status admin-status-${item.status.toLowerCase().replace(/ /g, "-")}`}>{item.status}</span></div><p>{item.message}</p>{item.adminReply && <><button className="student-query-reply-toggle" type="button" aria-expanded={replyIsOpen} onClick={() => setOpenReplyQueryId(replyIsOpen ? null : item.queryId)}>New message from admin · {replyIsOpen ? "Hide reply" : "View reply"}</button>{replyIsOpen && <blockquote><strong>Message from support</strong>{item.adminReply}</blockquote>}</>}<small>{item.queryId} · {new Date(item.createdAt).toLocaleString()}</small></article>
              })}</div> : null}
            </section>
            <aside className="help-side">
              <div className="help-info-card">
                <div className="help-icon"><Icon name="book" size={24} /></div>
                <h3>Quick answers</h3>
                <p>Find answers to the questions makers ask most.</p>
                <div className="faq-list">
                  {[
                    ["Is my kit a finished project?", "No. Every DIY Project Kit contains the components and materials you need to build it yourself. Nothing arrives pre-built."],
                    ["Which projects can I explore?", "Projects shows kits curated for your Grade 8 level. More Interesting lets you explore kits for all grades."],
                    ["Where can I find my invoice?", "Open My Orders, select an order, and choose Download Invoice to save an image-based PDF receipt."],
                    ["How do I track my order?", "Visit My Orders to see your current order status and shipping timeline."],
                  ].map(([question, answer], i) => (
                    <div key={question} className="faq-item">
                      <Button variant="ghost" className="faq-trigger" onClick={() => setOpenFaq(openFaq === i ? null : i)} ariaExpanded={openFaq === i}>
                        {question}<Icon name={openFaq === i ? "minus" : "plus"} size={17} />
                      </Button>
                      {openFaq === i && <p>{answer}</p>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="help-callout"><Icon name="box" size={23} /><strong>Build it yourself, brilliantly.</strong><span>Real components. Real learning. Real support for your maker journey.</span></div>
            </aside>
          </div>
        </main>
      )}
      {page === "profile" && (
        <main className="container page-main profile-page">
          <div className="page-intro compact">
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h1>
              My Profile<span className="title-dot">.</span>
            </h1>
            <p>Your own little corner of the maker universe.</p>
          </div>
          <div className="profile-layout">
            <div className="profile-side">
              <div className="profile-avatar">
                {profileName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <h2>{profileName}</h2>
              <span>{profileGrade} Maker</span>
            <div className="profile-side-line">
              <Icon name="spark" size={17} /> Curious since 2026
            </div>
            <Button variant="ghost" className="profile-logout" onClick={() => { setAuthenticated(false); setStudentEmail(""); setEmailVerificationToken(""); setStudentId(""); setPassword(""); setPasswordVisible(false); setCart([]); setOrders([]); setSelectedOrder(null); setOrderPlaced(false); setHelpSubmitted(false); setHelpMessage(""); try { localStorage.removeItem("bot-token"); localStorage.removeItem("bot-help-query") } catch { /* Storage may be unavailable. */ } navigate("verify") }}>Sign out</Button>
            </div>
            <div className="form-card profile-form">
              <div className="section-heading small-heading">
                <div>
                  <h2>Personal information</h2>
                  <p>Keep your details up to date.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (profileEditing) {
                      try {
                        localStorage.setItem("bot-profile", JSON.stringify({
                          name: profileName,
                          email: profileEmail,
                          grade: profileGrade,
                          phone,
                          address,
                          city,
                          stateName,
                          pin,
                        }))
                      } catch {
                        // Profile changes still apply for this session.
                      }
                      notify("Profile changes saved")
                    }
                    setProfileEditing(!profileEditing)
                  }}
                >
                  {profileEditing ? "Save Changes" : "Edit Profile"}
                </Button>
              </div>
              <div className="form-grid">
                <Field
                  label="Student Name"
                  value={profileName}
                  onChange={setProfileName}
                  readOnly={!profileEditing}
                />
                <Field
                  label="Email"
                  value={profileEmail}
                  onChange={setProfileEmail}
                  readOnly={!profileEditing}
                  type="email"
                />
                <Field
                  label="Student ID"
                  value={studentId}
                  readOnly
                />
                <label className="field">
                  <span>Grade</span>
                  <select
                    value={profileGrade}
                    onChange={(event) => setProfileGrade(event.target.value)}
                    disabled={!profileEditing}
                  >
                    {["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"].map((grade) => (
                      <option key={grade}>{grade}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Phone"
                  value={phone}
                  onChange={setPhone}
                  readOnly={!profileEditing}
                  placeholder="Add your phone number"
                />
                <Field
                  label="Address"
                  value={address}
                  onChange={setAddress}
                  readOnly={!profileEditing}
                  placeholder="Add your address"
                />
                <Field
                  label="City"
                  value={city}
                  onChange={setCity}
                  readOnly={!profileEditing}
                  placeholder="Add your city"
                />
                <Field
                  label="State"
                  value={stateName}
                  onChange={setStateName}
                  readOnly={!profileEditing}
                  placeholder="Add your state"
                />
                <Field
                  label="PIN code"
                  value={pin}
                  onChange={setPin}
                  readOnly={!profileEditing}
                  placeholder="Add your PIN code"
                />
              </div>
              <div className="profile-lock">
                <Icon name="lock" size={17} /> Your Student ID is verified and
                cannot be edited. Changing grade updates your project recommendations.
              </div>
            </div>
          </div>
        </main>
      )}
      {page === "admin" && (
        <main className="admin-layout">
          <aside className="admin-sidebar">
            <Brand onClick={() => navigate("home")} />
            <span className="admin-caption">ADMIN WORKSPACE</span>
            <nav>
              {[
                "Dashboard",
                "Students",
                "Projects",
                "Orders",
                "Inventory",
                "Invoices",
                "Analytics",
                "Settings",
              ].map((item, i) => (
                <button
                  key={item}
                  className={adminTab === item ? "active" : ""}
                  onClick={() => setAdminTab(item)}
                >
                  <Icon
                    name={
                      i === 0 || i === 6
                        ? "chart"
                        : i === 1
                          ? "user"
                          : i === 2 || i === 4
                            ? "box"
                            : i === 3 || i === 5
                              ? "book"
                              : "sliders"
                    }
                    size={19}
                  />{" "}
                  {item}
                </button>
              ))}
            </nav>
            <button className="admin-back" onClick={() => navigate("home")}>
              <Icon name="left" size={17} /> Back to student site
            </button>
          </aside>
          <div className="admin-content">
            <header className="admin-top">
              <div>
                <span className="eyebrow">BLACK ORANGE TALENT / ADMIN</span>
                <h1>{adminTab}</h1>
              </div>
              <div className="admin-top-right">
                <span>Administrator</span>
                <span className="avatar">AD</span>
              </div>
            </header>
            {adminTab === "Dashboard" && (
              <>
                <div className="admin-stats">
                  {[
                    ["Total Students", "1,248", "+12%", "user"],
                    ["Total Projects", "48", "+4 new", "box"],
                    ["Total Orders", "386", "+18%", "cart"],
                    ["Revenue", "₹4.86L", "+24%", "chart"],
                    ["Pending Orders", "18", "Needs attention", "clock"],
                    ["Failed Payments", "3", "This week", "warning"],
                  ].map(([label, value, trend, icon]) => (
                    <div className="admin-stat" key={label}>
                      <div>
                        <span>{label}</span>
                        <Icon name={icon} size={21} />
                      </div>
                      <strong>{value}</strong>
                      <small>{trend}</small>
                    </div>
                  ))}
                </div>
                <div className="admin-charts">
                  <div className="admin-panel sales-panel">
                    <div className="admin-panel-header">
                      <div>
                        <h2>Sales overview</h2>
                        <p>Monthly revenue performance</p>
                      </div>
                      <Badge tone="mint">+24.8% this year</Badge>
                    </div>
                    <div className="bar-chart">
                      {[36, 48, 42, 61, 53, 71, 63, 80, 72, 90, 78, 100].map(
                        (height, i) => (
                          <div key={i}>
                            <span style={{ height: `${height}%` }} />
                            <small>
                              {
                                [
                                  "J",
                                  "F",
                                  "M",
                                  "A",
                                  "M",
                                  "J",
                                  "J",
                                  "A",
                                  "S",
                                  "O",
                                  "N",
                                  "D",
                                ][i]
                              }
                            </small>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="admin-panel">
                    <h2>Popular projects</h2>
                    <p>Most loved by young makers</p>
                    {projects.slice(0, 4).map((p, i) => (
                      <div className="popular-row" key={p.id}>
                        <span>0{i + 1}</span>
                        <img src={p.image} alt="" />
                        <strong>{p.name}</strong>
                        <small>{[84, 62, 47, 35][i]} orders</small>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="admin-panel">
                  <h2>Orders over time</h2>
                  <p>Recent activity across your store</p>
                  <div className="mini-bars">
                    {[
                      30, 45, 38, 60, 49, 75, 68, 82, 70, 100, 87, 93, 77, 90,
                    ].map((height, i) => (
                      <span key={i} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
              </>
            )}
            {adminTab === "Students" && (
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <h2>Students</h2>
                    <p>Manage your enrolled makers.</p>
                  </div>
                  <div className="admin-panel-actions">
                    <Button
                      variant="outline"
                      onClick={() => notify("Student import is a demo action")}
                    >
                      Import Students
                    </Button>
                    <Button
                      onClick={() => notify("Add student is a demo action")}
                    >
                      Add Student <Icon name="plus" size={17} />
                    </Button>
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {[
                          "Student ID",
                          "Name",
                          "Email",
                          "Grade",
                          "Status",
                          "Actions",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={6}>No student accounts are loaded.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {adminTab === "Projects" && (
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <h2>Project management</h2>
                    <p>Edit kits, pricing and availability.</p>
                  </div>
                  <Button onClick={() => setAdminTab("Add Project")}>
                    Add Project <Icon name="plus" size={17} />
                  </Button>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {[
                          "Project",
                          "Grade",
                          "Category",
                          "Price",
                          "Inventory",
                          "Status",
                          "Actions",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="table-project">
                              <img src={p.image} alt="" />
                              <strong>{p.name}</strong>
                            </div>
                          </td>
                          <td>{p.grade}</td>
                          <td>{p.category}</td>
                          <td>{money(p.price)}</td>
                          <td>{p.stock} kits</td>
                          <td>
                            <Badge tone={p.stock ? "mint" : "orange"}>
                              {p.stock ? "Active" : "Out of stock"}
                            </Badge>
                          </td>
                          <td>
                            <button
                              className="table-action"
                              onClick={() => {
                                setAdminProjectName(p.name)
                                setAdminTab("Add Project")
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="table-action"
                              onClick={() =>
                                notify("Manage inventory is a demo action")
                              }
                            >
                              Inventory
                            </button>
                            <button
                              className="table-action"
                              onClick={() =>
                                notify("Delete is disabled in this demo")
                              }
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {adminTab === "Add Project" && (
              <div className="admin-panel admin-form">
                <div className="admin-panel-header">
                  <div>
                    <h2>Add / Edit Project</h2>
                    <p>Set up an educational component kit.</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setAdminTab("Projects")}
                  >
                    Back to projects
                  </Button>
                </div>
                <div className="form-grid">
                  <Field
                    label="Project Name"
                    value={adminProjectName}
                    onChange={setAdminProjectName}
                  />
                  <Field label="Short Description" />
                  <Field label="Full Description" />
                  <Field label="Price" type="number" />
                  <Field label="Grade" />
                  <Field label="Category" />
                  <Field label="Difficulty" />
                  <Field label="Estimated Build Time" />
                  <Field label="Stock quantity" type="number" />
                </div>
                <label className="admin-check">
                  <input type="checkbox" /> Generic Project — Available to All
                  Grades
                </label>
                <div className="admin-form-extra">
                  <strong>Project Images</strong>
                  <input type="file" accept="image/*" />
                  <strong>Components Included</strong>
                  <button
                    onClick={() => notify("Component field added (demo)")}
                  >
                    + Add component
                  </button>
                  <strong>Learning Outcomes</strong>
                  <button onClick={() => notify("Outcome field added (demo)")}>
                    + Add outcome
                  </button>
                </div>
                <Button
                  onClick={() => {
                    notify("Project saved in demo workspace")
                    setAdminTab("Projects")
                  }}
                >
                  Save Project
                </Button>
              </div>
            )}
            {adminTab === "Orders" && (
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <h2>Order management</h2>
                    <p>Track and update student kit orders.</p>
                  </div>
                  <div className="admin-panel-actions">
                    <select aria-label="Payment status filter">
                      <option>All payment statuses</option>
                      <option>Paid</option>
                      <option>Failed</option>
                    </select>
                    <select aria-label="Order status filter">
                      <option>All order statuses</option>
                      <option>Processing</option>
                      <option>Shipped</option>
                      <option>Delivered</option>
                    </select>
                    <input type="date" aria-label="Filter by date" />
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {[
                          "Order ID",
                          "Student",
                          "Project",
                          "Amount",
                          "Payment",
                          "Order Status",
                          "Date",
                          "Actions",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>#ORD-102938</td>
                        <td>Aarav Sharma</td>
                        <td>
                          {cart.length
                            ? cart
                                .map(
                                  (item) =>
                                    projects.find((p) => p.id === item.id)
                                      ?.name,
                                )
                                .join(", ")
                            : "Smart Plant Monitor"}
                        </td>
                        <td>{money(total || 1574)}</td>
                        <td>
                          <Badge tone="mint">Paid</Badge>
                        </td>
                        <td>
                          <select
                            value={adminStatus}
                            onChange={(e) => setAdminStatus(e.target.value)}
                          >
                            <option>Processing</option>
                            <option>Shipped</option>
                            <option>Delivered</option>
                            <option>Cancelled</option>
                          </select>
                        </td>
                        <td>12 Sep 2026</td>
                        <td>
                          <button
                            className="table-action"
                            onClick={() => navigate("order-detail")}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {![
              "Dashboard",
              "Students",
              "Projects",
              "Add Project",
              "Orders",
            ].includes(adminTab) && (
              <div className="admin-panel admin-placeholder">
                <Icon
                  name={adminTab === "Analytics" ? "chart" : "box"}
                  size={46}
                />
                <h2>{adminTab} workspace</h2>
                <p>
                  This area is ready for your live store data. Explore the
                  dashboard, students, projects and orders in this prototype.
                </p>
                <Button onClick={() => setAdminTab("Dashboard")}>
                  Back to dashboard
                </Button>
              </div>
            )}
          </div>
        </main>
      )}
      {page === "design-system" && (
        <main className="container page-main ds-page">
          <div className="page-intro">
            <span className="eyebrow">BLACK ORANGE TALENT / FOUNDATIONS</span>
            <h1>
              Design System<span className="title-dot">.</span>
            </h1>
            <p>A living reference for the visual language of curious makers.</p>
          </div>
          <section className="ds-section">
            <h2>01 / Colors</h2>
            <div className="swatches">
              {[
                ["Ink", "#101725"],
                ["Orange", "#FF7529"],
                ["Violet", "#7564CF"],
                ["Mint", "#DFF5EB"],
                ["Success", "#18835A"],
                ["Warning", "#F2A52D"],
                ["Error", "#D65A4A"],
                ["Canvas", "#F7F8FB"],
              ].map(([name, color]) => (
                <div key={name}>
                  <span style={{ background: color }} />
                  <strong>{name}</strong>
                  <small>{color}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="ds-section">
            <h2>02 / Typography</h2>
            <div className="type-specimens">
              <div>
                <span>DISPLAY</span>
                <h1>Make it happen.</h1>
              </div>
              <div>
                <span>HEADING 1</span>
                <h2>Build a better tomorrow.</h2>
              </div>
              <div>
                <span>HEADING 2</span>
                <h3>Learning by doing.</h3>
              </div>
              <div>
                <span>BODY</span>
                <p>
                  Everything you need to explore, experiment and make something
                  entirely your own.
                </p>
              </div>
              <div>
                <span>CAPTION</span>
                <small>DIY PROJECT KIT · COMPONENTS INCLUDED</small>
              </div>
            </div>
          </section>
          <section className="ds-section">
            <h2>03 / Buttons & states</h2>
            <div className="ds-row">
              <Button>
                Primary <Icon name="arrow" size={17} />
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger">Danger</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>
          <section className="ds-section">
            <h2>04 / Inputs & badges</h2>
            <div className="ds-row ds-inputs">
              <Field label="Default input" placeholder="Start typing..." />
              <Field label="Filled input" value="Aarav Sharma" readOnly />
              <Field label="Disabled input" value="STUDENT-123" readOnly />
            </div>
            <div className="ds-row">
              <Badge tone="orange">Grade 8</Badge>
              <Badge tone="neutral">Intermediate</Badge>
              <Badge tone="violet">Open to All Grades</Badge>
              <Badge tone="mint">Paid</Badge>
              <Badge tone="orange">Processing</Badge>
            </div>
          </section>
          <section className="ds-section">
            <h2>05 / Cards & components</h2>
            <div className="ds-cards">
              <ProjectCard
                project={projects[0]}
                onView={() => openProject(1)}
                onAdd={() => addToCart(1)}
              />
              <ProjectCard
                project={projects[4]}
                onView={() => openProject(5)}
                onAdd={() => addToCart(5)}
              />
              <ProjectCard
                project={projects[6]}
                onView={() => openProject(7)}
                onAdd={() => {}}
              />
              {summary}
            </div>
          </section>
        </main>
      )}
      </div>
      {!isAuth && page !== "admin" && footer}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Icon name="check" size={16} />
          </span>
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
