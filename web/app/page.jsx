import LocationPicker from "./picker.jsx";

const ROUTES = [
  ["GET /api/regions", "All 4 regions"],
  ["GET /api/districts", "All 136 districts (?regionId= to filter)"],
  ["GET /api/cities", "All 10 cities"],
  ["GET /api/districts/:id/counties", "Counties/municipalities under a district"],
  ["GET /api/counties/:id/subcounties", "Subcounties/town councils/divisions under a county"],
  ["GET /api/subcounties/:id/parishes", "Parishes/wards under a subcounty (deep)"],
  ["GET /api/search?q=...", "Name/alias search (&level=, &limit=)"],
  ["GET /api/country", "Uganda country metadata (ISO codes, currency, flag, etc.)"],
];

export default function Home() {
  return (
    <main>
      <h1>uganda-locale API</h1>
      <p>
        Uganda&apos;s administrative units — region → district/city → county/municipality →
        subcounty/town council/division → parish/ward → village/cell — served as JSON. See{" "}
        <a href="https://github.com/kakandemanwell/uganda">github.com/kakandemanwell/uganda</a> for
        the underlying dataset and its sourcing.
      </p>

      <h2>Routes</h2>
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <tbody>
          {ROUTES.map(([route, desc]) => (
            <tr key={route} style={{ borderBottom: "1px solid #ddd" }}>
              <td>
                <code>{route}</code>
              </td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cascading dropdown demo</h2>
      <LocationPicker />
    </main>
  );
}
