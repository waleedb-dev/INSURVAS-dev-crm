"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { T } from "@/lib/theme";

export type TransferLeadFormData = {
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
};

const usStates = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 8,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  color: T.textDark,
  outline: "none",
  fontFamily: T.font,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: T.textMuted,
  marginBottom: 6,
  textTransform: "uppercase",
};

export default function TransferLeadApplicationForm({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (data: TransferLeadFormData) => void;
}) {
  const [formData, setFormData] = useState<TransferLeadFormData>({
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
  });

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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 10, width: 40, height: 40, cursor: "pointer", color: T.textMid }}>
            ←
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: T.textDark, fontWeight: 800 }}>Ascendra BPO Application</h1>
            <p style={{ margin: "4px 0 0", color: T.textMuted, fontWeight: 600 }}>All information needed to track sales for Live Transfers</p>
          </div>
        </div>
        <button
          onClick={() => onSubmit(formData)}
          disabled={requiredMissing || phoneError}
          style={{
            backgroundColor: requiredMissing || phoneError ? T.border : T.blue,
            color: "#fff",
            border: "none",
            borderRadius: T.radiusMd,
            padding: "10px 20px",
            fontWeight: 800,
            cursor: requiredMissing || phoneError ? "not-allowed" : "pointer",
          }}
        >
          Submit
        </button>
      </div>

      <div style={{ background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Date of Submission*">
            <input type="date" value={formData.submissionDate} onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })} style={fieldStyle} />
          </Field>
          <Field label="Date of Birth*">
            <input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} style={fieldStyle} />
          </Field>

          <Field label="First Name*">
            <input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} style={fieldStyle} />
          </Field>
          <Field label="Last Name*">
            <input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} style={fieldStyle} />
          </Field>

          <Field label="Address*" full>
            <input placeholder="Street Address" value={formData.street1} onChange={(e) => setFormData({ ...formData, street1: e.target.value })} style={fieldStyle} />
          </Field>
          <Field label="Address Line 2" full>
            <input placeholder="Street Address Line 2" value={formData.street2} onChange={(e) => setFormData({ ...formData, street2: e.target.value })} style={fieldStyle} />
          </Field>

          <Field label="City*">
            <input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} style={fieldStyle} />
          </Field>
          <Field label="State*">
            <select value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} style={fieldStyle}>
              <option value="">Please Select</option>
              {usStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </Field>

          <Field label="Zip Code*">
            <input value={formData.zipCode} onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })} style={fieldStyle} />
          </Field>
          <Field label="Number*">
            <input
              placeholder="(000) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{ ...fieldStyle, borderColor: phoneError ? T.danger : T.border }}
            />
            <div style={{ fontSize: 11, color: phoneError ? T.danger : T.textMuted, marginTop: 4 }}>
              {phoneError ? "Please enter a valid phone number. Format: (000) 000-0000." : "Format: (000) 000-0000."}
            </div>
          </Field>

          <Field label="Birth State*">
            <select value={formData.birthState} onChange={(e) => setFormData({ ...formData, birthState: e.target.value })} style={fieldStyle}>
              <option value="">Please Select</option>
              {usStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </Field>
          <Field label="Age*">
            <input value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} style={fieldStyle} />
          </Field>

          <Field label="Social*">
            <input value={formData.social} onChange={(e) => setFormData({ ...formData, social: e.target.value })} style={fieldStyle} />
          </Field>
          <Field label="Driver License Number*">
            <input value={formData.driverLicenseNumber} onChange={(e) => setFormData({ ...formData, driverLicenseNumber: e.target.value })} style={fieldStyle} />
          </Field>

          <Field label="Any existing / previous coverage in last 2 years?*">
            <YesNo value={formData.existingCoverageLast2Years} onChange={(value) => setFormData({ ...formData, existingCoverageLast2Years: value })} />
          </Field>
          <Field label="Any previous applications in 2 years?*">
            <YesNo value={formData.previousApplications2Years} onChange={(value) => setFormData({ ...formData, previousApplications2Years: value })} />
          </Field>

          <Field label="Height*"><input value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} style={fieldStyle} /></Field>
          <Field label="Weight*"><input value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} style={fieldStyle} /></Field>
          <Field label="Doctors Name*"><input value={formData.doctorName} onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })} style={fieldStyle} /></Field>
          <Field label="Tabacco Use*"><YesNo value={formData.tobaccoUse} onChange={(value) => setFormData({ ...formData, tobaccoUse: value })} /></Field>

          <Field label="Health Conditions*" full>
            <textarea value={formData.healthConditions} onChange={(e) => setFormData({ ...formData, healthConditions: e.target.value })} style={{ ...fieldStyle, minHeight: 80 }} />
          </Field>
          <Field label="Medications*" full>
            <textarea value={formData.medications} onChange={(e) => setFormData({ ...formData, medications: e.target.value })} style={{ ...fieldStyle, minHeight: 80 }} />
          </Field>

          <Field label="Monthly Premium*"><input value={formData.monthlyPremium} onChange={(e) => setFormData({ ...formData, monthlyPremium: e.target.value })} style={fieldStyle} /></Field>
          <Field label="Coverage Amount*"><input value={formData.coverageAmount} onChange={(e) => setFormData({ ...formData, coverageAmount: e.target.value })} style={fieldStyle} /></Field>

          <Field label="Carrier*"><input value={formData.carrier} onChange={(e) => setFormData({ ...formData, carrier: e.target.value })} style={fieldStyle} /></Field>
          <Field label="Product Type*"><input value={formData.productType} onChange={(e) => setFormData({ ...formData, productType: e.target.value })} style={fieldStyle} /></Field>

          <Field label="Draft Date*"><input type="date" value={formData.draftDate} onChange={(e) => setFormData({ ...formData, draftDate: e.target.value })} style={fieldStyle} /></Field>
          <Field label="Future Draft Date*"><input type="date" value={formData.futureDraftDate} onChange={(e) => setFormData({ ...formData, futureDraftDate: e.target.value })} style={fieldStyle} /></Field>

          <Field label="Beneficiary Information*" full>
            <textarea value={formData.beneficiaryInformation} onChange={(e) => setFormData({ ...formData, beneficiaryInformation: e.target.value })} style={{ ...fieldStyle, minHeight: 72 }} />
          </Field>

          <Field label="Bank Account Type">
            <select value={formData.bankAccountType} onChange={(e) => setFormData({ ...formData, bankAccountType: e.target.value })} style={fieldStyle}>
              <option value="">Please Select</option>
              <option value="Checking">Checking</option>
              <option value="Savings">Savings</option>
            </select>
          </Field>
          <Field label="Institution Name*"><input value={formData.institutionName} onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })} style={fieldStyle} /></Field>

          <Field label="Rout*"><input value={formData.routingNumber} onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })} style={fieldStyle} /></Field>
          <Field label="Acc*"><input value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} style={fieldStyle} /></Field>

          <Field label="Additional Information*" full>
            <textarea value={formData.additionalInformation} onChange={(e) => setFormData({ ...formData, additionalInformation: e.target.value })} style={{ ...fieldStyle, minHeight: 96 }} />
          </Field>
        </div>

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${T.borderLight}`, fontSize: 13, color: T.textMuted, fontWeight: 700 }}>
          THANK YOU FOR YOUR SUBMISSION!!!
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "span 2" : "span 1" }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

function YesNo({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={fieldStyle}>
      <option value="">Please Select</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}
