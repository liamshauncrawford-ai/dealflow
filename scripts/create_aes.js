const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const p = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  // 1. Create the opportunity
  const opp = await p.opportunity.create({
    data: {
      title: 'Allstar Electric Services (AES)',
      description: 'Allstar Electric Services is a 26-year-old Denver-based electrical contractor with $2.7M revenue and ~$322K adjusted EBITDA. Strong thesis fit for data center roll-up: electrical contracting is a core trade for data center construction/maintenance. Key strengths include licensed operations (Master Electrician), diversified client base (Xcel Energy, Kroger, City of Denver), 15-person workforce, and Denver location aligns with Colorado data center corridor growth. Revenue growing at 6% CAGR. Owner retiring provides clean acquisition path with transition support.',
      stage: 'SIGNED_NDA',
      priority: 'HIGH',
      actualRevenue: 2710414,
      actualEbitda: 322063,
      actualEbitdaMargin: 11.88, // 322063 / 2710414
      revenueTrend: 'GROWING',
      customerConcentration: 0.64, // Xcel Energy at 64%
      dealStructure: JSON.stringify({
        businessName: 'Allstar Electric Services',
        founded: 2000,
        location: 'Denver, CO (Metro Denver)',
        employees: 15,
        facility: '5,000 sq. ft. industrial-zoned facility with 0.93-acre adjoining property',
        reasonForSelling: 'Retirement',
        services: ['Commercial Electrical (70%)', 'Residential Electrical (20%)', 'Industrial Electrical (10%)', 'Emergency Services', 'Facility Maintenance', 'LED Lighting Retrofits', 'EV Charging Installations'],
        keyClients: ['Xcel Energy (64%)', 'Kroger (17%)', 'Wellpower (7%)', 'Mavis/Brakes Plus (5%)', 'City of Denver (5%)'],
        broker: 'IAG M&A Advisors',
        brokerContact: 'Paula Kruger',
        brokerEmail: 'pkruger@iagmerger.com',
        brokerPhone: '720-218-4005',
        listingNumber: '38051',
        transitionSupport: 'Owners flexible; transition support and post-closing roles negotiable',
        operatingHours: 'Mon-Fri 7:00am - 4:00pm',
        workforce: '15 FT (12 hourly, 3 salaried), non-union, Kaiser healthcare',
        licenses: 'CO State Electrical Contractor License, Master Electrician',
        balanceSheet2024: { cash: 435788, ar: 384608, inventory: 88380, totalCurrentAssets: 925603, netFixedAssets: 175921, totalAssets: 1101523, ap: 88530, totalCurrentLiabilities: 204933, ltDebt: 72706, totalEquity: 823884 },
        revenueHistory: { '2022': 2668537, '2023': 2843961, '2024': 2710414, '2025P': 2882307 },
        ebitdaHistory: { '2022': 62062, '2023': 335572, '2024': 322063, '2025P': 311491 },
        grossMargin: { '2022': '29%', '2023': '33%', '2024': '21%', '2025P': '32%' },
      }),
      ndaSignedAt: new Date('2026-02-12T20:38:31.000Z'),
    },
  });
  console.log('Created opportunity:', opp.id);

  // 2. Create Paula Kruger contact
  const contact = await p.contact.create({
    data: {
      name: 'Paula Kruger',
      email: 'pkruger@iagmerger.com',
      phone: '720-218-4005',
      role: 'Managing Director',
      company: 'IAG M&A Advisors',
      opportunityId: opp.id,
      isPrimary: true,
      notes: 'Broker for Allstar Electric Services. CM&AA, CM&AP certified.',
    },
  });
  console.log('Created contact:', contact.id);

  // 3. Link 3 emails via EmailLink
  const emailIds = [
    'cmll574qm003gy5z6uks55n75',
    'cmll56xdu001my5z6adbiob7p',
    'cmljzcr11000drceivey7ooiw',
  ];
  for (const eid of emailIds) {
    try {
      await p.emailLink.create({ data: { emailId: eid, opportunityId: opp.id } });
      console.log('Linked email:', eid);
    } catch (e) {
      console.log('EmailLink failed for', eid, ':', e.message.substring(0, 200));
    }
  }

  // 4. Upload CIM
  const cimBuf = fs.readFileSync('/tmp/38051_AES_CIM_10.23.25.pdf');
  const cim = await p.dealDocument.create({
    data: {
      opportunityId: opp.id,
      fileName: '38051_AES_CIM_10.23.25.pdf',
      fileType: 'pdf',
      fileSize: cimBuf.length,
      mimeType: 'application/pdf',
      category: 'CIM',
      description: 'Confidential Information Memorandum - Allstar Electric Services',
      fileData: cimBuf,
      uploadedAt: new Date(),
    },
  });
  console.log('Uploaded CIM:', cim.id, cimBuf.length, 'bytes');

  // 5. Upload NDA
  const ndaBuf = fs.readFileSync('/tmp/nda-liam-crawford-thu-feb-12-2026.pdf');
  const nda = await p.dealDocument.create({
    data: {
      opportunityId: opp.id,
      fileName: 'nda-liam-crawford-thu-feb-12-2026.pdf',
      fileType: 'pdf',
      fileSize: ndaBuf.length,
      mimeType: 'application/pdf',
      category: 'NDA',
      description: 'Signed NDA - Allstar Electric Services / IAG M&A Advisors',
      fileData: ndaBuf,
      uploadedAt: new Date(),
    },
  });
  console.log('Uploaded NDA:', nda.id, ndaBuf.length, 'bytes');

  // 6. Verify
  const v = await p.opportunity.findUnique({
    where: { id: opp.id },
    include: {
      contacts: true,
      emails: { include: { email: { select: { id: true, subject: true } } } },
      documents: { select: { id: true, fileName: true, fileSize: true } },
    },
  });
  console.log('\n=== VERIFICATION ===');
  console.log('Opportunity:', v.title, '| Stage:', v.stage);
  console.log('Revenue:', v.actualRevenue, '| EBITDA:', v.actualEbitda);
  console.log('EBITDA Margin:', v.actualEbitdaMargin, '| Customer Conc:', v.customerConcentration);
  console.log('Contacts:', v.contacts.length);
  v.contacts.forEach(c => console.log('  -', c.name, c.email, c.role, '| Primary:', c.isPrimary));
  console.log('Emails:', v.emails.length);
  v.emails.forEach(el => console.log('  -', el.email.subject));
  console.log('Documents:', v.documents.length);
  v.documents.forEach(d => console.log('  -', d.fileName, '(' + d.fileSize + ' bytes)'));

  await p.$disconnect();
}

main().catch(e => { console.error(e.message.substring(0, 500)); process.exit(1); });
