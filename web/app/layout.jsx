export const metadata = {
  title: "uganda-locale",
  description: "Uganda's administrative units — region, district, county, subcounty, parish, village — as a JSON API.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem" }}>{children}</body>
    </html>
  );
}
