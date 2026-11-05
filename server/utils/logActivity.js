const ActivityLog = require('../models/ActivityLog');

// Fire-and-forget: a logging failure must never break the request.
module.exports = async (userId, action, details = '') => {
  if (!userId) return;
  try {
    await ActivityLog.create({ user: userId, action, details });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
};
