export default async function handler(req, res) {
  // 1. Tetap butuh CORS agar browser tidak memblokir response
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

  const { recaptchaToken, firstname, lastname, dateOfBirth, customerNumber } =
    req.body || {};

  try {
    const baseUrl =
      "https://one-power-fitness-abensberg.api.sandbox.magicline.com";
    const url = `${baseUrl}/connect/v1/contracts?recaptchaToken=${encodeURIComponent(recaptchaToken)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstname: firstname?.trim(),
        lastname: lastname?.trim(),
        dateOfBirth: dateOfBirth,
        customerNumber: customerNumber ? customerNumber.trim() : "",
      }),
    });

    const rawBody = await response.text();

    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    return res.status(response.status).send(rawBody);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Proxy Crash", message: error.message });
  }
}
