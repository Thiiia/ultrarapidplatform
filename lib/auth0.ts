import { Auth0Client } from "@auth0/nextjs-auth0/server";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const auth0 = new Auth0Client({
  domain: required("AUTH0_DOMAIN"),
  clientId: required("AUTH0_CLIENT_ID"),
  clientSecret: required("AUTH0_CLIENT_SECRET"),
  secret: required("AUTH0_SECRET"),
  appBaseUrl: required("APP_BASE_URL"),
});