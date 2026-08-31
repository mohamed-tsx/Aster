/**
 * Generates realistic-looking document images with `sharp` (SVG -> raster).
 * Every generator returns { buffer, mimeType, fileName }.
 *
 * These are fixtures — they look like a passport page / hospital letter / visa
 * sticker at a glance and open + download correctly in the app, but they are
 * obviously not real documents.
 */

import sharp from "sharp";

const SANS = "Arial, Helvetica, sans-serif";
const MONO = "'Courier New', Courier, monospace";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

const initialsOf = (first, last) =>
  `${(first || "?").trim()[0] || "?"}${(last || "?").trim()[0] || ""}`.toUpperCase();

async function rasterPng(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}
async function rasterJpg(svg) {
  return sharp(Buffer.from(svg)).jpeg({ quality: 78 }).toBuffer();
}

/** A grey portrait placeholder with initials. */
function photoBox(x, y, w, h, initials) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#d9dde3" stroke="#9aa3ad" stroke-width="2"/>
    <circle cx="${x + w / 2}" cy="${y + h * 0.38}" r="${w * 0.22}" fill="#b6bcc6"/>
    <path d="M ${x + w * 0.12} ${y + h} Q ${x + w / 2} ${y + h * 0.5} ${x + w * 0.88} ${y + h} Z" fill="#b6bcc6"/>
    <text x="${x + w / 2}" y="${y + h / 2 + 8}" font-family="${SANS}" font-size="${w * 0.28}"
      fill="#7a828d" text-anchor="middle" opacity="0.55">${esc(initials)}</text>`;
}

/**
 * @param {{firstName,lastName,gender,dateOfBirth,passportNumber,passportExpiry,nationality}} p
 */
export async function passportImage(p) {
  const W = 1000;
  const H = 680;
  const sex = p.gender === "FEMALE" ? "F" : p.gender === "MALE" ? "M" : "X";
  const surname = esc(p.lastName);
  const given = esc(p.firstName);
  const mrzName = `${p.lastName}<<${p.firstName}`.toUpperCase().replace(/[^A-Z<]/g, "<").padEnd(39, "<").slice(0, 39);
  const mrzLine2 = `${(p.passportNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(9, "<").slice(0, 9)}1SOM${"0000000"}${sex}${"0000000"}<<<<<<<<<<<<<<02`.slice(0, 44);

  const field = (x, y, label, value) => `
    <text x="${x}" y="${y}" font-family="${SANS}" font-size="14" fill="#4b7a4b" letter-spacing="1">${esc(label)}</text>
    <text x="${x}" y="${y + 26}" font-family="${SANS}" font-size="21" fill="#1c2b1c" font-weight="bold">${esc(value)}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#eef4ec"/><stop offset="1" stop-color="#dbe7d6"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="none" stroke="#7fae7f" stroke-width="2"/>
    <text x="40" y="58" font-family="${SANS}" font-size="24" fill="#1c3b1c" font-weight="bold" letter-spacing="2">JAMHUURIYADDA FEDERAALKA SOOMAALIYA</text>
    <text x="40" y="86" font-family="${SANS}" font-size="16" fill="#3a5a3a" letter-spacing="3">FEDERAL REPUBLIC OF SOMALIA · PASSPORT / BAASABOOR</text>
    <line x1="40" y1="100" x2="${W - 40}" y2="100" stroke="#7fae7f" stroke-width="1.5"/>
    ${photoBox(40, 130, 220, 280, initialsOf(p.firstName, p.lastName))}
    ${field(300, 150, "SURNAME / MAGACA QOYSKA", surname)}
    ${field(300, 220, "GIVEN NAMES / MAGACYADA", given)}
    ${field(300, 290, "NATIONALITY / DHALASHADA", (p.nationality || "SOMALI").toUpperCase())}
    ${field(300, 360, "DATE OF BIRTH / TAARIIKHDA DHALASHADA", fmtDate(p.dateOfBirth))}
    ${field(650, 360, "SEX / JINSIGA", sex)}
    ${field(300, 430, "PASSPORT No / LAMBARKA", (p.passportNumber || "—").toUpperCase())}
    ${field(650, 430, "DATE OF EXPIRY / DHICITAANKA", p.passportExpiry ? fmtDate(p.passportExpiry) : "—")}
    <rect x="40" y="500" width="${W - 80}" height="120" fill="#f4f8f2" stroke="#9aa3ad" stroke-width="1"/>
    <text x="52" y="546" font-family="${MONO}" font-size="20" fill="#111" letter-spacing="2">P&lt;SOM${esc(mrzName)}</text>
    <text x="52" y="586" font-family="${MONO}" font-size="20" fill="#111" letter-spacing="2">${esc(mrzLine2)}</text>
  </svg>`;

  return { buffer: await rasterJpg(svg), mimeType: "image/jpeg", fileName: "passport.jpg" };
}

/**
 * A letterhead-style document (evaluation report, invitation letter, referral form).
 * @param {{hospitalName?,hospitalCity?,orgName?,title,refNumber,dateOn,bodyLines:string[],signerName,signerRole}} o
 */
export async function letterImage(o) {
  const W = 900;
  const H = 1180;
  const org = esc(o.hospitalName || o.orgName || "Aster Hospital Referral Center — East Africa");
  const sub = esc(
    o.hospitalCity
      ? `International Patient Services · ${o.hospitalCity}`
      : "Muqdisho, Somalia · care@asterreferral.com",
  );

  const bodyStartY = 300;
  const lineH = 30;
  const body = (o.bodyLines || [])
    .map((ln, i) => {
      const y = bodyStartY + i * lineH;
      const blank = ln === "";
      return blank
        ? ""
        : `<text x="70" y="${y}" font-family="${SANS}" font-size="16" fill="#222">${esc(ln)}</text>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${W}" height="8" fill="#0f6d4d"/>
    <circle cx="70" cy="80" r="26" fill="#0f6d4d"/>
    <text x="70" y="88" font-family="${SANS}" font-size="22" fill="#fff" text-anchor="middle" font-weight="bold">+</text>
    <text x="112" y="72" font-family="${SANS}" font-size="22" fill="#0f3d2c" font-weight="bold">${org}</text>
    <text x="112" y="98" font-family="${SANS}" font-size="13" fill="#5a6b63">${sub}</text>
    <line x1="70" y1="130" x2="${W - 70}" y2="130" stroke="#c9d6cf" stroke-width="1.5"/>
    <text x="${W - 70}" y="170" font-family="${SANS}" font-size="13" fill="#5a6b63" text-anchor="end">Ref: ${esc(o.refNumber || "—")}</text>
    <text x="${W - 70}" y="190" font-family="${SANS}" font-size="13" fill="#5a6b63" text-anchor="end">Date: ${esc(fmtDate(o.dateOn || Date.now()))}</text>
    <text x="70" y="230" font-family="${SANS}" font-size="22" fill="#0f3d2c" font-weight="bold" letter-spacing="1">${esc(o.title)}</text>
    <line x1="70" y1="245" x2="${70 + Math.min(esc(o.title).length * 12, W - 140)}" y2="245" stroke="#0f6d4d" stroke-width="2"/>
    ${body}
    <line x1="70" y1="${H - 150}" x2="320" y2="${H - 150}" stroke="#333" stroke-width="1"/>
    <text x="70" y="${H - 128}" font-family="${SANS}" font-size="15" fill="#222" font-weight="bold">${esc(o.signerName || "Authorised Officer")}</text>
    <text x="70" y="${H - 108}" font-family="${SANS}" font-size="13" fill="#5a6b63">${esc(o.signerRole || "")}</text>
    <g transform="translate(${W - 220}, ${H - 210}) rotate(-12)">
      <circle cx="70" cy="70" r="66" fill="none" stroke="#1c6fb0" stroke-width="3" opacity="0.75"/>
      <circle cx="70" cy="70" r="54" fill="none" stroke="#1c6fb0" stroke-width="1.5" opacity="0.75"/>
      <text x="70" y="60" font-family="${SANS}" font-size="13" fill="#1c6fb0" text-anchor="middle" opacity="0.8" font-weight="bold">${esc((o.hospitalCity || "MUQDISHO").toUpperCase())}</text>
      <text x="70" y="80" font-family="${SANS}" font-size="11" fill="#1c6fb0" text-anchor="middle" opacity="0.8">OFFICIAL</text>
      <text x="70" y="96" font-family="${SANS}" font-size="10" fill="#1c6fb0" text-anchor="middle" opacity="0.8">${esc(fmtDate(o.dateOn || Date.now()))}</text>
    </g>
  </svg>`;

  return { buffer: await rasterPng(svg), mimeType: "image/png", fileName: "letter.png" };
}

/**
 * A visa sticker on a passport page.
 * @param {{firstName,lastName,passportNumber,country,visaNumber,issueDate,expiryDate,purpose}} o
 */
export async function visaCopyImage(o) {
  const W = 1000;
  const H = 680;
  const country = esc((o.country || "INDIA").toUpperCase());
  const row = (x, y, label, value) => `
    <text x="${x}" y="${y}" font-family="${SANS}" font-size="11" fill="#3a3a6a">${esc(label)}</text>
    <text x="${x}" y="${y + 18}" font-family="${SANS}" font-size="15" fill="#101033" font-weight="bold">${esc(value)}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f2efe6"/>
    <text x="40" y="60" font-family="${SANS}" font-size="18" fill="#6b6b6b" letter-spacing="4">PASSPORT · VISAS · SEERTIFIKEETADA</text>
    <line x1="40" y1="74" x2="${W - 40}" y2="74" stroke="#cfcabb" stroke-width="1"/>
    <g transform="translate(120,130)">
      <rect width="760" height="380" rx="8" fill="#eaf2fb" stroke="#2f5da8" stroke-width="2"/>
      <rect width="760" height="60" fill="#2f5da8"/>
      <text x="24" y="40" font-family="${SANS}" font-size="24" fill="#fff" font-weight="bold" letter-spacing="2">${country} — ENTRY VISA</text>
      <text x="${760 - 24}" y="40" font-family="${MONO}" font-size="18" fill="#dfe8f6" text-anchor="end">${esc((o.visaNumber || "V0000000").toUpperCase())}</text>
      ${row(28, 110, "TYPE / CATEGORY", o.purpose || "MEDICAL (MED-X)")}
      ${row(360, 110, "ENTRIES", "MULTIPLE")}
      ${row(28, 165, "SURNAME", (o.lastName || "").toUpperCase())}
      ${row(360, 165, "GIVEN NAME", (o.firstName || "").toUpperCase())}
      ${row(28, 220, "PASSPORT No", (o.passportNumber || "").toUpperCase())}
      ${row(360, 220, "NATIONALITY", "SOMALI")}
      ${row(28, 275, "DATE OF ISSUE", fmtDate(o.issueDate || Date.now()))}
      ${row(360, 275, "DATE OF EXPIRY", fmtDate(o.expiryDate || Date.now()))}
      <text x="28" y="345" font-family="${MONO}" font-size="15" fill="#101033" letter-spacing="2">V&lt;SOM${esc((o.lastName || "").toUpperCase().replace(/[^A-Z]/g, "<").padEnd(20, "<").slice(0, 20))}${esc((o.firstName || "").toUpperCase().replace(/[^A-Z]/g, "<").padEnd(15, "<").slice(0, 15))}</text>
    </g>
    <g transform="translate(${W - 250}, ${H - 170}) rotate(-8)">
      <rect x="0" y="0" width="180" height="90" rx="6" fill="none" stroke="#8a1f1f" stroke-width="2" opacity="0.7"/>
      <text x="90" y="38" font-family="${SANS}" font-size="16" fill="#8a1f1f" text-anchor="middle" opacity="0.8" font-weight="bold">${country}</text>
      <text x="90" y="62" font-family="${SANS}" font-size="12" fill="#8a1f1f" text-anchor="middle" opacity="0.8">IMMIGRATION</text>
      <text x="90" y="80" font-family="${SANS}" font-size="10" fill="#8a1f1f" text-anchor="middle" opacity="0.8">${esc(fmtDate(o.issueDate || Date.now()))}</text>
    </g>
  </svg>`;

  return { buffer: await rasterPng(svg), mimeType: "image/png", fileName: "visa-copy.png" };
}

/**
 * A generic scanned form / report page.
 * @param {{title,subtitle?,fields?:[string,string][],paragraphs?:string[],caseNumber?}} o
 */
export async function scanImage(o) {
  const W = 900;
  const H = 1180;
  const fields = (o.fields || [])
    .map(([k, v], i) => {
      const y = 250 + i * 40;
      return `
      <text x="70" y="${y}" font-family="${SANS}" font-size="13" fill="#666">${esc(k)}</text>
      <text x="330" y="${y}" font-family="${SANS}" font-size="15" fill="#111" font-weight="bold">${esc(v)}</text>
      <line x1="70" y1="${y + 8}" x2="${W - 70}" y2="${y + 8}" stroke="#e2e2e2" stroke-width="1"/>`;
    })
    .join("\n");

  let cursorY = 250 + (o.fields || []).length * 40 + 30;
  const paraLines = [];
  for (const para of o.paragraphs || []) {
    for (const ln of wrapText(para, 92)) {
      paraLines.push(`<text x="70" y="${cursorY}" font-family="${SANS}" font-size="14" fill="#222">${esc(ln)}</text>`);
      cursorY += 24;
    }
    cursorY += 14; // paragraph gap
  }
  const paras = paraLines.join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#fdfdfb"/>
    <rect x="0" y="0" width="${W}" height="6" fill="#334155"/>
    <text x="70" y="70" font-family="${SANS}" font-size="22" fill="#1f2937" font-weight="bold">${esc(o.title)}</text>
    <text x="70" y="96" font-family="${SANS}" font-size="13" fill="#6b7280">${esc(o.subtitle || "Aster Hospital Referral Center — East Africa")}</text>
    ${o.caseNumber ? `<text x="${W - 70}" y="70" font-family="${MONO}" font-size="14" fill="#6b7280" text-anchor="end">${esc(o.caseNumber)}</text>` : ""}
    <line x1="70" y1="120" x2="${W - 70}" y2="120" stroke="#cbd5e1" stroke-width="1.5"/>
    ${fields}
    ${paras}
    <text x="70" y="${H - 90}" font-family="${SANS}" font-size="12" fill="#9ca3af">This is a system-generated demo document. Not a legal record.</text>
    <line x1="70" y1="${H - 70}" x2="300" y2="${H - 70}" stroke="#333" stroke-width="1"/>
    <text x="70" y="${H - 50}" font-family="${SANS}" font-size="12" fill="#6b7280">Prepared by Aster Referral Center</text>
  </svg>`;

  return { buffer: await rasterPng(svg), mimeType: "image/png", fileName: "document.png" };
}

/** A small circular avatar with initials on a coloured ground. */
export async function avatarImage(firstName, lastName) {
  const initials = initialsOf(firstName, lastName);
  const palette = ["#0f6d4d", "#1c6fb0", "#8a5a1f", "#6b1f8a", "#8a1f3f", "#1f6b6b", "#4b5563"];
  let h = 0;
  for (const c of initials) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = palette[h % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="${bg}"/>
    <text x="128" y="128" font-family="${SANS}" font-size="110" fill="#ffffff" text-anchor="middle" dominant-baseline="central" font-weight="bold">${esc(initials)}</text>
  </svg>`;
  return { buffer: await rasterPng(svg), mimeType: "image/png", fileName: "avatar.png" };
}

/** naive word wrap to `max` chars per line */
function wrapText(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
