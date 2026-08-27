/* CLOUDFLARE WEB ANALYTICS, WIRED AS ONE VALUE THAT TWO SURFACES READ.
 *
 * WHY THE SNIPPET IS IN THE PAGE AND NOT INJECTED AT THE EDGE. Automatic setup
 * was the original plan and `public/_headers` still omits `no-transform` for
 * it. It does not reach this site. Measured on the live host on 2026-08-27:
 * every documented precondition holds -- the zone answers on Cloudflare
 * addresses, the HTML parses, the HTML's `Cache-Control` is
 * `public, max-age=0, must-revalidate` -- and the served page carries no
 * `cloudflareinsights`, no `beacon.min.js` and no `cf-beacon`. The probe that
 * settles it is `/cdn-cgi/rum`, which is where the beacon reports: it answers
 * 404 while `/cdn-cgi/trace` on the same host answers 200, so Cloudflare's own
 * path is live and RUM is not on it. The site is enabled in the dashboard. A
 * response served by a Workers static-assets binding does not get the
 * injection.
 *
 * WHY THAT IS THE BETTER ANSWER ANYWAY. Edge injection leaves no trace in this
 * repository. `/privacy` would describe a reach measurement whose existence
 * depends on a dashboard toggle nobody here can see, and the day somebody flips
 * it the legal page silently starts lying. A snippet in the page is auditable
 * by reading the page.
 *
 * THE TOKEN IS PUBLIC AND BELONGS IN THE HTML. It identifies a site to the
 * beacon endpoint; it authorises nothing and grants no read access to the data.
 * It is not a secret and is deliberately not in the OS secret store or an env
 * var, both of which would imply it is one. */

/** The Web Analytics site token, from the dashboard's JS snippet. `null`
 *  disables the whole feature, and that is a supported state rather than a
 *  broken one -- see BEACON below. */
export const BEACON_TOKEN: string | null = null;

/* THE ONE FACT, SO THE TWO SURFACES CANNOT DISAGREE.
 *
 * `Base.astro` renders the beacon when this is true and `privacy.astro` renders
 * the reach-measurement section when this is true. They read the same boolean,
 * so the page cannot describe a measurement that is not running, and cannot run
 * one it does not describe.
 *
 * That failure was real and it was live. Between the first deploy and this
 * change, `/privacy` carried a full reach-measurement section -- what is
 * processed, how it is hashed, six months of availability -- while nothing was
 * being measured at all. The error ran in the harmless direction, declaring
 * more than happened rather than less, but a legal page that does not describe
 * the site is a legal page that has to be rewritten rather than reasoned with.
 * Tying both to one value is what stops it recurring. ADR 0261. */
export const BEACON = BEACON_TOKEN !== null;
