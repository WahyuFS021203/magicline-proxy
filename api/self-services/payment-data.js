export default async function handler(req, res) {
  const allowedOrigins = [
    "https://one-power-fitness.webflow.io",
    "https://www.one-power-fitness.de",
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "Parameter 'customerId' wajib diisi/disertakan di URL.",
    });
  }

  const baseUrl = "https://one-power-fitness.open-api.magicline.com";
  const url = `${baseUrl}/v1/customers/${customerId}/self-service/payment-data`;
  const apiKey = process.env.MAGICLINE_OPEN_API_KEY;

  try {
    let response;

    if (req.method === "GET") {
      console.log(
        `[API Proxy] GET: Fetching payment data for Customer ID: ${customerId}`,
      );

      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
      });
    } else if (req.method === "POST") {
      console.log(
        `[API Proxy] POST: Updating payment data for Customer ID: ${customerId}`,
      );

      const payload = req.body || {};

      if (!payload.accountHolder || !payload.iban) {
        return res.status(400).json({
          errorCodes: ["BAD_REQUEST"],
          message: "accountHolder dan iban wajib diisi.",
        });
      }

      response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });
    } else {
      return res.status(405).json({
        errorCodes: ["METHOD_NOT_ALLOWED"],
        message: "Gunakan metode GET atau POST.",
      });
    }

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
          "Gagal memproses data pembayaran di Magicline",
      });
    }

    // Jika berhasil
    console.log(`[API Proxy] Payment data processed successfully (GET/POST)!`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server crash:", error);
    return res.status(500).json({
      errorCodes: ["SERVER_ERROR"],
      message: "Internal server error",
    });
  }
}
