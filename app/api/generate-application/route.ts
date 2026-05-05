import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Fill the Nth FORMTEXT field (1-indexed) with a value.
// Word form fields have the structure:
//   <w:fldChar begin> ... <w:instrText> FORMTEXT </w:instrText> ... <w:fldChar separate/> [value runs] <w:fldChar end/>
// We replace the value runs (between separate and end) with a single run containing the new value.
function fillField(xml: string, targetIndex: number, value: string): string {
  const fieldRe = /<w:fldChar w:fldCharType="begin">[\s\S]*?<w:fldChar w:fldCharType="end"\/>/g;
  let count = 0;

  return xml.replace(fieldRe, (block) => {
    if (!block.includes(" FORMTEXT ")) return block; // skip checkboxes
    count++;
    if (count !== targetIndex) return block;

    // Locate the end of the separate run
    const sepTag = 'fldCharType="separate"/>';
    const sepPos = block.indexOf(sepTag);
    if (sepPos === -1) return block;
    const afterSepTag = sepPos + sepTag.length;
    const afterSepRun = block.indexOf("</w:r>", afterSepTag) + "</w:r>".length;

    // Locate the start of the run that contains the end fldChar
    const endFldPos = block.lastIndexOf('<w:fldChar w:fldCharType="end"/>');
    const lastRunStart = block.lastIndexOf("<w:r ", endFldPos);

    // Extract rPr styling from the value section so text matches the form's font
    const valueSection = block.substring(afterSepRun, lastRunStart);
    const rPrMatch = valueSection.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
    const rPr = rPrMatch ? `<w:rPr>${rPrMatch[1]}</w:rPr>` : "";

    const escaped = escapeXml(value || "");
    const newRun = value
      ? `<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r>`
      : "";

    return (
      block.substring(0, afterSepRun) +
      newRun +
      block.substring(lastRunStart)
    );
  });
}

function fmt(n: number): string {
  if (!n || isNaN(n)) return "";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, calc, decision, org } = body;

    // Locate the template file
    const templatePath = path.join(process.cwd(), "public", "Events_Application (7).docx");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Template file not found" }, { status: 404 });
    }

    const templateBuf = fs.readFileSync(templatePath);
    const zip = new PizZip(templateBuf);
    let xml = zip.file("word/document.xml")!.asText();

    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const dateRange = [event?.firstDay, event?.lastDay]
      .filter(Boolean)
      .map(fmtDate)
      .join(" – ");
    const venues = Array.isArray(event?.venues) ? event.venues.join("; ") : (event?.venues || "");
    const venueAddresses = Array.isArray(org?.venues)
      ? org.venues.filter((v: any) => v.address).map((v: any) => v.address).join("; ")
      : "";
    const marketArea = [org?.city, org?.state].filter(Boolean).join(", ");
    const numDays = Array.isArray(event?.calc?.days) ? event.calc.days.length : 0;
    const avgDailyAttendance = calc?.totalAttendance && numDays > 0
      ? Math.round(calc.totalAttendance / numDays).toString()
      : "";

    const rates = event?.calc?.rates || {};

    // Field map: index (1-based) → value
    // Based on the official ETF Application Form field order
    const fields: Record<number, string> = {
      1:  org?.name || "",                          // Applicant Name
      2:  org?.address || "",                       // Applicant Address
      3:  event?.name || "",                        // Event Name
      4:  dateRange,                                // Date(s) of Event
      5:  org?.city || "",                          // Event Location (City)
      6:  today,                                    // Date Application Submitted
      7:  org?.name || "",                          // Endorsing Municipality Name
      8:  org?.contactName || "",                   // Contact Name
      9:  org?.contactTitle || "",                  // Contact Title
      10: org?.contactEmail || "",                  // Contact Email
      11: org?.contactPhone || "",                  // Contact Phone
      // 12–16: LOC fields (blank — fill manually if applicable)
      17: event?.siteSelectionOrg || "",            // Site Selection Org Name
      // 18–21: SSO contact (blank)
      22: fmt(calc?.totalFund || decision?.estimate || 0), // Total Fund Requested
      23: fmt(calc?.stateTaxTotal || 0),            // State Share
      24: fmt(calc?.requiredLocalMatch || 0),       // Local Share
      // 25–26: MERP only (blank)
      27: event?.name || "",                        // Official Event Name
      28: "ETF",                                    // Fund type
      29: venues,                                   // Venue(s) of Event
      30: venueAddresses,                           // Venue(s) Address
      // 31: Event Website (blank)
      32: dateRange,                                // Date(s) of Primary Event
      // 33–43: previous years, other locations, fees — blank
      44: marketArea,                               // Desired Market Area
      45: dateRange,                                // Primary event days for attendance
      46: avgDailyAttendance,                       // Estimated Daily Average Attendance
      47: rates.foodBev ? `$${rates.foodBev}` : "",         // Food & Non-Alcoholic
      48: rates.entertainment ? `$${rates.entertainment}` : "", // Shopping & Entertainment
      49: rates.alcohol ? `$${rates.alcohol}` : "",          // Alcoholic Beverages
      50: rates.hotelRate ? `$${rates.hotelRate}` : "",       // Hotel
      51: rates.personsPerRoom ? String(rates.personsPerRoom) : "", // People per room
      52: rates.rentalCar ? `$${rates.rentalCar}` : "",       // Vehicle Rental
      53: rates.personsPerCar ? String(rates.personsPerCar) : "",  // People per vehicle
    };

    // Apply all field replacements
    for (const [idxStr, value] of Object.entries(fields)) {
      const idx = parseInt(idxStr);
      if (value) xml = fillField(xml, idx, value);
    }

    // Write modified XML back into ZIP
    zip.file("word/document.xml", xml);
    const output = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

    const filename = `ETF-Application-${(event?.name || "Event").replace(/[^a-z0-9]/gi, "-")}.docx`;

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("POST /api/generate-application error:", error);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}
