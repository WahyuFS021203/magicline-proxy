export default async function handler(req, res) {
  // CORS setup for Webflow
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io/",
  );

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== "POST") {
    console.warn(`[API Proxy - Contracts] Invalid method: ${req.method}`);
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  // 1. Extract recaptchaToken from URL query
  const { recaptchaToken } = req.query;

  if (!recaptchaToken) {
    console.error(
      "[API Proxy - Contracts] Missing required query parameter: recaptchaToken",
    );
    return res
      .status(400)
      .json({ error: "recaptchaToken is required in the URL query" });
  }

  const { firstname, lastname, dateOfBirth, customerNumber } = req.body || {};

  // Validate required body fields based on documentation
  if (!firstname || !lastname || !dateOfBirth) {
    console.error("[API Proxy - Contracts] Missing required body fields");
    return res.status(400).json({
      error:
        "firstname, lastname, and dateOfBirth are required in the request body",
    });
  }

  try {
    console.log(
      `[API Proxy - Contracts] Fetching active contracts for: ${firstname} ${lastname}`,
    );

    const baseUrl = "https://openapi.magicline.com";
    const url = `${baseUrl}/connect/v1/contracts?recaptchaToken=${recaptchaToken}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": process.env.MAGICLINE_OPEN_API_KEY,
      },
      body: JSON.stringify({
        firstname,
        lastname,
        dateOfBirth,
        customerNumber, // Optional, will be undefined if not provided, which is fine
      }),
    });

    const data = await response.json();

    // Handle non-200 responses (403, 409, 500 as per docs)
    if (!response.ok) {
      console.error(
        `[API Proxy - Contracts] Magicline Error (${response.status}):`,
        data.message || "Unknown error",
      );
      return res.status(response.status).json({
        error: data.errorCodes || ["SERVER_ERROR"],
        message: "An error occurred while fetching contracts from Magicline",
      });
    }

    console.log(
      `[API Proxy - Contracts] Successfully retrieved contracts for: ${firstname} ${lastname}`,
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy - Contracts] Server connection failed:", error);
    return res
      .status(500)
      .json({ error: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
