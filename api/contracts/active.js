export default async function handler(req, res) {
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
    return res
      .status(405)
      .json({ errorCodes: ["METHOD_NOT_ALLOWED"], message: "Gunakan POST." });
  }

  const clientIp =
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";

  const { recaptchaToken } = req.query;
  if (!recaptchaToken) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "recaptchaToken wajib diisi",
    });
  }

  const { firstname, lastname, dateOfBirth, customerNumber } = req.body || {};

  if (!firstname || !lastname || !dateOfBirth) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "firstname, lastname, dan dateOfBirth wajib diisi",
    });
  }

  try {
    const baseUrl =
      "https://one-power-fitness-abensberg.api.sandbox.magicline.com";
    const url = `${baseUrl}/connect/v1/contracts?recaptchaToken=${encodeURIComponent(recaptchaToken)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": process.env.MAGICLINE_OPEN_API_KEY,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        dateOfBirth: dateOfBirth,
        customerNumber: customerNumber ? customerNumber.trim() : "",
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

    if (!response.ok) {
      console.error(`[API Proxy] Magicline Error (${response.status}):`, data);
      return res.status(response.status).json({
        errorCodes: data.errorCodes || ["API_ERROR"],
        message: data.message || "Gagal mengambil data dari Magicline",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server crash:", error);
    return res.status(500).json({
      errorCodes: ["SERVER_ERROR"],
      message: "Koneksi ke server gagal",
    });
  }
}
