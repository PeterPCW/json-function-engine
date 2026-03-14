import type { Finding, ReporterDefinition, FormatOptions } from '../../types/index.js';

// JSON Reporter
export const jsonReporter: ReporterDefinition = {
  name: 'json',
  format: (findings: Finding[], options?: FormatOptions): string => {
    if (options?.pretty) {
      return JSON.stringify(findings, null, 2);
    }
    return JSON.stringify(findings);
  }
};

// Text Reporter
export const textReporter: ReporterDefinition = {
  name: 'text',
  format: (findings: Finding[]): string => {
    if (findings.length === 0) {
      return 'No findings.';
    }

    const lines: string[] = [];
    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪'
    };

    for (const finding of findings) {
      const emoji = severityEmoji[finding.severity] || '⚪';
      lines.push(
        `${emoji} [${finding.severity.toUpperCase()}] ${finding.message}`
      );
      lines.push(`  → ${finding.location.file}:${finding.location.line}`);
      if (finding.code) {
        lines.push(`  Code: ${finding.code}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
};

// HTML Reporter
export const htmlReporter: ReporterDefinition = {
  name: 'html',
  format: (findings: Finding[], options?: FormatOptions): string => {
    const theme = options?.theme || 'light';
    const isDark = theme === 'dark';

    const colors = isDark ? {
      bg: '#1a1a2e',
      card: '#16213e',
      text: '#eee',
      critical: '#ff4444',
      high: '#ff8844',
      medium: '#ffcc44',
      low: '#44aaff',
      info: '#888888'
    } : {
      bg: '#f5f5f5',
      card: '#fff',
      text: '#333',
      critical: '#d32f2f',
      high: '#f57c00',
      medium: '#fbc02d',
      low: '#1976d2',
      info: '#757575'
    };

    const severityColor = (sev: string) =>
      colors[sev as keyof typeof colors] || colors.info;

    const escapeHtml = (str: string): string =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const findingsHtml = findings.map(f => `
      <div class="finding">
        <div class="severity" style="background: ${severityColor(f.severity)}">${f.severity}</div>
        <div class="content">
          <div class="message">${escapeHtml(f.message)}</div>
          <div class="location">${escapeHtml(f.location.file)}:${f.location.line}</div>
          ${f.code ? `<div class="code">${escapeHtml(f.code)}</div>` : ''}
        </div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scan Results</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${colors.bg}; color: ${colors.text}; padding: 20px; margin: 0; }
    .finding { background: ${colors.card}; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; gap: 12px; }
    .severity { padding: 4px 12px; border-radius: 4px; color: white; font-weight: bold; font-size: 12px; text-transform: uppercase; }
    .content { flex: 1; }
    .message { font-weight: 500; margin-bottom: 4px; }
    .location { font-size: 14px; opacity: 0.7; }
    .code { font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; margin-top: 8px; }
    h1 { margin: 0 0 20px 0; }
  </style>
</head>
<body>
  <h1>Scan Results (${findings.length} findings)</h1>
  ${findingsHtml || '<p>No findings.</p>'}
</body>
</html>`;
  }
};

// SARIF Reporter
export const sarifReporter: ReporterDefinition = {
  name: 'sarif',
  format: (findings: Finding[], options?: FormatOptions): string => {
    const version = options?.version || '2.1';

    const sarif = {
      version: `${version}.0`,
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'json-function-engine',
              version: '1.0.0'
            }
          },
          results: findings.map(f => ({
            ruleId: f.functionId,
            message: {
              text: f.message
            },
            level: f.severity === 'critical' || f.severity === 'high' ? 'error' : 'warning',
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: f.location.file
                  },
                  region: {
                    startLine: f.location.line,
                    startColumn: f.location.column || 1
                  }
                }
              }
            ]
          }))
        }
      ]
    };

    return JSON.stringify(sarif, null, 2);
  }
};

export const builtInReporters = {
  json: jsonReporter,
  text: textReporter,
  html: htmlReporter,
  sarif: sarifReporter
};
