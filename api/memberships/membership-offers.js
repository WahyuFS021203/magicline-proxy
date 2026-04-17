export default async function handler(req, res) {
  // Pengaturan CORS (Sesuai dengan domain Webflow Anda sebelumnya)
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

  try {
    console.log("[API Proxy] Fetching all membership offers...");

    // Gunakan URL Sandbox Magicline Anda
    const url =
      "https://one-power-fitness-abensberg.open-api.sandbox.magicline.com/v1/memberships/membership-offers";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": process.env.MAGICLINE_OPEN_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `[API Proxy] Magicline Error (${response.status}):`,
        data.errorMessage,
      );
      return res.status(response.status).json({
        error: data.errorMessage || "An error occurred from Magicline API",
        code: data.errorCode,
      });
    }

    console.log(
      `[API Proxy] Successfully retrieved ${data.length || "multiple"} membership offers.`,
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server connection failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
