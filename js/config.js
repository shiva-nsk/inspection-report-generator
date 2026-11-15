// Fixed company information printed on every report.
// Change the values here if the phone, email or wording ever changes.

export const COMPANY = {
  name: 'Akshara Elite Home Inspections',
  phone: '+91 96405 47878',
  email: 'elitehomeinspections.info@gmail.com',
};

export const COVER = {
  kicker: 'PROPERTY INSPECTION REPORT',
  tagline: 'A visual record of the property condition observed during the inspection.',
};

export const SEVERITY_GUIDE = [
  { key: 'major', label: 'MAJOR', text: 'Affects function, safety or durability. Needs prompt rectification.' },
  { key: 'minor', label: 'MINOR', text: 'Workmanship or fitment issue. Rectify before handover.' },
  { key: 'cosmetic', label: 'COSMETIC', text: 'Finish-related and aesthetic only. Touch-up recommended.' },
];

export const THANK_YOU = {
  title: 'Thank you',
  line: 'Thank you for choosing Akshara Elite Home Inspections.',
  motto: ['INSPECT', 'VERIFY', 'INFORM'],
  contactLabel: 'GET IN TOUCH',
};

// Disclaimer page. Each section: title + paragraphs. A paragraph can be a
// string or { bullets: [...] }.
export const DISCLAIMER = [
  {
    title: 'INTRODUCTION',
    body: [
      'This Home Inspection Report ("Report") is prepared for the sole and exclusive use of the client ("Client") and is subject to the terms and conditions outlined herein. The inspection and report are conducted and prepared in accordance with industry standards and guidelines but do not constitute a warranty, guarantee, or insurance policy regarding the property’s condition. The findings and opinions expressed in this report are based on a visual, non-invasive inspection of the readily accessible components of the property at the time of the inspection.',
    ],
  },
  {
    title: 'SCOPE OF THE INSPECTION',
    body: [
      'The inspection is a limited visual examination of the property’s major systems and components, including but not limited to the foundation, roof, plumbing, electrical, HVAC, and structural elements. This inspection does not include destructive testing, dismantling of components, or analysis of concealed conditions. The inspector does not move furniture, lift carpets, open walls, or perform any actions that may cause damage to the property.',
      'The report provides an assessment of the property’s condition on the date of the inspection only. Conditions may change after the inspection, and the Client is encouraged to monitor and maintain the property accordingly.',
    ],
  },
  {
    title: 'LIMITATIONS AND EXCLUSIONS',
    body: [
      'This inspection is not technically exhaustive and does not address every possible defect or condition. The following items, among others, are excluded from the scope of this inspection:',
      {
        bullets: [
          'Latent, hidden, or concealed defects',
          'Code compliance and building permit verification',
          'Environmental hazards (mould, asbestos, lead, radon, formaldehyde, etc.)',
          'Pest infestations (termites, rodents, etc.)',
          'Underground utilities, septic systems, and wells',
          'Specialised systems (alarm systems, intercoms, irrigation, pools, spas, etc.)',
          'Cosmetic issues that do not affect the functionality of the home',
        ],
      },
      'This report is not a substitute for specialised evaluations, engineering assessments, or other professional inspections that may be required for specific concerns.',
    ],
  },
  {
    title: 'NO WARRANTY OR GUARANTEE',
    body: [
      'The home inspection and report do not constitute a warranty, insurance policy, or guarantee of any kind. The inspector does not warrant or certify the future performance, longevity, or functionality of any components or systems. The Client is advised to obtain a home warranty or insurance policy for additional protection.',
    ],
  },
  {
    title: 'CLIENT RESPONSIBILITIES',
    body: [
      'The Client is responsible for reviewing this report thoroughly and seeking further evaluation from qualified professionals for any areas of concern. The Client acknowledges that the inspection is a limited, point-in-time assessment and does not replace regular maintenance and care of the property. The Client is encouraged to perform due diligence by reviewing past maintenance records, obtaining disclosures from the seller, and conducting additional inspections as necessary.',
    ],
  },
  {
    title: 'INSPECTOR’S LIABILITY AND LIMITATION OF CLAIMS',
    body: [
      'The liability of the inspector and the inspection company is limited to the fee paid for the inspection. Under no circumstances shall the inspector or the company be liable for consequential, incidental, or indirect damages arising from the inspection or reliance on this report. Any claims against the inspector or company must be made in writing within 90 days of the inspection date. Failure to notify the inspector within this timeframe waives any and all claims by the Client.',
    ],
  },
  {
    title: 'DISPUTE RESOLUTION',
    body: [
      'In the event of a dispute arising from this inspection or report, the Client agrees to first attempt resolution through direct communication with the inspector. If a resolution cannot be reached, the Client agrees to submit the dispute to binding arbitration in accordance with the rules of a recognised arbitration association. Legal action against the inspector or company must be initiated within one year of the inspection date. The Client waives any and all claims beyond this period.',
    ],
  },
  {
    title: 'ACKNOWLEDGMENT AND ACCEPTANCE',
    body: [
      'By accepting this report, the Client acknowledges and agrees to the terms and limitations set forth herein. The Client further acknowledges that the inspector has not made any representations outside the scope of this inspection and that no warranties, express or implied, are provided. This disclaimer forms an integral part of the home inspection process and must be read in conjunction with the full inspection report.',
    ],
  },
];
