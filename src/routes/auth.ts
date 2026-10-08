import { Router } from "express";
import {
  changePasswordSchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "../schemas/auth.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "../utils/tokens.js";
import * as authService from "../services/authService.js";

const router = Router();

/**
 * Tokens are set as httpOnly cookies AND returned in the body. The cookies are
 * what the browser client uses; the body is what makes the API testable from
 * curl and Swagger UI, where cookies are awkward.
 */
router.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    setAuthCookies(res, result.tokens);
    res.status(201).json({ user: result.user, ...result.tokens });
  })
);

router.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    setAuthCookies(res, result.tokens);
    res.json({ user: result.user, ...result.tokens });
  })
);

router.get("/providers", (_req, res) => {
  res.json(authService.authProviders());
});

router.post(
  "/google",
  authLimiter,
  validate({ body: googleLoginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.loginWithGoogle(req.body.credential);
    setAuthCookies(res, result.tokens);
    res.json({ user: result.user, ...result.tokens });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    const result = await authService.refresh(token);
    setAuthCookies(res, result.tokens);
    res.json({ user: result.user, ...result.tokens });
  })
);

router.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await authService.getProfile(req.user!.id) });
  })
);

router.patch(
  "/me",
  requireAuth,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    res.json({ user: await authService.updateProfile(req.user!.id, req.body) });
  })
);

router.post(
  "/change-password",
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    const tokens = await authService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    // The change bumped tokenVersion, invalidating this session's own refresh
    // token too - so re-issue before responding, or the user is signed out of
    // the device they just used.
    setAuthCookies(res, tokens);
    res.json({ success: true });
  })
);

export default router;
