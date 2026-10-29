/*
 * Counting the two things worth knowing (which films people open, and demo
 * requests) through whatever privacy-friendly analytics the build loaded
 * (SERVICES.analytics in @site/content). Plausible and Umami are understood;
 * with neither on the page, this does nothing. Page views need no help: both
 * follow the address bar on their own.
 */
type Plausible = (event: string, options?: { props?: Record<string, string> }) => void;
type Umami = { track(event: string, data?: Record<string, string>): void };

export function track(event: string, props?: Record<string, string>): void {
  const w = window as unknown as { plausible?: Plausible; umami?: Umami };
  try {
    if (w.plausible) w.plausible(event, props ? { props } : undefined);
    else w.umami?.track(event, props);
  } catch { /* counting never gets to break the page */ }
}
