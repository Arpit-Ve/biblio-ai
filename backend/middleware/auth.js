const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
  }
};

// Check plan tier
const requirePlan = (...plans) => {
  return (req, res, next) => {
    if (!plans.includes(req.user.plan)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires one of these plans: ${plans.join(', ')}. Upgrade to continue.`
      });
    }
    next();
  };
};

// Check AI usage limits for free tier
const checkAILimit = async (req, res, next) => {
  const user = req.user;
  user.resetMonthlyUsage();

  const limits = { reader: 5, scholar: Infinity, author: Infinity };
  const limit = limits[user.plan];

  if (user.aiUsage.summaries >= limit) {
    return res.status(429).json({
      success: false,
      message: `You've used all ${limit} AI summaries for this month. Upgrade to Scholar for unlimited access.`,
      upgradeRequired: true
    });
  }

  next();
};

module.exports = { protect, requirePlan, checkAILimit };
