CREATE TABLE IF NOT EXISTS reports (
  case_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  payload TEXT NOT NULL,
  PRIMARY KEY (case_id, report_id)
);
CREATE INDEX IF NOT EXISTS reports_received_at ON reports (received_at);
