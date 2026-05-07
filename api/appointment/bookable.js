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

  const baseUrl =
    "https://one-power-fitness-abensberg.open-api.sandbox.magicline.com";
  const apiKey = process.env.MAGICLINE_OPEN_API_KEY;

  const HARDCODED_APPOINTMENT_ID = "1210118450";

  try {
    let response;

    // ==========================================
    // METODE 1: GET (MENCARI SLOT KOSONG)
    // ==========================================
    if (req.method === "GET") {
      const { customerId, slotWindowStartDate, daysAhead = "1" } = req.query;

      if (!customerId || !slotWindowStartDate) {
        return res.status(400).json({
          errorCodes: ["BAD_REQUEST"],
          message:
            "Parameter 'customerId' dan 'slotWindowStartDate' wajib disertakan.",
        });
      }

      console.log(
        `[API Proxy] GET: Mencari Slot ID: ${HARDCODED_APPOINTMENT_ID}, Tanggal: ${slotWindowStartDate}`,
      );

      const queryParams = new URLSearchParams({
        customerId: customerId,
        daysAhead: daysAhead,
        slotWindowStartDate: slotWindowStartDate,
      }).toString();

      const getUrl = `${baseUrl}/v1/appointments/bookable/${HARDCODED_APPOINTMENT_ID}/slots?${queryParams}`;

      response = await fetch(getUrl, {
        method: "GET",
        headers: { Accept: "application/json", "x-api-key": apiKey },
      });
    }

    // ==========================================
    // METODE 2: POST (MELAKUKAN BOOKING)
    // ==========================================
    else if (req.method === "POST") {
      const payload = req.body || {};

      if (
        !payload.customerId ||
        !payload.startDateTime ||
        !payload.endDateTime
      ) {
        return res.status(400).json({
          errorCodes: ["BAD_REQUEST"],
          message:
            "Data booking tidak lengkap (customerId, startDateTime, endDateTime wajib diisi).",
        });
      }

      console.log(
        `[API Proxy] POST: Membooking Jadwal untuk Customer ID: ${payload.customerId}`,
      );

      const bookingData = {
        customerId: Number(payload.customerId),
        bookableAppointmentId: payload.bookableAppointmentId
          ? Number(payload.bookableAppointmentId)
          : Number(HARDCODED_APPOINTMENT_ID),
        startDateTime: payload.startDateTime,
        endDateTime: payload.endDateTime,
        instructorIds: payload.instructorIds || [],
      };

      const postUrl = `${baseUrl}/v1/appointments/booking/book`;

      response = await fetch(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(bookingData),
      });
    }

    // ==========================================
    // PARSING & RETURN RESPONSE
    // ==========================================
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
          `Gagal memproses ${req.method} jadwal`,
        details: data,
      });
    }

    console.log(`[API Proxy] Proses ${req.method} jadwal berhasil!`);
    return res.status(200).json(data);
  } catch (error) {
    console.error("[API Proxy] Server crash:", error);
    return res
      .status(500)
      .json({ errorCodes: ["SERVER_ERROR"], message: "Internal server error" });
  }
}
