const LOCAL_PUBLIC_BASE_URL = "http://localhost:3000";

function normalizePublicBaseUrl(value: string): string {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("INBRIDGE_PUBLIC_URL must use http or https");
  }

  return parsed.origin;
}

export function resolvePublicBaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const configuredUrl = environment.INBRIDGE_PUBLIC_URL?.trim();
  if (configuredUrl) return normalizePublicBaseUrl(configuredUrl);

  const vercelProductionDomain = environment.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionDomain) return normalizePublicBaseUrl(vercelProductionDomain);

  const vercelDeploymentDomain = environment.VERCEL_URL?.trim();
  if (vercelDeploymentDomain) return normalizePublicBaseUrl(vercelDeploymentDomain);

  return LOCAL_PUBLIC_BASE_URL;
}
