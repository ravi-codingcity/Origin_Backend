const jwt = require("jsonwebtoken");

// Verifies the HR JWT. Returns 401 when missing/invalid, 403 when the
// token is valid but the user is not an HR. The frontend interceptor
// relies on these exact status codes to force a re-login.
module.exports = function jobAuth(req, res, next) {
  const authHeader = req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "hr") {
      return res.status(403).json({ message: "Forbidden: HR access only" });
    }

    req.hrUser = { id: decoded.id, username: decoded.username, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token is not valid" });
  }
};
