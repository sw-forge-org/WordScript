import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version;
export const APP_REPOSITORY_URL = "https://github.com/sw-forge-org/WordScript";
export const APP_ORGANIZATION_URL = "https://github.com/sw-forge-org";
export const APP_SITE_URL = "https://sw-labs.de/";
export const APP_RELEASE_WORKFLOW_URL = `${APP_REPOSITORY_URL}/actions/workflows/release.yml`;
export const APP_RELEASE_RUNBOOK_URL = `${APP_REPOSITORY_URL}/blob/main/docs/RELEASE_RUNBOOK.md`;

/**
 * THE HELP MENU'S FOUR, AND ONE OF THEM IS NULL ON PURPOSE (ADR 0069).
 *
 * A URL that does not resolve yet is a link that must not be drawn yet: a row
 * that opens a 404 is the same broken promise as a row that opens nothing, and
 * the Help row spent three legs unmounted for exactly that reason. So the
 * documentation is typed as ABSENT rather than pointed at a guess, and the
 * entry it belongs to is drawn disabled with the reason in its hint (ADR 0065)
 * instead of being left out — a missing entry teaches the reader the
 * documentation does not exist, which is not what is true.
 *
 * `APP_PRODUCT_URL` is the product's own site and is deliberately not
 * `APP_SITE_URL`, which is SW labs' and is what About's Project card links
 * under that name. Two different addresses under one constant is how a link
 * ends up saying the wrong thing on one of the two surfaces that use it.
 *
 * All three given by the owner on 2026-08-10.
 */
export const APP_PRODUCT_URL = "https://wordscript.dev";
export const APP_DISCORD_URL = "https://discord.com/invite/BHfApphz8h";
export const APP_DOCS_URL: string | null = null;