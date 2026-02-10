import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { Platform } from "@prisma/client";

// GET - Check cookie status for a platform
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    const cookie = await prisma.platformCookie.findUnique({
      where: { platform: platform as Platform },
    });

    if (!cookie) {
      return NextResponse.json({
        platform,
        isValid: false,
        capturedAt: null,
        lastUsedAt: null,
        expiresAt: null,
      });
    }

    return NextResponse.json({
      platform: cookie.platform,
      isValid: cookie.isValid,
      capturedAt: cookie.capturedAt,
      lastUsedAt: cookie.lastUsedAt,
      lastValidatedAt: cookie.lastValidatedAt,
      expiresAt: cookie.expiresAt,
    });
  } catch (error) {
    console.error("Error fetching cookie status:", error);
    return NextResponse.json(
      { error: "Failed to fetch cookie status" },
      { status: 500 }
    );
  }
}

// POST - Save cookies for a platform
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const body = await request.json();

    const validPlatforms: Platform[] = [
      "BIZBUYSELL",
      "BIZQUEST",
      "DEALSTREAM",
      "TRANSWORLD",
      "LOOPNET",
      "BUSINESSBROKER",
    ];

    if (!validPlatforms.includes(platform as Platform)) {
      return NextResponse.json(
        { error: `Invalid platform: ${platform}` },
        { status: 400 }
      );
    }

    if (!body.cookies || !Array.isArray(body.cookies)) {
      return NextResponse.json(
        { error: "cookies array is required" },
        { status: 400 }
      );
    }

    // Encrypt the cookies
    const cookieJson = JSON.stringify(body.cookies);
    const encryptedData = encrypt(cookieJson);

    // Calculate expiry from cookie data (find the earliest expiry)
    const expiryTimes = body.cookies
      .filter((c: { expires?: number }) => c.expires && c.expires > 0)
      .map((c: { expires: number }) => new Date(c.expires * 1000));
    const earliestExpiry =
      expiryTimes.length > 0
        ? new Date(Math.min(...expiryTimes.map((d: Date) => d.getTime())))
        : null;

    // Upsert the cookie record
    const cookie = await prisma.platformCookie.upsert({
      where: { platform: platform as Platform },
      update: {
        cookieData: encryptedData,
        capturedAt: new Date(),
        expiresAt: earliestExpiry,
        isValid: true,
        lastValidatedAt: new Date(),
      },
      create: {
        platform: platform as Platform,
        cookieData: encryptedData,
        capturedAt: new Date(),
        expiresAt: earliestExpiry,
        isValid: true,
        lastValidatedAt: new Date(),
      },
    });

    return NextResponse.json({
      platform: cookie.platform,
      isValid: true,
      capturedAt: cookie.capturedAt,
      cookieCount: body.cookies.length,
    });
  } catch (error) {
    console.error("Error saving cookies:", error);
    return NextResponse.json(
      { error: "Failed to save cookies" },
      { status: 500 }
    );
  }
}

// DELETE - Clear cookies for a platform
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    await prisma.platformCookie.deleteMany({
      where: { platform: platform as Platform },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting cookies:", error);
    return NextResponse.json(
      { error: "Failed to delete cookies" },
      { status: 500 }
    );
  }
}
