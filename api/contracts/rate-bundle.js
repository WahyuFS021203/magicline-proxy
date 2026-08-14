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

  const studioId = 1210012010;

  try {
    console.log(
      `[API Proxy] Fetching rate-bundles data for studioId: ${studioId}`,
    );

    const url = `https://one-power-fitness.api.magicline.com/connect/v1/rate-bundle?studioId=${studioId}`;

    const response = await fetch(url, {
      method: "GET",
      // headers: {
      //   Accept: "*/*",
      //   "x-api-key": process.env.MAGICLINE_OPEN_API_KEY,
      // },
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
        message: data.message || "Gagal mengambil data dari API Magicline",
      });
    }

    console.log(`[API Proxy] Successfully fetched rate-bundles data.`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server connection failed:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
