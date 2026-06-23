const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../services/mongoClient");
const { hashPassword, verifyPassword, signToken } = require("../utils/cryptoAuth");
const authMiddleware = require("../middleware/authMiddleware");

const router = Router();

// Helper to validate email format
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Helper to validate password strength
function isStrongPassword(password) {
  // Min 8 characters, at least one letter and one number
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}

// POST /auth/register - Register a new user
router.post("/auth/register", async (req, res, next) => {
  try {
    const { name, email, organization, password } = req.body;

    // 1. Validate inputs
    if (!name || !email || !organization || !password) {
      return res.status(400).json({ error: "All fields are required (name, email, organization, password)" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email address format" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters long and contain both letters and numbers" });
    }

    const db = await getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check if user already exists
    const existingUser = await db.collection("users").findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email address already exists" });
    }

    // 3. Create and save the user document
    const userId = uuidv4();
    const hashedPassword = hashPassword(password);
    const newUser = {
      _id: userId,
      name: name.trim(),
      email: normalizedEmail,
      organization: organization.trim(),
      password: hashedPassword,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection("users").insertOne(newUser);

    // 4. Generate JWT
    const token = signToken({
      id: userId,
      name: newUser.name,
      email: newUser.email,
      organization: newUser.organization
    });

    res.status(201).json({
      token,
      user: {
        id: userId,
        name: newUser.name,
        email: newUser.email,
        organization: newUser.organization
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login - Log in an existing user
router.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const db = await getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Find user
    const user = await db.collection("users").findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 2. Verify password hash
    const isValid = verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // 3. Generate token
    const token = signToken({
      id: user._id,
      name: user.name,
      email: user.email,
      organization: user.organization
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        organization: user.organization
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /users/profile - Get current user profile (Protected)
router.get("/users/profile", authMiddleware, async (req, res, next) => {
  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: "User profile not found" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      organization: user.organization,
      created_at: user.created_at
    });
  } catch (err) {
    next(err);
  }
});

// PUT /users/profile - Update profile details (Protected)
router.put("/users/profile", authMiddleware, async (req, res, next) => {
  try {
    const { name, email, organization } = req.body;

    if (!name || !email || !organization) {
      return res.status(400).json({ error: "All profile fields are required (name, email, organization)" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email address format" });
    }

    const db = await getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // Check if new email is taken by another user
    const emailOwner = await db.collection("users").findOne({ email: normalizedEmail });
    if (emailOwner && emailOwner._id !== req.user.id) {
      return res.status(400).json({ error: "This email address is already in use by another account" });
    }

    // Update document
    const result = await db.collection("users").updateOne(
      { _id: req.user.id },
      {
        $set: {
          name: name.trim(),
          email: normalizedEmail,
          organization: organization.trim(),
          updated_at: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // Generate fresh token with updated information
    const token = signToken({
      id: req.user.id,
      name: name.trim(),
      email: normalizedEmail,
      organization: organization.trim()
    });

    res.json({
      success: true,
      token,
      user: {
        id: req.user.id,
        name: name.trim(),
        email: normalizedEmail,
        organization: organization.trim()
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /users/change-password - Change user password (Protected)
router.put("/users/change-password", authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: "New password must be at least 8 characters long and contain both letters and numbers" });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 1. Verify old password
    const isOldValid = verifyPassword(currentPassword, user.password);
    if (!isOldValid) {
      return res.status(400).json({ error: "Incorrect current password" });
    }

    // 2. Hash and save new password
    const newHashed = hashPassword(newPassword);
    await db.collection("users").updateOne(
      { _id: req.user.id },
      {
        $set: {
          password: newHashed,
          updated_at: new Date()
        }
      }
    );

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
