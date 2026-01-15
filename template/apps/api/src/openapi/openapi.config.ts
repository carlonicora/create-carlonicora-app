import { OpenApiOptions } from "@carlonicora/nestjs-neo4jsonapi";

export function getOpenApiConfig(): OpenApiOptions {
  const isDevelopment = process.env.NODE_ENV !== "production";

  return {
    enableSwagger: isDevelopment || process.env.ENABLE_SWAGGER === "true",
    swaggerPath: "/api-docs",
    enableRedoc: isDevelopment || process.env.ENABLE_REDOC === "true",
    redocPath: "/docs",
    entityDescriptors: [],
    title: "{{name}} API",
    description: "API documentation",
    version: process.env.npm_package_version || "1.0.0",
    bearerAuth: true,
    contactEmail: "api@example.com",
    license: "Proprietary",
    licenseUrl: "https://example.com/terms",
  };
}
