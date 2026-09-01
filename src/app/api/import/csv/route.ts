import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCsvText,
  validateCsvRows,
  importValidatedRows,
  generateSampleCsv,
} from "@/lib/csv-import";

export const dynamic = "force-dynamic";

export async function GET() {
  // Returns the sample CSV template
  const sample = generateSampleCsv();
  return new NextResponse(sample, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="recura_failed_payments_sample.csv"',
    },
  });
}

export async function POST(req: Request) {
  try {
    let csvText = "";
    let action: "preview" | "import" = "import";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        csvText = await file.text();
      }
      const act = formData.get("action") as string | null;
      if (act === "preview") action = "preview";
    } else {
      const body = await req.json().catch(() => ({}));
      csvText = body.csvText ?? "";
      if (body.action === "preview") action = "preview";
    }

    if (!csvText || typeof csvText !== "string" || csvText.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "CSV content is required. Please upload a .csv file or paste CSV text." },
        { status: 400 },
      );
    }

    const rawRows = parseCsvText(csvText);
    if (rawRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No data rows found in CSV. Please verify headers and content." },
        { status: 400 },
      );
    }

    const validation = validateCsvRows(rawRows);

    if (action === "preview") {
      return NextResponse.json({
        ok: true,
        action: "preview",
        validation,
      });
    }

    // Import action
    if (validation.validCount === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "All rows in the CSV contain validation errors. Please check the preview.",
          validation,
        },
        { status: 422 },
      );
    }

    const importResult = await importValidatedRows(prisma, validation.rows);

    return NextResponse.json({
      ok: true,
      action: "import",
      validation,
      result: importResult,
    });
  } catch (error: any) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to process CSV import." },
      { status: 500 },
    );
  }
}
