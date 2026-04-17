export default async function handler(req, res) {
  // 1. Pengaturan CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    console.warn(`[API Proxy] Invalid method: ${req.method}`);
    return res
      .status(405)
      .json({ errorCodes: ["METHOD_NOT_ALLOWED"], message: "Gunakan POST." });
  }

  // 4. Ambil dan validasi reCAPTCHA Token dari URL Parameter
  const { recaptchaToken } = req.query;
  if (!recaptchaToken) {
    console.error("[API Proxy] Missing recaptchaToken");
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "recaptchaToken wajib diisi",
    });
  }

  // 5. Ambil data dari Body
  const { firstname, lastname, dateOfBirth, customerNumber } = req.body || {};

  if (!firstname || !lastname || !dateOfBirth) {
    console.error("[API Proxy] Missing required body fields");
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "firstname, lastname, dan dateOfBirth wajib diisi",
    });
  }

  try {
    console.log(`[API Proxy] Mencari kontrak untuk: ${firstname} ${lastname}`);

    const baseUrl =
      "https://one-power-fitness-abensberg.api.sandbox.magicline.com";
    const url = `${baseUrl}/connect/v1/contracts?recaptchaToken=${recaptchaToken}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        firstname,
        lastname,
        dateOfBirth,
        customerNumber,
      }),
    });

    const responseText = await response.text();
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { message: responseText };
      }
    }

    // 8. Cek jika terjadi error dari Magicline
    if (!response.ok) {
      console.error(`[API Proxy] Magicline Error (${response.status}):`, data);
      return res.status(response.status).json({
        errorCodes: data.errorCodes || ["API_ERROR"],
        message: data.message || "Gagal mengambil data dari Magicline",
      });
    }

    // 9. Berhasil!
    console.log(`[API Proxy] Kontrak berhasil ditemukan!`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server crash:", error);
    return res.status(500).json({
      errorCodes: ["SERVER_ERROR"],
      message: "Koneksi ke server gagal",
    });
  }
}
