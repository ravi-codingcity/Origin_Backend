const User = require('../../models/itAssets/ITUser');

// POST /api/v1/auth/signup
exports.signup = async (req, res, next) => {
  try {
    const { username, name, password, role } = req.body;

    if (!username || !name || !password) {
      return res.status(400).json({ success: false, message: 'username, name and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const user = await User.create({ username, name, password, role });
    res.status(201).json({ success: true, message: 'User registered successfully', data: user });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({ success: true, message: 'Login successful', data: { userId: user._id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ success: false, message: 'username and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save(); // pre-save hook hashes it

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};
