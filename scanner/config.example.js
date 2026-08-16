/**
 * Safe public scanner configuration example.
 *
 * Copy this shape for a gym-specific public config. Do not add schedules,
 * member data, admin identities, storage IDs, credentials, or secrets here.
 */
window.GYM_PUBLIC_CONFIG = Object.freeze({
  schemaVersion: 1,
  identity: {
    name: "Harbor Strength Club",
    shortName: "Harbor",
    locale: "en-GB",
    timezone: "Europe/Dublin",
  },
  branding: {
    logoUrl: "./assets/demo-harbor-logo.svg",
    iconUrl: "./assets/demo-harbor-icon.png",
    colors: {
      primary: "#174A5B",
      accent: "#F2B84B",
      background: "#0E2028",
      surface: "#FFFFFF",
    },
  },
  scanner: {
    texts: {
      readyTitle: "Scan your member card",
      readyInstruction: "Hold the QR code inside the frame",
      loadingTitle: "Checking you in",
      successTitle: "Welcome",
      duplicateTitle: "Already checked in",
      notFoundTitle: "Member not found",
      inactiveTitle: "Membership inactive",
      outsideWindowTitle: "Check-in is closed",
      errorTitle: "Unable to check in",
      timeoutTitle: "Connection timed out",
    },
    resetMs: {
      success: 15000,
      duplicate: 3500,
      error: 5000,
      outsideWindow: 5000,
    },
    behavior: {
      sound: true,
      vibration: true,
      preferredCamera: "environment",
    },
  },
  integration: {
    checkInEndpoint: "",
    scannerUrl: "",
  },
});
