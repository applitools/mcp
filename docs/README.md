# Applitools MCP Server

The Applitools MCP server helps you create, update, review, and resolve visual tests using Applitools Eyes across any of our supported SDKs.

It connects to AI assistants through the Model Context Protocol (MCP), letting tools like Cursor, GitHub Copilot, Cline, and Claude Code (and more) set up tests, add visual checkpoints, configure cross-browser testing, and investigate visual test failures (accepting, rejecting, or adjusting the changes behind them) without ever leaving your IDE.

To [learn more](https://applitools.com/docs/eyes/integrations/mcp-servers/applitools-mcp), please visit our MCP documentation.

## Purpose
This server is built for developers, testers, or QA working with AI-assisted workflows.

It enables your AI assistant to:

* Understand your project configuration
* Guide Eyes setup
* Add visual checkpoints and suggest best practices
* Investigate a batch, scenario, session, or step of visual test failures and tell you what changed, whether it's a bug, and why
* Accept, reject, or adjust match regions for a checkpoint, with your explicit approval before anything is committed to baseline

All without requiring manual, error-prone steps, or leaving your IDE.

## Who is this for?
* Engineers new to Applitools Eyes who haven't installed or implemented the Eyes SDK
* Existing Eyes SDK users who want to use the MCP server to add Ultrafast Grid coverage (cross-browser and device testing), convert existing tests into visual tests using Applitools visual AI, or retrieve and analyze visual test results
* Teams triaging visual test failures at scale
  * Who want an AI assistant to investigate a batch of failing tests, gather evidence, and tell them exactly what changed and whether it needs attention, instead of clicking through the Eyes dashboard test by test

## Requirements & Limitations
* Node.js 18 or newer
* VS Code, Cursor, Claude Code, Cline, or any other MCP client assistant
* The setup and checkpoint tools (eyes_setup_project, eyes_setup_ufg, eyes_add_checkpoints_to_test) support only our [Playwright Fixtures SDK](https://applitools.com/docs/eyes/playwright). Support for additional SDK frameworks is coming soon!
  * Use the latest versions of Playwright, Node.js, and our Playwright JavaScript Fixtures SDK
  * Requires access to your project's source code (for the setup and checkpoint tools)
* The Inspection, Resolution, and Review tools (`eyes_inspect_*, eyes_resolve_*, eyes_review_*`) work with any Eyes test results, regardless of which SDK or language produced them, as they operate on already-captured batch, session, and DOM data
  * These tools require additional separate read and write API keys

## Installation
Recommended: VS Code Extension or Cursor MCP Install

The easiest way to start using Eyes MCP is through the Applitools VS Code extension or by installing the MCP server directly in Cursor.

  * Runs the MCP server automatically
  * Connects it to Copilot or Cursor's AI assistant
  * Provide context-aware code edits
  * Surface visual test results inside your IDE or MCP client CLI of choice

Simply install the MCP server by clicking an option below:

<a href="vscode:extension/applitools.mcp-vscode-extension">
  <img src="https://img.shields.io/badge/Install-VS_Code-007ACC?logo=visualstudiocode&logoColor=white">
</a>

<a href="cursor:extension/applitools.mcp-vscode-extension">
  <img src="https://img.shields.io/badge/Install-Cursor-000000">
</a>
<br></br>

Alternatively, you can install the server manually by following the `Manual Setup` section below.

## Manual Setup

If you prefer not to use the extension, you can install the MCP server manually by following the examples below.

Standard MCP configuration:
```
{
  "mcpServers": {
    "applitools-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "@applitools/mcp@latest"]
    }
  }
}
```

<details>
  <summary>VS Code</summary>

Please see the [VS Code MCP install guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server) and use the standard config above. 

Alternatively, install it via the VS Code CLI:

`code --add-mcp '{"name":"applitools-mcp","command":"npx","args":["@applitools/mcp@latest"]}'`
</details>

<details>
  <summary>Copilot</summary>

Create or edit the configuration file ~/.copilot/mcp-config.json and add:
```
{
 "mcpServers": {
   "applitools-mcp": {
     "type": "local",
     "command": "npx",
     "tools": [
       "*"
     ],
     "args": [
       "@applitools/mcp@latest"
     ]
   }
 }
}
```
</details>

<details>
  <summary>Cursor</summary>
In your user root directory, edit or add the above configuration to your `~/.cursor/mcp.json` file.
<br></br>
Alternatively, go to Cursor Settings -> MCP -> Add new MCP Server. Name it `applitools-mcp`, use `command` type with the command `npx -y @applitools/mcp@latest`. 
</details>

<details>
  <summary>Cline</summary>

Follow the instruction in the section [Configuring MCP Servers](https://docs.cline.bot/mcp/configuring-mcp-servers)

Add the following to your `cline_mcp_settings.json` file:

```
{
  "mcpServers": {
    "applitools-mcp": {
      "command": "npx",
      "args": ["--yes", "@applitools/mcp@latest"],
      "disabled": false,
      "type": "stdio",
	   "timeout": 60
    }
  }
}
```
</details>

<details>
  <summary>Claude Code (CLI)</summary>
Use the Claude Code CLI to add the Applitools MCP server:

`claude mcp add applitools-mcp npx @applitools/mcp@latest`
</details>

<details>
  <summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers), and use the standard MCP configuration above.
</details>

## Authentication
Three keys control what the server can do, set as global environment variables, in a `.env` file in your project, or update the applitools-mcp configuration in your `mcp.json` file:

* APPLITOOLS_API_KEY: Used for test execution (unchanged; this is the key you already use to run Eyes visual tests). See [our documentation](https://applitools.com/docs/eyes/getting-started/retrieve-api-key) on retrieving your execution key.
  * Note: The MCP server will look in additional places for this key. See the `eyes_verify_api_key` tool for details.
* APPLITOOLS_READ_KEY: A read-only key. Required for all Inspection tools, for all Resolution tools, and for Review tools running in either mode.
* APPLITOOLS_WRITE_KEY: A write-only key. Required for all Resolution tools and for Review tools running in resolve mode (the default).

How to get read-only and write-only API keys:

See [our documentation](https://applitools.com/docs/eyes/concepts/applitools-test-manager/admin/api-keys-view) on API key management.

1. Go to the Applitools Admin API Keys page.
2. Create or copy a read-only API key associated with your user and team.
3. Create or copy a write-only API key associated with your user and team.
4. Set it via a `.env` file in your project, a global environment variable, or the applitools-mcp configuration in your `mcp.json` file.

Note: `APPLITOOLS_API_KEY` (for test execution) is different from `APPLITOOLS_READ_KEY` and `APPLITOOLS_WRITE_KEY`. The Inspection, Resolution, and Review tools (`eyes_inspect_*, eyes_resolve_*, eyes_review_*`) require these separate read-only and write-only permission keys to query session data, review/inspect, and resolve your tests.

Example applitools-mcp mcp.json configuration with all three keys set:

```
{
  "mcpServers": {
    "applitools-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "@applitools/mcp@latest"],
      "env": {
        "APPLITOOLS_API_KEY": "<your execution API key>",
        "APPLITOOLS_READ_KEY": "<your read-only key>",
        "APPLITOOLS_WRITE_KEY": "<your write-only key>"
      }
    }
  }
}
```
Example .env file in your project with all three keys set:
```
APPLITOOLS_API_KEY=<your execution API key>
APPLITOOLS_READ_KEY=<your read-only key>
APPLITOOLS_WRITE_KEY=<your write-only key>
```

## Available Tools

### Setup & Configuration

#### eyes_verify_api_key
Validates your Applitools API key and, if provided, verifies connectivity to a specified Eyes server URL (e.g., non-public cloud).

Searches common locations:

* APPLITOOLS_API_KEY environment variable and/or APPLITOOLS_SERVER_URL, if applicable
* .env file in your project
* applitools.config.*
* playwright.config.*
* applitools-mcp mcp.json configuration file

Supported Eyes SDKs: All

#### eyes_setup_project
Guides the setup of Applitools Eyes in your Playwright project (Fixtures variant).

Includes:
* The Eyes reporter configuration
  * Extends the Playwright HTML report to include Eyes visual test results. Users can approve or reject results in the report without having to visit the Eyes dashboard.
* Adding Eyes settings and dependency imports into your project files
* Recommended defaults

Supported Eyes SDKs: [Playwright TypeScript/JavaScript Fixtures](https://applitools.com/docs/eyes/playwright)

#### eyes_add_checkpoints_to_test
Adds Eyes visual checkpoints to your existing Playwright test in line with best practices.

Supported Eyes SDKs: [Playwright TypeScript/JavaScript Fixtures](https://applitools.com/docs/eyes/playwright)

#### eyes_setup_ufg
Configures the Ultrafast Grid (UFG) for cross-browser and cross-device testing. Guides you through UFG setup to run visual tests across multiple browsers, viewports, and devices simultaneously.

Supported Eyes SDKs: [Playwright TypeScript/JavaScript Fixtures](https://applitools.com/docs/eyes/playwright)

### Inspection (read-only)
Requires `APPLITOOLS_READ_KEY`. These tools query batch, session, step, and DOM data without changing anything. Your assistant typically calls these on your behalf as part of a Review (see below); you can also ask for any of them directly for manual or ad-hoc investigation.

Supported Eyes SDKs: All

#### eyes_inspect_sessions
Lists a batch's sessions and batch-wide stats. Narrow to only unresolved or unsaved sessions, or shape the response to full detail, stats only, or a deduplicated list of scenario names. The entry point for browsing a batch. Use this first when asking "what's in this batch?" or "what still needs review?"

#### eyes_inspect_steps
Lists a session's steps: whether each is matching, plus baseline/checkpoint image and DOM IDs, sizes, and resolution status. Use when drilling into one session.

#### eyes_inspect_changed_areas
Returns a step's diff regions, clustered from raw pixel-level differences and already accounting for any regions you've added. Past 20 changed areas in a step, dense clusters are grouped into a single enclosing area, so your assistant focuses on what's meaningfully different rather than pixel noise.

#### eyes_inspect_image
Exports a baseline or checkpoint screenshot for a step, optionally cropped to a specific area.

#### eyes_inspect_image_diff
Exports the checkpoint screenshot with changed areas highlighted, so you can see at a glance what moved or changed.

#### eyes_inspect_dom
Exports a DOM capture for a step to a file, with a stable id assigned to every element so your assistant can reference "element 14" instead of an XPath or raw coordinates. Requires DOM capture to have been enabled when the test ran; returns no data (not an error) otherwise.

#### eyes_inspect_dom_diff
Returns the structural difference between a step's checkpoint and baseline DOM (only what actually changed), with pure position shifts and mass changes (e.g. "everything below moved down") automatically consolidated instead of listed element by element.

#### eyes_inspect_dom_search
Searches a DOM capture using a predicate query language, documented as its own MCP resource: combine property comparisons, geometry and size checks, ancestor/descendant relationships, and shortcut keywords like image or button with and/or/not, instead of requiring your assistant to read the entire capture.

#### eyes_inspect_evidence
Returns everything needed to review a step's changed areas in one call: for each area you ask about, the image diff plus the baseline and checkpoint screenshots, together with the step's whole DOM diff and the match regions currently in effect. Preferred over calling eyes_inspect_image_diff, eyes_inspect_image, eyes_inspect_dom_diff and eyes_inspect_regions separately; it is what a Review gathers its evidence with.

#### eyes_inspect_regions
Returns the match regions currently in effect for a step, combining regions defined in your test code with any added or changed since the test ran. Checked before adding a new region, so your assistant doesn't create an overlapping or duplicate one.

#### eyes_inspect_history
Returns a DOM node's diff history across prior runs, used as evidence that a change is recurring/dynamic content rather than a one-time real change.

### Review (orchestration)
Requires APPLITOOLS_READ_KEY always, and additionally APPLITOOLS_WRITE_KEY when running in resolve mode (the default). This is the primary way to use these tools day-to-day: ask your assistant to review a batch, scenario, session, or step, and it drives the full investigation for you.

Supported Eyes SDKs: All

#### eyes_review_progress
Drives a guided investigation at whatever scope you ask for (a batch, a scenario, a session, or a single step), gathering the evidence (images, DOM diff, history) needed for each changed area before a finding can be reported. This is the tool your assistant reaches for when you say "review my batch" or "review this session"; it calls the Inspection tools internally in the right order, so you don't have to.

#### eyes_review_diff_report
Records a structured finding for one changed area: its classification, whether it's consistent with the surrounding page, bug status, expected status, and (if it's recurring/dynamic content) supporting evidence and a recommended mask. Requires your assistant to gather the relevant evidence first; a finding filed without it is rejected and redirected back to whichever inspection call is missing.

#### eyes_review_end
Summarizes and finalizes the investigation at the given scope, deduplicating every child finding into one clean summary with nothing dropped or double-counted. At the step level, this is also where a step's accept/reject/unresolved outcome is decided (in resolve mode).

Two Review modes:

* inspect: read-only. Produces a summary of what changed with no mutation. Good for a first look, or when you want to see findings before deciding what to do.
* resolve (the default): additionally applies masks for confirmed-dynamic diffs and decides each step's accept/reject/unresolved outcome automatically, as findings come in. Your assistant never has to call the Resolution tools independently to make this happen.

Either mode can be scoped to a whole batch or narrowed to a single scenario, session, or step. A completed inspect-mode review can later be promoted to resolve mode without redoing the investigation; its cached findings are simply replayed through the resolve-mode decision logic. Saving changes to the baseline, or resetting it, is never part of Review itself; ask separately for `eyes_resolve_save` (or `eyes_resolve_reset`), each of which still requires your explicit approval.

### Resolution (mutating)

Requires both `APPLITOOLS_READ_KEY` and `APPLITOOLS_WRITE_KEY`. In ordinary use, you generally won't call these directly. Review applies the equivalent decisions automatically as it works through a batch. Reach for these tools directly only for one-off, manual resolution outside of a Review, e.g. accepting a single already-understood step without running a full investigation.

Supported Eyes SDKs: All

#### eyes_resolve_checkpoint
Marks a step's checkpoint as accepted or rejected. Accepted checkpoints replace the baseline once saved; rejected ones keep the existing baseline. By default, applies the same decision to every step sharing the identical diff, both within the session and across sibling sessions with the same scenario name.

#### eyes_resolve_regions
Adds, removes, or updates a step's match regions, read against either the baseline or the checkpoint image/DOM. Propagates the same way as eyes_resolve_checkpoint.

Note: This tool always requires your explicit approval before running

#### eyes_resolve_save
Commits every accepted/rejected step and every region change in the whole batch to the baseline — all of the batch's tests, not just the session you name. Until this runs, resolution decisions stay pending and the baseline is untouched.

Note: This tool always requires your explicit approval before running

#### eyes_resolve_reset
Restores a session's or batch's baseline to the revision the test originally ran against, and clears any pending resolution decisions.

Note: This tool always requires your explicit approval before running

## Getting started & Usage Examples
Ask your AI assistant about Applitools:

* "Using the Applitools MCP server, perform the following tasks"
  * This prompt prefix is optional and can guide your assistant to use the MCP server for better results.
* "Verify my Applitools API key"
* "Set up Applitools Eyes for my Playwright project"
  * For Playwright TypeScript/JavaScript
* "Add Eyes visual checkpoints to my login.spec test"
  * For Playwright TypeScript/JavaScript
* "Configure cross-browser testing with the Applitools UFG"
  * For Playwright TypeScript/JavaScript
* "Show me the batch URL for my last test results"
* "Analyze and summarize my batch results"
* "Review my last batch and tell me what changed"
* "Just show me what changed in this batch, don't resolve anything yet"
* "That all looks right. Go ahead and resolve it now"
* "Accept the checkout button diffs across all sessions in this scenario"
* "Is this diff on the timestamp element dynamic, or a real change?"
* "Reset this batch's baseline to what it originally ran against"

## Helpful links

* [Applitools MCP Documentation](https://applitools.com/docs/eyes/integrations/mcp-servers/applitools-mcp)
* [Contact Support](https://help.applitools.com/hc/en-us/requests/new)

---

Built with ❤️ by Applitools