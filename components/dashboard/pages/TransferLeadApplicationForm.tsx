"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type TransferLeadFormData = {
  leadUniqueId: string;
  leadValue: string;
  leadSource: string;
  submissionDate: string;
  firstName: string;
  lastName: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  birthState: string;
  dateOfBirth: string;
  age: string;
  social: string;
  driverLicenseNumber: string;
  existingCoverageLast2Years: string;
  previousApplications2Years: string;
  height: string;
  weight: string;
  doctorName: string;
  tobaccoUse: string;
  healthConditions: string;
  medications: string;
  monthlyPremium: string;
  coverageAmount: string;
  carrier: string;
  productType: string;
  draftDate: string;
  beneficiaryInformation: string;
  bankAccountType: string;
  institutionName: string;
  routingNumber: string;
  accountNumber: string;
  futureDraftDate: string;
  additionalInformation: string;
  pipeline: string;
  stage: string;
  isDraft?: boolean;
};

const usStates = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const productTypeOptions = [
  "Preferred", "Standard", "Graded", "Modified", "GI", "Immediate", "Level", "ROP",
];

const FIXED_BPO_LEAD_SOURCE = "BPO Transfer Lead Source";

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 8,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  color: T.textDark,
  outline: "none",
  fontFamily: T.font,
  backgroundColor: "#fff",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: T.textMuted,
  marginBottom: 6,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

export default function TransferLeadApplicationForm({
  onBack,
  onSubmit,
  onSaveDraft,
  initialData,
  submitButtonLabel,
  centerName = ""
}: {
  onBack: () => void;
  onSubmit: (data: TransferLeadFormData) => void;
  onSaveDraft?: (data: TransferLeadFormData) => void;
  initialData?: Partial<TransferLeadFormData>;
  submitButtonLabel?: string;
  centerName?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const [carriers, setCarriers] = useState<Array<{ id: number; name: string }>>([]);

    const [formData, setFormData] = useState<TransferLeadFormData>({
      leadUniqueId: "",
      leadValue: "",
      leadSource: FIXED_BPO_LEAD_SOURCE,
      submissionDate: "",
      firstName: "",
      lastName: "",
      street1: "",
      street2: "",
      city: "",
      state: "",
      zipCode: "",
      phone: "",
      birthState: "",
      dateOfBirth: "",
      age: "",
      social: "",
      driverLicenseNumber: "",
      existingCoverageLast2Years: "",
      previousApplications2Years: "",
      height: "",
      weight: "",
      doctorName: "",
      tobaccoUse: "",
      healthConditions: "",
      medications: "",
      monthlyPremium: "",
      coverageAmount: "",
      carrier: "",
      productType: "",
      draftDate: "",
      beneficiaryInformation: "",
      bankAccountType: "",
      institutionName: "",
      routingNumber: "",
      accountNumber: "",
      futureDraftDate: "",
      additionalInformation: "",
      pipeline: "Transfer Portal",
      stage: "Transfer API",
      isDraft: initialData?.isDraft ?? false,
      ...initialData,
      leadSource: FIXED_BPO_LEAD_SOURCE, // always override to ensure string
    });
    // Always force leadSource to the fixed value
    useEffect(() => {
      setFormData((prev) => ({ ...prev, leadSource: FIXED_BPO_LEAD_SOURCE }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  useEffect(() => {
    if (!initialData) return;

    setFormData((prev) => ({
      ...prev,
      ...initialData,
      leadSource: FIXED_BPO_LEAD_SOURCE,
    }));
  }, [initialData]);

  useEffect(() => {
    const fetchCarriers = async () => {
      const { data, error } = await supabase
        .from("carriers")
        .select("id, name")
        .order("name");
      if (!error && data) setCarriers(data);
    };
    void fetchCarriers();
  }, [supabase]);

  const requiredMissing = useMemo(() => {
    const requiredKeys: Array<keyof TransferLeadFormData> = [
      "submissionDate", "firstName", "lastName", "street1", "city", "state", "zipCode", "phone", "birthState",
      "dateOfBirth", "age", "social", "driverLicenseNumber", "existingCoverageLast2Years", "previousApplications2Years",
      "height", "weight", "doctorName", "tobaccoUse", "healthConditions", "medications", "monthlyPremium",
      "coverageAmount", "carrier", "productType", "draftDate", "beneficiaryInformation", "institutionName", "routingNumber",
      "accountNumber", "futureDraftDate",
    ];
    return requiredKeys.some((key) => !String(formData[key] || "").trim());
  }, [formData]);

  const phoneError = formData.phone.length > 0 && !/^\(\d{3}\) \d{3}-\d{4}$/.test(formData.phone);

  const computedLeadUniqueId = useMemo(() => {
    // 2 number phones + three letter from names + SSN last 2 digits + center ki 2 letters
    const phoneDigits = formData.phone.replace(/\D/g, "");
    const phone2 = phoneDigits.slice(0, 2);
    const nameLetters = `${formData.firstName}${formData.lastName}`.replace(/[^a-zA-Z]/g, "").slice(0, 3).toLowerCase();
    const socialDigits = formData.social.replace(/\D/g, "");
    const ssn2 = socialDigits.slice(-2);
    const center2 = (centerName || "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toLowerCase();
    if (!phone2 || nameLetters.length < 3 || ssn2.length < 2 || center2.length < 2) {
      return formData.leadUniqueId || "";
    }
    return `${phone2}${nameLetters}${ssn2}${center2}`;
  }, [formData.firstName, formData.lastName, formData.phone, formData.social, formData.leadUniqueId, centerName]);

  const set = (key: keyof TransferLeadFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div style={{ fontFamily: T.font }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 16 }}>
        <button
          onClick={onBack}
          style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10, width: 40, height: 40, cursor: "pointer", color: T.textMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: T.textDark, fontWeight: 800 }}>Ascendra BPO Application</h1>
          <p style={{ margin: "4px 0 0", color: T.textMuted, fontWeight: 600, fontSize: 13 }}>All information needed to track sales for Live Transfers</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Section: Lead Info */}
        <Section title="Lead Information" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Lead Unique ID" full>
              <input value={computedLeadUniqueId} readOnly placeholder="Auto-generated from name + phone + SSN last 4" style={{ ...fieldStyle, backgroundColor: T.rowBg, color: T.textMuted }} />
            </Field>
            <Field label="Date of Submission *">
              <input type="date" value={formData.submissionDate} onChange={set("submissionDate")} style={fieldStyle} />
            </Field>
            <Field label="Phone Number *">
              <input
                placeholder="(000) 000-0000"
                value={formData.phone}
                onChange={set("phone")}
                style={{ ...fieldStyle, borderColor: phoneError ? T.danger : T.border }}
              />
              <div style={{ fontSize: 11, color: phoneError ? T.danger : T.textMuted, marginTop: 4 }}>
                {phoneError ? "Please enter a valid phone number. Format: (000) 000-0000." : "Format: (000) 000-0000."}
              </div>
            </Field>
          </div>
        </Section>

        {/* Section: Personal Info */}
        <Section title="Personal Information" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="First Name *">
              <input value={formData.firstName} onChange={set("firstName")} style={fieldStyle} />
            </Field>
            <Field label="Last Name *">
              <input value={formData.lastName} onChange={set("lastName")} style={fieldStyle} />
            </Field>
            <Field label="Date of Birth *">
              <input type="date" value={formData.dateOfBirth} onChange={set("dateOfBirth")} style={fieldStyle} />
            </Field>
            <Field label="Age *">
              <input value={formData.age} onChange={set("age")} style={fieldStyle} />
            </Field>
            <Field label="Social Security Number *">
              <input value={formData.social} onChange={set("social")} placeholder="XXX-XX-XXXX" style={fieldStyle} />
            </Field>
            <Field label="Driver License Number *">
              <input value={formData.driverLicenseNumber} onChange={set("driverLicenseNumber")} style={fieldStyle} />
            </Field>
          </div>
        </Section>

        {/* Section: Contact & Address */}
        <Section title="Contact & Address" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Street Address *" full>
              <input placeholder="Street Address" value={formData.street1} onChange={set("street1")} style={fieldStyle} />
            </Field>
            <Field label="Address Line 2" full>
              <input placeholder="Apt, Suite, Unit (optional)" value={formData.street2} onChange={set("street2")} style={fieldStyle} />
            </Field>
            <Field label="City *">
              <input value={formData.city} onChange={set("city")} style={fieldStyle} />
            </Field>
            <Field label="State *">
              <select value={formData.state} onChange={set("state")} style={fieldStyle}>
                <option value="">Please Select</option>
                {usStates.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Zip Code *">
              <input value={formData.zipCode} onChange={set("zipCode")} style={fieldStyle} />
            </Field>
            <Field label="Birth State *">
              <select value={formData.birthState} onChange={set("birthState")} style={fieldStyle}>
                <option value="">Please Select</option>
                {usStates.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {/* Section: Health */}
        <Section title="Health Information" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Any existing / previous coverage in last 2 years? *">
              <YesNo value={formData.existingCoverageLast2Years} onChange={(v) => setFormData((p) => ({ ...p, existingCoverageLast2Years: v }))} />
            </Field>
            <Field label="Any previous applications in 2 years? *">
              <YesNo value={formData.previousApplications2Years} onChange={(v) => setFormData((p) => ({ ...p, previousApplications2Years: v }))} />
            </Field>
            <Field label="Height *">
              <input placeholder='e.g. 5&apos;10"' value={formData.height} onChange={set("height")} style={fieldStyle} />
            </Field>
            <Field label="Weight *">
              <input placeholder="e.g. 175 lbs" value={formData.weight} onChange={set("weight")} style={fieldStyle} />
            </Field>
            <Field label="Doctor's Name *">
              <input value={formData.doctorName} onChange={set("doctorName")} style={fieldStyle} />
            </Field>
            <Field label="Tobacco Use *">
              <YesNo value={formData.tobaccoUse} onChange={(v) => setFormData((p) => ({ ...p, tobaccoUse: v }))} />
            </Field>
            <Field label="Health Conditions *" full>
              <textarea value={formData.healthConditions} onChange={set("healthConditions")} style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }} />
            </Field>
            <Field label="Medications *" full>
              <textarea value={formData.medications} onChange={set("medications")} style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }} />
            </Field>
          </div>
        </Section>

        {/* Section: Policy */}
        <Section title="Policy Details" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Monthly Premium *">
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                <input value={formData.monthlyPremium} onChange={set("monthlyPremium")} style={{ ...fieldStyle, paddingLeft: 28 }} />
              </div>
            </Field>
            <Field label="Coverage Amount *">
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: T.textMuted }}>$</span>
                <input value={formData.coverageAmount} onChange={set("coverageAmount")} style={{ ...fieldStyle, paddingLeft: 28 }} />
              </div>
            </Field>
            <Field label="Carrier *">
              <select value={formData.carrier} onChange={set("carrier")} style={fieldStyle}>
                <option value="">Please Select</option>
                {carriers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Product Type *">
              <select value={formData.productType} onChange={set("productType")} style={fieldStyle}>
                <option value="">Please Select</option>
                {productTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Draft Date *">
              <input type="date" value={formData.draftDate} onChange={set("draftDate")} style={fieldStyle} />
            </Field>
            <Field label="Future Draft Date *">
              <input type="date" value={formData.futureDraftDate} onChange={set("futureDraftDate")} style={fieldStyle} />
            </Field>
            <Field label="Beneficiary Information *" full>
              <textarea value={formData.beneficiaryInformation} onChange={set("beneficiaryInformation")} style={{ ...fieldStyle, minHeight: 72, resize: "vertical" }} />
            </Field>
          </div>
        </Section>

        {/* Section: Banking */}
        <Section title="Banking Information" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Bank Account Type">
              <select value={formData.bankAccountType} onChange={set("bankAccountType")} style={fieldStyle}>
                <option value="">Please Select</option>
                <option value="Checking">Checking</option>
                <option value="Savings">Savings</option>
              </select>
            </Field>
            <Field label="Institution Name *">
              <input value={formData.institutionName} onChange={set("institutionName")} style={fieldStyle} />
            </Field>
            <Field label="Routing Number *">
              <input value={formData.routingNumber} onChange={set("routingNumber")} style={fieldStyle} />
            </Field>
            <Field label="Account Number *">
              <input value={formData.accountNumber} onChange={set("accountNumber")} style={fieldStyle} />
            </Field>
          </div>
        </Section>

        {/* Section: Additional */}
        <Section title="Additional Information" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Additional Notes" full>
              <textarea value={formData.additionalInformation} onChange={set("additionalInformation")} style={{ ...fieldStyle, minHeight: 96, resize: "vertical" }} />
            </Field>
          </div>
        </Section>

      </div>

      {/* Submit */}
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button
          onClick={onBack}
          style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusMd, padding: "11px 24px", fontWeight: 700, cursor: "pointer", fontFamily: T.font, fontSize: 14, color: T.textMid }}
        >
          Cancel
        </button>
        {onSaveDraft && (
          <button
            onClick={() => onSaveDraft({ ...formData, leadUniqueId: computedLeadUniqueId, isDraft: true })}
            style={{
              background: "#fff",
              border: `1.5px solid ${T.blue}`,
              borderRadius: T.radiusMd,
              padding: "11px 24px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: T.font,
              fontSize: 14,
              color: T.blue,
            }}
          >
            Save Draft
          </button>
        )}
        <button
          onClick={() => onSubmit({ ...formData, leadUniqueId: computedLeadUniqueId })}
          disabled={requiredMissing || phoneError}
          style={{
            backgroundColor: requiredMissing || phoneError ? T.border : T.blue,
            color: "#fff",
            border: "none",
            borderRadius: T.radiusMd,
            padding: "11px 28px",
            fontWeight: 800,
            cursor: requiredMissing || phoneError ? "not-allowed" : "pointer",
            fontFamily: T.font,
            fontSize: 14,
            boxShadow: requiredMissing || phoneError ? "none" : `0 4px 12px ${T.blue}44`,
            transition: "all 0.15s",
          }}
        >
          {submitButtonLabel || "Submit Application"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", gap: 10, backgroundColor: "#fafcff" }}>
        <span style={{ color: T.blue }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.textDark }}>{title}</h2>
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "span 2" : "span 1" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      width: "100%",
      padding: "11px 14px",
      borderRadius: 8,
      border: `1.5px solid ${T.border}`,
      fontSize: 14,
      color: T.textDark,
      outline: "none",
      fontFamily: T.font,
      backgroundColor: "#fff",
      boxSizing: "border-box",
    }}>
      <option value="">Please Select</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}
