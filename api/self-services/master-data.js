export default async function handler(req, res) {
  // 1. Pengaturan CORS (Izinkan GET dan POST)
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  // 2. Tangani Preflight Request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 3. Pastikan hanya GET atau POST yang diizinkan
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      errorCodes: ["METHOD_NOT_ALLOWED"],
      message: "Gunakan metode GET atau POST.",
    });
  }

  // 4. Validasi parameter customerId
  const { customerId } = req.query;

  if (!customerId) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "Parameter 'customerId' wajib disertakan di URL.",
    });
  }

  // Pengaturan URL Magicline
  const baseUrl = "https://one-power-fitness.open-api.magicline.com";
  const url = `${baseUrl}/v1/customers/${customerId}/self-service/master-data`;
  const apiKey = process.env.MAGICLINE_OPEN_API_KEY;

  try {
    let response; // Variabel penampung respons

    // ==========================================
    // METODE 1: JIKA WEBFLOW MEMINTA DATA (GET)
    // ==========================================
    if (req.method === "GET") {
      console.log(
        `[API Proxy] GET: Fetching master data for Customer ID: ${customerId}`,
      );

      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
      });
    }
    // ==========================================
    // METODE 2: JIKA WEBFLOW MENGIRIM DATA (POST)
    // ==========================================
    else if (req.method === "POST") {
      console.log(
        `[API Proxy] POST: Updating master data for Customer ID: ${customerId}`,
      );

      const payload = req.body || {};

      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });
    }

    // ==========================================
    // PARSING & RETURN RESPONSE (BERLAKU UNTUK KEDUA METODE)
    // ==========================================
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
      console.error(`[API Proxy] Magicline Error (${response.status}):`, data);
      return res.status(response.status).json({
        errorCodes: data.errorCodes || ["API_ERROR"],
        message:
          data.message ||
          data.errorMessage ||
          "Gagal memproses data profil di Magicline",
      });
    }

    console.log(
      `[API Proxy] Master data processed successfully (${req.method})!`,
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server crash:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
