import arcjet, {
    shield,
    slidingWindow,
} from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;

let httpArcjetInstance = null;
let wsArcjetInstance = null;

if (arcjetKey) {
    const arcjetMode =
        process.env.ARCJET_MODE === "DRY_RUN"
            ? "DRY_RUN"
            : "LIVE";

    // ================= HTTP Protection =================
    httpArcjetInstance = arcjet({
        key: arcjetKey,
        proxies: ["127.0.0.1", "10.0.0.0/8"],
        rules: [
            shield({
                mode: arcjetMode,
            }),
            slidingWindow({
                mode: arcjetMode,
                interval: "10s",
                max: 50,
            }),
        ],
    });

    // ================= WebSocket Protection =================
    wsArcjetInstance = arcjet({
        key: arcjetKey,
        proxies: ["127.0.0.1", "10.0.0.0/8"],
        rules: [
            shield({
                mode: arcjetMode,
            }),
            slidingWindow({
                mode: arcjetMode,
                interval: "2s",
                max: 5,
            }),
        ],
    });
} else {
    console.warn("⚠️ [Arcjet] ARCJET_KEY is not defined. Arcjet security rules will run in development pass-through mode.");
}

export const httpArcjet = httpArcjetInstance;
export const wsArcjet = wsArcjetInstance;

export async function protectWs(req) {
    if (!wsArcjetInstance) {
        return { isDenied: () => false, isErrored: () => false };
    }
    return await wsArcjetInstance.protect(req);
}

// ================= Express Middleware =================
export function securityMiddleware() {
    return async (req, res, next) => {
        if (!httpArcjetInstance) {
            return next();
        }

        try {
            const decision = await httpArcjetInstance.protect(req);

            if (decision.isErrored()) {
                return res.status(503).json({
                    success: false,
                    error: "Security service unavailable.",
                });
            }

            if (decision.isDenied()) {
                if (decision.reason.isRateLimit()) {
                    return res.status(429).json({
                        success: false,
                        error: "Too many requests. Please try again later.",
                    });
                }

                return res.status(403).json({
                    success: false,
                    error: "Request blocked by Arcjet.",
                });
            }

            next();
        } catch (err) {
            console.error("========== ARCJET EXCEPTION ==========");
            console.error(err);
            console.error("======================================");

            return res.status(503).json({
                success: false,
                error: "Security service unavailable.",
            });
        }
    };
}