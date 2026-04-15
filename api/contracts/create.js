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

  // Tangani preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  // Tangkap seluruh payload dari Webflow
  const payload = req.body || {};

  // Validasi Level 1 (Required Root Fields)
  if (!payload.contract || !payload.customer || !payload.studioId) {
    return res.status(400).json({
      error: "Missing required root fields",
      message: "'contract', 'customer', and 'studioId' objects are mandatory.",
    });
  }

  // Validasi Level 2 (Beberapa field required utama di dalam customer)
  const { customer, contract } = payload;
  if (
    !customer.firstname ||
    !customer.lastname ||
    !customer.email ||
    !customer.dateOfBirth
  ) {
    return res.status(400).json({
      error: "Missing required customer fields",
      message:
        "Customer must include firstname, lastname, email, and dateOfBirth.",
    });
  }

  try {
    console.log(
      `[API Proxy] Creating new contract for: ${customer.firstname} ${customer.lastname}`,
    );

    // Gunakan URL Sandbox Magicline Anda
    const url =
      "https://one-power-fitness-abensberg.open-api.sandbox.magicline.com/connect/v1/rate-bundle";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        "x-api-key": process.env.MAGICLINE_OPEN_API_KEY,
      },
      // Mengirimkan data persis seperti yang dikirim oleh Webflow
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `[API Proxy] Magicline Error (${response.status}):`,
        data.message,
      );
      return res.status(response.status).json({
        error: data.errorCodes || "MAGICLINE_API_ERROR",
        message:
          data.message || "An error occurred while creating the contract",
      });
    }

    console.log(`[API Proxy] Successfully created contract & customer!`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server connection failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
