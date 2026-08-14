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

  const baseUrl = "https://one-power-fitness.open-api.magicline.com";
  const apiKey = process.env.MAGICLINE_OPEN_API_KEY;

  const HARDCODED_APPOINTMENT_ID = "1210118450";

  try {
    let response;

    // ==========================================
    // METODE 1: GET (MENCARI SLOT KOSONG)
    // ==========================================
    if (req.method === "GET") {
      const { customerId, slotWindowStartDate, daysAhead = "1" } = req.query;

      console.log(
        `[API Proxy] GET: Mencari Slot ID: ${HARDCODED_APPOINTMENT_ID}, Tanggal: ${slotWindowStartDate || "Tidak ditentukan"}`,
      );

      const queryObj = {};

      if (customerId) queryObj.customerId = customerId;
      if (slotWindowStartDate)
        queryObj.slotWindowStartDate = slotWindowStartDate;
      if (daysAhead) queryObj.daysAhead = daysAhead;

      // Jadikan format URL string (contoh: ?daysAhead=1&slotWindowStartDate=2026-05-07)
      const queryParams = new URLSearchParams(queryObj).toString();

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

      console.log("[API Proxy] Raw payload received:", JSON.stringify(payload)); // ← tambahkan

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

      const bookingData = {
        customerId: Number(payload.customerId),
        bookableAppointmentId: payload.bookableAppointmentId
          ? Number(payload.bookableAppointmentId)
          : Number(HARDCODED_APPOINTMENT_ID),
        startDateTime: payload.startDateTime,
        endDateTime: payload.endDateTime,
        instructorIds:
          payload.instructorIds?.length > 0
            ? payload.instructorIds.map(Number)
            : [1210118510],
      };

      console.log(
        "[API Proxy] Booking data to Magicline:",
        JSON.stringify(bookingData),
      ); // ← tambahkan

      try {
        const postUrl = `${baseUrl}/v1/appointments/booking/book`;
        console.log("[API Proxy] Posting to:", postUrl); // ← tambahkan

        response = await fetch(postUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(bookingData),
        });
      } catch (fetchError) {
        console.error("[API Proxy] Fetch error:", fetchError); // ← tambahkan
        return res.status(500).json({
          errorCodes: ["FETCH_ERROR"],
          message: fetchError.message,
        });
      }
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
