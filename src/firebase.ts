import { initializeApp } from "firebase/app";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { fetchAndActivate, getRemoteConfig, getValue } from "firebase/remote-config";

export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
});

// Each private test install generates its own token for the project owner to register.
// Chrome extension pages cannot run the remote reCAPTCHA Enterprise script.
if (import.meta.env.MODE === "judge" || import.meta.env.MODE === "development") {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

initializeAppCheck(firebaseApp, {
  provider: new CustomProvider({
    getToken: () => Promise.reject(new Error("No production App Check provider is configured yet.")),
  }),
  isTokenAutoRefreshEnabled: true,
});

export const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// Remote Config lets us tune the product without shipping a new extension.
const remoteConfig = getRemoteConfig(firebaseApp);
remoteConfig.defaultConfig = {
  cloud_model: "gemini-3.8-flash",
  auto_screen: true,
  max_page_chars: 12000,
};

export async function loadRemoteConfig(): Promise<void> {
  try {
    await fetchAndActivate(remoteConfig);
  } catch (err) {
    console.warn("Scam Shield: using default settings, Remote Config fetch failed", err);
  }
}

export const settings = {
  cloudModel: () => getValue(remoteConfig, "cloud_model").asString(),
  autoScreen: () => getValue(remoteConfig, "auto_screen").asBoolean(),
  maxPageChars: () => getValue(remoteConfig, "max_page_chars").asNumber(),
};
