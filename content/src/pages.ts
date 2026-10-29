import { BRAND } from './brand.ts';

/*
 * Every address the site answers on, with what search engines and link
 * previews say about it. Workflow pages (/workflows/<key>/) take their title
 * and description from the workflow itself.
 */
export interface PageMeta {
  path: string;
  /** the short name: nav-style, in breadcrumbs and llms.txt */
  name: string;
  /** the search result's headline: says what the page is for, then the name */
  title: string;
  description: string;
}

export const PAGES = {
  home: {
    path: '/',
    name: BRAND.name,
    title: `${BRAND.name} · ${BRAND.descriptor}`,
    description: BRAND.summary,
  },
  pricing: {
    path: '/pricing/',
    name: 'Pricing',
    title: `Pricing per company, not per seat · ${BRAND.name}`,
    description: `Every ${BRAND.name} plan is the same product on your own server, priced per company rather than per question or per seat.`,
  },
  contact: {
    path: '/contact/',
    name: 'Contact',
    title: `Book a demo on your own documents · ${BRAND.name}`,
    description: 'Book a demo on your own documents, in your own workroom, with citations you can open. We reply within one working day.',
  },
  platform: {
    path: '/platform/',
    name: 'How it stays private',
    title: `How it stays private · ${BRAND.name}`,
    description: `${BRAND.name} runs on a server you control, with a local model or one you choose. What runs where, the controls your security team will ask about, and how it compares.`,
  },
  customers: {
    path: '/customers/',
    name: 'Customers',
    title: `Customers · ${BRAND.name}`,
    description: `Firms running ${BRAND.name} on their own hardware: what they moved into it, and what changed.`,
  },
  company: {
    path: '/company/',
    name: 'About',
    title: `About ${BRAND.name} · ${BRAND.descriptor}`,
    description: `Who makes ${BRAND.name}, and how we work: priced per company, honest about fit, never in your data path.`,
  },
  legal: {
    path: '/legal/',
    name: 'Privacy and legal',
    title: `Privacy and legal · ${BRAND.name}`,
    description: 'What this website collects and what it does not, its terms of use and its imprint.',
  },
  missing: {
    path: '/404.html',
    name: 'Not found',
    title: `Not found · ${BRAND.name}`,
    description: BRAND.summary,
  },
} as const satisfies Record<string, PageMeta>;

export const workflowPath = (key: string) => `/workflows/${key}/`;
