import { Auth0Client } from "@auth0/nextjs-auth0/server";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing Auth0 env var at runtime: ${name}`);
    return "";
  }
  return value;
}

export function getAuth0() {
  return new Auth0Client({
    domain: required("AUTH0_DOMAIN"),
    clientId: required("AUTH0_CLIENT_ID"),
    clientSecret: required("AUTH0_CLIENT_SECRET"),
    secret: required("AUTH0_SECRET"),
    appBaseUrl: required("APP_BASE_URL"),
  });
}