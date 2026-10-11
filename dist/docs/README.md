# Applitools MCP Server

The Applitools MCP server helps you create, update, and analyze visual tests using Applitools Eyes with our [Playwright (JavaScript/TypeScript) Fixtures SDK](https://applitools.com/docs/eyes/playwright), with support for more frameworks coming soon.

It connects to AI assistants through the Model Context Protocol (MCP), allowing tools like Cline, Claude Code, and IDE assistants to help you set up tests, add visual checkpoints, and configure cross-browser testing.

To [learn more](https://applitools.com/docs/eyes/integrations/mcp-servers/applitools-mcp), please visit our MCP documentation.

## Purpose
This server is built for developers, testers, or QA working with AI-assisted workflows.

It enables your AI assistant to:
* Understand your project configuration
* Guide Eyes setup
* Add visual checkpoints and suggest best practices
* Review your visual test results

All without requiring manual, error-prone steps.

## Who is this for?
* New users to test automation
  * No existing automation framework.
* Playwright JavaScript engineers new to Applitools Eyes
  * Playwright is already used, but Eyes has not yet been installed or implemented.
* Existing Eyes Playwright Fixtures users
  * Who want to use the MCP server to:
    * Add Ultrafast Grid coverage (cross-browser and device testing)
    * Expand visual checkpoints in existing tests
    * Retrieve and analyze your visual test results

## Requirements & Limitations
* Node.js 18 or newer
* VS Code, Cursor, Claude Desktop, or any other MCP client assistant
* Supports Playwright JavaScript/TypeScript projects and our [Playwright Fixtures SDK](https://applitools.com/docs/eyes/playwright) only.
  * It is recommended using the most recent versions of Playwright Node.js and our Playwright JavaScript Fixtures SDK
  * Requires projects utilizing [Playwright Test](https://playwright.dev/docs/api/class-test) 
* Requires access to your projects source code

## Installation
Recommended: VS Code Extension or Cursor MCP Install

The easiest way to start using Eyes MCP is through the Applitools VS Code extension or by installing the MCP server directly in Cursor.

  * Runs the MCP server automatically
  * Connects it to your AI assistant
  * Provide context-aware code edits
  * Surface visual test results inside your IDE or MCP client CLI of choice

<a href="https://marketplace.visualstudio.com/items?itemName=applitools-mcp">
  <img src="https://img.shields.io/badge/Install-VS_Code-007ACC?logo=visualstudiocode&logoColor=white">
</a>

<a href="cursor://anysphere.cursor-deeplink/mcp/install?name=applitools-mcp&config=eyJjb21tYW5kIjoibnB4IC15IEBhcHBsaXRvb2xzL21jcEBsYXRlc3QifQ">
  <img src="https://img.shields.io/badge/Install-Cursor-000000">
</a>
<br></br>

Alternatively, you can install the server manually by following the `Manual Setup` section below.

### What's Included

* Automatic MCP server management
* Seamless IDE + AI assistant integration
* Context-aware assistance based on open files
* Smart code edits and checkpoint suggestions
* Visual test results directly inside your IDE

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
Use the Claude Code CLI to add the Playwright MCP server:

`claude mcp add applitools-mcp npx @applitools/mcp@latest`
</details>

<details>
  <summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers), and use the standard MCP configuration above.
</details>

## Available Tools

### eyes_verify_api_key
Checks your Applitools API key and optional Eyes server URL. 

Searches common locations:

* APPLITOOLS_API_KEY environment variable and/or APPLITOOLS_SERVER_URL, if applicable
* .env
* applitools.config.*
* playwright.config.*

### eyes_setup_project
Guides the setup of Applitools Eyes in your Playwright project (Fixtures variant).

Includes:
* The Eyes reporter configuration
  * Extends the Playwright HTML report to include Eyes visual test results. Users can approve or reject results in the report without having to visit the Eyes dashboard.
* Adding Eyes settings and dependency imports into your project files
* Recommended defaults

### eyes_add_checkpoints_to_test
Adds Eyes visual checkpoints to your existing Playwright test in line with best practices.

### eyes_setup_ufg
Configures the Ultrafast Grid (UFG) for cross-browser and cross-device testing. Guides you through UFG setup to run visual tests across multiple browsers, viewports, and devices simultaneously.

### eyes_fetch_visual_results
Retrieves structured visual test results, including:
* The Eyes batch name
* The visual tests that ran
* The visual test statuses (passed/failed/new/unresolved/etc.)

### eyes_get_batch_url
Extracts and converts Eyes test result URLs from console output. Parses test execution output to find session URLs and converts them to batch URLs for viewing all test results together in the Eyes dashboard.

## Getting started & Usage
Ask your AI assistant about Applitools:

* “Using the Applitools MCP server, perform the following tasks”
  * This prompt prefix is optional and can guide your LLM and direct it to use the MCP server for better results.
* "Set up Applitools Eyes for my project"
* "Verify my Applitools API key"
* "Add Eyes visual checkpoints to my login.spec test"
* "Configure cross-browser testing with the Applitools UFG"
* "Show me the batch URL for my last test results"
* "Provide me a summary of my last visual test results"

## Helpful links

* [Applitools MCP Documentation](https://applitools.com/docs/eyes/integrations/mcp-servers/applitools-mcp)
* [Applitools Playwright Fixtures SDK](https://applitools.com/docs/eyes/playwright)
* [Contact Support](https://help.applitools.com/hc/en-us/requests/new)

---

Built with ❤️ by Applitools