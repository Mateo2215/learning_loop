// Focus-mode segment: full-bleed canvas, no global nav chrome.
// AppChrome in (app)/layout.tsx hides itself on this pathname.
export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
