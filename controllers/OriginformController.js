const Form = require("../models/OriginForm");
const cacheManager = require("../utils/cacheManager");

// Cache keys
const ALL_FORMS_CACHE_KEY = "all_forms";
const USER_FORMS_PREFIX = "user_forms_";

// Helper function to clear form-related cache
const clearFormCache = (userId = null) => {
  console.log("Clearing form cache to force refresh on next request");
  cacheManager.deleteCache(ALL_FORMS_CACHE_KEY);
  if (userId) {
    cacheManager.deleteCache(`${USER_FORMS_PREFIX}${userId}`);
  }
};

// Add cache-control headers to prevent browser caching
const setNoCacheHeaders = (res) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
};

const createForm = async (req, res) => {
  const {
    name,
    por,
    pol,
    pod,
    shipping_lines,
    container_type,
    bl_fees,
    thc,
    muc,
    toll,
    currency,
  } = req.body;
  const userId = req.user.id;

  try {
    const form = new Form({
      name,
      por,
      pol,
      pod,
      shipping_lines,
      container_type,
      bl_fees,
      thc,
      muc,
      toll,
      currency,
      createdBy: userId,
    });
    await form.save();

    // Clear cache when new form is created
    clearFormCache(userId);

    res.status(201).json({ msg: "Form created successfully", form });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

const editForm = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    if (form.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    Object.assign(form, req.body);
    await form.save();

    // Clear cache when form is edited
    clearFormCache(req.user.id);

    res.status(200).json(form);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteForm = async (req, res) => {
  try {
    const form = await Form.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    if (form.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await form.remove();

    // Clear cache when form is deleted
    clearFormCache(req.user.id);

    res.status(200).json({ message: "Form deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllForms = async (req, res) => {
  try {
    // Check if we need to force refresh based on query parameter
    const forceRefresh = req.query.refresh === "true";

    // Get cached data if available
    const cachedResult = cacheManager.getCache(ALL_FORMS_CACHE_KEY);

    // Check if we should use cache
    if (
      !forceRefresh &&
      cachedResult &&
      !cacheManager.isStale(ALL_FORMS_CACHE_KEY)
    ) {
      console.log("Cache hit: Returning cached forms");
      setNoCacheHeaders(res);
      return res.status(200).json(cachedResult.data);
    }

    console.log("Getting fresh data from database");

    // If cache is missing, stale, or refresh requested, fetch from database
    const fetchForms = async () => Form.find();

    let forms;
    if (forceRefresh) {
      // Force refresh the cache
      forms = await cacheManager.refreshCache(ALL_FORMS_CACHE_KEY, fetchForms);
    } else {
      // Get from database and update cache
      forms = await fetchForms();
      cacheManager.setCache(ALL_FORMS_CACHE_KEY, forms);
    }

    // Add cache-busting headers
    setNoCacheHeaders(res);

    // Return fresh data
    res.status(200).json(forms);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getUserForms = async (req, res) => {
  const userId = req.user.id;
  const cacheKey = `${USER_FORMS_PREFIX}${userId}`;

  try {
    // Check if we need to force refresh based on query parameter
    const forceRefresh = req.query.refresh === "true";

    // Get cached data if available
    const cachedResult = cacheManager.getCache(cacheKey);

    // Check if we should use cache
    if (!forceRefresh && cachedResult && !cacheManager.isStale(cacheKey)) {
      console.log("Cache hit: Returning cached user forms");
      setNoCacheHeaders(res);
      return res.status(200).json(cachedResult.data);
    }

    console.log("Getting fresh user forms from database");

    // If cache is missing, stale, or refresh requested, fetch from database
    const fetchUserForms = async () => Form.find({ createdBy: userId });

    let forms;
    if (forceRefresh) {
      // Force refresh the cache
      forms = await cacheManager.refreshCache(cacheKey, fetchUserForms);
    } else {
      // Get from database and update cache
      forms = await fetchUserForms();
      cacheManager.setCache(cacheKey, forms);
    }

    // Add cache-busting headers
    setNoCacheHeaders(res);

    // Return fresh data
    res.status(200).json(forms);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

module.exports = {
  createForm,
  editForm,
  deleteForm,
  getAllForms,
  getUserForms,
};
