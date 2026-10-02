import { Auth0Client } from "@auth0/nextjs-auth0/server";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAppBaseUrl() {
  if (process.env.VERCEL_ENV === "preview") {
    const previewBaseUrl =
      process.env.AUTH0_PREVIEW_APP_BASE_URL?.trim() ||
      process.env.VERCEL_BRANCH_URL?.trim() ||
      process.env.VERCEL_URL?.trim();

    if (!previewBaseUrl) {
      throw new Error(
        "Missing Preview base URL: set AUTH0_PREVIEW_APP_BASE_URL or deploy on Vercel.",
      );
    }

    const url = new URL(
      /^https?:\/\//i.test(previewBaseUrl)
        ? previewBaseUrl
        : `https://${previewBaseUrl}`,
    );

    if (url.protocol !== "https:") {
      throw new Error("Preview base URL must use HTTPS.");
    }

    return url.origin;
  }

  return requiredEnv("APP_BASE_URL");
}

export function getAuth0() {
  return new Auth0Client({
    domain: requiredEnv("AUTH0_DOMAIN"),
    clientId: requiredEnv("AUTH0_CLIENT_ID"),
    clientSecret: requiredEnv("AUTH0_CLIENT_SECRET"),
    secret: requiredEnv("AUTH0_SECRET"),
    appBaseUrl: getAppBaseUrl(),
  });
}
