export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { dryRun = true, maxRecords = 5000 } = req.body || {};

  try {
    // Dynamic import to avoid breaking Node on start if service is TS
    let leadStatusService;
    try {
      const module = await import("../services/leadStatusService.js");
      leadStatusService = module.leadStatusService;
    } catch (e) {
      return res
        .status(501)
        .json({
          error:
            "Lead Status Sync Service unavailable on this host (TS/JS mismatch).",
        });
    }

    const result = await leadStatusService.syncAllContacts({
      dryRun,
      maxRecords,
    });
    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("Lead Status Sync Failed:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || String(err) });
  }
}
