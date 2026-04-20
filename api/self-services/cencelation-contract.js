export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://one-power-fitness.webflow.io",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      errorCodes: ["METHOD_NOT_ALLOWED"],
      message: "Gunakan metode GET atau POST.",
    });
  }

  // 4. Validasi parameter customerId
  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({
      errorCodes: ["BAD_REQUEST"],
      message: "Parameter 'customerId' wajib disertakan di URL.",
    });
  }

  const baseUrl =
    "https://one-power-fitness-abensberg.open-api.sandbox.magicline.com";
  const apiKey = process.env.MAGICLINE_OPEN_API_KEY;

  try {
    let response;

    if (req.method === "GET") {
      console.log(
        `[API Proxy] GET: Mengambil data kontrak untuk ID: ${customerId}`,
      );

      const getUrl = `${baseUrl}/v1/memberships/${customerId}/self-service/contract-data`;

      response = await fetch(getUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
      });
    } else if (req.method === "POST") {
      console.log(
        `[API Proxy] POST: Memproses pembatalan kontrak untuk ID: ${customerId}`,
      );

      const payload = req.body || {};

      if (
        !payload.cancelationDate ||
        !payload.cancelationReasonId ||
        !payload.contractId
      ) {
        return res.status(400).json({
          errorCodes: ["BAD_REQUEST"],
          message:
            "cancelationDate, cancelationReasonId, dan contractId wajib diisi.",
        });
      }

      const postUrl = `${baseUrl}/v1/memberships/${customerId}/self-service/ordinary-contract-cancelation`;

      response = await fetch(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });
    }

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
          "Gagal memproses data kontrak di Magicline",
      });
    }

    console.log(`[API Proxy] Kontrak berhasil diproses (${req.method})!`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server crash:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
