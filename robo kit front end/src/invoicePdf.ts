type InvoiceData = {
  logo: string
  companyAddress: string
  customerName: string
  customerEmail: string
  studentId: string
  phone: string
  address: string
  city: string
  stateName: string
  pin: string
  items: { name: string; quantity: number; price: number }[]
  subtotal: number
  shipping: number
  tax: number
  total: number
  kitNotice: string
}

const currency = (amount: number) => `₹${amount.toLocaleString("en-IN")}`

// Draw the receipt as an image, then embed that JPEG in a single-page A4 PDF.
export async function createInvoicePdf(data: InvoiceData) {
  const canvas = document.createElement("canvas")
  canvas.width = 1240
  canvas.height = 1754
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is unavailable")

  const ink = "#172031"
  const muted = "#748093"
  const orange = "#f87731"
  const line = "#e3e7ed"
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = ink
  ctx.fillRect(0, 0, canvas.width, 18)

  const text = (value: string, x: number, y: number, size = 23, color = ink, weight = 400) => {
    ctx.fillStyle = color
    ctx.font = `${weight} ${size}px Arial, sans-serif`
    ctx.fillText(value, x, y)
  }
  const rule = (y: number) => {
    ctx.fillStyle = line
    ctx.fillRect(80, y, 1080, 2)
  }
  const right = (value: string, x: number, y: number, size = 23, color = ink, weight = 400) => {
    ctx.font = `${weight} ${size}px Arial, sans-serif`
    text(value, x - ctx.measureText(value).width, y, size, color, weight)
  }

  try {
    const image = new Image()
    image.src = data.logo
    await image.decode()
    ctx.drawImage(image, 80, 72, 380, 70)
  } catch {
    text("BLACK ORANGE TALENT", 80, 116, 32, ink, 700)
  }
  right("INVOICE", 1160, 112, 42, ink, 700)
  right("#INV-102938", 1160, 154, 21, muted)
  text("Black Orange Talent", 80, 208, 25, ink, 700)
  text(data.companyAddress, 80, 248, 22, muted)
  rule(286)

  text("BILLED & SHIPPED TO", 80, 350, 18, orange, 700)
  text(data.customerName, 80, 394, 27, ink, 700)
  const customerLines = [
    ...(data.studentId ? [`Student ID: ${data.studentId}`] : []),
    data.customerEmail,
    data.phone || "+91 98765 43210",
    `${data.address || "12 Maker Street"}, ${data.city || "Bengaluru"}`,
    `${data.stateName || "Karnataka"} ${data.pin || "560001"}`,
  ]
  customerLines.forEach((value, index) => text(value, 80, 431 + index * 34, 21, muted))

  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  ;[["Invoice date", date], ["Order ID", "#ORD-102938"], ["Payment ID", "PAY-582174"]].forEach(([label, value], index) => {
    const y = 352 + index * 55
    text(label, 750, y, 20, muted)
    right(value, 1160, y, 21, ink, 700)
  })

  ctx.fillStyle = ink
  ctx.fillRect(80, 660, 1080, 58)
  text("PROJECT KIT", 98, 698, 18, "#ffffff", 700)
  text("QTY", 707, 698, 18, "#ffffff", 700)
  text("UNIT PRICE", 820, 698, 18, "#ffffff", 700)
  right("TOTAL", 1140, 698, 18, "#ffffff", 700)

  const rowHeight = Math.min(70, Math.floor(384 / Math.max(data.items.length, 1)))
  data.items.forEach((item, index) => {
    const y = 770 + index * rowHeight
    text(item.name, 98, y, 22, ink, 700)
    text("DIY Educational Component Kit", 98, y + 24, 17, muted)
    text(String(item.quantity), 714, y + 8, 21)
    text(currency(item.price), 820, y + 8, 21)
    right(currency(item.price * item.quantity), 1140, y + 8, 21, ink, 700)
    rule(y + 41)
  })

  const totalsStart = Math.max(890, 770 + data.items.length * rowHeight + 26)
  ;[["Subtotal", data.subtotal], ["Shipping", data.shipping], ["Tax", data.tax]].forEach(([label, value], index) => {
    const y = totalsStart + index * 44
    text(String(label), 820, y, 22, muted)
    right(currency(Number(value)), 1140, y, 22, ink, 700)
  })
  ctx.fillStyle = ink
  ctx.fillRect(790, totalsStart + 145, 370, 3)
  text("GRAND TOTAL", 820, totalsStart + 195, 23, ink, 700)
  right(currency(data.total), 1140, totalsStart + 195, 28, ink, 700)

  const noteY = Math.max(1330, totalsStart + 260)
  ctx.fillStyle = "#fff6ec"
  ctx.fillRect(80, noteY, 1080, 166)
  ctx.fillStyle = orange
  ctx.fillRect(80, noteY, 7, 166)
  text("A NOTE ABOUT YOUR KIT", 108, noteY + 42, 20, ink, 700)
  const words = data.kitNotice.split(" ")
  let currentLine = ""
  let lineIndex = 0
  ctx.font = "20px Arial, sans-serif"
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(candidate).width > 990 && currentLine) {
      text(currentLine, 108, noteY + 78 + lineIndex * 30, 20, muted)
      currentLine = word
      lineIndex++
    } else currentLine = candidate
  }
  if (currentLine) text(currentLine, 108, noteY + 78 + lineIndex * 30, 20, muted)
  rule(1620)
  text("Thank you for choosing to build with us.", 80, 1662, 23, ink, 700)
  text("Black Orange Talent  •  Educational component kits, not pre-built projects", 80, 1702, 18, muted)

  const jpeg = atob(canvas.toDataURL("image/jpeg", 0.88).split(",")[1])
  const imageBytes = Uint8Array.from(jpeg, (character) => character.charCodeAt(0))
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets = [0]
  let length = 0
  const add = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  const object = (number: number, content: string) => {
    offsets[number] = length
    add(`${number} 0 obj\n${content}\nendobj\n`)
  }
  add("%PDF-1.4\n")
  object(1, "<< /Type /Catalog /Pages 2 0 R >>")
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  object(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>")
  const stream = "q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n"
  object(4, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`)
  offsets[5] = length
  add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`)
  add(imageBytes)
  add("\nendstream\nendobj\n")
  const xref = length
  add("xref\n0 6\n0000000000 65535 f \n")
  for (let number = 1; number <= 5; number++) add(`${String(offsets[number]).padStart(10, "0")} 00000 n \n`)
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  const pdf = new Uint8Array(length)
  let position = 0
  for (const part of parts) {
    pdf.set(part, position)
    position += part.length
  }
  const url = URL.createObjectURL(new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "Black-Orange-Talent-invoice-102938.pdf"
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
