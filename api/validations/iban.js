export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed. Use GET." });
  }

  // Tangkap parameter IBAN dari URL
  const { iban } = req.query;

  if (!iban) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "Parameter 'iban' wajib diisi.",
    });
  }

  try {
    console.log(`[API Proxy] Memvalidasi IBAN: ${iban}`);

    const baseUrl =
      "https://one-power-fitness-abensberg.open-api.sandbox.magicline.com";

    const url = `${baseUrl}/connect/v1/bankaccount?iban=${encodeURIComponent(iban)}`;

    const response = await fetch(url, {
      method: "GET",
    });

    // Proses respons dengan aman
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
        errorCodes: data.errorCodes || ["SERVER_ERROR"],
        message: data.message || "Gagal memvalidasi IBAN",
      });
    }

    console.log(
      `[API Proxy] IBAN Valid: ${data.validIban}. Bank: ${data.bankName || "Tidak diketahui"}`,
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server connection failed:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
