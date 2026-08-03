/**
 * Server-side sanitiser for rich text authored in the IT Admin editor.
 *
 * The frontend already sanitises before rendering, but content must never be
 * *stored* in an unsafe state — an attacker with a valid admin token, or a
 * future consumer of this API that forgets to sanitise, would otherwise be
 * able to persist active markup.
 *
 * Only the structural tags the editor can produce are kept. Everything else —
 * scripts, iframes, event handlers, javascript: URLs — is stripped.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u",
  "ul", "ol", "li", "a", "span", "div",
]);

// Inline styles are limited to the alignment the toolbar emits.
const SAFE_STYLE = /^\s*text-align:\s*(left|center|right|justify)\s*;?\s*$/i;
const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/)/i;

/** Escape the characters that could break out of a text node. */
const escapeText = (s) =>
  String(s)
    .replace(/&(?![a-zA-Z#0-9]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Keep only href/target/rel/style, and only with safe values. */
function sanitizeAttributes(tag, attrString) {
  if (!attrString) return "";
  const kept = [];
  const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;

  while ((m = attrRe.exec(attrString))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";

    if (name === "href" && tag === "a") {
      if (SAFE_URL.test(value.trim())) {
        kept.push(`href="${escapeText(value.trim())}"`);
      }
    } else if (name === "style") {
      if (SAFE_STYLE.test(value)) kept.push(`style="${escapeText(value.trim())}"`);
    }
    // Every other attribute (onclick, onerror, class, id, src…) is dropped.
  }

  // Links always open safely.
  if (tag === "a" && kept.some((a) => a.startsWith("href="))) {
    kept.push('target="_blank"', 'rel="noopener noreferrer"');
  }

  return kept.length ? ` ${kept.join(" ")}` : "";
}

/**
 * @param {string} html raw content from the client
 * @returns {string} sanitised HTML safe to store and render
 */
function sanitizeHtml(html) {
  if (!html) return "";

  let out = String(html);

  // Remove whole dangerous elements including their content.
  out = out.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|form|input|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  // …and any self-closing / unmatched versions of the same.
  out = out.replace(
    /<\s*\/?\s*(script|style|iframe|object|embed|link|meta|form|input|svg|math)\b[^>]*>/gi,
    ""
  );
  // Strip comments (can hide conditional markup).
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // Walk every remaining tag: keep the allow-listed ones, escape the rest.
  out = out.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, slash, rawTag, attrs) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ""; // drop the tag, keep its text
    if (slash) return `</${tag}>`;
    if (tag === "br") return "<br>";
    return `<${tag}${sanitizeAttributes(tag, attrs)}>`;
  });

  return out.trim();
}

/** True when the value contains no visible text. */
function isEmptyHtml(html) {
  return !String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

module.exports = { sanitizeHtml, isEmptyHtml };
