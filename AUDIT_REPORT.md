# Kosil / Umeed Retailer — Codebase Audit Report

**Date:** 2026-06-30
**Scope:** `backend/` (Express + TypeScript + MongoDB/Mongoose) and `frontend/` (React 18 + TypeScript + Vite)
**Method:** Manual review of auth, payments, wallet, sockets, and frontend state/security code, with each finding below re-verified directly against source after the initial pass.

Severity definitions used throughout:
- **Critical** — exploitable today by an unauthenticated or low-privilege external party, full account/data compromise.
- **High** — exploitable with some preconditions (timing, authenticated-but-wrong-role access, concurrency), or direct financial/data integrity impact.
- **Medium** — real bug or weakness, limited blast radius or requires specific conditions.
- **Low** — hygiene / defense-in-depth / minor correctness issue.

---

## Part 1 — Backend

### 🔴 CRITICAL

#### B1. Hardcoded OTP backdoor for a specific phone number
**File:** `backend/src/services/otpService.ts:206-208`, used at `:242-249` and again at the verify path (`:360-367`)

```ts
function isSpecialBypass(mobile: string): boolean {
  return mobile === '9111966732';
}
...
if (isSpecialBypass(mobile)) {
  const specialOtp = '1234';
  await saveOtpToDb(mobile, specialOtp, userType);
  return { success: true, sessionId: 'DB_VERIFIED_' + mobile, message: 'OTP sent successfully' };
}
```

**What's wrong:** Any account — Customer, Seller, Delivery, or Admin — registered against the mobile number `9111966732` will always have its OTP set to the static value `1234`, regardless of environment. There is no `NODE_ENV` check, no feature flag, nothing gating this. It's pure hardcoded logic shipped to production.

**Failure scenario:** Anyone (an attacker, a curious user, a competitor) who registers or already controls an account using that exact number — or who simply tries it against the login flow of an existing seller/admin/customer account that happens to share that number — can log in with OTP `1234` every single time. If that number is ever assigned to a real seller or admin account, it is a permanent, unauditable backdoor into that account.

**Recommendation:** Delete this function entirely. If a fixed-OTP testing path is genuinely needed for QA, gate it behind `process.env.NODE_ENV !== 'production'` AND a non-guessable test number that is rotated/never reused for real accounts.

---

#### B2. Unauthenticated admin account registration endpoint
**File:** `backend/src/routes/adminAuthRoutes.ts:14`, `backend/src/modules/admin/controllers/adminAuthController.ts:130-186`

```ts
// adminAuthRoutes.ts
router.post("/register", adminAuthController.register);   // no authenticate middleware

// adminAuthController.ts
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, mobile, email, password, role } = req.body;
  ...
  const admin = await Admin.create({
    firstName, lastName, mobile: normalizedMobile, email, password,
    role: role || "Admin",
  });
  const token = generateToken(admin._id.toString(), "Admin", admin.role);
  return res.status(201).json({ success: true, data: { token, ... } });
});
```

**What's wrong:** `POST /api/v1/auth/admin/register` has no `authenticate` middleware and no existing-admin/super-admin check of any kind — contrast this with `send-otp`/`verify-otp` on the same router, which at least have rate limiters attached. Worse, `role` is taken directly from the request body and defaults to `"Admin"`, and the endpoint immediately returns a valid signed JWT for the newly created account.

**Failure scenario:** Anyone on the internet can `curl -X POST /api/v1/auth/admin/register` with a body of `firstName/lastName/mobile/email/password` and receive back a fully privileged, logged-in Admin session token. This is full platform takeover — admin endpoints presumably control sellers, payouts, categories, etc.

**Recommendation:** Remove this route entirely (admins should be seeded/created by an existing super-admin through an authenticated, role-checked endpoint), or at minimum require an existing super-admin's JWT plus a `requireUserType('Admin', 'SuperAdmin')` check before allowing creation.

---

#### B3. Rate limiting is completely disabled (no-op) across the entire API, including login/OTP
**File:** `backend/src/middleware/rateLimiter.ts:1-61`

```ts
// import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
// TODO: Uncomment rate limiting when deploying to production
...
export const otpRateLimiter = (req, _res, next) => { ...; next(); };
export const loginRateLimiter = (req, _res, next) => { ...; next(); };
```

**What's wrong:** The actual `express-rate-limit` configurations (5 OTP requests/15min, 10 login attempts/15min) are fully commented out. The exported `otpRateLimiter` and `loginRateLimiter` — which are wired into every auth route across all four roles (`adminAuthRoutes.ts`, `customerAuthRoutes.ts`, `sellerAuthRoutes.ts`, `deliveryAuthRoutes.ts`) — are plain pass-through middleware that does nothing but call `next()`.

**Failure scenario:** Unlimited brute-force is possible against every OTP/login endpoint for every role. Combined with B1 (predictable OTP for a specific number) and B4 (universal bypass OTP), this removes the last layer that would have made those bugs harder to exploit at scale, and independently allows credential-stuffing/OTP-guessing attacks (a 4-digit OTP has only 10,000 combinations — trivially brute-forceable with no rate limit) against any account.

**Recommendation:** Uncomment and ship the real rate limiters before any production deploy. This is a one-line `git diff` away from being fixed — the working code already exists in the file as comments.

---

#### B4. Universal developer-bypass OTP gated only by `NODE_ENV`, which is never explicitly set
**File:** `backend/src/services/otpService.ts:220-222`, `:235-239`

```ts
function isDeveloperBypass(otp: string): boolean {
  return (process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OTP === 'true')
    && (otp === '999999' || otp === '9999');
}
```

and in `sendSmsOtp`:
```ts
if (process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OTP === 'true') {
  console.log(`[OTP DEBUG] Mobile: ${mobile}, Type: ${userType}, OTP: ${otp}`);
}
```

**What's wrong:** The universal bypass OTP (`999999`/`9999`) and the console-logging of real OTPs are both active whenever `NODE_ENV !== 'production'`. Checked `backend/package.json`: the `start` script is `"start": "node dist/server.js"` — it never sets `NODE_ENV=production`. Unless the hosting platform's deploy config explicitly exports `NODE_ENV=production` (not verifiable from this repo, and easy to forget), the app behaves as "non-production" by default, meaning:
1. Every account on the platform can be logged into using OTP `999999` (or `9999`), no SMS needed.
2. Real OTPs are printed to server logs in plaintext.

**Failure scenario:** If the deploy environment doesn't set `NODE_ENV=production` (a very common oversight with bare `node dist/server.js` start scripts on platforms like Render/Railway/a raw VM without an explicit env var), every single login on the live platform — customer, seller, delivery, admin — can be bypassed with the static OTP `999999`/`9999`.

**Recommendation:** Don't rely on `NODE_ENV` alone for a security-relevant bypass. Gate this behind an explicit `ENABLE_OTP_BYPASS=true` env var that defaults to unset/false, and assert at server startup that it is *not* set when other production indicators (e.g. a production Mongo URI) are present. Also remove the console logging of OTP values outside of a tightly scoped local-dev flag.

---

### 🟠 HIGH

#### B5. Seller wallet withdrawal — non-atomic balance check allows over-withdrawal
**File:** `backend/src/modules/seller/controllers/walletController.ts:135-175`

```ts
const seller = await Seller.findById(sellerId);
if (seller.balance < amount) {
  return res.status(400).json({ success: false, message: 'Insufficient balance' });
}
const withdrawRequest = await WithdrawRequest.create({ sellerId, amount, ... });
seller.balance -= amount;
await seller.save();
```

**What's wrong:** The balance read (`Seller.findById`), the check (`balance < amount`), and the write (`seller.balance -= amount; seller.save()`) are three separate, non-atomic steps with no MongoDB transaction/session and no `findOneAndUpdate` atomic guard (the kind of pattern correctly used elsewhere in the order/stock code — see "Things verified correct" below).

**Failure scenario:** A seller with ₹1,000 balance fires two concurrent withdrawal requests for ₹800 each (e.g. via two browser tabs or a simple script). Both requests read `balance = 1000` before either write lands, both pass the `1000 < 800` check, and both proceed — the seller withdraws ₹1,600 against a ₹1,000 balance, leaving the account negative with no system-level guard against it.

**Recommendation:** Use an atomic update: `Seller.findOneAndUpdate({ _id: sellerId, balance: { $gte: amount } }, { $inc: { balance: -amount } })` and check whether the result is null (insufficient balance) before creating the `WithdrawRequest`, or wrap the whole flow in a Mongo session/transaction.

#### B6. Same non-atomic withdrawal pattern in the shared wallet service (used by Delivery too)
**File:** `backend/src/services/walletManagementService.ts:240-265` (`validateWithdrawal`), `:315-355` (`createWithdrawalRequest`)

**What's wrong:** Identical structural issue to B5 — balance validation and request creation happen as separate reads/writes with no transaction or atomic guard, and this service is shared by Delivery partner withdrawals as well, doubling the exposure.

**Recommendation:** Same fix as B5 — atomic `findOneAndUpdate` with a balance guard, or a Mongo session wrapping validate+create+save.

#### B7. Client-supplied delivery/platform fees are trusted without server-side recomputation
**File:** `backend/src/modules/customer/controllers/customerOrderController.ts:344-351`

```ts
// Apply fees
const platformFee = Number(fees?.platformFee) || 0;
const deliveryFee = Number(fees?.deliveryFee) || 0;
const finalTotal = calculatedSubtotal + platformFee + deliveryFee;
```

**What's wrong:** `fees` comes straight from `req.body`. Item subtotal (`calculatedSubtotal`) is correctly recomputed server-side from the `Product` records earlier in this function (good — prevents price tampering on items), but `platformFee` and `deliveryFee` are taken verbatim from the client with no server-side recalculation against the seller's actual delivery radius/fee schedule or platform fee config.

**Failure scenario:** A malicious client (modified app, intercepted/replayed request, or a user with dev tools) submits `fees: { platformFee: 0, deliveryFee: 0 }` regardless of what the UI calculated, and the backend accepts it as-is. The customer pays less than they should, and depending on how commission/seller payout is calculated downstream from `order.total`, this could also under-credit the seller or platform.

**Recommendation:** Recompute `platformFee`/`deliveryFee` server-side from the same rules the frontend uses to display them (seller's configured delivery fee, distance-based logic already present a few lines above this code, and platform fee config), the same way `calculatedSubtotal` already is. Don't trust any monetary value from `req.body` directly.

#### B8. Tax management endpoints missing role restriction
**File:** `backend/src/routes/taxRoutes.ts:5-21`

```ts
router.use(authenticate);   // any authenticated role, not role-restricted
router.post('/', createTax);                 // comment: "Admin should ideally do this..."
router.patch('/:id/status', updateTaxStatus);
```

**What's wrong:** Every route on this router only requires `authenticate` (valid JWT, any role) — there is no `requireUserType('Admin')` or similar. The in-code comment ("Admin should ideally do this, but seller management has a page for it in this app it seems") acknowledges the intended access boundary but it was never enforced.

**Failure scenario:** Any authenticated Customer or Delivery-partner account — not just sellers — can call `POST /api/v1/taxes` or `PATCH /api/v1/taxes/:id/status` to create new tax rates or activate/deactivate existing ones platform-wide, since the endpoint has no ownership/role scoping at all.

**Recommendation:** Add `requireUserType('Seller')` (matching the comment's intent) or move this under the Admin-gated routes if tax rates are meant to be platform-global rather than per-seller.

#### B9. Socket.io room-join events have no authorization check
**File:** `backend/src/socket/socketService.ts:120-217`

```ts
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next();   // unauthenticated connections allowed through
  ...
});

socket.on('join-seller-room', (sellerId: string) => {
  socket.join(`seller-${String(sellerId).trim()}`);   // no check that socket.user.userId === sellerId
});

socket.on('join-delivery-room', (deliveryPartnerId: string) => { socket.join(`delivery-${deliveryPartnerId}`); });
socket.on('join-delivery-notifications', (deliveryBoyId: string) => { socket.join(`delivery-${deliveryBoyId}`); });
```

**What's wrong:** The connection middleware explicitly allows unauthenticated sockets through (`if (!token) return next()`). And even for authenticated sockets, none of `join-delivery-room`, `join-seller-room`, or `join-delivery-notifications` verify that the connecting socket's authenticated identity matches the `sellerId`/`deliveryPartnerId` being joined — contrast this with `track-order` a few lines above (`:142-173`), which *correctly* does `Order.findOne({ _id: orderId, customer: user.userId })` before allowing the join.

**Failure scenario:** Any client — including one that never sent an auth token at all — can connect and call `socket.emit('join-seller-room', '<any sellerId>')` to silently receive that seller's live order/notification stream (new orders, statuses, etc.), or similarly eavesdrop on any delivery partner's notification room. This is an information-disclosure issue affecting business-sensitive order flow data.

**Recommendation:** Reject unauthenticated socket connections outright (don't allow `next()` without a valid token for any room-based feature), and check `socket.user.userId === sellerId` (or the equivalent ownership check via DB lookup, as `track-order` already demonstrates) before allowing a join.

---

### 🟡 MEDIUM

#### B10. JWT secret has a weak, predictable hardcoded fallback
**File:** `backend/src/services/jwtService.ts:10`

```ts
process.env.JWT_SECRET || 'your-secret-key-change-in-production'
```

**What's wrong:** If `JWT_SECRET` is ever unset due to deploy misconfiguration, every token across all roles (including Admin) is signed and verifiable using a publicly-known string visible in this very repo. Note also `socketService.ts:130` does `jwt.verify(token, process.env.JWT_SECRET as string)` with **no fallback at all** — inconsistent behavior between the two: one silently falls back to a guessable secret, the other throws on `undefined`.

**Recommendation:** Fail fast at server startup if `JWT_SECRET` is not set (`if (!process.env.JWT_SECRET) throw new Error(...)`), rather than silently falling back to a hardcoded value anywhere in the codebase.

#### B11. Razorpay webhook signature verified against re-serialized JSON, not raw request bytes
**File:** `backend/src/server.ts:92` (global `express.json()` with no raw-body capture for the webhook route), `backend/src/services/paymentService.ts` (~line 290, `crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(body))`)

**What's wrong:** Razorpay signs the literal raw bytes it sends in the webhook POST body. This code re-serializes the already-`JSON.parse`'d body via `JSON.stringify(body)` before hashing it, which is not guaranteed to byte-for-byte match what Razorpay originally sent (key ordering, whitespace, number formatting can all differ). At minimum this is a functional bug that can cause legitimate webhook signatures to fail verification intermittently; in the worst case it weakens the integrity guarantee the signature is supposed to provide.

**Recommendation:** Use `express.raw({ type: 'application/json' })` specifically for the webhook route (before the global `express.json()` middleware, or excluded from it) and compute the HMAC over the raw `Buffer`, not a re-stringified object.

#### B12. Several admin list endpoints return unbounded result sets
**Files:** `backend/src/modules/admin/controllers/adminBannerController.ts:9`, `adminBestsellerCardController.ts:10,254`, `adminHomeSectionController.ts:8,255`, `adminLowestPricesController.ts:9,242`

**What's wrong:** These call `.find()` with no `.limit()` and no pagination. Currently low risk since these are small admin-configuration collections (banners, bestseller cards, home sections), but there's no ceiling if any of them grow significantly.

**Recommendation:** Add pagination (`.skip().limit()`) consistent with how other list endpoints in the codebase already do it (e.g. order listing), even if the limit is generous.

---

### 🟢 LOW

#### B13. Stray/garbage files committed to source
**Files:** `backend/src/middleware/text.txt` (contains only the string `sdjfgncx`), `backend/src/middleware/auth.ts:15` (a stray nonsense comment `// edndgvoercnewrecc`)

**What's wrong:** Leftover scratch artifacts accidentally committed. Not a security issue by itself, but suggests the repo may contain other unreviewed leftover content and is worth a cleanup pass.

**Recommendation:** Delete `text.txt` and the stray comment.

#### B14. CORS rejection is silent
**File:** `backend/src/server.ts:70-72`

**What's wrong:** Disallowed origins get `callback(null, false)` rather than an error — functionally fine (browser still blocks), but rejected origins aren't logged, making misconfiguration hard to detect. The allow-list is also independently duplicated in `backend/src/socket/socketService.ts:46-86`, risking drift between HTTP and WebSocket CORS policy over time.

**Recommendation:** Log rejected origins, and extract the allow-list into one shared constant used by both Express CORS config and Socket.io CORS config.

---

### ✅ Backend — verified correct (no issue)
- **Razorpay payment signature verification** (`paymentService.ts` `verifyPaymentSignature`) correctly recomputes the HMAC server-side; order ownership is checked before capture in `paymentRoutes.ts:32,78`.
- **Order creation uses atomic `findOneAndUpdate`** with `$gte` stock guards to prevent overselling — a good pattern that B5/B6 should be made consistent with.
- **Customer order endpoints** (`getOrderById`, `cancelOrder`) correctly scope queries by `{ customer: userId }` — no IDOR found.
- Most route files correctly apply `authenticate` + `requireUserType` at the router level via `router.use()`.
- No hardcoded third-party API keys found in source; Cloudinary/Razorpay/SMS credentials are all environment-sourced.
- bcrypt salt rounds (10) and `bcrypt.compare` usage are correct across `Admin.ts`, `Seller.ts`, `Delivery.ts`.
- No NoSQL injection via `$where` or unsanitized operator injection found in reviewed controllers.

---

## Part 2 — Frontend

### 🟠 HIGH

#### F1. Razorpay checkout component re-initiates payment on every parent re-render
**File:** `frontend/src/components/RazorpayCheckout.tsx:29-112`

```tsx
useEffect(() => {
  const initiatePayment = async () => {
    await loadRazorpayScript();
    const order = await createRazorpayOrder(orderId);
    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };
  initiatePayment();
}, [orderId, amount, customerDetails, onSuccess, onFailure]);
```

**What's wrong:** The dependency array includes `customerDetails` (an object) and `onSuccess`/`onFailure` (functions). The caller, `Checkout.tsx`, passes these as fresh object/arrow-function literals on every render — so the effect's dependency list is never referentially stable. Any state change in `Checkout.tsx` while this modal is mounted (a toast appearing, a loading flag flipping, anything) causes React to treat the deps as "changed," re-running the effect: it re-injects the Razorpay script tag and calls `createRazorpayOrder(orderId)` again.

**Failure scenario:** A user sees a flickering or duplicated Razorpay modal during checkout, and the backend may log multiple order-creation calls for what the user perceives as a single checkout attempt. Depending on backend idempotency (not deeply audited here), this could create duplicate pending Razorpay orders.

**Recommendation:** Memoize `customerDetails` with `useMemo` and the callbacks with `useCallback` in `Checkout.tsx`, or — more robustly — gate the effect in `RazorpayCheckout.tsx` with a `useRef` "already initiated" flag so it only runs once per mount regardless of prop identity churn.

#### F2. No request-cancellation guard in product search — stale responses can overwrite fresh results
**File:** `frontend/src/modules/user/Search.tsx:27-53`

```tsx
useEffect(() => {
  const fetchProducts = async () => {
    const response = await getProducts(params);
    setSearchResults(response.data as unknown as Product[]);
  };
  fetchProducts();
}, [sanitizedQuery, location]);
```

**What's wrong:** Each time `sanitizedQuery` changes, a new request fires with no `AbortController` and no check that the response being applied corresponds to the latest query. A `grep` across the frontend found only 4 total `AbortController` usages in the whole codebase, and the project already has the correct pattern available — `frontend/src/context/LocationContext.tsx:142-164` uses a `cancelled` flag to guard against exactly this — it's just not applied here.

**Failure scenario:** User types "milk" then quickly "bread". If the "milk" response (slower, e.g. due to network variance) resolves after the "bread" response, `setSearchResults` overwrites the correct "bread" results with stale "milk" results — the visible search results no longer match the search box content.

**Recommendation:** Add a `cancelled` flag or `AbortController` in the effect cleanup, matching the existing `LocationContext.tsx` pattern, so out-of-order responses are discarded.

#### F3. Single shared `authToken` localStorage key across all four user roles
**File:** `frontend/src/services/api/config.ts:186-199`, `frontend/src/context/AuthContext.tsx:33-57`

```ts
export const setAuthToken = (token: string) => { localStorage.setItem("authToken", token); };
export const getAuthToken = (): string | null => { return localStorage.getItem("authToken"); };
```

**What's wrong:** Admin, Seller, Customer, and Delivery portals all read/write the same `authToken` / `userData` localStorage keys through one shared axios instance and one Bearer-token interceptor. There's no per-role namespacing at the storage layer at all — separation between roles relies entirely on (a) the backend issuing role-scoped JWTs and enforcing them server-side, and (b) frontend route guards.

**Failure scenario:** Not independently exploitable purely from frontend code (the backend's role checks are the real boundary — see backend section, where most of those checks were verified as present). But it's an architecturally fragile design: it means only one role can be "logged in" per browser at a time (logging into the seller portal silently logs you out of the customer portal in the same browser), and it means any future bug where a backend endpoint fails to check the JWT's role claim becomes immediately exploitable client-side with zero extra effort, since the token is already sitting in a generic, unscoped slot.

**Recommendation:** Namespace the storage key by role (`authToken_seller`, `authToken_customer`, etc.) or, better, migrate to httpOnly cookies set per subdomain/path so the token isn't readable by JS at all (also closes part of F-XSS concerns below).

#### F4. Sockets not explicitly disconnected on logout
**File:** `frontend/src/hooks/useSocketManager.ts:110-117` (exposes `disconnectGlobalSocket()`), logout handlers at `frontend/src/modules/seller/components/SellerHeader.tsx:61`, `frontend/src/modules/admin/components/AdminHeader.tsx:44`, `frontend/src/modules/delivery/components/DeliveryMenu.tsx:165`

**What's wrong:** A `disconnectGlobalSocket()` helper exists specifically for this purpose, but none of the three logout call sites call it. The socket only disconnects indirectly when a consuming component's `useEffect` (keyed on `token`/`userId`) happens to re-run its cleanup — which is timing-dependent, not deterministic at the moment of logout.

**Failure scenario:** Mostly a robustness/correctness issue rather than a security hole — on a shared device, a brief window could exist post-logout where the previous session's socket is still connected and could still receive room-scoped events before the cleanup effect catches up.

**Recommendation:** Call `disconnectGlobalSocket()` explicitly inside every logout handler, rather than relying on incidental effect-cleanup timing.

---

### 🟡 MEDIUM

#### F5. JWT stored in plain `localStorage` — exposed to any XSS
**File:** `frontend/src/services/api/config.ts:187-193`

**What's wrong:** No httpOnly/secure cookie boundary — any successful XSS anywhere in the app (even a low-severity one) can read the token directly via `localStorage.getItem('authToken')` and exfiltrate it. The audit didn't find an exploitable XSS (see F9 below, low severity), but this is a defense-in-depth gap: there's no second layer of protection if one is ever introduced.

**Recommendation:** Consider migrating to httpOnly, secure, sameSite cookies issued by the backend, which would make the token inaccessible to JS entirely. This is a bigger architectural change than the others — worth planning rather than a quick patch.

#### F6. Single app-wide `ErrorBoundary` — one crash takes down the whole SPA
**File:** `frontend/src/App.tsx:310`

**What's wrong:** Only one `ErrorBoundary` exists in the entire codebase, wrapping the entire `AppContent` tree. A runtime error in any single page (e.g. one broken admin report widget) crashes the whole app to a generic "Something went wrong" + reload screen instead of isolating the failure to the broken section.

**Recommendation:** Add per-route or per-module `ErrorBoundary` wrappers (at minimum one per role-portal: admin/seller/delivery/customer), so a bug in one area doesn't take down the others.

#### F7. `PublicRoute` lets an authenticated user of one role view another role's login page
**File:** `frontend/src/components/PublicRoute.tsx:9-39`

**What's wrong:** When `allowedUserType` doesn't match the currently authenticated user's role, the component returns `children` (the login page) instead of redirecting. E.g., a logged-in Customer navigating to `/seller/login` sees the seller login form rendered, rather than being redirected to their own dashboard. This is **not an authorization bypass** — the actual protected `/seller/*` routes are still correctly gated by `ProtectedRoute` (`App.tsx:516-590`) — but it's a confusing UX/logic inconsistency.

**Recommendation:** Redirect to the current user's own dashboard (or a neutral page) when an authenticated user of a different role hits a role-specific login page, rather than rendering that login form.

#### F8. Stale per-role localStorage value not cleared on logout
**File:** `frontend/src/services/api/config.ts:195-199` (`removeAuthToken` only clears `authToken`, `userData`, `fcm_token_web`), `frontend/src/modules/delivery/context/DeliveryUserContext.tsx:13,19` (separately persists `delivery_user_name`)

**What's wrong:** `delivery_user_name` is stored independently and never cleared by the shared logout/`removeAuthToken` flow.

**Failure scenario:** On a shared device, after logout, the next delivery user to open the app could briefly see the previous user's name flash before fresh data loads.

**Recommendation:** Either centralize all auth-related localStorage writes/clears through one helper, or have `DeliveryUserContext` clear `delivery_user_name` on logout explicitly.

---

### 🟢 LOW

#### F9. `innerHTML` assignments with admin-controlled data
**Files:** `frontend/src/modules/admin/components/CategoryListView.tsx:114`, `CategoryTreeView.tsx:126`, `frontend/src/modules/user/components/CategoryTileSection.tsx:187`

**What's wrong:** These interpolate `category.name.charAt(0)` (a single character from an admin-entered category name) into a raw HTML string assigned via `.innerHTML =`, used as an `<img>` `onError` fallback. Only reachable from already-privileged admin input, and limited to one character — low practical exploitability, but it's still string-built HTML rather than safe DOM construction. `frontend/src/components/PromoStrip.tsx:826-836` shows the correct pattern already exists elsewhere in the codebase (`createElement`/`className`) for an equivalent fallback.

**Recommendation:** Replace with the `createElement`-based pattern already used in `PromoStrip.tsx` for consistency, even though current exploitability is minimal.

#### F10. FCM token logged to console unconditionally
**File:** `frontend/src/services/pushNotificationService.ts:79`

**What's wrong:** Not highly sensitive (a push-routing token, not an auth credential), but logged without an `import.meta.env.DEV` guard, unlike the API-base-URL logging in `config.ts:22-27` which is properly dev-gated.

**Recommendation:** Wrap in a dev-only guard for consistency and to avoid noise/leakage in production console logs.

#### F11. Stray leftover files committed to the frontend repo
**Files:** `frontend/.txt` (0 bytes, confirmed empty — currently open in the editor), `frontend/errors.txt` (UTF-16, a committed TypeScript build-error log dump referencing internal paths like `src/modules/user/Category.tsx`, `Checkout.tsx`, `Wishlist.tsx`)

**What's wrong:** Leftover scratch/build artifacts. Not a secret, but clutter that shouldn't be in version control.

**Recommendation:** Delete both and add `errors.txt`-style build logs to `.gitignore` if this is a recurring habit (e.g. piping `tsc` output to a file during local debugging).

---

### ✅ Frontend — verified correct (no issue)
- **Firebase client config** (`src/firebase.ts:6-12`): standard public `VITE_FIREBASE_*` config — normal and expected to ship in the bundle, not a leak.
- **Razorpay payment flow**: the `amount` prop passed to `RazorpayCheckout` is display-only; actual order creation and signature verification are correctly delegated to the backend (`createRazorpayOrder`, `verifyPayment`) — no client-trusted payment amount.
- **`CartContext`**: uses a `pendingOperationsRef` Set to prevent concurrent duplicate mutations per product/variant, reverts optimistic updates on API failure, and takes authoritative totals from server responses when authenticated — solid implementation.
- **401 vs 403 handling** in `config.ts:131-183`: 403 is correctly treated as "forbidden" rather than triggering an auto-logout — sound distinction.
- **Routing**: no duplicate routes found; admin/seller/delivery/customer route trees are cleanly nested under role-gated parents.
- No `eval` or genuinely dangerous `dangerouslySetInnerHTML` usage found anywhere in the codebase.

---

## Summary & Recommended Order of Fixes

| # | Issue | Severity | Effort |
|---|---|---|---|
| B1 | Hardcoded OTP backdoor (`9111966732` → `1234`) | Critical | Trivial (delete function) |
| B2 | Unauthenticated admin registration endpoint | Critical | Trivial (add auth/role check, or remove route) |
| B3 | Rate limiting fully disabled | Critical | Trivial (uncomment existing code) |
| B4 | Universal bypass OTP tied to unset `NODE_ENV` | Critical | Small (add explicit flag + fail-fast) |
| B5/B6 | Wallet withdrawal race condition (Seller + shared service) | High | Small (atomic update or transaction) |
| B7 | Client-trusted delivery/platform fees | High | Medium (recompute fee logic server-side) |
| B8 | Tax routes missing role check | High | Trivial (add `requireUserType`) |
| B9 | Socket room-join missing authz | High | Small (reject unauthenticated sockets, verify ownership) |
| F1 | Razorpay component re-fires on re-render | High | Small (memoize props / ref-guard effect) |
| F2 | Search has no stale-response guard | High | Small (apply existing `cancelled`-flag pattern) |
| F3 | Shared localStorage token across roles | High | Medium (architectural — namespace or move to cookies) |
| F4 | Sockets not disconnected on logout | High | Trivial (call existing helper) |
| B10–B14, F5–F11 | Medium/Low items | — | Mostly trivial-to-small |

**Bottom line:** The backend's core payment-verification and stock-control logic is sound, and the frontend's cart/payment-display logic is sound. The critical risk is concentrated in **authentication scaffolding that looks like leftover development/testing code never removed before going live** (B1–B4) — these should be treated as immediate pre-launch blockers ahead of everything else, since together they make full account and admin takeover realistically achievable by an anonymous external party with no special access.
