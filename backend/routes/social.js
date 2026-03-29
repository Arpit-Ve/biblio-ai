const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// GET /api/social/leaderboard — Monthly reading leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({}, 'username displayName avatar stats streak badges plan')
      .sort({ 'stats.booksRead': -1 })
      .limit(20);

    const leaderboard = users.map((u, index) => ({
      rank: index + 1,
      username: u.username,
      displayName: u.displayName || u.username,
      avatar: u.avatar,
      booksRead: u.stats?.booksRead || 0,
      streak: u.streak?.current || 0,
      badges: u.badges?.length || 0,
      plan: u.plan
    }));

    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load leaderboard.' });
  }
});

// GET /api/social/profile/:username — Public profile
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -email -aiUsage')
      .populate('followers', 'username displayName avatar')
      .populate('following', 'username displayName avatar');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Only share public reading info
    const publicLibrary = user.library
      .filter(b => b.progress > 0)
      .sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt))
      .slice(0, 5);

    res.json({
      success: true,
      profile: {
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
        plan: user.plan,
        stats: user.stats,
        streak: user.streak,
        badges: user.badges,
        followers: user.followers.length,
        following: user.following.length,
        followerList: user.followers.slice(0, 10),
        followingList: user.following.slice(0, 10),
        recentReads: publicLibrary,
        reviews: user.reviews.slice(-5).reverse(),
        joinedAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load profile.' });
  }
});

// POST /api/social/follow/:userId
router.post('/follow/:userId', protect, async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself.' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const currentUser = await User.findById(req.user._id);
    const isFollowing = currentUser.following.includes(req.params.userId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(id => id.toString() !== req.params.userId);
      targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.user._id.toString());
      await Promise.all([currentUser.save(), targetUser.save()]);
      res.json({ success: true, message: `Unfollowed ${targetUser.displayName || targetUser.username}`, following: false });
    } else {
      // Follow
      currentUser.following.push(req.params.userId);
      targetUser.followers.push(req.user._id);
      await Promise.all([currentUser.save(), targetUser.save()]);
      res.json({ success: true, message: `Now following ${targetUser.displayName || targetUser.username}!`, following: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to follow user.' });
  }
});

// GET /api/social/feed — Reading activity feed from followed users
router.get('/feed', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const followedUsers = await User.find(
      { _id: { $in: user.following } },
      'username displayName avatar library reviews streak'
    );

    const feed = [];
    for (const followed of followedUsers) {
      // Recent reading activity
      const recentBooks = followed.library
        .filter(b => b.lastReadAt && (new Date() - new Date(b.lastReadAt)) < 7 * 24 * 60 * 60 * 1000)
        .slice(0, 2);

      for (const book of recentBooks) {
        feed.push({
          type: 'reading',
          user: { username: followed.username, displayName: followed.displayName, avatar: followed.avatar },
          book: { title: book.title, author: book.author, coverUrl: book.coverUrl, progress: book.progress },
          timestamp: book.lastReadAt
        });
      }

      // Recent reviews
      const recentReviews = followed.reviews
        .filter(r => (new Date() - new Date(r.createdAt)) < 7 * 24 * 60 * 60 * 1000)
        .slice(0, 1);

      for (const review of recentReviews) {
        feed.push({
          type: 'review',
          user: { username: followed.username, displayName: followed.displayName, avatar: followed.avatar },
          review: { title: review.title, rating: review.rating, text: review.review?.substring(0, 150) },
          timestamp: review.createdAt
        });
      }
    }

    feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, feed: feed.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load feed.' });
  }
});

// GET /api/social/search?q=username
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Search query required.' });

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.user._id }
    }).select('username displayName avatar stats streak badges').limit(10);

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Search failed.' });
  }
});

module.exports = router;
