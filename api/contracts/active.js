export default async function handler(req, res) {
  // 1. Pengaturan CORS agar bisa diakses dari Webflow
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Gunakan POST" });
  }

  const { recaptchaToken, customerNumber, dateOfBirth, firstname, lastname } =
    req.body || {};

  try {
    const query = new URLSearchParams({
      recaptchaToken: recaptchaToken,
    }).toString();

    // URL Tenant Anda
    const tenantUrl =
      "https://one-power-fitness-abensberg.api.sandbox.magicline.com";
    const targetUrl = `${tenantUrl}/connect/v1/contracts?${query}`;

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      },
      body: JSON.stringify({
        customerNumber: customerNumber ? customerNumber.trim() : "",
        dateOfBirth: dateOfBirth,
        firstname: firstname ? firstname.trim() : "",
        lastname: lastname ? lastname.trim() : "",
      }),
    });

    const responseText = await resp.text();

    res.setHeader("Content-Type", "application/json");
    return res.status(resp.status).send(responseText);
  } catch (error) {
    console.error("Proxy Error:", error.message);
    return res.status(500).json({
      message: "Gagal terhubung ke API Magicline",
      error: error.message,
    });
  }
}
