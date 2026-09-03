// Posts a Playwright run summary to a Slack Incoming Webhook.
//
// Reads the JSON report at test-results/results.json (produced by the
// playwright "json" reporter), computes pass/fail/flaky/skipped counts, and
// posts a formatted message with a link to the GitHub Actions run.
//
// Env:
//   SLACK_WEBHOOK_URL   (required) the Incoming Webhook URL
//   TESTS_OUTCOME       "success" | "failure" (the test step's outcome)
//   GITHUB_*            standard Actions context vars
//
// No external dependencies — uses Node's built-in fetch (Node 18+).

const fs = require('fs');
const path = require('path');

const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
if (!WEBHOOK) {
  console.log('SLACK_WEBHOOK_URL not set — skipping Slack notification.');
  process.exit(0);
}

const REPORT_PATH = path.join('test-results', 'results.json');

function countOutcomes() {
  // Returns { passed, failed, flaky, skipped, total } or null if no report.
  if (!fs.existsSync(REPORT_PATH)) return null;
  let report;
  try {
    report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  } catch {
    return null;
  }

  // Prefer the top-level stats block when present (newer Playwright).
  if (report.stats && typeof report.stats.expected === 'number') {
    const s = report.stats;
    return {
      passed: s.expected ?? 0,
      failed: s.unexpected ?? 0,
      flaky: s.flaky ?? 0,
      skipped: s.skipped ?? 0,
      total: (s.expected ?? 0) + (s.unexpected ?? 0) + (s.flaky ?? 0) + (s.skipped ?? 0),
    };
  }

  // Fallback: walk the suite tree and tally each test's status.
  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0, total: 0 };
  const walk = (suites = []) => {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          counts.total += 1;
          const status = test.status || 'unknown'; // expected|unexpected|flaky|skipped
          if (status === 'expected') counts.passed += 1;
          else if (status === 'unexpected') counts.failed += 1;
          else if (status === 'flaky') counts.flaky += 1;
          else if (status === 'skipped') counts.skipped += 1;
        }
      }
      if (suite.suites) walk(suite.suites);
    }
  };
  walk(report.suites);
  return counts;
}

async function main() {
  const outcome = process.env.TESTS_OUTCOME || 'unknown';
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY || '';
  const runId = process.env.GITHUB_RUN_ID || '';
  const runUrl = repo && runId ? `${server}/${repo}/actions/runs/${runId}` : server;
  const branch = process.env.GITHUB_REF_NAME || '';
  const sha = (process.env.GITHUB_SHA || '').slice(0, 7);
  const actor = process.env.GITHUB_ACTOR || '';
  const event = process.env.GITHUB_EVENT_NAME || '';

  const counts = countOutcomes();

  // Overall status: failure if the test step failed OR any test is unexpected.
  const failed = outcome === 'failure' || (counts && counts.failed > 0);
  const emoji = failed ? ':red_circle:' : ':large_green_circle:';
  const headline = failed ? 'Playwright run FAILED' : 'Playwright run passed';

  let summaryLine;
  if (counts) {
    summaryLine =
      `*${counts.passed}* passed · *${counts.failed}* failed · ` +
      `*${counts.flaky}* flaky · *${counts.skipped}* skipped  (of ${counts.total})`;
  } else {
    summaryLine =
      '_No test report was produced — the run likely errored before tests started ' +
      '(e.g. Cloudflare blocked global-setup). Check the run logs._';
  }

  const text =
    `${emoji} *${headline}* — Bellavita Organic\n` +
    `${summaryLine}\n` +
    `Repo: \`${repo}\` · Branch: \`${branch}\` · Commit: \`${sha}\` · Trigger: \`${event}\`` +
    (actor ? ` · By: \`${actor}\`` : '') +
    `\n<${runUrl}|View the run & report artifact>`;

  const payload = {
    text: `${headline} — ${repo}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
    ],
  };

  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`Slack webhook returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log('Slack notification sent.');
}

main().catch((err) => {
  console.error('Failed to send Slack notification:', err);
  // Do not fail the job just because Slack failed.
  process.exit(0);
});
