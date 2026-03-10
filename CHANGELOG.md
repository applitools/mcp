# Changelog

All notable changes to the Applitools Eyes MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1](https://github.com/applitools/mcp/compare/js/mcp@0.4.0...js/mcp@0.4.1) (2026-03-08)

### Bug Fixes

* unskip js/mcp ([#3618](https://github.com/applitools/mcp/issues/3618)) ([103f9e2](https://github.com/applitools/mcp/commit/103f9e2f18cddc225aba2f2f59556e5fa38965c0))

## [0.4.0](https://github.com/applitools/mcp/compare/js/mcp@0.3.0...js/mcp@0.4.0) (2026-03-08)

### Features

* mcp improved naming conventions | AD-12875 ([#3611](https://github.com/applitools/mcp/issues/3611)) ([6f1020e](https://github.com/applitools/mcp/commit/6f1020e08015d74c108780ca63716ffda36a7472))
* release java ([7bc39e6](https://github.com/applitools/mcp/commit/7bc39e679eab27a19322ca4b121177da7437c106))

## [0.3.0](https://github.com/applitools/mcp/compare/js/eyes-mcp@0.2.1...js/eyes-mcp@0.3.0) (2026-03-02)

### Features

* http 2 support | FLD-4085 ([#3539](https://github.com/applitools/mcp/issues/3539)) ([b304d4a](https://github.com/applitools/mcp/commit/b304d4a1072a201d1c3f5cea1275b6a15230d6aa))

## [0.2.1](https://github.com/applitools/mcp/compare/js/eyes-mcp@0.2.0...js/eyes-mcp@0.2.1) (2026-03-01)

### Performance Improvements

* use sharp to accelerate png performance in all js packages ([#3547](https://github.com/applitools/mcp/issues/3547)) ([6e3c7b9](https://github.com/applitools/mcp/commit/6e3c7b9e34815f470032ece52a161001592ad1b1))

## [0.2.0](https://github.com/applitools/mcp/compare/js/eyes-mcp@0.1.0...js/eyes-mcp@0.2.0) (2026-02-16)

### Features

* mcp server test results support and improvements to initial setup ([#3518](https://github.com/applitools/mcp/issues/3518)) ([ef6c27b](https://github.com/applitools/mcp/commit/ef6c27b9e35dc54fd588e19a4811631433e15dbb))

## [0.1.0](https://github.com/applitools/mcp/compare/js/eyes-mcp-server-v0.0.1...js/eyes-mcp-server@0.1.0) (2026-01-28)

### Features

* release java ([7bc39e6](https://github.com/applitools/mcp/commit/7bc39e679eab27a19322ca4b121177da7437c106))

## [Unreleased]

### Changed
- **BREAKING**: Recommended server name changed from `"applitools-eyes"` to `"eyes"` for shorter tool names
  - Tool names now appear as `mcp__eyes__info` instead of `mcp__applitools-eyes__info`
  - Old server name still works for backward compatibility
- Reorganized tools directory structure for better code separation
  - Each tool now resides in its own subdirectory under `src/tools/`
  - Updated import paths to reflect new structure

### Added
- VS Code Extension support for automatic MCP server registration
  - Auto-registers with VS Code, Cline, and Claude Code
  - Auto-cleanup on extension uninstall
- Claude Code integration in VS Code Extension
- Comprehensive documentation in `src/tools/README.md` for tool development
- Project structure section in main README
- Development and Contributing sections in main README

### Fixed
- Import paths updated to work with new directory structure

## [1.0.0] - 2025-01-04

### Added
- Initial release of Applitools Eyes MCP
- `info` tool for server capabilities information
- `version` tool for version information display
- Support for stdio and SSE (HTTP) transports
- Dual-mode server operation (stdio by default, SSE with --port flag)
- Clear attribution and branding for all tool responses
- Comprehensive error handling
- Zero-configuration setup via npx

### Documentation
- Complete README with installation instructions
- Configuration examples for Cursor, VS Code, Cline, and Claude Code
- Usage examples and prompts

[Unreleased]: https://github.com/applitools/mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/applitools/mcp/releases/tag/v1.0.0
