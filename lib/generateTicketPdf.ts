"use client";

import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import {
  generateTicketCode,
  parseSequenceNumber,
  formatRegistrationNumber,
  generateQrCodeDataUrl,
  buildTicketQrPayload,
} from "./ticket-utils";

export type TicketPayload = {
  registrationId?: string;
  ticket: {
    tokenHash: string;
    ticketNumber: string;
    issuedAt: string;
  };
  participant: {
    name: string;
    parish: string;
    diocese: string;
    affiliation?: string;
    college?: string;
    institute?: string;
    yearOfStudy?: string;
    gender: string;
    phone: string;
    email: string;
    dob: string;
  };
  event: {
    name: string;
    location: string;
  };
};

/** Helper to load an image element */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Downloads the ticket as a PDF document.
 * If `#digital-ticket-canvas` is rendered on screen, it captures it directly.
 * Otherwise, it constructs a temporary DOM element, captures it, and cleans up.
 */
export async function generateTicketPdf(payload: TicketPayload): Promise<boolean> {
  const { ticket, participant } = payload;
  const seqNum = parseSequenceNumber(ticket.ticketNumber);
  const formattedSeq = formatRegistrationNumber(seqNum);
  const ticketCodeObj = generateTicketCode(
    {
      id: payload.registrationId || ticket.tokenHash,
      affiliation: participant.affiliation,
      college: participant.college,
      institute: participant.institute,
    },
    seqNum,
    ticket.tokenHash
  );

  const safeName = participant.name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
  const fileName = `ORAH-2026_${safeName}_PASS-${formattedSeq}.pdf`;

  // 1. Check if the element already exists in the DOM
  const existingElement = document.getElementById("digital-ticket-canvas");
  if (existingElement) {
    return await captureAndSavePdf(existingElement, fileName);
  }

  // 2. If not yet mounted in DOM, dynamically create an offscreen ticket container
  let tempWrapper: HTMLDivElement | null = null;
  try {
    const qrContent = buildTicketQrPayload({
      ticketId: ticket.tokenHash,
      ticketCode: ticketCodeObj.code,
      registrationId: payload.registrationId,
      name: participant.name,
      college: participant.college,
    });
    const qrDataUrl = await generateQrCodeDataUrl(qrContent, "/jyLogo.png");

    tempWrapper = document.createElement("div");
    tempWrapper.style.position = "fixed";
    tempWrapper.style.left = "-9999px";
    tempWrapper.style.top = "-9999px";
    tempWrapper.style.width = "940px";
    tempWrapper.style.height = "300px";
    tempWrapper.style.zIndex = "-1000";

    const affiliation = participant.affiliation?.trim() || "College";
    let institutionText = "";
    if (affiliation === "College" && participant.college) {
      institutionText = participant.college;
    } else if (affiliation === "Institutes" && participant.institute) {
      institutionText = `${participant.institute} Institute`;
    } else if (affiliation && affiliation !== "College" && affiliation !== "Institutes") {
      institutionText = participant.parish ? `${affiliation} · ${participant.parish}` : affiliation;
    } else if (participant.college) {
      institutionText = participant.college;
    } else if (participant.parish) {
      institutionText = participant.parish;
    }

    const nameParts = participant.name.trim().split(/\s+/).filter(Boolean);
    const displayName = nameParts.length >= 3 ? nameParts.slice(0, 2).join(" ") : participant.name;

    tempWrapper.innerHTML = `
      <div id="temp-digital-ticket" style="position: relative; width: 940px; height: 300px; overflow: hidden; border-top-right-radius: 24px; border-bottom-right-radius: 24px; background-color: #E3E0D8; color: #111827; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex;">
        <div style="position: relative; height: 300px; width: 300px; overflow: hidden; background-color: #12131C; flex-shrink: 0;">
          <img src="/ticketBanner.jpeg" alt="ORAH 2K26" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 22px 28px; position: relative; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <p style="margin: 0; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: #374151;">LET'S GATHER AT...</p>
              <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280;">Youth Gathering</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 12px; font-weight: 900; color: #111827;">St Thomas College</p>
              <p style="margin: 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280;">Pala, Kottayam</p>
            </div>
          </div>
          <div style="margin: auto 0; padding: 4px 0;">
            <h2 style="margin: 0; font-size: 32px; font-weight: 900; color: #111827; letter-spacing: -0.02em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px;">${displayName}</h2>
            ${institutionText ? `<p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #374151; line-height: 1.3; max-width: 380px;">${institutionText}</p>` : ""}
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="padding: 5px 14px; border-radius: 9999px; border: 2px solid #111827; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">SEP 19</div>
            <div style="padding: 5px 14px; border-radius: 9999px; border: 2px solid #111827; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">5:00 PM</div>
            <div style="padding: 5px 14px; border-radius: 9999px; border: 2px solid #111827; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">PASS #${formattedSeq}</div>
          </div>
        </div>
        <div style="position: relative; width: 0; display: flex; flex-direction: column; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #03090d; margin-top: -12px; z-index: 20;"></div>
          <div style="width: 0; flex: 1; border-right: 2px dashed #9ca3af; margin: 4px 0; z-index: 10;"></div>
          <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #03090d; margin-bottom: -12px; z-index: 20;"></div>
        </div>
        <div style="width: 240px; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background-color: #DCD9D0; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 8px; height: 100%; flex-shrink: 0;">
            <svg style="height: 100%; width: 20px; color: #111827;" viewBox="0 0 26 160" preserveAspectRatio="none">
              <rect x="0" y="0" width="2.5" height="160" fill="currentColor" />
              <rect x="4" y="0" width="1.2" height="160" fill="currentColor" />
              <rect x="6.5" y="0" width="3" height="160" fill="currentColor" />
              <rect x="11" y="0" width="1.5" height="160" fill="currentColor" />
              <rect x="14" y="0" width="1.2" height="160" fill="currentColor" />
              <rect x="16.5" y="0" width="3.5" height="160" fill="currentColor" />
              <rect x="21.5" y="0" width="1.8" height="160" fill="currentColor" />
              <rect x="24.5" y="0" width="1.2" height="160" fill="currentColor" />
            </svg>
            <div style="display: flex; align-items: center; justify-content: center; writing-mode: vertical-lr; transform: rotate(180deg);">
              <span style="font-size: 8.5px; font-family: monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #4b5563; white-space: nowrap;">
                ${ticketCodeObj.code}
              </span>
            </div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 100%; padding-left: 8px;">
            <p style="margin: 0; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.16em; color: #1f2937;">ENTRY PASS</p>
            <div style="width: 135px; height: 135px; background: #ffffff; padding: 6px; border-radius: 16px; border: 1px solid #d1d5db; display: flex; align-items: center; justify-content: center;">
              <img src="${qrDataUrl}" alt="QR" style="width: 100%; height: 100%; object-fit: contain;" />
            </div>
            <span style="padding: 2px 10px; border-radius: 9999px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; background: rgba(229, 231, 235, 0.9); border: 1px solid #cbd5e1;">
              SCAN AT EVENT
            </span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(tempWrapper);

    const targetEl = document.getElementById("temp-digital-ticket") || tempWrapper;
    return await captureAndSavePdf(targetEl, fileName);
  } catch (err) {
    console.error("[generateTicketPdf] Error:", err);
    return false;
  } finally {
    if (tempWrapper && tempWrapper.parentNode) {
      tempWrapper.parentNode.removeChild(tempWrapper);
    }
  }
}

/**
 * Downloads the ticket as a high-resolution PNG image.
 */
export async function generateTicketImage(payload: TicketPayload): Promise<boolean> {
  const seqNum = parseSequenceNumber(payload.ticket.ticketNumber);
  const formattedSeq = formatRegistrationNumber(seqNum);
  const safeName = payload.participant.name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
  const fileName = `ORAH-2026_${safeName}_PASS-${formattedSeq}.png`;

  const existingElement = document.getElementById("digital-ticket-canvas");
  if (!existingElement) {
    console.error("[generateTicketImage] Element #digital-ticket-canvas not found.");
    return false;
  }

  try {
    const dataUrl = await toPng(existingElement, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#e3e0d8",
    });

    const a = document.createElement("a");
    a.download = fileName;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.error("[generateTicketImage] Failed to generate PNG ticket:", err);
    return false;
  }
}

/**
 * Helper to capture a DOM node and save it as a landscape PDF ticket.
 */
async function captureAndSavePdf(element: HTMLElement, fileName: string): Promise<boolean> {
  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#e3e0d8",
    });

    const img = await loadImage(dataUrl);
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    const isLandscape = imgW >= imgH;
    const pdfW = isLandscape ? 210 : 100;
    const pdfH = Math.round((imgH * pdfW) / imgW);

    const pdf = new jsPDF({
      orientation: isLandscape ? "landscape" : "portrait",
      unit: "mm",
      format: [pdfW, pdfH],
    });

    pdf.addImage(dataUrl, "PNG", 0, 0, pdfW, pdfH, undefined, "FAST");
    pdf.save(fileName);
    return true;
  } catch (err) {
    console.error("[generateTicketPdf] captureAndSavePdf failed:", err);
    return false;
  }
}