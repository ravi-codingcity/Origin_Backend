const mongoose = require("mongoose");

/**
 * News / blog post published on the public OmTrans website.
 *
 * Managed exclusively by IT Admins from the IT Assets portal. Reads are public
 * so the homepage and News page can render posts without authentication.
 *
 * `image` stores the served path (e.g. "/uploads/news/1234-photo.jpg"), not the
 * binary — the file itself lives on the server's filesystem.
 */
const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 250 },

    // Rich text (HTML) produced by the IT Admin editor. Sanitised on write.
    // The limit is generous because markup adds significant overhead.
    content: { type: String, required: true, trim: true, maxlength: 100000 },

    // Relative path to the uploaded featured image.
    image: { type: String, default: "" },

    publishDate: { type: Date, required: true, default: Date.now, index: true },

    // Unpublished posts stay in the admin list but are hidden from the site.
    isPublished: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "PortalUser", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "PortalUser", default: null },
  },
  { timestamps: true }
);

// Newest first — the ordering both the homepage and News page rely on.
newsSchema.index({ publishDate: -1, createdAt: -1 });

/** Short plain-text preview used by the public list views (tags stripped). */
newsSchema.methods.excerpt = function (length = 180) {
  const text = String(this.content || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|ul|ol)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};

const News = mongoose.model("News", newsSchema);

module.exports = News;
