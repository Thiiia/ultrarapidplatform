import { Auth0Client } from "@auth0/nextjs-auth0/server";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAuth0() {
  return new Auth0Client({
    domain: requiredEnv("AUTH0_DOMAIN"),
    clientId: requiredEnv("AUTH0_CLIENT_ID"),
    clientSecret: requiredEnv("AUTH0_CLIENT_SECRET"),
    secret: requiredEnv("AUTH0_SECRET"),
    appBaseUrl: requiredEnv("APP_BASE_URL"),
  });
}