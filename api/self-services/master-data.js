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
    return res.status(405).json({
      errorCodes: ["METHOD_NOT_ALLOWED"],
      message: "Gunakan metode GET.",
    });
  }

  const { customerId } = req.query;

  if (!customerId) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "Parameter 'customerId' wajib diisi.",
    });
  }

  try {
    console.log(
      `[API Proxy] Mengambil Master Data untuk Customer ID: ${customerId}`,
    );

    const baseUrl =
      "https://one-power-fitness-abensberg.open-api.sandbox.magicline.com";
    const url = `${baseUrl}/v1/customers/${customerId}/self-service/master-data`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": process.env.MAGICLINE_OPEN_API_KEY,
      },
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
        message:
          data.message ||
          data.errorMessage ||
          "Gagal mengambil data profil dari Magicline",
      });
    }

    console.log(`[API Proxy] Master Data berhasil diambil!`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server crash:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
