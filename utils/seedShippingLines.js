/**
 * Populate the shipping-line suggestion list.
 *
 * Sources, merged and de-duplicated case/whitespace-insensitively:
 *   1. The built-in list the frontend previously hardcoded.
 *   2. Every distinct `shipping_lines` value already present in existing
 *      origin_forms / railfreightforms records — so nothing a user has already
 *      used disappears from the dropdown.
 *
 * NON-DESTRUCTIVE: only inserts into `shippinglines`. Existing form records are
 * read, never modified.
 *
 * Usage:
 *   node utils/seedShippingLines.js --dry-run
 *   node utils/seedShippingLines.js
 */
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const ShippingLine = require("../models/ShippingLine");
const { normalizeShippingLine, cleanDisplayName } = require("../models/ShippingLine");

dotenv.config();

// The list that used to live in the frontend component.
const BUILT_IN = [
  "Allcargo Logistics", "Antong Holdings", "Arkas Line", "ANL", "Bahri",
  "Balaji Shipping", "CMA CGM", "COSCO", "Econ Line", "Emirates Shipping",
  "Evergreen", "FESCO LINE", "Gold Star Line", "Goodrich Maritime", "HMM",
  "Hapag-Lloyd", "Interasia Line", "IRISL", "INOX", "KMTC", "Maersk",
  "Maxicon Shipping Agencies", "MSC", "NAVIS", "NAVIO", "ONE", "OOCL", "PIL",
  "SCI", "SITC Container", "SM Line", "Samudera Shipping",
  "Sarjak Container Lines", "SeaLead Shipping", "Sealand", "Shreyas",
  "Sinokor Merchant", "TASS", "TGLS", "Trans Asia", "TLPL", "TS Lines",
  "Transworld Group", "Turkon Line", "UAFL", "Unifeeder", "UNITED LINER",
  "WINWIN Lines", "Wan Hai", "X-Press Feeders", "Yang Ming", "ZIM",
];

(async () => {
  const dryRun = process.argv.includes("--dry-run");

  try {
    await connectDB();
    const db = mongoose.connection.db;

    console.log(dryRun ? "\nDRY RUN — nothing will be written.\n" : "\nSeeding shipping lines…\n");

    // Collect values already used in real records.
    const fromRecords = new Set();
    for (const col of ["origin_forms", "railfreightforms"]) {
      const values = await db.collection(col).distinct("shipping_lines");
      values.filter(Boolean).forEach((v) => fromRecords.add(String(v)));
    }
    console.log(`Distinct shipping lines found in existing records: ${fromRecords.size}`);

    // Merge, preferring the built-in spelling when both exist.
    const merged = new Map(); // normalized -> display
    for (const v of BUILT_IN) {
      const n = normalizeShippingLine(v);
      if (n) merged.set(n, cleanDisplayName(v));
    }
    let newFromRecords = 0;
    for (const v of fromRecords) {
      const n = normalizeShippingLine(v);
      if (n && !merged.has(n)) {
        merged.set(n, cleanDisplayName(v));
        newFromRecords++;
      }
    }
    console.log(`Built-in: ${BUILT_IN.length}   New from records: ${newFromRecords}   Total unique: ${merged.size}`);

    let inserted = 0;
    let skipped = 0;
    for (const [normalized, display] of merged) {
      const exists = await ShippingLine.findOne({ normalizedName: normalized });
      if (exists) {
        skipped++;
        continue;
      }
      if (!dryRun) {
        await ShippingLine.create({
          name: display,
          isSystem: BUILT_IN.some((b) => normalizeShippingLine(b) === normalized),
        });
      }
      inserted++;
    }

    console.log(`\nInserted: ${inserted}   Already present: ${skipped}`);

    if (!dryRun) {
      const total = await ShippingLine.countDocuments();
      console.log(`shippinglines collection now holds ${total} entries.`);
    } else {
      console.log("\nRe-run without --dry-run to apply.\n");
    }

    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
})();
