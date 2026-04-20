export default async function handler(req, res) {
  // CORS Headers
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { recaptchaToken, customerNumber, dateOfBirth, firstname, lastname } =
    req.body || {};

  try {
    const query = new URLSearchParams({ recaptchaToken }).toString();
    const targetUrl = `https://one-power-fitness-abensberg.api.sandbox.magicline.com/connect/v1/contracts?${query}`;

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        // HEADER KRUSIAL: Meniru Browser Webflow
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://one-power-fitness.webflow.io",
        Referer: "https://one-power-fitness.webflow.io/",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify({
        customerNumber: customerNumber ? String(customerNumber).trim() : "",
        dateOfBirth: dateOfBirth,
        firstname: firstname ? String(firstname).trim() : "",
        lastname: lastname ? String(lastname).trim() : "",
      }),
    });

    const responseText = await resp.text();

    // Kirim status dan body apa adanya dari Magicline
    res.setHeader("Content-Type", "application/json");
    return res.status(resp.status).send(responseText);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Proxy Error", error: error.message });
  }
}
