/*
 * The outside services the site can use. All of them are off until set, and
 * the site works without any: the build reads these to wire the page and to
 * open its security policy to exactly the hosts named here, no wider.
 */
export interface Analytics {
  /** the provider's script, e.g. 'https://plausible.io/js/script.js' */
  src: string;
  /** attributes the script needs, e.g. { 'data-domain': 'example.com' } */
  attrs?: Record<string, string>;
  /** the provider's name, as the privacy page should say it */
  name: string;
}

export interface Services {
  /**
   * Where the contact form sends its fields, as JSON (Formspree, Basin, your
   * own endpoint...). Empty: the form opens the visitor's own email app,
   * addressed to BRAND.email with everything they typed, so no request is
   * ever lost, only sent by hand.
   */
  contactEndpoint: string;
  /** a scheduling page (Cal.com, Calendly...) offered next to the form. Empty: not offered */
  bookingUrl: string;
  /** privacy-friendly analytics, loaded only by built pages. null: none, and the privacy page says so */
  analytics: Analytics | null;
  /**
   * Until the real services are set, run the form and the booking against a
   * stand-in that `npm run dev` and `npm run preview` answer: messages and
   * bookings land in .demo/inbox.jsonl and on /__demo/inbox, and the
   * contact page offers a demo scheduler. A real endpoint or booking link
   * takes over from it as soon as it is set. A real host has no stand-in, so
   * `npm run check -- --launch` fails while this is on.
   */
  demo: boolean;
}

export const SERVICES: Services = {
  contactEndpoint: '',
  bookingUrl: '',
  analytics: null,
  demo: true,
};

/** where the demo stand-in answers, on the site's own origin */
export const DEMO_API = '/api/demo';
export const DEMO_INBOX = '/__demo/inbox';

/** where the form actually sends: the real endpoint, the stand-in in demo mode, or nowhere (the email app) */
export const formEndpoint = SERVICES.contactEndpoint || (SERVICES.demo ? `${DEMO_API}/contact` : '');

/** how a visitor picks a time: a real scheduling page, the demo scheduler, or not at all */
export const bookingMode: 'link' | 'demo' | 'none' = SERVICES.bookingUrl ? 'link' : SERVICES.demo ? 'demo' : 'none';
