const express = require("express");
const c = require("../controllers/profileController");
const reviews = require("../controllers/reviewController");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { validateBody, validateQuery, validateId } = require("../middleware/validate");
const { singleImage } = require("../middleware/upload");

const router = express.Router();

// Own profile
router.get("/profile", authenticate, c.show);
router.put("/profile", authenticate, validateBody(c.schemas.update), c.update);
router.patch("/profile/language", authenticate, validateBody(c.schemas.language), c.setLanguage);
router.post("/profile/photo", authenticate, ...singleImage("avatars", "photo"), c.uploadPhoto);

// Public profiles and reviews of any user
router.get("/users/:id", validateId(), optionalAuth, c.publicProfile);
router.get("/users/:id/reviews", validateId(), validateQuery(reviews.schemas.list), reviews.forUser);

module.exports = router;
