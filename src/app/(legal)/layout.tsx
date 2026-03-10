/**
 * Legal pages layout — minimal wrapper for /terms and /privacy
 *
 * No sidebar, no auth required. Just passes children through.
 * The individual pages handle their own header/footer.
 */

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
