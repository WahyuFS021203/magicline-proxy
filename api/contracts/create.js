// Contract creation proxy (Magicline Connect API).
//
// Duplicate protection (2026-11): one Magicline customer per e-mail address.
// Before a contract is created, the proxy searches Magicline (Open API,
// POST /v1/customers/search, scope CUSTOMER_READ) for an existing customer
// with the same e-mail address.
//   - Same person created in the last RETRY_WINDOW_MINUTES (typical case:
//     the first request succeeded, but the browser got an error/timeout and
//     the user submitted again): return 200 with the existing customer
//     instead of creating a second contract. The website shows the normal
//     success state.
//   - Any other existing customer with that e-mail: return 409
//     EMAIL_ALREADY_REGISTERED with a German message that the website shows.
// If the search itself fails (API down, missing scope), the contract is
// still created (fail open), so online sales are never blocked by the check.
// Additionally, requests for the same e-mail that arrive while another one is
// still in flight on the same instance are rejected (in-memory lock).

const ALLOWED_ORIGINS = [
  "https://one-power-fitness.webflow.io",
  "https://www.one-power-fitness.de",
  "https://one-power-fitness.de",
];

const CONNECT_URL =
  "https://one-power-fitness.api.magicline.com/connect/v1/rate-bundle";
const OPEN_API_BASE = "https://one-power-fitness.open-api.magicline.com";

const RETRY_WINDOW_MINUTES = 30;
const SEARCH_TIMEOUT_MS = 8000;
const CREATE_TIMEOUT_MS = 25000;

// Per-instance state. Not shared across Vercel instances, the Magicline
// search above is the real guard; this only closes the gap for requests
// that arrive while the first one is still running.
const inFlight = new Set();
const recentlyCreated = new Map(); // email -> { at, data, customer }

const MSG_EMAIL_EXISTS =
  "Mit dieser E-Mail-Adresse besteht bereits ein Konto bei ONE power fitness Abensberg. " +
  "Bitte verwende eine andere E-Mail-Adresse oder kontaktiere uns über das Kontaktformular " +
  "auf unserer Homepage unter Kontakt → Allgemeine Anfragen.";
const MSG_IN_PROGRESS =
  "Deine Anmeldung wird bereits verarbeitet. Bitte warte einen Moment und sende das Formular nicht erneut ab.";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Returns an array of customers with exactly this e-mail, or null if the
// search could not be performed.
async function findCustomersByEmail(email) {
  if (!process.env.MAGICLINE_OPEN_API_KEY) {
    console.error("[API Proxy] Duplicate check skipped: MAGICLINE_OPEN_API_KEY missing");
    return null;
  }
  try {
    const response = await fetchWithTimeout(
      `${OPEN_API_BASE}/v1/customers/search`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.MAGICLINE_OPEN_API_KEY,
        },
        body: JSON.stringify({ email }),
      },
      SEARCH_TIMEOUT_MS,
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `[API Proxy] Duplicate check failed (${response.status}): ${text.slice(0, 300)}`,
      );
      return null;
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : data?.result || [];
    return list.filter((c) => normalizeEmail(c.email) === email);
  } catch (error) {
    console.error("[API Proxy] Duplicate check error:", error?.name || error);
    return null;
  }
}

function isSamePerson(existing, customer) {
  return (
    normalizeText(existing.firstName ?? existing.firstname) ===
      normalizeText(customer.firstname) &&
    normalizeText(existing.lastName ?? existing.lastname) ===
      normalizeText(customer.lastname) &&
    (!existing.dateOfBirth || existing.dateOfBirth === customer.dateOfBirth)
  );
}

function isRecent(existing) {
  if (!existing.createdDateTime) return false;
  const created = Date.parse(existing.createdDateTime);
  if (Number.isNaN(created)) return false;
  return Date.now() - created < RETRY_WINDOW_MINUTES * 60 * 1000;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  const payload = req.body || {};

  if (!payload.contract || !payload.customer) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "Die Anfrage ist unvollständig (contract und customer fehlen).",
    });
  }

  const email = normalizeEmail(payload.customer.email);
  if (!email) {
    return res.status(400).json({
      errorCodes: ["EMAIL_REQUIRED"],
      message: "Bitte gib eine E-Mail-Adresse an.",
    });
  }

  // 1. Same e-mail already in flight on this instance
  if (inFlight.has(email)) {
    console.warn("[API Proxy] Rejected parallel request for same e-mail");
    return res.status(409).json({
      errorCodes: ["REQUEST_IN_PROGRESS"],
      message: MSG_IN_PROGRESS,
    });
  }

  // 2. Created by this instance a moment ago (fast retry)
  const cached = recentlyCreated.get(email);
  if (
    cached &&
    Date.now() - cached.at < RETRY_WINDOW_MINUTES * 60 * 1000 &&
    isSamePerson(cached.customer, payload.customer)
  ) {
    console.warn("[API Proxy] Retry after successful creation, returning cached result");
    return res.status(200).json({ ...cached.data, alreadyCreated: true });
  }

  inFlight.add(email);
  try {
    // 3. Existing customer in Magicline with this e-mail
    const existing = await findCustomersByEmail(email);

    if (existing && existing.length > 0) {
      const retryMatch = existing.find(
        (c) => isSamePerson(c, payload.customer) && isRecent(c),
      );
      if (retryMatch) {
        console.warn(
          `[API Proxy] Duplicate prevented (retry of ${retryMatch.customerNumber || retryMatch.id})`,
        );
        return res.status(200).json({
          customerId: retryMatch.id,
          customerNumber: retryMatch.customerNumber,
          alreadyCreated: true,
        });
      }
      console.warn(
        `[API Proxy] Duplicate prevented: e-mail already used by ${existing.length} customer(s)`,
      );
      return res.status(409).json({
        errorCodes: ["EMAIL_ALREADY_REGISTERED"],
        message: MSG_EMAIL_EXISTS,
      });
    }

    // 4. Create contract
    console.log(
      `[API Proxy] Creating a new contract (Studio: ${payload.studioId || "Default"})`,
    );

    const response = await fetchWithTimeout(
      CONNECT_URL,
      {
        method: "POST",
        headers: { Accept: "*/*", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      CREATE_TIMEOUT_MS,
    );

    const responseText = await response.text();
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { message: responseText };
      }
    }

    if (!response.ok) {
      console.error(`[API Proxy] Magicline Error (${response.status}):`, {
        errorCodes: data.errorCodes,
        message: data.message,
        traceId: data.traceId,
      });
      return res.status(response.status).json({
        errorCodes: data.errorCodes || ["SERVER_ERROR"],
        message: data.message || "Fehler bei der Vertragsanlage in Magicline.",
        traceId: data.traceId,
      });
    }

    recentlyCreated.set(email, {
      at: Date.now(),
      data,
      customer: {
        firstName: payload.customer.firstname,
        lastName: payload.customer.lastname,
        dateOfBirth: payload.customer.dateOfBirth,
      },
    });
    console.log(`[API Proxy] Contract created successfully!`);
    return res.status(200).json(data);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error("[API Proxy] Server connection failed:", error?.name || error);
    return res.status(timedOut ? 504 : 500).json({
      errorCodes: [timedOut ? "TIMEOUT" : "SERVER_ERROR"],
      message: timedOut
        ? "Die Verbindung zu Magicline hat zu lange gedauert. Bitte prüfe dein E-Mail-Postfach, bevor du es erneut versuchst."
        : "Internal server error",
    });
  } finally {
    inFlight.delete(email);
  }
}
