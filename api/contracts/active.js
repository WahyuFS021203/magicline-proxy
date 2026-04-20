export default async function handler(req, res) {
  // 1. CORS Headers agar Webflow bisa memanggil proxy ini
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Gunakan POST" });
  }

  const { recaptchaToken, firstname, lastname, dateOfBirth, customerNumber } =
    req.body || {};

  if (!recaptchaToken || !firstname || !lastname || !dateOfBirth) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  try {
    const baseUrl =
      "https://one-power-fitness-abensberg.api.sandbox.magicline.com";
    const url = `${baseUrl}/connect/v1/contracts?recaptchaToken=${encodeURIComponent(recaptchaToken)}`;

    // Panggil Magicline tanpa x-api-key
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        dateOfBirth: dateOfBirth, // Format biasanya YYYY-MM-DD
        customerNumber: customerNumber ? customerNumber.trim() : "",
      }),
    });

    const responseText = await response.text();

    return res.status(response.status).send(responseText);
  } catch (error) {
    console.error("Proxy Error:", error.message);
    return res.status(500).json({
      message: "Koneksi ke Magicline gagal",
      error: error.message,
    });
  }
}
