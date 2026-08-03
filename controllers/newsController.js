const fs = require("fs");
const path = require("path");
const News = require("../models/News");
const { sanitizeHtml, isEmptyHtml } = require("../utils/sanitizeHtml");

/**
 * News / blog posts.
 *
 * Reads are public (the website renders them anonymously).
 * Writes are restricted to IT Admins by the route middleware.
 */

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "news");

/** Remove an uploaded file, ignoring anything outside the news upload dir. */
function removeImageFile(imagePath) {
  if (!imagePath) return;
  const filename = path.basename(imagePath);
  const full = path.join(UPLOAD_DIR, filename);
  if (!full.startsWith(UPLOAD_DIR)) return; // traversal guard
  fs.promises.unlink(full).catch(() => {});
}

/** Shape a post for the public website. */
function toPublic(doc) {
  return {
    _id: doc._id,
    title: doc.title,
    content: doc.content,
    image: doc.image || "",
    publishDate: doc.publishDate,
    excerpt: doc.excerpt ? doc.excerpt() : "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/news            – public, published only, newest first     */
/* Optional: ?limit=6                                                  */
/* ------------------------------------------------------------------ */
exports.listPublished = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const posts = await News.find({ isPublished: true })
      .sort({ publishDate: -1, createdAt: -1 })
      .limit(limit);

    res.json({ success: true, count: posts.length, data: posts.map(toPublic) });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* GET /api/news/:id        – public single post                       */
/* ------------------------------------------------------------------ */
exports.getById = async (req, res, next) => {
  try {
    const post = await News.findById(req.params.id);
    if (!post || !post.isPublished) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    res.json({ success: true, data: toPublic(post) });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* GET /api/news/admin/all  – IT Admin, includes unpublished           */
/* ------------------------------------------------------------------ */
exports.listAll = async (req, res, next) => {
  try {
    const posts = await News.find({}).sort({ publishDate: -1, createdAt: -1 });
    res.json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* POST /api/news           – IT Admin, multipart (image optional)     */
/* ------------------------------------------------------------------ */
exports.createPost = async (req, res, next) => {
  try {
    const { title, content, publishDate, isPublished } = req.body;

    // Rich text is sanitised before storage so unsafe markup is never persisted.
    const safeContent = sanitizeHtml(content);

    if (!title || !String(title).trim() || isEmptyHtml(safeContent)) {
      if (req.file) removeImageFile(req.file.filename);
      return res
        .status(400)
        .json({ success: false, message: "Title and content are required" });
    }

    const post = await News.create({
      title: String(title).trim(),
      content: safeContent,
      image: req.file ? `/uploads/news/${req.file.filename}` : "",
      publishDate: publishDate ? new Date(publishDate) : new Date(),
      isPublished: isPublished === "false" ? false : true,
      createdBy: req.portalUser?._id || null,
    });

    res
      .status(201)
      .json({ success: true, message: "News post published", data: post });
  } catch (err) {
    if (req.file) removeImageFile(req.file.filename);
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* PUT /api/news/:id        – IT Admin                                 */
/* ------------------------------------------------------------------ */
exports.updatePost = async (req, res, next) => {
  try {
    const post = await News.findById(req.params.id);
    if (!post) {
      if (req.file) removeImageFile(req.file.filename);
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const { title, content, publishDate, isPublished, removeImage } = req.body;

    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ success: false, message: "Title cannot be empty" });
      }
      post.title = String(title).trim();
    }
    if (content !== undefined) {
      const safeContent = sanitizeHtml(content);
      if (isEmptyHtml(safeContent)) {
        return res.status(400).json({ success: false, message: "Content cannot be empty" });
      }
      post.content = safeContent;
    }
    if (publishDate !== undefined && publishDate) post.publishDate = new Date(publishDate);
    if (isPublished !== undefined) post.isPublished = isPublished === "false" ? false : true;

    // Replacing the image removes the old file so uploads don't accumulate.
    if (req.file) {
      const old = post.image;
      post.image = `/uploads/news/${req.file.filename}`;
      removeImageFile(old);
    } else if (removeImage === "true" && post.image) {
      removeImageFile(post.image);
      post.image = "";
    }

    post.updatedBy = req.portalUser?._id || null;
    await post.save();

    res.json({ success: true, message: "News post updated", data: post });
  } catch (err) {
    if (req.file) removeImageFile(req.file.filename);
    next(err);
  }
};

/* ------------------------------------------------------------------ */
/* DELETE /api/news/:id     – IT Admin                                 */
/* ------------------------------------------------------------------ */
exports.deletePost = async (req, res, next) => {
  try {
    const post = await News.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const image = post.image;
    await post.deleteOne();
    removeImageFile(image);

    res.json({ success: true, message: "News post deleted" });
  } catch (err) {
    next(err);
  }
};
