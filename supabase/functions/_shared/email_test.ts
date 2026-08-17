// Regression tests for sendNotification(). Run with `npm run test:functions`.
//
// Named *_test.ts (Deno convention) rather than *.test.ts on purpose: the
// root vitest run globs **/*.test.ts and would otherwise try to execute this
// file under Node, where Deno.env and the npm: specifiers do not exist.
//
// These stub fetch rather than talking to SendGrid, so they prove our own
// behavior — request shape, failure isolation, the never-throws contract —
// not SendGrid's. Delivery still needs a live smoke test.

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { sendNotification } from "./email.ts";

const API_KEY = "SG.fake-key-for-tests";
const FROM = "content@mail.example.com";
const ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

interface Captured {
  url: string;
  auth: string | null;
  // deno-lint-ignore no-explicit-any
  body: any;
}

interface Harness {
  captured: Captured[];
  errors: string[];
  warns: string[];
  /** Addresses, in the order they were sent to. */
  recipients: () => string[];
}

interface Options {
  /** HTTP status to return per recipient address. Default 202. */
  status?: (email: string) => number;
  /** Full fetch replacement, for transport-level failures. */
  fetch?: typeof fetch;
  /** Env overrides. `null` deletes the variable. */
  env?: Record<string, string | null>;
}

/** SendGrid's error body for a syntactically invalid address. */
const INVALID_ADDRESS_BODY = JSON.stringify({
  errors: [{
    message: "Does not contain a valid address.",
    field: "personalizations.0.to.0.email",
    help: null,
  }],
});

async function withHarness(
  opts: Options,
  run: (h: Harness) => Promise<void>,
): Promise<void> {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const realWarn = console.warn;
  const realEnv = {
    SENDGRID_API_KEY: Deno.env.get("SENDGRID_API_KEY"),
    NOTIFICATION_FROM_EMAIL: Deno.env.get("NOTIFICATION_FROM_EMAIL"),
    NOTIFICATION_FROM_NAME: Deno.env.get("NOTIFICATION_FROM_NAME"),
  };

  const h: Harness = {
    captured: [],
    errors: [],
    warns: [],
    recipients: () =>
      h.captured.map((c) => c.body.personalizations[0].to[0].email),
  };

  // Baseline: configured provider, no display name. Tests override.
  Deno.env.set("SENDGRID_API_KEY", API_KEY);
  Deno.env.set("NOTIFICATION_FROM_EMAIL", FROM);
  Deno.env.delete("NOTIFICATION_FROM_NAME");
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }

  const statusFor = opts.status ?? (() => 202);
  globalThis.fetch = opts.fetch ??
    (((url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      h.captured.push({
        url: String(url),
        auth: (init?.headers as Record<string, string>)?.Authorization ?? null,
        body,
      });
      const status = statusFor(body.personalizations[0].to[0].email);
      // 202 Accepted carries an EMPTY body — mirroring that here is what
      // catches an accidental res.json() on the success path.
      return Promise.resolve(
        new Response(status === 202 ? "" : INVALID_ADDRESS_BODY, { status }),
      );
    }) as typeof fetch);

  console.error = (...a: unknown[]) => void h.errors.push(a.map(String).join(" "));
  console.warn = (...a: unknown[]) => void h.warns.push(a.map(String).join(" "));

  try {
    await run(h);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    console.warn = realWarn;
    for (const [k, v] of Object.entries(realEnv)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test("unconfigured provider: returns false, warns, sends nothing", async () => {
  await withHarness({ env: { SENDGRID_API_KEY: null } }, async (h) => {
    const ok = await sendNotification(["a@example.com"], "s", "<p>h</p>");
    assertFalse(ok);
    assertEquals(h.captured.length, 0);
    assert(
      h.warns.some((w) => w.includes("email skipped")),
      `expected skip warning, got ${JSON.stringify(h.warns)}`,
    );
  });
});

Deno.test("missing from address: returns false, sends nothing", async () => {
  await withHarness({ env: { NOTIFICATION_FROM_EMAIL: null } }, async (h) => {
    assertFalse(await sendNotification(["a@example.com"], "s", "<p>h</p>"));
    assertEquals(h.captured.length, 0);
  });
});

Deno.test("empty recipient list: returns false, sends nothing", async () => {
  await withHarness({}, async (h) => {
    assertFalse(await sendNotification([], "s", "<p>h</p>"));
    assertEquals(h.captured.length, 0);
  });
});

Deno.test("one request per recipient, each addressed only to itself", async () => {
  await withHarness({}, async (h) => {
    const to = ["one@example.com", "two@example.com", "three@example.com"];
    assert(await sendNotification(to, "New content", "<p>hi</p>"));

    assertEquals(h.captured.length, 3, "expected one request per recipient");
    assertEquals(h.recipients(), to);
    for (const c of h.captured) {
      assertEquals(c.url, ENDPOINT);
      assertEquals(c.auth, `Bearer ${API_KEY}`);
      // Batching would leak the whole team's addresses into each other's
      // To: header. One personalization, one address, every time.
      assertEquals(c.body.personalizations.length, 1);
      assertEquals(c.body.personalizations[0].to.length, 1);
    }
  });
});

Deno.test("payload: html content, tracking off, no sandbox flag", async () => {
  await withHarness({}, async (h) => {
    await sendNotification(["a@example.com"], "Subject here", "<p>hi</p>");
    const b = h.captured[0].body;

    assertEquals(b.subject, "Subject here");
    assertEquals(b.content, [{ type: "text/html", value: "<p>hi</p>" }]);

    // Link rewriting would run the 30-day signed Storage URL and the review
    // deep link through sendgrid.net.
    assertEquals(b.tracking_settings, {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
    });

    // A sandbox flag left in would silently stop all real delivery.
    assertFalse(
      JSON.stringify(b).includes("sandbox"),
      "sandbox_mode must never ship",
    );
  });
});

Deno.test("from: name included when set, key absent when unset or blank", async () => {
  await withHarness({}, async (h) => {
    await sendNotification(["a@example.com"], "s", "<p>h</p>");
    assertEquals(h.captured[0].body.from, { email: FROM });
  });

  await withHarness({ env: { NOTIFICATION_FROM_NAME: "Signature Content" } }, async (h) => {
    await sendNotification(["a@example.com"], "s", "<p>h</p>");
    assertEquals(h.captured[0].body.from, { email: FROM, name: "Signature Content" });
  });

  // Empty string must omit the key, not send name: "".
  await withHarness({ env: { NOTIFICATION_FROM_NAME: "" } }, async (h) => {
    await sendNotification(["a@example.com"], "s", "<p>h</p>");
    assertEquals(h.captured[0].body.from, { email: FROM });
  });
});

Deno.test("a malformed address does not sink the rest of the batch", async () => {
  // The reason sends are per-recipient. Settings validates new entries with
  // `includes("@")`, so `typo@example` gets in; batched, SendGrid would 400
  // the whole request and the entire team would silently get nothing.
  await withHarness({
    status: (email) => (email.includes(".") ? 202 : 400),
  }, async (h) => {
    const ok = await sendNotification(
      ["good@example.com", "typo@example", "also-good@example.com"],
      "New content",
      "<p>hi</p>",
    );

    assert(ok, "partial success must still return true");
    assertEquals(h.captured.length, 3, "every address should be attempted");
    assertEquals(
      h.recipients().filter((e) => e.includes(".")).length,
      2,
      "both valid recipients must still be sent to",
    );

    assertEquals(h.errors.length, 1, `expected 1 error, got ${JSON.stringify(h.errors)}`);
    // The log has to name the address, or a bad entry in Settings is
    // undiagnosable from function logs.
    assert(h.errors[0].includes("typo@example"), h.errors[0]);
    assert(h.errors[0].includes("400"), h.errors[0]);
    assert(h.errors[0].includes("valid address"), h.errors[0]);
  });
});

Deno.test("every recipient rejected: returns false, logs each", async () => {
  // 403 is the unverified-sender case, the likeliest first-deploy failure.
  await withHarness({ status: () => 403 }, async (h) => {
    assertFalse(await sendNotification(["a@example.com", "b@example.com"], "s", "<p>h</p>"));
    assertEquals(h.errors.length, 2);
    assert(h.errors.every((e) => e.includes("403")), JSON.stringify(h.errors));
  });
});

Deno.test("transport failure never escapes to the caller", async () => {
  await withHarness({
    fetch: (() => Promise.reject(new Error("connection refused"))) as typeof fetch,
  }, async (h) => {
    // submit-content awaits this before returning to the facility manager;
    // a throw here would fail a submission that already saved.
    const ok = await sendNotification(["a@example.com"], "s", "<p>h</p>");
    assertFalse(ok);
    assert(
      h.errors.some((e) => e.includes("connection refused")),
      JSON.stringify(h.errors),
    );
  });
});

Deno.test("sends run concurrently, not serially", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const DELAY_MS = 40;

  await withHarness({
    fetch: (() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<Response>((resolve) =>
        setTimeout(() => {
          inFlight--;
          resolve(new Response("", { status: 202 }));
        }, DELAY_MS)
      );
    }) as typeof fetch,
  }, async () => {
    const started = performance.now();
    await sendNotification(
      ["a@e.com", "b@e.com", "c@e.com", "d@e.com"],
      "s",
      "<p>h</p>",
    );
    const elapsed = performance.now() - started;

    assertEquals(maxInFlight, 4, "all four sends should overlap");
    assert(
      elapsed < DELAY_MS * 3,
      `serial execution suspected: ${Math.round(elapsed)}ms for 4x${DELAY_MS}ms sends`,
    );
  });
});
