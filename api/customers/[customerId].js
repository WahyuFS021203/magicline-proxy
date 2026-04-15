export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://domain-webflow-anda.com",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Karena nama file Anda adalah [customerId].js,
  // Vercel otomatis mengambil nilai dari URL path ke sini:
  const { customerId } = req.query;

  if (!customerId) {
    console.error("[API Proxy] Missing required parameter: customerId");
    return res
      .status(400)
      .json({ error: "Customer ID is required in the URL path" });
  }

  try {
    console.log(
      `[API Proxy] Fetching Magicline data for customer ID: ${customerId}`,
    );

    const url = `https://one-power-fitness-abensberg.open-api.sandbox.magicline.com/v1/customers/${customerId}`;

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
        `[API Proxy] Magicline API Error (${response.status}):`,
        data.errorMessage,
      );
      return res.status(response.status).json({
        error: data.errorMessage || "An error occurred from Magicline API",
        code: data.errorCode,
      });
    }

    console.log(
      `[API Proxy] Successfully retrieved data for customer ID: ${customerId}`,
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server connection failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
