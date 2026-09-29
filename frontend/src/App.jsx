import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:5000";

const FEATURES = [
  { key: "BALANCE", label: "Account balance", hint: "ETB" },
  { key: "PURCHASES", label: "Total purchases", hint: "ETB" },
  { key: "ONEOFF_PURCHASES", label: "One-off purchases", hint: "ETB" },
  {
    key: "INSTALLMENTS_PURCHASES",
    label: "Installment purchases",
    hint: "ETB",
  },
  { key: "CASH_ADVANCE", label: "Cash advance", hint: "ETB" },
  { key: "CREDIT_LIMIT", label: "Credit limit", hint: "ETB" },
  { key: "PAYMENTS", label: "Payments made", hint: "ETB" },
  { key: "MINIMUM_PAYMENTS", label: "Minimum payments", hint: "ETB" },
  { key: "PRC_FULL_PAYMENT", label: "Full-payment ratio", hint: "0–1" },
  { key: "TENURE", label: "Tenure", hint: "months" },
];

// Maps each cluster to a meaningful accent, not an arbitrary palette cycle
const SEGMENT_STYLE = {
  0: { accent: "var(--accent-slate)", tag: "Core base" },
  1: { accent: "var(--accent-amber)", tag: "Watch" },
  2: { accent: "var(--accent-gold)", tag: "Premium" },
  3: { accent: "var(--accent-teal)", tag: "Low risk" },
};

function formatNumber(n) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

// Compares the submitted customer's values against their predicted segment's average
function ComparisonChart({ customer, profile, accent, visible }) {
  const rows = [
    { key: "BALANCE", label: "Balance" },
    { key: "PURCHASES", label: "Purchases" },
    { key: "CASH_ADVANCE", label: "Cash advance" },
    { key: "CREDIT_LIMIT", label: "Credit limit" },
  ];

  return (
    <div className="chart-panel" style={{ "--chart-accent": accent }}>
      <div className="chart-legend">
        <span>
          <i className="dot dot-customer" /> This customer
        </span>
        <span>
          <i className="dot dot-segment" /> Segment average
        </span>
      </div>
      <div className="chart-rows">
        {rows.map((r, i) => {
          const custVal = parseFloat(customer[r.key]) || 0;
          const segVal = profile[r.key] || 0;
          const max = Math.max(custVal, segVal, 1);
          return (
            <div className="chart-row" key={r.key}>
              <span className="chart-row-label">{r.label}</span>
              <div className="chart-bars">
                <div className="chart-bar-track">
                  <div
                    className="chart-bar bar-customer"
                    style={{
                      width: visible ? `${(custVal / max) * 100}%` : "0%",
                      transitionDelay: `${i * 90}ms`,
                    }}
                  />
                </div>
                <div className="chart-bar-track">
                  <div
                    className="chart-bar bar-segment"
                    style={{
                      width: visible ? `${(segVal / max) * 100}%` : "0%",
                      transitionDelay: `${i * 90 + 45}ms`,
                    }}
                  />
                </div>
              </div>
              <div className="chart-values">
                <span>{formatNumber(custVal)}</span>
                <span>{formatNumber(segVal)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [formData, setFormData] = useState(
    Object.fromEntries(FEATURES.map((f) => [f.key, ""])),
  );
  const [result, setResult] = useState(null);
  const [segments, setSegments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stamped, setStamped] = useState(false);
  const [batchFile, setBatchFile] = useState(null);
  const [batchResults, setBatchResults] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/segments`)
      .then((res) => res.json())
      .then((data) => setSegments(data))
      .catch(() =>
        setError(
          "Could not reach the segmentation service. Confirm the API is running.",
        ),
      );
  }, []);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setStamped(false);

    const payload = Object.fromEntries(
      Object.entries(formData).map(([k, v]) => [k, parseFloat(v) || 0]),
    );

    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("The model could not classify this record.");
      const data = await res.json();
      setResult(data);
      // trigger stamp animation on next paint
      requestAnimationFrame(() => setStamped(true));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpload = async (e) => {
    e.preventDefault();
    if (!batchFile) return;

    setBatchLoading(true);
    setBatchError(null);
    setBatchResults(null);

    const form = new FormData();
    form.append("file", batchFile);

    try {
      const res = await fetch(`${API_URL}/predict_batch`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch upload failed");
      setBatchResults(data);
    } catch (err) {
      setBatchError(err.message);
    } finally {
      setBatchLoading(false);
    }
  };
  return (
    <div className="page">
      <div className="brand-intro">
        <div className="brand-mark" aria-hidden="true">
          <img src="/cbe-logo2.png" alt="Commercial Bank of Ethiopia" />
        </div>
        <span className="brand-tagline">The Bank You Always Rely On</span>
      </div>

      <header className="masthead">
        <span className="eyebrow">
          CBE District Branch &middot; Customer Intelligence
        </span>
        <h1>Customer Segmentation Ledger</h1>
        <p className="subhead">
          Classify a customer's financial behavior into one of four segments,
          trained with K-Means on account activity across balance, spend, and
          repayment patterns.
        </p>
      </header>

      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">8,950</span>
          <span className="stat-label">Customer records</span>
        </div>
        <div className="stat">
          <span className="stat-value">10</span>
          <span className="stat-label">Behavioral features</span>
        </div>
        <div className="stat">
          <span className="stat-value">K = 4</span>
          <span className="stat-label">Segments identified</span>
        </div>
        <div className="stat">
          <span className="stat-value">6 mo.</span>
          <span className="stat-label">Activity window</span>
        </div>
      </div>

      <section className="panel form-panel">
        <h2>New classification</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {FEATURES.map((f) => (
              <div key={f.key} className="field">
                <label htmlFor={f.key}>{f.label}</label>
                <div className="input-wrap">
                  <input
                    id={f.key}
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formData[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    required
                  />
                  <span className="unit">{f.hint}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Classifying…" : "Classify customer"}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}

        {result && (
          <>
            <div
              className={`result-stamp ${stamped ? "is-stamped" : ""}`}
              style={{
                "--stamp-accent": SEGMENT_STYLE[result.cluster]?.accent,
              }}
            >
              <div className="stamp-ring">
                <span className="stamp-cluster">
                  {String(result.cluster).padStart(2, "0")}
                </span>
              </div>
              <div className="stamp-body">
                <span className="stamp-label">Segment identified</span>
                <span className="stamp-name">{result.segment_name}</span>
              </div>
            </div>

            {segments && (
              <ComparisonChart
                customer={formData}
                profile={segments.profiles.find(
                  (p) => p.Cluster === result.cluster,
                )}
                accent={SEGMENT_STYLE[result.cluster]?.accent}
                visible={stamped}
              />
            )}
          </>
        )}
      </section>

      <section className="methodology">
        <h2>How a classification is made</h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">01</span>
            <h3>Data intake</h3>
            <p>
              Raw account activity — balance, purchases, cash advances, payments
              — is read from the customer record.
            </p>
          </div>
          <div className="step">
            <span className="step-num">02</span>
            <h3>Scaling</h3>
            <p>
              Every feature is standardized (mean 0, std 1) so no single
              high-magnitude value dominates the distance calculation.
            </p>
          </div>
          <div className="step">
            <span className="step-num">03</span>
            <h3>K-Means</h3>
            <p>
              The scaled record is assigned to the nearest of 4 cluster
              centroids, learned from the full training set.
            </p>
          </div>
          <div className="step">
            <span className="step-num">04</span>
            <h3>Interpretation</h3>
            <p>
              The numeric cluster is mapped to a business-readable segment name
              and compared against that segment's average.
            </p>
          </div>
        </div>
      </section>

      <section className="panel dashboard-panel">
        <h2>The four segments</h2>
        {!segments && !error && (
          <p className="loading-text">Loading segment profiles…</p>
        )}
        {segments && (
          <div className="segment-grid">
            {segments.profiles.map((profile, i) => {
              const style = SEGMENT_STYLE[profile.Cluster] || SEGMENT_STYLE[0];
              return (
                <article
                  key={profile.Cluster}
                  className="segment-card"
                  style={{
                    "--card-accent": style.accent,
                    animationDelay: `${i * 90}ms`,
                  }}
                >
                  <div className="segment-card-head">
                    <span className="segment-tag">{style.tag}</span>
                    <span className="segment-index">
                      {String(profile.Cluster).padStart(2, "0")}
                    </span>
                  </div>
                  <h3>{segments.names[profile.Cluster]}</h3>
                  <dl className="segment-stats">
                    <div>
                      <dt>Avg. balance</dt>
                      <dd>{formatNumber(profile.BALANCE)}</dd>
                    </div>
                    <div>
                      <dt>Avg. purchases</dt>
                      <dd>{formatNumber(profile.PURCHASES)}</dd>
                    </div>
                    <div>
                      <dt>Avg. cash advance</dt>
                      <dd>{formatNumber(profile.CASH_ADVANCE)}</dd>
                    </div>
                    <div>
                      <dt>Avg. credit limit</dt>
                      <dd>{formatNumber(profile.CREDIT_LIMIT)}</dd>
                    </div>
                    <div className="highlight">
                      <dt>Full-payment rate</dt>
                      <dd>{(profile.PRC_FULL_PAYMENT * 100).toFixed(1)}%</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section className="panel batch-panel">
        <h2>Batch classification</h2>
        <p className="batch-hint">
          Upload a CSV with the same 10 columns as the form above to classify
          many customers at once.
        </p>

        <form onSubmit={handleBatchUpload} className="batch-form">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setBatchFile(e.target.files[0])}
          />
          <button
            type="submit"
            className="submit-btn"
            disabled={!batchFile || batchLoading}
          >
            {batchLoading ? "Classifying…" : "Upload & classify"}
          </button>
        </form>

        {batchError && <p className="error-text">{batchError}</p>}

        {batchResults && (
          <>
            <div className="batch-summary">
              {Object.entries(batchResults.summary).map(([name, count]) => (
                <div key={name} className="batch-summary-chip">
                  <span className="batch-summary-count">{count}</span>
                  <span className="batch-summary-name">{name}</span>
                </div>
              ))}
            </div>

            <div className="batch-table-wrap">
              <table className="batch-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer ID</th>
                    <th>Cluster</th>
                    <th>Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.results.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>{r.customer_id}</td>
                      <td>{String(r.cluster).padStart(2, "0")}</td>
                      <td>{r.segment_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <footer className="site-footer">
        <span>Commercial Bank of Ethiopia &middot; District Branch</span>
        <span className="footer-divider">&middot;</span>
        <span>Customer Segmentation Internship Project</span>
        <span className="footer-divider">&middot;</span>
        <span>Built by Dagem, ASTU</span>
      </footer>
    </div>
  );
}

export default App;
