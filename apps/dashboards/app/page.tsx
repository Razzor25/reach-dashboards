import Link from "next/link";

const dashboards = [
  "Reach - Assessment and Measures",
  "Reach - File Report",
  "Reach - Letter Fulfilment",
  "Reach - SDOH",
];

const featuredDashboards = new Set([
  "Reach - Assessment and Measures",
  "Reach - File Report",
  "Reach - Letter Fulfilment",
  "Reach - SDOH",
]);

const dashboardDescriptions: Record<string, string> = {
  "Reach - Assessment and Measures":
    "Tracks assessment completion rates and clinical measure performance across the Reach member population.",
  "Reach - File Report":
    "Central view for Reach file ingestion reports, tracking processing status and data quality metrics.",
  "Reach - Letter Fulfilment":
    "Monitors outbound letter generation and delivery status for Reach member communications.",
  "Reach - SDOH":
    "Provides a view of Social Determinants of Health data for Reach members, supporting care coordination and intervention tracking.",
};

const dashboardHrefByName: Record<string, string> = {
  "Reach - Assessment and Measures": "/dashboards/reach-assessment-and-measures",
  "Reach - File Report": "/dashboards/reach-file-report",
  "Reach - Letter Fulfilment": "/dashboards/reach-letter-fulfilment",
  "Reach - SDOH": "/dashboards/reach-sdoh",
};

function renderOpenAction(dashboard: string) {
  const href = dashboardHrefByName[dashboard];

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-800 transition-colors hover:border-cyan-400 hover:bg-cyan-100"
      >
        Open
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
    >
      Open
    </button>
  );
}

export default function Home() {
  return (
    <main className="app-width-left py-10 sm:py-14">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50 px-6 py-8 shadow-sm sm:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Welcome to Reach Dashboards
        </h2>
        <p className="mt-3 max-w-3xl text-base text-slate-600 sm:text-lg">
          Explore your available Reach dashboards below. The catalog is structured for fast scanning
          across assessments, file reporting, letter fulfilment, and social determinants of health.
        </p>
        <div className="mt-6 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          {dashboards.length} dashboards available
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dashboards.map((dashboard) => {
          const isFeatured = featuredDashboards.has(dashboard);
          const description = dashboardDescriptions[dashboard];

          return (
            <article
              key={dashboard}
              className={`group rounded-2xl border p-5 transition-all duration-200 ${
                isFeatured
                  ? "border-cyan-300 bg-cyan-50/60 hover:border-cyan-500"
                  : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {isFeatured ? "featured" : "dashboard"}
              </p>
              <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-900">
                {dashboard}
              </h3>
              {description && (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
              )}
              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm text-slate-500">Available</span>
                {renderOpenAction(dashboard)}
              </div>
            </article>
          );
        })}
      </section>

      <div className="mt-8 text-sm text-slate-500">
        Need additional dashboards? Add new entries in app/page.tsx.
      </div>
    </main>
  );
}
