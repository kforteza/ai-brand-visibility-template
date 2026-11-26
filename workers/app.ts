import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { apiRoutes } from "./api";
import { queueConsumer } from "./queue";
import { isAuthorizedAdmin } from "./security";

type Env = {
	AI: Ai;
	AEO_KV: KVNamespace;
	BRAND_VISIBILITY_QUEUE: Queue;
	TARGET_DOMAIN: string;
	ALLOWED_ADMIN_EMAILS?: string;
	ALLOWED_DOMAINS?: string;
	AI_GATEWAY_ID?: string;
};

type AccessContext = ExecutionContext & {
	access?: {
		getIdentity: () => Promise<{ email?: string | null } | null>;
	};
};

const app = new Hono<{ Bindings: Env }>();

// API routes
app.route("/api", apiRoutes);

// SSR catch-all — React Router handles everything else
app.get("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);
	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

function authResponse(status: 401 | 403): Response {
	return new Response(status === 401 ? "Authentication required" : "Forbidden", {
		status,
		headers: {
			"cache-control": "no-store",
			"content-type": "text/plain; charset=utf-8",
			"vary": "Cookie, Cf-Access-Jwt-Assertion",
		},
	});
}

export default {
	async fetch(request: Request, env: Env, ctx: AccessContext): Promise<Response> {
		// Fail closed: Cloudflare Access must authenticate the request AND the
		// server-side allowlist must authorize the resulting identity.
		if (!ctx.access) return authResponse(401);

		let identity: { email?: string | null } | null = null;
		try {
			identity = await ctx.access.getIdentity();
		} catch {
			return authResponse(401);
		}

		if (!isAuthorizedAdmin(identity?.email ?? undefined, env.ALLOWED_ADMIN_EMAILS)) {
			return authResponse(403);
		}

		return app.fetch(request, env, ctx);
	},
	queue: queueConsumer,
};
