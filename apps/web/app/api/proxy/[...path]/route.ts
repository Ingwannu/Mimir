import { NextRequest, NextResponse } from "next/server";

import { getAdminProxyHeaders } from "../../../auth";

const API_BASE_URL = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";

async function handleProxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const targetPath = path.join("/");
  const targetUrl = `${API_BASE_URL}/${targetPath}${request.nextUrl.search}`;
  const headers = new Headers();
  const adminHeaders = await getAdminProxyHeaders();

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (targetPath.startsWith("v1/admin")) {
    const authorization = adminHeaders.get("authorization");

    if (!authorization) {
      return NextResponse.json(
        {
          message: "Admin login is required for this route.",
        },
        { status: 401 },
      );
    }

    headers.set("authorization", authorization);
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const requestInit: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (typeof body === "string") {
    requestInit.body = body;
  }

  const response = await fetch(targetUrl, requestInit);

  const responseText = await response.text();
  const proxyHeaders = new Headers();
  const responseContentType = response.headers.get("content-type");

  if (responseContentType) {
    proxyHeaders.set("content-type", responseContentType);
  }

  return new NextResponse(responseText, {
    status: response.status,
    headers: proxyHeaders,
  });
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleProxy(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleProxy(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleProxy(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleProxy(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleProxy(request, context);
}
