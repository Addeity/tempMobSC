/*
 * Everything the site says beyond the workflows: how the product keeps
 * documents private, who uses it, who makes it, and the legal pages.
 *
 * Most of this has to come from the company, not from a designer, so every
 * entry says how far it can be trusted:
 *
 *   confirmed  checked by someone who knows. Ships.
 *   draft      written only from what the site already claims (the plans,
 *              the pricing questions, the contact page). Ships, and
 *              `npm run check` lists it until someone confirms it.
 *   sample     made up to show the design: a customer, a quote, a person, a
 *              number, a feature nobody has confirmed. `npm run dev` shows it
 *              with a "Sample" tag; a build leaves it out. Replace it with
 *              the real thing and mark it confirmed.
 *
 * `npm run check -- --launch` fails while anything is still a draft or a
 * sample, or a legal page still has a [placeholder] in it.
 */
import { BRAND } from './brand.ts';
import { SERVICES } from './services.ts';

export type Status = 'confirmed' | 'draft' | 'sample';

export interface Point { title: string; body: string; status: Status }
export interface Question { q: string; a: string; status: Status }
export interface Comparison { label: string; ours: string; theirs: string; status: Status }
export interface Requirement { plan: string; server: string; model: string; status: Status }
export interface Node { label: string; detail: string }
export interface Quote { text: string; name: string; role: string; company: string; status: Status }
export interface Logo {
  name: string;
  /** an SVG in public/logos/; without one the name is set as a wordmark */
  file?: string;
  status: Status;
}
export interface Story {
  company: string;
  sector: string;
  size: string;
  headline: string;
  summary: string;
  metrics: { value: string; label: string }[];
  /** keys of the workflows they lean on: the page links each one's film */
  workflows: string[];
  status: Status;
}
export interface Person { name: string; role: string; bio: string; status: Status }
export interface Fact { label: string; value: string; status: Status }
export interface Tool {
  name: string;
  /** what it does in the workroom, in one line */
  body: string;
  /** the key of the workflow whose film shows it, if one does */
  flow?: string;
  /** the tool's own logo, an SVG from its press kit in public/logos/; without one the page draws what it does instead */
  logo?: string;
  status: Status;
}
export interface LegalSection { id: string; title: string; paragraphs: string[]; status: Status }

/* ----------------------------------------------------------- platform */
export const PLATFORM = {
  kicker: 'How it stays private',
  title: 'It runs where your documents already are.',
  lede: `${BRAND.name} is installed on a server you control: your own hardware, your VPS, or a provider you choose. The documents, the search index and the assistant run there, and so can the model. We are not in the data path.`,

  /** the drawing at the top of the page: what runs inside your network, and what stays outside it */
  map: {
    status: 'confirmed' as Status,
    inside: [
      { label: 'Your people', detail: 'in the browser' },
      { label: `Your ${BRAND.name} server`, detail: 'the workroom, its search index and database' },
      { label: 'A local model', detail: 'on hardware you run' },
    ] satisfies Node[],
    cloud: { label: 'A cloud model', detail: 'only if you connect one, on your own account' } satisfies Node,
    us: { label: `${BRAND.name}, the company`, detail: 'no connection to your data' } satisfies Node,
    caption: 'Everything inside the line runs on hardware you control. The dashed line exists only if you choose a cloud model.',
  },

  principles: [
    { title: 'Installed on your server', body: 'Your hardware, your VPS, or a provider running it on your behalf. You decide where it lives and who can reach it.', status: 'confirmed' },
    { title: 'Your choice of model', body: 'Run a local model at no extra cost, or connect a cloud model on your own account and pay that provider directly.', status: 'confirmed' },
    { title: 'We are not in the data path', body: 'Documents, questions and answers pass between your people and your server. None of it comes through us.', status: 'confirmed' },
    { title: 'Answers you can check', body: 'The assistant cites the documents it used, and every citation opens the page it came from.', status: 'confirmed' },
  ] satisfies Point[],

  controls: [
    { title: 'Roles and permissions', body: 'Custom roles decide who sees which projects, clients and documents.', status: 'confirmed' },
    { title: 'Audit trail and security log', body: 'A full record of what happened and who did it, kept on your own server.', status: 'confirmed' },
    { title: 'Backups that are checked', body: 'Backups are verified, not just taken, so a restore is something you have already seen work.', status: 'confirmed' },
    { title: 'One database per company', body: 'Run for many companies, each gets a database of its own and can read its own access log.', status: 'confirmed' },
    { title: 'A data-flow document', body: 'For your security review: every component, and what each one sends where, in writing.', status: 'confirmed' },
    { title: 'Single sign-on', body: 'People sign in with the accounts your company already manages.', status: 'confirmed' },
    { title: 'Encrypted at rest and in transit', body: 'Documents, the index and backups are encrypted on disk and on the wire.', status: 'confirmed' },
    { title: 'Works offline', body: 'With a local model, the workroom keeps working with no internet connection at all.', status: 'confirmed' },
  ] satisfies Point[],

  deploy: [
    { title: 'On your own hardware', body: 'A server in your office or rack. Nothing about it is shared with anyone.', status: 'confirmed' },
    { title: 'On your VPS', body: 'A private server you rent, in the region you choose, under your own account.', status: 'confirmed' },
    { title: 'Run by a provider', body: 'An IT partner runs it for you and for other companies, each with its own database.', status: 'confirmed' },
  ] satisfies Point[],

  requirements: {
    note: 'A guide to sizing, not a limit. Bring your document count to a demo and we will size it with you.',
    rows: [
      { plan: 'Starter', server: '8 cores, 32 GB memory, 500 GB disk', model: 'Small local model on CPU, or a cloud model', status: 'sample' },
      { plan: 'Studio', server: '16 cores, 64 GB memory, 2 TB disk', model: 'One 24 GB GPU for a local model', status: 'sample' },
      { plan: 'Firm', server: '32 cores, 128 GB memory, 4 TB disk', model: 'Two 48 GB GPUs for larger local models', status: 'sample' },
    ] satisfies Requirement[],
  },

  /** the tools it connects to: each link runs from the company's own server
      to the company's own account, so none of them puts us in the data path */
  integrations: {
    title: 'Works with what you already use',
    note: 'Each one connects your server to your own account, and only where you link it. Nothing passes through us.',
    tools: [
      { name: 'GitHub', body: 'Link a repository and a branch to watch. A merged pull request can close its ticket.', flow: 'stages', status: 'confirmed' },
      { name: 'Figma', body: 'A linked file opens inside its project, every screen clickable, next to the tickets it belongs to.', flow: 'design', status: 'confirmed' },
      // the pricing page lists a Slack integration; what it does in the workroom is still to be written down
      { name: 'Slack', body: 'Connect your Slack workspace to the workroom.', status: 'draft' },
    ] satisfies Tool[],
  },

  compare: {
    ours: BRAND.name,
    theirs: 'A typical cloud assistant',
    rows: [
      { label: 'Where your documents live', ours: 'On your server', theirs: "In the vendor's cloud", status: 'confirmed' },
      { label: 'Which model answers', ours: 'Local, or a cloud model you choose', theirs: "The vendor's", status: 'confirmed' },
      { label: 'Who is in the data path', ours: 'You', theirs: 'The vendor', status: 'confirmed' },
      { label: 'How it is priced', ours: 'Per company, with a seat ceiling', theirs: 'Per seat, per month', status: 'confirmed' },
      { label: 'Answers cite their sources', ours: 'Yes, each opens its document', theirs: 'Varies', status: 'confirmed' },
    ] satisfies Comparison[],
    note: "Compared with assistants that run in their vendor's cloud. Each product's own terms have the details.",
  },

  questions: [
    { q: `Does any of our data reach ${BRAND.name}?`, a: 'No. We are not in the data path. Your documents, questions and answers stay between your people and your server.', status: 'confirmed' },
    { q: 'Can it run without a cloud model?', a: 'Yes. Run a local model on your own hardware, at no extra cost.', status: 'confirmed' },
    { q: 'What happens if we connect a cloud model?', a: "The assistant sends that provider what it needs to answer: the question and the passages it found. You connect it on your own account, under that provider's terms, and pay them directly.", status: 'confirmed' },
    { q: 'What do we give our security team?', a: 'The data-flow document: every component, and what each one sends where. Ask for it on the contact page.', status: 'confirmed' },
  ] satisfies Question[],
};

/* -------------------------------------------------------------- proof */
export const PROOF: { logos: Logo[]; quotes: Quote[]; stories: Story[] } = {
  logos: [
    { name: 'Halden & Partners', status: 'sample' },
    { name: 'Northwind Legal', status: 'sample' },
    { name: 'Meridian Studio', status: 'sample' },
    { name: 'Brightwater Health', status: 'sample' },
    { name: 'Kestrel Accounting', status: 'sample' },
    { name: 'Ostrava Engineering', status: 'sample' },
  ],

  quotes: [
    {
      text: 'Our contracts never left the building, and the assistant still found the clause faster than any of us.',
      name: 'Sample name', role: 'Managing partner', company: 'Northwind Legal', status: 'sample',
    },
    {
      text: 'We replaced four tools with one, and our clients finally stopped asking where their files go.',
      name: 'Sample name', role: 'Studio director', company: 'Meridian Studio', status: 'sample',
    },
    {
      text: 'The security review took an afternoon. The data-flow document answered every question before it was asked.',
      name: 'Sample name', role: 'Head of IT', company: 'Brightwater Health', status: 'sample',
    },
  ],

  stories: [
    {
      company: 'Northwind Legal', sector: 'Law firm', size: '38 people',
      headline: 'Twenty years of contracts, searchable in an afternoon.',
      summary: 'Every matter file went into one index on a server in their own rack. Associates ask in plain words and open the cited clause.',
      metrics: [{ value: '3 days to 1', label: 'to prepare a first draft' }, { value: '0', label: 'documents sent outside' }],
      workflows: ['assistant', 'report'],
      status: 'sample',
    },
    {
      company: 'Meridian Studio', sector: 'Design agency', size: '24 people',
      headline: 'Projects, hours and invoices in one room.',
      summary: 'Briefs, reviews and time tracking moved off five subscriptions and onto one VPS the studio controls.',
      metrics: [{ value: '5 to 1', label: 'tools in daily use' }, { value: '6 h', label: 'saved a week on reporting' }],
      workflows: ['design', 'time', 'views'],
      status: 'sample',
    },
    {
      company: 'Kestrel Accounting', sector: 'Accountancy', size: '61 people',
      headline: 'Client numbers that stay with the client.',
      summary: 'Run by their IT partner with a database per client company, each able to read its own access log.',
      metrics: [{ value: '1 week', label: 'from install to first answer' }, { value: '100%', label: 'of answers with a source' }],
      workflows: ['analytics', 'people'],
      status: 'sample',
    },
  ],
};

/* ------------------------------------------------------------ company */
export const COMPANY = {
  kicker: 'Company',
  title: 'AI for companies that cannot hand their documents over.',
  lede: `${BRAND.name} exists for firms whose work is their documents: contracts, drawings, client files, numbers. They should have the same assistant everyone else has, without sending any of it away.`,
  status: 'confirmed' as Status,

  values: [
    { title: 'Your data is not our business', body: 'We are not in the data path, and we have built nothing that needs us to be.', status: 'confirmed' },
    { title: 'Priced per company', body: 'A seat ceiling rather than a per-seat charge. Adding the tenth person should not feel like a decision.', status: 'confirmed' },
    { title: 'Honest about fit', body: 'We will tell you which plan is right for you, including when it is the cheapest one.', status: 'confirmed' },
    { title: 'No mailing list', body: 'We reply to the person who wrote. No newsletter, no drip sequence.', status: 'confirmed' },
  ] satisfies Point[],

  facts: [
    { label: 'Founded', value: '2024', status: 'sample' },
    { label: 'Based in', value: 'City, Country', status: 'sample' },
    { label: 'Team', value: '12 people', status: 'sample' },
    { label: 'Funding', value: 'Customer funded', status: 'sample' },
  ] satisfies Fact[],

  team: [
    { name: 'Sample name', role: 'Founder, product', bio: 'Spent ten years watching firms choose between useful AI and keeping their files private.', status: 'sample' },
    { name: 'Sample name', role: 'Engineering', bio: 'Builds the server side: the index, the model runtime and everything that keeps it on your hardware.', status: 'sample' },
    { name: 'Sample name', role: 'Design', bio: 'Makes a private, self-hosted product feel like it was never anything else.', status: 'sample' },
    { name: 'Sample name', role: 'Customer success', bio: 'Sets up demos on your own documents and stays on the line through install.', status: 'sample' },
  ] satisfies Person[],
};

/* ------------------------------------------------------------- footer */
/** the line under the name in the footer band, after the copyright */
export const FOOTER = {
  line: 'Built first for a Nepal-based agency · Files, index and memory stay on your server',
  status: 'confirmed' as Status,
};

/* -------------------------------------------------------------- legal */
const formRoute = SERVICES.contactEndpoint
  ? `It is sent to [the form provider], which passes it on to us at ${BRAND.email}.`
  : `Sending it opens your own email app with a message addressed to ${BRAND.email}; nothing is sent until you send that email.`;
const analyticsLine = SERVICES.analytics
  ? `We count visits with ${SERVICES.analytics.name}, which records no personal data and sets no cookies.`
  : 'We do not run analytics: nothing counts or follows your visit.';

export const LEGAL = {
  kicker: 'Legal',
  title: 'Privacy and legal',
  lede: 'What this website collects, what it does not, and who is responsible for it. The product itself runs on your servers; what it stores there is yours.',
  /** when these pages last changed, as it should read: "1 March 2026" */
  updated: '[date]',
  sections: [
    {
      id: 'privacy', title: 'Privacy',
      paragraphs: [
        `This website is run by [registered company name], [address] ("we"). This section covers the website at ${BRAND.url.replace('https://', '')} only.`,
        `The site collects only what you type into the contact form: your name, work email, company, team size and message. ${formRoute} We use it to reply to you and to set up a demo, and we delete it after [period] unless you become a customer.`,
        `Fonts, scripts and films are all served from this site itself; your browser does not contact anyone else to show it. ${analyticsLine}`,
        'Our host keeps standard server logs (address, time, page requested) for [period] to keep the site running and secure.',
        `You can ask what we hold about you, have it corrected or deleted, or object to its use, by writing to ${BRAND.email}. You can also complain to your data protection authority.`,
      ],
      status: 'draft',
    },
    {
      id: 'cookies', title: 'Cookies',
      paragraphs: [
        'This site sets no cookies. If you pause the motion or change the card arrangement, your browser remembers that choice on your own device, and it is never sent to us.',
      ],
      status: 'confirmed',
    },
    {
      id: 'terms', title: 'Terms of use',
      paragraphs: [
        `The films and copy on this site show ${BRAND.name} as it works today; features, plans and prices can change. Nothing here is an offer: the terms of a subscription are in the agreement you sign with us.`,
        'You may link to any page. Please do not copy the films or copy without asking.',
        'These terms are governed by the law of [country].',
      ],
      status: 'draft',
    },
    {
      id: 'accessibility', title: 'Accessibility',
      paragraphs: [
        'This site is built to be used with a keyboard, a screen reader, zoom and reduced motion. Every film has its steps written out beside it, nothing on the page moves once you pause motion, and every page reads without scripts or 3D.',
        `We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. If anything gets in your way, write to ${BRAND.email} and tell us where: we will fix it, or get you what you need another way.`,
      ],
      status: 'draft',
    },
    {
      id: 'imprint', title: 'Imprint',
      paragraphs: [
        '[Registered company name], [legal form]',
        '[Street and number], [postcode and city], [country]',
        `Represented by [managing director]. Email ${BRAND.email}.`,
        'Registered at [register court], number [registration number]. VAT ID [VAT number].',
      ],
      status: 'draft',
    },
  ] satisfies LegalSection[],
};
