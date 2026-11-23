/* Firebase web app config (public by design; access is enforced by firestore.rules).
   Clear apiKey to fall back to local demo mode, where data lives in this browser only. */
window.BRICK_FIREBASE = {
  apiKey: "AIzaSyDRVwaFehjPjga0QguLCykxq3R4HwB_Y7I",
  authDomain: "brickstack-queue.firebaseapp.com",
  projectId: "brickstack-queue",
  appId: "1:205235282892:web:526ca42bacec4c3c687369",
  /* App Check site key (Google Cloud Fraud Defense / reCAPTCHA Enterprise). Public by design. Empty string turns App Check off. */
  appCheckSiteKey: "6LeAty4uAAAAAJuLo5QZsUJ359YkeJi5ioxiLCAU"
};
