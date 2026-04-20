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

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Gunakan POST" });

  const { recaptchaToken, firstname, lastname, dateOfBirth, customerNumber } =
    req.body || {};

  if (!recaptchaToken || !firstname || !lastname || !dateOfBirth) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  try {
    // Magicline tetap butuh token di URL, tapi ini dilakukan di SISI SERVER (Aman)
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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0",
      },
      body: JSON.stringify({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        dateOfBirth: dateOfBirth,
        customerNumber: customerNumber ? customerNumber.trim() : "",
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ message: "Koneksi ke Magicline gagal" });
  }
}
