import arcjet, {
    detectBot,
    shield,
    slidingWindow,
} from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;

if (!arcjetKey) {
    throw new Error("ARCJET_KEY not found in .env");
}

const arcjetMode =
    process.env.ARCJET_MODE === "DRY_RUN"
        ? "DRY_RUN"
        : "LIVE";

// ================= HTTP Protection =================

export const httpArcjet = arcjet({
    key: arcjetKey,
    proxies: ["127.0.0.1", "10.0.0.0/8"],
    rules: [
        shield({
            mode: arcjetMode,
        }),

        // detectBot({
        //     mode: arcjetMode,
        //     allow: [
        //         "CATEGORY:SEARCH_ENGINE",
        //         "CATEGORY:PREVIEW",
        //     ],
        // }),

        slidingWindow({
            mode: arcjetMode,
            interval: "10s",
            max: 50,
        }),
    ],
});

// ================= WebSocket Protection =================

export const wsArcjet = arcjet({
    key: arcjetKey,
    proxies: ["127.0.0.1", "10.0.0.0/8"],
    rules: [
        shield({
            mode: arcjetMode,
        }),

        // detectBot({
        //     mode: arcjetMode,
        //     allow: [
        //         "CATEGORY:SEARCH_ENGINE",
        //         "CATEGORY:PREVIEW",
        //     ],
        // }),

        slidingWindow({
            mode: arcjetMode,
            interval: "2s",
            max: 5,
        }),
    ],
});

// ================= Express Middleware =================

export function securityMiddleware() {
    return async (req, res, next) => {
        try {
            const decision = await httpArcjet.protect(req);

            console.log("========== HTTP ARCJET ==========");
            console.log("Path:", req.method, req.path);
            console.log("Denied:", decision.isDenied());
            console.log("Errored:", decision.isErrored());
            console.log("Reason:", decision.reason);
            console.log("=================================");

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