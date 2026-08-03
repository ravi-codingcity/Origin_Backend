const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/portalAuth");
const ctrl = require("../controllers/newsController");

/* ------------------------------------------------------------------ */
/* Featured image upload                                               */
/* ------------------------------------------------------------------ */
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "news");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Timestamp + sanitised original name keeps files unique and readable.
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WebP or GIF images are allowed"));
    }
    cb(null, true);
  },
});

// Surface multer errors as clean JSON instead of a 500.
const uploadImage = (req, res, next) =>
  upload.single("image")(req, res, (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5 MB or smaller"
          : err.message || "Image upload failed";
      return res.status(400).json({ success: false, message });
    }
    next();
  });

/* ------------------------------------------------------------------ */
/* Public reads — the website renders these anonymously                */
/* ------------------------------------------------------------------ */
router.get("/", ctrl.listPublished);

/* ------------------------------------------------------------------ */
/* IT Admin only — create / edit / delete                              */
/* ------------------------------------------------------------------ */
const itAdminOnly = [requireAuth, requireRole("it_admin")];

// Must precede "/:id" so "admin" isn't treated as an id.
router.get("/admin/all", itAdminOnly, ctrl.listAll);

router.post("/", itAdminOnly, uploadImage, ctrl.createPost);
router.put("/:id", itAdminOnly, uploadImage, ctrl.updatePost);
router.delete("/:id", itAdminOnly, ctrl.deletePost);

// Public single post (kept last so it doesn't shadow the routes above).
router.get("/:id", ctrl.getById);

module.exports = router;
