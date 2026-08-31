/**
 * Static reference data for the demo seed: destination hospitals, the referral
 * centre's accounts, lenders, and expense categories.
 */

export const SPECIALTIES = [
  "Cardiology", "Cardiac Surgery", "Oncology", "Medical Oncology", "Radiation Oncology",
  "Orthopedics", "Joint Replacement", "Spine Surgery", "Neurology", "Neurosurgery",
  "Nephrology", "Renal Transplant", "Liver Transplant", "Bone Marrow Transplant",
  "Gastroenterology", "Urology", "General Surgery", "Bariatric Surgery",
  "Ophthalmology", "ENT", "Pulmonology", "Endocrinology", "Rheumatology",
  "Fertility & IVF", "Obstetrics & Gynecology", "Pediatrics", "Pediatric Cardiology",
  "Plastic & Reconstructive Surgery", "Dermatology", "Vascular Surgery",
];

/**
 * name, city, country. `country` is required by the schema (Subsystem B).
 * Aster is a real hospital group; the others are well-known medical-tourism
 * destinations for East-African patients.
 */
export const HOSPITALS = [
  // India
  ["Aster Medcity", "Kochi", "India"],
  ["Aster CMI Hospital", "Bengaluru", "India"],
  ["Aster Prime Hospital", "Hyderabad", "India"],
  ["Aster RV Hospital", "Bengaluru", "India"],
  ["Aster Whitefield Hospital", "Bengaluru", "India"],
  ["Apollo Hospitals Greams Road", "Chennai", "India"],
  ["Apollo Hospitals Jubilee Hills", "Hyderabad", "India"],
  ["Apollo Speciality Hospitals", "Chennai", "India"],
  ["Fortis Hospital Bannerghatta Road", "Bengaluru", "India"],
  ["Fortis Memorial Research Institute", "Gurugram", "India"],
  ["Fortis Malar Hospital", "Chennai", "India"],
  ["Manipal Hospital Old Airport Road", "Bengaluru", "India"],
  ["Kokilaben Dhirubhai Ambani Hospital", "Mumbai", "India"],
  ["Medanta - The Medicity", "Gurugram", "India"],
  ["Max Super Speciality Hospital Saket", "New Delhi", "India"],
  ["BLK-Max Super Speciality Hospital", "New Delhi", "India"],
  ["Artemis Hospital", "Gurugram", "India"],
  ["Global Hospitals", "Chennai", "India"],
  ["MIOT International", "Chennai", "India"],
  ["Narayana Health City", "Bengaluru", "India"],
  ["Amrita Hospital", "Kochi", "India"],
  ["Sankara Nethralaya", "Chennai", "India"],
  ["Rainbow Children's Hospital", "Hyderabad", "India"],
  ["KIMS Hospitals", "Hyderabad", "India"],
  ["Yashoda Hospitals", "Hyderabad", "India"],
  ["Sir Ganga Ram Hospital", "New Delhi", "India"],
  ["Christian Medical College", "Vellore", "India"],
  // UAE
  ["Aster Hospital Mankhool", "Dubai", "United Arab Emirates"],
  ["Aster Hospital Al Qusais", "Dubai", "United Arab Emirates"],
  ["Aster Clinic Bur Dubai", "Dubai", "United Arab Emirates"],
  ["Medcare Hospital Al Safa", "Dubai", "United Arab Emirates"],
  ["American Hospital Dubai", "Dubai", "United Arab Emirates"],
  ["Mediclinic City Hospital", "Dubai", "United Arab Emirates"],
  ["Burjeel Medical City", "Abu Dhabi", "United Arab Emirates"],
  ["Cleveland Clinic Abu Dhabi", "Abu Dhabi", "United Arab Emirates"],
  ["NMC Royal Hospital", "Abu Dhabi", "United Arab Emirates"],
  ["Zulekha Hospital", "Sharjah", "United Arab Emirates"],
  // Turkey
  ["Acibadem Maslak Hospital", "Istanbul", "Turkey"],
  ["Acibadem Altunizade Hospital", "Istanbul", "Turkey"],
  ["Memorial Sisli Hospital", "Istanbul", "Turkey"],
  ["Memorial Bahcelievler Hospital", "Istanbul", "Turkey"],
  ["Medipol Mega University Hospital", "Istanbul", "Turkey"],
  ["Anadolu Medical Center", "Kocaeli", "Turkey"],
  ["Liv Hospital Ulus", "Istanbul", "Turkey"],
  ["Medicana International", "Ankara", "Turkey"],
  // Kenya
  ["Aga Khan University Hospital", "Nairobi", "Kenya"],
  ["The Nairobi Hospital", "Nairobi", "Kenya"],
  ["MP Shah Hospital", "Nairobi", "Kenya"],
  ["Kenyatta University Teaching, Referral & Research Hospital", "Nairobi", "Kenya"],
  ["The Karen Hospital", "Nairobi", "Kenya"],
  ["Mombasa Hospital", "Mombasa", "Kenya"],
  // Egypt
  ["Cleopatra Hospital", "Cairo", "Egypt"],
  ["As-Salam International Hospital", "Cairo", "Egypt"],
  ["Dar Al Fouad Hospital", "Giza", "Egypt"],
  ["Andalusia Hospital", "Cairo", "Egypt"],
  // Thailand
  ["Bumrungrad International Hospital", "Bangkok", "Thailand"],
  ["Bangkok Hospital", "Bangkok", "Thailand"],
  ["Samitivej Sukhumvit Hospital", "Bangkok", "Thailand"],
  // Jordan / KSA
  ["King Hussein Cancer Center", "Amman", "Jordan"],
  ["Jordan Hospital", "Amman", "Jordan"],
  ["King Faisal Specialist Hospital", "Riyadh", "Saudi Arabia"],
];

export const HOSPITAL_CONTACTS = [
  "International Patient Services", "Medical Tourism Desk", "Global Patient Relations",
  "International Office", "Patient Coordination Unit",
];

/** The referral centre's own ledger accounts. */
export const ACCOUNTS = [
  { name: "Aster EA — Hormuud Salaam Bank (USD)", type: "BANK", currency: "USD", opening: 265000 },
  { name: "Aster EA — Premier Bank (USD)", type: "BANK", currency: "USD", opening: 145000 },
  { name: "Aster EA — Petty Cash (USD)", type: "CASH", currency: "USD", opening: 12000 },
  { name: "Aster EA — Dahabshiil Wallet (USD)", type: "OTHER", currency: "USD", opening: 38000 },
  { name: "Aster India Operations (INR)", type: "BANK", currency: "INR", opening: 3200000 },
];

export const LENDERS = [
  "Salaam Somali Bank",
  "Premier Bank Somalia",
  "Amal Bank",
  "Dahabshiil Group",
  "IBS Bank",
  "Cabdiqani Holdings (private lender)",
  "Kaah Islamic Microfinance",
];

/** Case-linked expense categories. */
export const CASE_EXPENSE_CATEGORIES = [
  "Embassy visa fee",
  "Visa service charge",
  "Courier — medical records",
  "Medical records translation",
  "Airport assistance",
  "Local transport (Nairobi)",
  "Patient accommodation deposit",
  "Hospital admission deposit",
  "Attendant visa fee",
];

/** General (non-case) operating expenses. */
export const GENERAL_EXPENSE_CATEGORIES = [
  "Office rent — Muqdisho",
  "Staff salaries",
  "Internet & phone",
  "Electricity (generator + ENGIE)",
  "Marketing & radio ads",
  "Office supplies",
  "Bank charges",
  "Travel — staff",
  "Legal & licensing",
  "IT & software subscriptions",
];

export const REVENUE_OTHER_DESCRIPTIONS = [
  "Diaspora sponsorship contribution",
  "Corporate wellness screening package",
  "Second-opinion teleconsultation fee",
  "Document attestation service",
  "Airport meet-and-greet service",
  "Insurance facilitation fee",
  "NGO patient-transport grant",
];

export const PAYABLE_REASONS = [
  "Patient overpayment refund owed",
  "Embassy partnership commission owed",
  "Hospital deposit reimbursement",
  "Translation vendor invoice",
  "Courier vendor invoice",
  "Radio advertising invoice",
  "Consultant retainer",
  "Airport handler invoice",
];

export const CASE_NOTE_SNIPPETS = [
  "Patient called to confirm travel dates. Passport valid until next year.",
  "Waiting on the cardiology report before sending to hospitals.",
  "Attendant added — patient's {relation} will travel with them.",
  "Hospital requested updated ECG and echo; family is arranging it.",
  "Family prefers a hospital in Nairobi due to lower travel cost.",
  "Visa appointment booked at the embassy for next week.",
  "Fee paid via Hormuud EVC. Receipt attached.",
  "Embassy visit completed; awaiting decision.",
  "Patient discharged and back home. Follow-up in 3 months.",
  "Case cancelled — family decided to seek treatment locally.",
  "Chosen hospital changed after a better cost estimate came in.",
  "Invitation letter received and forwarded to the family.",
];

export const MEDICAL_CONDITIONS = [
  "Coronary artery disease — evaluation for CABG",
  "Chronic kidney disease stage 5 — transplant workup",
  "Breast carcinoma — staging and chemotherapy planning",
  "Degenerative disc disease — lumbar spine surgery",
  "Cataract — bilateral phacoemulsification",
  "Rheumatic heart disease — valve replacement",
  "Hepatocellular carcinoma — liver transplant assessment",
  "Congenital heart defect (VSD) — pediatric cardiac surgery",
  "Brain tumour — neurosurgical resection",
  "Prostate carcinoma — radiotherapy",
  "Total knee osteoarthritis — bilateral replacement",
  "Infertility — IVF cycle",
  "Retinal detachment — vitreoretinal surgery",
  "Thyroid carcinoma — total thyroidectomy",
  "Morbid obesity — bariatric surgery",
];
