"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, AlertCircle, Download, FileDown, Image as ImageIcon } from "lucide-react";
import { generateTicketPdf, generateTicketImage, type TicketPayload } from "@/lib/generateTicketPdf";
import DigitalTicket from "@/components/DigitalTicket";
import SubmittingModal from "@/components/SubmittingModal";
import { generateTicketCode, parseSequenceNumber, formatRegistrationNumber } from "@/lib/ticket-utils";

type FormData = {
  name: string;
  dob: string;
  phone: string;
  email: string;
  gender: string;
  affiliation: string;
  affiliationOther: string;
  college: string;
  collegeOther: string;
  institute: string;
  instituteOther: string;
  yearOfStudy: string;
  yearOfStudyOther: string;
  parish: string;
  diocese: string;
  address: string;
  confirmed: boolean;
};

type FormErrors = Partial<Record<keyof FormData, string>>;
type FormTouched = Partial<Record<keyof FormData, boolean>>;

type SubmitError =
  | { kind: "message"; text: string }
  | { kind: "fields"; items: string[] };

const FIELD_LABELS: Record<string, string> = {
  name: "Full Name",
  dob: "Date of Birth",
  phone: "Phone Number",
  email: "Email Address",
  gender: "Gender",
  affiliation: "Affiliation",
  affiliationOther: "Affiliation Specification",
  college: "College",
  collegeOther: "College Specification",
  institute: "Institute",
  instituteOther: "Institute Specification",
  yearOfStudy: "Year of Study",
  yearOfStudyOther: "Year of Study Specification",
  parish: "Parish",
  diocese: "Diocese",
  address: "Address",
  confirmed: "Confirmation checkbox",
};

const AFFILIATION_OPTIONS = [
  { value: "+2 Passout", label: "+2 Passout" },
  { value: "College", label: "College" },
  { value: "Institutes", label: "Institutes" },
  { value: "Job Seeking", label: "Job Seeking" },
  { value: "Employed", label: "Employed" },
  { value: "Other", label: "Other" },
];

const COLLEGE_OPTIONS = [
  { value: "St Joseph's College of Engineering and Technology, Choondacherry", label: "St Joseph's College of Engineering and Technology, Choondacherry" },
  { value: "St Joseph's Institute of Hotel Management and Catering Technology, Choondacherry", label: "St Joseph's Institute of Hotel Management and Catering Technology, Choondacherry" },
  { value: "Alphonsa College, Pala", label: "Alphonsa College, Pala" },
  { value: "Devamatha College, Kuravilangad", label: "Devamatha College, Kuravilangad" },
  { value: "St Thomas College, Pala", label: "St Thomas College, Pala" },
  { value: "St Joseph's College, Moolamattom", label: "St Joseph's College, Moolamattom" },
  { value: "St George's College, Aruvithura", label: "St George's College, Aruvithura" },
  { value: "St Stephen's College, Uzhavoor", label: "St Stephen's College, Uzhavoor" },
  { value: "Bishop Vayalil Memorial Holy Cross College, Cherpunkal", label: "Bishop Vayalil Memorial Holy Cross College, Cherpunkal" },
  { value: "Mar Augusthinose College, Ramapuram", label: "Mar Augusthinose College, Ramapuram" },
  { value: "Other", label: "Other" },
];

const INSTITUTE_OPTIONS = [
  { value: "IELTS", label: "IELTS" },
  { value: "German", label: "German" },
  { value: "SSC", label: "SSC" },
  { value: "Other", label: "Other" },
];

const YEAR_OF_STUDY_OPTIONS = [
  { value: "UG - 1st Year", label: "UG — 1st Year" },
  { value: "UG - 2nd Year", label: "UG — 2nd Year" },
  { value: "UG - 3rd Year", label: "UG — 3rd Year" },
  { value: "UG - 4th Year", label: "UG — 4th Year" },
  { value: "PG - 1st Year", label: "PG — 1st Year" },
  { value: "PG - 2nd Year", label: "PG — 2nd Year" },
  { value: "Other", label: "Other" },
];

export default function RegistrationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [ticketData, setTicketData] = useState<TicketPayload | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    dob: "",
    phone: "",
    email: "",
    gender: "",
    affiliation: "",
    affiliationOther: "",
    college: "",
    collegeOther: "",
    institute: "",
    instituteOther: "",
    yearOfStudy: "",
    yearOfStudyOther: "",
    parish: "",
    diocese: "",
    address: "",
    confirmed: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});

  // ─── Sanitizer ─────────────────────────────────────────────────────────────
  // Strips HTML tags and trims whitespace to prevent XSS payloads from being
  // stored in state or sent to the server.
  const sanitize = (value: string): string =>
    value.replace(/<[^>]*>/g, "");

  // ─── Field Validators ───────────────────────────────────────────────────────
  const validateField = (name: keyof FormData, value: string | boolean): string => {
    // Non-checkbox empty check
    if (typeof value === "string" && value.trim() === "") {
      if (name === "confirmed") return "";
      return "This field is required.";
    }

    switch (name) {
      // ── Name fields: letters, spaces, hyphens, apostrophes only; 2-120 chars ──
      case "name": {
        const v = value as string;
        if (v.trim().length < 2) return "Name must be at least 2 characters.";
        if (v.length > 120) return "Name must not exceed 120 characters.";
        if (!/^[A-Za-z\s\-'.]+$/.test(v))
          return "Name must contain only letters, spaces, hyphens, or apostrophes.";
        return "";
      }

      // ── Email: RFC-style check + max length ────────────────────────────────
      case "email": {
        const v = (value as string).trim();
        if (v.length > 255) return "Email must not exceed 255 characters.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
          return "Enter a valid email address.";
        return "";
      }

      // ── Phone numbers: must contain exactly 10 digits (after stripping formatting) ──
      case "phone": {
        const v = value as string;
        const digits = v.replace(/\D/g, "");
        if (digits.length < 10) return "Phone number must have at least 10 digits.";
        if (digits.length > 15) return "Phone number must not exceed 15 digits.";
        // Allow: +, digits, spaces, hyphens only
        if (!/^\+?[\d\s\-]+$/.test(v)) return "Enter a valid phone number.";
        return "";
      }

      // ── Date of birth: strict parse, year range 1995-2015 ─────────────────
      case "dob": {
        const v = value as string;
        // Must match YYYY-MM-DD format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Enter a valid date (YYYY-MM-DD).";
        const parsed = new Date(v);
        if (isNaN(parsed.getTime())) return "Enter a valid date.";
        const year = parsed.getUTCFullYear();
        const month = parsed.getUTCMonth() + 1;
        const day = parsed.getUTCDate();
        // Guard against JS date overflow (e.g. Feb 30 silently becomes Mar 2)
        const [, mm, dd] = v.split("-").map(Number);
        if (month !== mm || day !== dd) return "Enter a valid calendar date.";
        if (year <= 1999 || year >= 2009)
          return "Date of birth must be between 1999 and 2009.";
        return "";
      }

      // ── Affiliation: must be one of allowed options ───────────────────────
      case "affiliation": {
        const allowed = ["+2 Passout", "College", "Institutes", "Job Seeking", "Employed", "Other"];
        if (!allowed.includes(value as string))
          return "Please select a valid affiliation.";
        return "";
      }

      // ── affiliationOther: required when affiliation === "Other" ────────────
      case "affiliationOther": {
        const v = (value as string).trim();
        if (v.length < 2) return "Please specify your affiliation (min. 2 characters).";
        if (v.length > 100) return "Must not exceed 100 characters.";
        if (!/^[A-Za-z0-9\s\-'.,()]+$/.test(v))
          return "Contains invalid characters.";
        return "";
      }

      // ── College: required when affiliation === "College" ───────────────────
      case "college": {
        const allowed = [
          "St Joseph's College of Engineering and Technology, Choondacherry",
          "St Joseph's Institute of Hotel Management and Catering Technology, Choondacherry",
          "Alphonsa College, Pala",
          "Devamatha College, Kuravilangad",
          "St Thomas College, Pala",
          "St Joseph's College, Moolamattom",
          "St George's College, Aruvithura",
          "St Stephen's College, Uzhavoor",
          "Bishop Vayalil Memorial Holy Cross College, Cherpunkal",
          "Mar Augusthinose College, Ramapuram",
          "Other"
        ];
        if (!allowed.includes(value as string))
          return "Please select a valid college.";
        return "";
      }

      // ── collegeOther: required when college === "Other" ──────────────────────
      case "collegeOther": {
        const v = (value as string).trim();
        if (v.length < 2) return "Please specify the college (min. 2 characters).";
        if (v.length > 100) return "Must not exceed 100 characters.";
        if (!/^[A-Za-z0-9\s\-'.,()]+$/.test(v))
          return "Contains invalid characters.";
        return "";
      }

      // ── Institute: required when affiliation === "Institutes" ──────────────
      case "institute": {
        const allowed = ["IELTS", "German", "SSC", "Other"];
        if (!allowed.includes(value as string))
          return "Please select a valid institute.";
        return "";
      }

      // ── instituteOther: required when institute === "Other" ─────────────────
      case "instituteOther": {
        const v = (value as string).trim();
        if (v.length < 2) return "Please specify the institute (min. 2 characters).";
        if (v.length > 100) return "Must not exceed 100 characters.";
        if (!/^[A-Za-z0-9\s\-'.,()]+$/.test(v))
          return "Contains invalid characters.";
        return "";
      }

      // ── Year of Study: required when affiliation === "College" ─────────────
      case "yearOfStudy": {
        const allowed = [
          "UG - 1st Year", "UG - 2nd Year", "UG - 3rd Year", "UG - 4th Year",
          "PG - 1st Year", "PG - 2nd Year", "Other",
        ];
        if (!allowed.includes(value as string))
          return "Please select a valid year of study.";
        return "";
      }

      // ── yearOfStudyOther: required when yearOfStudy === "Other" ──────────────
      case "yearOfStudyOther": {
        const v = (value as string).trim();
        if (v.length < 2) return "Please specify your year of study (min. 2 characters).";
        if (v.length > 100) return "Must not exceed 100 characters.";
        if (!/^[A-Za-z0-9\s\-.()/]+$/.test(v))
          return "Contains invalid characters.";
        return "";
      }

      // ── Parish: min 2 chars, letters + common punctuation ──────────────────
      case "parish": {
        const v = value as string;
        if (v.trim().length < 2) return "Parish name must be at least 2 characters.";
        if (v.length > 200) return "Parish name must not exceed 200 characters.";
        if (!/^[A-Za-z0-9\s\-'.,()]+$/.test(v))
          return "Parish name contains invalid characters.";
        return "";
      }

      // ── Diocese: same rules as parish ──────────────────────────────────────
      case "diocese": {
        const v = value as string;
        if (v.trim().length < 2) return "Diocese name must be at least 2 characters.";
        if (v.length > 200) return "Diocese name must not exceed 200 characters.";
        if (!/^[A-Za-z0-9\s\-'.,()]+$/.test(v))
          return "Diocese name contains invalid characters.";
        return "";
      }

      // ── Address ────────────────────────────────────────────────────────────
      case "address": {
        const v = value as string;
        if (v.trim().length < 10) return "Address must be at least 10 characters.";
        if (v.length > 200) return "Address must not exceed 200 characters.";
        return "";
      }

      // ── Confirmation checkbox ───────────────────────────────────────────────
      case "confirmed":
        return value === true ? "" : "You must confirm to proceed.";

      default:
        return "";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === "checkbox";
    // Sanitize text inputs to strip HTML injection attempts
    const val = isCheckbox
      ? (e.target as HTMLInputElement).checked
      : sanitize(value);

    setFormData((prev) => {
      const next = { ...prev, [name]: val };
      if (name === "affiliation") {
        if (val !== "Other") next.affiliationOther = "";
        if (val !== "College") {
          next.college = "";
          next.collegeOther = "";
          next.yearOfStudy = "";
          next.yearOfStudyOther = "";
        }
        if (val !== "Institutes") {
          next.institute = "";
          next.instituteOther = "";
        }
      }
      if (name === "college") {
        if (val !== "Other") next.collegeOther = "";
        if (!val) {
          next.yearOfStudy = "";
          next.yearOfStudyOther = "";
        }
      }
      if (name === "institute" && val !== "Other") {
        next.instituteOther = "";
      }
      if (name === "yearOfStudy" && val !== "Other") {
        next.yearOfStudyOther = "";
      }
      return next;
    });
    // Clear server-side error whenever user edits the form
    if (submitError) setSubmitError(null);

    if (touched[name as keyof FormData]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateField(name as keyof FormData, val),
      }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === "checkbox";
    const val = isCheckbox ? (e.target as HTMLInputElement).checked : value;

    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name as keyof FormData, val),
    }));
  };

  const validateForm = () => {
    const requiredFields: (keyof FormData)[] = [
      "name",
      "dob",
      "phone",
      "email",
      "gender",
      "affiliation",
      "parish",
      "diocese",
      "address",
      "confirmed",
    ];

    if (formData.affiliation === "Other") {
      requiredFields.push("affiliationOther");
    }
    if (formData.affiliation === "College") {
      requiredFields.push("college");
      if (formData.college === "Other") {
        requiredFields.push("collegeOther");
      }
      requiredFields.push("yearOfStudy");
      if (formData.yearOfStudy === "Other") {
        requiredFields.push("yearOfStudyOther");
      }
    }
    if (formData.affiliation === "Institutes") {
      requiredFields.push("institute");
      if (formData.institute === "Other") {
        requiredFields.push("instituteOther");
      }
    }

    const newErrors: FormErrors = {};
    let isValid = true;

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    if (!isValid) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      const newTouched = requiredFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
      setTouched((prev) => ({ ...prev, ...newTouched }));
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      window.alert("Please fix the highlighted errors before submitting.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Transition to ticket-download loading state
        setIsLoading(false);
        setIsDownloading(true);

        // Store ticket data for the re-download button on the success screen
        const payload = result as TicketPayload;
        setTicketData(payload);

        // Generate and download the PDF ticket
        try {
          await generateTicketPdf(payload);
        } catch (pdfErr) {
          console.error("[ticket] PDF generation error:", pdfErr);
          // Non-fatal: still show success even if PDF fails
        }

        setIsDownloading(false);
        setSubmitted(true);
        return;
      }

      // Map known error codes to user-friendly messages
      if (result.code === "DUPLICATE_EMAIL") {
        setSubmitError({ kind: "message", text: "This email address is already registered for this event." });
      } else if (result.code === "EVENT_CLOSED") {
        setSubmitError({ kind: "message", text: "Registrations are currently closed. Please check back later." });
      } else if (result.code === "EVENT_FULL") {
        setSubmitError({ kind: "message", text: "Registrations are full. No more spots are available." });
      } else if (response.status === 400 && result.fieldErrors) {
        const items = Object.entries(result.fieldErrors as Record<string, string[]>).map(
          ([field, msgs]) =>
            `${FIELD_LABELS[field] ?? field}: ${(msgs as string[]).join(", ")}`
        );
        setSubmitError({ kind: "fields", items });
      } else {
        setSubmitError({ kind: "message", text: result.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setSubmitError({ kind: "message", text: "Network error. Please check your connection and try again." });
    } finally {
      setIsLoading(false);
      setIsDownloading(false);
    }
  };

  // ── Submitting & Downloading 3D Modal Overlay ───────────────────────────────
  if (isLoading || isDownloading) {
    return (
      <SubmittingModal
        isOpen={true}
        stage={isDownloading ? "generating" : "submitting"}
      />
    );
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (submitted) {
    const seqNum = ticketData ? parseSequenceNumber(ticketData.ticket.ticketNumber) : 1;
    const ticketCodeObj = ticketData
      ? generateTicketCode(
          {
            id: ticketData.registrationId || ticketData.ticket.tokenHash,
            name: ticketData.participant.name,
            affiliation: ticketData.participant.affiliation,
            college: ticketData.participant.college,
            institute: ticketData.participant.institute,
          },
          seqNum,
          ticketData.ticket.tokenHash
        )
      : null;

    return (
      <div className="w-full max-w-5xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 sm:p-10 md:p-12 text-center animate-fade-up shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[var(--gold-muted)] mb-5 bg-[var(--gold)]/10">
          <Check className="text-[var(--gold)] w-8 h-8" />
        </div>
        <p className="eyebrow mb-2">Registration Confirmed</p>
        <h3 className="heading-display text-3xl sm:text-4xl md:text-5xl mb-3">See You at ORAH 2K26</h3>
        <p className="text-[var(--text-muted)] text-sm sm:text-base max-w-lg mx-auto mb-8">
          Thank you for registering. Your official entry ticket is ready below. Please save or download your pass for check-in.
        </p>

        {/* Digital Ticket Render Container */}
        {ticketData && ticketCodeObj && (
          <div className="my-6 w-full flex flex-col items-center">
            <div className="w-full max-w-[940px] overflow-x-auto pb-4 flex justify-center">
              <div className="min-w-[680px] sm:min-w-[800px] md:min-w-[940px] transition-transform">
                <DigitalTicket
                  id="digital-ticket-canvas"
                  registration={{
                    id: ticketData.registrationId || ticketData.ticket.tokenHash,
                    name: ticketData.participant.name,
                    affiliation: ticketData.participant.affiliation,
                    college: ticketData.participant.college,
                    institute: ticketData.participant.institute,
                    year_of_study: ticketData.participant.yearOfStudy,
                    parish: ticketData.participant.parish,
                    diocese: ticketData.participant.diocese,
                  }}
                  ticketCode={ticketCodeObj.code}
                  sequenceNumber={seqNum}
                  ticketId={ticketData.ticket.tokenHash}
                  eventName="ORAH 2K26"
                  venue="St Thomas College"
                  date="SEP 19"
                  time="5:00 PM"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => generateTicketPdf(ticketData)}
                className="btn-fill-gold inline-flex items-center gap-2.5 px-6 py-3 rounded-lg text-xs sm:text-sm font-bold tracking-wider uppercase transition-all shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF Ticket</span>
              </button>

              <button
                type="button"
                onClick={() => generateTicketImage(ticketData)}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg border border-[var(--gold-muted)] bg-[var(--bg-secondary)] hover:bg-[var(--gold-muted)]/20 text-[var(--gold)] text-xs sm:text-sm font-bold tracking-wider uppercase transition-all shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Download Image (PNG)</span>
              </button>
            </div>
          </div>
        )}

        {/* Support Contact */}
        <div className="mt-10 flex flex-col items-center p-4 px-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] max-w-lg mx-auto">
          <p className="text-xs text-[var(--text-muted)] text-center mb-1.5">
            For any event related details or queries, please contact:
          </p>
          <div className="text-sm font-medium text-[var(--text)] text-center">
            Sebin Jo Saji <span className="mx-2 text-[var(--border-subtle)]">|</span> <a href="tel:+919400389831" className="text-[var(--gold-muted)] hover:text-[var(--gold)] transition-colors">+91 94003 89831</a>
          </div>
        </div>

      </div>
    );
  }

  const isSubmitDisabled = isLoading || isDownloading || !formData.confirmed || Object.values(errors).some((e) => e !== "");

  return (
    <div className="w-full max-w-[1800px] mx-auto overflow-hidden">

      {/* Header section (shared) */}
      <div className="mb-10 text-center md:text-left">
        <p className="eyebrow mb-2" id="register">Join Us</p>
        <h3 className="heading-display text-4xl md:text-5xl mb-2">Register Now</h3>
        <p className="text-[var(--text-muted)] text-sm">Secure your spot for ORAH 2026</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-gold)] overflow-hidden">

        <form onSubmit={handleSubmit} noValidate className="relative flex flex-col min-h-[500px]">

          <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] w-full flex-grow">

            {/* --- COLUMN / SECTION 1: Personal Info --- */}
            <div className="w-full p-6 lg:p-12 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--gold-muted)] text-[#0d0a05] text-xs font-bold">1</span>
                  <h4 className="text-lg font-semibold text-[var(--gold)] font-display tracking-wide uppercase">Personal Details</h4>
                </div>

                <div className="space-y-6">
                  <FormField
                    label="Full Name" name="name" type="text" placeholder="Your Name"
                    value={formData.name} onChange={handleChange} onBlur={handleBlur} error={errors.name} touched={touched.name}
                    disabled={isLoading}
                  />

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <FormField
                      label="Date of Birth" name="dob" type="date" placeholder="DD/MM/YYYY"
                      value={formData.dob} onChange={handleChange} onBlur={handleBlur} error={errors.dob} touched={touched.dob}
                      disabled={isLoading}
                    />
                    <FormSelect
                      label="Gender" name="gender" value={formData.gender} onChange={handleChange} onBlur={handleBlur} error={errors.gender} touched={touched.gender}
                      options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <FormField
                      label="Phone Number" name="phone" type="tel" placeholder="+91 97654321"
                      value={formData.phone} onChange={handleChange} onBlur={handleBlur} error={errors.phone} touched={touched.phone}
                      disabled={isLoading}
                    />
                    <FormField
                      label="Email Address" name="email" type="email" placeholder="email@example.com"
                      value={formData.email} onChange={handleChange} onBlur={handleBlur} error={errors.email} touched={touched.email}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Affiliation and Conditional Fields */}
                  <div className="space-y-6">
                    <FormSelect
                      label="Affiliation" name="affiliation"
                      value={formData.affiliation} onChange={handleChange} onBlur={handleBlur}
                      error={errors.affiliation} touched={touched.affiliation}
                      options={AFFILIATION_OPTIONS}
                      disabled={isLoading}
                    />

                    {/* 1. If 'Other' is selected -> Show 'Please specify' */}
                    {formData.affiliation === "Other" && (
                      <div className="animate-fade-up">
                        <FormField
                          label="Please specify" name="affiliationOther" type="text"
                          placeholder="e.g. Research Scholar"
                          value={formData.affiliationOther} onChange={handleChange} onBlur={handleBlur}
                          error={errors.affiliationOther} touched={touched.affiliationOther}
                          disabled={isLoading}
                        />
                      </div>
                    )}

                    {/* 2. If 'College' is selected -> Show College dropdown (+ Other text) and Year of Study */}
                    {formData.affiliation === "College" && (
                      <div className="space-y-6 animate-fade-up">
                        <div className="flex flex-col gap-3">
                          <FormSelect
                            label="College" name="college"
                            value={formData.college} onChange={handleChange} onBlur={handleBlur}
                            error={errors.college} touched={touched.college}
                            options={COLLEGE_OPTIONS}
                            disabled={isLoading}
                          />
                          {formData.college === "Other" && (
                            <div className="animate-fade-up">
                              <FormField
                                label="Please specify the college" name="collegeOther" type="text"
                                placeholder="e.g. M A College"
                                value={formData.collegeOther} onChange={handleChange} onBlur={handleBlur}
                                error={errors.collegeOther} touched={touched.collegeOther}
                                disabled={isLoading}
                              />
                            </div>
                          )}
                        </div>

                        {/* After a college is selected -> show Year of Study dropdown */}
                        {formData.college && (
                          <div className="flex flex-col gap-3 animate-fade-up">
                            <FormSelect
                              label="Year of Study" name="yearOfStudy"
                              value={formData.yearOfStudy} onChange={handleChange} onBlur={handleBlur}
                              error={errors.yearOfStudy} touched={touched.yearOfStudy}
                              options={YEAR_OF_STUDY_OPTIONS}
                              disabled={isLoading}
                            />
                            {formData.yearOfStudy === "Other" && (
                              <div className="animate-fade-up">
                                <FormField
                                  label="Please specify" name="yearOfStudyOther" type="text"
                                  placeholder="e.g. Diploma 2nd Year"
                                  value={formData.yearOfStudyOther} onChange={handleChange} onBlur={handleBlur}
                                  error={errors.yearOfStudyOther} touched={touched.yearOfStudyOther}
                                  disabled={isLoading}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. If 'Institutes' is selected -> Show Institute dropdown (+ Other text) */}
                    {formData.affiliation === "Institutes" && (
                      <div className="flex flex-col gap-3 animate-fade-up">
                        <FormSelect
                          label="Institute" name="institute"
                          value={formData.institute} onChange={handleChange} onBlur={handleBlur}
                          error={errors.institute} touched={touched.institute}
                          options={INSTITUTE_OPTIONS}
                          disabled={isLoading}
                        />
                        {formData.institute === "Other" && (
                          <div className="animate-fade-up">
                            <FormField
                              label="Please specify the institute" name="instituteOther" type="text"
                              placeholder="e.g. OET Training Center"
                              value={formData.instituteOther} onChange={handleChange} onBlur={handleBlur}
                              error={errors.instituteOther} touched={touched.instituteOther}
                              disabled={isLoading}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- DESKTOP SEPARATOR / MOBILE DIVIDER --- */}
            <div className="hidden md:flex justify-center py-12 relative">
              <div className="w-px bg-gradient-to-b from-transparent via-[var(--border-subtle)] to-transparent h-full"></div>
            </div>
            <div className="md:hidden px-6">
              <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent w-full"></div>
            </div>

            {/* --- COLUMN / SECTION 2: Church, Location, Confirmation --- */}
            <div className="w-full p-6 lg:p-12 flex flex-col justify-between bg-[var(--bg-secondary)] md:bg-transparent">
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--gold-muted)] text-[#0d0a05] text-xs font-bold">2</span>
                  <h4 className="text-lg font-semibold text-[var(--gold)] font-display tracking-wide uppercase">Additional Info</h4>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <FormField
                      label="Parish Name" name="parish" type="text" placeholder="St. Mary's Church"
                      value={formData.parish} onChange={handleChange} onBlur={handleBlur} error={errors.parish} touched={touched.parish}
                      disabled={isLoading}
                    />
                    <FormField
                      label="Diocese Name" name="diocese" type="text" placeholder="Pala"
                      value={formData.diocese} onChange={handleChange} onBlur={handleBlur} error={errors.diocese} touched={touched.diocese}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid grid-cols-1">
                    <FormField
                      label="Address" name="address" type="text" placeholder="House Name, Street, City"
                      value={formData.address} onChange={handleChange} onBlur={handleBlur} error={errors.address} touched={touched.address}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10 space-y-6">
                <label className={`flex items-start gap-4 cursor-pointer group p-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg)] hover:border-[var(--gold-muted)] transition-colors ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                    <input
                      type="checkbox" name="confirmed"
                      checked={formData.confirmed} onChange={handleChange} onBlur={handleBlur}
                      disabled={isLoading}
                      className="peer appearance-none w-5 h-5 border border-[var(--input-border)] rounded bg-[var(--input-bg)] checked:bg-[var(--gold-muted)] checked:border-[var(--gold-muted)] transition-colors cursor-pointer"
                    />
                    <Check className="absolute w-3 h-3 text-[var(--bg-card)] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" strokeWidth={3} />
                  </div>
                  <div>
                    <span className="text-sm text-[var(--text)] font-medium">Information Confirmation</span>
                    <p className="text-xs text-[var(--text-muted)] mt-1">I confirm that all the details provided above are accurate and true to my knowledge.</p>
                    {touched.confirmed && errors.confirmed && (
                      <p className="text-[var(--destructive)] text-xs mt-2">{errors.confirmed}</p>
                    )}
                  </div>
                </label>

                {/* Inline Server Error Banner */}
                {submitError && (
                  <div className="flex items-start gap-3 p-4 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 animate-fade-up">
                    <AlertCircle className="w-4 h-4 text-[var(--destructive)] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      {submitError.kind === "fields" ? (
                        <>
                          <p className="text-[var(--destructive)] text-xs font-semibold mb-1.5">
                            Please fix the following fields before submitting:
                          </p>
                          <ul className="text-[var(--destructive)] text-xs space-y-0.5 list-disc list-inside">
                            {submitError.items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-[var(--destructive)] text-xs leading-relaxed">{submitError.text}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Unified Responsive Footer Submit Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-6 md:p-8 lg:px-12 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] gap-4">
            <div className="w-full sm:w-auto text-center sm:text-left">
              <h5 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wider mb-1">Ready to Register?</h5>
              <p className="text-xs text-[var(--text-muted)]">
                {submitError
                  ? submitError.kind === "fields"
                    ? <span className="text-[var(--destructive)] flex items-center justify-center sm:justify-start gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{submitError.items.length} field{submitError.items.length > 1 ? "s need" : " needs"} attention — see above.</span>
                    : <span className="text-[var(--destructive)] flex items-center justify-center sm:justify-start gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{submitError.text}</span>
                  : "Please review your information before final submission."
                }
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="btn-fill-gold flex items-center justify-center gap-2 group w-full sm:w-auto px-8 py-4 text-[0.9rem] font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none min-w-[200px] hover:text-black"
            >
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  Submitting
                  <span className="flex gap-1 items-center translate-y-[2px]">
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce"></span>
                  </span>
                </span>
              ) : isDownloading ? (
                <span className="flex items-center gap-1.5">
                  Generating ticket
                  <span className="flex gap-1 items-center translate-y-[2px]">
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce"></span>
                  </span>
                </span>
              ) : (
                <>Submit Registration <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Support Contact */}
      <div className="mt-6 flex flex-col md:flex-row items-center justify-between p-4 px-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] max-w-3xl mx-auto">
        <p className="text-xs text-[var(--text-muted)] text-center md:text-left mb-2 md:mb-0">
          For any event related details or errors in submission, please contact:
        </p>
        <div className="text-sm font-medium text-[var(--text)] text-center md:text-right">
          Sebin Jo Saji <span className="mx-2 text-[var(--border-subtle)]">|</span> <a href="tel:+919400389831" className="text-[var(--gold-muted)] hover:text-[var(--gold)] transition-colors">+91 94003 89831</a>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Form Components ──────────────────────────────────────────────────

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
};

function FormField({ label, name, type = "text", placeholder, value, onChange, onBlur, error, touched, disabled }: FieldProps) {
  const hasError = touched && error;

  return (
    <div className="flex flex-col relative">
      <label htmlFor={name} className="text-[0.65rem] uppercase tracking-wider text-[var(--text-dim)] mb-1.5 font-semibold">
        {label}
      </label>
      <input
        id={name} name={name} type={type} placeholder={placeholder}
        value={value} onChange={onChange} onBlur={onBlur} disabled={disabled}
        className={`w-full px-3 py-2.5 bg-[var(--input-bg)] border ${hasError ? 'border-[var(--destructive)]' : 'border-[var(--input-border)]'} rounded-[3px] text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none transition-colors focus:border-[var(--gold-muted)] disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      <div className={`overflow-hidden transition-all duration-300 ${hasError ? 'max-h-6 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'}`}>
        <p className="text-[var(--destructive)] text-[0.65rem]">{error}</p>
      </div>
    </div>
  );
}

function FormSelect({ label, name, value, onChange, onBlur, error, touched, options, disabled }: FieldProps & { options: { value: string, label: string }[], disabled?: boolean }) {
  const hasError = touched && error;

  return (
    <div className="flex flex-col relative">
      <label htmlFor={name} className="text-[0.65rem] uppercase tracking-wider text-[var(--text-dim)] mb-1.5 font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          id={name} name={name} value={value} onChange={onChange} onBlur={onBlur} disabled={disabled}
          className={`appearance-none w-full px-3 py-2.5 bg-[var(--input-bg)] border ${hasError ? 'border-[var(--destructive)]' : 'border-[var(--input-border)]'} rounded-[3px] text-sm ${value ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'} outline-none transition-colors focus:border-[var(--gold-muted)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="" disabled>Select {label}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--gold-muted)]">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${hasError ? 'max-h-6 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'}`}>
        <p className="text-[var(--destructive)] text-[0.65rem]">{error}</p>
      </div>
    </div>
  );
}
