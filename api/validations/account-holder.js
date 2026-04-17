export default async function handler(req, res) {
  // Pengaturan CORS untuk Webflow
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  // Tangani preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Hanya izinkan method GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed. Use GET." });
  }

  // Tangkap parameter nama pemilik rekening dari URL
  const { accountHolder } = req.query;

  if (!accountHolder) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "Parameter 'accountHolder' wajib diisi.",
    });
  }

  try {
    console.log(
      `[API Proxy] Memvalidasi nama pemilik rekening: ${accountHolder}`,
    );

    // Gunakan URL Sandbox Magicline Anda
    // PENTING: Gunakan encodeURIComponent agar nama dengan spasi (misal "John Doe")
    // diubah menjadi format URL yang aman ("John%20Doe")
    const baseUrl =
      "https://one-power-fitness-abensberg.open-api.sandbox.magicline.com";
    const url = `${baseUrl}/connect/v1/bankaccount/validate/accountholder?accountHolder=${encodeURIComponent(accountHolder)}`;

    const response = await fetch(url, {
      method: "GET",
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
        errorCodes: data.errorCodes || ["SERVER_ERROR"],
        message: data.message || "Gagal memvalidasi nama pemilik rekening",
      });
    }

    console.log(
      `[API Proxy] Hasil validasi: ${data.valid ? "Valid" : "Tidak Valid"}`,
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server connection failed:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
