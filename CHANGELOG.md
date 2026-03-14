# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2024-03-13

### Added

- **Custom Error Types** (`src/utils/errors.ts`)
  - `EngineError` base class with error codes
  - `ValidationError` - Schema/validation failures
  - `FunctionLoadError` - Function loading failures
  - `FunctionExecutionError` - Runtime errors during execution
  - `TimeoutError` - Timeout during function execution
  - `FileError` - File I/O errors
  - `RegistryError` - Unknown condition/action/reporter types

- **Error Policy System**
  - `ErrorPolicy` type: `'best-effort' | 'fail-fast'`
  - Default is `'best-effort'` - continues on errors, collects all findings
  - `'fail-fast'` - throws immediately on first error
  - `setErrorPolicy()` and `getErrorPolicy()` methods on Engine

- **Error Classification**
  - `ClassifiedError` with `phase` (condition/action) and `type` (validation/timeout/runtime/unknown)
  - Better debugging for which phase failed

- **ReDoS Protection** (`src/utils/regex.ts`)
  - Pattern validation at load time:
    - Max pattern length: 500 characters
    - Max capturing groups: 10
    - Max alternations: 10
    - Detection of 10 known ReDoS patterns
  - Runtime timeout protection during regex evaluation
  - Per-line timeout checks (100ms limit)

### Changed

- `.gitignore` updated with proper build-related entries for publishing
- Event listener cleanup in Engine.execute() to prevent memory leaks

### Fixed

- Event listener leak in abort signal handling
- Type assertion issues in FileLoader

---

## [1.0.0-alpha.1] - 2026-03-13

### Changed

- **API Naming**: Renamed all methods and types to use "function"-based terminology
  - `loadRules()` → `loadFunctions()`
  - `getRules()` → `getFunctions()`
  - `addRules()` → `addFunctions()`
  - `clearRules()` → `clear()`
  - `validateRuleSet()` → `validateFunctionSet()`
  - `filterRulesByPattern()` → `filterFunctionsByPattern()`
  - `Rule` type now has `Function` alias
  - `RuleSet` type now has `FunctionSet` alias

### Added

- **Core Engine**
  - Load functions from JSON files with glob pattern support
  - Execute functions against source files or JSON data
  - Return structured results (findings)

- **Built-in Condition Types**
  - `regex` - Pattern matching with file extension filtering
  - `comparison` - Value comparison (==, !=, >, <, >=, <=, contains, startsWith, endsWith)
  - `exists` - Field presence check
  - `composite` - AND/OR/NOT logic combinations

- **Built-in Action Types**
  - `flag` - Create a finding with severity
  - `block` - Stop execution
  - `transform` - Modify/transform data
  - `notify` - Send an alert

- **Built-in Reporters**
  - `json` - JSON output with pretty option
  - `text` - Human-readable text output
  - `html` - HTML report with dark/light themes
  - `sarif` - SARIF format for CI integration (v2.1)

- **Extensibility System**
  - Registry for custom conditions
  - Registry for custom actions
  - Registry for custom reporters

- **Performance Features**
  - Regex pre-compilation and caching
  - ReDoS protection with configurable timeout (default: 5s)
  - Parallel execution (configurable)

- **Developer Experience**
  - JSON Schema for validation (`schema/v1/rules.json`)
  - Comprehensive TypeScript types
  - Detailed error messages
  - "Your First Function" tutorial in README
  - Error handling documentation

### Performance

- **Bundle size**: ~7KB gzipped (target was <15KB)
- **Performance**: ~100ms for 448 rules (target was <5s)

### Dependencies

- **Zero runtime dependencies** - All functionality is custom-built

---

## [1.0.0-alpha.0] - 2026-03-08

### Added

- Initial alpha release
- Core engine with regex, comparison, exists conditions
- flag and block actions
- json and text reporters

[0.8.0]: https://github.com/json-function-engine/core/releases/v0.8.0
[1.0.0-alpha.1]: https://github.com/json-function-engine/core/releases/v1.0.0-alpha.1
[1.0.0-alpha.0]: https://github.com/json-function-engine/core/releases/v1.0.0-alpha.0
