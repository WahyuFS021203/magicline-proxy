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

  const studioId = 1210004670;

  try {
    console.log(
      `[API Proxy] Mengambil data rate-bundles untuk studioId: ${studioId}`,
    );

    const url = `https://one-power-fitness-abensberg.open-api.sandbox.magicline.com/connect/v1/rate-bundle?studioId=${studioId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "*/*",
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
        errorCodes: data.errorCodes || ["SERVER_ERROR"],
        message: data.message || "Gagal mengambil data dari API Magicline",
      });
    }

    console.log(`[API Proxy] Sukses mengambil data rate-bundles.`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server connection failed:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
