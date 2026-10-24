// Pages Function: mantém cookies de sessão no mesmo domínio do Angular.
export async function onRequest({ request, env }) {
  if (!env.API_ORIGIN || !env.API_ORIGIN.startsWith("https://")) {
    return Response.json(
      { detail: "A API ainda não foi configurada." },
      { status: 503 },
    );
  }
  const path = new URL(request.url);
  const destination = new URL(path.pathname + path.search, env.API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("X-Forwarded-Proto", "https");
  return fetch(
    new Request(destination, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    }),
  );
}
