"use server";

import { cookies } from "next/headers";
import zlib from "zlib";

export async function updateToken(params: {
  token?: string;
  refreshToken?: string;
  userId?: string;
  companyId?: string;
  licenseExpirationDate?: Date;
  roles?: string[];
  features?: string[];
  modules?: {
    id: string;
    permissions: {
      create: boolean | string;
      read: boolean | string;
      update: boolean | string;
      delete: boolean | string;
    };
  }[];
}): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";

  if (params.token)
    (await cookies()).set({
      name: "token",
      value: params.token,
      httpOnly: false,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
  if (params.refreshToken)
    (await cookies()).set({
      name: "refreshToken",
      value: params.refreshToken,
      httpOnly: true,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });

  if (params.userId)
    (await cookies()).set({
      name: "userId",
      value: params.userId,
      httpOnly: true,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });

  if (params.companyId)
    (await cookies()).set({
      name: "companyId",
      value: params.companyId,
      httpOnly: true,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });

  if (params.licenseExpirationDate)
    (await cookies()).set({
      name: "licenseExpirationDate",
      value: params.licenseExpirationDate.toISOString(),
      httpOnly: true,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });

  if (params.roles)
    (await cookies()).set({
      name: "roles",
      value: JSON.stringify(params.roles),
      httpOnly: true,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });

  if (params.features)
    (await cookies()).set({
      name: "features",
      value: JSON.stringify(params.features),
      httpOnly: true,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });

  if (params.modules) {
    const compressedValue = zlib.gzipSync(JSON.stringify(params.modules)).toString("base64");

    (await cookies()).set({
      name: "modules",
      value: JSON.stringify(compressedValue),
      httpOnly: true,
      path: "/",
      secure: isProduction,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    });
  }
}

export async function removeToken(): Promise<void> {
  (await cookies()).delete({
    name: "token",
  });
  (await cookies()).delete({
    name: "refreshToken",
  });
  (await cookies()).delete({
    name: "userId",
  });
  (await cookies()).delete({
    name: "companyId",
  });
  (await cookies()).delete({
    name: "licenseExpirationDate",
  });
  (await cookies()).delete({
    name: "roles",
  });
  (await cookies()).delete({
    name: "features",
  });
  (await cookies()).delete({
    name: "modules",
  });
}
