# json-function-engine

A standalone JavaScript/TypeScript library for executing logic defined in JSON configuration files. Define functions, conditions, and actions in JSON — execute them against source code, JSON data, or any input. Lightweight, embeddable, and extensible.

## Features

- **Define functions in JSON** - Express logic as conditions and actions in JSON
- **Execute against source files** - Scan codebases with regex, file filtering, and more
- **Extensible** - Register custom conditions, actions, and reporters
- **Multiple output formats** - JSON, Text, HTML, SARIF
- **Performance** - Regex caching, parallel execution, ReDoS protection
- **Zero runtime dependencies** - Keep your bundle small

## Installation

```bash
npm install json-function-engine
# or
pnpm add json-function-engine
# or
yarn add json-function-engine
```

## Quick Start

```typescript
import { Engine } from 'json-function-engine';

const engine = new Engine();

// Define functions inline
const functions = {
  version: "1.0",
  functions: [
    {
      id: "NO_TODO",
      name: "No TODO comments",
      enabled: true,
      priority: 1,
      condition: {
        type: "regex",
        pattern: "TODO",
        fileExtensions: [".ts", ".tsx"]
      },
      action: {
        type: "flag",
        severity: "info",
        message: "TODO comment found"
      }
    }
  ]
};

// Add functions to engine
engine.addFunctions(functions.functions);

// Execute against source files
const findings = await engine.execute([
  { path: "src/auth.ts", content: "const TODO = 'implement auth';" }
], { cwd: process.cwd() });

// Format output
console.log(engine.format(findings, "json", { pretty: true }));
```

## Your First Function

A 5-minute guide to creating and running your first function:

### Step 1: Create a function definition file

Create `my-functions.json`:

```json
{
  "version": "1.0",
  "functions": [
    {
      "id": "DETECT_SECRETS",
      "name": "No hardcoded secrets",
      "condition": {
        "type": "regex",
        "pattern": "(api_key|password|secret)\\s*[:=]\\s*['\"][^'\"]+['\"]",
        "fileExtensions": [".ts", ".js", ".env"]
      },
      "action": {
        "type": "flag",
        "severity": "critical",
        "message": "Potential hardcoded secret detected"
      }
    }
  ]
}
```

### Step 2: Load and execute

```typescript
import { Engine } from 'json-function-engine';

const engine = new Engine();

// Load functions from file
const result = await engine.loadFunctions('./my-functions.json');
console.log(`Loaded ${result.loaded} functions`);

// Execute against your codebase
const findings = await engine.execute([
  { path: "src/config.ts", content: "const api_key = 'sk-1234567890';" }
]);

// See results
console.log(engine.format(findings, 'text'));
```

### Step 3: Output in different formats

```typescript
// JSON for programmatic use
const json = engine.format(findings, 'json');

// SARIF for GitHub Security
const sarif = engine.format(findings, 'sarif', { version: '2.1' });

// HTML report
const html = engine.format(findings, 'html', { theme: 'dark' });
```

## Usage with Attune

```typescript
import { Engine } from 'json-function-engine';

const engine = new Engine();
const result = await engine.loadFunctions('./functions/*.json');

console.log(`Loaded ${result.loaded} functions (${result.errors.length} errors)`);

const findings = await engine.execute([
  { path: 'src/index.ts', content: '...' }
], { framework: 'nextjs' });

// Get SARIF output for GitHub Security
const sarif = engine.format(findings, 'sarif', { version: '2.1' });
```

## JSON Schema

Validate your function definitions using the JSON Schema:

```json
{
  "$schema": "https://json-function-engine.dev/schema/v1/functions.json",
  "version": "1.0",
  "rules": [...]
}
```

Download the schema from [`schema/v1/functions.json`](schema/v1/functions.json) or use with VS Code:

```json
{
  "$schema": "./node_modules/json-function-engine/schema/v1/functions.json"
}
```

## Function Schema

```json
{
  "version": "1.0",
  "functions": [
    {
      "id": "UNIQUE_FUNCTION_ID",
      "name": "Human readable name",
      "description": "What this function detects or does",
      "enabled": true,
      "priority": 1,
      "frameworks": ["react", "vue"],

      // Optional metadata (preserved in findings)
      "category": "security",
      "recommendation": {
        "title": "Fix this issue",
        "description": "How to fix the issue",
        "library": "React"
      },
      "catches": ["What the rule detects"],
      "fix": ["How to fix it"],

      "condition": { ... },
      "action": { ... }
    }
  ]
}
```

**Metadata fields:**
- `category` - Category for grouping (e.g., "security", "typescript")
- `recommendation` - Actionable fix info with title, description, library
- `catches` - Array of strings describing what the rule detects
- `fix` - Array of strings with fix suggestions

## Condition Types

| Type | Description |
|------|-------------|
| `regex` | Pattern matching |
| `comparison` | Value comparison (==, !=, >, <, contains, etc.) |
| `exists` | Field presence check |
| `composite` | AND/OR/NOT logic |

### Regex Condition

```json
{
  "type": "regex",
  "pattern": "TODO",
  "matchAll": false,
  "fileExtensions": [".ts", ".tsx"],
  "excludePatterns": ["// TODO", "@test"],
  "excludeRadius": 30
}
```

- `excludePatterns` - Array of regex patterns to exclude matches near
- `excludeRadius` - Characters around match to check (default: 50)

### Multiple Conditions (OR)

You can use `conditions` array instead of single `condition` - matches if ANY condition matches:

```json
{
  "id": "TODO_OR_FIXME",
  "conditions": [
    { "type": "regex", "pattern": "TODO" },
    { "type": "regex", "pattern": "FIXME" },
    { "type": "regex", "pattern": "HACK" }
  ],
  "action": { "type": "flag", "severity": "info", "message": "Incomplete code marker found" }
}
```

### Comparison Condition

```json
{
  "type": "comparison",
  "operator": "==",
  "field": "framework",
  "value": "nextjs"
}
```

### Exists Condition

```json
{
  "type": "exists",
  "field": "framework"
}
```

### Composite Condition

```json
{
  "type": "composite",
  "operator": "AND",
  "conditions": [
    { "type": "regex", "pattern": "..." },
    { "type": "exists", "field": "..." }
  ]
}
```

## Action Types

| Type | Description |
|------|-------------|
| `flag` | Create a finding |
| `block` | Stop execution |
| `transform` | Modify matched text |
| `notify` | Send an alert |

### Flag Action

```json
{
  "type": "flag",
  "severity": "high",
  "message": "Issue description"
}
```

### Block Action

```json
{
  "type": "block",
  "message": "Stopping execution",
  "severity": "critical"
}
```

### Transform Action

Transform matched text in file content:

```json
{
  "type": "transform",
  "field": "content",
  "transformation": "replace",
  "replacement": "TODO_COMPLETED"
}
```

Valid transformations: `replace`, `remove`, `uppercase`, `lowercase`, `wrap`, `trim`

For `wrap` transformation:

```json
{
  "type": "transform",
  "field": "content",
  "transformation": "wrap",
  "wrapWith": { "prefix": "<!-- ", "suffix": " -->" }
}
```

**Important:** Transform actions operate on file content **in-memory only**. The transformed content is returned in the action result but is not automatically written to disk. To persist changes, access the `transformed` field in the action result:

```typescript
const actionResult = await registry.executeAction(
  { type: 'transform', field: 'content', transformation: 'replace', replacement: 'DONE' },
  context,
  conditionResult,
  file
);

// Access transformed content
console.log(actionResult.transformed); // The transformed file content
```

### Notify Action

Send notifications to different channels:

```json
{
  "type": "notify",
  "channel": "console",
  "template": "[{{severity}}] {{functionId}}: {{message}}",
  "threshold": "high"
}
```

Valid channels: `console`, `callback`, `event`, `webhook`

For webhook channel:

```json
{
  "type": "notify",
  "channel": "webhook",
  "url": "https://your-server.com/hook",
  "method": "POST",
  "timeout": 10000,
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN"
  }
}
```

**Webhook Options:**
- `url` (required): The webhook endpoint URL
- `method`: HTTP method (GET, POST, PUT) - default: POST
- `timeout`: Request timeout in ms - default: 10000
- `headers`: Custom headers for authentication (see below)

**Webhook Authentication:** Bring your own auth by setting headers. Your webhook server validates the credentials:

```json
{
  "channel": "webhook",
  "url": "https://your-server.com/webhook",
  "headers": {
    "Authorization": "Bearer your-secret-token"
  }
}
```

Template variables: `{{functionId}}`, `{{message}}`, `{{file}}`, `{{line}}`, `{{severity}}`, `{{matchedText}}`

## Reporters

| Format | Description |
|--------|-------------|
| `json` | JSON output |
| `text` | Human-readable text |
| `html` | HTML report |
| `sarif` | SARIF for CI integration |

## Extending the Engine

### Custom Conditions

```typescript
const engine = new Engine();
engine.getRegistry().registerCondition('fileExists', {
  name: 'fileExists',
  evaluate: async (config, context, file) => {
    return {
      matched: fs.existsSync(path.join(context.cwd, config.path))
    };
  }
});
```

### Custom Actions

```typescript
engine.getRegistry().registerAction('slackNotify', {
  name: 'slackNotify',
  execute: async (config, context, matches, file) => {
    await slack.webhook.send({ channel: config.channel, text: ... });
    return { success: true, notified: true };
  }
});
```

### Custom Reporters

```typescript
engine.getRegistry().registerReporter('junit', {
  name: 'JUnit',
  format: (findings) => {
    return `<?xml version="1.0"?>
<testsuite tests="${findings.length}">
${findings.map(f => `  <testcase name="${f.message}"/>`).join('\n')}
</testsuite>`;
  }
});
```

## API

### Engine

```typescript
const engine = new Engine(options?: EngineOptions)

// Load functions from file paths
const result = await engine.loadFunctions(paths: string | string[], options?: EngineOptions)
// Returns: { loaded: number, errors: Array<{ path: string, error: string }> }

// Add functions programmatically
engine.addFunctions(functions: Rule[])

// Get loaded function count
const count = engine.getFunctionCount()

// Inspect loaded functions
const functions = engine.getFunctions()

// Clear all functions
engine.clear()

// Execute functions against files
const findings = await engine.execute(files: FileInput[], context?: ExecutionContext)

// Format findings
const output = engine.format(findings: Finding[], format: ReporterFormat, options?: FormatOptions)

// Convenience method
const output = await engine.scan(files, format?, context?, formatOptions?)
```

### Options

```typescript
interface EngineOptions {
  include?: string[];      // Only include functions matching patterns
  exclude?: string[];      // Exclude functions matching patterns
  timeout?: number;        // Timeout per function in ms (default: 5000)
  parallel?: boolean;      // Execute functions in parallel (default: true)
  maxFileSize?: number;    // Skip files larger than this (default: 10MB)
  maxLineLength?: number;  // Truncate lines longer than this (default: 10000)
  skipValidation?: boolean; // Skip JSON schema validation (default: false)
  streaming?: boolean;     // Enable streaming for large files (default: false)
  streamingThreshold?: number; // File size threshold for streaming in bytes (default: 1MB)
  streamingIgnoreExclude?: boolean; // Use streaming even with excludePatterns (default: false)
}
```

### Streaming Mode

For large files, streaming mode processes content line-by-line to reduce memory usage:

```typescript
const engine = new Engine({
  streaming: true,
  streamingThreshold: 1024 * 1024, // Files above 1MB use streaming
  streamingIgnoreExclude: false    // Default: disable streaming when excludePatterns is used
});
```

**Note:** Streaming is automatically disabled when functions use `excludePatterns` (which need adjacent line context). Set `streamingIgnoreExclude: true` to force streaming if you don't use excludePatterns:

```typescript
// Force streaming even with excludePatterns (you understand exclude won't work)
const engine = new Engine({
  streaming: true,
  streamingIgnoreExclude: true
});
```

### Skip Validation

By default, function files are validated against the JSON schema. You can skip validation to allow complex functions that don't conform to the standard schema:

```typescript
// Load functions without schema validation
const result = await engine.loadFunctions('./functions/*.json', {
  skipValidation: true
});
```

This is useful when:
- Using custom properties not in the schema
- Gradually migrating functions
- Using the engine in non-standard ways

## Execution Context

The execution context provides additional information during function execution:

```typescript
interface ExecutionContext {
  cwd: string;             // Current working directory
  framework?: string;       // Target framework (e.g., 'nextjs', 'react')
  signal?: AbortSignal;    // Cancellation signal
  [key: string]: unknown;  // Custom context values
}
```

### Framework Filtering

Functions can be targeted to specific frameworks:

```json
{
  "id": "NEXTJS_ONLY",
  "frameworks": ["nextjs"],
  "condition": { "type": "regex", "pattern": "getServerSideProps" },
  "action": { "type": "flag", "severity": "info", "message": "Server-side rendering detected" }
}
```

When executing, specify the framework to run only matching functions:

```typescript
const findings = await engine.execute(files, {
  cwd: '.',
  framework: 'nextjs'  // Only runs functions that target nextjs or have no framework restriction
});
```

### Cancellation

Support cancellation via AbortSignal:

```typescript
const controller = new AbortController();

const findings = await engine.execute(files, {
  cwd: '.',
  signal: controller.signal
});

// Cancel after timeout
setTimeout(() => controller.abort(), 5000);
```

### Metrics

Access execution metrics:

```typescript
await engine.execute(files, { cwd: '.' });
const metrics = engine.getMetrics().getMetrics();

console.log({
  functionsExecuted: metrics.functionsExecuted,
  filesProcessed: metrics.filesProcessed,
  findingsCount: metrics.findingsCount,
  errorsCount: metrics.errorsCount,
  findingsBySeverity: metrics.findingsBySeverity
});
```

### Error Aggregation

Get execution errors:

```typescript
await engine.execute(files, { cwd: '.' });
const errors = engine.getErrors();

for (const error of errors) {
  console.log(`Function ${error.functionId} on ${error.file}: ${error.error}`);
}
```

## Error Handling

### Invalid JSON Files

If a JSON file is malformed, `loadFunctions()` will log a warning and continue:

```typescript
const result = await engine.loadFunctions('./functions/*.json');
// If some files fail:
// result.loaded = 5    // successfully loaded
// result.errors = [{ path: './functions/bad.json', error: 'Unexpected token }' }]
```

### Invalid Regex Patterns

Invalid regex patterns in conditions are logged as warnings. The function is skipped:

```json
{
  "condition": {
    "type": "regex",
    "pattern": "[invalid("
  }
}
// Warning: Invalid regex pattern in function INVALID_FUNC
```

### Duplicate Function IDs

When the same function ID is defined multiple times, later definitions override earlier ones. A warning is logged.

### Timeout Handling

Each function has a configurable timeout (default: 5 seconds). If execution exceeds the timeout, it's terminated and a warning is logged:

```typescript
const engine = new Engine({ timeout: 1000 }); // 1 second timeout
const findings = await engine.execute(files);
// If a function takes >1s, it's terminated and execution continues
```

## Performance

- **Bundle size**: < 15KB gzipped
- **Regex caching**: Compiled patterns are cached
- **ReDoS protection**: Configurable timeout per function (default: 5s)
- **Parallel execution**: Functions can run concurrently

## Use Cases

| Use Case | Description |
|----------|-------------|
| Code scanning | Scan source for secrets, TODOs, patterns |
| Data validation | Validate API responses against functions |
| Config processing | Evaluate conditions in config files |
| Simple workflows | Conditional data pipelines |

## Interested in Consolidating?

If you're a maintainer considering rolling similar functionality into your core package, I'm happy to point users your direction instead. Open an issue to discuss.

## License

MIT
