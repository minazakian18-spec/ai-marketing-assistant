export const DEMO_COOKIE = "mavix-local-demo";
// A demo session only unlocks local UI; it never authenticates backend requests.
export function demoSession(
  value: string | undefined,
  environment: string | undefined,
) {
  return environment === "development" && value === "1";
}
export function isBrowserDemo() {
  return (
    typeof document !== "undefined" &&
    demoSession(
      document.cookie
        .split("; ")
        .find((item) => item.startsWith(DEMO_COOKIE + "="))
        ?.split("=")[1],
      process.env.NODE_ENV,
    )
  );
}
export function startDemo() {
  if (process.env.NODE_ENV !== "development") return;
  document.cookie = DEMO_COOKIE + "=1; Path=/; SameSite=Lax";
  window.location.assign("/dashboard");
}
export function stopDemo() {
  document.cookie = DEMO_COOKIE + "=; Path=/; Max-Age=0; SameSite=Lax";
  window.location.assign("/login");
}
