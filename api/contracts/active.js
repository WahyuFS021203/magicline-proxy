export default async function handler(req, res) {
  // 1. CORS Headers
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

  // Validasi Input
  if (!recaptchaToken || !firstname || !lastname || !dateOfBirth) {
    return res
      .status(400)
      .json({ message: "Data tidak lengkap dari frontend" });
  }

  try {
    const baseUrl =
      "https://one-power-fitness-abensberg.api.sandbox.magicline.com";
    const url = `${baseUrl}/connect/v1/contracts?recaptchaToken=${encodeURIComponent(recaptchaToken)}`;

    console.log(
      "Memanggil Magicline dengan API Key:",
      process.env.MAGICLINE_OPEN_API_KEY ? "TERSEDIA" : "KOSONG",
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        dateOfBirth: dateOfBirth,
        customerNumber: customerNumber ? customerNumber.trim() : "",
      }),
    });

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = {
        message: "Magicline tidak mengembalikan JSON",
        rawError: responseText,
      };
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Proxy Error Detail:", error.message);

    return res.status(500).json({
      message: "Koneksi ke Magicline gagal (Crash)",
      error: error.message,
    });
  }
}
