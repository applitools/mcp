#!/usr/bin/env node
'use strict';

var node_url = require('node:url');
var mcp_js = require('@modelcontextprotocol/sdk/server/mcp.js');
var stdio_js = require('@modelcontextprotocol/sdk/server/stdio.js');
var promises = require('node:fs/promises');
var path = require('node:path');
var logger$1 = require('@applitools/logger');
var coreBase = require('@applitools/core-base');
var fs = require('node:fs');
var dotenv = require('dotenv');
var os = require('node:os');
var crypto = require('node:crypto');
var req = require('@applitools/req');
var node_buffer = require('node:buffer');
var zlib = require('node:zlib');
var utils = require('@applitools/utils');
var node_async_hooks = require('node:async_hooks');
var zod = require('zod');
var image = require('@applitools/image');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);
var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);
var dotenv__namespace = /*#__PURE__*/_interopNamespaceDefault(dotenv);
var os__namespace = /*#__PURE__*/_interopNamespaceDefault(os);
var crypto__namespace = /*#__PURE__*/_interopNamespaceDefault(crypto);
var zlib__namespace = /*#__PURE__*/_interopNamespaceDefault(zlib);
var utils__namespace = /*#__PURE__*/_interopNamespaceDefault(utils);

const TOOL_NAMES = {
    EYES_VERIFY_API_KEY: 'eyes_verify_api_key',
    EYES_SETUP_PROJECT: 'eyes_setup_project',
    EYES_SETUP_UFG: 'eyes_setup_ufg',
    EYES_ADD_CHECKPOINTS: 'eyes_add_checkpoints_to_test',
};
/** Opt-in for the experimental tool set (`1`/`true`). Off by default; see `EXPERIMENTAL_TOOLS`. */
const EXPERIMENTAL_ENV = 'APPLITOOLS_MCP_EXPERIMENTAL';
const DEFAULT_SERVER_URL = 'https://eyes.applitools.com';
const TRANSPORT_MODE = 'stdio';
const RESOURCE_URIS = {
    DOCUMENTATION_README: 'mcp://documentation/readme.md',
};
const RESOURCE_METADATA = {
    DOCUMENTATION_README: {
        title: 'Applitools MCP Server - Complete Documentation',
        description: 'Comprehensive guide covering setup, tools, usage patterns, best practices, and examples',
        mimeType: 'text/markdown',
    },
};

function loadEnvFile(workingDirectory) {
    const envPath = path__namespace.join(workingDirectory, '.env');
    if (!fs__namespace.existsSync(envPath)) {
        return {};
    }
    try {
        const content = fs__namespace.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');
        let apiKey;
        let serverUrl;
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }
            // Parse KEY=VALUE
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (!match)
                continue;
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (key === 'APPLITOOLS_API_KEY' && value) {
                apiKey = value;
            }
            else if (key === 'APPLITOOLS_SERVER_URL' && value) {
                serverUrl = value;
            }
        }
        if (apiKey) {
            return { apiKey, serverUrl, foundIn: '.env' };
        }
    }
    catch {
        // Silently ignore errors reading .env
    }
    return {};
}
/**
 * Helper to resolve environment variable references in config files
 * Checks if the content references an env var, then resolves from process.env or .env file
 */
function resolveEnvVarFromContent(content, envVarName, workingDirectory) {
    // Check if content references the environment variable (with or without process.env prefix)
    const patterns = [
        new RegExp(`process\\.env\\.${envVarName}`, 'i'),
        new RegExp(`${envVarName}(?!['"])`, 'i'), // Bare reference (not in quotes)
    ];
    const hasReference = patterns.some(pattern => pattern.test(content));
    if (!hasReference) {
        return undefined;
    }
    // Try to resolve the value: first from process.env, then from .env file
    const envValue = process.env[envVarName];
    if (envValue) {
        return envValue;
    }
    // Fallback to .env file
    const envResult = loadEnvFile(workingDirectory);
    if (envVarName === 'APPLITOOLS_API_KEY') {
        return envResult.apiKey;
    }
    else if (envVarName === 'APPLITOOLS_SERVER_URL') {
        return envResult.serverUrl;
    }
    return undefined;
}
function loadConfigFile(configPath, fileName, workingDirectory) {
    if (!fs__namespace.existsSync(configPath)) {
        return {};
    }
    try {
        const content = fs__namespace.readFileSync(configPath, 'utf-8');
        // Search for apiKey and serverUrl in the file content
        let apiKey;
        let serverUrl;
        // Pattern 1: apiKey: 'value' or apiKey: "value" (hardcoded values)
        const apiKeyMatch = content.match(/apiKey\s*:\s*['"]([^'"]+)['"]/i);
        if (apiKeyMatch) {
            apiKey = apiKeyMatch[1];
        }
        // Pattern 2: serverUrl: 'value' or serverUrl: "value" (hardcoded values)
        const serverUrlMatch = content.match(/serverUrl\s*:\s*['"]([^'"]+)['"]/i);
        if (serverUrlMatch) {
            serverUrl = serverUrlMatch[1];
        }
        // Pattern 3: Resolve environment variable references in config file
        if (!apiKey) {
            apiKey = resolveEnvVarFromContent(content, 'APPLITOOLS_API_KEY', workingDirectory);
        }
        if (!serverUrl) {
            serverUrl = resolveEnvVarFromContent(content, 'APPLITOOLS_SERVER_URL', workingDirectory);
        }
        if (apiKey) {
            return { apiKey, serverUrl, foundIn: fileName };
        }
    }
    catch {
        // Silently ignore errors reading config file
    }
    return {};
}
function findApiKey(workingDirectory = process.cwd()) {
    // Define config file patterns to check (in priority order)
    const configFiles = [
        // Applitools config files
        { name: 'applitools.config.js', path: path__namespace.join(workingDirectory, 'applitools.config.js') },
        { name: 'applitools.config.cjs', path: path__namespace.join(workingDirectory, 'applitools.config.cjs') },
        { name: 'applitools.config.mjs', path: path__namespace.join(workingDirectory, 'applitools.config.mjs') },
        { name: 'applitools.config.ts', path: path__namespace.join(workingDirectory, 'applitools.config.ts') },
        // Playwright config files
        { name: 'playwright.config.js', path: path__namespace.join(workingDirectory, 'playwright.config.js') },
        { name: 'playwright.config.cjs', path: path__namespace.join(workingDirectory, 'playwright.config.cjs') },
        { name: 'playwright.config.mjs', path: path__namespace.join(workingDirectory, 'playwright.config.mjs') },
        { name: 'playwright.config.ts', path: path__namespace.join(workingDirectory, 'playwright.config.ts') },
    ];
    // 1. Check each config file in order (config files have priority over .env)
    for (const config of configFiles) {
        const result = loadConfigFile(config.path, config.name, workingDirectory);
        if (result.apiKey) {
            return result;
        }
    }
    // 2. Check .env file as fallback
    const envResult = loadEnvFile(workingDirectory);
    if (envResult.apiKey) {
        return envResult;
    }
    // 3. Check environment variables as final fallback
    const envApiKey = process.env.APPLITOOLS_API_KEY;
    const envServerUrl = process.env.APPLITOOLS_SERVER_URL;
    if (envApiKey) {
        return {
            apiKey: envApiKey,
            serverUrl: envServerUrl,
            foundIn: 'environment variable',
        };
    }
    // Not found
    return {};
}

let currentClientInfo = undefined;
let currentCredentials = undefined;
let ide = undefined;
function setClientInfo(clientInfo) {
    currentClientInfo = clientInfo;
}
function getClientInfo() {
    return currentClientInfo;
}
function setCredentials(credentials) {
    currentCredentials = credentials;
}
function getCredentials() {
    return currentCredentials;
}
function setIDE(ideName) {
    ide = ideName;
}
function getIDE() {
    return ide;
}
function parseIDE(env, argv) {
    var _a;
    return env['ide'] || ((_a = argv.find(arg => arg.startsWith('--ide='))) === null || _a === void 0 ? void 0 : _a.split('=')[1]) || 'unknown';
}
/** Evaluated once at process start; off unless `EXPERIMENTAL_ENV` is `1`/`true` (any case). */
function parseExperimental(env) {
    var _a;
    return ['1', 'true'].includes(((_a = env[EXPERIMENTAL_ENV]) !== null && _a !== void 0 ? _a : '').toLowerCase());
}

/** Load credentials from server context, config files, or environment variables */
function loadCredentials(workingDirectory) {
    const storedCredentials = getCredentials();
    if ((storedCredentials === null || storedCredentials === void 0 ? void 0 : storedCredentials.apiKey) && (storedCredentials === null || storedCredentials === void 0 ? void 0 : storedCredentials.serverUrl)) {
        return {
            apiKey: storedCredentials.apiKey,
            serverUrl: storedCredentials.serverUrl,
            source: 'server-context',
        };
    }
    const workingDir = workingDirectory || process.cwd();
    const configResult = findApiKey(workingDir);
    const apiKey = configResult.apiKey;
    const serverUrl = configResult.serverUrl || DEFAULT_SERVER_URL;
    const source = configResult.foundIn;
    return { apiKey, serverUrl, source };
}
/** Load and store credentials in server context */
function loadAndStoreCredentials(workingDirectory) {
    const result = loadCredentials(workingDirectory);
    if (result.apiKey && result.serverUrl) {
        setCredentials({
            apiKey: result.apiKey,
            serverUrl: result.serverUrl,
        });
        return true;
    }
    return false;
}
/** Get credentials for external logging */
function getCredentialsForLogging() {
    const result = loadCredentials();
    return {
        apiKey: result.apiKey,
        serverUrl: result.serverUrl || DEFAULT_SERVER_URL,
    };
}

const handler = (() => {
    if (process.env.APPLITOOLS_LOG_FILE) {
        return logger$1.makeFileHandler({ filename: process.env.APPLITOOLS_LOG_FILE });
    }
    else if (process.env.APPLITOOLS_LOG_DIR) {
        return logger$1.makeRollingFileHandler({ dirname: process.env.APPLITOOLS_LOG_DIR });
    }
    // Default to stderr to avoid interfering with MCP stdio protocol
    return {
        // eslint-disable-next-line no-console
        log: (message) => console.error(message),
        // eslint-disable-next-line no-console
        warn: (message) => console.warn(message),
        // eslint-disable-next-line no-console
        error: (message) => console.error(message),
    };
})();
// Only perform expensive serialisation when a log sink is explicitly configured.
const isVerboseLogging = !!(process.env.APPLITOOLS_LOG_FILE ||
    process.env.APPLITOOLS_LOG_DIR ||
    process.env.APPLITOOLS_SHOW_LOGS);
const logger = logger$1.makeLogger({ level: 'all', handler });
const externalLogger = coreBase.makeCore({
    agentId: 'mcp-tool-handler',
    maskLog: false,
    logger,
    offlineLocationPath: undefined,
});
function log$2(level, ...args) {
    logger[level](level, ...args);
}
async function externalLog(eventName, data, level = 'Notice') {
    // Get credentials using centralized loader
    const { apiKey, serverUrl: eyesServerUrl } = getCredentialsForLogging();
    if (!apiKey || apiKey === '') {
        logger.warn(`Cannot log external event ${eventName} - no API key configured`);
        return;
    }
    try {
        await externalLogger.logEvent({
            settings: {
                apiKey,
                eyesServerUrl,
                level,
                event: {
                    type: eventName,
                    data: data || {},
                },
            },
            logger,
        });
    }
    catch (error) {
        logger.error(`Failed to log external event ${eventName}:`, error);
    }
}

/**
 * Documentation Resource
 *
 * Exposes the comprehensive README documentation for the Applitools MCP server
 */
/**
 * Read documentation resource content
 */
async function readDocumentationResource(uri) {
    // Validate URI first (don't log validation errors)
    if (uri !== RESOURCE_URIS.DOCUMENTATION_README) {
        throw new Error(`Unknown resource URI: ${uri}`);
    }
    try {
        // Determine the correct path based on whether we're running from source or dist
        // In production: dist/resources/documentation/index.js -> dist/docs/README.md
        // In tests: src/resources/documentation/index.ts -> docs/README.md
        let docsPath;
        if (/[\\/]dist(?:[\\/]|$)/.test(__dirname)) {
            // Running from compiled dist (standalone or VS Code extension)
            // Expect docs folder to be sibling of the script
            docsPath = path.join(__dirname, 'docs/README.md');
        }
        else {
            // Running from source (tests)
            docsPath = path.join(__dirname, '../../../docs/README.md');
        }
        const content = await promises.readFile(docsPath, 'utf-8');
        return {
            contents: [
                {
                    uri,
                    text: content,
                    mimeType: 'text/markdown',
                },
            ],
        };
    }
    catch (error) {
        // Only log unexpected errors (file system errors, not validation errors)
        log$2('error', '[Resources] Failed to read documentation:', error);
        throw new Error(`Failed to read documentation: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Wraps already-resolved key strings. A getter throws a clear error if its key wasn't supplied —
 * e.g. a write key deliberately withheld when building a provider for a read-only call — rather
 * than returning `undefined` and letting a missing credential fail confusingly further down.
 */
class StaticApiKeyProvider {
    keys;
    constructor(keys) {
        this.keys = keys;
    }
    getReadKey() {
        return this.require('readKey', 'read');
    }
    getWriteKey() {
        return this.require('writeKey', 'write');
    }
    getRunKey() {
        return this.require('runKey', 'run');
    }
    require(field, label) {
        const key = this.keys[field];
        if (key === undefined)
            throw new Error(`No ${label} API key is available for this call.`);
        return key;
    }
}

const defaultLoadEnvDeps = {
    existsSync: fs__namespace.existsSync,
    configDotenv: dotenv__namespace.config,
};
function loadEnvFromCwd(startDir = process.cwd(), deps = defaultLoadEnvDeps) {
    let dir = startDir;
    while (true) {
        const envPath = path__namespace.join(dir, '.env');
        if (deps.existsSync(envPath)) {
            const preset = new Set(Object.keys(process.env));
            const result = deps.configDotenv({ path: envPath });
            const parsed = result?.parsed ?? {};
            const applied = Object.keys(parsed).filter(name => !preset.has(name));
            return { path: envPath, applied, parsed };
        }
        const parent = path__namespace.dirname(dir);
        if (parent === dir)
            return undefined;
        dir = parent;
    }
}

const RETRYABLE_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'EAGAIN']);
const RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 20;
/**
 * A synchronous blocking sleep (`Atomics.wait` against a throwaway shared buffer) — matches
 * the rest of this codebase's synchronous fs style (`fs.readFileSync`/`writeFileSync`
 * throughout `commands.ts`), rather than forcing every phase-tracker call to be async merely
 * to await a short backoff delay.
 */
function busyWaitSleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
const defaultPhaseTrackerDeps = {
    readFile: p => (fs__namespace.existsSync(p) ? fs__namespace.readFileSync(p, 'utf8') : null),
    writeFile: (p, contents) => fs__namespace.writeFileSync(p, contents),
    appendFile: (p, contents) => fs__namespace.appendFileSync(p, contents),
    deleteFile: p => fs__namespace.rmSync(p, { force: true }),
    mkdir: dir => fs__namespace.mkdirSync(dir, { recursive: true }),
    sleep: busyWaitSleep,
    stateDir: path__namespace.join(os__namespace.tmpdir(), 'eyes-resolve'),
};
/**
 * Retries `fn` on a transient file-lock error (a momentarily-locked file must never crash a
 * workflow call — see `lib.md`), with a short exponential backoff between attempts. Any other
 * error (including a non-`Error` throw with no `.code`) propagates immediately, unretried.
 */
function withRetry(fn, deps) {
    for (let attempt = 0;; attempt++) {
        try {
            return fn();
        }
        catch (error) {
            const code = error?.code;
            if (attempt >= RETRY_ATTEMPTS - 1 || !code || !RETRYABLE_CODES.has(code))
                throw error;
            deps.sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        }
    }
}
function hashId(id) {
    return crypto__namespace.createHash('sha256').update(id).digest('hex');
}
// path.posix.join/dirname (not path.join/dirname) so the result is deterministic across
// platforms — Node's fs APIs accept forward slashes on Windows too (same convention as
// `api/fs-cache.ts`'s `cacheFilePath`).
function recordPath(deps, kind, id) {
    return path__namespace.posix.join(deps.stateDir, kind, `${hashId(id)}.json`);
}
function readJson(deps, filePath) {
    const contents = withRetry(() => deps.readFile(filePath), deps);
    return contents === null ? undefined : JSON.parse(contents);
}
function writeJson(deps, filePath, value) {
    withRetry(() => deps.mkdir(path__namespace.posix.dirname(filePath)), deps);
    withRetry(() => deps.writeFile(filePath, JSON.stringify(value)), deps);
}
/** The recorded completion for `id`, or `undefined` if `<level>_end` was never (successfully) called for it. */
function getCompletion(id, deps = defaultPhaseTrackerDeps) {
    return readJson(deps, recordPath(deps, 'completions', id));
}
function isCompleted(id, deps = defaultPhaseTrackerDeps) {
    return getCompletion(id, deps) !== undefined;
}
/**
 * Persists `payload` as `id`'s completion, stamped with the current time — overwriting
 * whatever was recorded for `id` before, so revising a summary (or refreshing a stale
 * completion) is just calling this again.
 */
function recordCompletion(id, payload, deps = defaultPhaseTrackerDeps) {
    const completion = { payload, completedAt: new Date().toISOString() };
    writeJson(deps, recordPath(deps, 'completions', id), completion);
    return completion;
}
/** `parentId`'s full accumulated child-findings record, read as-is with no live-data filtering. `{}` if no child has ever reported into it. */
function getChildFindings(parentId, deps = defaultPhaseTrackerDeps) {
    return readJson(deps, recordPath(deps, 'child-findings', parentId)) ?? {};
}
/**
 * Writes (or overwrites) `childId`'s entry in `parentId`'s accumulated findings record,
 * creating that record the first time any child reports into it. Called once a child's own
 * `_end` succeeds — independent of whether `childId` is still among `parentId`'s currently-live
 * children, so a child that later drops out of the live set never loses its findings.
 */
function appendChildFinding(parentId, childId, payload, deps = defaultPhaseTrackerDeps) {
    const record = getChildFindings(parentId, deps);
    record[childId] = payload;
    writeJson(deps, recordPath(deps, 'child-findings', parentId), record);
}
/** Appends one entry to `scopeId`'s invocation log — called as a side effect of every eyes-inspect data tool. */
function logInvocation(scopeId, toolName, args, deps = defaultPhaseTrackerDeps) {
    const filePath = recordPath(deps, 'invocations', scopeId);
    const log = readJson(deps, filePath) ?? [];
    log.push({ toolName, args, at: new Date().toISOString() });
    writeJson(deps, filePath, log);
}
/** Whether `scopeId`'s invocation log contains a call to `toolName` whose `args` satisfy `matcher` — the per-item invocation-verification check backing `step_end`/`diff_end`'s hard gates. */
function verifyInvocation(scopeId, toolName, matcher, deps = defaultPhaseTrackerDeps) {
    const log = readJson(deps, recordPath(deps, 'invocations', scopeId)) ?? [];
    return log.some(entry => entry.toolName === toolName && matcher(entry.args));
}
/** Persists `mode` as the mode `scopeId` is currently being reviewed in — overwriting whatever was recorded before, so re-entering with the same mode simply re-states it. */
function recordScopeMode(scopeId, mode, deps = defaultPhaseTrackerDeps) {
    writeJson(deps, recordPath(deps, 'modes', scopeId), mode);
}
/** The mode last recorded for `scopeId` via `recordScopeMode`, or `undefined` if never recorded. */
function getScopeMode(scopeId, deps = defaultPhaseTrackerDeps) {
    return readJson(deps, recordPath(deps, 'modes', scopeId));
}
/**
 * Persists `rootScope` as the root of the review that last touched `scopeId`, overwriting any earlier one.
 * A hint for the caller's guidance only: concurrent reviews of one scope overwrite each other.
 */
function recordScopeRoot(scopeId, rootScope, deps = defaultPhaseTrackerDeps) {
    writeJson(deps, recordPath(deps, 'roots', scopeId), rootScope);
}
/** The root last recorded for `scopeId` via `recordScopeRoot`, or `undefined` if never recorded. */
function getScopeRoot(scopeId, deps = defaultPhaseTrackerDeps) {
    return readJson(deps, recordPath(deps, 'roots', scopeId));
}
/** Discards `id`'s completion, as if `recordCompletion` had never been called for it. */
function clearCompletion(id, deps = defaultPhaseTrackerDeps) {
    withRetry(() => deps.deleteFile(recordPath(deps, 'completions', id)), deps);
}
/** Discards `parentId`'s entire accumulated child-findings record — every child's entry, not just one. */
function clearChildFindings(parentId, deps = defaultPhaseTrackerDeps) {
    withRetry(() => deps.deleteFile(recordPath(deps, 'child-findings', parentId)), deps);
}
/** Discards `scopeId`'s recorded mode, as if `recordScopeMode` had never been called for it. */
function clearScopeMode(scopeId, deps = defaultPhaseTrackerDeps) {
    withRetry(() => deps.deleteFile(recordPath(deps, 'modes', scopeId)), deps);
}
/** Discards `scopeId`'s recorded root, as if `recordScopeRoot` had never been called for it. */
function clearScopeRoot(scopeId, deps = defaultPhaseTrackerDeps) {
    withRetry(() => deps.deleteFile(recordPath(deps, 'roots', scopeId)), deps);
}
/** Persists the keys of `scopeId`'s children still unready to be finalized, as of its own latest live check — overwriting whatever was recorded before, so a child that has since become ready (or a newly-discovered unready one) is reflected exactly, never accumulated across checks. */
function recordUnreadyChildren(scopeId, childKeys, deps = defaultPhaseTrackerDeps) {
    writeJson(deps, recordPath(deps, 'unready-children', scopeId), childKeys);
}
/** The child keys `recordUnreadyChildren` last recorded as unready for `scopeId`, or `[]` if never recorded. */
function getUnreadyChildren(scopeId, deps = defaultPhaseTrackerDeps) {
    return readJson(deps, recordPath(deps, 'unready-children', scopeId)) ?? [];
}
/** Discards `scopeId`'s recorded unready-children snapshot, as if `recordUnreadyChildren` had never been called for it. */
function clearUnreadyChildren(scopeId, deps = defaultPhaseTrackerDeps) {
    withRetry(() => deps.deleteFile(recordPath(deps, 'unready-children', scopeId)), deps);
}
/** `scopeId`'s queued child keys — the stable, append-only set of children discovered live so far, investigated from regardless of what a later live fetch would show. `[]` if none have ever been queued. */
function getQueuedChildKeys(scopeId, deps = defaultPhaseTrackerDeps) {
    return readJson(deps, recordPath(deps, 'children', scopeId)) ?? [];
}
/**
 * Appends any of `liveKeys` not already queued, preserving the existing queue's order with
 * newcomers appended in their given order — never removes a key, so a child that later drops out
 * of a live fetch (resolved via propagation, or otherwise) stays queued and gets visited. Returns
 * the full merged queue; writes only when something actually changed.
 */
function queueChildKeys(scopeId, liveKeys, deps = defaultPhaseTrackerDeps) {
    const existing = getQueuedChildKeys(scopeId, deps);
    const existingSet = new Set(existing);
    const fresh = liveKeys.filter(k => !existingSet.has(k));
    if (fresh.length === 0)
        return existing;
    const merged = [...existing, ...fresh];
    writeJson(deps, recordPath(deps, 'children', scopeId), merged);
    return merged;
}
/** Discards `scopeId`'s entire queued-children record, as if nothing had ever been queued for it. */
function clearQueuedChildKeys(scopeId, deps = defaultPhaseTrackerDeps) {
    withRetry(() => deps.deleteFile(recordPath(deps, 'children', scopeId)), deps);
}
/**
 * Persists `payload` as everything `scopeId`'s own live fetch most recently discovered — e.g. a
 * batch's full session list, expensive to fetch and shared by everything nested under it —
 * overwriting whatever was recorded before, so a caller that decides to refresh simply calls this
 * again. Unlike `queueChildKeys`/`getQueuedChildKeys` (a stable, append-only set of keys a caller
 * has committed to investigating), this is the raw discovery result itself — including entries
 * (e.g. still-`Running` sessions) that may not be ready to investigate at all — so a lower-level
 * scope nested underneath `scopeId` can re-derive its own children from it without repeating the
 * fetch.
 */
function recordDiscoveredChildren(scopeId, payload, deps = defaultPhaseTrackerDeps) {
    writeJson(deps, recordPath(deps, 'discovered-children', scopeId), payload);
}
/** What `recordDiscoveredChildren` last recorded for `scopeId`, or `undefined` if never recorded. */
function getDiscoveredChildren(scopeId, deps = defaultPhaseTrackerDeps) {
    return readJson(deps, recordPath(deps, 'discovered-children', scopeId));
}
/** Discards `scopeId`'s recorded discovery, as if `recordDiscoveredChildren` had never been called for it. */
function clearDiscoveredChildren(scopeId, deps = defaultPhaseTrackerDeps) {
    withRetry(() => deps.deleteFile(recordPath(deps, 'discovered-children', scopeId)), deps);
}
function debugLogDir(deps) {
    return path__namespace.posix.join(deps.stateDir, 'debug');
}
/**
 * The exact filesystem path `log` appends `scopeId`'s entries to — a caller (or a human trying to
 * find the right file by hand) never has to reimplement this module's own hashing scheme just to
 * locate it.
 */
function getLogFilePath(scopeId, deps = defaultPhaseTrackerDeps) {
    return path__namespace.posix.join(debugLogDir(deps), `${hashId(scopeId)}.log`);
}
/**
 * A generic call-trace log: any caller can record one labeled entry, with no fixed vocabulary for
 * what a call even is — `label` is whatever convention the caller adopts (today, resolution.ts
 * labels each entry with the traced function's own name; a wholly different caller could start
 * labeling its own entries tomorrow with no change here). Appends to `scopeId`'s own log file,
 * partitioned by hashed id the same way every other record in this module is — `scopeId` is just
 * as opaque to this module as everywhere else it appears, so it's entirely the caller's own choice
 * whether to pass the same id (e.g. an investigation's root) on every call, consolidating every
 * entry raised anywhere within it into one file, or a more granular one per call, splitting the
 * trace up instead. `label` is the only other required field; `input`/`output`/`error`/`message`
 * are all optional and independent — a call-and-response entry sets `input`/`output`, a failed one
 * sets `error` (instead of stuffing it into `output`), and anything that isn't a call at all (a
 * one-off event, a snapshot) just sets `message` to whatever shape fits. Every entry lands as one
 * line (a JSON-encoded `DebugLogEntry`) in a single NDJSON file at `getLogFilePath(scopeId, deps)`.
 * There is no reader function: this is meant to be opened directly (as a file on disk, or via
 * `deps.readFile` in a test) rather than queried back through this module.
 *
 * Safe under concurrent callers by construction, not by locking: this never reads the file before
 * appending (so there's no read-modify-write window for two callers to race), and each entry is
 * written as a single `appendFile` call — opening for append and writing is one atomic
 * seek-to-end-and-write at the OS level, so concurrent appends interleave whole lines and never
 * corrupt or split one another's. The only remaining failure mode is a transient lock on the file
 * itself (e.g. a concurrent antivirus scan) — `mkdir`/`appendFile` are wrapped in the same
 * lock-retry backoff (`withRetry`) as every other record this module writes, so a caller never
 * has to poll for the file to become available itself; a momentarily-busy append just retries.
 */
function log$1(scopeId, label, fields = {}, deps = defaultPhaseTrackerDeps) {
    const entry = { at: new Date().toISOString(), label, ...fields };
    withRetry(() => deps.mkdir(debugLogDir(deps)), deps);
    withRetry(() => deps.appendFile(getLogFilePath(scopeId, deps), `${JSON.stringify(entry)}\n`), deps);
}

function parseRect(s) {
    const parts = s.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
        throw new Error(`Invalid rect format: "${s}". Expected "left,top,width,height"`);
    }
    return { left: parts[0], top: parts[1], width: parts[2], height: parts[3] };
}
/** Inverse of `parseRect` — formats a rect back into `"left,top,width,height"`. */
function formatRect(rect) {
    return `${rect.left},${rect.top},${rect.width},${rect.height}`;
}
/**
 * Returns true if outer completely contains inner (all edges of inner are within outer).
 * Equal rectangles are considered to contain each other.
 */
function rectContains(outer, inner) {
    return (outer.left <= inner.left &&
        outer.top <= inner.top &&
        outer.left + outer.width >= inner.left + inner.width &&
        outer.top + outer.height >= inner.top + inner.height);
}
function rectsIntersect(a, b) {
    return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}
function intersectionArea(a, b) {
    const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
    const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
}
function boundingRect(a, b) {
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.left + a.width, b.left + b.width);
    const bottom = Math.max(a.top + a.height, b.top + b.height);
    return { left, top, width: right - left, height: bottom - top };
}
/** A region under this covers a diff artefact, not content, and as a search source it matches almost everywhere. */
const MIN_REGION_AREA_PX = 16;
function isTooSmallRegion(rect) {
    return rect.width * rect.height < MIN_REGION_AREA_PX;
}
function sameRect(a, b) {
    return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}
/** Intersection area as a fraction of the smaller rect's area — IoU would punish a thin rect for a few px of drift. */
function overlapCoverage(a, b) {
    const smaller = Math.min(a.width * a.height, b.width * b.height);
    // A rect with no area covers nothing, and would divide by zero.
    if (smaller === 0)
        return 0;
    return intersectionArea(a, b) / smaller;
}
/** Below this, two rects merely graze each other at the edges and are treated as unrelated. */
const SIGNIFICANT_OVERLAP_MIN_FRACTION = 0.1;
/** Below this on either axis the two rects are different shapes, however much they overlap. */
const SIMILAR_SIZE_MIN_RATIO = 0.85;
const SIMILAR_COVERAGE_MIN_FRACTION = 0.7;
function isSignificantOverlap(a, b) {
    return rectsIntersect(a, b) && overlapCoverage(a, b) > SIGNIFICANT_OVERLAP_MIN_FRACTION;
}
/**
 * Similar size on both axes and mostly overlapping: one rect is the other after a drift of a few px.
 * A rect that moved a whole row away shares no area with where it was, so it is not nearly the same.
 */
function isNearlySameRect(a, b) {
    if (!isSignificantOverlap(a, b))
        return false;
    const ratio = (x, y) => Math.min(x, y) / Math.max(x, y);
    const sizeRatio = Math.min(ratio(a.width, b.width), ratio(a.height, b.height));
    return sizeRatio >= SIMILAR_SIZE_MIN_RATIO && overlapCoverage(a, b) >= SIMILAR_COVERAGE_MIN_FRACTION;
}

/** Shapes a raw batch entity's fields (see `BatchInfo` — fetched via `api`'s `fetchBatchInfo`) into `BatchStats`. */
function toBatchStats(raw) {
    return {
        total: (raw.completedCount ?? 0) + (raw.runningCount ?? 0) + (raw.abortedCount ?? 0),
        unresolved: raw.unresolvedCount ?? 0,
        passed: raw.passedCount ?? 0,
        failed: raw.failedCount ?? 0,
        aborted: raw.abortedCount ?? 0,
        unsaved: raw.changedCount ?? 0,
        totalSteps: raw.stepsCount ?? 0,
        unresolvedSteps: raw.unresolvedStepsCount ?? 0,
        unsavedSteps: raw.changedStepsCount ?? 0,
        missingSteps: raw.missingStepsCount ?? 0,
        newSteps: raw.newStepsCount ?? 0,
    };
}
/**
 * Computes the same `BatchStats` shape as `toBatchStats`, but by counting over a set of
 * already-`simplifySession`-shaped sessions (`sessions/session`) instead of reading the
 * (eventually consistent) batch aggregate — so it's always current, at the cost of only
 * reflecting whatever subset of sessions `sessions` contains (the whole batch, or an
 * already-filtered slice of it).
 *
 * Takes `SimplifiedSession[]`, not raw sessions, for two reasons: it reuses whatever
 * `simplifySession` call the caller already made (e.g. to also build a session listing)
 * instead of re-simplifying every session a second time just for this; and it counts a
 * step's `resolution`/`isUnsaved` exactly as `simplifySession` derived them, with no second,
 * possibly-diverging notion of what "resolved" means computed from the raw
 * `appOutputResolution` fields directly. Every entry in `sessions` must have been simplified
 * with `steps` included (the default) — one shaped with `{ includeSteps: false }` (`steps:
 * null`) would silently contribute 0 to every step-level count.
 */
function computeBatchStats(sessions) {
    const stats = {
        total: sessions.length,
        unresolved: 0,
        passed: 0,
        failed: 0,
        aborted: 0,
        unsaved: 0,
        totalSteps: 0,
        unresolvedSteps: 0,
        unsavedSteps: 0,
        missingSteps: 0,
        newSteps: 0,
    };
    for (const session of sessions) {
        const status = (session.status ?? '').toLowerCase();
        if (status === 'unresolved')
            stats.unresolved++;
        else if (status === 'passed')
            stats.passed++;
        else if (status === 'failed')
            stats.failed++;
        if (session.isAborted)
            stats.aborted++;
        if (session.isUnsaved)
            stats.unsaved++;
        for (const step of session.steps ?? []) {
            stats.totalSteps++;
            if (!step.isMatching && step.resolution === 'none')
                stats.unresolvedSteps++;
            if (step.isUnsaved)
                stats.unsavedSteps++;
            if (step.checkpoint.id === null)
                stats.missingSteps++;
            if (step.baseline.id === null)
                stats.newSteps++;
        }
    }
    return stats;
}
// ---------------------------------------------------------------------------
// Session-level filtering
// ---------------------------------------------------------------------------
const BATCH_FILTERS = ['unresolved', 'unsaved', 'mismatching'];
/**
 * Narrows `sessions` to those matching `filter` — every session, unfiltered, when `filter` is
 * omitted. `"mismatching"` keeps only sessions with at least one step that's `isMatching: false`,
 * missing a checkpoint (`checkpoint.id === null` — the test stopped capturing this checkpoint),
 * or new (`baseline.id === null` — the test started capturing a checkpoint with no prior baseline
 * to compare against) — a missing/new step still needs a decision even though its own
 * `isMatching` isn't a reliable signal either way, so it counts regardless of what `isMatching`
 * reads. Also regardless of a step's own `resolution`: `isMatching` is fixed at comparison time
 * and never changes afterward, including once a step is accepted/rejected and saved to the
 * baseline, so it stays a reliable "did this ever differ" signal rather than one a decision
 * clears. Requires `sessions` to have been simplified with `steps` included (the default); one
 * shaped with `{ includeSteps: false }` never matches (`steps` is `null`).
 */
function filterSessions(sessions, filter) {
    if (!filter)
        return sessions;
    if (filter === 'unresolved')
        return sessions.filter(s => s.status.toLowerCase() === 'unresolved');
    if (filter === 'unsaved')
        return sessions.filter(s => s.isUnsaved);
    return sessions.filter(s => (s.steps ?? []).some(step => !step.isMatching || step.checkpoint.id === null || step.baseline.id === null));
}

/**
 * Returns coarse page areas containing diffs. Each rect is expanded to at least
 * `hPad`×`vPad` (centered) before checking for overlap; overlapping inflated rects
 * are merged into the bounding rect of their originals (not the inflated ones).
 */
function diffAreas(rects, hPad = 50, vPad = 25) {
    let result = rects.map(r => ({ ...r, diffCount: 1 }));
    let merged = true;
    while (merged) {
        merged = false;
        const inflated = result.map((r) => {
            const w = Math.max(r.width, hPad);
            const h = Math.max(r.height, vPad);
            return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
        });
        outer: for (let i = 0; i < result.length; i++) {
            for (let j = i + 1; j < result.length; j++) {
                if (rectsIntersect(inflated[i], inflated[j])) {
                    const mergedRect = {
                        ...boundingRect(result[i], result[j]),
                        diffCount: result[i].diffCount + result[j].diffCount,
                    };
                    result = [...result.slice(0, i), ...result.slice(i + 1, j), ...result.slice(j + 1), mergedRect];
                    merged = true;
                    break outer;
                }
            }
        }
    }
    return result;
}
const COL_WIDTH = 200; // target column width; numCols = round(boundsWidth / COL_WIDTH)
const ROW_HEIGHT = 700; // target row height;  numRows = round(boundsHeight / ROW_HEIGHT)
const DENSE_COVERAGE = 0.3; // min ratio of diff pixel coverage to cell area to mark a cell dense
const MAX_MERGE_GAP_ROWS = 1;
const MAX_MERGE_GAP_COLS = 1;
function cellKey(row, col) {
    return `${row},${col}`;
}
function parseKey(key) {
    const [row, col] = key.split(',').map(Number);
    return [row, col];
}
function condenseDiffAreasDetailed(areas, threshold = 20) {
    if (areas.length <= threshold)
        return { containers: [], individuals: areas };
    // Compute bounding rect of all diff areas and derive a uniform grid.
    // numCols/numRows are chosen so each cell is as close to COL_WIDTH × ROW_HEIGHT as possible;
    // edge cells are never narrow/short because the grid divides the bounds evenly.
    const boundsLeft = Math.min(...areas.map(a => a.left));
    const boundsTop = Math.min(...areas.map(a => a.top));
    const boundsRight = Math.max(...areas.map(a => a.left + a.width));
    const boundsBottom = Math.max(...areas.map(a => a.top + a.height));
    const boundsWidth = boundsRight - boundsLeft;
    const boundsHeight = boundsBottom - boundsTop;
    const numCols = Math.max(1, Math.round(boundsWidth / COL_WIDTH));
    const numRows = Math.max(1, Math.round(boundsHeight / ROW_HEIGHT));
    const colW = Math.max(1, boundsWidth / numCols);
    const rowH = Math.max(1, boundsHeight / numRows);
    const cellArea = colW * rowH;
    // Assign each area to every cell it overlaps; accumulate intersection pixel area per cell
    const cellCoverage = new Map();
    for (const a of areas) {
        const colMin = Math.max(0, Math.floor((a.left - boundsLeft) / colW));
        const colMax = Math.min(numCols - 1, Math.ceil((a.left + a.width - boundsLeft) / colW) - 1);
        const rowMin = Math.max(0, Math.floor((a.top - boundsTop) / rowH));
        const rowMax = Math.min(numRows - 1, Math.ceil((a.top + a.height - boundsTop) / rowH) - 1);
        for (let row = rowMin; row <= rowMax; row++) {
            for (let col = colMin; col <= colMax; col++) {
                const cellLeft = boundsLeft + col * colW;
                const cellTop = boundsTop + row * rowH;
                const iW = Math.min(a.left + a.width, cellLeft + colW) - Math.max(a.left, cellLeft);
                const iH = Math.min(a.top + a.height, cellTop + rowH) - Math.max(a.top, cellTop);
                const iArea = Math.max(0, iW) * Math.max(0, iH);
                if (iArea > 0) {
                    const key = cellKey(row, col);
                    cellCoverage.set(key, (cellCoverage.get(key) ?? 0) + iArea);
                }
            }
        }
    }
    // Mark cells whose coverage ratio meets the density threshold
    const denseCells = new Set();
    for (const [key, coverage] of cellCoverage) {
        if (coverage / cellArea >= DENSE_COVERAGE)
            denseCells.add(key);
    }
    // 4-connected flood-fill over dense cells into components
    const visited = new Set();
    const components = [];
    for (const startKey of denseCells) {
        if (visited.has(startKey))
            continue;
        const component = new Set();
        const queue = [startKey];
        while (queue.length > 0) {
            const key = queue.pop();
            if (visited.has(key))
                continue;
            visited.add(key);
            component.add(key);
            const [row, col] = parseKey(key);
            for (const [dr, dc] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const neighborKey = cellKey(row + dr, col + dc);
                if (denseCells.has(neighborKey) && !visited.has(neighborKey)) {
                    queue.push(neighborKey);
                }
            }
        }
        components.push(component);
    }
    // For each component, claim every area that overlaps any cell in the component
    const claimed = new Set();
    const containers = [];
    for (const component of components) {
        const collectedIndices = [];
        for (let i = 0; i < areas.length; i++) {
            const a = areas[i];
            const colMin = Math.max(0, Math.floor((a.left - boundsLeft) / colW));
            const colMax = Math.min(numCols - 1, Math.ceil((a.left + a.width - boundsLeft) / colW) - 1);
            const rowMin = Math.max(0, Math.floor((a.top - boundsTop) / rowH));
            const rowMax = Math.min(numRows - 1, Math.ceil((a.top + a.height - boundsTop) / rowH) - 1);
            let found = false;
            outer: for (let row = rowMin; row <= rowMax; row++) {
                for (let col = colMin; col <= colMax; col++) {
                    if (component.has(cellKey(row, col))) {
                        found = true;
                        break outer;
                    }
                }
            }
            if (found)
                collectedIndices.push(i);
        }
        if (collectedIndices.length === 0)
            continue;
        for (const idx of collectedIndices)
            claimed.add(idx);
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        let totalDiffCount = 0;
        for (const idx of collectedIndices) {
            const a = areas[idx];
            left = Math.min(left, a.left);
            top = Math.min(top, a.top);
            right = Math.max(right, a.left + a.width);
            bottom = Math.max(bottom, a.top + a.height);
            totalDiffCount += a.diffCount;
        }
        containers.push({ left, top, width: right - left, height: bottom - top, diffCount: totalDiffCount });
    }
    // Merge containers that are gap-adjacent (≤ 1 cell in either axis) or where one contains the other
    let anyMerge = true;
    while (anyMerge) {
        anyMerge = false;
        outer: for (let i = 0; i < containers.length; i++) {
            for (let j = i + 1; j < containers.length; j++) {
                const a = containers[i];
                const b = containers[j];
                const hGap = Math.max(0, Math.max(a.left, b.left) - Math.min(a.left + a.width, b.left + b.width));
                const vGap = Math.max(0, Math.max(a.top, b.top) - Math.min(a.top + a.height, b.top + b.height));
                const contained = rectContains(a, b) || rectContains(b, a);
                if (!contained && (hGap > MAX_MERGE_GAP_COLS * colW || vGap > MAX_MERGE_GAP_ROWS * rowH))
                    continue;
                const left = Math.min(a.left, b.left);
                const top = Math.min(a.top, b.top);
                const right = Math.max(a.left + a.width, b.left + b.width);
                const bottom = Math.max(a.top + a.height, b.top + b.height);
                containers.splice(j, 1);
                containers.splice(i, 1);
                containers.push({ left, top, width: right - left, height: bottom - top, diffCount: a.diffCount + b.diffCount });
                anyMerge = true;
                break outer;
            }
        }
    }
    // Absorb any unclaimed area whose rect falls completely within a container
    for (let i = 0; i < areas.length; i++) {
        if (claimed.has(i))
            continue;
        for (const container of containers) {
            if (rectContains(container, areas[i])) {
                container.diffCount += areas[i].diffCount;
                claimed.add(i);
                break;
            }
        }
    }
    return { containers, individuals: areas.filter((_, i) => !claimed.has(i)) };
}

/**
 * Extracts the bounding rect from an Applitools DOM snapshot node.
 * Returns null if the node has no rect or its values are not numbers.
 */
function nodeRect(node) {
    const r = node?.rect;
    if (!r)
        return null;
    const { left, top, width, height } = r;
    if (typeof left !== 'number' || typeof top !== 'number' || typeof width !== 'number' || typeof height !== 'number')
        return null;
    return { left, top, width, height };
}
/**
 * How many times larger than the tightest container an ancestor's area may be
 * before it is reduced to a summary node (tagName + attributes only).
 * Ancestors within this factor are kept in full because they are likely part of
 * the direct component structure immediately surrounding the diff.
 */
const ANCESTOR_SIMILARITY_FACTOR = 5;
/**
 * Internal recursive implementation. Returns the pruned node alongside the pixel area
 * of the tightest container found in the subtree, so ancestors can decide whether they
 * are "similar in size" and should be kept in full, or are distant and should be summarised.
 */
function getDomAreaInternal(node, area) {
    if (!node)
        return { nodes: [], tightestContainerArea: 0 };
    // Non-element nodes (text "#text", comment "#comment", etc.) have no rect.
    // Pass them through — they survive only if their parent element is retained.
    if (!node.tagName || node.tagName.startsWith('#'))
        return { nodes: [node], tightestContainerArea: 0 };
    // Process children. Only retained element children vote on retention; text nodes
    // ride along. Track the largest tightestContainerArea reported by any child.
    let retainedElementCount = 0;
    const prunedChildren = [];
    let childTightestArea = 0;
    for (const child of node.childNodes ?? []) {
        if (child?.tagName && !child.tagName.startsWith('#')) {
            const result = getDomAreaInternal(child, area);
            if (result.nodes.length > 0) {
                prunedChildren.push(...result.nodes);
                retainedElementCount++;
                if (result.tightestContainerArea > childTightestArea) {
                    childTightestArea = result.tightestContainerArea;
                }
            }
        }
        else {
            if (child != null)
                prunedChildren.push(child);
        }
    }
    const r = nodeRect(node);
    const selfIntersects = r !== null && rectsIntersect(r, area);
    if (!selfIntersects && retainedElementCount === 0)
        return { nodes: [], tightestContainerArea: 0 };
    const nodeArea = r !== null ? r.width * r.height : 0;
    const diffArea = area.width * area.height;
    // A "container" strictly contains the area and is larger (equal-size nodes are
    // treated as directly intersecting via selfIntersects above).
    const isContainer = r !== null && rectContains(r, area) && nodeArea > diffArea;
    // The "tightest container" is the innermost one: it contains the area but no
    // retained child does. This is the most useful ancestor for source code correlation.
    const isTightestContainer = isContainer && childTightestArea === 0;
    const tightestContainerArea = isTightestContainer ? nodeArea : childTightestArea;
    // Nodes that overlap the diff area without fully containing it are treated as direct
    // neighbours of the change and always kept in full (rule 1).
    // Nodes that contain the diff area may still be summarised if they are large enough.
    const overlapsWithoutContaining = selfIntersects && !isContainer;
    // A node is a distant ancestor when:
    //   - not a direct neighbour (overlaps without containing)
    //   - not the tightest container
    //   - either has no meaningful pixel area, or is much larger than the tightest container
    // Distant ancestors are skipped entirely; their retained children are promoted up.
    const isDistantAncestor = !overlapsWithoutContaining &&
        !isTightestContainer &&
        (nodeArea === 0 || (tightestContainerArea > 0 && nodeArea > ANCESTOR_SIMILARITY_FACTOR * tightestContainerArea));
    if (isDistantAncestor) {
        return { nodes: prunedChildren, tightestContainerArea };
    }
    return { nodes: [{ ...node, childNodes: prunedChildren }], tightestContainerArea };
}
/**
 * Recursively crops a PrunedDom tree to only the branches relevant to the given area.
 *
 * Retention rules:
 *   1. Nodes that overlap the area without fully containing it get full detail — they are
 *      direct neighbours of the change.
 *   2. The tightest container (innermost ancestor whose rect strictly contains the area,
 *      with no retained child also containing it) gets full detail.
 *   3. Ancestors within ANCESTOR_SIMILARITY_FACTOR× the tightest container's pixel area
 *      get full detail — they are likely part of the immediate component structure.
 *   4. All other (distant) ancestors are skipped entirely; their retained children are
 *      promoted up, so the output starts at the innermost relevant node.
 *   - Text/comment nodes ("#text", "#comment") are passed through with their parent.
 *   - Returns null if no node in the tree intersects the area.
 */
function getDomArea(node, area) {
    const { nodes } = getDomAreaInternal(node, area);
    if (nodes.length === 0)
        return null;
    if (nodes.length === 1)
        return nodes[0];
    return nodes;
}
/**
 * Validates that a domId is usable. Returns an error string if not, null if valid.
 * Guards against passing the literal string "null" copied from `info` JSON output.
 */
function validateDomId(domId) {
    if (!domId || domId === 'null') {
        return 'This step has no DOM capture (domId is null). DOM snapshots are only available for steps captured with the Applitools SDK DOM capture feature enabled.';
    }
    return null;
}
// The DOM API uppercases `tagName` for HTML-namespace elements regardless of source
// casing, but preserves the as-authored case for everything else (SVG, MathML, custom
// elements) — so an all-uppercase `tagName` is always an HTML-namespace normalization,
// never a real name, and should be lowercased back to what's actually in the markup.
// Live-verified: a `domSelector` built with the raw (uppercased) HTML tag name produced a
// region that was visually positioned correctly (rect-only match) but showed as "unlinked"
// to any DOM node until manually relinked, at which point the server rewrote it to
// lowercase — confirming the server's own matching is case-sensitive against source case.
const ALL_UPPERCASE_TAGNAME = /^[A-Z][A-Z0-9]*$/;
function toDomSelectorTagName(tagName) {
    return ALL_UPPERCASE_TAGNAME.test(tagName) ? tagName.toLowerCase() : tagName;
}
/**
 * The shared id-range-skipping walk behind both `findNodeById` and `findNodeObjectById`:
 * resolves a single node id against the full, unpruned, already-id-assigned tree, returning
 * both the node itself and its `domSelector` (a `/tagName[i]` path from the root, `i` being
 * the 0-based index among siblings sharing that tag name). Returns `null` if the id isn't
 * present in the tree.
 *
 * Because `assignNodeIds` numbers nodes in pre-order with a single counter, every node's
 * subtree occupies a contiguous, gapless id range starting at its own id, and sibling
 * subtrees' ranges are strictly ordered left-to-right with no overlap — a sibling's own
 * id is exactly the exclusive upper bound of the *previous* sibling's subtree range. This
 * lets the search skip an entire sibling subtree without visiting a single node in it,
 * whenever the target id clearly falls outside that subtree's range, rather than only
 * stopping once it happens to reach the target by a plain linear walk.
 */
function searchNodeById(root, domId) {
    const target = Number(domId);
    function search(node, path, upperBoundExclusive) {
        if (!node || !node.tagName || node.tagName.startsWith('#'))
            return null;
        const nodeId = Number(node.id);
        if (!Number.isFinite(nodeId) || target < nodeId || target >= upperBoundExclusive)
            return null;
        if (target === nodeId)
            return { node, path };
        const elementChildren = (node.childNodes ?? []).filter((c) => c?.tagName && !c.tagName.startsWith('#'));
        const tagCounts = new Map();
        for (let i = 0; i < elementChildren.length; i++) {
            const child = elementChildren[i];
            // Siblings' id ranges are contiguous and strictly ascending (see the class doc above), so
            // once target is smaller than this child's own id, it can't be in this or any later
            // sibling either — nothing left to find. Safe to stop here without finishing tagCounts:
            // nothing downstream will read it once we're about to return null from this node.
            if (target < Number(child.id))
                break;
            // tagCounts must be updated for every sibling in order, even ones we skip below without
            // recursing into — it's this child's index among same-tag siblings, needed to number any
            // later sibling sharing its tag correctly, independent of whether target turns out to be
            // in this particular child's subtree.
            const index = tagCounts.get(child.tagName) ?? 0;
            tagCounts.set(child.tagName, index + 1);
            // This child's subtree ends where the next sibling's own id begins; the last
            // child inherits the bound passed down from this node's own caller.
            const next = elementChildren[i + 1];
            const childUpperBound = next ? Number(next.id) : upperBoundExclusive;
            // target lies past this child's entire subtree — skip recursing into it, but its
            // tagCounts increment above must still happen (see comment there).
            if (target >= childUpperBound)
                continue;
            const found = search(child, `${path}/${toDomSelectorTagName(child.tagName)}[${index}]`, childUpperBound);
            if (found)
                return found;
        }
        return null;
    }
    return search(root, `/${toDomSelectorTagName(root?.tagName ?? '')}`, Infinity);
}
/**
 * Resolves a single node id to its `domSelector` and `rect`. Returns `null` if the id isn't
 * present in the tree, or if the node found has no usable rect.
 */
function findNodeById(root, domId) {
    const found = searchNodeById(root, domId);
    if (!found)
        return null;
    const rect = nodeRect(found.node);
    return rect ? { domSelector: found.path, rect: roundRect(rect) } : null;
}
const DOM_SELECTOR_SEGMENT_RE = /^([^[]+)\[(\d+)]$/;
/**
 * The inverse of `findNodeById`: walks `root` following a `domSelector` path (e.g.
 * `/html/body[0]/div[2]`, as produced by `findNodeById`/`findNodeByRect`) and returns the
 * rect of whatever element it still resolves to — or `null` if it doesn't (the element that
 * path was built against has been removed, or a sibling's tag/order changed enough to shift
 * indices). Returns the same `{domSelector, rect}` shape as `findNodeById`/`findNodeByRect`,
 * so callers can use whichever of the three applies interchangeably.
 *
 * The first path segment is the root's own bare tag name with no `[index]` (see
 * `findNodeById`) — there's only one root, so it's skipped rather than checked. Every
 * segment after that must match `tagName[index]`, `index` being 0-based among `node`'s
 * children sharing that tag.
 */
function findNodeBySelector(root, path) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0)
        return null;
    let node = root;
    for (let i = 1; i < segments.length; i++) {
        const match = DOM_SELECTOR_SEGMENT_RE.exec(segments[i]);
        if (!match)
            return null;
        const [, tagName, indexStr] = match;
        const children = (node?.childNodes ?? []).filter((c) => c?.tagName && !c.tagName.startsWith('#') && toDomSelectorTagName(c.tagName) === tagName);
        node = children[Number(indexStr)];
        if (!node)
            return null;
    }
    const rect = nodeRect(node);
    return rect ? { domSelector: path, rect: roundRect(rect) } : null;
}
/**
 * Resolves a batch of node ids against the same already-fetched, already-id-assigned
 * tree, one `findNodeById` walk per id. Pure — takes the tree as-is, does no fetching of
 * its own (callers fetch the DOM snapshot once and reuse it here).
 *
 * Throws if any id can't be resolved, naming all of them, rather than silently omitting
 * an entry from the returned map — a caller indexing the result by id (e.g.
 * `result.get(id)!`) would otherwise get `undefined` for a bad id with no signal why.
 */
function resolveNodeIdsToNodes(root, nodeIds) {
    const result = new Map();
    const missing = [];
    for (const id of nodeIds) {
        const resolved = findNodeById(root, id);
        if (resolved)
            result.set(id, resolved);
        else
            missing.push(id);
    }
    if (missing.length > 0) {
        throw new Error(`Node id(s) not found in DOM snapshot: ${missing.join(', ')}`);
    }
    return result;
}
/**
 * The element `targetRect` denotes: a match within `tolerancePx` on every edge, else the element
 * whose box is nearly the same rect — a changed-area rect bounds the differing pixels, which rarely
 * lands within a few px of the element's own box. Within a tier the smallest total deviation wins.
 */
function findNodeByRect(root, targetRect, tolerancePx = 5) {
    let exact = null;
    let exactDelta = Infinity;
    let shifted = null;
    let shiftedDelta = Infinity;
    for (const { node } of flattenTree(root)) {
        const r = nodeRect(node);
        if (!r)
            continue;
        const dLeft = Math.abs(r.left - targetRect.left);
        const dTop = Math.abs(r.top - targetRect.top);
        const dWidth = Math.abs(r.width - targetRect.width);
        const dHeight = Math.abs(r.height - targetRect.height);
        const delta = dLeft + dTop + dWidth + dHeight;
        if (dLeft <= tolerancePx && dTop <= tolerancePx && dWidth <= tolerancePx && dHeight <= tolerancePx) {
            if (delta < exactDelta) {
                exactDelta = delta;
                exact = node;
            }
        }
        else if (isNearlySameRect(r, targetRect) && delta < shiftedDelta) {
            shiftedDelta = delta;
            shifted = node;
        }
    }
    const found = exact ?? shifted;
    return found ? findNodeById(root, found.id) : null;
}
// ---------------------------------------------------------------------------
// Reading-order sort
// ---------------------------------------------------------------------------
function readingOrderCompare(a, b) {
    const aR = a.rect, bR = b.rect;
    if (!aR && !bR)
        return 0;
    if (!aR)
        return 1;
    if (!bR)
        return -1;
    const aBottom = aR.top + aR.height;
    const bBottom = bR.top + bR.height;
    const overlapTop = Math.max(aR.top, bR.top);
    const overlapBottom = Math.min(aBottom, bBottom);
    const overlap = overlapBottom - overlapTop;
    const minHeight = Math.min(aR.height, bR.height);
    // "Same line" when vertical overlap > 50% of the shorter element's height
    if (minHeight > 0 && overlap / minHeight > 0.5) {
        return aR.left - bR.left;
    }
    return aR.top - bR.top;
}
// ---------------------------------------------------------------------------
// flattenTree
// ---------------------------------------------------------------------------
/** Kept past the DOM-diff backend cutover: `findNodeByRect` walks the tree through it. */
function flattenTree(root) {
    const result = [];
    function traverse(node, depth, parent) {
        if (!node)
            return;
        if (Array.isArray(node)) {
            for (const n of node)
                traverse(n, depth, parent);
            return;
        }
        // Skip text/comment nodes and elements without a rect
        if (!node.tagName || node.tagName.startsWith('#'))
            return;
        if (!node.rect)
            return;
        const flat = { node, depth, parent };
        result.push(flat);
        const elementChildren = (node.childNodes ?? []).filter((c) => c?.tagName && !c.tagName.startsWith('#') && c.rect);
        const sorted = [...elementChildren].sort(readingOrderCompare);
        for (const child of sorted) {
            traverse(child, depth + 1, flat);
        }
    }
    traverse(root, 0, null);
    return result;
}
// ---------------------------------------------------------------------------
// Property helpers
// ---------------------------------------------------------------------------
function roundRect(r) {
    if (!r)
        return r;
    return {
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
    };
}
/**
 * Returns whether an Applitools DOM capture node could plausibly paint a pixel: it has a
 * non-zero-size rect and isn't hidden via `display:none`, `visibility:hidden`,
 * `opacity:0`, or the `hidden` HTML attribute.
 */
function isVisible(node) {
    const r = node.rect;
    if (!r || r.width <= 0 || r.height <= 0)
        return false;
    const style = node.style ?? {};
    if ((style.display ?? '').toString().toLowerCase() === 'none')
        return false;
    if ((style.visibility ?? '').toString().toLowerCase() === 'hidden')
        return false;
    const opacity = parseFloat(style.opacity);
    if (!Number.isNaN(opacity) && opacity === 0)
        return false;
    if (Object.prototype.hasOwnProperty.call(node.attributes ?? {}, 'hidden'))
        return false;
    return true;
}
// ---------------------------------------------------------------------------
// filterDiffToArea (final pass — cropping)
// ---------------------------------------------------------------------------
//
// Restricts an already-computed diff to entries relevant to a given area. This must run
// LAST, after matching/diffing has completed over the full, unrestricted trees. Cropping
// the input trees before matching (e.g. pruning both sides to `area` before flattening)
// loses cross-subtree context and can cause the LCS matcher to align the wrong nodes, or
// fail to recognize an unpruned ancestor as the same persisting element — see
// the node-ids/cropping caveat in atoms/README.md's "DOM diffing" section.
function entryIntersectsArea(item, area) {
    if (item.status === 'displaced') {
        return rectsIntersect(item.rect, area) || rectsIntersect(item.baseline.rect, area);
    }
    if (item.status === 'changed') {
        return rectsIntersect(item.rect, area) || rectsIntersect(item.baseline.rect, area);
    }
    // 'new' (checkpoint-side only) or 'missing', singleton or collapsed (baseline-side only) —
    // either way, item.rect is the one side that exists for this entry.
    return rectsIntersect(item.rect, area);
}
function filterDiffToArea(diffs, area) {
    return diffs.map(item => (item !== null && entryIntersectsArea(item, area) ? item : null));
}
// ---------------------------------------------------------------------------
// excludeNonVisualNodeDiffs (final pass — visual-diff-rect filtering)
// ---------------------------------------------------------------------------
//
// Restricts an already-computed diff to entries that correspond to an actual visual diff —
// e.g. a match region (ignore/dynamic/layout/etc.) suppresses a pixel diff but not necessarily
// a DOM-level structural difference underneath it. Like `filterDiffToArea`, this must run
// LAST, after matching/diffing has completed over the full, unrestricted trees — pruning the
// input trees themselves before matching risks the same alignment-quality loss described above.
// Unlike `filterDiffToArea`, baseline-side and checkpoint-side rects are checked against their
// own, independent rect list (a step's visual diff is itself two-way — see `compareStep`/the
// `GET .../diff` endpoint's own `image1`/`image2` split), not a single shared area.
function entryIntersectsVisualDiff(item, baselineDiffs, checkpointDiffs) {
    const intersectsAny = (r, rects) => !!r && rects.some(rect => rectsIntersect(r, rect));
    if (item.status === 'displaced') {
        return intersectsAny(item.rect, checkpointDiffs) || intersectsAny(item.baseline.rect, baselineDiffs);
    }
    if (item.status === 'changed') {
        return intersectsAny(item.rect, checkpointDiffs) || intersectsAny(item.baseline.rect, baselineDiffs);
    }
    if (item.status === 'new') {
        return intersectsAny(item.rect, checkpointDiffs);
    }
    // 'missing', singleton or collapsed — baseline-only subtree
    return intersectsAny(item.rect, baselineDiffs);
}
function excludeNonVisualNodeDiffs(diffs, baselineDiffs, checkpointDiffs) {
    return diffs.map(item => item !== null && entryIntersectsVisualDiff(item, baselineDiffs, checkpointDiffs) ? item : null);
}
// ---------------------------------------------------------------------------
// serializeDiff
// ---------------------------------------------------------------------------
function serializeDiff(diffs) {
    const lines = [];
    for (const diff of diffs) {
        if (diff === null)
            continue;
        const { depth, ...obj } = diff;
        lines.push('  '.repeat(depth) + JSON.stringify(obj));
    }
    return lines.join('\n');
}
/**
 * Extracts one target node's aligned counterpart and rect-filtered diff from an
 * already-computed alignment (the backend's `fetchDomDiff` result, or an equivalent
 * `DomAlignment` obtained some other way) — the cheap part once the
 * whole-tree alignment is done, so a caller with several target nodes against the same pair of
 * trees runs this once per node without paying for the alignment itself more than once.
 * `targetNodeId` must be a node id assigned (see `assignNodeIds`) on whichever tree was aligned
 * as the checkpoint side — its matched baseline id and its own checkpoint rect are read straight
 * off `alignment.matches` by that id, so a caller never needs to hold onto the actual node object,
 * only its id, and this works just as well against an alignment that was serialized (e.g. read
 * back from a cache or a network response) as against one just computed in-process.
 *
 * Reading a target's own match off a *global*, whole-tree alignment — rather than a standalone
 * best-match search for that one node — is deliberate: an element that occupies the same
 * structural position across captures but now shows entirely different content (e.g. a rotating
 * carousel slot, or a live counter) would otherwise get matched to wherever its *old* content
 * happens to reappear elsewhere on the page, rather than to whatever now occupies its own slot.
 * Aligning the whole page at once keeps a node's in-place replacement — not a content lookalike
 * somewhere else — as its counterpart, because the aligner is scored on overall sequence
 * correspondence, not one node in isolation.
 */
function extractNodeDiff(alignment, targetNodeId) {
    if (!(targetNodeId in alignment.matches))
        return { found: false, matchedNodeId: null, diff: '' };
    const match = alignment.matches[targetNodeId];
    if (!match)
        return { found: true, matchedNodeId: null, diff: '' };
    const result = filterDiffToArea(alignment.diff, match.checkpointRect);
    const diff = serializeDiff(result)
        .split('\n')
        .map(line => line.trimStart())
        .join('\n');
    return { found: true, matchedNodeId: match.baselineId, diff };
}

/**
 * Seeds one tracker per suspect nodeId, anchored at `currentDomId`. Doesn't verify the nodeId
 * actually exists in the current DOM — that would need fetching the whole tree just to check one
 * id — so a bad id is simply carried through and only surfaces once (if) a real historic
 * candidate is actually walked (`applyHistoricDom` catches it there for free, off an alignment it
 * already has to compute). `currentStep`/`currentCapturedAt` identify and date the tracker's
 * initial anchor, so the very first diff entry (if any) correctly attributes its checkpoint side
 * to the current step rather than leaving it implicit.
 */
function createHistoricDomNodeTrackers(currentDomId, nodeIds, currentStep, currentCapturedAt) {
    return nodeIds.map(nodeId => ({
        nodeId,
        anchorDomId: currentDomId,
        anchorNodeId: nodeId,
        anchorStep: currentStep,
        anchorCapturedAt: currentCapturedAt,
        diffs: [],
    }));
}
/** Groups trackers by their shared anchor domId so the caller can align a historic capture
 * against that domId once and reuse it for every tracker in the group, instead of once per
 * tracker. */
function groupByAnchorDomId(trackers) {
    const groups = new Map();
    for (const tracker of trackers) {
        const group = groups.get(tracker.anchorDomId);
        if (group)
            group.push(tracker);
        else
            groups.set(tracker.anchorDomId, [tracker]);
    }
    return groups;
}
/**
 * Applies exactly one older `HistoricDom` to every tracker that still has fewer than
 * `targetDiffCount` non-empty diffs, mutating each in place — the unit of lazy evaluation a
 * caller feeds historic DOMs into one at a time as it discovers them (see `history.ts`'s
 * `walkHistoricSources`), so it can stop pulling further history the moment every tracker has
 * enough evidence, rather than pre-fetching a fixed batch before knowing how much is needed.
 *
 * Each hop diffs a tracker's current anchor against `historicDom.domId` via a *global* alignment
 * between the two full trees (`deps.fetchAlignment`/`extractNodeDiff`), not a standalone search
 * for the anchor alone — a single-node content search would chase a content lookalike elsewhere
 * on the page (e.g. a rotating carousel slot, or a live counter) rather than the element that
 * actually took its place. When the alignment finds a counterpart, that counterpart becomes the
 * anchor for the next (older) hop, so the walk tracks the same structural slot across a long
 * history one hop at a time. Trackers sharing the same anchor domId are aligned against
 * `historicDom.domId` together, once, via `groupByAnchorDomId` — the alignment itself doesn't
 * depend on which specific node is being asked about, only on the pair of domIds, so paying for
 * it once per distinct pair rather than once per tracker avoids pure waste (and, since
 * `deps.fetchAlignment` is typically itself cached by domId pair, this also means a hop already
 * paid for elsewhere — e.g. by `eyes_inspect_dom_diff`'s own two-sided diff — is never
 * recomputed here either).
 *
 * When a hop's alignment finds no counterpart for the current anchor, that doesn't mean the
 * anchor itself is wrong — it may just mean this one historic candidate is a poor comparison
 * point (an unrelated element elsewhere on the page stealing the alignment's matching capacity,
 * a transient loading state, and so on). Rather than reverting to some other reference node,
 * a miss is simply skipped: nothing is recorded, and the anchor is left untouched, so the very
 * same anchor is retried against the next (older) candidate the next time this is called. The
 * chain resumes forward from wherever it next finds a match.
 *
 * A tracker whose `anchorNodeId` doesn't exist at all in whichever tree just played the
 * checkpoint role (`extractNodeDiff`'s `found: false`) is different from a poor-comparison miss —
 * that's `createHistoricDomNodeTrackers` never having verified the caller's nodeId, surfacing now
 * for the first time. Every such tracker across the whole call is collected and reported in one
 * combined error, rather than silently left to retry forever.
 */
async function applyHistoricDom(trackers, historicDom, targetDiffCount, deps) {
    const active = trackers.filter(t => t.diffs.length < targetDiffCount);
    const notFound = [];
    for (const [anchorDomId, group] of groupByAnchorDomId(active)) {
        const alignment = await deps.fetchAlignment(historicDom.domId, anchorDomId);
        for (const tracker of group) {
            const result = extractNodeDiff(alignment, tracker.anchorNodeId);
            if (!result.found) {
                notFound.push(tracker.nodeId);
                continue;
            }
            if (!result.matchedNodeId)
                continue; // poor comparison point — retry this same anchor next time
            if (result.diff.length > 0) {
                tracker.diffs.push({
                    checkpointStep: tracker.anchorStep,
                    checkpointCapturedAt: tracker.anchorCapturedAt,
                    baselineStep: historicDom.step,
                    baselineCapturedAt: historicDom.capturedAt,
                    diff: result.diff,
                });
            }
            tracker.anchorNodeId = result.matchedNodeId;
            tracker.anchorDomId = historicDom.domId;
            tracker.anchorStep = historicDom.step;
            tracker.anchorCapturedAt = historicDom.capturedAt;
        }
    }
    if (notFound.length > 0) {
        throw new Error(`Node id(s) not found in DOM snapshot: ${notFound.join(', ')}`);
    }
}
/** Strips tracker-only bookkeeping (the chain anchor) down to the plain
 * `{nodeId, diffs: [{checkpointStep, checkpointCapturedAt, baselineStep, baselineCapturedAt, diff}]}`
 * output shape. */
function finalizeHistoricDomNodeEvidence(trackers) {
    return trackers.map(({ nodeId, diffs }) => ({ nodeId, diffs }));
}

// ---------------------------------------------------------------------------
// dom-search: a small predicate language for querying DOM capture files
// ---------------------------------------------------------------------------
//
// Mostly self-contained — duplicates a handful of tiny dom.ts helpers (node ids, text
// aggregation, rect extraction) rather than import them, since they're small and stable
// enough that keeping this file independently readable outweighs the duplication. Visibility
// is the one exception: `isVisible` is imported for real from dom.ts, where it belongs as a
// general DOM-node concept — this file has no reason to own its own copy of that logic, and
// nothing here flows back into dom.ts, so there's no circularity to worry about.
const WORD_RE = /^[A-Za-z_][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*/;
const ORDINAL_SUFFIX_RE = /^(\d+)(st|nd|rd|th)\b/i;
// Escapes recognized inside a single-quoted value. `"` is deliberately absent — there is no
// double-quoted form, so a literal double quote never needs escaping and `\"` passes through
// as its own two literal characters rather than being treated as an escape.
const STRING_ESCAPES = {
    "'": "'",
    '\\': '\\',
    n: '\n',
    t: '\t',
    r: '\r',
};
function scanString(src, start) {
    let i = start + 1;
    let value = '';
    while (i < src.length && src[i] !== "'") {
        const escaped = src[i] === '\\' ? STRING_ESCAPES[src[i + 1]] : undefined;
        if (escaped !== undefined) {
            value += escaped;
            i += 2;
        }
        else {
            value += src[i];
            i++;
        }
    }
    if (i >= src.length) {
        throw new Error(`Unterminated string literal starting at position ${start} — a single-quoted value must be closed with '.`);
    }
    return { value, end: i + 1 };
}
function scanRegex(src, start) {
    let i = start + 1;
    let pattern = '';
    while (i < src.length && src[i] !== '/') {
        if (src[i] === '\\' && i + 1 < src.length) {
            pattern += src[i] + src[i + 1];
            i += 2;
            continue;
        }
        pattern += src[i];
        i++;
    }
    if (i >= src.length) {
        throw new Error(`Unterminated regex literal starting at position ${start} — a /pattern/ must be closed with /.`);
    }
    i++; // consume closing '/'
    let flags = '';
    while (i < src.length && /[a-zA-Z]/.test(src[i])) {
        flags += src[i];
        i++;
    }
    return { pattern, flags, end: i };
}
function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        const start = i;
        if (c === '(' || c === ')' || c === ',' || c === '.') {
            tokens.push({ type: 'punct', value: c, pos: start });
            i++;
            continue;
        }
        if (c === '&' && src[i + 1] === '&') {
            tokens.push({ type: 'punct', value: '&&', pos: start });
            i += 2;
            continue;
        }
        if (c === '|' && src[i + 1] === '|') {
            tokens.push({ type: 'punct', value: '||', pos: start });
            i += 2;
            continue;
        }
        if (c === '!' && src[i + 1] === '=') {
            tokens.push({ type: 'punct', value: '!=', pos: start });
            i += 2;
            continue;
        }
        if (c === '<' && src[i + 1] === '=') {
            tokens.push({ type: 'punct', value: '<=', pos: start });
            i += 2;
            continue;
        }
        if (c === '>' && src[i + 1] === '=') {
            tokens.push({ type: 'punct', value: '>=', pos: start });
            i += 2;
            continue;
        }
        if (c === '=' && src[i + 1] === '~') {
            tokens.push({ type: 'punct', value: '=~', pos: start });
            i += 2;
            continue;
        }
        if (c === '!') {
            tokens.push({ type: 'punct', value: '!', pos: start });
            i++;
            continue;
        }
        if (c === '<') {
            tokens.push({ type: 'punct', value: '<', pos: start });
            i++;
            continue;
        }
        if (c === '>') {
            tokens.push({ type: 'punct', value: '>', pos: start });
            i++;
            continue;
        }
        if (c === '=') {
            tokens.push({ type: 'punct', value: '=', pos: start });
            i++;
            continue;
        }
        if (c === "'") {
            const { value, end } = scanString(src, i);
            tokens.push({ type: 'string', value, pos: start });
            i = end;
            continue;
        }
        if (c === '/') {
            const { pattern, flags, end } = scanRegex(src, i);
            tokens.push({ type: 'regex', value: pattern, flags, pos: start });
            i = end;
            continue;
        }
        const isDigitStart = /[0-9]/.test(c);
        const isNegativeStart = c === '-' && /[0-9]/.test(src[i + 1] ?? '');
        if (isDigitStart || isNegativeStart) {
            let j = isNegativeStart ? i + 1 : i;
            while (/[0-9]/.test(src[j] ?? ''))
                j++;
            const digitsEnd = j;
            if (!isNegativeStart) {
                const ordinalMatch = ORDINAL_SUFFIX_RE.exec(src.slice(i));
                if (ordinalMatch) {
                    const word = ordinalMatch[0];
                    tokens.push({ type: 'word', value: word, pos: start });
                    i += word.length;
                    continue;
                }
            }
            let k = digitsEnd;
            if (src[k] === '.' && /[0-9]/.test(src[k + 1] ?? '')) {
                k++;
                while (/[0-9]/.test(src[k] ?? ''))
                    k++;
            }
            tokens.push({ type: 'number', value: src.slice(i, k), pos: start });
            i = k;
            continue;
        }
        if (/[A-Za-z_]/.test(c)) {
            const match = WORD_RE.exec(src.slice(i));
            const word = match[0];
            tokens.push({ type: 'word', value: word, pos: start });
            i += word.length;
            continue;
        }
        throw new Error(`Unexpected character '${c}' at position ${start} in predicate.`);
    }
    tokens.push({ type: 'eof', value: '', pos: src.length });
    return tokens;
}
// ---------------------------------------------------------------------------
// Keyword tables
// ---------------------------------------------------------------------------
const BOUNDS_OPS = new Set(['contains', 'intersects', 'contained-by']);
const BOUNDS_OP_CANON = {
    contains: 'contains',
    intersects: 'intersects',
    'contained-by': 'containedBy',
};
const RELATION_KIND = {
    'descendant-of': 'descendant',
    'descendent-of': 'descendant',
    'ancestor-of': 'ancestor',
    'child-of': 'child',
    'parent-of': 'parent',
    'sibling-of': 'sibling',
};
const NULLARY_WORDS = new Set([
    'text',
    'image',
    'gif',
    'logo',
    'link',
    'button',
    'heading',
    'hidden',
    'visible',
    'empty',
    'true',
    'false',
]);
const SIZE_OP_KIND = {
    'larger-than': 'larger',
    'smaller-than': 'smaller',
    'wider-than': 'wider',
    'narrower-than': 'narrower',
    'taller-than': 'taller',
    'shorter-than': 'shorter',
};
const DIR_OP_KIND = {
    above: 'above',
    below: 'below',
    'left-of': 'leftOf',
    'right-of': 'rightOf',
};
const VALID_DIR_OPS_LIST = 'above, below, left-of, right-of';
const COMPARE_OP_MAP = {
    '=': 'eq',
    equals: 'eq',
    '!=': 'neq',
    'not-equals': 'neq',
    '<': 'lt',
    'less-than': 'lt',
    '<=': 'lte',
    'less-than-or-equal': 'lte',
    'less-than-or-equal-to': 'lte',
    '>': 'gt',
    'greater-than': 'gt',
    '>=': 'gte',
    'greater-than-or-equal': 'gte',
    'greater-than-or-equal-to': 'gte',
    'starts-with': 'startsWith',
    'ends-with': 'endsWith',
    contains: 'contains',
    '=~': 'regex',
    matches: 'regex',
    regex: 'regex',
    in: 'in',
};
const VALID_COMPARE_OPS_LIST = '=, equals, !=, not-equals, <, less-than, <=, less-than-or-equal, less-than-or-equal-to, ' +
    '>, greater-than, >=, greater-than-or-equal, greater-than-or-equal-to, starts-with, ends-with, ' +
    'contains, =~, matches, regex, in';
const VALID_BOUNDS_OPS_LIST = 'contains, intersects, contained-by';
const VALID_NULLARY_LIST = 'text, image, gif, logo, link, button, heading, hidden, visible, empty, true, false';
const VALID_RELATION_LIST = "descendant-of, descendent-of, ancestor-of, child-of, parent-of, sibling-of (optionally preceded by an ordinal like '2nd' or 'first' for child-of)";
const ORDINAL_WORDS = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
    thirteenth: 13,
    fourteenth: 14,
    fifteenth: 15,
    sixteenth: 16,
    seventeenth: 17,
    eighteenth: 18,
    nineteenth: 19,
    twentieth: 20,
};
function isOrdinalToken(text) {
    const lower = text.toLowerCase();
    if (lower in ORDINAL_WORDS)
        return true;
    return /^\d+(st|nd|rd|th)$/i.test(lower);
}
function parseOrdinalValue(text) {
    const lower = text.toLowerCase();
    if (lower in ORDINAL_WORDS)
        return ORDINAL_WORDS[lower];
    const m = /^(\d+)(st|nd|rd|th)$/i.exec(lower);
    if (m) {
        const n = Number(m[1]);
        if (n >= 1 && n <= 20)
            return n;
    }
    throw new Error(`Ordinal '${text}' is out of range. Only 1st through 20th (or 'first' through 'twentieth') are supported.`);
}
function tokenOpKey(tok) {
    if (tok.type === 'punct')
        return COMPARE_OP_MAP[tok.value] ?? null;
    if (tok.type === 'word')
        return COMPARE_OP_MAP[tok.value.toLowerCase()] ?? null;
    return null;
}
// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
class Parser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    peek(offset = 0) {
        return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
    }
    next() {
        const tok = this.tokens[this.pos];
        if (this.pos < this.tokens.length - 1)
            this.pos++;
        return tok;
    }
    isWord(tok, text) {
        return tok.type === 'word' && tok.value.toLowerCase() === text;
    }
    isPunct(tok, text) {
        return tok.type === 'punct' && tok.value === text;
    }
    expectPunct(sym) {
        const tok = this.peek();
        if (!this.isPunct(tok, sym)) {
            const shown = tok.type === 'eof' ? 'end of predicate' : `'${tok.value}'`;
            throw new Error(`Unexpected token ${shown} at position ${tok.pos} — expected '${sym}'.`);
        }
        this.next();
    }
    parseTopLevel() {
        const ast = this.parseExpr();
        const rest = this.peek();
        if (rest.type !== 'eof') {
            throw new Error(`Unexpected trailing input starting at '${rest.value}' (position ${rest.pos}) — the predicate finished parsing before the end of the string.`);
        }
        return ast;
    }
    parseExpr() {
        return this.parseOr();
    }
    parseOr() {
        let left = this.parseAnd();
        while (this.isWord(this.peek(), 'or') || this.isPunct(this.peek(), '||')) {
            this.next();
            const right = this.parseAnd();
            left = { type: 'or', left, right };
        }
        return left;
    }
    parseAnd() {
        let left = this.parseNot();
        while (this.isWord(this.peek(), 'and') || this.isPunct(this.peek(), '&&')) {
            this.next();
            const right = this.parseNot();
            left = { type: 'and', left, right };
        }
        return left;
    }
    parseNot() {
        if (this.isWord(this.peek(), 'not') || this.isPunct(this.peek(), '!')) {
            this.next();
            const inner = this.parseNot();
            return { type: 'not', inner };
        }
        return this.parseAtom();
    }
    isValidCompareOpStart(tok) {
        return tokenOpKey(tok) !== null;
    }
    parseAtom() {
        const tok = this.peek();
        if (this.isPunct(tok, '(')) {
            this.next();
            const expr = this.parseExpr();
            this.expectPunct(')');
            return expr;
        }
        if (tok.type !== 'word') {
            throw new Error(`Expected a predicate (property comparison, bounds check, relation, or shortcut keyword) but found '${tok.value || 'end of predicate'}' at position ${tok.pos}.`);
        }
        const lower = tok.value.toLowerCase();
        if (lower === 'bounds' || lower === 'rect') {
            const nextTok = this.peek(1);
            if (!this.isPunct(nextTok, '.')) {
                const nextLower = nextTok.type === 'word' ? nextTok.value.toLowerCase() : '';
                if (BOUNDS_OPS.has(nextLower)) {
                    return this.parseBoundsPred();
                }
                if (!this.isValidCompareOpStart(nextTok)) {
                    throw new Error(`Unknown operator '${nextTok.value}' after '${tok.value}'. If testing bounds, valid operators are: ${VALID_BOUNDS_OPS_LIST}. ` +
                        `If comparing a property, use '.' to continue the path (e.g. ${tok.value}.width) followed by a comparison operator.`);
                }
                // else: falls through to PropPred below (bare rect/bounds compared as a whole value)
            }
        }
        if (RELATION_KIND[lower]) {
            return this.parseRelPred();
        }
        if (SIZE_OP_KIND[lower]) {
            return this.parseSizePred();
        }
        if (DIR_OP_KIND[lower]) {
            return this.parseDirPred();
        }
        if (lower === 'has-attribute') {
            return this.parseHasAttrPred();
        }
        if (/-of$/i.test(lower)) {
            throw new Error(`Unknown relation or direction check '${tok.value}'. Valid relations: ${VALID_RELATION_LIST}. Valid direction checks: ${VALID_DIR_OPS_LIST}.`);
        }
        if (isOrdinalToken(tok.value)) {
            const nextTok = this.peek(1);
            if (!(nextTok.type === 'word' && nextTok.value.toLowerCase() === 'child-of')) {
                throw new Error(`Ordinal '${tok.value}' must be followed by 'child-of <target>', e.g. '${tok.value} child-of 5'.`);
            }
            return this.parseOrdinalChildOf();
        }
        if (NULLARY_WORDS.has(lower)) {
            if (lower === 'text') {
                const nextTok = this.peek(1);
                if (this.isValidCompareOpStart(nextTok)) {
                    return this.parsePropPred();
                }
            }
            this.next();
            return { type: 'nullary', name: lower };
        }
        const nextTok = this.peek(1);
        const isBoundaryToken = nextTok.type === 'eof' ||
            this.isWord(nextTok, 'and') ||
            this.isWord(nextTok, 'or') ||
            this.isPunct(nextTok, '&&') ||
            this.isPunct(nextTok, '||') ||
            this.isPunct(nextTok, ')');
        if (isBoundaryToken) {
            throw new Error(`Unknown predicate '${tok.value}'. If you meant a shortcut predicate, valid ones are: ${VALID_NULLARY_LIST}. ` +
                `If you meant a property comparison, it must be followed by an operator and value, e.g. '${tok.value} = ...'.`);
        }
        return this.parsePropPred();
    }
    parsePropertyPath() {
        const first = this.next();
        if (first.type !== 'word') {
            throw new Error(`Expected a property name but found '${first.value}' at position ${first.pos}.`);
        }
        const path = [first.value];
        while (this.isPunct(this.peek(), '.')) {
            this.next();
            const seg = this.next();
            if (seg.type !== 'word') {
                throw new Error(`Expected a property name after '.' but found '${seg.value}' at position ${seg.pos}.`);
            }
            path.push(seg.value);
        }
        return path;
    }
    parsePropPred() {
        const path = this.parsePropertyPath();
        const opTok = this.peek();
        const opKey = tokenOpKey(opTok);
        if (!opKey) {
            throw new Error(`Unknown comparison operator '${opTok.value}'. Valid operators: ${VALID_COMPARE_OPS_LIST}.`);
        }
        this.next();
        if (opKey === 'in') {
            const value = this.parseValueList();
            return { type: 'prop', path, op: 'in', value };
        }
        if (opKey === 'regex') {
            const value = this.parseRegexValue();
            return { type: 'prop', path, op: 'regex', value };
        }
        const value = this.parseSingleValue();
        return { type: 'prop', path, op: opKey, value };
    }
    parseBareValue() {
        let text = '';
        let expectedPos = null;
        while (true) {
            const tok = this.peek();
            if ((tok.type === 'word' || tok.type === 'number') && (expectedPos === null || tok.pos === expectedPos)) {
                text += tok.value;
                expectedPos = tok.pos + tok.value.length;
                this.next();
            }
            else {
                break;
            }
        }
        if (text === '') {
            const tok = this.peek();
            throw new Error(`Expected a value but found '${tok.value || 'end of predicate'}' at position ${tok.pos}.`);
        }
        return text;
    }
    parseSingleValue() {
        const tok = this.peek();
        if (tok.type === 'string') {
            this.next();
            return tok.value;
        }
        if (tok.type === 'regex') {
            throw new Error(`A /regex/ literal is only valid with the matches/regex/=~ operator, not here (position ${tok.pos}).`);
        }
        return this.parseBareValue();
    }
    parseValueList() {
        this.expectPunct('(');
        const values = [this.parseSingleValue()];
        while (this.isPunct(this.peek(), ',')) {
            this.next();
            values.push(this.parseSingleValue());
        }
        this.expectPunct(')');
        return values;
    }
    parseRegexValue() {
        const tok = this.peek();
        if (tok.type !== 'regex') {
            throw new Error(`Expected a /pattern/flags regex literal after 'matches'/'regex'/'=~' but found '${tok.value}' at position ${tok.pos}.`);
        }
        this.next();
        const flags = tok.flags && tok.flags.length > 0 ? tok.flags : 'i';
        try {
            return new RegExp(tok.value, flags);
        }
        catch (e) {
            throw new Error(`Invalid regex literal /${tok.value}/${tok.flags ?? ''}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    parseSignedNumber() {
        const tok = this.next();
        if (tok.type !== 'number') {
            throw new Error(`Expected a number but found '${tok.value}' at position ${tok.pos}.`);
        }
        return Number(tok.value);
    }
    isNodeKeyword(tok) {
        return tok.type === 'word' && tok.value.toLowerCase() === 'node';
    }
    // Assumes the caller already confirmed the current token is the 'node' keyword (via
    // isNodeKeyword) — this is the one and only way to reference another element by id anywhere
    // in the grammar (bounds/relation/size/direction targets), freeing up a bare number to mean a
    // literal value in the targets that accept one (e.g. size targets).
    parseNodeId() {
        this.next(); // 'node'
        const idTok = this.next();
        if (idTok.type !== 'number') {
            throw new Error(`Expected a node id (a non-negative integer) after 'node' but found '${idTok.value || 'end of predicate'}' at position ${idTok.pos}.`);
        }
        const n = Number(idTok.value);
        if (n < 0 || !Number.isInteger(n)) {
            throw new Error(`A node id must be a non-negative integer, got '${idTok.value}' at position ${idTok.pos}.`);
        }
        return String(n);
    }
    parseBoundsPred() {
        this.next(); // 'bounds' | 'rect'
        const opTok = this.next();
        const opLower = opTok.value.toLowerCase();
        if (!BOUNDS_OPS.has(opLower)) {
            throw new Error(`Unknown bounds operator '${opTok.value}'. Valid operators: ${VALID_BOUNDS_OPS_LIST}.`);
        }
        const target = this.parseBoundsTarget();
        return { type: 'bounds', op: BOUNDS_OP_CANON[opLower], target };
    }
    parseBoundsTarget() {
        if (this.isNodeKeyword(this.peek())) {
            return { type: 'id', id: this.parseNodeId() };
        }
        const numbers = [this.parseSignedNumber()];
        while (this.isPunct(this.peek(), ',')) {
            this.next();
            numbers.push(this.parseSignedNumber());
        }
        if (numbers.length === 2) {
            return { type: 'point', x: numbers[0], y: numbers[1] };
        }
        if (numbers.length === 4) {
            const [left, top, width, height] = numbers;
            return { type: 'rect', rect: { left, top, width, height } };
        }
        const hint = numbers.length === 1 ? ` Did you mean 'node ${numbers[0]}'?` : '';
        throw new Error(`A bounds target must be 'node <id>' (another element), 2 numbers (point 'x,y'), or 4 numbers (rect 'left,top,width,height') — got ${numbers.length} number(s).${hint}`);
    }
    parseRelPred() {
        const kwTok = this.next();
        const kind = RELATION_KIND[kwTok.value.toLowerCase()];
        const target = this.parseRelTarget();
        return { type: 'rel', kind, target };
    }
    parseOrdinalChildOf() {
        const ordTok = this.next();
        const ordinal = parseOrdinalValue(ordTok.value);
        this.next(); // 'child-of'
        const target = this.parseRelTarget();
        return { type: 'rel', kind: 'nthChild', ordinal, target };
    }
    parseRelTarget() {
        const tok = this.peek();
        if (this.isNodeKeyword(tok)) {
            return { type: 'id', id: this.parseNodeId() };
        }
        if (tok.type === 'number') {
            throw new Error(`A relation target must be 'node <id>' to reference another element, or a sub-predicate — found a bare number '${tok.value}' at position ${tok.pos}. Did you mean 'node ${tok.value}'?`);
        }
        if (tok.type === 'eof') {
            throw new Error(`Expected 'node <id>' or a sub-predicate after the relation, but found end of predicate at position ${tok.pos}.`);
        }
        // Any other target is a single Atom — this already covers a fully parenthesized
        // sub-Expr (parseAtom's own "(" Expr ")" case) as well as a bare single-token target
        // like a nullary predicate, e.g. "ancestor-of text" inside "child-of (ancestor-of text and tagName = BUTTON)".
        const atom = this.parseAtom();
        return { type: 'expr', ast: atom };
    }
    parseSizePred() {
        const kwTok = this.next();
        const kind = SIZE_OP_KIND[kwTok.value.toLowerCase()];
        const target = this.parseSizeTarget();
        return { type: 'size', kind, target };
    }
    parseSizeTarget() {
        if (this.isNodeKeyword(this.peek())) {
            return { type: 'id', id: this.parseNodeId() };
        }
        const numbers = [this.parseSignedNumber()];
        while (this.isPunct(this.peek(), ',')) {
            this.next();
            numbers.push(this.parseSignedNumber());
        }
        if (numbers.length === 1) {
            return { type: 'value', value: numbers[0] };
        }
        if (numbers.length === 2) {
            return { type: 'size', width: numbers[0], height: numbers[1] };
        }
        if (numbers.length === 4) {
            const [left, top, width, height] = numbers;
            return { type: 'rect', rect: { left, top, width, height } };
        }
        throw new Error(`A size target must be a single number (a literal value), 2 numbers (size 'width,height'), 4 numbers (rect 'left,top,width,height'), or 'node <id>' (another element) — got ${numbers.length} numbers.`);
    }
    parseHasAttrPred() {
        this.next(); // 'has-attribute'
        const name = this.parseSingleValue();
        return { type: 'hasAttr', name };
    }
    parseDirPred() {
        const kwTok = this.next();
        const kind = DIR_OP_KIND[kwTok.value.toLowerCase()];
        const target = this.parseDirTarget();
        return { type: 'dir', kind, target };
    }
    parseDirTarget() {
        if (this.isNodeKeyword(this.peek())) {
            return { type: 'id', id: this.parseNodeId() };
        }
        const numbers = [this.parseSignedNumber()];
        while (this.isPunct(this.peek(), ',')) {
            this.next();
            numbers.push(this.parseSignedNumber());
        }
        if (numbers.length === 4) {
            const [left, top, width, height] = numbers;
            return { type: 'rect', rect: { left, top, width, height } };
        }
        const hint = numbers.length === 1 ? ` Did you mean 'node ${numbers[0]}'?` : '';
        throw new Error(`A direction target must be 'node <id>' (another element) or 4 numbers (rect 'left,top,width,height') — got ${numbers.length} number(s).${hint}`);
    }
}
function parsePredicate(source) {
    if (!source || !source.trim()) {
        throw new Error('Predicate is empty. A dom-search predicate cannot be blank — see the dom-search predicate grammar documentation for the grammar and examples.');
    }
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    return parser.parseTopLevel();
}
// ---------------------------------------------------------------------------
// astNeedsIndex
// ---------------------------------------------------------------------------
function astNeedsIndex(ast) {
    switch (ast.type) {
        case 'or':
        case 'and':
            return astNeedsIndex(ast.left) || astNeedsIndex(ast.right);
        case 'not':
            return astNeedsIndex(ast.inner);
        case 'rel':
            return true;
        case 'bounds':
        case 'size':
        case 'dir':
            return ast.target.type === 'id';
        case 'prop':
        case 'nullary':
        case 'hasAttr':
            return false;
    }
}
function collectReferencedIds(ast, out) {
    switch (ast.type) {
        case 'or':
        case 'and':
            collectReferencedIds(ast.left, out);
            collectReferencedIds(ast.right, out);
            return;
        case 'not':
            collectReferencedIds(ast.inner, out);
            return;
        case 'bounds':
        case 'size':
        case 'dir':
            if (ast.target.type === 'id')
                out.add(ast.target.id);
            return;
        case 'rel':
            if (ast.target.type === 'id')
                out.add(ast.target.id);
            else
                collectReferencedIds(ast.target.ast, out);
            return;
        case 'prop':
        case 'nullary':
        case 'hasAttr':
            return;
    }
}
/**
 * Validates every literal node id referenced anywhere in the predicate (bounds targets and
 * relation targets, including inside nested chained-relation sub-predicates) against the index,
 * up front — so a missing id is always caught deterministically, rather than only when tree
 * traversal happens to reach the specific node/predicate combination that would look it up.
 */
function validateReferencedIds(ast, index) {
    const referenced = new Set();
    collectReferencedIds(ast, referenced);
    const missing = [...referenced].filter(id => !index.nodeById.has(id));
    if (missing.length > 0) {
        const idList = missing.map(id => `'${id}'`).join(', ');
        const label = missing.length === 1 ? 'Node id' : 'Node ids';
        const verb = missing.length === 1 ? 'was' : 'were';
        throw new Error(`${label} ${idList} referenced in the predicate ${verb} not found in this capture.`);
    }
}
function buildIndex(root) {
    const nodeById = new Map();
    const parentById = new Map();
    const ancestorIds = new Map();
    function visit(node, parent, ancestors) {
        if (!node)
            return;
        if (Array.isArray(node)) {
            for (const n of node)
                visit(n, parent, ancestors);
            return;
        }
        if (!node.tagName || node.tagName.startsWith('#'))
            return;
        const id = node.id;
        if (id != null) {
            nodeById.set(id, node);
            parentById.set(id, parent);
            ancestorIds.set(id, ancestors);
        }
        const childAncestors = id != null ? [...ancestors, id] : ancestors;
        for (const child of node.childNodes ?? []) {
            visit(child, node, childAncestors);
        }
    }
    visit(root, null, []);
    return { nodeById, parentById, ancestorIds };
}
// ---------------------------------------------------------------------------
// Node-level helpers (local reimplementations — see file header)
// ---------------------------------------------------------------------------
function nodeTextLocal(node) {
    return (node.childNodes ?? [])
        .filter((c) => c && c.tagName === '#text')
        .map((c) => c.text ?? '')
        .join('');
}
function nodeRectLocal(node) {
    const r = node?.rect;
    if (!r)
        return null;
    const { left, top, width, height } = r;
    if (typeof left !== 'number' || typeof top !== 'number' || typeof width !== 'number' || typeof height !== 'number')
        return null;
    return { left, top, width, height };
}
function elementChildrenOf(node) {
    return (node.childNodes ?? []).filter((c) => c && c.tagName && !c.tagName.startsWith('#'));
}
function rectContainsLocal(outer, inner) {
    return (outer.left <= inner.left &&
        outer.top <= inner.top &&
        outer.left + outer.width >= inner.left + inner.width &&
        outer.top + outer.height >= inner.top + inner.height);
}
function rectsIntersectLocal(a, b) {
    return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}
function toStringLoose(v) {
    if (v == null)
        return '';
    if (typeof v === 'object')
        return JSON.stringify(v);
    return String(v);
}
function toNumberLoose(v) {
    if (typeof v === 'number')
        return v;
    if (typeof v !== 'string')
        return null;
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
}
function getPropertyValue(node, path) {
    if (path.length === 1 && path[0] === 'text')
        return nodeTextLocal(node);
    let cur = node;
    for (const seg of path) {
        if (cur == null || typeof cur !== 'object')
            return undefined;
        cur = cur[seg];
    }
    return cur;
}
// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------
function evaluateProp(node, ast) {
    const raw = getPropertyValue(node, ast.path);
    if (ast.op === 'regex') {
        return ast.value.test(toStringLoose(raw));
    }
    if (ast.op === 'in') {
        const rawStr = toStringLoose(raw).toLowerCase();
        return ast.value.some(v => rawStr === v.toLowerCase());
    }
    if (ast.op === 'lt' || ast.op === 'lte' || ast.op === 'gt' || ast.op === 'gte') {
        const a = toNumberLoose(raw);
        const b = toNumberLoose(ast.value);
        if (a === null || b === null)
            return false;
        if (ast.op === 'lt')
            return a < b;
        if (ast.op === 'lte')
            return a <= b;
        if (ast.op === 'gt')
            return a > b;
        return a >= b;
    }
    const rawStr = toStringLoose(raw).toLowerCase();
    const value = ast.value.toLowerCase();
    switch (ast.op) {
        case 'eq':
            return rawStr === value;
        case 'neq':
            return rawStr !== value;
        case 'startsWith':
            return rawStr.startsWith(value);
        case 'endsWith':
            return rawStr.endsWith(value);
        case 'contains':
            return rawStr.includes(value);
        default:
            return false;
    }
}
function evaluateNullary(name, node) {
    const tagName = (node.tagName ?? '').toUpperCase();
    const attrs = node.attributes ?? {};
    const style = node.style ?? {};
    switch (name) {
        case 'text':
            return nodeTextLocal(node).trim().length > 0;
        case 'image': {
            if (tagName === 'IMG' || tagName === 'SVG' || tagName === 'PICTURE')
                return true;
            const bg = style['background-image'];
            return !!bg && bg !== 'none';
        }
        case 'gif':
            return tagName === 'IMG' && /\.gif$/i.test(attrs.src ?? '');
        case 'logo': {
            const hay = [attrs.class, attrs.id, attrs.alt].filter(Boolean).join(' ').toLowerCase();
            return hay.includes('logo');
        }
        case 'link':
            return tagName === 'A';
        case 'button': {
            if (tagName === 'BUTTON')
                return true;
            if (tagName === 'INPUT') {
                const type = (attrs.type ?? '').toLowerCase();
                if (type === 'button' || type === 'submit' || type === 'reset')
                    return true;
            }
            return (attrs.role ?? '').toLowerCase() === 'button';
        }
        case 'heading':
            return /^H[1-6]$/.test(tagName);
        case 'hidden':
            return !isVisible(node);
        case 'visible':
            return isVisible(node);
        case 'empty':
            return nodeTextLocal(node).trim().length === 0 && elementChildrenOf(node).length === 0;
        case 'true':
            return true;
        case 'false':
            return false;
        default:
            return false;
    }
}
function evaluateHasAttr(node, name) {
    const attrs = node.attributes ?? {};
    const target = name.toLowerCase();
    return Object.keys(attrs).some(k => k.toLowerCase() === target);
}
function resolveBoundsTarget(target, index) {
    if (target.type === 'point')
        return { left: target.x, top: target.y, width: 0, height: 0 };
    if (target.type === 'rect')
        return target.rect;
    // Referenced ids are validated up front in searchDom, so this lookup is guaranteed to succeed.
    return nodeRectLocal(index.nodeById.get(target.id));
}
function evaluateBounds(node, ast, index) {
    const r = nodeRectLocal(node);
    if (!r)
        return false;
    const targetRect = resolveBoundsTarget(ast.target, index);
    if (!targetRect)
        return false;
    switch (ast.op) {
        case 'contains':
            return rectContainsLocal(r, targetRect);
        case 'intersects':
            return rectsIntersectLocal(r, targetRect);
        case 'containedBy':
            return rectContainsLocal(targetRect, r);
    }
}
function scalarFromWH(width, height, kind) {
    switch (kind) {
        case 'larger':
        case 'smaller':
            return width * height;
        case 'wider':
        case 'narrower':
            return width;
        case 'taller':
        case 'shorter':
            return height;
    }
}
function resolveSizeTargetScalar(target, kind, index) {
    if (target.type === 'value')
        return target.value;
    if (target.type === 'size')
        return scalarFromWH(target.width, target.height, kind);
    if (target.type === 'rect')
        return scalarFromWH(target.rect.width, target.rect.height, kind);
    // Referenced ids are validated up front in searchDom.
    const r = nodeRectLocal(index.nodeById.get(target.id));
    return r ? scalarFromWH(r.width, r.height, kind) : null;
}
function evaluateSizePred(node, ast, index) {
    const r = nodeRectLocal(node);
    if (!r)
        return false;
    const selfScalar = scalarFromWH(r.width, r.height, ast.kind);
    const targetScalar = resolveSizeTargetScalar(ast.target, ast.kind, index);
    if (targetScalar === null)
        return false;
    switch (ast.kind) {
        case 'larger':
        case 'wider':
        case 'taller':
            return selfScalar > targetScalar;
        case 'smaller':
        case 'narrower':
        case 'shorter':
            return selfScalar < targetScalar;
    }
}
function resolveDirTargetRect(target, index) {
    if (target.type === 'rect')
        return target.rect;
    // Referenced ids are validated up front in searchDom.
    return nodeRectLocal(index.nodeById.get(target.id));
}
function evaluateDirPred(node, ast, index) {
    const r = nodeRectLocal(node);
    if (!r)
        return false;
    const t = resolveDirTargetRect(ast.target, index);
    if (!t)
        return false;
    switch (ast.kind) {
        case 'above':
            return r.top + r.height <= t.top;
        case 'below':
            return r.top >= t.top + t.height;
        case 'leftOf':
            return r.left + r.width <= t.left;
        case 'rightOf':
            return r.left >= t.left + t.width;
    }
}
function resolveRelTargetMatch(candidateNode, target, index) {
    if (target.type === 'id') {
        // Referenced ids are validated up front in searchDom, so no existence check needed here.
        return candidateNode.id === target.id;
    }
    return evaluateNode(candidateNode, target.ast, index);
}
function someDescendant(node, predicate) {
    for (const child of elementChildrenOf(node)) {
        if (predicate(child))
            return true;
        if (someDescendant(child, predicate))
            return true;
    }
    return false;
}
function evaluateRel(node, ast, index) {
    const nodeId = node.id;
    if (ast.kind === 'child' || ast.kind === 'nthChild') {
        const parent = index.parentById.get(nodeId);
        if (!parent)
            return false;
        if (ast.kind === 'nthChild') {
            const siblings = elementChildrenOf(parent);
            const idx = ast.ordinal - 1;
            if (idx < 0 || idx >= siblings.length)
                return false;
            if (siblings[idx].id !== nodeId)
                return false;
        }
        return resolveRelTargetMatch(parent, ast.target, index);
    }
    if (ast.kind === 'parent') {
        return elementChildrenOf(node).some(child => resolveRelTargetMatch(child, ast.target, index));
    }
    if (ast.kind === 'sibling') {
        const parent = index.parentById.get(nodeId);
        if (!parent)
            return false;
        return elementChildrenOf(parent).some(sib => {
            const sibId = sib.id;
            if (sibId === nodeId)
                return false;
            return resolveRelTargetMatch(sib, ast.target, index);
        });
    }
    if (ast.kind === 'ancestor') {
        return someDescendant(node, d => resolveRelTargetMatch(d, ast.target, index));
    }
    if (ast.kind === 'descendant') {
        const chain = index.ancestorIds.get(nodeId) ?? [];
        return chain.some(aid => {
            const a = index.nodeById.get(aid);
            return a ? resolveRelTargetMatch(a, ast.target, index) : false;
        });
    }
    return false;
}
function evaluateNode(node, ast, index) {
    switch (ast.type) {
        case 'or':
            return evaluateNode(node, ast.left, index) || evaluateNode(node, ast.right, index);
        case 'and':
            return evaluateNode(node, ast.left, index) && evaluateNode(node, ast.right, index);
        case 'not':
            return !evaluateNode(node, ast.inner, index);
        case 'bounds':
            return evaluateBounds(node, ast, index);
        case 'rel':
            return evaluateRel(node, ast, index);
        case 'size':
            return evaluateSizePred(node, ast, index);
        case 'dir':
            return evaluateDirPred(node, ast, index);
        case 'prop':
            return evaluateProp(node, ast);
        case 'nullary':
            return evaluateNullary(ast.name, node);
        case 'hasAttr':
            return evaluateHasAttr(node, ast.name);
    }
}
// ---------------------------------------------------------------------------
// searchDom
// ---------------------------------------------------------------------------
/**
 * Searches a DOM capture for elements matching a boolean predicate. See `llm-docs/dom-search.md`
 * in this package (shipped in the tarball) for the full predicate language documentation (grammar,
 * operators, examples) — that file is the canonical, copy-paste-friendly source; don't re-describe
 * the grammar here or anywhere else, keep it in sync by editing it and copying it where it's
 * needed instead.
 *
 * @param domCaptureJson Raw JSON text of a DOM capture file (as written by eyes-inspect's `dom` command) — a single node, or an array of nodes.
 * @param predicateSource The predicate string described in `llm-docs/dom-search.md`.
 * @returns One line per matching element, most indented lines the deepest — each line is that element's own properties (minus `childNodes`) as JSON, with a trailing `# <text>` comment when it has non-empty text.
 */
function searchDom(domCaptureJson, predicateSource) {
    const ast = parsePredicate(predicateSource);
    const root = JSON.parse(domCaptureJson);
    const index = astNeedsIndex(ast) ? buildIndex(root) : undefined;
    if (index)
        validateReferencedIds(ast, index);
    const lines = [];
    function walk(node, depth) {
        if (!node)
            return;
        if (Array.isArray(node)) {
            for (const n of node)
                walk(n, depth);
            return;
        }
        if (!node.tagName || node.tagName.startsWith('#'))
            return;
        if (evaluateNode(node, ast, index)) {
            const { childNodes: _childNodes, ...rest } = node;
            // Collapse whitespace (including any literal newlines from the raw text) so a match with
            // multi-line text still renders as exactly one output line, matching the documented
            // one-line-per-match format. Only the trailing annotation is collapsed — the underlying
            // `text` property used for predicate matching keeps the raw, uncollapsed content.
            const displayText = nodeTextLocal(node).replace(/\s+/g, ' ').trim();
            const suffix = displayText.length > 0 ? ` # ${displayText}` : '';
            lines.push('  '.repeat(depth) + JSON.stringify(rest) + suffix);
        }
        for (const child of node.childNodes ?? []) {
            walk(child, depth + 1);
        }
    }
    walk(root, 0);
    return lines.join('\n');
}

/**
 * The subset of `AnnotationCategory` (`sessions/regions.ts`) Applitools Eyes' own
 * `ImageMatchSettings` schema actually has a field for — a raw session's own
 * `imageMatchSettings` object never has a `mismatching` or `remarks` key, unlike
 * `annotations`/`identifiedRegions`, which do (those two are a dashboard/annotations-only
 * concept, not a real match-settings one).
 */
const MATCH_SETTINGS_CATEGORIES = [
    'content',
    'dynamic',
    'floating',
    'ignore',
    'layout',
    'strict',
    'accessibility',
];
function pickCategories(bucket) {
    const result = {};
    for (const category of MATCH_SETTINGS_CATEGORIES) {
        result[category] = bucket?.[category] ?? [];
    }
    return result;
}
/**
 * Builds the full `ImageMatchSettings` an `images/compare` request body expects for a step —
 * ready to use as-is. The rest of the request (`image1`/`image2`/`sessionId`/`batchId`/
 * `runningSessionId`/`stepIndex`) is the caller's own job, not this function's — none of those
 * are match-settings concerns.
 *
 * - Scalars (`matchLevel`, `scale`, `ignoreCaret`, `ignoreDisplacements`, `useDom`, etc.) come
 *   straight from `actualAppOutput[stepIndex].imageMatchSettings` — the match settings actually
 *   in effect for this run.
 * - `identifiedRegions` (this run's own coded regions) also comes from that same
 *   `imageMatchSettings` object's own per-category arrays — never falling back to the
 *   baseline's `identifiedRegions` snapshot: if a category has no entry there, there is no coded
 *   region of that kind in the current match, full stop.
 * - The plain, domSelector-anchored region categories are overwritten from
 *   `appOutputResolution[stepIndex].annotations` if a resolution exists, else
 *   `expectedAppOutput[stepIndex].annotations` (the baseline's own regions) — since
 *   `imageMatchSettings`'s own arrays only reflect what was true when the test last ran, not any
 *   region a reviewer added since. The coded regions among them (`regionId`) stay in those arrays
 *   ahead of the annotations: the compare endpoint applies the arrays and not `identifiedRegions`,
 *   so leaving them out reports diffs inside regions the real match never checks.
 *
 * No baseline/checkpoint side-picking or healing happens here: the raw session already resolves
 * which side a region describes (see `regions.ts`'s `getEffectiveRegions`, used instead for a
 * diagnostic display that needs both sides shown) — this only ever needs the one side already in
 * effect, relayed as-is, by reference.
 */
function getEffectiveMatchSettings(rawSession, stepIndex) {
    const imageMatchSettings = rawSession?.actualAppOutput?.[stepIndex]?.imageMatchSettings ?? {};
    const annotations = rawSession?.appOutputResolution?.[stepIndex]?.annotations ?? rawSession?.expectedAppOutput?.[stepIndex]?.annotations;
    const coded = pickCategories(imageMatchSettings);
    const annotated = pickCategories(annotations);
    const regions = {};
    for (const category of MATCH_SETTINGS_CATEGORIES) {
        regions[category] = [...coded[category].filter(isCodedRegion), ...annotated[category]];
    }
    return { ...imageMatchSettings, ...regions, identifiedRegions: coded };
}
function isCodedRegion(region) {
    return typeof region.regionId === 'string' && region.regionId !== '';
}
/**
 * The five match levels a match region can name — a subset of `MATCH_SETTINGS_CATEGORIES`, ordered
 * as the `regionOp` wire syntax and the MCP tool schemas list them.
 */
const REGION_TYPES = ['ignore', 'strict', 'ignorecolors', 'dynamic', 'layout'];
/**
 * Higher masks less: `strict` checks almost everything, `ignore` checks nothing. Read to refuse a
 * replacement that would leave a region weaker than it was.
 */
const REGION_TYPE_STRENGTH = {
    ignore: 0,
    layout: 1,
    dynamic: 2,
    ignorecolors: 3,
    strict: 4,
};

const ANNOTATION_CATEGORIES = [
    'content',
    'dynamic',
    'floating',
    'ignore',
    'mismatching',
    'layout',
    'remarks',
    'strict',
    'accessibility',
];
function emptyAnnotations() {
    return {
        content: [],
        dynamic: [],
        floating: [],
        ignore: [],
        mismatching: [],
        layout: [],
        remarks: [],
        strict: [],
        accessibility: [],
    };
}
/**
 * Determines which side's DOM a step's regions should reference. `accept`/`reject` always
 * resolve against the side they're about to make the (new) baseline going forward —
 * checkpoint or baseline respectively. `unchanged` means an action that doesn't itself
 * change the step's resolution (e.g. `baseline-regions`/`checkpoint-regions`, or just
 * inspecting current state), so it must defer to whatever the step's *existing* resolution
 * already is: a step accepted (but not yet saved) by an earlier call already has the
 * checkpoint as its baseline-to-be, so a region added now should reference that, not the
 * original baseline. Only an explicit prior reject, or no resolution at all, means the
 * original baseline is still the one to reference. `expectedAppOutput`/`actualAppOutput`
 * never change to reflect a pending resolution — only
 * `appOutputResolution[stepIndex].replaceExpected` does.
 */
function resolveDomIdSide(action, rawSession, stepIndex) {
    if (action === 'accept')
        return 'checkpoint';
    if (action === 'reject')
        return 'baseline';
    const resolutionEntry = rawSession?.appOutputResolution?.[stepIndex];
    return resolutionEntry?.replaceExpected === true ? 'checkpoint' : 'baseline';
}
/** The raw session's own image record (`{ id, domId, size, hasDom, location, rectangle }`) for a step's baseline or checkpoint image. */
function imageForSide(rawSession, stepIndex, side) {
    return side === 'baseline'
        ? rawSession?.expectedAppOutput?.[stepIndex]?.image
        : rawSession?.actualAppOutput?.[stepIndex]?.image;
}
function flattenCategoryBucket(source) {
    const result = [];
    if (!source)
        return result;
    for (const category of ANNOTATION_CATEGORIES) {
        for (const region of source[category] ?? []) {
            result.push({ category, region });
        }
    }
    return result;
}
/**
 * Pairs up two flattened coded-region lists — one per image side — into `RegionPair`s by
 * matching `regionId` within each category (a coded region's `regionId` is the same code-level
 * locator/name on both sides, so it's a stable join key). Only ever produces one pair per
 * `checkpoint` entry — a `baseline` entry with no matching `checkpoint` regionId is dropped
 * entirely, not surfaced with `checkpoint` absent: `imageMatchSettings` reflects what the test
 * run just asked for, so a coded region no longer requested by the checkpoint isn't part of
 * the effective set, even if a stale snapshot of it still lingers in `identifiedRegions`. Every
 * returned pair's `checkpoint` is therefore always populated, by construction, even though
 * `RegionPair`'s own type doesn't require it.
 */
function pairCodedRegions(baseline, checkpoint) {
    return checkpoint.map(c => {
        const match = baseline.find(b => b.category === c.category && b.region.regionId === c.region.regionId);
        return match
            ? { category: c.category, baseline: match.region, checkpoint: c.region }
            : { category: c.category, checkpoint: c.region };
    });
}
/**
 * Extracts every region-shaped structure the raw session encodes for a step, as
 * baseline/checkpoint pairs — either side of a pair may be `undefined`, for a caller to fill
 * in later (e.g. via `checkRegions` and the other functions below):
 *
 * - `regions` — domSelector-backed `Region[]`, from `annotations`. Only one side is ever
 *   populated here, since the raw session never encodes an `annotations`-shaped structure for
 *   both sides at once — `resolveDomIdSide` determines which side these domSelectors actually
 *   describe. `appOutputResolution[stepIndex].annotations`, when present, overrides
 *   `expectedAppOutput[stepIndex].annotations` entirely rather than being combined with it —
 *   the same way an empty category there means "resolved to have none" even when the
 *   baseline has one.
 * - `codedRegions` — `regionId`-backed `Region[]`, paired up from `identifiedRegions` (on
 *   `expectedAppOutput`/`appOutputResolution`, same override rule as `annotations` — always the
 *   baseline side) and `imageMatchSettings` (on `actualAppOutput` — always the checkpoint side).
 *   Only ever includes an entry that's defined on the checkpoint side — a baseline
 *   `identifiedRegions` entry with no matching checkpoint `regionId` is dropped entirely (see
 *   `pairCodedRegions`), so `checkpoint` is never `undefined` here, only `baseline`.
 *
 * Both `annotations` and `identifiedRegions` deliberately exclude `removedAnnotations` — a
 * historical record of past removals, not part of the current, effective region set.
 */
function getEffectiveRegions(rawSession, stepIndex) {
    const flatRegions = flattenCategoryBucket(rawSession?.appOutputResolution?.[stepIndex]?.annotations ??
        rawSession?.expectedAppOutput?.[stepIndex]?.annotations);
    const regionsOnBaseline = resolveDomIdSide('unchanged', rawSession, stepIndex) === 'baseline';
    const regions = flatRegions.map(({ category, region }) => regionsOnBaseline ? { category, baseline: region } : { category, checkpoint: region });
    const baselineCoded = flattenCategoryBucket(rawSession?.appOutputResolution?.[stepIndex]?.identifiedRegions ??
        rawSession?.expectedAppOutput?.[stepIndex]?.identifiedRegions);
    const checkpointCoded = flattenCategoryBucket(rawSession?.actualAppOutput?.[stepIndex]?.imageMatchSettings);
    return { regions, codedRegions: pairCodedRegions(baselineCoded, checkpointCoded) };
}
// ---------------------------------------------------------------------------
// Healing — filling in whichever side of a RegionPair the raw session doesn't encode
// ---------------------------------------------------------------------------
// findNodeBySelector/findNodeByRect return a nested {domSelector, rect} shape (DomNode);
// the Region shape needed elsewhere is flat (domSelector alongside left/top/width/height).
function toRegion$2(resolved) {
    return { domSelector: resolved.domSelector, ...resolved.rect };
}
/**
 * Splits every incomplete `RegionPair` (missing one side — see `getEffectiveRegions`) into
 * anchored/non-anchored, verifying each anchored candidate's `domSelector` against `domSource`
 * (the DOM of whichever side is already populated) along the way. Purely a classification —
 * nothing is mutated, so a caller that just wants to inspect a step's regions as currently
 * encoded (e.g. `eyes-inspect`'s `regions` command) can call this without side effects: a
 * stale `domSelector` (one that no longer resolves) lands in `nonAnchored` exactly as encoded,
 * not cleared — only a caller that intends to *heal* it (see `clearStaleSelectors`, below)
 * should clear it. `anchored` means "has a `domSelector` that actually resolved" — if
 * `domSource` is `null` (couldn't be fetched), nothing can be verified, so every pair lands in
 * `nonAnchored`, domSelector or not.
 */
function checkRegions(regions, domSource) {
    const anchored = [];
    const nonAnchored = [];
    for (const pair of regions) {
        if (pair.baseline && pair.checkpoint)
            continue; // already complete — nothing to check
        const region = (pair.baseline ?? pair.checkpoint);
        if (domSource && region.domSelector && findNodeBySelector(domSource, region.domSelector)) {
            anchored.push(pair);
        }
        else {
            nonAnchored.push(pair); // no domSelector, a stale one, or nothing to verify against at all
        }
    }
    return { anchored, nonAnchored };
}
/**
 * Clears the `domSelector` (mutating in place) of every pair in `nonAnchored` that still has
 * one — i.e. a stale one `checkRegions` left untouched — so it can be retried by
 * `healNonAnchoredRegionsBySourceRect`. A stale selector is never sent to
 * get-compatible-selectors as-is: live-confirmed against the real API, a single bad input
 * selector fails the *entire* batched call, not just itself. Returns whether anything was
 * actually cleared. Only a caller that intends to re-anchor a region calls this (e.g.
 * `eyes-resolve`'s `resolveStepFlow`) — a caller that just wants to inspect regions as encoded
 * (`checkRegions`'s other caller) should leave a stale selector alone for diagnosis rather
 * than heal past it.
 */
function clearStaleSelectors(nonAnchored) {
    let changed = false;
    for (const pair of nonAnchored) {
        const region = pair.baseline ?? pair.checkpoint;
        if (region?.domSelector) {
            region.domSelector = '';
            changed = true;
        }
    }
    return changed;
}
/**
 * Attempts to anchor each `nonAnchored` pair by finding its region's rect on `domSource` — the
 * same mechanism a brand-new rect-form region uses to upgrade into a domSelector-backed one.
 * Mutates a healed pair's existing (source-side) region in place with the found `domSelector`
 * and accurate rect; a pair with no match is left as a plain rect, unchanged. Returns whether
 * anything was healed. Pure and synchronous — `domSource` must already be fetched.
 */
function healNonAnchoredRegionsBySourceRect(nonAnchored, domSource) {
    if (!domSource)
        return false;
    let changed = false;
    for (const pair of nonAnchored) {
        const sourceSide = pair.baseline ? 'baseline' : 'checkpoint';
        const found = findNodeByRect(domSource, pair[sourceSide]);
        if (found) {
            pair[sourceSide] = toRegion$2(found);
            changed = true;
        }
    }
    return changed;
}
/**
 * Fills in whichever side of each `RegionPair` is still missing with a plain, unanchored
 * copy of its populated side — same rect, no `domSelector`. This doesn't try to find or heal
 * anything (unlike every other function above); it just guarantees every pair comes out with
 * both sides present, for a caller (`eyes-inspect`'s `regions` command) that wants a
 * consistently-shaped, fully "mapped" output to inspect rather than an occasionally-partial
 * one. Once this runs, a `domSelector` present on one side but empty on the other is itself
 * diagnostically meaningful — it means that side's `domSelector` is stale, or the anchoring
 * element genuinely doesn't exist there (get-compatible-selectors mapped it to `null`) —
 * rather than being an accident of the pair simply never having been looked at.
 */
function fillMissingSideWithPlainRect(regions) {
    for (const pair of regions) {
        if (pair.baseline && pair.checkpoint)
            continue;
        const region = (pair.baseline ?? pair.checkpoint);
        const missingSide = pair.baseline ? 'checkpoint' : 'baseline';
        pair[missingSide] = { ...region, domSelector: '' };
    }
}
/**
 * The coded-region counterpart to `fillMissingSideWithPlainRect` — but one-directional, since
 * `checkpoint` is never missing to begin with on a coded `RegionPair` (see
 * `pairCodedRegions`/`getEffectiveRegions`): only `baseline` ever needs filling. Fills it with a
 * plain copy of `checkpoint` at the same rect, with `regionId` cleared to `''`, rather than
 * leaving it `undefined`.
 */
function fillMissingBaselineForCodedRegions(codedRegions) {
    for (const pair of codedRegions) {
        if (pair.baseline)
            continue;
        pair.baseline = { ...pair.checkpoint, regionId: '' };
    }
}
/**
 * Finds an existing region "the same" as `candidate`: an exact `domSelector` match
 * (checked across all candidates first — the stronger signal, survives rect drift), or
 * else a rect match within `tolerancePx` on all four of left/top/width/height. Searches
 * across every category, not just the one `candidate` belongs to, so a region that's been
 * reclassified (e.g. layout -> ignore) is still found and replaced rather than duplicated.
 */
function findSimilarExistingRegion(existing, candidate, tolerancePx = 5) {
    for (const entry of existing) {
        if (candidate.domSelector && entry.region.domSelector && candidate.domSelector === entry.region.domSelector) {
            return entry;
        }
    }
    for (const entry of existing) {
        const r = entry.region;
        if (Math.abs(r.left - candidate.left) <= tolerancePx &&
            Math.abs(r.top - candidate.top) <= tolerancePx &&
            Math.abs(r.width - candidate.width) <= tolerancePx &&
            Math.abs(r.height - candidate.height) <= tolerancePx) {
            return entry;
        }
    }
    return null;
}
/**
 * Removes (in place) the entry in `entries` "similar" to `candidate` (see
 * `findSimilarExistingRegion`), if any, returning the removed entry — or `null` if nothing
 * matched, so a caller can report exactly what was actually removed (e.g. for a `-<matchLevel>-
 * <target>` regionOp) rather than just whether something was.
 *
 * Live-confirmed against the real API: the `stepUpdates[].annotations` field is a full
 * replacement of the resolution's active regions, not a delta merged against whatever's
 * already stored — and `removedAnnotations` isn't actually used for removal at all (the
 * real Test Manager UI sends it as an empty skeleton even when deleting a region). So the
 * only correct way to add/remove a region is to fetch the current full set, mutate it
 * in memory (this function, plus a plain `.push` for adds), and send the *entire* result
 * back as `annotations` — see eyes-resolve's `resolveStepFlow`.
 */
function removeSimilarRegion(entries, candidate, tolerancePx = 5) {
    const match = findSimilarExistingRegion(entries, candidate, tolerancePx);
    if (!match)
        return null;
    entries.splice(entries.indexOf(match), 1);
    return match;
}
/** Buckets a flat, category-tagged region list back into the category-keyed shape the API expects. */
function bucketRegions(entries) {
    const result = emptyAnnotations();
    for (const entry of entries) {
        result[entry.category].push(entry.region);
    }
    return result;
}

/**
 * Whether a raw session currently has any pending, unsaved change — an accept/reject decision
 * or a region edit not yet committed via `save`. Checks every step's own
 * `appOutputResolution[i].isChanged` flag (the same signal each step's own `isUnsaved` below is
 * derived from), not the raw session's own top-level `isModified` field — confirmed live:
 * `isModified` is sticky, staying `true` forever once a session was ever changed, even long
 * after that change was fully cleared (e.g. via a batch-wide reset), so it can't signal "has a
 * pending change right now." Independent of whether `simplifySession` was asked to compute
 * `steps` — this reads `appOutputResolution` directly, so it's correct either way.
 */
function hasUnsavedChanges(rawData) {
    const appOutputResolution = rawData.appOutputResolution ?? [];
    return appOutputResolution.some((entry) => entry?.isChanged === true);
}
/**
 * Whether `stepIndex`'s checkpoint already carries a human accept/reject decision — the same
 * `resolution` a step gets in `simplifySession` below, pulled out standalone so a caller only
 * needs one step's status without shaping (or paying for) the whole session's `steps` array.
 * A resolution entry can exist purely from a region edit, with no accept/reject decision behind
 * it (no `replaceExpected` field) — only a real boolean there counts as resolved, however each
 * side originally read.
 */
function getStepResolution(rawData, stepIndex) {
    const resolutionEntry = rawData?.appOutputResolution?.[stepIndex];
    return typeof resolutionEntry?.replaceExpected === 'boolean'
        ? resolutionEntry.replaceExpected
            ? 'accepted'
            : 'rejected'
        : 'none';
}
/**
 * Extracts a raw session's scenario id — the join key for the session-history query (see
 * `api`'s `fetchSessionHistory`) — confirmed live as a top-level `scenarioId` field,
 * distinct from `scenarioName` (already mapped to `SimplifiedSession.sessionName`). Throws
 * rather than returning `undefined` so a caller building a history query fails loudly instead
 * of silently querying with a bad/missing id.
 */
function extractScenarioId(rawData) {
    const scenarioId = rawData?.scenarioId;
    if (typeof scenarioId !== 'string' || !scenarioId) {
        throw new Error('Raw session has no scenarioId field — cannot look up its session history.');
    }
    return scenarioId;
}
/**
 * Throws a clear "step index N is out of range" error if `stepIndex` doesn't correspond to an
 * actual step in the raw session. Callers that work from the raw, unshaped session directly
 * (unlike this module's own `simplifySession`, which already has a bounds-checked `steps`
 * array) would otherwise silently index past the end of `expectedAppOutput`/`actualAppOutput`
 * and read `undefined` — which `validateDomId` then reports as "this step has no DOM capture",
 * indistinguishable from a real step that simply wasn't DOM-captured.
 */
function validateStepIndex(rawSession, stepIndex) {
    const stepCount = getStepCount(rawSession);
    if (stepIndex < 0 || stepIndex >= stepCount) {
        throw new Error(`Step index ${stepIndex} is out of range (session has ${stepCount} steps)`);
    }
}
/** Total step count for a raw session — the longer of its baseline/checkpoint image arrays. */
function getStepCount(rawSession) {
    return Math.max(rawSession?.expectedAppOutput?.length ?? 0, rawSession?.actualAppOutput?.length ?? 0);
}
function simplifySession(rawData, options) {
    let steps = null;
    if (options?.includeSteps ?? true) {
        steps = [];
        const expectedOutputs = rawData.expectedAppOutput || [];
        const actualOutputs = rawData.actualAppOutput || [];
        const appOutputResolution = rawData.appOutputResolution || [];
        for (let i = 0; i < Math.max(expectedOutputs.length, actualOutputs.length); i++) {
            const expected = expectedOutputs[i];
            const actual = actualOutputs[i];
            if (!expected && !actual)
                continue;
            const tag = actual?.tag;
            const isMatching = actual?.isMatching ?? false;
            const resolution = getStepResolution(rawData, i);
            const resolutionEntry = appOutputResolution[i];
            steps.push({
                tag,
                baseline: {
                    id: expected?.image?.id ?? null,
                    domId: expected?.image?.domId ?? null,
                    size: expected?.image?.size ?? null,
                },
                checkpoint: {
                    id: actual?.image?.id ?? null,
                    domId: actual?.image?.domId ?? null,
                    size: actual?.image?.size ?? null,
                },
                isMatching,
                resolution,
                isUnsaved: resolutionEntry?.isChanged === true,
            });
        }
    }
    const env = rawData.env ?? {};
    return {
        sessionId: rawData.id,
        sessionName: rawData.scenarioName,
        appName: rawData.appName,
        status: rawData.status,
        isUnsaved: hasUnsavedChanges(rawData),
        isAborted: rawData.isAborted === true,
        environment: {
            browser: env.hostingApp ?? null,
            device: env.deviceInfo ?? null,
            os: env.os ?? null,
            width: env.displaySize?.width ?? null,
            height: env.displaySize?.height ?? null,
        },
        startedAt: rawData.startedAt,
        steps,
    };
}

// Dashboard route tokens under `/app/`. `testResults` is the canonical route the backend puts in
// reports, emails, and CI integrations; `batches` is what the Eyes server itself returns as a
// run's session URL — so it is the form a test run prints to the console and the form a user
// pastes first; `baselines` names a baseline revision, not a batch/session pair.
const APP_ROUTES = { testResults: 'test-results', batches: 'batches', baselines: 'baselines' };
const escapeForRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Regex source for the `/app/<route>/` prefix of any batch-addressing dashboard URL.
// If a future route is a prefix of another, order longest-first (alternation is leftmost-match).
const BATCH_ROUTE_PREFIX_SOURCE = `\\/app\\/(?:${[APP_ROUTES.testResults, APP_ROUTES.batches]
    .map(escapeForRegExp)
    .join('|')})\\/`;
// Everything after the two ids is a dashboard view (`/steps/{N}`, `/steps/{N}/edit`) that names
// no separate entity, so it is matched only to be discarded.
const BATCH_PATH = new RegExp(`${BATCH_ROUTE_PREFIX_SOURCE}([^/?#]+)(?:\\/([^/?#]+))?`);
// Route segments the dashboard puts directly after a batch id. Excluded by name because they sit
// in the position a session id would occupy, and a `steps` mistaken for a session id reaches the
// API as a real lookup.
const ROUTE_SEGMENTS = new Set(['steps', 'edit']);
// A baseline URL carries a baseline id and revision, not a batch/session pair, so no amount of
// permissiveness makes it parseable here — it needs its own message or the caller retries blind.
const BASELINE_PATH = new RegExp(`\\/app\\/${escapeForRegExp(APP_ROUTES.baselines)}\\/`);
const ACCEPTED_FORMS = `Accepted: https://<host>/app/${APP_ROUTES.testResults}/{batchId}[/{sessionId}[/steps/{N}]]?accountId=…, ` +
    `or the https://<host>/app/${APP_ROUTES.batches}/{batchId}/{sessionId}?accountId=… form an SDK run prints.`;
/**
 * Parses an Applitools dashboard URL (session or batch) into its components.
 * Accepts any of the `APP_ROUTES` batch-addressing routes; rejections name the
 * accepted forms so the caller can correct the URL without guessing.
 * Does not require a sessionId to be present — use parseSessionUrl/parseBatchUrl
 * for callers that need to enforce one shape or the other.
 */
function parseApplitoolsUrl(url) {
    const urlMatch = url.match(/^(https?:\/\/[^/]+)/);
    if (!urlMatch)
        throw new Error(`Invalid URL format: "${url}". ${ACCEPTED_FORMS}`);
    if (BASELINE_PATH.test(url)) {
        throw new Error(`"${url}" is a baseline URL, which names a baseline revision rather than a batch or session. ${ACCEPTED_FORMS}`);
    }
    const batchMatch = url.match(BATCH_PATH);
    if (!batchMatch)
        throw new Error(`Invalid URL format: "${url}". ${ACCEPTED_FORMS}`);
    const accountIdMatch = url.match(/accountId=([^&#]+)/);
    if (!accountIdMatch)
        throw new Error(`Missing accountId in URL: "${url}"`);
    const [, batchId, segmentAfterBatch] = batchMatch;
    const sessionId = segmentAfterBatch && !ROUTE_SEGMENTS.has(segmentAfterBatch) ? segmentAfterBatch : null;
    return { baseUrl: urlMatch[1], batchId, sessionId, accountId: accountIdMatch[1] };
}
/** Throws if the URL doesn't include a sessionId segment (i.e. it's a batch-only URL). */
function parseSessionUrl(url) {
    const parsed = parseApplitoolsUrl(url);
    if (!parsed.sessionId) {
        throw new Error('The input URL is a batch URL while a session URL is expected.');
    }
    return parsed;
}
/** Batch-scoped: parses the batchId/accountId and always forces sessionId to null, ignoring any session segment. */
function parseBatchUrl(url) {
    const parsed = parseApplitoolsUrl(url);
    return { ...parsed, sessionId: null };
}

// Same convention as core-base's reqEyes: `expected` is enforced by an afterResponse hook, so
// call sites branch only on the statuses that carry meaning for them.
function handleUnexpectedResponse() {
    return {
        async afterResponse({ request, response, options }) {
            const expected = options?.expected;
            if (expected === undefined)
                return;
            if (Array.isArray(expected) ? expected.includes(response.status) : expected === response.status)
                return;
            const body = await response
                .clone()
                .text()
                .catch(() => '');
            const message = `Request "${options?.name ?? request.url}" failed due to unexpected status ` +
                `${response.statusText}(${response.status})${body ? ` and body "${body}"` : ''}`;
            options?.logger?.error(message);
            throw new Error(message);
        },
    };
}
// req counts retries by mutating `attempt` on the very `Retry` object it was handed, and never
// resets it: `mergeOptions` rebuilds the retry *array* per request, but `[].concat(obj)` copies the
// element reference, so one literal shared across requests is one budget shared across requests —
// after `limit` cumulative retries every later request is silently fire-once, and before that a
// fresh request's first backoff is read from the climbed index (3200 ms instead of 200 ms).
// `afterOptionsMerged` runs once per request on that request's own merged options, so replacing the
// retry entries with fresh copies there makes the budget per-request no matter how long the
// instance that carries the policy lives.
function isolateRetryPerRequest() {
    return {
        afterOptionsMerged({ options }) {
            if (!options.retry)
                return;
            const retries = Array.isArray(options.retry) ? options.retry : [options.retry];
            return { ...options, retry: retries.map(retry => ({ ...retry, attempt: undefined })) };
        },
    };
}
/**
 * Builds a configured `req` — core-base's `makeReqEyes` concept adapted to this package: the
 * instance owns the server URL, the `apiKey` query parameter, the transient-retry policy, and the
 * `expected`-status convention above, so api functions take the configured req plus business
 * parameters and never thread baseUrl/apiKey/transport themselves. Flat options on purpose: an api
 * function's own deps spread straight in — `makeReqResults({serverUrl, apiKey, ...deps})`.
 *
 * **Build one per call, not one per module.** Every call site here does (`api/dom-diff.ts`,
 * `api/dom-fetch.ts`, `api/tasks.ts`, `api/polling.ts`'s `reqTransport`), because req's retry
 * counter lives on the retry object the instance carries — see `isolateRetryPerRequest` above for
 * what that costs a long-lived instance. That hook is what actually guarantees the budget is
 * per-request, so hoisting an instance is safe rather than silently degrading; per-call
 * construction stays the convention because it also keeps the apiKey and server URL scoped to the
 * flow that resolved them. `test/api/req-results.test.ts`'s "retry isolation" suite makes several
 * calls through a single instance and pins both properties.
 */
function makeReqResults({ serverUrl, apiKey, fetch, logger }) {
    return req.makeReq({
        baseUrl: serverUrl,
        query: { apiKey },
        retry: {
            limit: 5,
            timeout: [200, 400, 800, 1600, 3200],
            // 500/503 deliberately excluded: on a task-status probe they are terminal contract signals
            // (503 = task rejected), not transient blips — they must surface immediately.
            statuses: [429, 502, 504],
            codes: ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN', 'ENOTFOUND'],
        },
        // core-base reqEyes's defaults. Callers cap attempts, not wall-clock, so a stalled request
        // needs its own timeout to not hang forever.
        requestTimeout: 30000,
        connectionTimeout: 300000,
        hooks: [isolateRetryPerRequest(), handleUnexpectedResponse()],
        fetch,
        logger,
    });
}

/**
 * The older api modules' transport seam — a fresh `makeReqResults` instance per invocation, the
 * DOM-diff flow's conventions (standard retry policy, explicit request/connection timeouts). The
 * full retry budget every request gets is guaranteed by `makeReqResults` itself
 * (`isolateRetryPerRequest`), not by this per-invocation build; building here keeps one shape
 * across the package and scopes the resolved server URL to the request it came from.
 * These modules bake the apiKey into their URLs themselves, so it is read back out of the URL
 * here rather than threaded separately; no `expected` statuses are passed, so the instance's
 * unexpected-status hook stays inert and the modules' own status checks remain in charge. Only
 * how a single request executes lives here: the task flow (202/Location → status → result),
 * JSON parsing, and error wording all stay above it.
 */
const reqTransport = (url, init) => {
    const { origin, searchParams } = new URL(url);
    const req = makeReqResults({ serverUrl: origin, apiKey: searchParams.get('apiKey') ?? '' });
    return req(url, (init ?? {}));
};
/** POST a JSON body. */
async function postJson(url, body, fetchImpl = reqTransport) {
    return fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
/** GET and parse a JSON response, throwing a descriptive error on a non-ok status. */
async function getJson(url, fetchImpl = reqTransport) {
    const response = await fetchImpl(url);
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
    }
    // 204 carries no body; the step-diff endpoint answers one for a step with no diff data.
    if (response.status === 204)
        return undefined;
    return response.json();
}
/**
 * A `Location` header may legally be relative (RFC 9110) and Node's fetch rejects relative URLs,
 * so resolve it against the URL of the request that produced it. An absolute location needs no
 * base; a relative one without a base is unusable — fail here, naming the value, rather than as
 * an opaque invalid-URL error from the fetch that would have consumed it.
 */
function resolveLocation(location, base) {
    if (base)
        return new URL(location, base).toString();
    if (URL.canParse(location))
        return location;
    throw new Error(`Cannot resolve relative Location header "${location}" — no request URL to resolve it against`);
}
/** Parses a response body as JSON, tolerating an empty body (e.g. a 204) by returning `undefined` instead of throwing on `JSON.parse('')`. */
async function parseJsonBody(response) {
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
}
/**
 * Polls a job-status URL until it reports done, then fetches and returns the job's result.
 * Confirmed live against the real API — for every async endpoint checked so far (`images/find`,
 * `sessions/batches/{batchId}/updates`), not just the ones that produce a real payload — a
 * `201` isn't itself the result: it carries its *own* `Location` header (distinct from the
 * original 202's) pointing at a separate result URL, which resolves with either a real JSON
 * body (`images/find`) or an empty one (`updates`, `save`, etc. — a 204). Both are handled
 * uniformly here; a caller with nothing to do with the result just ignores the return value.
 * 200 = still running (wait and retry), anything else on the status poll = error.
 */
async function pollUntilResult(statusUrl, apiKey, fetchImpl = reqTransport, sleepFn = ms => new Promise(resolve => setTimeout(resolve, ms))) {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
        const sep = statusUrl.includes('?') ? '&' : '?';
        const response = await fetchImpl(`${statusUrl}${sep}apiKey=${encodeURIComponent(apiKey)}`);
        if (response.status === 200) {
            await sleepFn(1000);
            continue;
        }
        if (response.status === 201) {
            const location = response.headers.get('Location');
            if (!location) {
                throw new Error('Job finished (201) but no result Location header was returned');
            }
            // `response.url` is the post-redirect URL when populated, but is '' under req's HTTP/2
            // rewrap — fall back to the URL this poll actually requested.
            const resultUrl = resolveLocation(location, response.url || statusUrl);
            const resultSep = resultUrl.includes('?') ? '&' : '?';
            const resultResponse = await fetchImpl(`${resultUrl}${resultSep}apiKey=${encodeURIComponent(apiKey)}`);
            if (!resultResponse.ok) {
                const text = await resultResponse.text().catch(() => '');
                throw new Error(`Failed to fetch job result: ${resultResponse.status} ${resultResponse.statusText}${text ? ` — ${text}` : ''}`);
            }
            return parseJsonBody(resultResponse);
        }
        throw new Error(`Unexpected poll status: ${response.status} ${response.statusText}`);
    }
    throw new Error('Polling timed out after 60 attempts');
}
/**
 * Handles the Eyes dashboard's async-job response convention end to end: a `202` with a
 * `Location` header means the job is running and is polled via `pollUntilResult` through to
 * its actual result; a plain ok response is parsed as JSON directly (tolerating an empty
 * body). One function for every endpoint, whether or not its result is ever read — a caller
 * that only cares that the call succeeded (e.g. `accept`/`reject`/`save`) just discards the
 * return value instead of needing a separate "no result expected" variant.
 *
 * `requestUrl` backs up `response.url` as the base for a relative Location: `response.url` is
 * '' under req's HTTP/2 rewrap, so callers pass the URL they requested.
 */
async function getJsonResult(response, apiKey, fetchImpl = reqTransport, sleepFn, requestUrl) {
    if (response.status === 202) {
        const location = response.headers.get('Location');
        if (!location) {
            throw new Error('Job started (202) but no status Location header was returned');
        }
        return pollUntilResult(resolveLocation(location, response.url || requestUrl), apiKey, fetchImpl, sleepFn);
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
    }
    return parseJsonBody(response);
}

const TASK_STATUS_PATH = (taskId) => `/api/tasks/${taskId}/status`;
const TASK_RESULT_PATH = (taskId) => `/api/tasks/${taskId}/result`;
/** Extracts the taskId out of a submit response's `Location` (`/api/tasks/{taskId}/status`). */
function taskIdFromLocation(location) {
    const match = location.match(/\/api\/tasks\/([^/?]+)\/status/);
    if (!match)
        throw new Error(`Location does not name a task-status URL: ${location}`);
    return match[1];
}
/**
 * One probe of a task's status — no client-side polling loop: `running` hands the taskId back so
 * the caller decides when (and whether) to check again; `201` means done, and the result the
 * response's `Location` points at is fetched and returned in the same call, so a ready task never
 * costs the caller a second round trip. `404` (unknown or expired task) is terminal and throws
 * with the contract's own wording. A *rejected* task also finishes as `201` here — its rejection
 * surfaces as `503` on the result fetch (TasksController puts it there, not on status); transient
 * transport failures are the configured req's standard retry policy, not handled here.
 */
async function getTaskStatus(baseUrl, taskId, keys, deps = {}) {
    const req = makeReqResults({ serverUrl: baseUrl, apiKey: keys.getReadKey(), ...deps });
    const response = await req(TASK_STATUS_PATH(taskId), {
        name: 'getTaskStatus',
        expected: [200, 201, 404],
    });
    if (response.status === 200)
        return { status: 'running', taskId };
    if (response.status === 201) {
        const resultUrl = response.headers.get('Location') ?? TASK_RESULT_PATH(taskId);
        return { status: 'ready', result: await fetchTaskResult(baseUrl, resultUrl, keys, deps) };
    }
    throw new Error(`Unknown or expired task: ${taskId}`);
}
/**
 * Fetches a finished task's result and parses it as JSON. The response is gzipped on the wire
 * when the request advertises `Accept-Encoding` — the transport negotiates and decompresses that
 * transparently, so no explicit gunzip step exists here (unlike endpoints that return a gzip
 * *body*, e.g. `fetchPrunedDom`). `503` is the result endpoint's "task rejected" — terminal by
 * the task contract (and excluded from the retry policy for exactly that reason), thrown with
 * the contract's own wording.
 */
async function fetchTaskResult(baseUrl, resultUrl, keys, deps = {}) {
    const req = makeReqResults({ serverUrl: baseUrl, apiKey: keys.getReadKey(), ...deps });
    const response = await req(resultUrl, { name: 'fetchTaskResult', expected: [200, 503] });
    if (response.status === 503)
        throw new Error(`Task rejected by the server: ${resultUrl}`);
    return response.json();
}

const defaultFsCacheDeps = {
    readFile: p => (fs__namespace.existsSync(p) ? fs__namespace.readFileSync(p, 'utf8') : null),
    writeFile: (p, contents) => fs__namespace.writeFileSync(p, contents),
    cacheDir: os__namespace.tmpdir(),
};
/**
 * Builds a content-addressed cache file path, sanitizing `key` the same way the
 * repo's existing cache-file naming already does (only `~`/`,` need escaping —
 * these characters can appear in Applitools image/dom ids and are not filesystem-safe).
 */
function cacheFilePath(deps, prefix, key, ext = 'json') {
    const safeKey = key.replace(/[~,]/g, '_');
    // path.posix.join (not path.join) so the result is deterministic across platforms —
    // Node's fs APIs accept forward slashes on Windows too.
    return path__namespace.posix.join(deps.cacheDir, `${prefix}-${safeKey}.${ext}`);
}

/** Promisified zlib.gunzip. Rejects if the input isn't valid gzip data — callers decide the fallback. */
function gunzip(buffer) {
    return new Promise((resolve, reject) => {
        zlib__namespace.gunzip(buffer, (err, result) => {
            if (err)
                reject(err);
            else
                resolve(result);
        });
    });
}

const PRUNED_DOM_PATH = (domId) => `/api/images/dom/${domId}/pruned`;
const defaultFetchPrunedDomDeps = {
    ...defaultFsCacheDeps,
};
/**
 * Fetches (or reads from cache) an Applitools DOM snapshot already pruned server-side: URLs
 * normalized, node ids assigned, metadata fields and whitespace-only text nodes gone. Same
 * `eyes-<domId>` cache entry a client-side pruner writes, so entries stay valid either way.
 * Takes no `area` — cropping is a separate, uncached step (`sessions/dom`'s `getDomArea`).
 *
 * The 200 body may be a gzip payload (a gzip *body*, not `Content-Encoding` — which the
 * transport already undoes transparently), so it's gunzipped when it is one and parsed as-is
 * when it isn't. Any non-200 throws via the configured req's expected-status hook, carrying the
 * request name, status, and response body.
 */
async function fetchPrunedDom(options, deps = defaultFetchPrunedDomDeps) {
    const { baseUrl, domId, keys } = options;
    const cachePath = cacheFilePath(deps, 'eyes', domId, 'json');
    const cached = deps.readFile(cachePath);
    if (cached !== null)
        return JSON.parse(cached);
    const req = makeReqResults({ serverUrl: baseUrl, apiKey: keys.getReadKey(), ...deps });
    const response = await req(PRUNED_DOM_PATH(domId), { name: 'fetchPrunedDom', expected: 200 });
    const buffer = node_buffer.Buffer.from(await response.arrayBuffer());
    let text;
    try {
        text = (await gunzip(buffer)).toString('utf8');
    }
    catch {
        text = buffer.toString('utf8'); // not a gzip body — already plain (or transport-decompressed)
    }
    const prunedDom = JSON.parse(text);
    deps.writeFile(cachePath, JSON.stringify(prunedDom));
    return prunedDom;
}

const DOM_DIFF_PATH = '/api/images/dom/diff';
const defaultFetchDomDiffDeps = {
    ...defaultFsCacheDeps,
};
/**
 * Fetches (or reads from cache) the alignment of two DOM snapshots, computed server-side. The
 * request carries the two domIds alone — the server resolves them against its own snapshot
 * storage, so no DOM travels either way — and a ready result is the compact `{matches, diff}`
 * alignment: `matches` is what lets a caller extract one node's own diff afterwards
 * (`sessions/dom`'s `extractNodeDiff`) without paying for a second alignment of the same pair.
 * Cropping to an area (`filterDiffToArea`), excluding non-visual entries
 * (`excludeNonVisualNodeDiffs`) and serializing (`serializeDiff`) all stay with the caller.
 *
 * No client-side polling: a 202 submit is probed once via `getTaskStatus`; if the task is still
 * running, the taskId is returned and the caller decides when to check again
 * (`checkDomDiffTask`). A direct 200 with the alignment body also parses — forward tolerance for
 * a server answering an already-computed pair synchronously; the current backend always answers
 * 202 (its async-task framework has no synchronous arm).
 *
 * Content-addressed cache, keyed on the two domIds alone — both are already immutable, unlike an
 * area or a step's match settings, so one ready alignment is reused across every caller of that
 * pair. A `running` outcome is never cached.
 *
 * Every alignment is shape-checked at this boundary before it is returned or cached — see
 * `assertDomAlignment`.
 */
async function fetchDomDiff(baseUrl, baselineDomId, checkpointDomId, keys, deps = defaultFetchDomDiffDeps) {
    const cachePath = domDiffCachePath(baselineDomId, checkpointDomId, deps);
    const cached = readCachedAlignment(cachePath, deps);
    if (cached)
        return { status: 'ready', alignment: cached };
    const req = makeReqResults({ serverUrl: baseUrl, apiKey: keys.getReadKey(), ...deps });
    const response = await req(DOM_DIFF_PATH, {
        name: 'fetchDomDiff',
        query: { baselineDomId, checkpointDomId },
        expected: [200, 202],
    });
    if (response.status === 202) {
        const location = response.headers.get('Location');
        if (!location)
            throw new Error('DOM diff task started (202) but no status Location header was returned');
        const taskId = taskIdFromLocation(location);
        const task = await getTaskStatus(baseUrl, taskId, keys, deps);
        return cacheIfReady(task, taskId, cachePath, deps);
    }
    const alignment = assertDomAlignment(await response.json(), DOM_DIFF_PATH, response.status);
    deps.writeFile(cachePath, JSON.stringify(alignment));
    return { status: 'ready', alignment };
}
/**
 * The caller's re-check for a `running` `fetchDomDiff` — one `getTaskStatus` probe, with a ready
 * alignment landing in the same domId-pair cache a direct fetch would have written, so later
 * calls for the pair stay cache hits regardless of which path produced the alignment.
 *
 * Cache-first, like `fetchDomDiff`: the pair may already be ready on disk (an earlier probe, or
 * any other caller of the same pair, landed it), and a cached pair must win even when the taskId
 * in hand has since expired — so a re-check with a stale taskId never fails on a result that's
 * already here.
 */
async function checkDomDiffTask(baseUrl, taskId, baselineDomId, checkpointDomId, keys, deps = defaultFetchDomDiffDeps) {
    const cachePath = domDiffCachePath(baselineDomId, checkpointDomId, deps);
    const cached = readCachedAlignment(cachePath, deps);
    if (cached)
        return { status: 'ready', alignment: cached };
    const task = await getTaskStatus(baseUrl, taskId, keys, deps);
    return cacheIfReady(task, taskId, cachePath, deps);
}
function domDiffCachePath(baselineDomId, checkpointDomId, deps) {
    const cacheKey = crypto__namespace.createHash('sha256').update(`${baselineDomId}:${checkpointDomId}`).digest('hex').slice(0, 16);
    return cacheFilePath(deps, 'eyes-dom-diff', cacheKey, 'json');
}
function cacheIfReady(task, taskId, cachePath, deps) {
    if (task.status === 'running')
        return task;
    const alignment = assertDomAlignment(task.result, TASK_RESULT_PATH(taskId), 200);
    deps.writeFile(cachePath, JSON.stringify(alignment));
    return { status: 'ready', alignment };
}
/**
 * Reads a cached alignment, treating an unusable entry (unparseable, or not alignment-shaped) as a
 * miss rather than a failure: the cache is content-addressed and reproducible, so re-fetching the
 * pair and overwriting is always safe — whereas the alternative is a truncated or old-shape file
 * (an interrupted write, a pre-`assertDomAlignment` cache) failing every future call for that pair
 * forever, since the entry has no TTL and nothing else would ever replace it.
 */
function readCachedAlignment(cachePath, deps) {
    const cached = deps.readFile(cachePath);
    if (cached === null)
        return null;
    try {
        const parsed = JSON.parse(cached);
        return isDomAlignment(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
function isDomAlignment(value) {
    const candidate = value;
    return (typeof candidate === 'object' &&
        candidate !== null &&
        typeof candidate.matches === 'object' &&
        candidate.matches !== null &&
        // An array is a `typeof 'object'` too, and `matches` is looked up by nodeId — every lookup in an
        // array misses, so `{matches: [], diff: []}` would cache as a permanently valid-looking
        // alignment that answers `found: false` for every node instead of failing here.
        !Array.isArray(candidate.matches) &&
        Array.isArray(candidate.diff));
}
/**
 * Guards the one cast that asserts the wire shape. The backend's aligner is a byte-identical port
 * of the client engine this package used to carry, and these types were verified field-for-field
 * against its own fixture suite, so a healthy server can't produce anything else — but the pair
 * cache has no TTL, so a single `null`, `{}` or old-shape 200 that got through would be persisted
 * and then returned as a ready alignment for good, not just for this run. Worse, it surfaces far
 * from here: `extractNodeDiff` opens with `targetNodeId in alignment.matches`, so a bad value
 * becomes `TypeError: Cannot use 'in' operator` inside `sessions/dom.ts` with nothing naming the
 * endpoint that produced it. Checking the two fields every consumer reads keeps such a response
 * out of the cache and names the endpoint and status in the failure instead.
 */
function assertDomAlignment(value, endpoint, status) {
    if (!isDomAlignment(value)) {
        throw new Error(`${endpoint} (${status}) did not return a DOM alignment — expected an object with ` +
            `\`matches\` and \`diff\`, got ${preview(value)}`);
    }
    return value;
}
/** A bounded rendering of an unexpected body — enough to recognize it in a log, never the whole
 * response (an old-shape alignment would be megabytes). */
function preview(value) {
    if (value === undefined)
        return 'undefined';
    const json = JSON.stringify(value) ?? String(value);
    return json.length > 200 ? `${json.slice(0, 200)}…` : json;
}

/**
 * A step's checkpoint screenshot, as a raw PNG buffer — a binary response, so this calls `fetch`
 * directly rather than through `postJson`/`getJson` (which assume JSON), the one documented
 * exception among `api/`'s REST wrappers.
 */
async function fetchCheckpointImage(options, fetchImpl = reqTransport) {
    const { baseUrl, batchId, sessionId, stepIndex, accountId, keys, area } = options;
    const apiStepIndex = stepIndex + 1; // images/checkpoint uses 1-based step index (matches UI URL /steps/N convention)
    const path = area
        ? `/api/sessions/batches/${batchId}/${sessionId}/steps/${apiStepIndex}/images/checkpoint.clip(${area.left};${area.top};${area.width};${area.height})`
        : `/api/sessions/batches/${batchId}/${sessionId}/steps/${apiStepIndex}/images/checkpoint`;
    const url = `${baseUrl}${path}?accountId=${accountId}&apiKey=${encodeURIComponent(keys.getReadKey())}`;
    const response = await fetchImpl(url);
    if (!response.ok)
        throw new Error(`Failed to fetch checkpoint image: ${response.status} ${response.statusText}`);
    return node_buffer.Buffer.from(await response.arrayBuffer());
}
/** A baseline or checkpoint screenshot by its own image id, as a raw PNG buffer — same binary-response exception as `fetchCheckpointImage`. */
async function fetchImageById(options, fetchImpl = reqTransport) {
    const { baseUrl, imageId, keys, area } = options;
    let path = `/api/images/${imageId}`;
    if (area)
        path += `.clip(${area.left};${area.top};${area.width};${area.height})`;
    const url = `${baseUrl}${path}?apiKey=${encodeURIComponent(keys.getReadKey())}`;
    const response = await fetchImpl(url);
    if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    return node_buffer.Buffer.from(await response.arrayBuffer());
}

/** Fetches the raw Eyes session API response — no shaping. */
async function fetchRawSession(options, fetchImpl = reqTransport) {
    const { baseUrl, batchId, sessionId, accountId, keys } = options;
    const url = `${baseUrl}/api/sessions/batches/${batchId}/${sessionId}?accountId=${accountId}&apiKey=${encodeURIComponent(keys.getReadKey())}`;
    return getJson(url, fetchImpl);
}
/** Fetches a session and shapes it via `sessions/session`'s `simplifySession`. */
async function fetchSession(options, fetchImpl = reqTransport) {
    return simplifySession(await fetchRawSession(options, fetchImpl));
}
/**
 * Fetches the raw list of sessions in a batch — no shaping.
 * Normalizes the response shape: the Eyes API returns either a bare array or `{ sessions: [...] }`.
 */
async function fetchRawBatchSessions(options, fetchImpl = reqTransport) {
    const { baseUrl, batchId, accountId, keys } = options;
    const url = `${baseUrl}/api/sessions/batches/${batchId}?accountId=${accountId}&apiKey=${encodeURIComponent(keys.getReadKey())}`;
    const data = await getJson(url, fetchImpl);
    return Array.isArray(data) ? data : data.sessions ?? [];
}
/**
 * Fetches the raw batch entity itself (name, timing, and — the reason this exists —
 * its server-maintained aggregate counts, shaped by `sessions/batch`'s `toBatchStats` —
 * see `BatchInfo` there) — a different endpoint from `fetchRawBatchSessions`, which lists
 * the batch's individual sessions. This aggregate is eventually consistent: it can lag
 * behind a resolve/save call by several seconds, unlike a session list (or anything derived
 * from one), which is always current.
 */
async function fetchBatchInfo(options, fetchImpl = reqTransport) {
    const { baseUrl, batchId, accountId, keys } = options;
    const url = `${baseUrl}/api/sessions/batches/${batchId}/batch?accountId=${accountId}&apiKey=${encodeURIComponent(keys.getReadKey())}`;
    return getJson(url, fetchImpl);
}

/**
 * Maps each of `selectors` from `image1`'s DOM to its structurally-equivalent selector on
 * `image2`'s DOM — e.g. translating a region's domSelector from a baseline to a checkpoint,
 * or the reverse. Returns one entry per input selector, in the same order; an entry is
 * `null` when no compatible element exists on `image2`.
 */
async function getCompatibleSelectors(options, image1, image2, selectors, fetchImpl = reqTransport) {
    const { baseUrl, accountId, keys } = options;
    const apiKey = keys.getReadKey();
    const url = `${baseUrl}/api/images/get-compatible-selectors?accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await postJson(url, { image1, image2, selectors }, fetchImpl);
    const data = await getJsonResult(response, apiKey, fetchImpl, undefined, url);
    return data.selectors;
}

/**
 * The cheap, already-computed two-way diff for one step, straight off the dashboard's own
 * `GET .../diff` endpoint — used whenever nothing about the step's effective match settings
 * differs from what the test actually ran with (see `eyes-inspect`'s `fetchDiffRects`, this
 * function's only caller, for when the more expensive `compareStep` path is needed instead).
 */
async function fetchStepDiff(options, fetchImpl = reqTransport) {
    const { baseUrl, batchId, sessionId, stepIndex, accountId, keys } = options;
    const url = `${baseUrl}/api/sessions/batches/${batchId}/${sessionId}/${stepIndex}/diff?accountId=${accountId}&apiKey=${encodeURIComponent(keys.getReadKey())}`;
    const data = await getJson(url, fetchImpl);
    return { image1: data?.image1 ?? [], image2: data?.image2 ?? [] };
}

/**
 * POSTs a batch of per-session step updates (accept/reject decisions, region changes) in one
 * call — confirmed live to accept multiple sessions at once, one entry per session id.
 */
async function postStepUpdates(options, stepUpdatesBySession, fetchImpl = reqTransport) {
    const { baseUrl, batchId, accountId, keys } = options;
    const apiKey = keys.getWriteKey();
    const apiUrl = `${baseUrl}/api/sessions/batches/${batchId}/updates?accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const updates = [...stepUpdatesBySession.entries()].map(([id, stepUpdates]) => ({ id, batchId, stepUpdates }));
    const response = await postJson(apiUrl, { updates }, fetchImpl);
    await getJsonResult(response, apiKey, fetchImpl, undefined, apiUrl);
}
/** Commits every pending accept/reject/region change in the batch to the baseline. The endpoint returns nothing useful to the caller — a resolved promise signals success. */
async function saveBaselines$1(options, fetchImpl = reqTransport) {
    const { baseUrl, batchId, accountId, keys } = options;
    const apiKey = keys.getWriteKey();
    const apiUrl = `${baseUrl}/api/sessions/batches/${batchId}/baselines?accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await postJson(apiUrl, undefined, fetchImpl);
    await getJsonResult(response, apiKey, fetchImpl, undefined, apiUrl);
}
/** Reverts a session's shared baseline object to the revision it originally ran against. */
async function restoreBaseline(options, fetchImpl = reqTransport) {
    const { baseUrl, accountId, baselineId, baselineRev, keys } = options;
    const apiKey = keys.getWriteKey();
    const url = `${baseUrl}/api/baselines/${baselineId}/${baselineRev}/restore?accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await postJson(url, undefined, fetchImpl);
    await getJsonResult(response, apiKey, fetchImpl, undefined, url);
}
/** Clears every given session's pending (unsaved) accept/reject/region resolution back to unresolved — a no-op, not an error, for a session with nothing pending. */
async function resetBatchSessions(options, sessionIds, fetchImpl = reqTransport) {
    const { baseUrl, batchId, accountId, keys } = options;
    const apiKey = keys.getWriteKey();
    const url = `${baseUrl}/api/sessions/batches/${batchId}/reset?accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await postJson(url, { ids: sessionIds }, fetchImpl);
    await getJsonResult(response, apiKey, fetchImpl, undefined, url);
}

/**
 * Searches every one of `targets` for each of `regions` — regions defined against
 * `sourceImage`'s own DOM or, since `domSelector` is optional, its raw rectangle — and returns
 * a map keyed by each target's `ImageRecord.id`. A target with no match at all is still present
 * in the map, with an empty array (its key is never omitted). When several regions are searched
 * at once, a target's array holds only the ones actually found there — there is no positional
 * correspondence to `regions`, so a caller distinguishes which one matched by comparing
 * `domSelector` back against the region it sent (both confirmed live: a single-region miss
 * comes back as `[]`; a two-region call with one hit and one miss comes back with exactly one
 * entry, the hit).
 *
 * Confirmed live to be an async job: the initial POST returns 202 with a `Location` header
 * to a status URL; polling that returns 201, but the result itself lives at a *second*,
 * separate URL given by that 201 response's own `Location` header — `getJsonResult`/
 * `pollUntilResult` (`./polling.js`) handle this double-redirect.
 */
async function findRegionsInImages(sourceImage, regions, targets, options, fetchImpl = reqTransport, sleepFn) {
    const { baseUrl, accountId, keys } = options;
    const apiKey = keys.getReadKey();
    const url = `${baseUrl}/api/images/find?firstOnly=false&accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await postJson(url, { sourceImage, regions, targets }, fetchImpl);
    return getJsonResult(response, apiKey, fetchImpl, sleepFn, url);
}

/**
 * Builds the `where=` filter clauses for a session-history query. Each clause's payload is a
 * plain UTF-8 string, base64-encoded — not `encodeURIComponent(JSON.stringify(...))` — and
 * `IsViewport` in particular is a custom `{width:N,height:N}` literal (unquoted keys, not
 * valid JSON), confirmed by decoding a real sample URL. Returns only the clauses for fields
 * actually present in `env`, `&&`-joined; a caller further `encodeURIComponent`s the whole
 * result when building the request URL — this returns the raw (unencoded) filter text.
 */
function buildSessionHistoryEnvFilter(env) {
    const clauses = [];
    const b64 = (value) => node_buffer.Buffer.from(value, 'utf8').toString('base64');
    if (env.hostingApp)
        clauses.push(`(IsHostApp:${b64(env.hostingApp)})`);
    if (env.os)
        clauses.push(`(IsHostOS:${b64(env.os)})`);
    if (env.displaySize) {
        const { width, height } = env.displaySize;
        clauses.push(`(IsViewport:${b64(`{width:${width},height:${height}}`)})`);
    }
    return clauses.join('&&');
}
const defaultFetchSessionHistoryDeps = {
    ...defaultFsCacheDeps,
    fetchImpl: reqTransport,
};
/**
 * Fetches (or reads from cache) a page of a scenario's historic sessions matching `env`, at or
 * before `ranAtOrBefore`. Confirmed live as an async-job endpoint (a `202` with a `Location`
 * status-poll header, same convention as `images/get-compatible-selectors` in
 * `selector-mapping.ts` — there a POST initiates it, here a plain GET does), so this goes
 * through `getJsonResult`, not `getJson` (which assumes a synchronous body).
 *
 * Named for what it returns — a session history — not for `scenarioId`, which is only one of
 * several inputs (alongside `env`) narrowing which sessions come back; the endpoint itself is
 * scoped by scenario, but the result is a plain list of full raw sessions, not scenario-level
 * aggregate data.
 *
 * Cached indefinitely, keyed by a hash of every input that affects the result — unlike a
 * session/batch fetch (deliberately never cached elsewhere in `api/`, since those can change),
 * a `ranAtOrBefore`-pinned query against the past is immutable once made.
 *
 * Confirmed live: the response is `{ "sessions": [...] }`, each entry a full raw session
 * object (the same shape `fetchRawSession` returns) — but a bare-array response is still
 * normalized defensively, mirroring `fetchRawBatchSessions`, in case an edge case omits the
 * wrapper.
 */
async function fetchSessionHistory(options, deps = defaultFetchSessionHistoryDeps) {
    const { baseUrl, scenarioId, accountId, keys, env, ranAtOrBefore, count } = options;
    const apiKey = keys.getReadKey();
    const where = buildSessionHistoryEnvFilter(env);
    const cacheKey = crypto__namespace
        .createHash('sha256')
        .update(JSON.stringify({ scenarioId, where, ranAtOrBefore, count }))
        .digest('hex');
    const cachePath = cacheFilePath(deps, 'eyes-session-history', cacheKey, 'json');
    const cached = deps.readFile(cachePath);
    if (cached !== null)
        return JSON.parse(cached);
    const url = `${baseUrl}/api/sessions/scenarios/${scenarioId}/query` +
        `?ranAtOrBefore=${encodeURIComponent(ranAtOrBefore)}` +
        `&where=${encodeURIComponent(where)}` +
        `&count=${count}` +
        `&accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await deps.fetchImpl(url);
    const data = await getJsonResult(response, apiKey, deps.fetchImpl, deps.sleepFn, url);
    const sessions = Array.isArray(data) ? data : data?.sessions ?? [];
    deps.writeFile(cachePath, JSON.stringify(sessions));
    return sessions;
}

/**
 * Recomputes a step's visual diff against arbitrary match settings/regions — the same
 * comparison the dashboard's own region editor uses for a live preview, confirmed live to
 * accept both a `{domSelector}` region (resolved against both images' own DOM, since
 * `useDom`/`hasDom` are true) and a plain `{left,top,width,height}` region. `image1`/`image2`
 * in the response are a genuine two-way diff — rects in each image's own coordinate space,
 * not a single shared list — mirroring the request's own `image1`/`image2` sides.
 *
 * Confirmed live to be sometimes synchronous (200) and sometimes an async job (202 +
 * `Location`) depending on whether the exact payload was already computed — `getJsonResult`
 * handles both transparently.
 */
async function compareStep(body, options, fetchImpl = reqTransport) {
    const { baseUrl, accountId, keys } = options;
    const apiKey = keys.getReadKey();
    const url = `${baseUrl}/api/images/compare?accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await postJson(url, body, fetchImpl);
    return getJsonResult(response, apiKey, fetchImpl, undefined, url);
}

/**
 * Given a reference step and a candidate list of other steps, returns which of `steps` actually
 * have the same diff as `reference` — the real target steps an accept/reject decision should
 * propagate to, as opposed to every step a scenario-name match happened to include. `image1`/
 * `image2` here are plain baseline/checkpoint image id strings, not full `ImageRecord` objects
 * (unlike `compareStep`'s own request shape) — each entry (including `reference`) carries its
 * own step's `matchSettings`, never another step's.
 *
 * Confirmed live: an async job (202 + Location), same as every other endpoint in this file.
 * **The result is `number[]` — zero-based indices into the request's own `steps` array, e.g.
 * `[0, 1]` meaning `steps[0]` and `steps[1]` both matched — never step objects, and never
 * `{sessionId, stepIndex}` identifiers.** A caller must resolve each index back against its own
 * original `steps`/candidate array; the response carries nothing else to identify a match by.
 * When nothing in `steps` matches `reference`, the job's own result is `204 No Content` — an
 * empty body, which `getJsonResult` parses as `undefined` — normalized here to `[]` so callers
 * can always assume an array.
 */
async function findSameDiffSteps(body, options, fetchImpl = reqTransport) {
    const { baseUrl, accountId, keys } = options;
    const apiKey = keys.getReadKey();
    const url = `${baseUrl}/api/sessions/steps/samediffas?accountId=${accountId}&apiKey=${encodeURIComponent(apiKey)}`;
    const response = await postJson(url, body, fetchImpl);
    return (await getJsonResult(response, apiKey, fetchImpl, undefined, url)) ?? [];
}

// findNodeBySelector/findNodeByRect return a nested {domSelector, rect} shape (DomNode);
// the Region shape needed elsewhere is flat (domSelector alongside left/top/width/height).
function toRegion$1(resolved) {
    return { domSelector: resolved.domSelector, ...resolved.rect };
}
/**
 * Maps every `anchored` pair's `domSelector` to the other side via one batched
 * get-compatible-selectors call, resolving each mapped selector's accurate rect locally
 * against that side's DOM (the API only returns the mapped selector, never a rect). Falls
 * back to treating every selector as unmapped if the batch call itself fails for some reason
 * other than a bad input selector (`sessions`'s own `checkRegions` already filters those out).
 * Mutates each pair's missing side in place. Returns whether anything was attempted (i.e.
 * `anchored` was non-empty and both sides have an image to map between).
 *
 * Lives here, not in `atoms/sessions` (where the rest of the region-healing pipeline this composes
 * into — `checkRegions`/`clearStaleSelectors`/`healNonAnchoredRegionsBySourceRect` — lives):
 * this is the one step of that pipeline that actually calls the network (`getCompatibleSelectors`),
 * and `atoms` must never depend on `api`/`common` (so it can't reference `ApiKeyProvider` or make
 * network calls) — the orchestration belongs in `common`, which depends on both instead.
 */
async function mapAnchoredRegionsBySelector(rawSession, stepIndex, anchored, deps) {
    if (anchored.length === 0)
        return false;
    const sourceSide = resolveDomIdSide('unchanged', rawSession, stepIndex);
    const missingSide = sourceSide === 'baseline' ? 'checkpoint' : 'baseline';
    const imageSource = imageForSide(rawSession, stepIndex, sourceSide);
    const imageMissing = imageForSide(rawSession, stepIndex, missingSide);
    if (!imageSource || !imageMissing)
        return false;
    const domMissing = await deps.fetchDomForSide(rawSession, stepIndex, missingSide, deps.baseUrl).catch(() => null);
    // `anchored` pairs are guaranteed a truthy domSelector by checkRegions's own definition of "anchored".
    const selectors = anchored.map(p => (p.baseline ?? p.checkpoint).domSelector);
    let mapped;
    try {
        mapped = await deps.getCompatibleSelectors({ baseUrl: deps.baseUrl, accountId: deps.accountId, keys: deps.keys }, imageSource, imageMissing, selectors);
    }
    catch {
        mapped = selectors.map(() => null); // the batch itself failed — treat every one as unmapped rather than throwing
    }
    anchored.forEach((pair, i) => {
        const newSelector = mapped[i];
        const resolved = newSelector && domMissing ? findNodeBySelector(domMissing, newSelector) : null;
        pair[missingSide] = resolved
            ? toRegion$1(resolved)
            : { ...(pair.baseline ?? pair.checkpoint), domSelector: newSelector ?? '' };
    });
    return true;
}

const defaultFetchRawDiffsDeps = {
    fetchStepDiff,
    compareStep,
    readFile: defaultFsCacheDeps.readFile,
    writeFile: defaultFsCacheDeps.writeFile,
};
/**
 * The two-way visual diff for one step — `image1` in the baseline image's own coordinate
 * space, `image2` in the checkpoint's, exactly mirroring both the plain `GET .../diff`
 * endpoint's and `compareStep`'s own response shape. When the step's resolution state is
 * unchanged from the original test run (`appOutputResolution[stepIndex].isChanged` is not
 * `true`), the cheap `GET .../diff` endpoint is used as-is — nothing about the step's
 * effective match settings differs from what the test already ran with. Otherwise, the step's
 * current effective regions are folded into a fresh `compareStep` request so the returned diff
 * reflects any region added since the test ran — that (more expensive) result is cached on
 * disk, keyed by a hash of the full request body, so repeated calls against the same resolved
 * state don't repeatedly hit the endpoint.
 *
 * Takes an already-fetched `rawSession` rather than fetching its own — `batchId`/`sessionId`
 * are read straight off it (`rawSession.batchId`/`rawSession.id`), so a caller that already has
 * the raw session in hand (e.g. for its own domId lookups) never pays for a second fetch just
 * to hand this function a `url` it would otherwise re-resolve into the same session itself.
 *
 * `matchSettings` comes straight from `getEffectiveMatchSettings` — the raw session's own
 * scalars/regions, shaped directly into the request format, with no baseline/checkpoint
 * pairing and no healing: that shaping only exists for diagnostic region output (which needs
 * both sides shown, healing in whichever one the raw session doesn't encode), never for a
 * compare request. Re-deriving "accepted ⇒ checkpoint, else baseline" here would duplicate
 * logic the raw session's own `annotations` field already resolves — and healing in the other
 * side would cost an extra network round trip per region for nothing a compare request needs.
 */
async function fetchRawDiffs(rawSession, stepIndex, baseUrl, accountId, keys, deps = defaultFetchRawDiffsDeps) {
    const batchId = rawSession?.batchId;
    const sessionId = rawSession?.id;
    if (rawSession?.appOutputResolution?.[stepIndex]?.isChanged !== true) {
        return deps.fetchStepDiff({ baseUrl, batchId, sessionId, stepIndex, accountId, keys });
    }
    const requestBody = {
        matchSettings: getEffectiveMatchSettings(rawSession, stepIndex),
        image1: imageForSide(rawSession, stepIndex, 'baseline'),
        image2: imageForSide(rawSession, stepIndex, 'checkpoint'),
        sessionId: rawSession.id,
        batchId: rawSession.batchId,
        runningSessionId: rawSession.runningSessionId,
        stepIndex,
    };
    // SHA-256 (not SHA-1): this is only a content-addressed cache key, but the hashed body carries
    // session identifiers, so a collision-prone digest is neither needed nor acceptable here.
    const requestHash = crypto__namespace.createHash('sha256').update(JSON.stringify(requestBody)).digest('hex').slice(0, 16);
    const cachePath = cacheFilePath(defaultFsCacheDeps, 'eyes-compare', requestHash);
    const cached = deps.readFile(cachePath);
    if (cached !== null) {
        const parsed = JSON.parse(cached);
        return { image1: parsed.image1 ?? [], image2: parsed.image2 ?? [] };
    }
    const result = await deps.compareStep(requestBody, { baseUrl, accountId, keys });
    const rects = { image1: result.image1 ?? [], image2: result.image2 ?? [] };
    deps.writeFile(cachePath, JSON.stringify(rects));
    return rects;
}

const sessionMetadata = {
    validationCount: 0,
};
function markApiKeyAsValidated(apiKey, serverUrl) {
    sessionMetadata.lastValidatedApiKey = apiKey;
    sessionMetadata.lastValidatedServerUrl = serverUrl;
    sessionMetadata.validationCount++;
}
function getLastValidatedApiKey() {
    return sessionMetadata.lastValidatedApiKey;
}
function setWorkspaceRoot(workspaceRoot) {
    sessionMetadata.workspaceRoot = workspaceRoot;
}
function getWorkspaceRoot() {
    return sessionMetadata.workspaceRoot;
}
function getLastValidatedServerUrl() {
    return sessionMetadata.lastValidatedServerUrl;
}

const API_KEY_VARS = ['APPLITOOLS_READ_KEY', 'APPLITOOLS_WRITE_KEY'];
const loadEnvOnce = utils__namespace.general.cachify((startDir, source) => {
    const loaded = loadEnvFromCwd(startDir);
    if (loaded) {
        const applied = loaded.applied.length ? `set ${loaded.applied.join(', ')}` : 'no new variables applied';
        log$2('info', `[MCP Server] .env loaded from ${loaded.path} (${applied}; walked up from ${startDir}, triggered by ${source})`);
    }
    else {
        log$2('debug', `[MCP Server] no .env found walking up from ${startDir} (triggered by ${source})`);
    }
    return loaded;
}, ([startDir]) => startDir, 30000);
function syncWorkspaceKeys(workspaceRoot, source) {
    const loaded = loadEnvOnce(workspaceRoot, source);
    if (!loaded)
        return;
    for (const name of API_KEY_VARS) {
        const value = loaded.parsed[name];
        if (process.env[name] === value)
            continue;
        if (value) {
            process.env[name] = value;
            log$2('info', `[MCP Server] ${name} set from ${loaded.path} (triggered by ${source})`);
        }
        else if (name in process.env) {
            delete process.env[name];
            log$2('info', `[MCP Server] ${name} removed — not in ${loaded.path} (triggered by ${source})`);
        }
    }
}

const SUPPORTED_FRAMEWORKS = ['playwright-test'];
/** Maps npm package names to framework names for package.json detection. */
const PACKAGE_TO_FRAMEWORK = {
    // Supported frameworks
    '@playwright/test': 'playwright-test',
    // Unsupported frameworks
    playwright: 'playwright',
    cypress: 'cypress',
    '@applitools/eyes-cypress': 'cypress',
    'selenium-webdriver': 'selenium',
    '@applitools/eyes-selenium': 'selenium',
    puppeteer: 'puppeteer',
    '@applitools/eyes-puppeteer': 'puppeteer',
    webdriverio: 'webdriverio',
    '@wdio/cli': 'webdriverio',
    '@applitools/eyes-webdriverio': 'webdriverio',
    '@storybook/react': 'storybook',
    '@storybook/vue': 'storybook',
    '@storybook/angular': 'storybook',
    '@storybook/web-components': 'storybook',
    '@applitools/eyes-storybook': 'storybook',
};
/** Common subfolder names that are likely not the project root */
const COMMON_SUBFOLDERS = ['src', 'test', 'tests', 'e2e', 'dist', 'build'];
/** Maximum number of directory entries to scan when searching for framework hints */
const MAX_SCAN_ITEMS = 50;

/** Returns true if the directory contains a well-known project marker file. */
function isProjectRoot(dir) {
    try {
        if (fs.existsSync(path.join(dir, 'package.json')))
            return true;
        if (fs.existsSync(path.join(dir, 'requirements.txt')))
            return true;
        if (fs.existsSync(path.join(dir, 'pyproject.toml')))
            return true;
        if (fs.existsSync(path.join(dir, 'Gemfile')))
            return true;
        if (fs.existsSync(path.join(dir, 'pom.xml')))
            return true;
        if (fs.existsSync(path.join(dir, 'build.gradle')))
            return true;
        if (fs.readdirSync(dir).some(f => f.endsWith('.csproj') || f.endsWith('.sln')))
            return true;
    }
    catch {
        // ignore read errors
    }
    return false;
}
/** Walks upward from startDir to find the nearest project root. Skips common subfolders. */
function findProjectRoot(startDir) {
    const baseName = path.basename(startDir).toLowerCase();
    if (COMMON_SUBFOLDERS.includes(baseName)) {
        const parentDir = path.dirname(startDir);
        if (isProjectRoot(parentDir)) {
            return parentDir;
        }
    }
    let currentDir = startDir;
    while (true) {
        if (isProjectRoot(currentDir)) {
            return currentDir;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir)
            return startDir; // filesystem root
        currentDir = parentDir;
    }
}
/** Returns true if the package.json has a "workspaces" field (monorepo). */
function isMonorepo(packageJsonPath) {
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return Boolean(packageJson.workspaces);
    }
    catch {
        return false;
    }
}
/** Walks upward from filePath to find the nearest package.json dir, stopping at workspaceRoot. */
function findNearestPackageJson(filePath, workspaceRoot) {
    try {
        let currentDir;
        try {
            currentDir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
        }
        catch {
            currentDir = path.dirname(filePath);
        }
        while (currentDir !== workspaceRoot && currentDir !== path.dirname(currentDir)) {
            if (fs.existsSync(path.join(currentDir, 'package.json'))) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
    }
    catch {
        // ignore
    }
    return null;
}

/** Language detection rules applied in order — first match wins for `selected`. */
const LANGUAGE_CHECKS = [
    {
        language: 'csharp',
        check: files => files.some(f => f.endsWith('.csproj') || f.endsWith('.sln')),
    },
    {
        language: 'python',
        check: files => files.some(f => ['setup.py', 'requirements.txt', 'pyproject.toml', 'pipfile'].includes(f)),
    },
    {
        language: 'java',
        check: files => files.some(f => f.endsWith('.java') || ['pom.xml', 'build.gradle'].includes(f)),
    },
    {
        language: 'ruby',
        check: files => files.some(f => f === 'gemfile' || f === 'gemfile.lock' || f.endsWith('.gemspec')),
    },
];
const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs'];
/** Detects all SDK languages in the project and returns the primary selected language. */
function getSdkLanguage(workingDirectory) {
    var _a;
    const projectRoot = findProjectRoot(workingDirectory);
    const detected = [];
    // Check for non-JS/TS languages (all matches collected)
    try {
        const files = fs.readdirSync(projectRoot);
        const lowerFiles = files.map(f => f.toLowerCase());
        for (const { language, check } of LANGUAGE_CHECKS) {
            if (check(lowerFiles, projectRoot)) {
                detected.push(language);
            }
        }
    }
    catch {
        // ignore read errors
    }
    // tsconfig.json is the most explicit TypeScript indicator
    let hasTs = fs.existsSync(path.join(projectRoot, 'tsconfig.json'));
    // Scan for TS/JS file extensions
    try {
        const files = fs.readdirSync(projectRoot);
        const lowerFiles = files.map(f => f.toLowerCase());
        if (!hasTs && lowerFiles.some(f => TS_EXTENSIONS.some(ext => f.endsWith(ext)))) {
            hasTs = true;
        }
        if (hasTs) {
            detected.push('typescript');
        }
        else if (lowerFiles.some(f => JS_EXTENSIONS.some(ext => f.endsWith(ext)))) {
            detected.push('javascript');
        }
    }
    catch {
        // ignore read errors
    }
    // package.json without TS files → JavaScript
    if (!detected.includes('typescript') && !detected.includes('javascript')) {
        if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
            detected.push('javascript');
        }
    }
    return { selected: (_a = detected[0]) !== null && _a !== void 0 ? _a : '', detected };
}

/** Returns all dependency fields as a flat {packageName -> version} map. */
function getAllDependencies(packageJson) {
    return {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies,
    };
}
/** Detects all frameworks from package.json. Returns null if file not found. */
function detectAllFrameworksFromPackageJson(packageJsonPath) {
    if (!fs.existsSync(packageJsonPath))
        return null;
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = getAllDependencies(packageJson);
        const found = [];
        const seenFrameworks = new Set();
        for (const [packageName, frameworkName] of Object.entries(PACKAGE_TO_FRAMEWORK)) {
            if (allDeps[packageName] && !seenFrameworks.has(frameworkName)) {
                found.push({ name: frameworkName, version: allDeps[packageName] });
                seenFrameworks.add(frameworkName);
            }
        }
        if (found.length === 0) {
            return [{ name: 'unsupported-other', version: '' }];
        }
        return found;
    }
    catch {
        return null;
    }
}
/** Detects framework from requirements.txt. Returns null if file not found. */
function detectFrameworkFromRequirementsTxt(requirementsPath) {
    if (!fs.existsSync(requirementsPath))
        return null;
    try {
        const lines = fs.readFileSync(requirementsPath, 'utf-8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();
            if (trimmed.startsWith('playwright')) {
                const match = trimmed.match(/playwright[>=<~!]*([0-9.]+)/);
                return { name: 'playwright', version: match ? match[1] : 'unknown' };
            }
        }
    }
    catch {
        // ignore
    }
    return null;
}
/** Detects framework from pyproject.toml. Returns null if file not found. */
function detectFrameworkFromPyproject(pyprojectPath) {
    if (!fs.existsSync(pyprojectPath))
        return null;
    try {
        const content = fs.readFileSync(pyprojectPath, 'utf-8');
        if (content.includes('playwright')) {
            const match = content.match(/playwright[>=<~!"\s]*([0-9.]+)/);
            return { name: 'playwright', version: match ? match[1] : 'unknown' };
        }
    }
    catch {
        // ignore
    }
    return null;
}
/** Selects the primary framework from a list, preferring supported frameworks. */
function selectFromDetected(detected) {
    var _a;
    const supportedMatch = detected.find(f => SUPPORTED_FRAMEWORKS.includes(f.name));
    const selected = (_a = supportedMatch !== null && supportedMatch !== void 0 ? supportedMatch : detected[0]) !== null && _a !== void 0 ? _a : {};
    return { selected, detected };
}
function resolveEffectiveRoot(workingDirectory, activeFile) {
    const projectRoot = findProjectRoot(workingDirectory);
    if (!activeFile)
        return projectRoot;
    const workspacePackageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(workspacePackageJsonPath) && isMonorepo(workspacePackageJsonPath)) {
        const nearestPackageDir = findNearestPackageJson(activeFile, projectRoot);
        if (nearestPackageDir)
            return nearestPackageDir;
    }
    return projectRoot;
}
/**
 * Detects all automation frameworks at or near the given directory.
 * Checks package.json, requirements.txt, pyproject.toml, then filename heuristics.
 * Returns the primary selected framework (preferring supported ones) and all detected frameworks.
 */
function getAutomationFramework(workingDirectory, activeFile) {
    const projectRoot = resolveEffectiveRoot(workingDirectory, activeFile);
    // 1. Try Node.js package.json detection
    const nodeResults = detectAllFrameworksFromPackageJson(path.join(projectRoot, 'package.json'));
    if (nodeResults !== null)
        return selectFromDetected(nodeResults);
    // 2. Try Python detection
    const requirementsResult = detectFrameworkFromRequirementsTxt(path.join(projectRoot, 'requirements.txt'));
    if (requirementsResult !== null)
        return selectFromDetected([requirementsResult]);
    const pyprojectResult = detectFrameworkFromPyproject(path.join(projectRoot, 'pyproject.toml'));
    if (pyprojectResult !== null)
        return selectFromDetected([pyprojectResult]);
    // 3. Non-JS/Python project (C#, etc.) → mark as unsupported
    try {
        const files = fs.readdirSync(projectRoot);
        const hasCsharp = files.some(f => f.endsWith('.csproj'));
        const hasPythonProject = fs.existsSync(path.join(projectRoot, 'requirements.txt')) ||
            fs.existsSync(path.join(projectRoot, 'pyproject.toml'));
        if (hasCsharp || hasPythonProject) {
            return selectFromDetected([{ name: 'unsupported-other', version: '' }]);
        }
    }
    catch {
        // ignore
    }
    // 4. Filename-based heuristic (last resort)
    try {
        const files = fs.readdirSync(projectRoot).slice(0, MAX_SCAN_ITEMS);
        for (const file of files) {
            const lowerFile = file.toLowerCase();
            for (const framework of SUPPORTED_FRAMEWORKS) {
                if (lowerFile.includes(framework)) {
                    return selectFromDetected([{ name: framework, version: 'unknown' }]);
                }
            }
        }
    }
    catch {
        // ignore
    }
    return { selected: {}, detected: [] };
}

const store = new node_async_hooks.AsyncLocalStorage();
function withToolTelemetry(fields, fn) {
    return store.run(fields, fn);
}
function recordToolTelemetry(fields) {
    var _a;
    Object.assign((_a = store.getStore()) !== null && _a !== void 0 ? _a : {}, fields);
}
let gateRejections = 0;
function countGateRejection() {
    gateRejections += 1;
}
function gateRejectionCount() {
    return gateRejections;
}

var name = "@applitools/mcp";
var mcpName = "io.github.applitools/applitools";
var mcpRegistryVersion = "1.0.8";
var version = "0.8.9";
var description = "Applitools MCP server for AI coding assistants";
var main = "./dist/index.js";
var bin = "./dist/index.js";
var scripts = {
	"type-check": "tsc --noEmit",
	build: "yarn type-check && rollup -c",
	clean: "rm -rf dist",
	"build:bundle": "yarn clean && yarn build && BUILD_MODE=bundle yarn type-check && BUILD_MODE=bundle rollup -c",
	"build:watch": "rollup -c --watch",
	prepublishOnly: "yarn build",
	test: "yarn test:mocha && yarn test:tools",
	"test:mocha": "mocha test/**/*.spec.ts --parallel",
	"test:tools": "vitest run",
	"test:smoke": "node test/smoke/server-boot.mjs",
	"test:watch": "mocha test/**/*.spec.ts --watch",
	lint: "eslint 'src/**/*.ts'",
	"lint:fix": "eslint 'src/**/*.ts' --fix"
};
var keywords = [
	"applitools",
	"eyes",
	"mcp",
	"model-context-protocol",
	"playwright",
	"visual-testing",
	"ai",
	"coding-assistant",
	"visual regression",
	"model context protocol",
	"ui testing",
	"cross-browser testing",
	"ultrafast grid",
	"test automation"
];
var icon = "src/assets/logo.png";
var license = "SEE LICENSE IN LICENSE";
var author = {
	name: "Applitools Team",
	email: "team@applitools.com"
};
var homepage = "https://applitools.com";
var files = [
	"dist",
	"docs",
	"README.md",
	"LICENSE"
];
var engines = {
	node: ">=18.0.0"
};
var dependencies = {
	"@applitools/core-base": "workspace:*",
	"@applitools/eyes-results": "workspace:*",
	"@applitools/image": "workspace:*",
	"@applitools/logger": "workspace:*",
	"@applitools/req": "workspace:*",
	"@applitools/utils": "workspace:*",
	"@modelcontextprotocol/sdk": "^1.0.0",
	dotenv: "^16.3.1",
	zod: "^4.0.0"
};
var devDependencies = {
	"@applitools/test-utils": "workspace:^",
	"@rollup/plugin-commonjs": "^25.0.7",
	"@rollup/plugin-json": "^6.1.0",
	"@rollup/plugin-node-resolve": "^15.2.3",
	"@rollup/plugin-typescript": "^11.1.6",
	"@types/mocha": "^10.0.6",
	"@types/node": "^20.10.0",
	"@typescript-eslint/eslint-plugin": "^8.51.0",
	"@typescript-eslint/parser": "^8.51.0",
	eslint: "^9.39.2",
	"eslint-config-prettier": "^10.1.8",
	"eslint-plugin-prettier": "^5.5.4",
	"fast-glob": "^3.3.2",
	hono: "^4.0.0",
	mocha: "^11.7.5",
	prettier: "^3.7.4",
	rollup: "^4.9.6",
	"rollup-plugin-copy": "^3.5.0",
	"rollup-plugin-node-externals": "^8.1.2",
	typescript: "~5.9.3",
	vitest: "^3.2.4"
};
var publishConfig = {
	access: "public"
};
var lavamoat = {
	allowScripts: {
		"@applitools/core-base>@applitools/image>sharp": false,
		"@applitools/image>sharp": false,
		"vitest>vite>esbuild": false,
		"vitest>jsdom>ws>bufferutil": false,
		"vitest>jsdom>ws>utf-8-validate": false,
		"vitest>vite-node>vite>esbuild": false
	}
};
var packageJson = {
	name: name,
	mcpName: mcpName,
	mcpRegistryVersion: mcpRegistryVersion,
	version: version,
	description: description,
	main: main,
	bin: bin,
	scripts: scripts,
	keywords: keywords,
	icon: icon,
	license: license,
	author: author,
	homepage: homepage,
	files: files,
	engines: engines,
	dependencies: dependencies,
	devDependencies: devDependencies,
	publishConfig: publishConfig,
	lavamoat: lavamoat
};

/** Elides every image block's base64 `data` — one evidence call carries megabytes of screenshot, and users attach these logs to support tickets. */
function serializeResultForLog(result) {
    const content = Array.isArray(result.content)
        ? result.content.map(block => {
            var _a;
            return block.type === 'image'
                ? {
                    ...block,
                    data: `<${String((_a = block.data) !== null && _a !== void 0 ? _a : '').length} base64 chars elided>`,
                }
                : block;
        })
        : result.content;
    return JSON.stringify({ ...result, content }, null, 2);
}
/** Recursively truncate arrays to `maxItems` before serialisation to avoid megabyte payloads in telemetry. */
function truncateForTelemetry(value, maxItems = 3) {
    if (Array.isArray(value)) {
        return value.slice(0, maxItems).map(item => truncateForTelemetry(item, maxItems));
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, truncateForTelemetry(v, maxItems)]));
    }
    return value;
}
const GIVEN_ID_KEYS = {
    batchId: ['batchId', 'batch_id'],
    sessionId: ['sessionId', 'session_id'],
};
const SCOPE_URL_KEYS = ['sessionUrl', 'batchUrl', 'url'];
function firstString(params, keys) {
    for (const key of keys) {
        const value = params[key];
        if (typeof value === 'string' && value !== '')
            return value;
    }
    return undefined;
}
function scopeIdsFromPath(url) {
    if (/^[\w~-]+$/.test(url))
        return { batchId: url };
    const numericSegments = url
        .split(/[?#]/)[0]
        .split('/')
        .filter(segment => /^\d+$/.test(segment));
    return { batchId: numericSegments[0], sessionId: numericSegments[1] };
}
function parseScopeUrl(url) {
    try {
        const { batchId, sessionId } = parseApplitoolsUrl(url);
        return { batchId, sessionId: sessionId !== null && sessionId !== void 0 ? sessionId : undefined };
    }
    catch {
        return scopeIdsFromPath(url);
    }
}
function extractScopeIds(params) {
    var _a, _b;
    const given = {
        batchId: firstString(params, GIVEN_ID_KEYS.batchId),
        sessionId: firstString(params, GIVEN_ID_KEYS.sessionId),
    };
    if (given.batchId && given.sessionId)
        return given;
    const url = firstString(params, SCOPE_URL_KEYS);
    const parsed = url ? parseScopeUrl(url) : {};
    return { batchId: (_a = given.batchId) !== null && _a !== void 0 ? _a : parsed.batchId, sessionId: (_b = given.sessionId) !== null && _b !== void 0 ? _b : parsed.sessionId };
}
const REPORTED_INPUT_KEYS = [
    'batchUrl',
    'sessionUrl',
    'url',
    'scenarioName',
    'stepIndex',
    'scope',
    'rootScope',
    'mode',
    'restart',
    'action',
    'target',
    'propagate',
    'filter',
    'format',
    'imageId',
    'domId',
    'rect',
    'areaRect',
    'sameAs',
];
function reportedInputs(params) {
    return Object.fromEntries(REPORTED_INPUT_KEYS.filter(key => params[key] !== undefined).map(key => [key, params[key]]));
}
const JSON_PARAMS_BUDGET = 1024;
const MAX_STRING_CHARS = 200;
function clampStrings(fields) {
    return Object.entries(fields)
        .filter(([, value]) => value !== undefined && !Array.isArray(value))
        .map(([key, value]) => [
        key,
        typeof value === 'string' && value.length > MAX_STRING_CHARS ? `${value.slice(0, MAX_STRING_CHARS)}…` : value,
    ]);
}
function jsonParams(essential, inputs) {
    const fields = new Map([...clampStrings(inputs), ...clampStrings(essential)]);
    const sheddable = () => [...fields.keys()].filter(key => !(key in essential));
    const serialize = () => JSON.stringify(Object.fromEntries(fields));
    let json = serialize();
    while (json.length > JSON_PARAMS_BUDGET) {
        const biggest = sheddable().sort((a, b) => { var _a, _b; return JSON.stringify((_a = fields.get(b)) !== null && _a !== void 0 ? _a : null).length - JSON.stringify((_b = fields.get(a)) !== null && _b !== void 0 ? _b : null).length; })[0];
        if (biggest === undefined)
            return json;
        fields.delete(biggest);
        log$2('warn', `[MCP] json_params over ${JSON_PARAMS_BUDGET} chars — dropped input "${biggest}"`);
        json = serialize();
    }
    return json;
}
const createToolHandler = (toolDef, logic) => {
    return async (params) => {
        const clientInfo = getClientInfo();
        log$2('info', `[MCP] 🟢 Tool Accessed: ${toolDef.name}`);
        log$2('info', `[MCP] 📥 Client: ${(clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.name) || 'unknown'} v${(clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.version) || 'unknown'}`);
        if (isVerboseLogging)
            log$2('info', `[MCP] 📥 Params:`, JSON.stringify(params, null, 2));
        const safeParams = params !== null && params !== void 0 ? params : {};
        const workspaceRoot = safeParams.workspaceRoot || getWorkspaceRoot() || process.cwd();
        syncWorkspaceKeys(workspaceRoot, toolDef.name);
        const { selected: frameworkSelected, detected: detectedFrameworks } = getAutomationFramework(workspaceRoot, safeParams.activeFile);
        const { name: automationFramework, version: automationFrameworkVersion } = frameworkSelected;
        const { selected: sdkLanguage, detected: detectedLanguages } = getSdkLanguage(workspaceRoot);
        const enrichedParams = {
            ...safeParams,
            workspaceRoot,
            automationFramework,
            automationFrameworkVersion,
            sdkLanguage,
        };
        const { batchId, sessionId } = extractScopeIds(safeParams);
        const telemetry = {};
        const callInputs = reportedInputs(safeParams);
        const outcomeJsonParams = () => jsonParams({ ...telemetry, gate_rejections: gateRejectionCount() }, callInputs);
        externalLog('mcp_tool_invoked', {
            ide: getIDE() || 'unknown',
            mcp_version: packageJson.version,
            tool_name: toolDef.name,
            client_name: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.name) || 'unknown',
            client_version: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.version) || 'unknown',
            transport_mode: TRANSPORT_MODE,
            batch_id: batchId,
            session_id: sessionId,
            params: JSON.stringify(params, null, 2).slice(0, 1024),
            json_params: jsonParams({}, callInputs),
            automation_framework: automationFramework,
            automation_framework_version: automationFrameworkVersion,
            sdk_language: sdkLanguage,
            detected_languages: detectedLanguages,
            detected_frameworks: detectedFrameworks,
        }).catch(() => { });
        try {
            const validatedParams = toolDef.input.parse(enrichedParams || {});
            const result = await withToolTelemetry(telemetry, () => logic(validatedParams));
            if (isVerboseLogging)
                log$2('info', `[MCP] 📤 Result:`, serializeResultForLog(result));
            const structuredContentWithoutMessage = { ...result.structuredContent };
            if (structuredContentWithoutMessage && 'message' in structuredContentWithoutMessage) {
                delete structuredContentWithoutMessage.message;
            }
            externalLog('mcp_tool_succeeded', {
                ide: getIDE() || 'unknown',
                mcp_version: packageJson.version,
                tool_name: toolDef.name,
                client_name: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.name) || 'unknown',
                client_version: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.version) || 'unknown',
                transport_mode: TRANSPORT_MODE,
                batch_id: batchId,
                session_id: sessionId,
                // Only tools with structured output report it; an empty `{}` carries nothing worth a field.
                ...(Object.keys(structuredContentWithoutMessage).length
                    ? { params: JSON.stringify(truncateForTelemetry(structuredContentWithoutMessage), null, 2).slice(0, 1024) }
                    : {}),
                json_params: outcomeJsonParams(),
            }).catch(() => { });
            const handlerResult = result;
            if (toolDef.output) {
                Object.assign(handlerResult, {
                    structuredContent: toolDef.output.parse(result.structuredContent),
                });
            }
            return handlerResult;
        }
        catch (error) {
            externalLog('mcp_tool_failed', {
                ide: getIDE() || 'unknown',
                mcp_version: packageJson.version,
                tool_name: toolDef.name,
                client_name: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.name) || 'unknown',
                client_version: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.version) || 'unknown',
                transport_mode: TRANSPORT_MODE,
                batch_id: batchId,
                session_id: sessionId,
                json_params: outcomeJsonParams(),
                error: error instanceof Error ? error.message : String(error),
            }, 'Error').catch(() => { });
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error executing ${toolDef.name} (MCP v${packageJson.version}): ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    };
};

const MCP_BRANDING = 'Using Applitools MCP';
function wrapText(text, position = 'suffix') {
    if (position === 'prefix') {
        return `${MCP_BRANDING}

${text}`;
    }
    else {
        return `${text}

${MCP_BRANDING}`;
    }
}

class MissingApiKeyError extends Error {
    constructor() {
        super('API key is missing. Please provide APPLITOOLS_API_KEY.');
        this.name = 'MissingApiKeyError';
    }
}
class InvalidApiKeyError extends Error {
    constructor(apiKey) {
        const masked = apiKey.length > 8
            ? apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4)
            : '*'.repeat(apiKey.length);
        super(`Invalid API key: ${masked}`);
        this.name = 'InvalidApiKeyError';
    }
}

/** API Client using Applitools req package for Eyes server communication */
const DEFAULT_RETRY_CONFIG = [
    {
        codes: [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            'UND_ERR_SOCKET',
            'UND_ERR_CONNECT_TIMEOUT',
            'UND_ERR_HEADERS_TIMEOUT',
            'UND_ERR_BODY_TIMEOUT',
        ],
        limit: 3,
        timeout: [1000, 2000, 5000],
    },
    {
        statuses: [500, 502, 503, 504],
        limit: 3,
        timeout: [1000, 2000, 5000],
    },
    {
        statuses: [429],
        limit: 5,
        timeout: [2000, 4000, 8000, 16000, 32000],
    },
];
/**
 * API Client for Eyes server using @applitools/req for automatic retry handling
 */
class ApiClient {
    constructor(options) {
        var _a;
        this.baseUrl = options.baseUrl;
        this.apiKey = options.apiKey;
        this.timeout = options.timeout || 30000;
        this.retryConfig = (_a = options.retryConfig) !== null && _a !== void 0 ? _a : DEFAULT_RETRY_CONFIG;
    }
    /**
     * Perform a GET request, returning the raw response for custom status-code
     * handling. Retries and auth headers are still applied automatically.
     *
     * Unlike `get()`, this method does NOT throw on non-2xx responses other
     * than 401 — the caller is responsible for inspecting `response.status` and
     * `response.ok`. 401 is mapped to `InvalidApiKeyError` for symmetry with
     * `get()`/`post()`, so a rotated/expired API key fails loudly instead of
     * being silently absorbed by callers that treat "no diffs" as a normal
     * outcome.
     */
    async getRaw(endpoint) {
        if (!this.apiKey) {
            throw new MissingApiKeyError();
        }
        const response = await req.req(`${this.baseUrl}/${endpoint}`, {
            method: 'GET',
            headers: {
                'X-Eyes-Api-Key': this.apiKey,
                Accept: 'application/json',
            },
            requestTimeout: this.timeout,
            retry: this.retryConfig,
        });
        if (response.status === 401) {
            throw new InvalidApiKeyError(this.apiKey);
        }
        return response;
    }
    /**
     * Perform a GET request with automatic retry on failures
     */
    async get(endpoint) {
        if (!this.apiKey) {
            throw new MissingApiKeyError();
        }
        try {
            const response = await req.req(`${this.baseUrl}/${endpoint}`, {
                method: 'GET',
                headers: {
                    'X-Eyes-Api-Key': this.apiKey,
                    Accept: 'application/json',
                },
                requestTimeout: this.timeout,
                retry: this.retryConfig,
            });
            // Handle authentication errors
            if (response.status === 401) {
                throw new InvalidApiKeyError(this.apiKey);
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return (await response.json());
        }
        catch (error) {
            // Re-throw custom errors
            if (error instanceof InvalidApiKeyError || error instanceof MissingApiKeyError) {
                throw error;
            }
            throw error;
        }
    }
    /**
     * Perform a POST request with automatic retry on failures
     */
    async post(endpoint, body) {
        if (!this.apiKey) {
            throw new MissingApiKeyError();
        }
        try {
            const reqOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body,
                requestTimeout: this.timeout,
                retry: this.retryConfig,
            };
            // Add API key to query for POST requests (Eyes API pattern)
            const url = `${this.baseUrl}/${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${this.apiKey}`;
            const response = await req.req(url, reqOptions);
            // Handle authentication errors
            if (response.status === 401) {
                throw new InvalidApiKeyError(this.apiKey);
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return (await response.json());
        }
        catch (error) {
            // Re-throw custom errors
            if (error instanceof InvalidApiKeyError || error instanceof MissingApiKeyError) {
                throw error;
            }
            throw error;
        }
    }
}

/** API Key Verification Utility */
/**
 * Tight retry config for API key verification.
 *
 * Budget: max 3 retries (4 total attempts) × 2 s per attempt + 3.5 s delays = ~11.5 s worst case.
 * This is intentionally much shorter than the default config used for batch fetching,
 * because auth checks should fail fast — there is no value in retrying for minutes.
 */
const VERIFY_RETRY_CONFIG = [
    {
        codes: [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            'UND_ERR_SOCKET',
            'UND_ERR_CONNECT_TIMEOUT',
            'UND_ERR_HEADERS_TIMEOUT',
            'UND_ERR_BODY_TIMEOUT',
        ],
        limit: 3,
        timeout: [200, 500, 1000],
    },
    {
        statuses: [500, 502, 503, 504],
        limit: 3,
        timeout: [200, 500, 1000],
    },
    // Reduced from 5 retries / 62 s to 3 retries / 1.7 s for rate-limit responses
    {
        statuses: [429],
        limit: 3,
        timeout: [200, 500, 1000],
    },
];
/**
 * Verifies an API key against the Eyes server
 * @param params - The API key and server URL to verify
 * @returns A promise that resolves if valid, rejects if invalid
 * @throws Error if the API key is invalid or the request fails
 */
async function verifyApiKeyWithServer(params) {
    const { apiKey, serverUrl } = params;
    const client = new ApiClient({
        baseUrl: serverUrl,
        apiKey: apiKey,
        timeout: 2000,
        retryConfig: VERIFY_RETRY_CONFIG,
    });
    const response = await client.get(`api/auth/access?accessKey=${apiKey}`);
    log$2('debug', `API key verification response: ${JSON.stringify(response)}`);
    if (response.accountId === '') {
        throw new Error('Invalid API key');
    }
    return response;
}

/** Authentication Tools - Verify API Key */
const TOOL_NAME$3 = TOOL_NAMES.EYES_VERIFY_API_KEY;
const TOOL_DESCRIPTION$3 = 'Validate your Applitools API key and optional server URL. Searches for API key in .env, applitools.config.js/ts/cjs/mjs, and playwright.config.js/ts/cjs/mjs files.';
const VerifyApiKeyInputSchema = zod.z.object({
    apiKey: zod.z.string().optional().describe('Optional API key to validate (will search config files if not provided)'),
    serverUrl: zod.z.string().optional().describe('Optional Applitools server URL (defaults to https://eyes.applitools.com)'),
    workspaceRoot: zod.z
        .string()
        .optional()
        .describe('Workspace root to search for .env and config files (optional, defaults to current directory)'),
    workingDirectory: zod.z
        .string()
        .optional()
        .describe('Working directory to search for .env and config files (optional, defaults to process.cwd())'),
    setAsDefault: zod.z
        .boolean()
        .optional()
        .describe('If true, save the validated API key and server URL as the default configuration in cache'),
});
/** Verify API key handler function */
async function verifyApiKey(input = {}) {
    // Determine working directory
    const workingDirectory = input.workingDirectory || input.workspaceRoot || process.cwd();
    log$2('debug', `Verifying Eyes API key in working directory: ${workingDirectory}`);
    log$2('debug', `Input parameters: ${JSON.stringify(input)}`);
    // Get API key - priority: input parameter > credential loader (server-context > config files > env vars)
    let apiKey = input.apiKey;
    let serverUrl = input.serverUrl;
    let foundIn;
    // Load credentials if not provided as input
    if (!apiKey || !serverUrl) {
        const credentialResult = loadCredentials(workingDirectory);
        apiKey = apiKey || credentialResult.apiKey;
        serverUrl = serverUrl || credentialResult.serverUrl; // loadCredentials always provides serverUrl (with default)
        foundIn = credentialResult.source;
    }
    // Validate API key presence
    if (!apiKey || apiKey.trim() === '') {
        return {
            message: wrapText(`Eyes authentication failed. No API key found in:\n- .env file\n- applitools.config.js/ts/cjs/mjs\n- playwright.config.js/ts/cjs/mjs\n- Environment variable (APPLITOOLS_API_KEY)\n\nPlease set your API key in one of these locations or pass it as a parameter. Visit our documentation to learn how to retrieve your API key: https://applitools.com/docs/eyes/playwright#set-your-applitools-api-key`, 'suffix'),
        };
    }
    // serverUrl is guaranteed to be defined at this point (from input or loadCredentials with default)
    const finalServerUrl = serverUrl;
    // Validate URL format
    try {
        new URL(finalServerUrl);
    }
    catch {
        return {
            message: wrapText('Eyes authentication failed. Invalid server URL format. Please verify that your server URL is correct.', 'suffix'),
        };
    }
    // Call Eyes API to verify the key
    try {
        await verifyApiKeyWithServer({ apiKey, serverUrl: finalServerUrl });
        // Mark as validated in session memory
        markApiKeyAsValidated(apiKey, finalServerUrl);
        // Store credentials in server context for external logging
        setCredentials({ apiKey, serverUrl: finalServerUrl });
        const successMessage = foundIn
            ? `Eyes authentication successful! API key found in ${foundIn}`
            : 'Eyes authentication successful!';
        return {
            message: wrapText(successMessage, 'suffix'),
        };
    }
    catch {
        // Return invalid for any error (401, network, etc.)
        return {
            message: wrapText('Eyes authentication failed. Please verify that your API Key or server URL is correct. Visit our documentation to learn how to retrieve these values: https://applitools.com/docs/eyes/playwright#set-your-applitools-api-key', 'suffix'),
        };
    }
}

/** Verify API Key Tool - MCP Tool Object Export */
/** MCP Tool Object for verify_api_key */
const verifyApiKeyTool = {
    name: TOOL_NAME$3,
    description: TOOL_DESCRIPTION$3,
    inputSchema: VerifyApiKeyInputSchema,
    handler: createToolHandler({
        name: TOOL_NAME$3,
        input: VerifyApiKeyInputSchema,
    }, async (params) => {
        const result = await verifyApiKey(params);
        return {
            content: [
                {
                    type: 'text',
                    text: result.message,
                },
            ],
        };
    }),
};

const workspaceRootSchema$1 = zod.z
    .string()
    .optional()
    .describe('Workspace root directory (optional, defaults to current directory). If the workspace root is a Node.js monorepo (contains a package.json with a "workspaces" field), ask the user which package they want to use the tool on, or if they would like to create a new package in the monorepo.');
const automationFrameworkSchema = zod.z
    .string()
    .optional()
    .describe('The automation framework being used. This determines which SDK and configuration files are used. Discovered from package.json if in a javascript/typescript project. Supported values: playwright-test.');
const automationFrameworkVersionSchema = zod.z
    .string()
    .optional()
    .describe('The version of the automation framework (e.g., "1.47.0"). Can be discovered from the "playwright" dependency version in package.json for JavaScript/TypeScript projects. The latest version is currently supported.');
const sdkLanguageSchema = zod.z
    .string()
    .optional()
    .describe('The language of the SDK being used. This determines the syntax and file type for generated code snippets and configuration. Supported values: typescript, javascript.');
const activeFileSchema = zod.z
    .string()
    .optional()
    .describe('Path to the currently active file or folder in the IDE (optional). Used to improve framework detection in Node.js monorepos by finding the nearest package.json relative to the active context.');
/**
 * Base common input schema for all MCP tools
 * Contains fields that are auto-enriched by the tool-handler
 * All tool input schemas should extend this base schema
 */
const commonInputSchema = zod.z.object({
    workspaceRoot: workspaceRootSchema$1,
    activeFile: activeFileSchema,
    automationFramework: automationFrameworkSchema,
    automationFrameworkVersion: automationFrameworkVersionSchema,
    sdkLanguage: sdkLanguageSchema,
});
/**
 * Creates a client-facing schema by omitting internal auto-enriched fields
 * from a tool input schema that extends commonInputSchema.
 *
 * These fields are auto-populated by the tool-handler and should not be
 * exposed to external clients in the MCP tool's inputSchema.
 *
 * @param schema - The full tool input schema that extends commonInputSchema
 * @returns A schema with internal fields omitted for client use
 */
function createClientInputSchema(schema) {
    return schema.omit({
        automationFramework: true,
        automationFrameworkVersion: true,
        sdkLanguage: true,
    });
}
const SUPPORTED_SDK_LANGUAGES = ['typescript', 'javascript'];

function getAutomationFrameworkWarning(framework) {
    if (!framework || SUPPORTED_FRAMEWORKS.includes(framework))
        return '';
    const supported = SUPPORTED_FRAMEWORKS.map(f => `'${f}'`).join(', ');
    return `Important, MCP detected unsupported test runner '${framework}'. Only '${supported}' is supported at this time."\n\n`;
}
function getSdkLanguageWarning(language) {
    if (!language || SUPPORTED_SDK_LANGUAGES.includes(language))
        return '';
    const supported = SUPPORTED_SDK_LANGUAGES.map(l => `'${l}'`).join(', ');
    return `Important, MCP detected unsupported SDK language '${language}'. Only '${supported}' is supported at this time."\n\n`;
}
/** Normalizes common tool input. Returns a warning string if framework/language is unsupported. */
function validateCommonInput(input) {
    const frameworkWarning = getAutomationFrameworkWarning(input.automationFramework);
    const languageWarning = getSdkLanguageWarning(input.sdkLanguage);
    const warning = [frameworkWarning, languageWarning].filter(Boolean).join('\n');
    const workspaceRoot = input.workspaceRoot || getWorkspaceRoot() || process.cwd();
    if (input.workspaceRoot) {
        setWorkspaceRoot(input.workspaceRoot);
    }
    return {
        workspaceRoot,
        sdkLanguage: input.sdkLanguage,
        automationFramework: input.automationFramework,
        automationFrameworkVersion: input.automationFrameworkVersion,
        warning,
    };
}

// Tool names are spelled literally, matching how the family descriptions reference each other,
// to keep this module free of the families' import graph.
/** Why `--reporter` overrides are forbidden — the justification names what the run loses. */
function reporterOverrideWarning() {
    return '**IMPORTANT: When running Playwright tests (including this example), NEVER add `--reporter=list`, `--reporter=dot`, `--reporter=line`, or any other `--reporter` flag. Doing so overrides the configured reporters and suppresses the Eyes reporter, which means the HTML report will not contain Eyes results and the batch URL printed at the end of the run is lost.**';
}
const REVIEW_FLOW = `After the run, take the Eyes batch URL printed at the end of the test output and call the MCP tool "eyes_review_progress" with scope "batch" to review the results — it drives the whole investigation and tells you exactly what to inspect next; use mode "resolve" to also accept/reject checkpoints. For raw data instead of a driven review, "eyes_inspect_sessions" lists the batch's sessions and "eyes_inspect_steps" their steps.`;
function viewingResultsSection(flavor) {
    return flavor === 'project'
        ? `**Viewing Test Results:**

${REVIEW_FLOW}`
        : `**Viewing UFG Test Results:**

${REVIEW_FLOW} Every browser/device configured in "browsersInfo" appears as its own session in the batch.`;
}

const TILDA_WARNING_MESSAGE$1 = `[CORE REQUIREMENT: URL INTEGRITY] Playwright visual results return URLs ending in ~~. These are not typos. You are strictly forbidden from stripping trailing tildes from these links. Use markdown [Visual Test results](URL with tildes) for links. Output the raw, verbatim URL string exactly as captured from the test output.`;
const TOOL_NAME$2 = TOOL_NAMES.EYES_SETUP_PROJECT;
const TOOL_DESCRIPTION$2 = `Get step-by-step instructions to set up a Playwright JS project with Applitools Eyes (Fixtures variant)

${TILDA_WARNING_MESSAGE$1}`;
const PlaywrightJsSetupProjectInputSchema = commonInputSchema.extend({
    projectName: zod.z.string().optional().describe('Optional project name'),
    apiKey: zod.z.string().optional().describe('Optional API key (will use validated key from session if not provided)'),
});
const PlaywrightJsSetupProjectClientInputSchema = createClientInputSchema(PlaywrightJsSetupProjectInputSchema);
async function eyesSetupProject(input = {}) {
    const { workspaceRoot, warning } = validateCommonInput(input);
    let apiKey = getLastValidatedApiKey() || findApiKey(workspaceRoot).apiKey;
    let eyesServerUrl = getLastValidatedServerUrl() || findApiKey(workspaceRoot).serverUrl;
    const requiredApiKeyMessage = !apiKey
        ? 'IMPORTANT: An Applitools API key is required to run visual tests. Please provide your API key using the --apiKey argument when running npx eyes-setup, or set it in your environment variables or Playwright config file.'
        : '';
    const userApiKey = apiKey
        ? `\n\n**Your Applitools API Key:** \`${apiKey}\`. You must verify this API key with the MCP tool "${TOOL_NAMES.EYES_VERIFY_API_KEY}". If verification fails ask the user to check their API key and server URL.`
        : '';
    apiKey !== null && apiKey !== void 0 ? apiKey : (apiKey = 'YOUR_API_KEY');
    eyesServerUrl !== null && eyesServerUrl !== void 0 ? eyesServerUrl : (eyesServerUrl = 'https://eyes.applitools.com');
    const instructions = `${warning}You are a sophisticated assitant helping the user in setting up an Applitools Eyes Playwright Javascript project. 

You should guide the user based on the step by step instructions provided here. Do not invent steps. The full setup flow involves the 5 steps below:

All additional information required for setting up and troubleshooting an Applitools Eyes Playwright Javascript project, including sample tests and code snippets, is available on this web-page: https://applitools.com/tutorials/playwright.
Read the contents of this page to answer questions or suggest troubleshooting steps as it is the official and up to date source of truth on this subject.

Here are the setup steps you should make sure the user follows:

* STEP #1:

If the user does not yet have a Playwright javascript project installed, install it with the following command:

\`\`\`terminal
npm init playwright@latest -- --quit
\`\`\`

This will create a default setup. 
Customization options are:

| Flag | Description | Default (when using '--quiet') |
| :--- | :--- | :--- |
| **'--quiet'** | Run the command without asking interactive questions. | N/A |
| **'--lang <js\|ts>'** | Sets the programming language ('js' or 'ts'). | 'ts' (TypeScript) |
| **'--gha'** | Create a GitHub Actions workflow file. | 'true' (Creates file) |
| **'--install-deps'** | Install dependencies (npm/yarn/pnpm install). | 'true' (Installs deps) |
| **'--browsers'** | Download Playwright browsers. | 'true' (Downloads browsers) |
| **'--no-browsers'** | Skip downloading Playwright browsers. | N/A |

* STEP #2:

Once the Playwright project is ready and set up, install the Applitools Eyes Playwright Javascript SDK in the root directory of the project with the following command:

\`\`\`terminal
npm install -D @applitools/eyes-playwright
\`\`\`

* STEP #3:

${requiredApiKeyMessage}

Set up and configure the eyes project with the command:

\'\'\'terminal
npx eyes-setup
\'\'\'

The user can provide the configuration in two ways:

**AI ASSISTANT RECOMMENDATION**: Prefer using Option A (command-line arguments) to avoid interactive prompts. If you know the user's API key, use: npx eyes-setup --apiKey <API_KEY>
${userApiKey}

Option A - Command-line arguments (recommended for automation and AI assistants):
The user can provide the values directly as command-line arguments to avoid interactive prompts:

\`\`\`terminal
npx eyes-setup --apiKey ${apiKey}
\`\`\`

Or with a custom server URL:

\`\`\`terminal
npx eyes-setup --apiKey ${apiKey} --serverUrl ${eyesServerUrl}
\`\`\`

Command-line options:
  --apiKey     Your Applitools Team's API key (required)
  --serverUrl  Your Eyes dedicated cloud server URL (optional, only if not using public cloud)


The API key should be stored under the environment variable "APPLITOOLS_API_KEY" or in the playwright config file under the field "apiKey".

The server URL (if provided by the user) should be stored under the environment variable "APPLITOOLS_SERVER_URL" or in the playwright config file under the field "serverUrl".

Option B - Interactive mode (no arguments):
Running "npx eyes-setup" without arguments will prompt the user interactively for:
1) A mandatory API key for running tests. Without this key tests can't be run.
2) An optional Applitools server URL. This is needed only if the user is not using
   the public Eyes server but rather uses a dedicated server.
   This Eyes server is not the Applitools MCP server which provides this tool.

**IMPORTANT FOR AI ASSISTANTS**: When running "npx eyes-setup" in interactive mode:
- The command will FIRST prompt for the API key
- After entering the API key, it will THEN prompt to confirm or change the server URL
- The server URL prompt will show a default value (https://eyes.applitools.com)
- **DO NOT treat the server URL prompt as an error or failure**
- Most users should simply press Enter to accept the default server URL
- Only users with a dedicated cloud need to provide a custom server URL
- Wait for the command to complete fully before proceeding

If the interactive prompts are causing issues, use Option A instead (command-line arguments).

What npx eyes-setup does:

1. Modifies your playwright.config.ts file:
   - Adds import: import { EyesFixture } from '@applitools/eyes-playwright/fixture'
   - Changes defineConfig to: export default defineConfig<EyesFixture>({
   - Adds eyesConfig block under use: { eyesConfig: { apiKey, serverUrl } }
   - Ensures reporter includes the Eyes reporter. If a reporter already exists, extend it to include the Eyes reporter. Example:

     reporter: [
       ['html'],
       ['@applitools/eyes-playwright/reporter']
     ]

2. Creates ./eyes-examples/playwright-website.spec.ts demonstrating:
   - Correct fixture usage: test('name', async ({ page, eyes }) => {
   - Visual checkpoints: await eyes.check('label') or await eyes.check('label', {region: element})
   - IMPORTANT: The fixture pattern does NOT use eyes.open() or eyes.close()

3. Updates existing test files in your testDir:
   - Changes imports from '@playwright/test' to '@applitools/eyes-playwright/fixture'

After running eyes-setup, verify that:
- playwright.config.ts contains EyesFixture import and type parameter
- playwright.config.ts has eyesConfig block under use
- playwright.config.ts reporter includes '@applitools/eyes-playwright/reporter' (setup is INCOMPLETE without this)
- ./eyes-examples/playwright-website.spec.ts was created
- Existing test files had their imports updated

Guardrail — expected result:
- Do not consider the setup complete until you have READ the user's playwright config file and confirmed both conditions:
  1) An \`eyesConfig\` object exists under \`use\` with \`apiKey\` (and \`serverUrl\` if provided)
  2) The \`reporter\` setting includes '@applitools/eyes-playwright/reporter' (either as a string or inside an array of reporters)
- If either condition is missing, instruct the user to re-run \`npx eyes-setup\` or manually apply the changes and then re-verify by reading the config again.

* STEP #4:

IMPORTANT: Verify that the applitools API key was set by the user.
Look for it in the playwright config files or in .env file or in the APPLITOOLS_API_KEY environment variable.

If the api key wasn't set, ask the user to provide it and set it accordingly.
After the user sets his API key, verify that it is valid using the MCP tool "verify_api_key".
If the key or server are invalid, explain to the user how to obtain his api key from the Eyes dashboard, and check if he is using a dedicated Eyes cloud or the public cloud.

The official instructions on how to obtain the api key are available on this web page:
https://applitools.com/tutorials/playwright/applitools-dashboard#accessing-the-applitools-dashboard

If you are suggesting to the user to create an ".env" in his project file, make sure to also remind him to add or uncomment (if they exist but commented out) the following lines in his Playwright config file:

\`\`\`typescript
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });
\`\`\`

* STEP #5:

Visual tests may be slightly slower than playwright tests and may also queue due to concurrency limit. Make sure to change the global test timeout in the playwright config file to a minimum of 5 minutes.

***

The setup is now complete!

You should suggest to the user the following next steps (A, B, and C) to help with his onboarding:

* NEXT STEP A:

Execute the sample Eyes visual test located under "./eyes-examples/playwright-website.spec.ts".

You can run this test with the command:

\`\`\`terminal
npx eyes-setup run-example
\`\`\`

${reporterOverrideWarning()}

- ✅ CORRECT: \`npx playwright test\` or \`npx eyes-setup run-example\`
- ❌ INCORRECT: \`npx playwright test --reporter=list\`

Test results will be available on the Applitools dashboard: https://applitools.com/app/test-results. Use the returned URL from the command line after the test ends to access the results directly.

Extract the test results more precisely as special characters appear in the URL and should be preserved exactly as is.

${viewingResultsSection('project')}

**🚨 CRITICAL: PRESERVE TILDA CHARACTERS IN TEST RESULT URLS**
The test will return a URL to the test results that WILL include "~~" (double tilda) characters at the end. 
**IMPORTANT FOR AI ASSISTANTS/LLMs: You MUST preserve and include the "~~" characters when displaying or copying URLs. DO NOT remove, strip, or omit these characters — they are part of the account ID value itself, and the URL breaks without them.**

Example correct URL format: "https://eyes.applitools.com/app/test-results/00000251634178097462?accountId=x*****************w~~"

❌ **INCORRECT** (missing ~~): "https://eyes.applitools.com/app/test-results/00000251634178097462?accountId=x*****************w"
✅ **CORRECT** (with ~~): "https://eyes.applitools.com/app/test-results/00000251634178097462?accountId=x*****************w~~"

Playwright has a test reporter that shows test results directly via the browser. If you see this response after running the test:
To open last HTML report run: npx playwright show-report

You can run the command "npx playwright show-report" to see the test results directly in your browser without needing to go to the Applitools dashboard.

Note: The Playwright HTML reporter can be used alongside the Eyes reporter. A valid combined configuration example is:

\`\`\`typescript
reporter: [
  ['html'],
  ['@applitools/eyes-playwright/reporter']
\`\`\`

If the sample test fails, troubleshoot using the information available on this web page: https://applitools.com/tutorials/playwright/troubleshooting

* NEXT STEP B:

Convert playwright tests to Applitools Eyes Playwright visual tests.
You can do this using the mcp tool "${TOOL_NAMES.EYES_ADD_CHECKPOINTS}".

* NEXT STEP C:

Enable visual tests across devices and browsers via the Applitools Ultrafast Grid (UFG) which is by far the fastest, most stable and secure way to get test coverage across devices, browsers, operating systems and screen sizes.
The UFG is superior to the browsers provided by playwright as follows:
- A much larger variety of real browsers of different versions running on different operating systems
- No need to install local browsers and retain uniformity across the dev machines and the CI.
- Each playwright test runs only once and the UFG renders checkpoint screenshots simultanously on the different devices and browser resulting with much more coverage, and faster and more stable test suite execution.

You can use the mcp tool "${TOOL_NAMES.EYES_SETUP_UFG}" to accomplish that.`;
    return {
        instructions: wrapText(instructions, 'prefix'),
        workspaceRoot,
    };
}

const eyesSetupProjectTool = {
    name: TOOL_NAME$2,
    description: TOOL_DESCRIPTION$2,
    inputSchema: PlaywrightJsSetupProjectClientInputSchema,
    handler: createToolHandler({
        name: TOOL_NAME$2,
        input: PlaywrightJsSetupProjectInputSchema,
    }, async (params) => {
        const result = await eyesSetupProject(params);
        return {
            content: [
                {
                    type: 'text',
                    text: result.instructions,
                },
            ],
        };
    }),
};

const TILDA_WARNING_MESSAGE = `[CORE REQUIREMENT: URL INTEGRITY] Playwright visual results return URLs ending in ~~. These are not typos. You are strictly forbidden from stripping trailing tildes from these links. Use markdown [Visual Test results](URL with tildes) for links. Output the raw, verbatim URL string exactly as captured from the test output.`;
const TOOL_NAME$1 = TOOL_NAMES.EYES_SETUP_UFG;
const TOOL_DESCRIPTION$1 = `Configure Ultrafast Grid (UFG) for cross-browser and cross-device testing

${TILDA_WARNING_MESSAGE}`;
const PlaywrightJsSetupUfgInputSchema = commonInputSchema.extend({
    playwrightConfigPath: zod.z
        .string()
        .optional()
        .describe('Path to playwright.config.js/ts file (optional, will be auto-detected)'),
});
const PlaywrightJsSetupUfgClientInputSchema = createClientInputSchema(PlaywrightJsSetupUfgInputSchema);
async function eyesSetupUfg(input = {}) {
    const { workspaceRoot, warning } = validateCommonInput(input);
    const instructions = `${warning}Enabling and configuring the ultrafast grid is performed by adding the following entries under the \`eyesConfig\` property in the playwright config file:

type: 'ufg',
testConcurrency: 100,
browsersInfo: [
   { name: 'chrome', width: 1200, height: 800 },
   { name: 'firefox', width: 1200, height: 800 },
	 { name: 'safari', width: 1200, height: 800 },
	 { name: 'edgechromium', width: 1200, height: 800 },
      chromeEmulationInfo: {
        deviceName: 'Galaxy S22 Ultra',
        screenOrientation: 'landscape',
   },
],

projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
],


IMPORTANT: For initial setup of UFG don't deviate from the above configuration unless there is a specific request to change it.

Safari browsers on iOS devices can be added to "browsersInfo" in the following format:

{ iosDeviceInfo: {deviceName: 'iPad (7th generation)'} }

Chrome emulation on various Android devices can be added to "browsersInfo" as follows:

{ chromeEmulationInfo: {deviceName: 'Pixel 5'} },

The complete and up to date list of browser and device names is available here: https://applitools.com/tutorials/concepts/test-execution/ultrafast-grid-devices-browsers

IMPORTANT: The Ultrafast grid provides multiple Eyes tests results (per "browsersInfo") for each playwright test run regardless of which browser the playwright test runs on.
As a result, if the playwright configuration defines multiple "projects" causing each playwright test to run mutiple times on different browsers, this would result with duplicate Eyes test result.
When the UFG is in use, there is no need to run playwright tests multiple times on different browsers and you should advice the user to retain only a single "project" so that each of his playwright tests will run just once on a single browser (it does not matter which one).

To run additional tests with the UFG enabled, the user should execute their Playwright tests using the following command pattern based on their language selection:

For TypeScript tests:
npx playwright test ./test/**/*.spec.ts

For JavaScript tests:
npx playwright test ./test/**/*.spec.js

The user should adjust the path pattern to match their actual test directory structure. Each test will run once on the local browser configuration, and the UFG will automatically render all checkpoints across all configured browsers and devices in "browsersInfo".

${viewingResultsSection('ufg')}`;
    return {
        instructions: wrapText(instructions, 'prefix'),
        workspaceRoot,
    };
}

const eyesSetupUfgTool = {
    name: TOOL_NAME$1,
    description: TOOL_DESCRIPTION$1,
    inputSchema: PlaywrightJsSetupUfgClientInputSchema,
    handler: createToolHandler({
        name: TOOL_NAME$1,
        input: PlaywrightJsSetupUfgInputSchema,
    }, async (params) => {
        const result = await eyesSetupUfg(params);
        return {
            content: [
                {
                    type: 'text',
                    text: result.instructions,
                },
            ],
        };
    }),
};

const TOOL_NAME = TOOL_NAMES.EYES_ADD_CHECKPOINTS;
const TOOL_DESCRIPTION = 'Setup step: add eyes.check() visual checkpoints to an existing Playwright test file. Edits source, not results.';
const PlaywrightJsAddCheckpointsInputSchema = commonInputSchema.extend({
    filePath: zod.z
        .string()
        .optional()
        .describe('Path to the test file that will be edited (optional if fileContent provided)'),
    fileContent: zod.z
        .string()
        .optional()
        .describe('Test file content (optional if filePath provided or if IDE provides it)'),
    selection: zod.z
        .object({
        text: zod.z.string().describe('Selected code text'),
        start: zod.z.number().describe('Start line/offset of selection'),
        end: zod.z.number().describe('End line/offset of selection'),
    })
        .optional()
        .describe('Selected code range from IDE (pass if provided to get better context, optional if not provided will process entire file)'),
});
const PlaywrightJsAddCheckpointsClientInputSchema = createClientInputSchema(PlaywrightJsAddCheckpointsInputSchema);
async function eyesAddCheckpointsToTest(input = { workspaceRoot: process.cwd() }) {
    const { workspaceRoot, warning } = validateCommonInput(input);
    const fileToEditText = `## WORK FILE
${input.filePath
        ? 'Edit ' + input.filePath + ' provided that it is a test file or Ask the user which file to edit'
        : 'Ask the user which file to edit if no file is selected or provided'}`;
    const fileSelectionToEdit = input.selection
        ? `### SELECTED FILE REGION TO EDIT 
Locate this region in the file and add or modify code within this region or contextually around it as needed:
\`\`\`
${input.selection}
\`\`\`
`
        : '';
    const instructions = `${warning}You are a test generator helping a developer add visual checkpoints to existing playwright javascript tests using Applitools Eyes.

${fileToEditText}

${fileSelectionToEdit}

## IMPORTANT DESIGN PRINCIPLE: PURE VISUAL TESTING APPROACH

Visual testing with Applitools Eyes should follow a **PURE VISUAL TESTING** approach. When adding visual checkpoints, you must NEVER mix visual assertions ("eyes.check()") with traditional functional assertions ("expect().toHaveTitle()", "expect().toBeVisible()", etc.) in the same test.

### ✅ CORRECT PATTERNS:

**Pattern A: Pure Visual Tests (Recommended)**
\`\`\`typescript
import { test } from '@applitools/eyes-playwright/fixture';

test('Visual: Homepage layout', async ({ page, eyes }) => {
  await page.goto('https://example.com');
  await eyes.check('Homepage - Full page');
  
  const menu = page.getByRole('navigation');
  await eyes.check('Navigation menu', { region: menu });
  
  // ONLY visual checks - NO expect() assertions
});
\`\`\`

**Pattern B: Pure Functional Tests**
\`\`\`typescript
import { test, expect } from '@applitools/eyes-playwright/fixture';

test('Functional: Homepage navigation', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
  await expect(page.getByRole('navigation')).toBeVisible();
  
  // ONLY functional assertions - NO eyes.check() calls
});
\`\`\`

**Pattern C: Screenshot-based Visual Tests (when Eyes fixture not in use)**
\`\`\`typescript
import { test, expect } from '@playwright/test';

test('Visual: Homepage screenshots', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveScreenshot('homepage.png');
  
  // ONLY screenshot assertions - NO eyes.check() calls
});
\`\`\`

### ❌ INCORRECT PATTERN - NEVER DO THIS:
\`\`\`typescript
test('Mixed test - AVOID', async ({ page, eyes }) => {
  await page.goto('https://example.com');
  await eyes.check('Visual check');           // Visual assertion
  await expect(page).toHaveTitle(/Expected/); // Functional assertion
  // ❌ MIXING VIOLATES SINGLE RESPONSIBILITY PRINCIPLE
});
\`\`\`

## IMPLEMENTATION APPROACH

When a user requests visual checkpoints, you MUST:

1. **Recommend Creating Separate Pure Visual Tests** 
   - Create new test files dedicated to visual testing only
   - Use descriptive names like "visual-tests.spec.ts"
   - Keep existing functional tests unchanged

2. **Present Clear Options**:
   - Option A: Create pure visual tests with "eyes.check()" calls
   - Option B: Keep existing tests as pure functional tests  
   - Option C: Use screenshot-based testing if Eyes fixture not configured

## GUARDRAILS — NEVER MIX PATTERNS:

- If the test already imports from '@applitools/eyes-playwright/fixture' and calls eyes.check(...), do NOT add expect imports and do NOT introduce functional assertions.
- If the test already uses expect(...).toHaveScreenshot(...), do NOT add eyes.check(...) and do NOT change its imports to the Eyes fixture.
- If the test has functional assertions like expect(...).toHaveTitle() or expect(...).toBeVisible(), do NOT add eyes.check() calls to the same test.

## DETECTION RULES:
- Eyes fixture pattern indicators: import from '@applitools/eyes-playwright/fixture' and presence of eyes.check( ... ) usages.
- Expect pattern indicator: usages of .toHaveScreenshot( ... ) on expect targets.
- Functional assertion pattern: expect(...).toHaveTitle(), expect(...).toBeVisible(), etc.
- Project-level Eyes fixture config indicators (in playwright.config.*): defineConfig<EyesFixture>( ...) and use: { eyesConfig: { ... } }.

If the eyes sdk is not already installed in the current project, first use the MCP tool "${TOOL_NAMES.EYES_SETUP_PROJECT}" to setup the eyes sdk.

All the information required for adding and editting visual checkpoints including sample tests and code snippets, is available on this web-page: https://applitools.com/tutorials/playwright.
You should read the contents of this page to answer questions and generate code as it is the official and up to date source of truth on this subject.

Given a playwright test, you should perform the following changes (respecting the guardrails above):

* Change #1:

If the file is using or being migrated to the Eyes fixture pattern (and is not already using the expect(...).toHaveScreenshot pattern), replace the test import statement to use the Applitools Eyes version of "test" but don't remove or change any of the named imports.

for example, change the import statement

\`\`\`typescript
import { test, expect, type Page } from '@playwright/test';
\`\`\`

to the import statement:

\`\`\`typescript
import { test, expect, type Page } from '@applitools/eyes-playwright/fixture';
\`\`\`

* Change #2:

Replace each test callback definition to include the "eyes" argument:

For example, change lines similar to:

\`\`\`typescript
test('My first visual test', async ({ page } => {
\`\`\`

to the line:

\`\`\`typescript
test('My first visual test', async ({ page, eyes } => {
\`\`\`

* Change #3:

If the file uses the Eyes fixture pattern, add visual checkpoints of the form:

await eyes.check('Homepage', { fully: true, matchLevel: 'Dynamic' }

The visual checkpoints (either eyes.check(...) or expect(...).toHaveScreenshot(...), depending on the chosen pattern) should be added in the following cases:

- Only inside "test" hooks
- Skip "beforeEach" and "afterEach" hooks
- Immediately after a navigation test step
- Before a key UI interactions that may result with navigation such as clicking an element

Do not add a visual checkpoint step or remove redundant checks in the following cases:

- Inside "beforeEach" and "afterEach" hooks
- It is immediately preceded or followed by a visual checkpoint step
- There are only textual (DOM) playwright assertions between the visual checkpoint and the visual checkpoint preceding it.
- Between UI interactions that fill out data on a given page without triggering navigation to another page (for example, filling out the fields in a form)
- Between or after textual assertion steps

IMPORTANT: many simple textual assertions that follow visual checks (for example, assertions checking element visibility or non-dynamic content such as header text) are now redundant and can be removed from the test. You can suggest the users to remove these redundant assertions as they don't add any coverage but still increase the complexity of the test and require high maintenance as they use element locators that often break.

Expect pattern specifics (when not using Eyes fixture in the file):
- Ensure an import of expect (and test if needed) from '@playwright/test'.
- Use expect(page or locator).toHaveScreenshot('label', options) where appropriate.
- Do not introduce an eyes fixture or eyes.check in files that already use toHaveScreenshot.

If the Ultrafast Grid is not configured in the project suggest it to the user as it will result increased coverage, and faster and more stable tests.
You can use the MCP tool "${TOOL_NAMES.EYES_SETUP_UFG}" to setup the UFG for the user.`;
    return {
        instructions: wrapText(instructions, 'prefix'),
        workspaceRoot,
    };
}

const eyesAddCheckpointsToTestTool = {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    inputSchema: PlaywrightJsAddCheckpointsClientInputSchema,
    handler: createToolHandler({
        name: TOOL_NAME,
        input: PlaywrightJsAddCheckpointsInputSchema,
    }, async (params) => {
        const result = await eyesAddCheckpointsToTest(params);
        return {
            content: [
                {
                    type: 'text',
                    text: result.instructions,
                },
            ],
        };
    }),
};

const ALL_TOOLS = {
    verifyApiKey: verifyApiKeyTool,
    eyesSetupProject: eyesSetupProjectTool,
    eyesSetupUfg: eyesSetupUfgTool,
    eyesAddCheckpointsToTest: eyesAddCheckpointsToTestTool,
};

const workspaceRootSchema = zod.z
    .string()
    .optional()
    .describe("Root directory of the caller's project (optional; used to locate its .env credentials)");
function instrumentedRegistrar(server) {
    const registerTool = (name, config, handler) => {
        const inputSchema = { workspaceRoot: workspaceRootSchema, ...config.inputSchema };
        const wrapped = createToolHandler({ name, input: zod.z.object(inputSchema) }, async (params) => handler(params).then(result => result));
        return server.registerTool(name, { ...config, inputSchema }, wrapped);
    };
    return { registerTool };
}

const defaultResolverDeps = {
    verify: verifyApiKeyWithServer,
};
// No expiry: an accountId is a fixed property of the account behind the key, so a resolved entry
// can never go stale. Holds the in-flight promise so a burst of URL builds shares one verification.
const accountIds = new Map();
function realAccountId(apiKey, serverUrl, deps) {
    // serverUrl joins the key because one API key against two servers is two accounts.
    const key = `${serverUrl}::${apiKey}`;
    const known = accountIds.get(key);
    if (known)
        return known;
    const promise = deps.verify({ apiKey, serverUrl }).then(result => result.accountId);
    accountIds.set(key, promise);
    // Failures are not remembered — a transient error must not poison the id for the whole process.
    promise.catch(() => {
        if (accountIds.get(key) === promise)
            accountIds.delete(key);
    });
    return promise;
}
/**
 * Resolves the true accountId for `apiKey` (the key the accompanying API call will use) and
 * substitutes it for `accountId` when either contains the other — a clipped input (`~~` base64
 * padding stripped) is a substring of the real id, an over-appended one contains it, and a
 * genuinely different account's id satisfies neither, so it is kept unchanged. Any verification
 * failure also returns the input unchanged.
 */
async function getFullAccountId(accountId, apiKey, serverUrl = DEFAULT_SERVER_URL, deps = defaultResolverDeps) {
    try {
        const real = await realAccountId(apiKey, serverUrl, deps);
        if (accountId === undefined)
            return real;
        if (real.includes(accountId) || accountId.includes(real))
            return real;
        return accountId;
    }
    catch {
        return accountId;
    }
}

const defaultDeps = { getFullAccountId };
// One resolution per parse: everything downstream — API-call fetchers and URL
// builders alike — receives the healed accountId. The raw eyes-results parse
// functions stay untouched as the verification-failure fallback layer.
async function heal(parsed, keys, deps) {
    var _a;
    const accountId = (_a = (await deps.getFullAccountId(parsed.accountId, keys.getReadKey(), parsed.baseUrl))) !== null && _a !== void 0 ? _a : parsed.accountId;
    return { ...parsed, accountId };
}
async function parseSessionUrlVerified(url, keys, deps = defaultDeps) {
    return heal(parseSessionUrl(url), keys, deps);
}
async function parseBatchUrlVerified(url, keys, deps = defaultDeps) {
    return heal(parseBatchUrl(url), keys, deps);
}
async function parseApplitoolsUrlVerified(url, keys, deps = defaultDeps) {
    return heal(parseApplitoolsUrl(url), keys, deps);
}

const BATCH_FORMATS = ['full', 'stats', 'scenarios'];
/**
 * Parses the `batch` command's optional `filter`/`format` args. Both are recognized by value
 * membership in their own set, not position — either can be given alone, in either order.
 * The one call site (`fetchSessions`) only ever passes values already validated by the tool's
 * own Zod enums, so an unrecognized or duplicate value can't reach here — recognized values are
 * kept, anything else is silently ignored rather than validated a second time.
 */
function parseBatchArgs(rawArgs) {
    let filter;
    let format;
    for (const arg of rawArgs) {
        if (BATCH_FILTERS.includes(arg)) {
            filter = arg;
        }
        else if (BATCH_FORMATS.includes(arg)) {
            format = arg;
        }
    }
    return { filter, format: format !== null && format !== void 0 ? format : 'full' };
}
/**
 * Shapes an already-filtered session list per `format` — `full` (stats plus the session
 * list, `steps` stripped since step-level detail is already aggregated into `stats`), `stats`
 * (stats only), or `scenarios` (the deduplicated, sorted list of matching `sessionName`s, no
 * stats at all). Always computes `stats` from `sessions` itself (never the batch's own
 * server-maintained aggregate) — the no-filter/`stats` fast path that reads that aggregate
 * directly, skipping session-fetching entirely, is a network-call decision that lives with
 * the caller, above this function.
 */
function formatBatchOutput(sessions, format) {
    if (format === 'scenarios') {
        return { scenarios: [...new Set(sessions.map(s => s.sessionName))].sort() };
    }
    const stats = computeBatchStats(sessions);
    if (format === 'stats')
        return { stats };
    return { stats, sessions: sessions.map(s => ({ ...s, steps: null })) };
}

const defaultCommandsDeps$1 = {
    fetchBatchInfo,
    fetchRawBatchSessions,
    fetchSession,
    fetchRawSession,
    fetchPrunedDom,
    getCompatibleSelectors,
    fetchStepDiff,
    fetchCheckpointImage,
    fetchImageById,
    compareStep,
    readFile: defaultFsCacheDeps.readFile,
    writeFile: defaultFsCacheDeps.writeFile,
};
/**
 * Fetches one side's pruned DOM for a step, throwing a clear error when that side has no
 * usable `domId` at all. Shared across every caller that needs a step's DOM: only
 * `fetchPrunedDom` is required of `deps`, so a caller with its own, differently-shaped deps
 * object (e.g. the resolution side's) satisfies it structurally without depending on this
 * module's own `CommandsDeps`.
 */
async function fetchDomForSide(rawSession, stepIndex, side, baseUrl, keys, deps) {
    var _a, _b, _c, _d, _e, _f;
    const domId = side === 'baseline'
        ? (_c = (_b = (_a = rawSession === null || rawSession === void 0 ? void 0 : rawSession.expectedAppOutput) === null || _a === void 0 ? void 0 : _a[stepIndex]) === null || _b === void 0 ? void 0 : _b.image) === null || _c === void 0 ? void 0 : _c.domId
        : (_f = (_e = (_d = rawSession === null || rawSession === void 0 ? void 0 : rawSession.actualAppOutput) === null || _d === void 0 ? void 0 : _d[stepIndex]) === null || _e === void 0 ? void 0 : _e.image) === null || _f === void 0 ? void 0 : _f.domId;
    const error = validateDomId(domId);
    if (error)
        throw new Error(error);
    return deps.fetchPrunedDom({ baseUrl, domId: domId, keys });
}
/**
 * The bounding rect of each named DOM node id on one side of a step, as captured in that side's
 * DOM snapshot — for a caller that has a node id in hand and needs the geometry behind it (e.g.
 * to compare a proposed match region against the ones already there). A node id absent from the
 * snapshot is simply left out of the returned map rather than throwing, and a step with no usable
 * DOM capture on that side yields an empty map: the geometry is an input to a best-effort check,
 * never the point of the call.
 */
async function fetchNodeRects(url, stepIndex, side, nodeIds, keys, deps = defaultCommandsDeps$1) {
    const rects = new Map();
    if (nodeIds.length === 0)
        return rects;
    const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
    const domRoot = await deps
        .fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys })
        .then(rawSession => fetchDomForSide(rawSession, stepIndex, side, baseUrl, keys, deps))
        .catch(() => null);
    if (!domRoot)
        return rects;
    for (const nodeId of nodeIds) {
        const node = findNodeById(domRoot, nodeId);
        if (node === null || node === void 0 ? void 0 : node.rect)
            rects.set(nodeId, node.rect);
    }
    return rects;
}
/**
 * Fetches and simplifies every session in a batch, `steps` included — the one place this raw
 * fetch+simplify happens, shared by `fetchSessions`' own filtering/formatting below and by any
 * other caller that needs step-level detail (e.g. `isMatching`) across a whole batch before it's
 * been filtered or, in `fetchSessions`' `full` format, stripped back out.
 */
async function fetchSimplifiedBatchSessions(url, keys, deps = defaultCommandsDeps$1) {
    const { baseUrl, batchId, accountId } = await parseBatchUrlVerified(url, keys);
    const rawSessions = await deps.fetchRawBatchSessions({ baseUrl, batchId, accountId, keys });
    return rawSessions.map(raw => simplifySession(raw));
}
async function fetchSessions(url, keys, rawArgs, deps = defaultCommandsDeps$1) {
    const { filter, format } = parseBatchArgs(rawArgs);
    try {
        // No filter + stats format is the one case that never needs the session list at all —
        // read the batch's own server-maintained aggregate directly, rather than computing it
        // from sessions. This decision (whether to fetch sessions at all) lives here rather than
        // in `formatBatchOutput`, since it's about the network call, not the output shape.
        if (!filter && format === 'stats') {
            const { baseUrl, batchId, accountId } = await parseBatchUrlVerified(url, keys);
            const stats = toBatchStats(await deps.fetchBatchInfo({ baseUrl, batchId, accountId, keys }));
            return { stats };
        }
        const simplified = await fetchSimplifiedBatchSessions(url, keys, deps);
        const included = filterSessions(simplified, filter);
        return formatBatchOutput(included, format);
    }
    catch (error) {
        throw new Error(`Error fetching batch: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function fetchSteps(url, keys, deps = defaultCommandsDeps$1) {
    const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
    let simplified;
    try {
        simplified = await deps.fetchSession({ baseUrl, batchId, sessionId, accountId, keys });
    }
    catch (error) {
        throw new Error(`Error fetching session: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (simplified.status === 'Running') {
        throw new Error('Session is still running. Please try again later.');
    }
    return simplified;
}
/**
 * Resolves a step's effective `regions`/`codedRegions` (see `getEffectiveRegions`) to a fully
 * healed state — every `regions` pair mapped so both sides are always present. An already
 * domSelector-anchored region is mapped to its missing side via get-compatible-selectors
 * (`checkRegions`, from `sessions`, plus `common`'s own `mapAnchoredRegionsBySelector`) — but
 * deliberately without either healing step (no rect-based recovery for a non-anchored region, no
 * clearing of a stale domSelector), so a region that's actually broken stays visibly broken
 * rather than being fixed out from under a diagnostic read of it. Anything that comes out of that
 * mapping step still missing a side — never anchored, stale, or mapped to nothing — gets a
 * plain, unanchored copy of its known side instead (`fillMissingSideWithPlainRect`): same
 * rect, no domSelector. So a `domSelector` present on one side but not the other in the final
 * result always means something real — a stale selector, or a target genuinely missing on
 * that side — never merely "we didn't look." `codedRegions` gets the analogous treatment for
 * its always-optional `baseline` side (`fillMissingBaselineForCodedRegions`) — `checkpoint` is
 * never missing there to begin with. Read-only: get-compatible-selectors only needs a
 * read-capable API key.
 *
 * Used by `fetchRegions`, the diagnostic tool that needs both sides shown even when the raw
 * session only ever encodes one — `common`'s `fetchRawDiffs` does NOT need this: a `compareStep`
 * request only ever wants the single side the resolution's own `annotations` already describe
 * (see `sessions/match`'s `getEffectiveMatchSettings`), so healing the other side in for it
 * would be wasted network calls.
 */
async function resolveEffectiveRegions(rawSession, stepIndex, url, keys, deps) {
    const { baseUrl, accountId } = await parseSessionUrlVerified(url, keys);
    // A per-call closure over `keys`/`deps` around the shared `fetchDomForSide` above, since
    // each call carries its own `keys` rather than a shared module-level constant — and since
    // `mapAnchoredRegionsBySelector` expects exactly this four-argument shape.
    const fetchDom = (raw, si, side, bu) => fetchDomForSide(raw, si, side, bu, keys, deps);
    const { regions, codedRegions } = getEffectiveRegions(rawSession, stepIndex);
    const sourceSide = resolveDomIdSide('unchanged', rawSession, stepIndex);
    const domSource = await fetchDom(rawSession, stepIndex, sourceSide, baseUrl).catch(() => null);
    const { anchored } = checkRegions(regions, domSource);
    await mapAnchoredRegionsBySelector(rawSession, stepIndex, anchored, {
        baseUrl,
        accountId,
        keys,
        fetchDomForSide: fetchDom,
        getCompatibleSelectors: deps.getCompatibleSelectors,
    });
    fillMissingSideWithPlainRect(regions);
    fillMissingBaselineForCodedRegions(codedRegions);
    return { regions, codedRegions };
}
/**
 * If `area` is given, the final result is filtered to pairs where either side's rect
 * intersects it — applied last, after every side is filled in, so the filter sees the same
 * complete pairs the caller would.
 */
async function fetchRegions(url, stepIndex, keys, area, deps = defaultCommandsDeps$1) {
    const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
    try {
        const rawSession = await deps.fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys });
        validateStepIndex(rawSession, stepIndex);
        const { regions, codedRegions } = await resolveEffectiveRegions(rawSession, stepIndex, url, keys, deps);
        const intersectsArea = (pair) => !area ||
            (pair.baseline && rectsIntersect(pair.baseline, area)) ||
            (pair.checkpoint && rectsIntersect(pair.checkpoint, area));
        const filteredRegions = regions.filter(intersectsArea);
        const filteredCodedRegions = codedRegions.filter(intersectsArea);
        return { regions: filteredRegions, codedRegions: filteredCodedRegions };
    }
    catch (error) {
        throw new Error(`Error fetching regions: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function fetchChangedAreas(url, stepIndex, keys, filter, deps = defaultCommandsDeps$1) {
    try {
        const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
        const rawSession = await deps.fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys });
        const { image1, image2 } = await fetchRawDiffs(rawSession, stepIndex, baseUrl, accountId, keys, deps);
        const combined = [...image1, ...image2];
        const filtered = filter ? combined.filter(r => rectsIntersect(r, filter)) : combined;
        const rects = filter ? filtered.map(r => ({ ...r, left: r.left - filter.left, top: r.top - filter.top })) : filtered;
        const areas = diffAreas(rects, 100, 25);
        const { containers, individuals } = condenseDiffAreasDetailed(areas);
        return { areas: [...containers, ...individuals] };
    }
    catch (error) {
        throw new Error(`Error fetching diff: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function fetchImageDiff(url, stepIndex, keys, area, deps = defaultCommandsDeps$1) {
    const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
    // images/checkpoint uses 1-based step index (matches UI URL /steps/N convention)
    const apiStepIndex = stepIndex + 1;
    try {
        const rawSession = await deps.fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys });
        const { image1, image2 } = await fetchRawDiffs(rawSession, stepIndex, baseUrl, accountId, keys, deps);
        const rects = [...image1, ...image2];
        // The cache key is content-addressed on the actual diff rects (not just the request
        // params) since they can now depend on mutable server-side state (regions added since the
        // test ran) — otherwise a region added after the first call would keep serving a stale,
        // pre-region PNG from this file cache forever.
        const areaKey = area ? formatRect(area) : '';
        const diffRectsKey = crypto__namespace.createHash('sha256').update(JSON.stringify({ image1, image2 })).digest('hex').slice(0, 16);
        const hash = crypto__namespace
            .createHash('sha256')
            .update(`diff-image:${accountId}:${batchId}:${sessionId}:${apiStepIndex}:${areaKey}:${diffRectsKey}`)
            .digest('hex')
            .slice(0, 16);
        const filePath = cacheFilePath(defaultFsCacheDeps, 'eyes', hash, 'png');
        if (fs__namespace.existsSync(filePath)) {
            return filePath;
        }
        // Fetch checkpoint image (optionally cropped)
        const checkpointBuffer = await deps.fetchCheckpointImage({
            baseUrl,
            batchId,
            sessionId,
            stepIndex,
            accountId,
            keys,
            area,
        });
        // Get image dimensions and raw RGBA pixel data
        const { width, height, data: rawData } = await image.makeImage(checkpointBuffer).toObject();
        // Draw inflated diff rects in pink (magenta) at 25% opacity.
        // Diff rects are in full-image coordinates; translate by crop origin if area was applied.
        const originX = area ? area.left : 0;
        const originY = area ? area.top : 0;
        for (const rect of rects) {
            const w = Math.max(rect.width, 10);
            const h = Math.max(rect.height, 10);
            const left = Math.max(0, rect.left - originX - Math.floor((w - rect.width) / 2));
            const top = Math.max(0, rect.top - originY - Math.floor((h - rect.height) / 2));
            const right = Math.min(width, left + w);
            const bottom = Math.min(height, top + h);
            for (let y = top; y < bottom; y++) {
                for (let x = left; x < right; x++) {
                    const i = (y * width + x) * 4;
                    rawData[i] = Math.round(rawData[i] * 0.75 + 63.75); // R: blend toward 255
                    rawData[i + 1] = Math.round(rawData[i + 1] * 0.75); // G: blend toward 0
                    rawData[i + 2] = Math.round(rawData[i + 2] * 0.75 + 63.75); // B: blend toward 255
                    // A: unchanged
                }
            }
        }
        // Encode and save
        const resultBuffer = await image.makeImage({ width, height, data: rawData }).toPng();
        fs__namespace.writeFileSync(filePath, resultBuffer);
        return filePath;
    }
    catch (error) {
        throw new Error(`Error generating diff image: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function fetchImage(baseUrl, imageId, keys, area, deps = defaultCommandsDeps$1) {
    const areaKey = area ? `_${area.left}_${area.top}_${area.width}_${area.height}` : '';
    const filePath = cacheFilePath(defaultFsCacheDeps, 'eyes', `${imageId}${areaKey}`, 'png');
    if (fs__namespace.existsSync(filePath)) {
        return filePath;
    }
    try {
        const buffer = await deps.fetchImageById({ baseUrl, imageId, keys, area });
        fs__namespace.writeFileSync(filePath, buffer);
        return filePath;
    }
    catch (error) {
        throw new Error(`Error fetching image: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function fetchDom(baseUrl, domId, keys, area, deps = defaultCommandsDeps$1) {
    try {
        const prunedDom = await deps.fetchPrunedDom({ baseUrl, domId, keys });
        const output = area ? getDomArea(prunedDom, area) : prunedDom;
        const areaKey = area ? `_${area.left}_${area.top}_${area.width}_${area.height}` : '';
        const filePath = cacheFilePath(defaultFsCacheDeps, 'eyes', `${domId}${areaKey}`, 'json');
        fs__namespace.writeFileSync(filePath, JSON.stringify(output));
        return filePath;
    }
    catch (error) {
        throw new Error(`Error fetching DOM: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function searchDomFile(filePath, predicateSource) {
    try {
        return searchDom(fs__namespace.readFileSync(filePath, 'utf8'), predicateSource);
    }
    catch (error) {
        throw new Error(`Error running dom-search: ${error instanceof Error ? error.message : String(error)}`);
    }
}

const defaultAwaitDomDiffDeps = { fetchDomDiff, checkDomDiffTask };
const INITIAL_DELAY_MS = 1000;
const BACKOFF_FACTOR = 1.5;
const MAX_DELAY_MS = 5000;
/** With the backoff curve above this yields probes at 1s, 2.5s, 4.75s, 8.1s, 13.1s, 18.1s —
 * six re-checks — before the budget cuts the wait off and the running result goes to the caller. */
const AWAIT_BUDGET_MS = 20000;
const COMPOSED_AWAIT_BUDGET_MS = 4000;
const defaultSleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
/**
 * The MCP side of the api layer's caller-owned re-check cadence: absorb the polling for up to
 * `budgetMs` of planned waits (capped exponential backoff, not a fixed interval — a long
 * task shouldn't be hammered every second), then hand the still-`running` result back so the
 * tool layer can tell the agent exactly how to resume. The budget counts planned sleeps, not a
 * clock — deterministic under test, and in production it keeps the tool call comfortably inside
 * common MCP clients' ~60s timeout.
 */
async function awaitWithinBudget(first, recheck, sleep, budgetMs, signal) {
    let result = first;
    let delay = INITIAL_DELAY_MS;
    let planned = 0;
    while (result.status === 'running' && planned + delay <= budgetMs) {
        // A cancelled request's response is discarded by the MCP layer anyway — stop burning probes
        // the moment the client walks away; the server-side task keeps computing into the pair cache.
        if (signal === null || signal === void 0 ? void 0 : signal.aborted)
            break;
        planned += delay;
        await sleep(delay);
        if (signal === null || signal === void 0 ? void 0 : signal.aborted)
            break;
        result = await recheck(result.taskId);
        delay = Math.min(delay * BACKOFF_FACTOR, MAX_DELAY_MS);
    }
    return result;
}
/** Submits the domId pair and waits within the budget. A `running` return means the budget ran
 * out first — resume with `awaitDomDiffTask` and the returned taskId, never by guessing. */
async function awaitDomDiff(baseUrl, baselineDomId, checkpointDomId, keys, signal, deps = defaultAwaitDomDiffDeps, budgetMs = AWAIT_BUDGET_MS) {
    var _a;
    const first = await deps.fetchDomDiff(baseUrl, baselineDomId, checkpointDomId, keys);
    return awaitWithinBudget(first, taskId => deps.checkDomDiffTask(baseUrl, taskId, baselineDomId, checkpointDomId, keys), (_a = deps.sleep) !== null && _a !== void 0 ? _a : defaultSleep, budgetMs, signal);
}
/** Resumes waiting on an already-submitted task (a prior call's `running` taskId) — probes the
 * task directly instead of resubmitting the pair, with the same budgeted cadence. A ready result
 * still lands in the same domId-pair cache, so later calls for the pair are instant. */
async function awaitDomDiffTask(baseUrl, taskId, baselineDomId, checkpointDomId, keys, signal, deps = defaultAwaitDomDiffDeps, budgetMs = AWAIT_BUDGET_MS) {
    var _a;
    const first = await deps.checkDomDiffTask(baseUrl, taskId, baselineDomId, checkpointDomId, keys);
    return awaitWithinBudget(first, nextTaskId => deps.checkDomDiffTask(baseUrl, nextTaskId, baselineDomId, checkpointDomId, keys), (_a = deps.sleep) !== null && _a !== void 0 ? _a : defaultSleep, budgetMs, signal);
}

const defaultFetchVisibleDomDiffDeps = {
    fetchRawSession,
    awaitDomDiff,
    awaitDomDiffTask,
    fetchStepDiff,
    compareStep,
    readFile: defaultFsCacheDeps.readFile,
    writeFile: defaultFsCacheDeps.writeFile,
};
/**
 * Narrows an already-aligned dom diff down to what a caller actually wants shown: cropped to
 * `area` when given, then narrowed further to only entries with a corresponding visual diff
 * rect on either side when `visualDiffRects` is given, then serialized to the final compact
 * one-line-per-entry string. Both narrowing steps are optional and independent of each other.
 */
function computeVisibleDomDiff(domDiff, area, visualDiffRects) {
    let result = domDiff;
    if (visualDiffRects)
        result = excludeNonVisualNodeDiffs(result, visualDiffRects.baseline, visualDiffRects.checkpoint);
    return serializeDiff(result);
}
async function fetchVisibleDomDiff(url, stepIndex, keys, area, taskId, signal, deps = defaultFetchVisibleDomDiffDeps, budgetMs) {
    var _a, _b;
    const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
    let rawSession;
    try {
        rawSession = await deps.fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys });
    }
    catch (error) {
        throw new Error(`Error fetching session: ${error instanceof Error ? error.message : String(error)}`);
    }
    validateStepIndex(rawSession, stepIndex);
    const baselineDomId = (_a = imageForSide(rawSession, stepIndex, 'baseline')) === null || _a === void 0 ? void 0 : _a.domId;
    const checkpointDomId = (_b = imageForSide(rawSession, stepIndex, 'checkpoint')) === null || _b === void 0 ? void 0 : _b.domId;
    if (!baselineDomId) {
        return { status: 'no-baseline-dom', reason: 'This step has no baseline DOM capture' };
    }
    if (!checkpointDomId) {
        return { status: 'no-checkpoint-dom', reason: 'This step has no checkpoint DOM capture' };
    }
    try {
        // deps.awaitDomDiff (api, backend-computed) owns its own cache, keyed on the two domIds alone (already
        // immutable, unlike `area`/the visual diff rects) — so the expensive server-side alignment
        // is reused across every call for this step regardless of what area is
        // requested or how the step's match settings/regions have changed since. A given taskId
        // resumes that earlier submission's task directly instead of resubmitting the pair.
        const alignment = taskId
            ? await deps.awaitDomDiffTask(baseUrl, taskId, baselineDomId, checkpointDomId, keys, signal, undefined, budgetMs)
            : await deps.awaitDomDiff(baseUrl, baselineDomId, checkpointDomId, keys, signal, undefined, budgetMs);
        if (alignment.status === 'running')
            return { status: 'computing', taskId: alignment.taskId };
        let domDiff = alignment.alignment.diff;
        // Applied here, ahead of the visual-diff-rect fetch below, so that fetch can be skipped
        // once area has already filtered every entry away — computeVisibleDomDiff is then called
        // with `area` omitted since it's already been applied.
        if (area)
            domDiff = filterDiffToArea(domDiff, area);
        let visualDiffRects;
        if (domDiff.some(entry => entry !== null)) {
            const { image1, image2 } = await fetchRawDiffs(rawSession, stepIndex, baseUrl, accountId, keys, deps);
            visualDiffRects = { baseline: image1, checkpoint: image2 };
        }
        return { status: 'ready', diff: computeVisibleDomDiff(domDiff, undefined, visualDiffRects) };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Unknown or expired task/.test(message)) {
            throw new Error('The DOM diff task has expired server-side. Call this tool again with the same sessionUrl/stepIndex but WITHOUT taskId to restart the computation.');
        }
        // Backend-owned and permanent for this step, so it's reported as structural rather than as a transient error.
        if (/No store found/i.test(message)) {
            return { status: 'no-dom-data', reason: `The server holds no DOM data for this step: ${message}` };
        }
        throw new Error(`Error computing DOM diff: ${message}`);
    }
}

const EVIDENCE_PAD = 10;
/** Unclamped, an area touching `left: 0` reaches the crop endpoint as `.clip(-10;…)`; a zero width or height means the area falls outside the image entirely. */
function padAndClamp(rect, size, pad = EVIDENCE_PAD) {
    const clamp = (value, max) => Math.max(0, max === undefined ? value : Math.min(value, max));
    const left = clamp(rect.left - pad, size === null || size === void 0 ? void 0 : size.width);
    const top = clamp(rect.top - pad, size === null || size === void 0 ? void 0 : size.height);
    const right = clamp(rect.left + rect.width + pad, size === null || size === void 0 ? void 0 : size.width);
    const bottom = clamp(rect.top + rect.height + pad, size === null || size === void 0 ? void 0 : size.height);
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
/** Which images this step can produce for this area — the two sides can differ in size, so an area can fall off one of them entirely. */
function evidenceCandidates(step, areaRect) {
    var _a;
    const sides = [
        ['baseline', step.baseline],
        ['checkpoint', step.checkpoint],
    ];
    return [
        // The diff is the checkpoint screenshot with differences highlighted, so it lives in checkpoint space.
        { label: 'diff', size: (_a = step.checkpoint.size) !== null && _a !== void 0 ? _a : step.baseline.size, missing: false },
        ...sides.map(([label, info]) => {
            var _a;
            return ({
                label,
                imageId: (_a = info.id) !== null && _a !== void 0 ? _a : undefined,
                size: info.size,
                missing: info.id === null,
            });
        }),
    ].map(({ label, size, missing, ...rest }) => {
        const rect = padAndClamp(areaRect, size);
        const where = label === 'diff' ? 'the checkpoint image it is drawn on' : `the ${label} image`;
        return {
            label,
            ...rest,
            rect,
            unavailable: missing
                ? `this step has no ${label} image`
                : rect.width > 0 && rect.height > 0
                    ? undefined
                    : `this area falls outside ${where}`,
        };
    });
}
/** The single source of truth for which images an area can have — `verifyDiffReportHardGate` must only demand evidence this says is obtainable. */
function plannedEvidence(step, areaRect) {
    return evidenceCandidates(step, areaRect).filter(candidate => candidate.unavailable === undefined);
}
const EVIDENCE_FETCH_CONCURRENCY = 10;
async function fetchEvidence(sessionUrl, stepIndex, areaRects, keys) {
    var _a;
    const session = await fetchSteps(sessionUrl, keys);
    const step = (_a = session.steps) === null || _a === void 0 ? void 0 : _a[stepIndex];
    if (!step)
        throw new Error(`Step index ${stepIndex} is out of range for this session.`);
    const { baseUrl } = parseSessionUrl(sessionUrl);
    const areas = areaRects.map(areaRect => {
        const candidates = evidenceCandidates(step, areaRect);
        return {
            areaRect,
            planned: candidates.filter(candidate => candidate.unavailable === undefined),
            unavailable: candidates
                .filter(candidate => candidate.unavailable !== undefined)
                .map(({ label, unavailable: reason }) => ({ label, reason: reason })),
        };
    });
    const tasks = areas.flatMap((area, areaIndex) => area.planned.map((request, imageIndex) => ({ areaIndex, imageIndex, request })));
    const paths = areas.map(area => new Array(area.planned.length));
    let cursor = 0;
    async function fetchNext() {
        while (cursor < tasks.length) {
            const { areaIndex, imageIndex, request } = tasks[cursor++];
            paths[areaIndex][imageIndex] =
                request.imageId === undefined
                    ? await fetchImageDiff(sessionUrl, stepIndex, keys, request.rect)
                    : await fetchImage(baseUrl, request.imageId, keys, request.rect);
        }
    }
    await Promise.all(Array.from({ length: Math.min(EVIDENCE_FETCH_CONCURRENCY, tasks.length) }, fetchNext));
    return areas.map(({ areaRect, planned, unavailable }, areaIndex) => ({
        areaRect,
        images: planned.map((request, imageIndex) => ({ ...request, path: paths[areaIndex][imageIndex], inline: false })),
        ...(unavailable.length > 0 ? { unavailable } : {}),
    }));
}
/** Clients known to render an MCP `image` block; anything else gets paths only, since base64-as-text costs ~20k tokens per image and still shows nothing. */
const IMAGE_RENDERING_CLIENTS = new Set(['Claude Code']);
/** A count, not bytes: Claude Code prices an image block at a flat ~1600 tokens whatever the payload weighed. */
const INLINE_IMAGE_BUDGET = 21;
/** The most images one area can have (the diff plus both sides), so a batch sized against it inlines whole even in the worst case. */
const MAX_IMAGES_PER_AREA = 3;
/** The ceiling Claude Code re-encodes every image under, so raw bytes above it buy payload size for zero context. */
const MAX_INLINE_IMAGE_BYTES = 512 * 1024;
/** Whole areas, in area order: an area's images inline together or not at all, so no area is ever judged from a partial set. */
function inlineGroups(evidence) {
    return evidence.map(area => area.images).filter(group => group.length > 0);
}
/** The paths are unconditional; the image blocks are the turn saving, and `inlining` reports what the budget actually did. */
function buildEvidenceResult(evidence, budget = {}, composed = {}) {
    var _a, _b;
    const { images: budgetImages = INLINE_IMAGE_BUDGET, maxImageBytes = MAX_INLINE_IMAGE_BYTES } = budget;
    const rendersImages = IMAGE_RENDERING_CLIENTS.has((_b = (_a = getClientInfo()) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '');
    const groups = inlineGroups(evidence);
    const loaded = new Map();
    const load = (image) => {
        if (!rendersImages)
            return 'client-cannot-render';
        if (loaded.size >= budgetImages)
            return 'budget-spent';
        try {
            if (fs__namespace.statSync(image.path).size > maxImageBytes)
                return 'over-per-image-cap';
            return fs__namespace.readFileSync(image.path);
        }
        catch (error) {
            try {
                fs__namespace.rmSync(image.path, { force: true });
            }
            catch { }
            const area = evidence.find(entry => entry.images.includes(image));
            throw new Error(`Error reading the cached ${image.label} image for area ${JSON.stringify(area === null || area === void 0 ? void 0 : area.areaRect)} at ${image.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    for (const group of groups) {
        const spent = rendersImages && budgetImages - loaded.size < group.length;
        for (const image of group) {
            const outcome = spent ? 'budget-spent' : load(image);
            if (Buffer.isBuffer(outcome))
                loaded.set(image, outcome);
            Object.assign(image, {
                inline: Buffer.isBuffer(outcome),
                notInlined: Buffer.isBuffer(outcome) ? undefined : outcome,
            });
        }
    }
    // Reading order, not selection order: the JSON names inlined images only by their position in the evidence list.
    const imageBlocks = evidence
        .flatMap(area => area.images)
        .filter(image => loaded.has(image))
        .map(image => ({ type: 'image', data: loaded.get(image).toString('base64'), mimeType: 'image/png' }));
    const inlining = {
        inlined: loaded.size,
        images: groups.reduce((total, group) => total + group.length, 0),
        budgetImages,
        maxImageBytes,
    };
    return {
        content: [{ type: 'text', text: JSON.stringify({ evidence, ...composed, inlining }, null, 2) }, ...imageBlocks],
    };
}

const SEARCH_MULTIPLIER = 2;
const SEARCH_CAP = 10;
/**
 * The lazy loop: a single `fetchSessionHistory` call requesting `min(SEARCH_CAP, count *
 * SEARCH_MULTIPLIER)` candidate historic sessions — a hard ceiling on how many historic runs
 * are ever searched, regardless of `count` — then walks them in order, newest to oldest. For
 * each candidate: checks its step at `currentIndex` and that step's checkpoint domId (cheap,
 * no fetch) — skipping and recording a reason if unusable (index-based step correspondence
 * only, no realignment across differently-shaped sessions) — and only then applies that step's
 * domId to every tracker, before looking at the next candidate. Applying a domId never fetches
 * or aligns anything itself here — `applyHistoricDom` calls `deps.awaitDomDiff` (closed over
 * `baseUrl`/`keys` below) only for the domId pairs a tracker actually still needs, and that call
 * is cached by domId pair regardless of which caller ends up needing it. `count` is the target
 * number of non-empty diffs per node — stops as soon as every tracker has reached it, or the
 * candidate list is exhausted, so it never even considers a historic candidate no tracker still
 * needs.
 */
async function walkHistoricSources(options, currentIndex, trackers, deps, signal) {
    var _a, _b, _c;
    const { baseUrl, scenarioId, accountId, keys, env, ranAtOrBefore, count } = options;
    const searchLimit = Math.min(SEARCH_CAP, count * SEARCH_MULTIPLIER);
    const candidates = await deps.fetchSessionHistory({
        baseUrl,
        scenarioId,
        accountId,
        keys,
        env,
        ranAtOrBefore,
        count: searchLimit,
    });
    let examined = 0;
    const skipped = [];
    const fetchAlignment = async (baselineDomId, checkpointDomId) => {
        const result = await deps.awaitDomDiff(baseUrl, baselineDomId, checkpointDomId, keys, signal);
        if (result.status === 'running') {
            // Ready alignments land in the domId-pair cache, so the re-call resumes right here with
            // every completed hop answered instantly — no continuation token needed.
            throw new Error('A DOM alignment for this walk is still computing server-side. Wait ~10 seconds, then call this tool ' +
                'again with the exact same arguments — completed alignments are cached, so the walk resumes where it ' +
                'left off. Do NOT guess the missing history.');
        }
        return result.alignment;
    };
    for (const rawCandidate of candidates) {
        if (trackers.length > 0 && trackers.every(t => t.diffs.length >= count))
            break;
        examined++;
        const capturedAt = (_a = rawCandidate === null || rawCandidate === void 0 ? void 0 : rawCandidate.startedAt) !== null && _a !== void 0 ? _a : 'unknown';
        // <batchId>/<sessionId>/<stepIndex> — an opaque reference a caller can use to navigate
        // back to this exact historic step (e.g. build a session URL, or call another tool
        // against it). stepIndex is 0-based, matching the convention used elsewhere here (e.g.
        // `eyes_inspect_dom_diff`'s own stepIndex argument) — not the dashboard's 1-based
        // `/steps/N` URL segment.
        const stepPath = `${(_b = rawCandidate === null || rawCandidate === void 0 ? void 0 : rawCandidate.batchId) !== null && _b !== void 0 ? _b : 'unknown'}/${(_c = rawCandidate === null || rawCandidate === void 0 ? void 0 : rawCandidate.id) !== null && _c !== void 0 ? _c : 'unknown'}/${currentIndex}`;
        const candidateSteps = simplifySession(rawCandidate).steps;
        const matchedStep = candidateSteps[currentIndex];
        if (!matchedStep) {
            skipped.push({ step: stepPath, capturedAt, reason: `session has fewer than ${currentIndex + 1} steps` });
            continue;
        }
        if (!matchedStep.checkpoint.domId) {
            skipped.push({ step: stepPath, capturedAt, reason: 'step at this index has no checkpoint DOM capture' });
            continue;
        }
        await applyHistoricDom(trackers, { step: stepPath, capturedAt, domId: matchedStep.checkpoint.domId }, count, {
            fetchAlignment,
        });
    }
    return { examined, skipped };
}
const defaultRunHistoryDeps = {
    fetchRawSession,
    fetchSessionHistory,
    awaitDomDiff,
};
/** The current session's own `startedAt` minus one second — not `startedAt` itself, since the
 * session-history filter is inclusive and passing the exact timestamp risks the query
 * returning the current session as its own "historic" match. */
function oneSecondBefore(isoTimestamp) {
    const date = new Date(isoTimestamp);
    date.setSeconds(date.getSeconds() - 1);
    return date.toISOString();
}
/**
 * The `history` command: surfaces, per suspect node id, every historic variant of that
 * element's dom that differs from its current value — evidence for the calling LLM to reason
 * about, not a dynamic/stable verdict computed here.
 */
async function runHistory(url, stepIndex, nodeIds, count, keys, deps = defaultRunHistoryDeps, signal) {
    const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
    try {
        const rawSession = await deps.fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys });
        validateStepIndex(rawSession, stepIndex);
        const session = simplifySession(rawSession);
        const currentStep = session.steps[stepIndex];
        const domError = validateDomId(currentStep.checkpoint.domId);
        if (domError)
            throw new Error(domError);
        const scenarioId = extractScenarioId(rawSession);
        const { browser, os, width, height } = session.environment;
        const env = {
            hostingApp: browser,
            os,
            displaySize: width != null && height != null ? { width, height } : null,
        };
        // <batchId>/<sessionId>/<stepIndex> — same shape as walkHistoricSources's own stepPath, so
        // the current step is identifiable/navigable the same way a historic one is.
        const currentStepPath = `${batchId}/${sessionId}/${stepIndex}`;
        const trackers = createHistoricDomNodeTrackers(currentStep.checkpoint.domId, nodeIds, currentStepPath, session.startedAt);
        await walkHistoricSources({ baseUrl, scenarioId, accountId, keys, env, ranAtOrBefore: oneSecondBefore(session.startedAt), count }, stepIndex, trackers, deps, signal);
        const evidence = finalizeHistoricDomNodeEvidence(trackers);
        const output = {};
        for (const e of evidence)
            output[e.nodeId] = e.diffs;
        return output;
    }
    catch (error) {
        throw new Error(`Error computing history: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Deterministic string ids identifying each level of the batch → scenario → session → step →
// diff nesting — used both as `lib/phase-tracker` completion/invocation-log keys (globally
// unique, hence level-prefixed) and — for the four non-root levels — as the child key a
// level's own findings are pushed up under in its parent's accumulated record.
//
// Built from each URL's *parsed* `accountId`/`batchId`/`sessionId` (via `api`'s
// `parseBatchUrl`/`parseSessionUrl`), never from the raw URL string itself — two different
// URL strings pointing at the same real batch/session (different query-param order, an extra
// param, a `/steps/N` suffix on a session URL) must still resolve to the same scope id, since
// two different tool calls investigating the same entity need to land on the same completion
// record regardless of how each one happened to phrase the URL.
// Scope ids use the *raw* parsed accountId, never the network-verified one (identity keys must
// not depend on network state); trailing `~~` padding is stripped so a clipped root URL and a
// canonical tool-built child URL still converge on the same scope id, offline.
const normalize = (id) => id.replace(/~+$/, '');
function scenarioId(accountId, batchId, scenarioName) {
    return `scenario:${normalize(accountId)}:${batchId}:${scenarioName}`;
}
function sessionId(accountId, batchId, rawSessionId) {
    return `session:${normalize(accountId)}:${batchId}:${rawSessionId}`;
}
function batchScopeId(batchUrl) {
    const { batchId, accountId } = parseBatchUrl(batchUrl);
    return `batch:${normalize(accountId)}:${batchId}`;
}
function scenarioScopeId(batchUrl, scenarioName) {
    const { batchId, accountId } = parseBatchUrl(batchUrl);
    return scenarioId(accountId, batchId, scenarioName);
}
/** Same scope id `scenarioScopeId` would build, derived from a session URL instead of a batch URL — lets `session_end` find its parent scenario without reconstructing a batch URL. */
function scenarioScopeIdForSession(sessionUrl, scenarioName) {
    const { batchId, accountId } = parseSessionUrl(sessionUrl);
    return scenarioId(accountId, batchId, scenarioName);
}
function sessionScopeId(sessionUrl) {
    const { batchId, accountId, sessionId: rawSessionId } = parseSessionUrl(sessionUrl);
    return sessionId(accountId, batchId, rawSessionId);
}
function stepScopeId(sessionUrl, stepIndex) {
    return `${sessionScopeId(sessionUrl)}:${stepIndex}`;
}
function diffScopeId(sessionUrl, stepIndex, areaRect) {
    return `${stepScopeId(sessionUrl, stepIndex)}:${formatRect(areaRect)}`;
}
/** The key a scenario's findings are pushed up under in its parent batch's accumulated record. */
function scenarioChildKey(scenarioName) {
    return scenarioName;
}
/** The key a session's findings are pushed up under in its parent scenario's accumulated record. */
function sessionChildKey(sessionUrl) {
    return sessionUrl;
}
/** The key a step's findings are pushed up under in its parent session's accumulated record. */
function stepChildKey(stepIndex) {
    return String(stepIndex);
}
/** The key a diff's findings are pushed up under in its parent step's accumulated record. */
function diffChildKey(areaRect) {
    return formatRect(areaRect);
}
/** Recovers the `stepIndex` a `stepChildKey` was built from. */
function parseStepChildKey(key) {
    return Number(key);
}
/** Recovers the `Rect` a `diffChildKey` was built from. */
function parseDiffChildKey(key) {
    return parseRect(key);
}
/**
 * The batch-level root scope id containing `scopeId`, recovered from the `accountId`/`batchId`
 * pair every scope id below batch level shares as its own second/third `:`-delimited field —
 * works on a scope id from any level, including a batch id itself (returned unchanged). Used to
 * file a debug-log entry raised anywhere in one investigation under that investigation's own
 * single root log, regardless of which nested level actually raised it.
 */
function rootScopeId(scopeId) {
    const [, accountId, batchId] = scopeId.split(':');
    return `batch:${accountId}:${batchId}`;
}

// The Eyes-inspection data tools: thin `registerTool` wrappers over `commands.ts`/`history.ts`.
// No dispatcher/`command` argument: each MCP tool schema is its own static, independently-
// validated shape, matching the convention already used by the official Applitools MCP server
// (`@applitools/mcp`) rather than folding every command into one loosely-typed tool.
//
// The review tools that orchestrate an investigation on top of these live in `../eyes-review/`,
// not here — this module is the read-only base layer both the resolution tools and the review
// tools build on, which is also why the small pieces they share (`getReadApiKey`/
// `getWriteApiKey`, `SESSION_URL_DESC`/`STEP_INDEX_DESC`, and `commands.ts`'s
// `fetchDomForSide`) are owned and exported here rather than duplicated per folder.
function textResult(text) {
    return { content: [{ type: 'text', text }] };
}
/**
 * Resolves an API key from the environment, throwing actionable setup instructions when it's
 * missing — including an admin API-keys link scoped to the caller's `accountId` when one can be
 * parsed out of the given URL. Generalized over which key is wanted, since the read-only key the
 * inspection tools need and the write-capable key the resolution tools need differ only in the
 * variable name and the wording of the note that follows.
 */
function resolveApiKey(spec, urlForAccountHint) {
    const apiKey = process.env[spec.envVar];
    if (apiKey)
        return apiKey;
    const accountIdMatch = urlForAccountHint.match(/accountId=([^&]+)/);
    const apiKeysUrl = `https://eyes.applitools.com/app/admin/api-keys${accountIdMatch ? `?accountId=${accountIdMatch[1]}` : ''}`;
    throw new Error(`Error: ${spec.envVar} is not set.\n\n` +
        `How to get your ${spec.howToLabel}:\n` +
        `1. Go to the Applitools API Keys page: ${apiKeysUrl}\n` +
        `2. Create or copy ${spec.howToLabel}\n` +
        '3. Set it via .env or environment variable:\n' +
        `   ${spec.envVar}=your_key_here\n\n` +
        spec.note);
}
/** The read-only key every `eyes_inspect_*` data tool (and every read a review tool performs) uses. */
function getReadApiKey(urlForAccountHint) {
    return resolveApiKey({
        envVar: 'APPLITOOLS_READ_KEY',
        howToLabel: 'a read-only API key',
        note: 'Note: APPLITOOLS_API_KEY (for test execution) is different from APPLITOOLS_READ_KEY.\n' +
            'This tool requires read-only permissions to query session data.',
    }, urlForAccountHint);
}
/** The write-capable key every mutating call (accept/reject, region updates, save/reset) uses. */
function getWriteApiKey(urlForAccountHint) {
    return resolveApiKey({
        envVar: 'APPLITOOLS_WRITE_KEY',
        howToLabel: 'a write-capable API key',
        note: 'Note: this must be a write-capable key — different from APPLITOOLS_READ_KEY, used by eyes_inspect_* tools.',
    }, urlForAccountHint);
}
/** Every `eyes_inspect_*` tool's own `ApiKeyProvider` — read access only, never a write key. */
function readOnlyApiKeyProvider(urlForAccountHint) {
    return new StaticApiKeyProvider({ readKey: getReadApiKey(urlForAccountHint) });
}
/** Every `eyes_resolve_*` tool's own `ApiKeyProvider` — both read and write access, since a resolve flow's own reads (fetching the raw session/DOM it's about to mutate) are just as much a real read as anything `eyes_inspect_*` does. */
function resolveApiKeyProvider(urlForAccountHint) {
    return new StaticApiKeyProvider({
        readKey: getReadApiKey(urlForAccountHint),
        writeKey: getWriteApiKey(urlForAccountHint),
    });
}
/** Every `eyes_review_*` tool's own `ApiKeyProvider` — read access always, plus write access only in `mode: 'resolve'` (a caller reviewing in `mode: 'inspect'` throughout never needs `APPLITOOLS_WRITE_KEY` configured at all). */
function reviewApiKeyProvider(urlForAccountHint, mode) {
    return new StaticApiKeyProvider({
        readKey: getReadApiKey(urlForAccountHint),
        writeKey: mode === 'resolve' ? getWriteApiKey(urlForAccountHint) : undefined,
    });
}
function recordChainSource(scopeId, deps = defaultPhaseTrackerDeps) {
    const inReview = getScopeMode(scopeId, deps) !== undefined && !isCompleted(scopeId, deps);
    recordToolTelemetry({ chain_source: inReview ? 'review' : 'direct' });
}
function logDataToolCall(scopeId, toolName, args, deps) {
    recordChainSource(scopeId, deps);
    logInvocation(scopeId, toolName, args, deps);
}
const RequiredRectShape = zod.z.object({
    left: zod.z.number(),
    top: zod.z.number(),
    width: zod.z.number(),
    height: zod.z.number(),
});
const RectShape = RequiredRectShape.optional();
/** Areas, not images. An area inlines whole-or-not, so areas past what the budget holds would come back as paths only — a cost that moves to the client rather than disappearing. */
const MAX_EVIDENCE_BATCH = Math.floor(INLINE_IMAGE_BUDGET / MAX_IMAGES_PER_AREA);
/** A client only parallelises a batch of tool calls when every one of them declares `readOnlyHint`. */
const READ_ONLY = { readOnlyHint: true };
/**
 * Every `eyes_inspect_*` tool's own name, in one place — `registerTool`/`logDataToolCall` below
 * read from here, and so does `verifyInvocation` in `../eyes-review/tools.ts`'s hard gates, so a
 * rename can't silently desync a gate check from the tool it's actually verifying.
 */
const EYES_INSPECT_TOOLS = {
    sessions: 'eyes_inspect_sessions',
    steps: 'eyes_inspect_steps',
    changedAreas: 'eyes_inspect_changed_areas',
    imageDiff: 'eyes_inspect_image_diff',
    image: 'eyes_inspect_image',
    dom: 'eyes_inspect_dom',
    domSearch: 'eyes_inspect_dom_search',
    domDiff: 'eyes_inspect_dom_diff',
    evidence: 'eyes_inspect_evidence',
    regions: 'eyes_inspect_regions',
    history: 'eyes_inspect_history',
};
/** Only `eyes_inspect_dom_diff` resumes the server task, whichever call surfaced the taskId. */
function domDiffComputingNext(taskId, resume, budgetMs) {
    const head = budgetMs < AWAIT_BUDGET_MS
        ? `The DOM diff is still computing server-side. Resume it now — ${resume} plus taskId "${taskId}"; that call waits for the diff, so do not idle first. `
        : `The DOM diff is still computing server-side. Wait ~10 seconds, then ${resume} plus taskId "${taskId}". `;
    return (head +
        'Do NOT guess, summarize, or reconstruct the diff from anything else — it is only available through that call.');
}
const DOM_DIFF_TERMINAL_NEXT = 'No DOM diff exists for this step and none can be computed — this is terminal, not transient. ' +
    'Do NOT call eyes_inspect_dom_diff for this step. Review it from the images alone and record that ' +
    'the structural comparison was not available, rather than that no structural change was found.';
/** A composed read must never take the evidence bundle down with it — the images are the call's contract. */
function composeFailure(tool) {
    return (error) => ({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        next: `This read failed, so ${tool} still counts as not called for this step — call it directly to retry it. ` +
            'Everything else in this response is unaffected.',
    });
}
function failed(result) {
    return result.status === 'error';
}
/** A `null` record keeps the review gates treating the diff as not-yet-fetched until the agent actually receives it. */
function composedDomDiff(result) {
    if (failed(result))
        return { block: { ...result }, record: null };
    if (result.status === 'computing') {
        const resume = `call ${EYES_INSPECT_TOOLS.domDiff} with this step's sessionUrl and stepIndex`;
        return {
            block: {
                status: 'computing',
                taskId: result.taskId,
                next: domDiffComputingNext(result.taskId, resume, COMPOSED_AWAIT_BUDGET_MS),
            },
            record: null,
        };
    }
    if (result.status !== 'ready') {
        return {
            block: { status: result.status, reason: result.reason, next: DOM_DIFF_TERMINAL_NEXT },
            record: { rect: undefined, status: result.status },
        };
    }
    return { block: { status: 'ready', diff: result.diff }, record: { rect: undefined } };
}
const SESSION_URL_DESC = 'Eyes session URL: https://eyes.applitools.com/app/test-results/{batchId}/{sessionId}[/steps/{N}]?accountId=... (the /steps/N suffix is ignored if present)';
const BATCH_URL_DESC = 'Eyes batch URL: https://eyes.applitools.com/app/test-results/{batchId}/?accountId=... (a trailing /{sessionId}[/steps/{N}] is fine too and is ignored — pass a session/step URL here as-is, no need to strip it down)';
const STEP_INDEX_DESC = 'Zero-based index of the step, as returned by eyes_inspect_steps';
const RECT_DESC = 'Optional crop/filter rectangle in pixels. Use image sizes from eyes_inspect_steps to construct it (e.g. top quarter of a 1020×600 image = {left:0,top:0,width:1020,height:150}).';
const DOM_SEARCH_CHEAT_SHEET = `Full predicate grammar and examples: read the "eyes-inspect://dom-search-grammar" resource. Condensed cheat-sheet below for clients that don't fetch resources.

Searches a DOM capture file (written by eyes_inspect_dom) for elements matching a boolean predicate, printing one compact line per match, indented by tree depth.

Predicate kinds (combine with 'and'/'or'/'not' and parentheses):
- Property comparison: tagName = 'DIV', attributes.class contains 'btn', rect.width > 200, style.display != 'none', attributes.href starts-with 'https://', tagName =~ /^H[1-6]$/, attributes.type in ('button','submit')
- Geometry: bounds contains 400,300 | bounds contains 0,0,500,200 | bounds intersects node 12 | bounds contained-by node 12
- Relationship: child-of (tagName = 'UL'), descendant-of node 5, sibling-of node 7
- Shortcut keywords: image, gif, logo, button, hidden (and others)
- Reference another element by its 'id' field with 'node <id>'

Values with spaces must be single-quoted; string comparisons are case-insensitive. Every matched element also exposes a virtual 'text' property (its own concatenated text content).`;
function registerEyesInspectDataTools(server, phaseTrackerDeps = defaultPhaseTrackerDeps) {
    server.registerTool(EYES_INSPECT_TOOLS.sessions, {
        description: 'List sessions in an Applitools Eyes batch plus batch-wide stats. `filter` narrows to unresolved/unsaved/mismatching sessions; `format` shapes the output (`full` default: stats+session list; `stats`: stats only; `scenarios`: deduplicated, sorted session names only). A low-level primitive: for reviewing or resolving a batch\'s results, call eyes_review_progress with scope: "batch" instead — it drives the full investigation and calls this internally.',
        inputSchema: {
            batchUrl: zod.z.string().describe(BATCH_URL_DESC),
            filter: zod.z
                .enum(['unresolved', 'unsaved', 'mismatching'])
                .optional()
                .describe('Narrow to sessions matching this state — "mismatching" keeps sessions with at least one step that\'s non-matching, missing a checkpoint, or new'),
            format: zod.z.enum(['full', 'stats', 'scenarios']).optional().describe('Shape of the response; defaults to "full"'),
        },
        annotations: READ_ONLY,
    }, async ({ batchUrl, filter, format }) => {
        const keys = readOnlyApiKeyProvider(batchUrl);
        const rawArgs = [filter, format].filter((v) => v !== undefined);
        const result = await fetchSessions(batchUrl, keys, rawArgs);
        logDataToolCall(batchScopeId(batchUrl), EYES_INSPECT_TOOLS.sessions, { filter, format }, phaseTrackerDeps);
        return textResult(JSON.stringify(result, null, 2));
    });
    server.registerTool(EYES_INSPECT_TOOLS.steps, {
        description: 'Session summary (sessionId, sessionName, appName, status, isUnsaved, isAborted, environment, startedAt) plus every test step with baseline/checkpoint image IDs, domIds, sizes, match status (isMatching), resolution, and per-step isUnsaved. A low-level primitive: for reviewing or resolving a session\'s results, call eyes_review_progress with scope: "session" instead — it drives the full investigation and calls this internally. Call this directly only when you need raw step data outside a driven review, e.g. an image id for eyes_inspect_image.',
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl }) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const result = await fetchSteps(sessionUrl, keys);
        logDataToolCall(sessionScopeId(sessionUrl), EYES_INSPECT_TOOLS.steps, {}, phaseTrackerDeps);
        return textResult(JSON.stringify(result, null, 2));
    });
    server.registerTool(EYES_INSPECT_TOOLS.changedAreas, {
        description: 'Coarse diff regions for a step, clustered from raw pixel-level differences. Each region includes a diffCount. Already reflects any match regions added during resolution — a masked area no longer shows up here. Run this before fetching any images or DOM data for a step. Resolution can happen between calls, so never reuse an earlier result in this conversation — call it again. A low-level primitive: for a driven step-level review, call eyes_review_progress with scope: "step" instead — it calls this internally for every changed area.',
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            rect: RectShape.describe(RECT_DESC),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, stepIndex, rect }) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const result = await fetchChangedAreas(sessionUrl, stepIndex, keys, rect);
        logDataToolCall(stepScopeId(sessionUrl, stepIndex), EYES_INSPECT_TOOLS.changedAreas, { rect }, phaseTrackerDeps);
        return textResult(JSON.stringify(result, null, 2));
    });
    server.registerTool(EYES_INSPECT_TOOLS.imageDiff, {
        description: 'Export the checkpoint screenshot with visual differences highlighted in pink, cropped to `rect` if provided. Returns a file path — pass it directly to the Read tool to view the image. Pad a changed-area rect by 10px on every side before requesting it here; the region may exceed the image bounds, which is fine. Already reflects any match regions added during resolution — a masked area is no longer highlighted. Resolution can happen between calls, so never reuse an earlier result in this conversation — call it again.',
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            rect: RectShape.describe(RECT_DESC),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, stepIndex, rect }) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const filePath = await fetchImageDiff(sessionUrl, stepIndex, keys, rect);
        logDataToolCall(stepScopeId(sessionUrl, stepIndex), EYES_INSPECT_TOOLS.imageDiff, { rect }, phaseTrackerDeps);
        return textResult(filePath);
    });
    server.registerTool(EYES_INSPECT_TOOLS.image, {
        description: 'Export a baseline or checkpoint screenshot as a PNG, cropped to `rect` if provided. `imageId` comes from eyes_inspect_steps (baseline.id or checkpoint.id per step). Returns a file path, self-identifying by imageId and crop rect — pass it directly to the Read tool.',
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            imageId: zod.z.string().describe('Baseline or checkpoint image id from eyes_inspect_steps'),
            rect: RectShape.describe(RECT_DESC),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, imageId, rect }) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const { baseUrl } = parseSessionUrl(sessionUrl);
        const filePath = await fetchImage(baseUrl, imageId, keys, rect);
        logDataToolCall(sessionScopeId(sessionUrl), EYES_INSPECT_TOOLS.image, { imageId, rect }, phaseTrackerDeps);
        return textResult(filePath);
    });
    server.registerTool(EYES_INSPECT_TOOLS.evidence, {
        description: 'Everything needed to review a step\'s changed areas, in one call: for each area, the image diff (checkpoint with differences highlighted in pink) plus the baseline and checkpoint screenshots, fetched together. Pass EVERY area you still have to review in a single call\'s `areaRects` — one call per area is exactly what this tool exists to avoid. Pass each rect exactly as eyes_review_progress gave it to you — do NOT pad it, the server pads it and clamps it to each image. Prefer this over calling eyes_inspect_image_diff and eyes_inspect_image separately; it is what eyes_review_diff_report\'s gate checks for. It also returns the whole step\'s structural DOM diff under `domDiff` and the match regions currently in effect under `regions`, so do not call eyes_inspect_dom_diff or eyes_inspect_regions separately for this step — the one exception is a `domDiff` or `regions` reporting `status: "computing"` or `status: "error"` (with the failure\'s own message under `error`), whose own `next` says where to pick it up. The composed `domDiff` waits only briefly, so `status: "computing"` is common and expected here — the images ship without waiting for it; follow its `next` to eyes_inspect_dom_diff, which is where the diff is waited out. Returns `evidence`, one entry per area in the order asked for, each with a labelled file path per image, plus the images themselves for clients that render them — read each `path` only for an image whose `inline` is false, and `notInlined` says why it was not. Inlined images arrive as image blocks in the same order as the `inline: true` entries, reading `evidence` top to bottom; `inlining` reports how much of the budget the response spent. Each image carries the `rect` it was actually cropped at: the two sides of a step can differ in size, so the crops are near-identical but NOT guaranteed equal — compare by content, and check the rects before reading anything into a difference in position or extent. Any image this step cannot produce for an area is listed under that area\'s `unavailable` with the reason, which is a fact about the step, not a failure. Already reflects any match regions added during resolution; resolution can happen between calls, so never reuse an earlier result in this conversation — call it again.',
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            areaRects: zod.z
                .array(RequiredRectShape)
                .min(1)
                .max(MAX_EVIDENCE_BATCH)
                .describe(`Every changed area of this step you still need evidence for — from eyes_inspect_changed_areas or eyes_review_progress, verbatim and unpadded. Up to ${MAX_EVIDENCE_BATCH} per call; if a step has more, review these first and call again for the rest.`),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, stepIndex, areaRects }, extra) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const scopeId = stepScopeId(sessionUrl, stepIndex);
        // Concurrent, so the merged call costs max(images, regions, domDiff) rather than their sum.
        const [evidence, regions, domDiff] = await Promise.all([
            fetchEvidence(sessionUrl, stepIndex, areaRects, keys),
            fetchRegions(sessionUrl, stepIndex, keys).catch(composeFailure(EYES_INSPECT_TOOLS.regions)),
            fetchVisibleDomDiff(sessionUrl, stepIndex, keys, undefined, undefined, extra === null || extra === void 0 ? void 0 : extra.signal, undefined, COMPOSED_AWAIT_BUDGET_MS).catch(composeFailure(EYES_INSPECT_TOOLS.domDiff)),
        ]);
        const { block, record } = composedDomDiff(domDiff);
        const result = buildEvidenceResult(evidence, {}, { domDiff: block, regions });
        recordChainSource(scopeId, phaseTrackerDeps);
        // One record per area, not per call: eyes_review_diff_report's gate reads these area by area.
        for (const area of evidence) {
            logInvocation(scopeId, EYES_INSPECT_TOOLS.evidence, { areaRect: area.areaRect, images: area.images.map(image => image.label) }, phaseTrackerDeps);
        }
        // The standalone tools' own keys and argument shapes, so the review gates need no change to accept these.
        if (!failed(regions))
            logInvocation(scopeId, EYES_INSPECT_TOOLS.regions, { rect: undefined }, phaseTrackerDeps);
        if (record)
            logInvocation(scopeId, EYES_INSPECT_TOOLS.domDiff, record, phaseTrackerDeps);
        return result;
    });
    server.registerTool(EYES_INSPECT_TOOLS.dom, {
        description: "Export a DOM capture as JSON, saved to a file. `domId` comes from eyes_inspect_steps (baseline.domId or checkpoint.domId per step). Use to inspect exact computed styles/structure, or to locate an element's rect/id for use elsewhere (e.g. as an eyes_inspect_history nodeId). Returns a file path — pass it directly to the Read tool, or search it with eyes_inspect_dom_search rather than writing an ad-hoc script.",
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            domId: zod.z.string().describe('Baseline or checkpoint domId from eyes_inspect_steps'),
            rect: RectShape.describe(`${RECT_DESC} Don't pad it.`),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, domId, rect }) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const domIdError = validateDomId(domId);
        if (domIdError)
            throw new Error(domIdError);
        const { baseUrl } = parseSessionUrl(sessionUrl);
        const filePath = await fetchDom(baseUrl, domId, keys, rect);
        logDataToolCall(sessionScopeId(sessionUrl), EYES_INSPECT_TOOLS.dom, { domId, rect }, phaseTrackerDeps);
        return textResult(filePath);
    });
    // Not logged: its arguments (a file path, a predicate) carry no session/batch identifier to
    // scope an invocation record under.
    server.registerTool(EYES_INSPECT_TOOLS.domSearch, {
        description: `Search a DOM capture file (written by eyes_inspect_dom) for elements matching a boolean predicate — always use this instead of writing an ad-hoc script (Python/Node/jq/grep/manual JSON.parse) to search a capture.\n\n${DOM_SEARCH_CHEAT_SHEET}`,
        inputSchema: {
            filePath: zod.z.string().describe('A file path previously written by eyes_inspect_dom'),
            predicate: zod.z
                .string()
                .describe("Boolean predicate, e.g. \"tagName = 'HEADER'\" or \"child-of (tagName = 'UL') and tagName = 'LI'\""),
        },
        annotations: READ_ONLY,
    }, async ({ filePath, predicate }) => {
        const result = searchDomFile(filePath, predicate);
        return textResult(result);
    });
    server.registerTool(EYES_INSPECT_TOOLS.domDiff, {
        description: `Structural DOM diff between a step's baseline and checkpoint. \`rect\`, if given, only filters the output, not the comparison itself. Entries are tagged \`changed\`/\`new\`/\`missing\`/\`displaced\`. Already omits any structural difference that doesn't correspond to an actual visual diff under the step's current match settings/regions — masking a change elsewhere no longer produces DOM-diff noise. Always run this for a step before concluding a visual diff is rendering noise, and before summarizing large diffs (which are often caused by displacement — this reveals the root cause directly). The diff is computed server-side and this call may take up to ~${AWAIT_BUDGET_MS / 1000} seconds before responding — that is normal, do not abort early; if the call is interrupted anyway, the computation continues server-side — call this tool again with the same arguments and it resumes, usually instantly. A large diff can outlive the wait budget, in which case the result is \`{"status":"computing","taskId",...}\` instead of the diff — always follow its \`next\` field exactly (re-call this tool with the same arguments plus that taskId); the diff is ONLY available through that follow-up call, never by inferring it from images or prior context. If a diff here is the exact same underlying change you've already recorded elsewhere in this scenario, eyes_review_diff_report's \`sameAs\` argument lets you skip straight to reviewing just the checkpoint image for it. Resolution can happen between calls, so never reuse an earlier result in this conversation — call it again.`,
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            rect: RectShape.describe(RECT_DESC),
            taskId: zod.z
                .string()
                .optional()
                .describe('ONLY a taskId from a prior {"status":"computing"} response for the same sessionUrl/stepIndex — from this tool or from eyes_inspect_evidence\'s composed `domDiff` — resumes checking that computation instead of resubmitting. Never invent or reuse one across steps.'),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, stepIndex, rect, taskId }, extra) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const result = await fetchVisibleDomDiff(sessionUrl, stepIndex, keys, rect, taskId, extra === null || extra === void 0 ? void 0 : extra.signal);
        if (result.status === 'computing') {
            // Deliberately NOT logged as an invocation: eyes_review's hard gates must keep treating
            // this step's dom diff as not-yet-fetched until the agent actually receives it.
            const resume = `call ${EYES_INSPECT_TOOLS.domDiff} again with the same sessionUrl/stepIndex/rect`;
            return textResult(JSON.stringify({
                status: 'computing',
                taskId: result.taskId,
                next: domDiffComputingNext(result.taskId, resume, AWAIT_BUDGET_MS),
            }, null, 2));
        }
        if (result.status !== 'ready') {
            // Logged, unlike `computing`, so eyes_review_end's step-close gate stays satisfiable without a diff.
            logDataToolCall(stepScopeId(sessionUrl, stepIndex), EYES_INSPECT_TOOLS.domDiff, { rect, status: result.status }, phaseTrackerDeps);
            return textResult(JSON.stringify({ status: result.status, reason: result.reason, next: DOM_DIFF_TERMINAL_NEXT }, null, 2));
        }
        logDataToolCall(stepScopeId(sessionUrl, stepIndex), EYES_INSPECT_TOOLS.domDiff, { rect }, phaseTrackerDeps);
        return textResult(result.diff);
    });
    server.registerTool(EYES_INSPECT_TOOLS.regions, {
        description: "The match regions currently in effect for a step (ignore/strict/layout/dynamic/etc.), optionally filtered to those intersecting `rect` on either side. Returns `{ regions, codedRegions }`: `regions` are the regions defined on the step's baseline, or changed by a reviewer through resolution (a domSelector present on one side but empty on the other means that side's anchor is stale, or its target genuinely doesn't exist there); `codedRegions` are regions provided by the test code itself, keyed by regionId instead.",
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            rect: RectShape.describe(RECT_DESC),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, stepIndex, rect }) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const result = await fetchRegions(sessionUrl, stepIndex, keys, rect);
        logDataToolCall(stepScopeId(sessionUrl, stepIndex), EYES_INSPECT_TOOLS.regions, { rect }, phaseTrackerDeps);
        return textResult(JSON.stringify(result, null, 2));
    });
    server.registerTool(EYES_INSPECT_TOOLS.history, {
        description: `For each given node id, a changelog of non-empty diffs against prior runs of the same test scenario and environment, keyed by node id. Use before concluding whether a changed or drifted element is dynamic (recurring changes) versus a one-time real change — never guess this from a single run alone. An empty array for a node means no change was found across however much history was searched; that alone is not proof of anything either way. Each historic comparison is computed server-side, so this call can take up to ~${AWAIT_BUDGET_MS / 1000} seconds per comparison — do not abort early; if the call is interrupted or reports a still-computing comparison, call it again with the same arguments and the walk resumes from cache.`,
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            nodeIds: zod.z
                .array(zod.z.string())
                .min(1)
                .describe('DOM node ids to check, from a prior eyes_inspect_dom or eyes_inspect_dom_diff result'),
            count: zod.z
                .number()
                .int()
                .positive()
                .optional()
                .describe('Target number of non-empty diffs to collect per node; defaults to 3'),
        },
        annotations: READ_ONLY,
    }, async ({ sessionUrl, stepIndex, nodeIds, count }, extra) => {
        const keys = readOnlyApiKeyProvider(sessionUrl);
        const result = await runHistory(sessionUrl, stepIndex, nodeIds, count !== null && count !== void 0 ? count : 3, keys, undefined, extra === null || extra === void 0 ? void 0 : extra.signal);
        logDataToolCall(stepScopeId(sessionUrl, stepIndex), EYES_INSPECT_TOOLS.history, { nodeIds }, phaseTrackerDeps);
        return textResult(JSON.stringify(result, null, 2));
    });
}

const DOM_SEARCH_GRAMMAR_URI = 'eyes-inspect://dom-search-grammar';
// Same convention as src/resources/documentation: the rollup build flattens everything into
// dist/index.js with docs/ copied alongside as dist/docs/, while tests run from src/.
const DOM_SEARCH_GRAMMAR_PATH = /[\\/]dist(?:[\\/]|$)/.test(__dirname)
    ? path__namespace.join(__dirname, 'docs/dom-search.md')
    : path__namespace.join(__dirname, '../../../docs/dom-search.md');
function registerEyesInspectResources(server) {
    server.registerResource('dom-search-grammar', DOM_SEARCH_GRAMMAR_URI, {
        title: 'dom-search predicate language',
        description: "Full grammar and examples for eyes_inspect_dom_search's predicate language — property/geometry/size/direction/relationship/attribute-presence checks and shortcut keywords.",
        mimeType: 'text/markdown',
    }, async (uri) => ({
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fs__namespace.readFileSync(DOM_SEARCH_GRAMMAR_PATH, 'utf8') }],
    }));
}

/** A clear op — `-*` (every category) or `-<category>-*`/`-<category>*` (one category) — drops every matching existing region instead of resolving a single id/rect target. */
function isClearOp(op) {
    return op.targetRaw === '*';
}
/**
 * Parses a compact regionOp string. Either a targeted op — `(+|-)<matchLevel>-(<rect>|<id>)`,
 * where `<matchLevel>` has no internal dashes so the first `-` in the remainder after the sign
 * cleanly separates it from the target — or a clear op, a removal-only glob with no target to
 * resolve: `-*` (every region, any category) or `-<matchLevel>-*`/`-<matchLevel>*` (every region
 * of one category).
 */
function parseRegionOp(arg) {
    const sign = arg[0];
    if (sign !== '+' && sign !== '-') {
        throw new Error(`regionOp must start with '+' or '-': "${arg}"`);
    }
    const rest = arg.slice(1);
    if (rest === '*' || /^[a-z]+-?\*$/i.test(rest)) {
        if (sign !== '-') {
            throw new Error(`"*" and "<matchLevel>*" clear existing regions — they're removal-only, so use '-', not '+': "${arg}"`);
        }
        if (rest === '*') {
            return { action: 'remove', regionType: 'all', targetRaw: '*' };
        }
        const regionType = rest.replace(/-?\*$/, '');
        if (!REGION_TYPES.includes(regionType)) {
            throw new Error(`Unknown match level "${regionType}" in regionOp "${arg}". Supported: ${REGION_TYPES.join(', ')}`);
        }
        return { action: 'remove', regionType: regionType, targetRaw: '*' };
    }
    const dashIndex = rest.indexOf('-');
    if (dashIndex === -1) {
        throw new Error(`regionOp must be in the form (+|-)<matchLevel>-<target>: "${arg}"`);
    }
    const regionType = rest.slice(0, dashIndex);
    const targetRaw = rest.slice(dashIndex + 1);
    if (!targetRaw) {
        throw new Error(`regionOp is missing a target: "${arg}"`);
    }
    if (!REGION_TYPES.includes(regionType)) {
        throw new Error(`Unknown match level "${regionType}" in regionOp "${arg}". Supported: ${REGION_TYPES.join(', ')}`);
    }
    if (sign === '+' && regionType === 'dynamic') {
        throw new Error(`regionOp "${arg}" adds a dynamic region, but dynamic is Eyes' default match level and masks nothing on its own. Add a layout region instead.`);
    }
    return { action: sign === '+' ? 'add' : 'remove', regionType: regionType, targetRaw };
}
/** A target with no comma is a bare node `id` value; a target with commas is a raw rect. */
function isIdTarget(targetRaw) {
    return !targetRaw.includes(',');
}
/** Reconstructs a regionOp's canonical string form — the inverse of `parseRegionOp`. */
function formatRegionOp(op) {
    if (isClearOp(op)) {
        return op.regionType === 'all' ? '-*' : `-${op.regionType}-*`;
    }
    return `${op.action === 'add' ? '+' : '-'}${op.regionType}-${op.targetRaw}`;
}
// Matches MATCH_LEVEL_MAP, which already maps both
// 'ignorecolors' and 'content' to the server-side 'IgnoreColors' level.
const REGION_TYPE_TO_CATEGORY = {
    ignore: 'ignore',
    strict: 'strict',
    layout: 'layout',
    dynamic: 'dynamic',
    ignorecolors: 'content',
};
/**
 * Inverse of `REGION_TYPE_TO_CATEGORY` — a clean one-to-one mapping back for the 5 categories
 * a `regionOp` can actually express (`floating`/`remarks`/`mismatching`/`accessibility` have no
 * corresponding `matchLevel` and are absent here entirely, not mapped to `undefined`).
 */
const CATEGORY_TO_REGION_TYPE = {
    ignore: 'ignore',
    strict: 'strict',
    layout: 'layout',
    dynamic: 'dynamic',
    content: 'ignorecolors',
};
/**
 * Resolves `propagate`'s scope: every candidate whose `sessionName` exactly equals
 * `currentSessionName` (the current session's own scenario, across every environment it
 * ran in), plus — only when `spec.regex` is set — every candidate whose `sessionName`
 * additionally matches that regex. The current session itself is always excluded: the
 * caller handles its own step directly, this only resolves which *other* sessions are
 * in scope.
 */
function resolvePropagateScope(candidates, currentSessionId, currentSessionName, spec) {
    return candidates.filter(c => {
        if (c.sessionId === currentSessionId)
            return false;
        if (c.sessionName === currentSessionName)
            return true;
        return spec.regex !== null && c.sessionName !== undefined && spec.regex.test(c.sessionName);
    });
}
/** Parses a rect-form target ("left,top,width,height") into a Region with no domSelector. */
function parseRectTarget(targetRaw) {
    return { domSelector: '', ...parseRect(targetRaw) };
}

const defaultCommandsDeps = {
    fetchRawSession,
    fetchRawBatchSessions,
    fetchPrunedDom,
    getCompatibleSelectors,
    findRegionsInImages,
    findSameDiffSteps,
    postStepUpdates,
    saveBaselines: saveBaselines$1,
    restoreBaseline,
    resetBatchSessions,
};
// dom's resolveNodeIdsToNodes/findNodeByRect/findNodeBySelector return a nested
// {domSelector, rect} shape; the outbound API payload needs the flat Region shape (domSelector
// alongside left/top/width/height).
function toRegion(resolved) {
    return { domSelector: resolved.domSelector, ...resolved.rect };
}
// Upgrades a raw rect target into a domSelector-backed region when a matching element exists in
// the DOM — the region then tracks that element rather than a fixed set of pixels. Falls back to
// the literal rect (no domSelector) if no DOM was fetched (domRoot null) or no element matches
// closely enough.
function rectTargetToRegion(targetRaw, domRoot) {
    const parsed = parseRectTarget(targetRaw);
    if (!domRoot)
        return parsed;
    const found = findNodeByRect(domRoot, parsed);
    return found ? toRegion(found) : parsed;
}
async function fetchAndPrepareSession(url, stepIndex, keys, deps) {
    const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(url, keys);
    const rawSession = await deps.fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys });
    validateStepIndex(rawSession, stepIndex);
    return { baseUrl, batchId, sessionId, accountId, rawSession };
}
/**
 * Reversing the resolution (e.g. accept after a prior reject, or vice versa) moves "the
 * baseline going forward" to the other image. Every existing region is now describing the wrong
 * element unless it's re-anchored to the new side: `checkRegions` classifies each pair (verifying
 * a domSelector against the previous side's own DOM), `clearStaleSelectors` gives up on any bad
 * one so it can be retried, `healNonAnchoredRegionsBySourceRect` anchors as many of those
 * survivors as it can by rect, and `mapAnchoredRegionsBySelector` maps the combined anchored set
 * to the new side via get-compatible-selectors. Only accept/reject can ever trigger a remap
 * (`domIdSideAction` 'unchanged' — used for baseline-regions/checkpoint-regions — always computes
 * newSide === previousSide). Called once for the reference/literal step, and once more per
 * samediffas-returned propagation target in `resolveStep` — never for a plain propagation
 * candidate that samediffas didn't confirm as an actual target.
 */
async function reconcileRegionsForSide(rawSession, stepIndex, domIdSideAction, baseUrl, accountId, keys, deps) {
    const previousSide = resolveDomIdSide('unchanged', rawSession, stepIndex);
    const newSide = resolveDomIdSide(domIdSideAction, rawSession, stepIndex);
    const regionPairs = getEffectiveRegions(rawSession, stepIndex).regions;
    let remapped = false;
    if (newSide !== previousSide && regionPairs.some(p => !p.baseline || !p.checkpoint)) {
        const domPrevious = await fetchDomForSide(rawSession, stepIndex, previousSide, baseUrl, keys, deps).catch(() => null);
        const { anchored, nonAnchored } = checkRegions(regionPairs, domPrevious);
        const staleCleared = clearStaleSelectors(nonAnchored);
        const healedByRect = healNonAnchoredRegionsBySourceRect(nonAnchored, domPrevious);
        const nowAnchored = nonAnchored.filter(p => { var _a; return ((_a = p.baseline) !== null && _a !== void 0 ? _a : p.checkpoint).domSelector; });
        const mapped = await mapAnchoredRegionsBySelector(rawSession, stepIndex, [...anchored, ...nowAnchored], {
            baseUrl,
            accountId,
            keys,
            fetchDomForSide: (raw, si, side, bu) => fetchDomForSide(raw, si, side, bu, keys, deps),
            getCompatibleSelectors: deps.getCompatibleSelectors,
        });
        remapped = staleCleared || healedByRect || mapped;
    }
    const entries = regionPairs.map(({ category, baseline, checkpoint }) => ({
        category,
        region: (newSide === 'baseline' ? (baseline !== null && baseline !== void 0 ? baseline : checkpoint) : (checkpoint !== null && checkpoint !== void 0 ? checkpoint : baseline)),
    }));
    return { entries, newSide, remapped };
}
/**
 * Shared, action-agnostic candidate enumeration for propagation — every other step of the
 * source session, plus every step of every in-scope sibling session (resolved via
 * `resolvePropagateScope` + `fetchRawBatchSessions`, matched by scenario name ± regex, excluding
 * any sibling still `Running` — a test mid-run has no stable diff to propagate onto). The
 * originating (sourceRaw, sourceStepIndex) itself is never included — both `resolveStep` and
 * `updateRegions` handle it separately. `unresolvedOnly` drops any candidate that already
 * carries its own accept/reject decision (`getStepResolution` !== 'none') — `resolveStep` passes
 * `true`, since there's nothing to propagate onto a step a human already resolved through
 * `samediffas`; `updateRegions` passes `false`, since a region op (searched directly via
 * `findRegionsInImages`, CV/DOM matching) is agnostic to a step's resolution status. This is only
 * the *candidate* set — nothing about what each flow does with a candidate is shared, only this
 * initial enumeration.
 */
async function findPropagationCandidateSteps(sourceRaw, sourceStepIndex, sourceSessionId, baseUrl, batchId, accountId, keys, propagate, unresolvedOnly, deps) {
    const candidateSteps = [];
    for (let i = 0; i < getStepCount(sourceRaw); i++) {
        if (i !== sourceStepIndex)
            candidateSteps.push({ raw: sourceRaw, stepIndex: i });
    }
    const rawBatchSessions = await deps.fetchRawBatchSessions({ baseUrl, batchId, accountId, keys });
    const siblingSessions = resolvePropagateScope(rawBatchSessions
        .filter(raw => raw.status !== 'Running')
        .map(raw => ({ raw, sessionId: raw.id, sessionName: raw.scenarioName })), sourceSessionId, sourceRaw.scenarioName, propagate);
    for (const sibling of siblingSessions) {
        for (let i = 0; i < getStepCount(sibling.raw); i++)
            candidateSteps.push({ raw: sibling.raw, stepIndex: i });
    }
    if (unresolvedOnly)
        return candidateSteps.filter(c => getStepResolution(c.raw, c.stepIndex) === 'none');
    return candidateSteps;
}
function describeStep(raw, stepIndex) {
    var _a, _b;
    const info = simplifySession(raw, { includeSteps: false });
    return {
        sessionId: raw.id,
        sessionName: info.sessionName,
        environment: info.environment,
        stepIndex,
        stepTag: (_b = (_a = raw.actualAppOutput) === null || _a === void 0 ? void 0 : _a[stepIndex]) === null || _b === void 0 ? void 0 : _b.tag,
    };
}
/**
 * Resolves a step's checkpoint per `action` — `'accept'` or `'reject'`. `propagate` (on by
 * default) is resolved through the `samediffas` backend endpoint: the candidate list — every
 * other step of this session, plus every step of every in-scope sibling session, minus any step
 * that already carries its own accept/reject decision (`getStepResolution` !== 'none' — nothing
 * to propagate onto a step a human already resolved) — is sent to `samediffas` alongside this
 * step as `reference`; only the target steps it actually returns are touched, each treated
 * exactly like the reference step itself (its own `reconcileRegionsForSide` call), folded into
 * the same batched `updates[]` POST. `propagate: null` opts out entirely.
 */
async function resolveStep(url, stepIndex, action, keys, propagate = { regex: null }, deps = defaultCommandsDeps) {
    try {
        const { baseUrl, batchId, sessionId, accountId, rawSession } = await fetchAndPrepareSession(url, stepIndex, keys, deps);
        const { entries, remapped } = await reconcileRegionsForSide(rawSession, stepIndex, action, baseUrl, accountId, keys, deps);
        const stepUpdate = { index: stepIndex, variantId: null, replaceExpected: action === 'accept' };
        if (remapped) {
            stepUpdate.annotations = bucketRegions(entries);
            stepUpdate.removedAnnotations = emptyAnnotations();
        }
        const stepUpdatesBySession = new Map([[sessionId, [stepUpdate]]]);
        const resolvedSteps = [describeStep(rawSession, stepIndex)];
        if (propagate) {
            const candidateSteps = await findPropagationCandidateSteps(rawSession, stepIndex, sessionId, baseUrl, batchId, accountId, keys, propagate, true, deps);
            if (candidateSteps.length > 0) {
                const toSameDiffAsStep = (raw, i) => ({
                    batchId: raw.batchId,
                    sessionId: raw.id,
                    stepIndex: i,
                    image1: raw.expectedAppOutput[i].image.id,
                    image2: raw.actualAppOutput[i].image.id,
                    matchSettings: getEffectiveMatchSettings(raw, i),
                });
                const targetIndices = await deps.findSameDiffSteps({
                    reference: toSameDiffAsStep(rawSession, stepIndex),
                    steps: candidateSteps.map(c => toSameDiffAsStep(c.raw, c.stepIndex)),
                }, { baseUrl, accountId, keys });
                // Confirmed live: the result is a plain number[] of zero-based indices into the request's
                // own `steps` array (e.g. [0, 1] meaning steps[0] and steps[1] both matched) — never step
                // objects, never {sessionId, stepIndex} identifiers. Each index maps 1:1 onto
                // candidateSteps by position, since that's exactly the array `steps` was built from above.
                for (const index of targetIndices) {
                    const candidate = candidateSteps[index];
                    if (!candidate)
                        continue; // defensive — samediffas is only ever asked about candidateSteps' own entries
                    const { entries: targetEntries, remapped: targetRemapped } = await reconcileRegionsForSide(candidate.raw, candidate.stepIndex, action, baseUrl, accountId, keys, deps);
                    const targetUpdate = { index: candidate.stepIndex, variantId: null, replaceExpected: action === 'accept' };
                    if (targetRemapped) {
                        targetUpdate.annotations = bucketRegions(targetEntries);
                        targetUpdate.removedAnnotations = emptyAnnotations();
                    }
                    if (!stepUpdatesBySession.has(candidate.raw.id))
                        stepUpdatesBySession.set(candidate.raw.id, []);
                    stepUpdatesBySession.get(candidate.raw.id).push(targetUpdate);
                    resolvedSteps.push(describeStep(candidate.raw, candidate.stepIndex));
                }
            }
        }
        await deps.postStepUpdates({ baseUrl, batchId, accountId, keys }, stepUpdatesBySession);
        return resolvedSteps;
    }
    catch (error) {
        throw new Error(`Error resolving step: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Adds/removes/updates a step's match regions. `action` declares which DOM (`refSide`) every
 * regionOp's ids/rects are described against; targets are resolved there, then converted onto
 * whichever side the step's resolution actually needs (`newSide`) if that differs. `propagate`
 * (on by default) searches the same candidate steps `resolveStep` would (every other step of this
 * session, plus every in-scope sibling session's steps) via `findRegionsInImages` (CV/DOM
 * matching) rather than `samediffas` — the two propagation mechanisms are deliberately kept fully
 * independent.
 */
async function updateRegions(url, stepIndex, action, rawRegionOps, keys, propagate = { regex: null }, deps = defaultCommandsDeps) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (rawRegionOps.length === 0) {
        throw new Error(`'${action}' requires at least one regionOp — nothing to do otherwise`);
    }
    let regionOps;
    try {
        regionOps = rawRegionOps.map(parseRegionOp);
    }
    catch (error) {
        throw new Error(`Error parsing regionOp: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        const { baseUrl, batchId, sessionId, accountId, rawSession } = await fetchAndPrepareSession(url, stepIndex, keys, deps);
        // domIdSideAction is always 'unchanged' here — baseline-regions/checkpoint-regions never
        // change resolution, so newSide always equals previousSide and the remap branch is a no-op.
        const { entries, newSide } = await reconcileRegionsForSide(rawSession, stepIndex, 'unchanged', baseUrl, accountId, keys, deps);
        const refSide = action === 'baseline-regions' ? 'baseline' : 'checkpoint';
        // Clear ops (-*, -<matchLevel>-*) drop existing regions by category rather than resolving a
        // single id/rect target, so they're excluded from the id/rect DOM-fetch calculus below.
        const targetedOps = regionOps.filter(op => !isClearOp(op));
        const idTargets = targetedOps.map(op => op.targetRaw).filter(isIdTarget);
        const hasRectTargets = targetedOps.some(op => !isIdTarget(op.targetRaw));
        // Every target is resolved against refSide — the DOM the caller explicitly declared these
        // ids/rects describe.
        let domRef = null;
        if (idTargets.length > 0) {
            domRef = await fetchDomForSide(rawSession, stepIndex, refSide, baseUrl, keys, deps);
        }
        else if (hasRectTargets) {
            domRef = await fetchDomForSide(rawSession, stepIndex, refSide, baseUrl, keys, deps).catch(() => null);
        }
        // An id absent from refSide's DOM throws here (resolveNodeIdsToNodes's own "not found"
        // error) — before anything is sent to the API, so a bad id fails cleanly with no partial
        // change to the session. A rect target that matches no element on refSide just comes back as
        // a plain, unanchored rect (see rectTargetToRegion) instead of throwing.
        const idRegionsOnRef = idTargets.length > 0
            ? resolveNodeIdsToNodes(domRef, idTargets)
            : new Map();
        const resolvedOnRef = new Map();
        for (const op of targetedOps) {
            if (resolvedOnRef.has(op.targetRaw))
                continue;
            resolvedOnRef.set(op.targetRaw, isIdTarget(op.targetRaw)
                ? toRegion(idRegionsOnRef.get(op.targetRaw))
                : rectTargetToRegion(op.targetRaw, domRef));
        }
        // A snapshot of each op's region as resolved on refSide, before the refSide→newSide
        // conversion below may rewrite resolvedOnRef in place — propagation always searches against
        // refSide (sourceImage is refSide's own image), regardless of what side this step's own
        // regions ultimately get stored on.
        const resolvedOnRefBeforeConversion = new Map(resolvedOnRef);
        // Convert every anchored (domSelector-bearing) region from refSide to newSide, if they
        // differ — the same get-compatible-selectors mapping used for re-anchoring existing regions
        // on a resolution flip. A region with no domSelector has nothing to map: it carries over
        // as-is.
        if (refSide !== newSide) {
            const toConvert = [...resolvedOnRef.entries()].filter(([, region]) => region.domSelector);
            if (toConvert.length > 0) {
                const imageRef = imageForSide(rawSession, stepIndex, refSide);
                const imageNew = imageForSide(rawSession, stepIndex, newSide);
                const domNew = await fetchDomForSide(rawSession, stepIndex, newSide, baseUrl, keys, deps).catch(() => null);
                const selectors = toConvert.map(([, region]) => region.domSelector);
                let mapped;
                try {
                    mapped = await deps.getCompatibleSelectors({ baseUrl, accountId, keys }, imageRef, imageNew, selectors);
                }
                catch {
                    mapped = selectors.map(() => null); // the batch itself failed — treat every one as unmapped rather than throwing
                }
                toConvert.forEach(([targetRaw, region], i) => {
                    const newSelector = mapped[i];
                    const resolvedNew = newSelector && domNew ? findNodeBySelector(domNew, newSelector) : null;
                    resolvedOnRef.set(targetRaw, resolvedNew ? toRegion(resolvedNew) : { ...region, domSelector: newSelector !== null && newSelector !== void 0 ? newSelector : '' });
                });
            }
        }
        // Tracks what each op actually did — an add's own region, or whatever removeSimilarRegion
        // actually found and removed; a remove with nothing to remove has no entry, reported as []
        // below.
        const sourceAppliedRegions = new Map();
        // A clear op is expanded into one synthetic 'remove' op per entry it actually clears, as if
        // the caller had explicitly targeted each one by its own rect — the glob itself is never a
        // real target for anything (search or output), only these concrete per-region ops are.
        const clearSynthesizedOps = [];
        const clearSynthesizedByOp = new Map();
        for (const op of regionOps) {
            if (isClearOp(op)) {
                const clearedEntries = op.regionType === 'all'
                    ? entries.slice()
                    : entries.filter(e => e.category === REGION_TYPE_TO_CATEGORY[op.regionType]);
                if (op.regionType === 'all') {
                    entries.length = 0;
                }
                else {
                    const category = REGION_TYPE_TO_CATEGORY[op.regionType];
                    for (let i = entries.length - 1; i >= 0; i--) {
                        if (entries[i].category === category)
                            entries.splice(i, 1);
                    }
                }
                const synthesizedForThisOp = [];
                for (const cleared of clearedEntries) {
                    const regionType = op.regionType !== 'all' ? op.regionType : CATEGORY_TO_REGION_TYPE[cleared.category];
                    if (!regionType)
                        continue;
                    const targetRaw = formatRect(cleared.region);
                    const syntheticOp = { action: 'remove', regionType, targetRaw };
                    synthesizedForThisOp.push(syntheticOp);
                    clearSynthesizedOps.push(syntheticOp);
                    resolvedOnRefBeforeConversion.set(targetRaw, cleared.region);
                    sourceAppliedRegions.set(syntheticOp, [cleared.region]);
                }
                clearSynthesizedByOp.set(op, synthesizedForThisOp);
                continue;
            }
            const region = resolvedOnRef.get(op.targetRaw);
            const removed = removeSimilarRegion(entries, region); // an add replaces a similar existing region; a remove just drops it
            if (op.action === 'add') {
                const category = REGION_TYPE_TO_CATEGORY[op.regionType];
                entries.push({ category, region });
                // Replacing an existing region of the exact same category with an equivalent one is a
                // no-op — only a genuinely new region, or an actual category change, is an applied change.
                if (!removed || removed.category !== category)
                    sourceAppliedRegions.set(op, [region]);
            }
            else if (removed) {
                sourceAppliedRegions.set(op, [removed.region]);
            }
        }
        // A clear op is never itself reported — it's replaced, in place, by the concrete synthesized
        // remove op(s) that actually resulted from it (zero, if it had nothing to clear).
        const sourceAppliedRegionOps = [];
        for (const op of regionOps) {
            if (isClearOp(op)) {
                for (const syntheticOp of (_a = clearSynthesizedByOp.get(op)) !== null && _a !== void 0 ? _a : []) {
                    sourceAppliedRegionOps.push({ op: formatRegionOp(syntheticOp), result: sourceAppliedRegions.get(syntheticOp) });
                }
                continue;
            }
            sourceAppliedRegionOps.push({ op: formatRegionOp(op), result: (_b = sourceAppliedRegions.get(op)) !== null && _b !== void 0 ? _b : [] });
        }
        // regionOps.length > 0 is guaranteed by the guard above, so — unlike resolveStep, where this
        // is conditional on a side-flip remap — annotations are always sent here.
        const stepUpdate = {
            index: stepIndex,
            variantId: null,
            annotations: bucketRegions(entries),
            removedAnnotations: emptyAnnotations(),
        };
        const stepUpdatesBySession = new Map([[sessionId, [stepUpdate]]]);
        const sourceInfo = simplifySession(rawSession, { includeSteps: false });
        const regionResults = [
            {
                sessionId,
                sessionName: sourceInfo.sessionName,
                environment: sourceInfo.environment,
                stepIndex,
                stepTag: (_d = (_c = rawSession.actualAppOutput) === null || _c === void 0 ? void 0 : _c[stepIndex]) === null || _d === void 0 ? void 0 : _d.tag,
                appliedRegionOps: sourceAppliedRegionOps,
            },
        ];
        if (propagate) {
            // Every add/remove op is propagate-eligible, plus every synthetic remove op a clear op
            // expanded into above — except a speck, which images/find matches almost everywhere.
            const propagatableOps = [...regionOps.filter(op => !isClearOp(op)), ...clearSynthesizedOps].filter(op => !isTooSmallRegion(resolvedOnRefBeforeConversion.get(op.targetRaw)));
            if (propagatableOps.length > 0) {
                const sourceImage = imageForSide(rawSession, stepIndex, refSide);
                const candidateSteps = await findPropagationCandidateSteps(rawSession, stepIndex, sessionId, baseUrl, batchId, accountId, keys, propagate, false, deps);
                // Each candidate's own current side/image is what a newly found region should be
                // searched against and stored on — images/find matches regardless of which side each
                // image is.
                const targetsByImageId = new Map();
                const targets = [];
                const addStepTarget = (raw, side, targetStepIndex, isLiteral) => {
                    const image = imageForSide(raw, targetStepIndex, side);
                    if (!(image === null || image === void 0 ? void 0 : image.id))
                        return; // no image at all for this step — genuinely nothing to search
                    targetsByImageId.set(image.id, { raw, stepIndex: targetStepIndex, newSide: side, isLiteral });
                    targets.push(image);
                };
                // The source step's own current side is always included as a search target too — a
                // repeated component should have every occurrence on this step found and applied, not
                // just the literal id/rect the caller named.
                addStepTarget(rawSession, newSide, stepIndex, true);
                for (const candidate of candidateSteps) {
                    addStepTarget(candidate.raw, resolveDomIdSide('unchanged', candidate.raw, candidate.stepIndex), candidate.stepIndex);
                }
                if (targets.length > 0) {
                    const accumulators = new Map(); // keyed by `${sessionId}::${stepIndex}`
                    const accKey = (id, step) => `${id}::${step}`;
                    // One images/find call per op, each searching every in-scope target at once — a
                    // target's result array has no positional correspondence to the input regions[], and a
                    // computer-vision-only match carries no domSelector to disambiguate which op it came
                    // from when several are searched together.
                    for (const op of propagatableOps) {
                        const region = resolvedOnRefBeforeConversion.get(op.targetRaw);
                        const found = await deps.findRegionsInImages(sourceImage, [region], targets, { baseUrl, accountId, keys });
                        for (const [imageId, foundRegions] of Object.entries(found)) {
                            if (foundRegions.length === 0)
                                continue;
                            const targetMeta = targetsByImageId.get(imageId);
                            if (!targetMeta)
                                continue;
                            const key = accKey(targetMeta.raw.id, targetMeta.stepIndex);
                            let acc = accumulators.get(key);
                            if (!acc) {
                                // The literal (session, step) the caller named already has its regionOps applied
                                // directly onto `entries` above — reuse that same array so further occurrences
                                // land in the same working set. Every other target starts from its own current
                                // region set instead.
                                const entriesForAcc = targetMeta.isLiteral
                                    ? entries
                                    : getEffectiveRegions(targetMeta.raw, targetMeta.stepIndex).regions.map(({ category, baseline, checkpoint }) => ({
                                        category,
                                        region: (targetMeta.newSide === 'baseline'
                                            ? (baseline !== null && baseline !== void 0 ? baseline : checkpoint)
                                            : (checkpoint !== null && checkpoint !== void 0 ? checkpoint : baseline)),
                                    }));
                                acc = {
                                    raw: targetMeta.raw,
                                    stepIndex: targetMeta.stepIndex,
                                    isLiteral: targetMeta.isLiteral,
                                    entries: entriesForAcc,
                                    appliedByOp: new Map(),
                                };
                                accumulators.set(key, acc);
                            }
                            const toAdd = [];
                            const affected = [];
                            for (const foundRegion of foundRegions) {
                                // domSelector may be '' here — a computer-vision-only match with no anchor.
                                const foundAsRegion = {
                                    domSelector: foundRegion.domSelector,
                                    left: foundRegion.left,
                                    top: foundRegion.top,
                                    width: foundRegion.width,
                                    height: foundRegion.height,
                                };
                                // On the literal (session, step) the caller named, this search inevitably
                                // re-finds the literal region the op already applied above — skip anything
                                // that's just that same region again.
                                if (targetMeta.isLiteral &&
                                    ((_e = sourceAppliedRegions.get(op)) !== null && _e !== void 0 ? _e : []).some(r => findSimilarExistingRegion([{ category: 'ignore', region: r }], foundAsRegion) !== null))
                                    continue;
                                if (op.action === 'add') {
                                    const category = REGION_TYPE_TO_CATEGORY[op.regionType];
                                    const replaced = removeSimilarRegion(acc.entries, foundAsRegion); // an add still replaces a similar existing region first
                                    toAdd.push({ category, region: foundAsRegion });
                                    // A prior call's own propagation may have already planted an equivalent region
                                    // on this target (e.g. a sibling reviewed separately, propagating the same
                                    // recurring diff here again) — replacing it with an equivalent one is a no-op,
                                    // not a newly applied change, so it must not inflate this call's own count.
                                    if (!replaced || replaced.category !== category)
                                        affected.push(foundAsRegion);
                                }
                                else {
                                    // Only report something if there was actually a similar existing region there
                                    // to remove.
                                    const removed = removeSimilarRegion(acc.entries, foundAsRegion);
                                    if (removed)
                                        affected.push(removed.region);
                                }
                            }
                            acc.entries.push(...toAdd);
                            if (affected.length > 0) {
                                const opKey = formatRegionOp(op);
                                if (!acc.appliedByOp.has(opKey))
                                    acc.appliedByOp.set(opKey, { op: opKey, result: [] });
                                acc.appliedByOp.get(opKey).result.push(...affected);
                            }
                        }
                    }
                    for (const acc of accumulators.values()) {
                        if (acc.appliedByOp.size === 0)
                            continue;
                        // The literal (session, step) the caller named is already represented by
                        // regionResults[0] — merge any further-occurrence results straight into that
                        // existing entry's per-op result lists instead of reporting it a second time.
                        if (acc.isLiteral) {
                            for (const applied of acc.appliedByOp.values()) {
                                const existing = sourceAppliedRegionOps.find(a => a.op === applied.op);
                                if (existing)
                                    existing.result.push(...applied.result);
                                else
                                    sourceAppliedRegionOps.push(applied);
                            }
                            continue;
                        }
                        // Grouped by session id — a session touched on more than one step accumulates every
                        // one of its step updates into the same array, so it rides as a single updates[]
                        // entry with multiple stepUpdates.
                        if (!stepUpdatesBySession.has(acc.raw.id))
                            stepUpdatesBySession.set(acc.raw.id, []);
                        stepUpdatesBySession.get(acc.raw.id).push({
                            index: acc.stepIndex,
                            variantId: null,
                            annotations: bucketRegions(acc.entries),
                            removedAnnotations: emptyAnnotations(),
                        });
                        const targetInfo = simplifySession(acc.raw, { includeSteps: false });
                        regionResults.push({
                            sessionId: acc.raw.id,
                            sessionName: targetInfo.sessionName,
                            environment: targetInfo.environment,
                            stepIndex: acc.stepIndex,
                            stepTag: (_g = (_f = acc.raw.actualAppOutput) === null || _f === void 0 ? void 0 : _f[acc.stepIndex]) === null || _g === void 0 ? void 0 : _g.tag,
                            appliedRegionOps: [...acc.appliedByOp.values()],
                        });
                    }
                }
            }
        }
        await deps.postStepUpdates({ baseUrl, batchId, accountId, keys }, stepUpdatesBySession);
        return regionResults;
    }
    catch (error) {
        throw new Error(`Error updating regions: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/** The save endpoint returns nothing useful to the caller — a resolved promise signals success. */
async function saveBaselines(url, keys, deps = defaultCommandsDeps) {
    try {
        const { baseUrl, batchId, accountId } = await parseSessionUrlVerified(url, keys);
        await deps.saveBaselines({ baseUrl, batchId, accountId, keys });
    }
    catch (error) {
        throw new Error(`Error saving baselines: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Reverting the shared baseline object and clearing a session's own pending resolution are two
 * independent server-side operations — restoring the baseline leaves `appOutputResolution`
 * completely untouched. The batch-wide reset endpoint clears that state — but only while it's
 * still pending; it's harmless (a no-op, not an error) when a session has nothing pending, so
 * it's called for every session in scope rather than needing its own gate.
 */
async function resetBaselines(url, keys, deps = defaultCommandsDeps) {
    try {
        const { baseUrl, batchId, sessionId, accountId } = await parseApplitoolsUrlVerified(url, keys);
        const sessions = sessionId
            ? [await deps.fetchRawSession({ baseUrl, batchId, sessionId, accountId, keys })]
            : await deps.fetchRawBatchSessions({ baseUrl, batchId, accountId, keys });
        // A session that was never saved never moved the shared baseline away from its original
        // revision, so there's nothing to restore there.
        const restoredIds = new Set(sessions.filter(s => s.savedTo != null).map(s => s.id));
        const clearedIds = new Set(sessions.filter(hasUnsavedChanges).map(s => s.id));
        await Promise.all(sessions
            .filter(s => restoredIds.has(s.id))
            .map(s => deps.restoreBaseline({ baseUrl, accountId, baselineId: s.baselineId, baselineRev: s.baselineRev, keys })));
        if (sessions.length > 0) {
            await deps.resetBatchSessions({ baseUrl, batchId, accountId, keys }, sessions.map(s => s.id));
        }
        return {
            batchId,
            sessions: sessions.map(s => ({
                id: s.id,
                scenarioName: s.scenarioName,
                baseline: restoredIds.has(s.id),
                resolution: clearedIds.has(s.id),
                ...(restoredIds.has(s.id) ? { baselineId: s.baselineId, baselineRev: s.baselineRev } : {}),
            })),
        };
    }
    catch (error) {
        throw new Error(`Error resetting baselines: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Deliberately NOT the shared `BATCH_URL_DESC` from `eyes-inspect/tools.ts`: that one tells the
// caller a trailing session/step segment is harmless and can be left on, which is exactly what
// `eyes_resolve_reset` — the one tool where the URL's shape *is* the scope — must not say. Here, a
// trailing sessionId is NOT ignored: its presence is what switches the scope from the whole batch
// down to just that one session (`parseApplitoolsUrl` reports it whenever present) — a `/steps/{N}`
// suffix past that is genuinely ignored, since reset has no step-level granularity at all.
const RESET_BATCH_URL_DESC = 'Eyes batch URL: https://eyes.applitools.com/app/test-results/{batchId}/?accountId=... with no trailing /{sessionId} segment — unlike elsewhere in this API, adding one is not a harmless no-op here; it would switch the scope down to just that one session (use the session-URL form above for that case instead)';
// The eyes-resolve tools: one static, independently-validated `registerTool` per mutation, each
// handler calling `commands.ts`'s functions directly with no extra per-tool wrapper in between.
// `checkpoint` and `regions` take an enum (`action`/`target`) for the one axis their two former
// per-choice tools differed on — that axis is part of the operation's own shape, not a dispatcher
// over unrelated commands.
// `resolveApiKeyProvider` and the shared arg descriptions come from `eyes-inspect/tools.ts` — the
// read-side base layer owns them, so there's exactly one copy of each.
function recordResolveChainSource(scopeId) {
    try {
        recordChainSource(scopeId());
    }
    catch { }
}
function toPropagateSpec(propagate) {
    if (propagate === undefined)
        return { regex: null };
    if (propagate === 'none')
        return null;
    return { regex: new RegExp(propagate) };
}
/** Every `eyes_resolve_*` tool's own name, in one place — every `registerTool` call below reads from here, so a rename can't leave a stale literal behind. */
const EYES_RESOLVE_TOOLS = {
    checkpoint: 'eyes_resolve_checkpoint',
    regions: 'eyes_resolve_regions',
    save: 'eyes_resolve_save',
    reset: 'eyes_resolve_reset',
};
/** `target` names the side a regionOp's ids/rects are read against; `commands.ts` spells the same choice as its own action. */
const REGION_TARGET_ACTIONS = {
    baseline: 'baseline-regions',
    checkpoint: 'checkpoint-regions',
};
const ACTION_DESC = 'Which decision to mark. "accept": its baseline image will be replaced by the checkpoint the next time ' +
    'eyes_resolve_save runs. "reject": its baseline image is retained.';
const REGION_TARGET_DESC = 'Which side every regionOp\'s ids/rects are read against. "baseline": the BASELINE image/DOM. "checkpoint": the ' +
    'CHECKPOINT image/DOM instead.';
const PROPAGATE_DESC = 'Which other steps also get this exact change, applied together in the same tool call. Omitted (default): every ' +
    "other step of this session, plus every step of every other session sharing this session's exact scenario " +
    'name (its other browsers/OS/viewports) — narrowed to the steps that actually apply before anything is sent. ' +
    '"none": only this step — opt out of the default. Any other string: an additional regex tested against every ' +
    'session\'s scenario name, e.g. "Login|Checkout" — sessions matching are included in the candidate pool on top ' +
    'of the same-scenario default.';
const REGION_OP_DESC = 'A compact match-region change: (+|-)<matchLevel>-(<rect>|<id>). matchLevel, strictest to loosest: strict (near pixel-perfect), ignorecolors ' +
    '(color-only drift tolerated), layout (content may change but structure must still hold — a ' +
    'vanished/overlapping/resized element is still flagged), ignore (nothing in the region is ever checked). Always pick the strictest level ' +
    'that still accommodates the diff: prefer layout over ignore. A dynamic add is refused — dynamic is the default match level — so add layout instead. Target is a raw rect "left,top,width,height" or a bare DOM node ' +
    'id from eyes_inspect_dom/eyes_inspect_dom_diff. A removal target may also be a glob: "-*" removes every region, "-<matchLevel>-*" removes ' +
    'every region of that one category. Examples: "+layout-14", "-ignore-100,200,50,80", "-layout-*".';
function registerEyesResolveTools(server, deps = defaultCommandsDeps) {
    server.registerTool(EYES_RESOLVE_TOOLS.checkpoint, {
        description: "Marks a step's checkpoint image as accepted or rejected, per `action` — see its own description for what " +
            "each one does to the baseline. Only call this once the step's differences have actually been investigated " +
            'and judged (see the eyes_inspect_* tools). By default also accepts (or rejects) every other still-unresolved ' +
            "step that genuinely shares this step's diff, across this session and same-scenario siblings — see " +
            'propagate; a candidate that already has its own accept/reject decision is left alone. A low-level primitive: ' +
            'for a driven review that also resolves what it finds, use eyes_review_progress with mode: "resolve" ' +
            'instead — it calls this deterministically from its own findings. Call this directly only for a one-off ' +
            'manual decision outside that review.',
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            action: zod.z.enum(['accept', 'reject']).describe(ACTION_DESC),
            propagate: zod.z.string().optional().describe(PROPAGATE_DESC),
        },
    }, async ({ sessionUrl, stepIndex, action, propagate }) => {
        recordResolveChainSource(() => stepScopeId(sessionUrl, stepIndex));
        const keys = resolveApiKeyProvider(sessionUrl);
        const result = await resolveStep(sessionUrl, stepIndex, action, keys, toPropagateSpec(propagate), deps);
        return textResult(JSON.stringify(result, null, 2));
    });
    server.registerTool(EYES_RESOLVE_TOOLS.regions, {
        description: "Adds/removes/updates a step's ignore or match regions, with every regionOp's ids/rects read against the " +
            "BASELINE or CHECKPOINT image/DOM per `target` (mapped onto whichever side the step's current resolution " +
            'actually needs). Does not itself change accept/reject. Propagates by default (see propagate) since masking ' +
            "confirmed-dynamic content applies regardless of a sibling's own accept/reject verdict. Returns one entry per " +
            'touched step, each listing the regions actually changed by each input regionOp (a clear op is reported as the ' +
            'concrete regions it removed). A low-level primitive: for a driven review that also resolves what it finds, use ' +
            'eyes_review_progress with mode: "resolve" instead — it calls this deterministically from its own ' +
            'findings. Call this directly only for a one-off manual fix outside that review.',
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            target: zod.z.enum(['baseline', 'checkpoint']).describe(REGION_TARGET_DESC),
            regionOps: zod.z.array(zod.z.string()).min(1).describe(REGION_OP_DESC),
            propagate: zod.z.string().optional().describe(PROPAGATE_DESC),
        },
    }, async ({ sessionUrl, stepIndex, target, regionOps, propagate }) => {
        recordResolveChainSource(() => stepScopeId(sessionUrl, stepIndex));
        const keys = resolveApiKeyProvider(sessionUrl);
        const result = await updateRegions(sessionUrl, stepIndex, REGION_TARGET_ACTIONS[target], regionOps, keys, toPropagateSpec(propagate), deps);
        return textResult(JSON.stringify(result, null, 2));
    });
    server.registerTool(EYES_RESOLVE_TOOLS.save, {
        description: 'Saves every accepted/rejected step and region change in the WHOLE BATCH to the baseline — all of its ' +
            'tests, not just the session in the URL (the server save is batch-scoped; the session part only identifies ' +
            'the batch). A potentially destructive, hard-to-reverse operation. Only call it once the user has ' +
            'explicitly approved committing the changes just made.',
        inputSchema: { sessionUrl: zod.z.string().describe(SESSION_URL_DESC) },
    }, async ({ sessionUrl }) => {
        recordResolveChainSource(() => batchScopeId(sessionUrl));
        const keys = resolveApiKeyProvider(sessionUrl);
        await saveBaselines(sessionUrl, keys, deps);
        return textResult('Baselines saved.');
    });
    server.registerTool(EYES_RESOLVE_TOOLS.reset, {
        description: "Restores every in-scope session's baseline to the revision the test originally ran against, and clears " +
            'any pending (unsaved) accept/reject/region resolution back to unresolved. Unlike every other eyes_resolve_*/' +
            "eyes_inspect_* tool, the URL's shape is not just a locator — it IS the scope: a session URL (even with a " +
            '/steps/N suffix) resets only that one session, while a bare batch URL resets every session in the batch. ' +
            'If the user asks to reset "the batch"/"everything"/"all sessions" but only a session or step URL is on ' +
            'hand (e.g. reused from an earlier call in this conversation), strip it down to the bare batch form first — ' +
            'passing the session URL as-is will silently under-scope the reset. Destructive and not undoable — only ' +
            'call it with explicit user approval of that exact scope.',
        inputSchema: {
            url: zod.z
                .string()
                .describe(`Either a session URL or a batch URL — whichever shape you pass IS the scope, and the two are not interchangeable; choose deliberately based on the scope the user approved. ${SESSION_URL_DESC}. Resets ONLY that session. ${RESET_BATCH_URL_DESC}. Resets every session in the batch.`),
        },
    }, async ({ url }) => {
        recordResolveChainSource(() => batchScopeId(url));
        const keys = resolveApiKeyProvider(url);
        const result = await resetBaselines(url, keys, deps);
        return textResult(JSON.stringify(result, null, 2));
    });
}

/**
 * Wraps `lib/phase-tracker`'s own `log`, always normalizing `scopeId` down to its investigation's
 * root first — so every caller in this module can log against whatever scope id is natural to
 * its own call (a batch id, a session id, anything below it) without having to remember to
 * resolve it to a root itself, and every entry raised anywhere in one investigation still
 * consolidates into that investigation's own single debug log rather than scattering per level.
 */
function log(scopeId, label, fields = {}, deps) {
    log$1(rootScopeId(scopeId), label, fields, deps);
}
/** The exact path `log` above appends `scopeId`'s investigation's entries to — see `log`'s own doc comment for the root-normalization it applies first. */
function debugLogPath(scopeId, deps) {
    return getLogFilePath(rootScopeId(scopeId), deps);
}
/**
 * The shared machinery behind the parametric `eyes_review_progress`/`eyes_review_end` pair —
 * completeness/staleness computation, the `rootScope` escalation boundary, and the numeric
 * resolution/region rollups, all level-agnostic. Everything level-specific (how to live-fetch
 * children, what shape `findings` take) lives in `tools.ts` itself.
 */
const LEVELS = ['batch', 'scenario', 'session', 'step', 'diff'];
/**
 * Every `eyes_review_*` tool's own name, in one place — every `registerTool` call and every
 * `next` instruction reads from here, so a rename can't leave a stale literal behind. The
 * progress/end pair is parametric over `scope` (see `SCOPE_TYPES`) rather than one tool per
 * level; `diffReport` is the leaf, which has no level to parameterize over.
 */
const EYES_REVIEW_TOOLS = {
    progress: 'eyes_review_progress',
    end: 'eyes_review_end',
    diffReport: 'eyes_review_diff_report',
};
/**
 * The levels `eyes_review_progress`/`eyes_review_end` address via their own `scope` argument
 * — every level except `diff`, which `eyes_review_diff_report` covers on its own.
 */
const SCOPE_TYPES = ['batch', 'scenario', 'session', 'step'];
/** The singular, human-readable noun for each level — used to compose `next.instruction` text without ever saying "child"/"sibling". */
const LEVEL_LABELS = {
    batch: 'batch',
    scenario: 'scenario',
    session: 'session',
    step: 'step',
    diff: 'changed area',
};
function levelDepth(level) {
    return LEVELS.indexOf(level);
}
/** The level directly nested inside `level` (e.g. a session's children are steps) — `undefined` for `diff`, the deepest level. */
function childLevelOf(level) {
    return LEVELS[levelDepth(level) + 1];
}
/** The level `level` is nested inside (e.g. a session sits inside a scenario) — `undefined` for `batch`, the top level. */
function parentLevelOf(level) {
    return LEVELS[levelDepth(level) - 1];
}
/** The singular, human-readable noun for whatever is nested directly inside `level` (e.g. `session` → `"step"`). */
function childLevelLabel(level) {
    return LEVEL_LABELS[childLevelOf(level)];
}
/**
 * `rootScope`, defaulted to `level` itself when the caller omits it — except a diff, which always
 * belongs to at least a step review, so a diff-rooted `next` would strand the model after the last area.
 */
function resolveRootScope(level, rootScope) {
    return rootScope !== null && rootScope !== void 0 ? rootScope : (level === 'diff' ? 'step' : level);
}
function isScopeType(value) {
    return SCOPE_TYPES.includes(value);
}
/** Whether `outer` is `inner` itself or one of its ancestors. */
function isAtOrAbove(outer, inner) {
    return levelDepth(outer) <= levelDepth(inner);
}
/** Whether escalating beyond `level` (to a sibling, or to the parent) would go past the entity the investigation was scoped to. */
function hasReachedRootScope(level, rootScope) {
    return level === rootScope;
}
const MODES = ['inspect', 'resolve'];
/** `mode`, defaulted to `'resolve'` when the caller omits it — a review is expected to act on what it finds unless told otherwise. */
function resolveMode(mode) {
    return mode !== null && mode !== void 0 ? mode : 'resolve';
}
/**
 * The only way to build a `NextCall` — `rootScope` and `mode` are required parameters, not something
 * applied after the fact, so a call can never be constructed without them. This is what makes
 * forgetting to thread the investigation's `rootScope`/`mode` from one review-tool hop to the next a
 * compile error rather than a silent bug: omitting either here isn't optional the way skipping a
 * "remember to call this helper before returning" step would be. Every `NextCall` in `tools.ts` —
 * child-descent, `_end`, sibling, parent `_progress` — must be built through this function.
 */
function nextCall(tool, args, rootScope, mode) {
    return { tool, args: { ...args, rootScope, mode } };
}
/**
 * A call to `eyes_review_progress` for one level. `scope` is a required parameter — same
 * reasoning as `nextCall`'s own `rootScope`/`mode`: since the tool name no longer encodes the level,
 * a `next` call that omitted `scope` would name a tool the model cannot dispatch, so making
 * it a parameter of the only builder that can produce such a call keeps that a compile error.
 */
function reviewProgressCall(scope, args, rootScope, mode) {
    return nextCall(EYES_REVIEW_TOOLS.progress, { scope, ...args }, rootScope, mode);
}
/** A call to `eyes_review_end` for one level — see `reviewProgressCall` for why `scope` is a parameter. */
function reviewEndCall(scope, args, rootScope, mode) {
    return nextCall(EYES_REVIEW_TOOLS.end, { scope, ...args }, rootScope, mode);
}
/**
 * Resolves `scopeId`'s children from a stable, append-only queue rather than a live fetch on
 * every call — a child once queued is investigated exactly once, regardless of what a later live
 * fetch would show (e.g. a sibling silently resolved via cross-session propagation and dropping
 * out of a "still unresolved" live list, or a step deliberately left unresolved that would
 * otherwise still match a live "not yet decided" filter). Only re-checks live data when the
 * current queue is empty (first call) or fully visited (`isCompleted` on every queued child's own
 * scope id) — otherwise it returns the cached, still-incomplete queue untouched, with no network
 * call at all. On a fresh check, only genuinely new keys are appended (`queueChildKeys`'s own
 * dedup) — nothing is ever removed. Always returns the full cumulative queue (old + new, completed
 * or not), so it drops straight into `runProgress`'s `computeCompleted`/descent resolution and
 * `runEnd`'s `ownChildren`/`getSiblings` exactly like a plain live-fetched list would.
 */
async function resolveScopedChildren(scopeId, fetchLiveChildKeys, descriptorForKey, deps) {
    let queued = getQueuedChildKeys(scopeId, deps);
    const exhausted = queued.every(key => isCompleted(descriptorForKey(key).scopeId, deps)); // vacuously true when queued is empty — covers the first-ever call too
    if (exhausted)
        queued = queueChildKeys(scopeId, await fetchLiveChildKeys(), deps);
    return queued.map(descriptorForKey);
}
/**
 * `completed` — an ISO-8601 timestamp if `scopeId`'s own `_end` has succeeded, every one of
 * `liveChildScopeIds` is itself completed, and none of them completed *after* `scopeId` did;
 * `null` otherwise. A leaf level (no children of its own, e.g. `diff`) calls this with an empty
 * `liveChildScopeIds` — the child checks trivially pass, so the result reduces to just "is
 * `scopeId` itself completed."
 */
function computeCompleted(scopeId, liveChildScopeIds, deps) {
    const ownCompletion = getCompletion(scopeId, deps);
    if (!ownCompletion)
        return null;
    const childCompletions = liveChildScopeIds.map(id => getCompletion(id, deps));
    if (childCompletions.some(c => !c))
        return null;
    if (childCompletions.some(c => c.completedAt > ownCompletion.completedAt))
        return null;
    return ownCompletion.completedAt;
}
/**
 * `eyes_review_progress`'s `next`, for the level it was called on: while any step of this level's
 * investigation remains, exactly one ready-made call for the next one to review; once every one of
 * them was reviewed but this level's own `completed` is still `null` (never called, or invalidated
 * by one of them being reviewed/revised afterward), the instruction to call `eyes_review_end` for
 * this same level (`scope`); once `completed` holds a fresh timestamp, nothing further — plus,
 * only while `level` hasn't already reached `rootScope`, a suggestion to move on to the parent's own
 * `eyes_review_progress` call. Every incoming call (`descentCall`, `endCall`,
 * `parentProgressCall`) is expected to already carry the investigation's `rootScope` — built via
 * `nextCall()` at its construction site in `tools.ts` — so this function only ever selects among
 * them, never mutates or re-scopes one.
 */
function buildProgressNext(params) {
    return withRootReminder(progressNext(params), params.rootScope);
}
function progressNext(params) {
    const { level, rootScope, completed, descentCall, endCall, hasChildFindings, parentProgressCall } = params;
    const label = LEVEL_LABELS[level];
    const childLabel = LEVEL_LABELS[childLevelOf(level)];
    if (completed === null) {
        if (descentCall) {
            return {
                instruction: `Not every ${childLabel} of this ${label} was reviewed. Call this next, in this order — don't reorder or substitute your own priority:`,
                calls: [descentCall],
            };
        }
        if (!hasChildFindings) {
            return {
                instruction: emptyCloseInstruction(`Every ${childLabel} of this ${label} was reviewed and none of them recorded a finding`, endCall.tool, level),
                calls: [withEmptyFindings(endCall)],
            };
        }
        return {
            instruction: `Every ${childLabel} of this ${label} was reviewed. Call ${endCall.tool} with scope "${level}" and a summary built from findings.`,
            calls: [endCall],
        };
    }
    if (hasReachedRootScope(level, rootScope) || !parentProgressCall) {
        return { instruction: `This ${label} was fully reviewed. No further action is needed here.` };
    }
    const parentLabel = LEVEL_LABELS[parentLevelOf(level)];
    return {
        instruction: `This ${label} was fully reviewed. Move on to ${parentProgressCall.tool} for the ${parentLabel} — only call its own ${EYES_REVIEW_TOOLS.end} once it reports being fully reviewed too.`,
        calls: [parentProgressCall],
    };
}
/** Clients that rebuild arguments instead of copying `next.calls` drop `rootScope`; restating it in prose keeps it in view. */
function rootReminder(rootScope) {
    return `This review is rooted at scope "${rootScope}" — pass rootScope: "${rootScope}" on every eyes_review_* call until it reports complete.`;
}
/** Root responses carry no calls and keep their done message verbatim. */
function withRootReminder(next, rootScope) {
    return next.calls ? { ...next, instruction: `${next.instruction} ${rootReminder(rootScope)}` } : next;
}
function emptyCloseInstruction(reviewedNothingFound, endTool, scope) {
    return `${reviewedNothingFound}, so there is nothing to summarize — call ${endTool} with scope "${scope}" and \`findings: []\` (an empty list is the only valid submission here).`;
}
function withEmptyFindings(call) {
    return { ...call, args: { ...call.args, findings: [] } };
}
/**
 * `eyes_review_end`'s `next` for one level, once its checks have passed (soft-incomplete redirects
 * are built by the caller directly — see `tools.ts`): while `level` hasn't reached `rootScope`, a call
 * to the next unreviewed instance of this same level if one exists, else the parent's own
 * `eyes_review_progress` call; once `level` has reached `rootScope`, neither is ever suggested — the
 * entity the investigation was scoped to is done. As with `buildProgressNext`, `siblingCall`/
 * `parentProgressCall` are expected to already carry `rootScope` from their `nextCall()` call site.
 */
function buildEndNext(params) {
    return withRootReminder(endNext(params), params.rootScope);
}
function endNext(params) {
    const { level, rootScope, siblingCall, parentClose, parentProgressCall, doneMessage } = params;
    const label = LEVEL_LABELS[level];
    if (hasReachedRootScope(level, rootScope)) {
        return { instruction: doneMessage };
    }
    if (siblingCall) {
        const target = LEVEL_LABELS[siblingCall.level];
        return {
            instruction: siblingCall.level === level
                ? `This ${label} was reviewed. Another ${label} still needs reviewing — call it next.`
                : `This ${label} was reviewed. Reviewing continues at the next unreviewed ${target} — call it next.`,
            calls: [siblingCall.call],
        };
    }
    if (parentClose) {
        const closeLabel = LEVEL_LABELS[parentClose.level];
        if (!parentClose.hasChildFindings) {
            return {
                instruction: emptyCloseInstruction(`This ${label} was reviewed, and so was every other ${label}, so the ${closeLabel} is now fully reviewed too — and none of its ${childLevelLabel(parentClose.level)}s recorded a finding`, parentClose.endCall.tool, parentClose.level),
                calls: [withEmptyFindings(parentClose.endCall)],
                nextLevel: parentClose.nextLevel,
            };
        }
        return {
            instruction: `This ${label} was reviewed, and so was every other ${label}, so the ${closeLabel} is now fully reviewed too. Call ${parentClose.endCall.tool} for the ${closeLabel} next, citing the indexed findings in next.nextLevel as its sources — do not re-check its progress first, this response already is that answer.`,
            calls: [parentClose.endCall],
            nextLevel: parentClose.nextLevel,
        };
    }
    if (parentProgressCall) {
        const parentLabelHere = LEVEL_LABELS[parentLevelOf(level)];
        return {
            instruction: `This ${label} was reviewed, and so was every other ${label}. Move on to ${parentProgressCall.tool} for the ${parentLabelHere}.`,
            calls: [parentProgressCall],
        };
    }
    return { instruction: doneMessage };
}
const EMPTY_RESOLUTION_PROGRESS = { accepted: 0, rejected: 0, unresolved: 0 };
function emptyRollup() {
    return { resolution: { ...EMPTY_RESOLUTION_PROGRESS }, regions: [] };
}
function sumResolutionProgress(items) {
    return items.reduce((total, item) => {
        var _a, _b, _c;
        return ({
            accepted: total.accepted + ((_a = item === null || item === void 0 ? void 0 : item.accepted) !== null && _a !== void 0 ? _a : 0),
            rejected: total.rejected + ((_b = item === null || item === void 0 ? void 0 : item.rejected) !== null && _b !== void 0 ? _b : 0),
            unresolved: total.unresolved + ((_c = item === null || item === void 0 ? void 0 : item.unresolved) !== null && _c !== void 0 ? _c : 0),
        });
    }, { ...EMPTY_RESOLUTION_PROGRESS });
}
/**
 * Consolidates region changes by their `(before, after)` pair, summing the counts of every entry
 * sharing a pair — the single operation behind both "aggregate one finding's own applied ops" and
 * "merge every child's already-aggregated totals", since they're the same arithmetic. Entries
 * with a zero/negative count are dropped, so an empty result genuinely means "nothing changed".
 */
function mergeRegionChangeCounts(lists) {
    var _a, _b;
    const byPair = new Map();
    for (const list of lists) {
        for (const entry of list !== null && list !== void 0 ? list : []) {
            if (!entry || entry.count <= 0)
                continue;
            const key = `${(_a = entry.before) !== null && _a !== void 0 ? _a : ''}→${(_b = entry.after) !== null && _b !== void 0 ? _b : ''}`;
            const existing = byPair.get(key);
            if (existing)
                existing.count += entry.count;
            else
                byPair.set(key, { before: entry.before, after: entry.after, count: entry.count });
        }
    }
    return [...byPair.values()];
}
/** Whether `regions` records at least one masking attempt that could not be applied (§4's guard rails). */
function hasRegionFailure(regions) {
    return (regions !== null && regions !== void 0 ? regions : []).some(entry => entry.before === null && entry.after === null && entry.count > 0);
}
function mergeRollups(rollups) {
    return {
        resolution: sumResolutionProgress(rollups.map(r => r.resolution)),
        regions: mergeRegionChangeCounts(rollups.map(r => r.regions)),
    };
}
/**
 * The completion-registry key a level's children accumulate their numeric rollups under — a
 * sibling record to the findings one, keyed off the same scope id. Kept separate so attaching a
 * numeric rollup never changes the shape of `findings` itself, and so a parent can merge one
 * canonical total per child rather than having to guess which of a child's several findings
 * carries the child's total (they all carry the same one, for the reader's benefit).
 */
function rollupScopeId(scopeId) {
    return `${scopeId}#rollup`;
}
/** Records `childKey`'s rollup under `parentScopeId` — overwriting on a repeat call, so re-running a level's `_end` re-states rather than double-counts. */
function reportRollup(parentScopeId, childKey, rollup, deps) {
    appendChildFinding(rollupScopeId(parentScopeId), childKey, rollup, deps);
}
/** Every rollup `scopeId`'s children have reported so far, merged into one total. */
function childRollupTotal(scopeId, deps) {
    return mergeRollups(Object.values(getChildFindings(rollupScopeId(scopeId), deps)));
}
/** Each child's own reported rollup, keyed by the child key it reported under. */
function childRollups(scopeId, deps) {
    return getChildFindings(rollupScopeId(scopeId), deps);
}
/**
 * A consolidating level's own rollup: its children's tallies summed and their region changes
 * merged, with the merged region total attached to every finding the model just submitted (or, on
 * a promotion replay, the same findings already on record). The total is what gets reported
 * upward (once, from `runEnd`'s own `rollup`), so attaching it to each finding is for the reader's
 * benefit and never multiplies into the parent's arithmetic. Nothing is attached in
 * `mode: 'inspect'`, where no region can have changed in the first place.
 */
function consolidateRollup(scopeId, findings, mode, deps) {
    const rollup = childRollupTotal(scopeId, deps);
    if (mode !== 'resolve')
        return { findings, rollup };
    return { findings: findings.map(finding => ({ ...finding, regions: rollup.regions })), rollup };
}
function scopeIdFor(level, ctx) {
    switch (level) {
        case 'batch':
            return batchScopeId(ctx.batchUrl);
        case 'scenario':
            return scenarioScopeId(ctx.batchUrl, ctx.scenarioName);
        case 'session':
            return sessionScopeId(ctx.sessionUrl);
        case 'step':
            return stepScopeId(ctx.sessionUrl, ctx.stepIndex);
        case 'diff':
            return diffScopeId(ctx.sessionUrl, ctx.stepIndex, ctx.areaRect);
    }
}
function childContextFor(level, ctx, childKey) {
    switch (level) {
        case 'batch':
            return { batchUrl: ctx.batchUrl, scenarioName: childKey }; // scenarioChildKey is identity
        case 'scenario':
            return { sessionUrl: childKey }; // sessionChildKey is identity
        case 'session':
            return { sessionUrl: ctx.sessionUrl, stepIndex: parseStepChildKey(childKey) };
        case 'step':
            return { sessionUrl: ctx.sessionUrl, stepIndex: ctx.stepIndex, areaRect: parseDiffChildKey(childKey) };
        case 'diff':
            throw new Error('diff has no children'); // unreachable — the childLevel check below never recurses past diff
    }
}
/**
 * Visits every node of the subtree rooted at (level, ctx), a child's own subtree fully visited
 * before the node itself (post-order) — required by promotion (a step's decision needs its
 * diffs' already-promoted region rollup), harmless for discard (order doesn't matter there).
 * `visit` decides what "visiting" a node means and is responsible for its own idempotency — this
 * walker always fully traverses the structural tree, it never itself skips a subtree.
 */
async function walkSubtree(level, ctx, visit, deps) {
    const scopeId = scopeIdFor(level, ctx);
    // Both records, unioned: a level whose own `_end` never ran has no child findings at all, but a
    // walk that got as far as its children still left them queued. Reading only the findings makes
    // every child of a partially-walked level unreachable — which let a discarded subtree keep its
    // deepest completions and report itself already reviewed on the next walk. Read before visit(),
    // which clears both.
    const childKeys = [
        ...new Set([...Object.keys(getChildFindings(scopeId, deps)), ...getQueuedChildKeys(scopeId, deps)]),
    ];
    const childLevel = LEVELS[LEVELS.indexOf(level) + 1];
    if (childLevel) {
        for (const key of childKeys)
            await walkSubtree(childLevel, childContextFor(level, ctx, key), visit, deps);
    }
    await visit(level, ctx, scopeId);
}
/** The one place entry order is decided — validation, display and clustering all derive from it, and a reordering in only one would be silently accepted. */
function orderedChildFindingEntries(scopeId, deps) {
    return Object.entries(getChildFindings(scopeId, deps));
}
/**
 * Every child finding `scopeId`'s children have reported, flattened into one array — each child's
 * own findings sub-array in full before the next child's. This is the exact list a submitted
 * finding's `sources` indexes into; see `orderedChildFindingEntries` for what fixes the order.
 */
function flattenChildFindings(scopeId, deps) {
    return orderedChildFindingEntries(scopeId, deps).flatMap(([, findings]) => findings);
}
/**
 * Attaches this same flat, global `index` to every finding across every child-key group, so
 * `_progress`'s displayed findings can be cited by a later `_end` call's `sources`. Takes/returns
 * `orderedChildFindingEntries`' own shape — feed it from there and nothing else, or display and
 * validation stop agreeing — so each level's `buildFindings` keeps its own per-child key naming
 * (`scenarioName`, `sessionUrl`, …) unchanged.
 */
function attachFindingIndices(entries) {
    let index = 0;
    return entries.map(([key, findings]) => [key, findings.map(finding => ({ ...finding, index: index++ }))]);
}
const CLUSTER_NOTE = 'These share the listed mechanical key. Whether they share a cause is your call.';
/** `undefined` when the value is a DOM node id rather than a rect. */
function asRect(value) {
    const rect = value;
    return rect && typeof rect === 'object' && typeof rect.left === 'number' && typeof rect.width === 'number'
        ? rect
        : undefined;
}
/** Levels disagree on the field name, hence both. */
function findingRect(finding) {
    var _a;
    const located = finding;
    return (_a = asRect(located.areaRect)) !== null && _a !== void 0 ? _a : asRect(located.area);
}
/** Only facts derivable from the finding itself, so the key never depends on traversal order. */
function mechanicalKey(childKey, finding) {
    var _a, _b;
    const known = finding;
    const ancestry = Object.entries((_a = known.origin) !== null && _a !== void 0 ? _a : {})
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([name, value]) => `${name}:${value}`);
    return [
        `at:${childKey}`,
        ...ancestry,
        `verdict:${known.isBug != null ? 'bug' : '-'}/${known.isExpected != null ? 'expected' : '-'}`,
        ...(((_b = known.dynamic) === null || _b === void 0 ? void 0 : _b.justification) ? [`dynamic:${known.dynamic.justification}`] : []),
    ].join(' · ');
}
/** Union-find because overlap is not transitive. Membership is stable across runs; ids are not, since they inherit the entry numbering. */
function buildSourceClusters(entries) {
    const flat = entries.flatMap(([childKey, findings]) => findings.map(finding => ({ key: mechanicalKey(childKey, finding), rect: findingRect(finding) })));
    const parent = flat.map((_, index) => index);
    const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])));
    const union = (a, b) => {
        const [x, y] = [find(a), find(b)];
        if (x < y)
            parent[y] = x;
        else if (y < x)
            parent[x] = y;
    };
    const byKey = new Map();
    flat.forEach((item, index) => { var _a; return byKey.set(item.key, [...((_a = byKey.get(item.key)) !== null && _a !== void 0 ? _a : []), index]); });
    for (const members of byKey.values()) {
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const [a, b] = [flat[members[i]], flat[members[j]]];
                // No rect on either side means no geometry to separate them, so the other keys decide.
                if (a.rect && b.rect ? rectsIntersect(a.rect, b.rect) : !a.rect && !b.rect)
                    union(members[i], members[j]);
            }
        }
    }
    const byLabel = new Map();
    flat.forEach((_, index) => {
        var _a;
        const label = find(index);
        byLabel.set(label, [...((_a = byLabel.get(label)) !== null && _a !== void 0 ? _a : []), index]);
    });
    return [...byLabel.entries()]
        .sort(([a], [b]) => a - b)
        .map(([label, indices]) => ({ id: `g${label}`, key: flat[label].key, indices, note: CLUSTER_NOTE }));
}
/** Clusters are disjoint and cover the whole numbering, so expanding them can neither manufacture an overlap nor conceal a gap from `verifySourcedFindings`. */
function expandSourceCitations(findings, clusters) {
    const byId = new Map(clusters.map(cluster => [cluster.id, cluster.indices]));
    return findings.map((finding, findingIndex) => {
        var _a;
        const cited = ((_a = finding.sourceClusters) !== null && _a !== void 0 ? _a : []).flatMap(id => {
            const indices = byId.get(id);
            if (!indices) {
                throw new Error(`Finding ${findingIndex}'s sourceClusters names "${id}", which is not one of the cluster ids this level's own findings were grouped into ` +
                    `(${clusters.map(cluster => cluster.id).join(', ') || 'there are none'}). Call again citing only ids this call was shown, or plain sources indices.`);
            }
            return indices;
        });
        return { ...finding, sources: [...new Set([...finding.sources, ...cited])].sort((a, b) => a - b) };
    });
}
/**
 * Validates a submitted `_end` finding array's `sources` against `childFindings` — the exact flat,
 * ordered list `flattenChildFindings` produces for this same scope — then checks each finding's
 * own isBug/isExpected for consistency with the isBug/isExpected of just the child findings its
 * `sources` names: isBug non-null iff any of them is, isExpected non-null iff every one of them is.
 * The checks run in this order, so the earliest structural problem surfaces before a later,
 * harder-to-diagnose one: an out-of-range index, then sources claimed by more than one finding,
 * then a child finding no finding accounts for, and only once `sources` are well-formed, the
 * isBug/isExpected check. The failing check reports every violation it found, not just the first —
 * one per rejection would cost a regenerated submission each.
 */
function verifySourcedFindings(findings, childFindings) {
    const claimedBy = new Map();
    const outOfRange = [];
    const overlapping = [];
    findings.forEach((finding, findingIndex) => {
        for (const source of finding.sources) {
            if (!Number.isInteger(source) || source < 0 || source >= childFindings.length) {
                outOfRange.push(`finding ${findingIndex}'s sources names index ${source}`);
                continue;
            }
            const claimant = claimedBy.get(source);
            if (claimant !== undefined && claimant !== findingIndex) {
                overlapping.push(`Child finding ${source} is named in both finding ${claimant}'s and finding ${findingIndex}'s sources`);
                continue;
            }
            claimedBy.set(source, findingIndex);
        }
    });
    if (outOfRange.length > 0 && childFindings.length === 0) {
        throw new Error("This level has no child findings to cite, so `sources` cannot name anything. Call again with `findings: []` — the only valid submission when the list this level's own _progress call reported is empty.");
    }
    if (outOfRange.length > 0) {
        throw new Error(`Sources name an index that is not a valid child finding index for this call: ${outOfRange.join('; ')}. ` +
            `Valid indices are 0-${childFindings.length - 1}. Call again with sources that only reference indices from the findings this level's own _progress call reported.`);
    }
    if (overlapping.length > 0) {
        throw new Error(`${overlapping.join('; ')} — each child finding must be consolidated into exactly one submitted finding. ` +
            `Call again with non-overlapping sources.`);
    }
    const missing = childFindings.map((_, i) => i).filter(i => !claimedBy.has(i));
    if (missing.length > 0) {
        throw new Error(`Child finding${missing.length === 1 ? '' : 's'} ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not named in ` +
            `any submitted finding's sources. Every child finding must be accounted for — call again with a finding (existing or new) whose ` +
            `sources include ${missing.length === 1 ? 'it' : 'them'}.`);
    }
    const inconsistent = [];
    findings.forEach((finding, findingIndex) => {
        const referenced = finding.sources.map(i => childFindings[i]);
        const anyIsBug = referenced.some(c => c.isBug !== null);
        if (anyIsBug && finding.isBug === null) {
            inconsistent.push(`Finding ${findingIndex} consolidates a child finding with isBug set, so it must have isBug set too — call again with isBug describing the bug.`);
        }
        if (!anyIsBug && finding.isBug !== null) {
            inconsistent.push(`Finding ${findingIndex} has isBug set, but none of the child findings it consolidates (sources: ${JSON.stringify(finding.sources)}) do — call again with isBug: null, or correct its sources.`);
        }
        const allIsExpected = referenced.every(c => c.isExpected !== null);
        if (allIsExpected && finding.isExpected === null) {
            inconsistent.push(`Finding ${findingIndex} consolidates only child findings with isExpected set, so it must have isExpected set too — call again with isExpected filled in.`);
        }
        if (!allIsExpected && finding.isExpected !== null) {
            inconsistent.push(`Finding ${findingIndex} has isExpected set, but at least one child finding it consolidates (sources: ${JSON.stringify(finding.sources)}) does not — call again with isExpected: null, or correct its sources.`);
        }
    });
    if (inconsistent.length > 0)
        throw new Error(inconsistent.join(' '));
}
/** Citations exist only on an `_end` call's input — never in what is persisted or pushed up to a parent. */
function stripSources(findings) {
    return findings.map(({ sources: _sources, sourceClusters: _sourceClusters, ...rest }) => rest);
}

// Every Zod shape the review tools share — the `scope` level argument and the entity-id
// arguments it governs, the `rootScope`/`mode` traversal arguments, the per-diff findings schema
// (`DiffFindingShape`), and the consolidated per-level summary schemas `eyes_review_end` accepts.
//
// Two of `DiffFindingShape`'s fields are deliberately response-only — computed by the tool, never
// accepted from the model: `regions` (what actually happened to the step's match regions) and the
// tool-appended sentence on `description`. They're declared as TypeScript types below rather than
// Zod input fields, so a model can't claim a region change happened.
const SCOPE_ARGS_DESC = 'Which entity this call is about, and therefore which arguments it takes: "batch" takes batchUrl; "scenario" takes ' +
    'batchUrl and scenarioName; "session" takes sessionUrl; "step" takes sessionUrl and stepIndex. Not to be confused ' +
    'with `rootScope`, a separate argument: `scope` is the entity this call is about, `rootScope` bounds how far `next` ' +
    'ever escalates beyond it.';
const ProgressScopeShape = zod.z
    .enum(SCOPE_TYPES)
    .describe(`${SCOPE_ARGS_DESC} What each one investigates: "batch" — every unresolved session in a batch, grouped into ` +
    'scenarios; ALWAYS call this first for a batch-wide test results inspection. "scenario" — every unresolved session ' +
    'sharing one scenario (test) name within a batch. "session" — ' +
    "every non-matching (isMatching:false) step of one session; a step with no checkpoint image (an aborted run's " +
    'trailing steps) or no baseline image (a newly added checkpoint) is decided here, not investigated — it never ' +
    'appears among the steps to inspect. "step" — every changed area (from eyes_inspect_changed_areas) of one step.');
const EndScopeShape = zod.z
    .enum(SCOPE_TYPES)
    .describe(`${SCOPE_ARGS_DESC} What each one records: "batch" — the top-level, deduplicated findings summary for a batch, ` +
    'once every scenario is reviewed. "scenario" — this scenario\'s deduplicated findings summary, once every session ' +
    'is reviewed. "session" — this session\'s deduplicated findings summary, once every step is reviewed. "step" — one ' +
    'consolidated summary per changed area for this step, once every changed area is reviewed. Hard-throws if ' +
    "eyes_inspect_dom_diff was never called for this step. When consolidating a changed area's findings into its own " +
    'summary, omit any "(sameAs: ...)" note from the underlying descriptions — describe the change itself, not how it ' +
    'was verified. In mode "resolve" this call also decides the step: rejected if any finding is a bug or inconsistent ' +
    'with its surroundings, accepted if every finding is justified (expected, or evidenced dynamic content), and ' +
    'otherwise left unresolved for human review — including whenever a region could not be applied. The block this ' +
    'call consolidates may hold either already-reduced summaries or raw per-changed-area findings, depending on how ' +
    'far the walk skipped to reach here — consolidate and cite both the same way, and where a finding carries an ' +
    '`origin`, keep the session/step it names in the summary you write.');
/**
 * The entity-id arguments `eyes_review_progress`/`eyes_review_end` share. All four are optional at
 * the schema level and required by `scope` at call time — the MCP tool schema is a flat field
 * map, so it cannot express "required only for these scopes" itself; the handler rejects a
 * missing one with a message naming what that scope needs.
 */
const REVIEW_SCOPE_ID_SHAPES = {
    batchUrl: zod.z
        .string()
        .optional()
        .describe(`${BATCH_URL_DESC}. Required for scope "batch" and "scenario"; omit it otherwise.`),
    scenarioName: zod.z
        .string()
        .optional()
        .describe('The scenario (test) name. Required for scope "scenario"; omit it otherwise.'),
    sessionUrl: zod.z
        .string()
        .optional()
        .describe(`${SESSION_URL_DESC}. Required for scope "session" and "step"; omit it otherwise.`),
    stepIndex: zod.z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe(`${STEP_INDEX_DESC}. Required for scope "step"; omit it otherwise.`),
};
const RootScopeShape = zod.z
    .enum(SCOPE_TYPES)
    .optional()
    .describe("The scope this review was started at; bounds how far `next` escalates. Omit it only on a review's first call — it then defaults to that call's own scope (for eyes_review_diff_report, to its step). On every later call pass through the value the previous call's `next` gave, unchanged: a call that omits it while a wider review is still in progress is sent back unexecuted with the call to repeat (findings always roll up to the parent level regardless).");
const ModeShape = zod.z
    .enum(MODES)
    .optional()
    .describe('What this investigation is for. "resolve" (the default — used whenever mode is left unspecified, including for ' +
    'a plain "review"/"check"/"look at" request with no further qualification) additionally acts on what it finds: ' +
    "each diff's dynamic content is masked with a match region as it is reported, and each step is deterministically " +
    'accepted/rejected/left-unresolved from its own findings. These are pending, undoable decisions, not a commit — ' +
    'eyes_resolve_save (a separate, later call requiring its own explicit user approval) is what actually writes ' +
    'them to the baseline, and eyes_resolve_reset can discard them before that. So do not switch to "inspect" out ' +
    'of general caution about mutating actions or to avoid asking for confirmation — that caution belongs at the ' +
    'eyes_resolve_save step, not here. "inspect" only reads and reports, with no mutation at all — use it only when ' +
    'the user explicitly asks to just describe/summarize the differences, or explicitly asks not to resolve steps ' +
    'or add regions (e.g. "just tell me what changed", "don\'t resolve anything yet"); a bare "review"/"check this ' +
    'batch" does not qualify and should use the resolve default. Only specify it at the top of a traversal, or when ' +
    "a prior call's `next` output already indicated one — and then pass that value through as given, never omitted " +
    'or modified.');
const RestartShape = zod.z
    .boolean()
    .optional()
    .describe('Defaults to false — omit this to reuse whatever is already cached for this node. Pass true only to explicitly ' +
    'discard every cached finding/completion for this node and everything beneath it and review it from scratch — ' +
    'e.g. to independently re-review something already reviewed, as part of this investigation or a separate one, ' +
    'since otherwise its cached results are reused as-is.');
const AreaRectShape = zod.z.object({
    left: zod.z.number(),
    top: zod.z.number(),
    width: zod.z.number(),
    height: zod.z.number(),
});
const AREA_RECT_DESC = "The rect being reported on, in checkpoint-image coordinates: either a changed area's own rect as returned by eyes_inspect_changed_areas, or a smaller rect nested inside it identifying one individual pink region within that area";
const IS_EXPECTED_DESC = 'Non-null means this diff is a real, permanent, intentional change — a reason citing actual evidence (a ticket/PR/commit/changelog, or ' +
    'context the end user stated, e.g. "the user said they removed this badge"), never inferred from the diff looking clean or reproducing ' +
    'identically across sessions — an accidental release looks the same. Without such evidence, use null and say so rather than guessing. This is ' +
    'the field for a one-off change someone made on purpose; if instead the content itself is expected to vary or recur on every run (a rotating ' +
    "banner, a timestamp), that's `dynamic`'s job instead, not this one — a finding is either a permanent change (this field) or recurring/" +
    'varying content (`dynamic`), never justified as both from the same evidence.';
/** The two levels a mask can be added at, strictest first. */
const MASK_LEVELS = ['layout', 'ignore'];
/** Also appended to the step's `next.instruction` in resolve mode, so it reaches the model as a result and not only as schema text. */
const MASK_LEVEL_RULE = 'If the dynamic area follows a clear consistent symmetry such that text segments are replaced with (possibly longer or shorter) text of ' +
    'similar font and font size, and images are replaced with other images of similar size but overall all elements retain their relative ' +
    'alignment and margins, you should mask the dynamic area with a Layout region. In all other cases use an Ignore region. Do not use any ' +
    'other match level for masking.';
/** Every level an existing region can carry — `before` names one of those, dynamic included. */
const ExistingRegionTypeShape = zod.z.enum(REGION_TYPES).describe('The match level the existing region currently has');
const RegionTypeShape = zod.z.enum(MASK_LEVELS).describe(MASK_LEVEL_RULE);
const AREA_DESC = 'A DOM node id (string) from eyes_inspect_dom/eyes_inspect_dom_diff, or a checkpoint-image rect';
/** An existing region: where it is and the level it currently has. */
const ExistingRegionSpecShape = zod.z.object({
    area: zod.z.union([zod.z.string(), AreaRectShape]).describe(AREA_DESC),
    matchLevel: ExistingRegionTypeShape,
});
/** A region to add: where it is and which level it applies. */
const RegionSpecShape = zod.z.object({
    area: zod.z.union([zod.z.string(), AreaRectShape]).describe(AREA_DESC),
    matchLevel: RegionTypeShape,
});
/**
 * A proposed region fix — either a fresh mask (`before: null`) or a replacement of a stale one —
 * never itself a failure report: whether it could actually be applied is the tool's own call,
 * reported back on the finding's `regions`. `after` is required and non-nullable by construction:
 * a "remove and replace with nothing" proposal would leave the dynamic content unmasked, the exact
 * opposite of this field's purpose.
 */
zod.z.object({
    before: ExistingRegionSpecShape.nullable().describe('The stale region being replaced, if one existed — null for a from-scratch mask over content that was never masked at all'),
    after: RegionSpecShape.describe('The corrected/fresh region that should mask this content — always required'),
    description: zod.z.string().describe('Human-readable description of the proposed change'),
});
/**
 * `dynamic.mask`'s own shape: like `_RegionChangeShape`, except `after.area` may be null or
 * omitted — the tool then defaults it to the finding's own `area`, so the model only has to
 * supply the one judgment call this schema can't make for it: `after.matchLevel`.
 */
const MaskProposalShape = zod.z.object({
    before: ExistingRegionSpecShape.nullable().describe('The stale region being replaced, if one existed — null for a from-scratch mask over content that was never masked at all'),
    after: zod.z
        .object({
        area: zod.z
            .union([zod.z.string(), AreaRectShape])
            .nullable()
            .optional()
            .describe("A DOM node id (string) or checkpoint-image rect for the mask target. If null or omitted, the tool uses this finding's own `area` instead."),
        matchLevel: RegionTypeShape,
    })
        .describe('The corrected/fresh region that should mask this content — `matchLevel` is always required; `area` may be omitted'),
    description: zod.z.string().describe('Human-readable description of the proposed change'),
});
const DYNAMIC_JUSTIFICATION_DESC = 'How it was established that this diff is dynamic/recurring content — content expected to vary or reappear differently on every run — rather ' +
    'than a one-off change: "Pattern" (the content\'s own shape — a timestamp, a counter), "History" (eyes_inspect_history shows it recurring ' +
    'across prior runs), "Context" (the end user said this specific content varies or is non-deterministic across runs, e.g. "this banner ' +
    "rotates every load\" — NOT that a permanent change was made on purpose; that's `isExpected`'s job, with `dynamic` left null entirely), " +
    '"Code" (the application code makes it non-deterministic). "History" additionally requires an actual eyes_inspect_history call for this ' +
    "finding's node.";
const DYNAMIC_EVIDENCE_DESC = "The concrete evidence for `justification` — the actual pattern observed, what the history call showed, the user's own words, or the code path.";
const DYNAMIC_MASK_DESC = 'The region to add or change to mask this diff — required whenever `dynamic` is non-null, so a masking decision always names an actual fix, ' +
    'not just a category. `matchLevel` is always required, `layout` or `ignore` — see its own description for which. ' +
    "`area` may be null or omitted, in which case the tool uses this finding's own `area`. `before` is null " +
    'for a from-scratch mask; naming a stale region being replaced — one that stopped tracking its element as the page drifted — requires ' +
    'calling eyes_inspect_regions for this step first to identify it.';
const DYNAMIC_DESC = 'Non-null means this diff is dynamic/recurring content — expected to vary or reappear differently on every run — rather than a one-off ' +
    "change; `justification`, `evidence`, and `mask` are then all required together (see `mask`'s own description for what may be omitted " +
    'within it). null means it is not dynamic, or that has not been established — including every permanent, intentional change (those belong in ' +
    '`isExpected` instead, with this left null).';
/** Shared by `DiffFindingShape` and `StepEndFindingsShape` — only `mask`'s own description differs between proposing a fix and restating one. */
function makeDynamicShape(maskDesc) {
    return zod.z
        .object({
        justification: zod.z.enum(['Pattern', 'History', 'Context', 'Code']).describe(DYNAMIC_JUSTIFICATION_DESC),
        evidence: zod.z.string().describe(DYNAMIC_EVIDENCE_DESC),
        mask: MaskProposalShape.describe(maskDesc),
    })
        .nullable()
        .describe(DYNAMIC_DESC);
}
const DynamicShape = makeDynamicShape(DYNAMIC_MASK_DESC);
const IS_BUG_DESC = "Non-null means this is a visual bug — a clear human-readable description of what's wrong. Applies to: misalignment; overlapping elements; " +
    'elements falling outside the page bounds; typos; partial page rendering; an element meant to be fixed/centered/symmetric shifting position. ' +
    'This applies even when the change is a knock-on effect of another change whose root cause is fully understood — an understood cause is never ' +
    'a justification to call something not a bug. For classification "positional-drift" specifically: a drift beyond ~3px is always a bug, full ' +
    'stop; only a drift within that bound, and only once eyes_inspect_history across multiple prior runs confirms it recurs, may be treated as ' +
    'non-bug (dynamic) instead — recurrence alone, without checking the bound first, never justifies calling a large drift non-bug.';
const DiffFindingShape = zod.z
    .object({
    description: zod.z
        .string()
        .describe("Plain-English description of this diff, written from the checkpoint's perspective"),
    classification: zod.z.enum(['content-change', 'new', 'missing', 'displaced', 'positional-drift']),
    area: zod.z
        .union([zod.z.string(), AreaRectShape])
        .describe('A DOM node id (string) when this step has a DOM capture, else a checkpoint-image rect'),
    positionDelta: zod.z
        .object({ left: zod.z.number(), top: zod.z.number() })
        .optional()
        .describe('Required for classification "positional-drift"'),
    consistent: zod.z.boolean().describe('Whether this diff is consistent with its surroundings (vs. a visual bug)'),
    dynamic: DynamicShape,
    isBug: zod.z.string().nullable().describe(IS_BUG_DESC),
    isExpected: zod.z.string().nullable().describe(IS_EXPECTED_DESC),
})
    .superRefine((finding, ctx) => {
    if (finding.classification === 'positional-drift' && !finding.positionDelta) {
        ctx.addIssue({
            code: 'custom',
            message: 'positionDelta is required for classification "positional-drift"',
            path: ['positionDelta'],
        });
    }
});
const DiffReportFindingsShape = zod.z.array(DiffFindingShape);
const SameAsShape = zod.z
    .object({
    sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
    stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
    areaRect: AreaRectShape.describe(AREA_RECT_DESC),
})
    .describe('Reference to a prior eyes_review_diff_report call in the same scenario whose findings are the exact ' +
    "same underlying structural change as this call's. When given, eyes_inspect_image_diff and the " +
    "baseline eyes_inspect_image are not required — only this step's checkpoint image (for this areaRect) " +
    'and eyes_inspect_dom_diff for this step. Findings must still be restated in full; nothing is inherited ' +
    'from the referenced call.');
/** What one changed area is allowed to cost: its own full-areaRect entry plus the sub-rect entries a multi-region area splits into. */
const ENTRIES_PER_AREA = 3;
// Entries, not areas — a split area costs more than one — so this cannot be the evidence cap, which counts areas. It holds a full evidence round at the allowance above; a step needing more splits into calls, and `eyes_review_end`'s completeness gate covers the split.
const MAX_DIFF_REPORT_BATCH = MAX_EVIDENCE_BATCH * ENTRIES_PER_AREA;
/** One changed area's report — the unit the hard gate verifies, against this entry's own `areaRect`. */
const DiffReportGroupShape = zod.z.object({
    areaRect: AreaRectShape.describe(AREA_RECT_DESC),
    findings: DiffReportFindingsShape,
    sameAs: SameAsShape.optional(),
});
const DiffReportsShape = zod.z
    .array(DiffReportGroupShape)
    .min(1)
    .max(MAX_DIFF_REPORT_BATCH, `more than ${MAX_DIFF_REPORT_BATCH} entries — nothing from this call was recorded. Split it into calls of at ` +
    `most ${MAX_DIFF_REPORT_BATCH} entries each, splitting at a full-areaRect boundary (every sub-rect entry stays ` +
    'in the same call as, and before, its own full-areaRect entry), and re-send them all')
    .describe('One entry per changed area being reported — put every unreviewed area of this step in a single call, never one ' +
    'call per area. Entries are processed in order and each is verified on its own: its findings must be backed by ' +
    "evidence fetched for that entry's own areaRect, so reporting one area never lets another through. Order matters " +
    'in two places: a sub-rect entry must come before the full-area entry it sits inside, and a `sameAs` may only ' +
    'reference an area already recorded — by an earlier call, or by an earlier entry of this same call. If an entry ' +
    'is rejected, the entries before it stay recorded and the ones after it are not processed; the error names ' +
    `exactly which areas to re-send. At most ${MAX_DIFF_REPORT_BATCH} entries per call — entries, not areas, so an ` +
    'area you split into sub-rect entries costs more than one. The cap bounds count, not text: each area still ' +
    'needs its own complete finding(s) in full, and there is no shorthand for "one ' +
    'cause, many areas" (not even via `sameAs`, whose findings are restated in full, never inherited), so a batch ' +
    'where every area shares one repetitive cause (e.g. one locale/theme change touching many areas alike) can still ' +
    'run long. If writing every entry out inline risks the response not finishing before its JSON closes, use this ' +
    "argument's other accepted form (a file path) instead of the inline array — see JsonFileArgShape's own description.");
// Carried up from the diff level into every consolidated summary above it, so a consumer (e.g.
// the deterministic accept/reject decision at eyes_review_end with scope "step") never has to re-derive
// "is this expected" / "is this a bug" from prose.
const IS_EXPECTED_IS_BUG_SHAPE = {
    isExpected: zod.z.string().nullable().describe(IS_EXPECTED_DESC),
    isBug: zod.z
        .string()
        .nullable()
        .describe("Non-null means this is a visual or functional bug; a clear human-readable description of what's wrong"),
};
const SOURCES_DESC = "Indexes into the flat, combined list of every child finding this level's own _progress call reported for this " +
    'node — each one numbered there via its own `index` field. Every child finding must be claimed by exactly one ' +
    'entry (no gaps, no overlap between entries), counting `sourceClusters` too; between the two fields, at least ' +
    "one citation is required here. This entry's isBug/isExpected must then be consistent with the child findings " +
    'it names: isBug non-null iff any of them has isBug non-null; isExpected non-null iff every one of them has ' +
    'isExpected non-null. When _progress reported no child findings, submit `findings: []`.';
const SourcesShape = zod.z.array(zod.z.number().int().nonnegative()).describe(SOURCES_DESC);
const SOURCE_CLUSTERS_DESC = 'Ids from the `clusters` block that same _progress call reported — a shorthand for every index the named cluster ' +
    'holds, so a large list can be claimed without transcribing it. Clusters were grouped by a mechanical key alone ' +
    '(where a finding came from, its isBug/isExpected pair, how a dynamic claim was justified, overlapping areas); ' +
    'whether the findings in one share a cause is your judgment, so split a cluster across entries via plain ' +
    '`sources` whenever they do not. Mixing the two fields on one entry is fine.';
const SourceClustersShape = zod.z.array(zod.z.string()).optional().describe(SOURCE_CLUSTERS_DESC);
/** Every entry must claim something. Enforced here rather than by a `.min(1)` on `sources`, since either field alone is a complete citation. */
function requireCitation(findings, ctx) {
    findings.forEach((finding, index) => {
        var _a, _b;
        if (finding.sources.length + ((_b = (_a = finding.sourceClusters) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0)
            return;
        ctx.addIssue({
            code: 'custom',
            message: 'each finding must cite at least one child finding, via sources indices or sourceClusters ids',
            path: [index, 'sources'],
        });
    });
}
const StepEndDynamicShape = makeDynamicShape("The mask actually applied for this changed area at diff-report time — matching that response's `regions`.");
/**
 * One consolidated summary per changed area. Carries the same categorical fields as
 * `DiffFindingShape` (minus `regions`, which the tool computes from this step's own diff-level
 * findings rather than trusting a restatement of it) — the step-level accept/reject decision in
 * `eyes_review_end` reads them directly instead of parsing `summary` prose.
 */
const StepEndFindingShape = zod.z.object({
    areaRect: AreaRectShape,
    summary: zod.z.string(),
    consistent: zod.z.boolean().describe('Whether every diff in this changed area is consistent with its surroundings'),
    dynamic: StepEndDynamicShape,
    ...IS_EXPECTED_IS_BUG_SHAPE,
    sources: SourcesShape,
    sourceClusters: SourceClustersShape,
});
const StepEndFindingsShape = zod.z.array(StepEndFindingShape).superRefine(requireCitation);
const SummaryExampleFindingShape = zod.z.object({
    summary: zod.z.string(),
    example: zod.z
        .string()
        .describe('A dashboard link zoomed to this finding on the checkpoint image: https://.../test-results/{batchId}/{sessionId}/steps/{N}?accountId=...' +
        '&mode=step-editor&zoom={left},{top},{width},{height}, with left/top/width/height in checkpoint-image coordinates. {N} is required and 1-based ' +
        "(stepIndex + 1) matching the dashboard's own URL convention."),
    ...IS_EXPECTED_IS_BUG_SHAPE,
    sources: SourcesShape,
    sourceClusters: SourceClustersShape,
});
const SummaryExampleShape = zod.z.array(SummaryExampleFindingShape).superRefine(requireCitation);
/**
 * `eyes_review_end`'s `findings`, which takes a different shape per `scope`. The handler
 * re-validates against the shape its own `scope` requires and says which one it wanted if they
 * disagree — so the members here are **loose**: a strict member would strip the other shape's
 * fields while matching, and the re-validation would then report a field as missing that the caller
 * did supply. Nothing is widened by that: the per-`scope` re-validation is strict, so whatever
 * reaches `commands.ts` is stripped to exactly one shape, as it was when each level had its own tool.
 */
const ReviewEndFindingsShape = zod.z
    .union([zod.z.array(StepEndFindingShape.loose()), zod.z.array(SummaryExampleFindingShape.loose())])
    .describe('Which shape this takes depends on scope: "step" takes one consolidated summary per changed area (areaRect, ' +
    'summary, consistent, dynamic, isExpected/isBug, sources); "batch"/"scenario"/"session" take one summary per ' +
    "finding with its own example link (summary, example, isExpected/isBug, sources). See each field's own " +
    'description. There is no cap on how many entries this array holds, and every entry for this scope must arrive ' +
    'together in one call. If writing every entry out inline risks the response not finishing before its JSON ' +
    "closes, use this argument's other accepted form (a file path) instead of the inline array — see JsonFileArgShape's own description.");
/** Lets a model-supplied array argument be handed off as a file path instead of inline JSON, for whichever caller finds the array too large to safely generate inline. */
const JsonFileArgShape = zod.z
    .string()
    .describe('Absolute path to a UTF-8 JSON file whose entire contents are the same array this argument otherwise takes ' +
    'inline — nothing but the JSON array itself. Use this instead of the inline array only when the array would be ' +
    'large enough to risk the response not finishing before its JSON closes (e.g. many entries, or many that share ' +
    'one repetitive cause such as one locale/theme change touching every changed area alike) — writing to a file has ' +
    'no such limit. The tool reads and validates the file exactly as if its contents had been sent inline.');

/**
 * Build the canonical Eyes dashboard URL for a single test session.
 *
 * Output shape: `{serverUrl}/app/test-results/{batchId}/{sessionId}[?accountId={accountId}]`
 *
 * Nothing is appended after the accountId: any `~~` in the final URL is base64
 * padding inside the accountId value, which arrives complete from the server.
 *
 * `accountId` is optional because not every caller has one to hand (the
 * batch-results-API flow authenticates by API key alone); pass it whenever
 * the URL was itself derived from a parsed accountId, so review round-trips
 * stay tied to the account they came from.
 */
function buildSessionUrl$1(serverUrl, batchId, sessionId, accountId) {
    const accountIdQuery = accountId ? `?accountId=${accountId}` : '';
    return `${serverUrl}/app/test-results/${batchId}/${sessionId}${accountIdQuery}`;
}
/**
 * Build the canonical Eyes dashboard URL for a whole batch.
 *
 * Output shape: `{serverUrl}/app/test-results/{batchId}[/?accountId={accountId}]`
 */
function buildBatchUrl$1(serverUrl, batchId, accountId) {
    return accountId
        ? `${serverUrl}/app/test-results/${batchId}/?accountId=${accountId}`
        : `${serverUrl}/app/test-results/${batchId}`;
}

/**
 * Builds a batch or session URL from parsed components — the inverse of `api`'s
 * `parseBatchUrl`/`parseSessionUrl`. The review tools need these to construct ready-made
 * child/parent calls (e.g. a batch's `next` suggesting `eyes_review_progress` calls with scope "scenario",
 * or a session needing its own parent batch's URL) from raw ids `fetchSessions`/`fetchSteps`
 * hand back, never from reconstructing a scope id (those are built straight from parsed parts
 * — see `scope-ids.ts` — precisely so they never depend on a URL round-tripping through here).
 *
 * Thin object-param wrappers over `utils/url-utils.ts`'s canonical builders, so the dashboard
 * URL shape lives in exactly one place.
 */
function buildSessionUrl(parts) {
    return buildSessionUrl$1(parts.baseUrl, parts.batchId, parts.sessionId, parts.accountId);
}
function buildBatchUrl(parts) {
    return buildBatchUrl$1(parts.baseUrl, parts.batchId, parts.accountId);
}
/**
 * Builds a dashboard deep-link zoomed to where one changed area appears on the checkpoint image
 * of one step (not a diff view) — the same `mode=step-editor&zoom={left},{top},{width},{height}`
 * / 1-based `/steps/{N}` shape, with the rect in checkpoint-image coordinates, callers are asked
 * to hand-format for the `example` field at the session/scenario/batch levels. At step level
 * every component (session, step, area) is already a structured argument the caller passed in,
 * so this is computed here instead of asked of the model — nothing to pick a representative
 * instance of, and nothing for a model to transcribe wrong.
 */
function buildDiffUrl(parts) {
    const { baseUrl, batchId, sessionId, accountId, stepIndex, areaRect } = parts;
    return `${baseUrl}/app/test-results/${batchId}/${sessionId}/steps/${stepIndex + 1}?accountId=${accountId}&mode=step-editor&zoom=${formatRect(areaRect)}`;
}

// The deterministic half of `mode: 'resolve'` — everything the review tools decide and do on
// their own rather than asking the model for:
//
// - §4, at `eyes_review_diff_report` time: turn each finding's own `dynamic.mask` into an actual
//   match-region change — its `after.area`, if left null/omitted, resolved to the finding's own
//   `area` first — guard-railed, applied through `updateRegions`, and reported back as that
//   finding's `regions` plus a sentence appended to its `description`.
// - §5, at `eyes_review_progress` (scope "session") time: the two structural step shapes
//   that can never go through the ordinary changed-areas investigation at all, because they have
//   no checkpoint (or no baseline) image to diff against.
// - §6, at `eyes_review_end` (scope "step") time: the accept/reject/leave-unresolved
//   decision, read straight off the step's own consolidated findings.
/**
 * How much of the checkpoint image a single added region may cover before it's rejected as
 * defeating the purpose of the check. Half the image is the threshold
 * chosen here.
 */
const MAX_REGION_AREA_FRACTION = 0.5;
/**
 * Regions as the guard rails see them: the checkpoint side's rect (the side `DiffFindingShape.area`
 * is always expressed in), and the `matchLevel` a regionOp would name. A region in a category no
 * regionOp can express (`floating`/`accessibility`/…) is left out. Applied to `fetchRegions`'
 * `regions` for what this flow may remove or replace, and to its `codedRegions` for what it must
 * only avoid — those come from the test code and no region op can touch them.
 */
function toExistingRegionEntries(regions) {
    var _a;
    const entries = [];
    for (const pair of regions) {
        const matchLevel = CATEGORY_TO_REGION_TYPE[pair.category];
        const region = (_a = pair.checkpoint) !== null && _a !== void 0 ? _a : pair.baseline;
        if (!matchLevel || !region)
            continue;
        entries.push({ matchLevel, rect: { left: region.left, top: region.top, width: region.width, height: region.height } });
    }
    return entries;
}
/**
 * The region change a finding proposes, from its own fields alone (§4 step 1): `dynamic.mask`,
 * resolved to a concrete `after.area` — the model's own, or (when left null/omitted) the finding's
 * own `area`. `mask` is required whenever `dynamic` is non-null, so there's always a `matchLevel`
 * to act on; only the geometry can default. With no `dynamic` at all, the finding proposes no
 * region change.
 */
function proposedRegionChange(finding) {
    var _a;
    if (!finding.dynamic)
        return null;
    const { mask } = finding.dynamic;
    return {
        before: mask.before,
        after: { area: (_a = mask.after.area) !== null && _a !== void 0 ? _a : finding.area, matchLevel: mask.after.matchLevel },
        description: mask.description,
    };
}
/**
 * Whether a proposal's resolved `after` already exists, verbatim (same rect, same `matchLevel`),
 * among the step's current regions — e.g. because propagation from a sibling step (or an earlier
 * finding of this same call) already placed it there. Checked before the guard rails: without
 * this, an exact duplicate reads as "falls entirely inside an existing region" (a rect always
 * contains itself) and gets reported as the `{before:null, after:null}` FAILURE sentinel, when
 * the actual outcome — the mask is already in effect — is a success, not a failure.
 */
function regionAlreadyInEffect(existing, rect, matchLevel) {
    return rect !== null && existing.some(e => e.matchLevel === matchLevel && sameRect(e.rect, rect));
}
function matchExistingRegion(existing, rect, matchLevel) {
    var _a;
    const exact = existing.find(entry => entry.matchLevel === matchLevel && sameRect(entry.rect, rect));
    if (exact)
        return exact;
    const shifted = existing.filter(entry => entry.matchLevel === matchLevel && isNearlySameRect(entry.rect, rect));
    if (shifted.length > 1)
        return 'ambiguous';
    return (_a = shifted[0]) !== null && _a !== void 0 ? _a : null;
}
/**
 * §4 step 2's guard rails, checked before anything is sent:
 *
 * - **No nesting, regardless of matchLevel.** A proposal falling entirely inside an existing
 *   region is already covered, so it's refused. A proposal entirely containing existing ones is
 *   fine — those get removed first, and come back as `contained`.
 * - **No touching a coded region.** `coded` regions come from the test code, so a proposal inside
 *   one is refused as covered and one overlapping it is refused outright — it can be neither
 *   replaced nor removed here.
 * - **No oversized regions.** A proposal covering more than `MAX_REGION_AREA_FRACTION` of the
 *   checkpoint image is refused.
 * - **No specks.** A proposal under `MIN_REGION_AREA_PX` is refused: it masks a diff artefact, not
 *   content, and propagation would find it everywhere.
 * - **No stacking on top of a region it partly covers.** A proposal that is nearly the same rect as
 *   an existing region replaces it (`superseded`); one that straddles a different region, or is
 *   equally close to two of them, is refused. A replacement may never weaken the match level.
 *
 * `proposedRect` is `null` when the proposal's `area` is a node id whose geometry couldn't be
 * resolved; every rail then has nothing to check and the proposal passes.
 * `excludeRect` is the proposal's own `before` region, which must not count as a containing
 * neighbour, a nested one, or an overlap — it's the thing being replaced.
 */
function checkGuardRails(params) {
    var _a;
    const { proposedRect, existing, coded = [], imageSize, excludeRect, matchLevel } = params;
    if (!proposedRect)
        return { ok: true, contained: [], superseded: null };
    if (isTooSmallRegion(proposedRect)) {
        return {
            ok: false,
            kind: 'too-small',
            reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} is ${proposedRect.width}x${proposedRect.height}px, under the ${MIN_REGION_AREA_PX}px² floor — a mask this small covers a diff artefact, not content`,
        };
    }
    const relevant = existing.filter(e => !excludeRect || !sameRect(e.rect, excludeRect));
    const container = relevant.find(e => rectContains(e.rect, proposedRect));
    if (container) {
        return {
            ok: false,
            kind: 'nested',
            reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} falls entirely inside an existing ${container.matchLevel} region ${formatRect(container.rect)}, so the area is already covered`,
        };
    }
    const codedContainer = coded.find(e => rectContains(e.rect, proposedRect));
    if (codedContainer) {
        return {
            ok: false,
            kind: 'nested',
            reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} falls entirely inside an existing ${codedContainer.matchLevel} region ${formatRect(codedContainer.rect)} from the test code, so the area is already covered`,
        };
    }
    const codedOverlap = coded.find(e => isSignificantOverlap(e.rect, proposedRect));
    if (codedOverlap) {
        const percent = Math.round(overlapCoverage(codedOverlap.rect, proposedRect) * 100);
        return {
            ok: false,
            kind: 'overlaps',
            reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} overlaps an existing ${codedOverlap.matchLevel} region ${formatRect(codedOverlap.rect)} from the test code by ${percent}% of the smaller region, ` +
                'and a region from the test code can be neither replaced nor removed here',
        };
    }
    if (imageSize && imageSize.width > 0 && imageSize.height > 0) {
        const fraction = (proposedRect.width * proposedRect.height) / (imageSize.width * imageSize.height);
        if (fraction > MAX_REGION_AREA_FRACTION) {
            return {
                ok: false,
                kind: 'oversized',
                reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} covers ${Math.round(fraction * 100)}% of the checkpoint image, which would nullify the purpose of the check`,
            };
        }
    }
    const contained = relevant.filter(e => rectContains(proposedRect, e.rect));
    const neighbours = relevant.filter(e => !contained.includes(e));
    const shifted = neighbours.filter(e => isNearlySameRect(e.rect, proposedRect));
    const straddled = neighbours.find(e => !shifted.includes(e) && isSignificantOverlap(e.rect, proposedRect));
    if (straddled) {
        const percent = Math.round(overlapCoverage(straddled.rect, proposedRect) * 100);
        return {
            ok: false,
            kind: 'overlaps',
            reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} overlaps an existing ${straddled.matchLevel} region ${formatRect(straddled.rect)} by ${percent}% of the smaller region ` +
                'without being nearly the same rect (their sizes or positions differ too much)',
        };
    }
    if (shifted.length > 1) {
        const named = shifted.map(e => `${e.matchLevel} ${formatRect(e.rect)}`).join(' and ');
        return {
            ok: false,
            kind: 'ambiguous-overlap',
            reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} overlaps ${shifted.length} existing regions closely enough that which one it replaces is ambiguous (${named})`,
        };
    }
    const superseded = (_a = shifted[0]) !== null && _a !== void 0 ? _a : null;
    // A dynamic region only restates Eyes' default match level, so superseding it weakens nothing.
    if (superseded &&
        superseded.matchLevel !== 'dynamic' &&
        REGION_TYPE_STRENGTH[matchLevel] < REGION_TYPE_STRENGTH[superseded.matchLevel]) {
        return {
            ok: false,
            kind: 'overlaps',
            reason: `the proposed ${matchLevel} region ${formatRect(proposedRect)} is nearly the same rect as an existing ${superseded.matchLevel} region ${formatRect(superseded.rect)}, ` +
                `but replacing a ${superseded.matchLevel} region with a ${matchLevel} region would remove protection this flow cannot restore`,
        };
    }
    return { ok: true, contained, superseded };
}
function regionOpTarget(area) {
    return typeof area === 'string' ? area : formatRect(area);
}
function addOp(spec) {
    return `+${spec.matchLevel}-${regionOpTarget(spec.area)}`;
}
function removeOp(matchLevel, target) {
    return `-${matchLevel}-${target}`;
}
/**
 * §4 step 3's plan: every region already contained by the proposal is removed first, then the
 * proposal itself is applied — as a plain add when nothing preceded it, or as a remove-then-add
 * pair when it replaces a stale region, whether the model named that region as its `before` or the
 * guard rails found it (`superseded`). The pair counts as one `(before, after)` transition rather
 * than two independent ops, since that's what actually happened to the region.
 */
function planRegionActions(change, contained, superseded = null) {
    const plans = [];
    for (const entry of contained) {
        const op = removeOp(entry.matchLevel, formatRect(entry.rect));
        plans.push({ ops: [op], countOp: op, before: entry.matchLevel, after: null });
    }
    const add = addOp(change.after);
    const removeSuperseded = superseded ? [removeOp(superseded.matchLevel, formatRect(superseded.rect))] : [];
    if (change.before) {
        const remove = removeOp(change.before.matchLevel, regionOpTarget(change.before.area));
        plans.push({
            ops: [...removeSuperseded, remove, add],
            countOp: add,
            before: change.before.matchLevel,
            after: change.after.matchLevel,
        });
    }
    else if (superseded) {
        plans.push({
            ops: [...removeSuperseded, add],
            countOp: add,
            before: superseded.matchLevel,
            after: change.after.matchLevel,
        });
    }
    else {
        plans.push({ ops: [add], countOp: add, before: null, after: change.after.matchLevel });
    }
    return plans;
}
/**
 * §4 step 4: consolidates what `updateRegions` reports it actually did into `RegionChangeCount`
 * entries. Counts are summed across every touched (session, step) — the literal step plus every
 * propagation target — so one entry covers however many individual regions a plan reached.
 * A plan whose op touched nothing anywhere contributes no entry at all.
 */
function countAppliedRegions(plans, results) {
    const counts = plans.map(plan => {
        let count = 0;
        for (const result of results) {
            for (const applied of result.appliedRegionOps) {
                if (applied.op === plan.countOp)
                    count += applied.result.length;
            }
        }
        return { before: plan.before, after: plan.after, count };
    });
    return mergeRegionChangeCounts([counts]);
}
/**
 * §4 step 4's sentence, appended by the tool onto whatever the model wrote for `description`.
 * Success and failure are not exclusive: a single proposal can land on one step and hit a guard
 * rail on a sibling, in which case both sentences are appended.
 */
function describeRegionOutcome(regions, failureReasons) {
    const sentences = [];
    const added = regions.filter(r => r.before === null && r.after !== null);
    const moved = regions.filter(r => r.before !== null && r.before === r.after);
    const adjusted = regions.filter(r => r.before !== null && r.before !== r.after);
    const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
    const addedText = added.map(r => plural(r.count, `${r.after} region`)).join(', ');
    const movedText = moved.map(r => plural(r.count, `${r.after} region`)).join(', ');
    const adjustedText = adjusted
        .map(r => r.after === null
        ? plural(r.count, `nested ${r.before} region`) + ' away'
        : plural(r.count, 'region') + ` from ${r.before} to ${r.after}`)
        .join(', ');
    const clauses = [
        addedText && `added ${addedText}`,
        adjustedText && `adjusted ${adjustedText}`,
        movedText && `moved ${movedText}`,
    ].filter((clause) => clause !== '');
    if (clauses.length > 0) {
        const joined = clauses.length > 1 ? `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}` : clauses[0];
        sentences.push(`${joined[0].toUpperCase()}${joined.slice(1)} to mask this diff.`);
    }
    for (const reason of failureReasons) {
        sentences.push(`The diff could not be masked because ${reason}.`);
    }
    return sentences.join(' ');
}
function resolveStaleRegion(existing, proposal, rectOf) {
    if (!proposal.before)
        return null;
    const rect = rectOf(proposal.before.area);
    if (!rect)
        return null;
    const resolved = matchExistingRegion(existing, rect, proposal.before.matchLevel);
    return resolved === 'ambiguous' ? null : resolved;
}
function foldAppliedProposal(existing, removed, added) {
    for (const gone of removed) {
        const at = gone ? existing.indexOf(gone) : -1;
        if (at !== -1)
            existing.splice(at, 1);
    }
    if (added)
        existing.push(added);
}
/**
 * Runs §4 over every finding of one `diff_report` call, in order, and returns the findings with
 * their `regions` filled in and their `description` extended. Region changes are applied against
 * **checkpoint-regions** (the side `area` is always expressed in) and with `updateRegions`'s own
 * `propagate` default left in place, regardless of what this step's eventual accept/reject
 * decision turns out to be — a region masking a genuinely recurring element is just as valid on a
 * sibling step as region-op propagation always has been.
 *
 * Regions added by an earlier finding of this same call are folded into the guard rails' view of
 * "what's already there", so two findings in one call can't nest inside each other either.
 *
 * Every `updateRegions` call this makes — success or failure — is additionally traced via `log`,
 * labeled with `updateRegions.name` (read off the function itself, not a hand-typed string, so a
 * future rename can't silently desync the label): the exact regionOps/propagate sent in, and
 * either the `RegionOpResult[]` it got back or the error it failed with. Purely a debugging aid for
 * `mode: 'resolve'` — never read back by this flow, and never part of what the model sees.
 */
async function applyRegionMasking(params) {
    var _a, _b, _c, _d;
    const { sessionUrl, stepIndex, findings, keys, deps = defaultPhaseTrackerDeps } = params;
    const proposals = findings.map(proposedRegionChange);
    if (proposals.every(p => p === null)) {
        return findings.map(finding => ({ ...finding, regions: [] }));
    }
    const [{ regions: rawRegions, codedRegions: rawCoded }, session] = await Promise.all([
        fetchRegions(sessionUrl, stepIndex, keys),
        fetchSteps(sessionUrl, keys),
    ]);
    const existing = toExistingRegionEntries(rawRegions);
    const coded = toExistingRegionEntries(rawCoded);
    const imageSize = (_c = (_b = (_a = session.steps) === null || _a === void 0 ? void 0 : _a[stepIndex]) === null || _b === void 0 ? void 0 : _b.checkpoint.size) !== null && _c !== void 0 ? _c : null;
    // Every node id any proposal names, resolved to its checkpoint-side geometry in one pass — the
    // guard rails are geometric, and a proposal is free to name an element rather than a rect.
    const nodeIds = new Set();
    for (const proposal of proposals) {
        if (!proposal)
            continue;
        if (typeof proposal.after.area === 'string')
            nodeIds.add(proposal.after.area);
        if (proposal.before && typeof proposal.before.area === 'string')
            nodeIds.add(proposal.before.area);
    }
    const nodeRects = await fetchNodeRects(sessionUrl, stepIndex, 'checkpoint', [...nodeIds], keys);
    const rectOf = (area) => { var _a; return (typeof area === 'string' ? ((_a = nodeRects.get(area)) !== null && _a !== void 0 ? _a : null) : area); };
    const reported = [];
    for (const [index, finding] of findings.entries()) {
        const proposal = proposals[index];
        if (!proposal) {
            reported.push({ ...finding, regions: [] });
            continue;
        }
        const proposedRect = rectOf(proposal.after.area);
        if (regionAlreadyInEffect(existing, proposedRect, proposal.after.matchLevel)) {
            reported.push({ ...finding, regions: [] });
            continue;
        }
        const stale = resolveStaleRegion(existing, proposal, rectOf);
        const change = stale
            ? { ...proposal, before: { area: stale.rect, matchLevel: stale.matchLevel } }
            : { ...proposal, before: null };
        const guard = checkGuardRails({
            proposedRect,
            existing,
            coded,
            imageSize,
            excludeRect: (_d = stale === null || stale === void 0 ? void 0 : stale.rect) !== null && _d !== void 0 ? _d : null,
            matchLevel: proposal.after.matchLevel,
        });
        if (!guard.ok) {
            const regions = [{ before: null, after: null, count: 1 }];
            reported.push({
                ...finding,
                regions,
                description: `${finding.description} ${describeRegionOutcome(regions, [guard.reason])}`,
            });
            continue;
        }
        const plans = planRegionActions(change, guard.contained, guard.superseded);
        const ops = plans.flatMap(plan => plan.ops);
        const updateRegionsInput = {
            sessionUrl,
            stepIndex,
            action: 'checkpoint-regions',
            regionOps: ops,
            propagate: { regex: null },
        };
        let results;
        try {
            results = await updateRegions(sessionUrl, stepIndex, 'checkpoint-regions', ops, keys, { regex: null });
            log(sessionScopeId(sessionUrl), updateRegions.name, { input: updateRegionsInput, output: results }, deps);
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            log(sessionScopeId(sessionUrl), updateRegions.name, { input: updateRegionsInput, error: reason }, deps);
            const regions = [{ before: null, after: null, count: 1 }];
            reported.push({
                ...finding,
                regions,
                description: `${finding.description} ${describeRegionOutcome(regions, [reason])}`,
            });
            continue;
        }
        const regions = countAppliedRegions(plans, results);
        const sentence = describeRegionOutcome(regions, []);
        reported.push({
            ...finding,
            regions,
            description: sentence ? `${finding.description} ${sentence}` : finding.description,
        });
        // What just happened is now part of "what's already there" for the remaining findings of this
        // same call, so two findings can't end up nested inside — or overlapping — each other either.
        foldAppliedProposal(existing, [...guard.contained, guard.superseded, stale], proposedRect ? { matchLevel: proposal.after.matchLevel, rect: proposedRect } : null);
    }
    return reported;
}
/**
 * A pre-flight check on every dynamic finding's resolved mask (`proposedRegionChange`), run before
 * anything is actually touched: whether `before` (if given) names a region genuinely in effect on
 * this step right now, and whether `after` genuinely covers the finding's own `area` — so a
 * proposal can't invent a stale region to replace, or add a mask that doesn't actually address the
 * diff it's attached to. Returns the first finding (by index) that fails either check, or `null`
 * once every dynamic finding passes. A `before`/`after`/finding `area` naming a node id whose
 * geometry can't be resolved is left unverified rather than failed outright — this check is purely
 * geometric, and there's nothing to compare a node id against without a resolvable rect (`before`
 * is the one exception: an unresolvable `before` can never be confirmed as an existing region, so
 * it fails).
 */
async function verifyMasksAgainstRegions(params) {
    const { sessionUrl, stepIndex, findings, keys } = params;
    const masked = findings
        .map((finding, index) => ({ finding, index, mask: proposedRegionChange(finding) }))
        .filter((entry) => entry.mask !== null);
    if (masked.length === 0)
        return null;
    const nodeIds = new Set();
    for (const { finding, mask } of masked) {
        if (typeof finding.area === 'string')
            nodeIds.add(finding.area);
        if (typeof mask.after.area === 'string')
            nodeIds.add(mask.after.area);
        if (mask.before && typeof mask.before.area === 'string')
            nodeIds.add(mask.before.area);
    }
    const [{ regions: rawRegions }, nodeRects] = await Promise.all([
        fetchRegions(sessionUrl, stepIndex, keys),
        fetchNodeRects(sessionUrl, stepIndex, 'checkpoint', [...nodeIds], keys),
    ]);
    const existing = toExistingRegionEntries(rawRegions);
    const rectOf = (area) => { var _a; return (typeof area === 'string' ? ((_a = nodeRects.get(area)) !== null && _a !== void 0 ? _a : null) : area); };
    for (const { finding, index, mask } of masked) {
        if (mask.before) {
            const beforeRect = rectOf(mask.before.area);
            if (!beforeRect) {
                return {
                    findingIndex: index,
                    reason: `its mask's \`before\` (${regionOpTarget(mask.before.area)}) could not be resolved to a rect, so it can't be confirmed as an existing region`,
                };
            }
            const resolved = matchExistingRegion(existing, beforeRect, mask.before.matchLevel);
            if (resolved === null) {
                return {
                    findingIndex: index,
                    reason: `its mask's \`before\` (a ${mask.before.matchLevel} region at ${formatRect(beforeRect)}) does not match any region currently in effect on this step`,
                };
            }
            if (resolved === 'ambiguous') {
                return {
                    findingIndex: index,
                    reason: `its mask's \`before\` (a ${mask.before.matchLevel} region at ${formatRect(beforeRect)}) is equally close to more than one region currently in effect on this step, so which one it replaces is ambiguous`,
                };
            }
        }
        const afterRect = rectOf(mask.after.area);
        const findingRect = rectOf(finding.area);
        if (afterRect && findingRect && !rectContains(afterRect, findingRect)) {
            return {
                findingIndex: index,
                reason: `its mask's \`after\` (${formatRect(afterRect)}) does not cover the finding's own area (${formatRect(findingRect)})`,
            };
        }
    }
    return null;
}
/**
 * The steps that can't be investigated the ordinary way at all, because one of the two images a
 * diff needs simply isn't there:
 *
 * - **`aborted-missing-checkpoint`** — an aborted session's trailing steps, i.e. a step with no
 *   checkpoint image where no later step has one either. A mechanical fact about this one aborted
 *   run, and nothing else.
 * - **`new-no-baseline`** — a step with no baseline image at all in a session that ran to
 *   completion: a checkpoint newly added to the test, with nothing to compare against yet.
 *
 * A step with neither problem is absent from the result and investigated exactly as before.
 */
function classifyStructuralSteps(session) {
    var _a;
    const steps = (_a = session.steps) !== null && _a !== void 0 ? _a : [];
    const structural = [];
    for (const [stepIndex, step] of steps.entries()) {
        if (session.isAborted && !step.checkpoint.id && steps.slice(stepIndex).every(s => !s.checkpoint.id)) {
            structural.push({ stepIndex, kind: 'aborted-missing-checkpoint' });
            continue;
        }
        if (!session.isAborted && !step.baseline.id) {
            structural.push({ stepIndex, kind: 'new-no-baseline' });
        }
    }
    return structural;
}
function structuralFinding(sessionUrl, step) {
    const summary = step.kind === 'aborted-missing-checkpoint'
        ? 'The session was aborted before this step produced a checkpoint image, so there is nothing to compare — rejected, keeping the existing baseline.'
        : 'This step has no baseline image yet — a newly added checkpoint. Left unresolved: accepting it as the new baseline needs confirmation that the test code genuinely added this checkpoint, which this flow cannot establish.';
    return [{ summary, isExpected: null, isBug: null, example: sessionUrl }];
}
/**
 * Resolves (or deliberately declines to resolve) each structural step of a session and credits its
 * outcome, returning the step indices that must therefore be left out of the session's live
 * children — the model never sees them as something to investigate.
 *
 * An `aborted-missing-checkpoint` step is rejected outright, **with `propagate: null`**: an
 * aborted run's missing checkpoint says nothing about any other step, unlike every other
 * accept/reject in this flow. Its own completion record doubles as the "already handled" marker,
 * so a repeated `session_progress` call never re-rejects it. A `new-no-baseline` step is only
 * counted as unresolved — `resolveStep` is never called for it at all.
 */
async function preResolveStructuralSteps(params) {
    const { sessionUrl, session, keys, deps } = params;
    const excluded = new Set();
    for (const step of classifyStructuralSteps(session)) {
        excluded.add(step.stepIndex);
        const scopeId = stepScopeId(sessionUrl, step.stepIndex);
        if (step.kind === 'aborted-missing-checkpoint') {
            if (isCompleted(scopeId, deps))
                continue;
            await resolveStep(sessionUrl, step.stepIndex, 'reject', keys, null);
            const findings = structuralFinding(sessionUrl, step);
            recordCompletion(scopeId, findings, deps);
            appendChildFinding(sessionScopeId(sessionUrl), stepChildKey(step.stepIndex), findings, deps);
            reportRollup(sessionScopeId(sessionUrl), stepChildKey(step.stepIndex), {
                resolution: { accepted: 0, rejected: 1, unresolved: 0 },
                regions: [],
            }, deps);
            continue;
        }
        reportRollup(sessionScopeId(sessionUrl), stepChildKey(step.stepIndex), {
            resolution: { accepted: 0, rejected: 0, unresolved: 1 },
            regions: [],
        }, deps);
    }
    return excluded;
}
// ---------------------------------------------------------------------------
// §6 — the accept/reject decision at step_end
// ---------------------------------------------------------------------------
/**
 * "may be accepted" bar: the change is consistent with its surroundings, is not a
 * known bug, and is *either* explicitly understood (`isExpected`) *or* evidenced dynamic content
 * (`dynamic` non-null — its `justification`/`evidence` are structurally required together, so
 * non-null already means both are present). Note this doesn't require `dynamic.mask` — a finding
 * can be legitimately dynamic-and-justified without proposing (or needing) any mask of its own.
 */
function isFindingJustified(finding) {
    if (finding.consistent !== true)
        return false;
    if (finding.isBug !== null)
        return false;
    return finding.isExpected !== null || finding.dynamic !== null;
}
/**
 * §6's decision tree, in order:
 *
 * 1. A confirmed bug or a surroundings-inconsistency on *any* finding → reject. Never excused by
 *    another finding on the same step being dynamic or expected.
 * 2. Otherwise, an un-maskable region (§4's failure sentinel, anywhere under this step) → leave
 *    unresolved. Future runs would keep failing at that exact spot, and accepting now wouldn't fix
 *    that — the region conflict needs a human first.
 * 3. Otherwise, every finding justified → accept.
 * 4. Otherwise → leave unresolved. The schema can't tell "confidently unexpected" from "not enough
 *    evidence either way", and unresolved is reserved for exactly that ambiguity — including a
 *    step whose findings say nothing at all.
 */
function decideStepAction(findings, stepRegions) {
    if (findings.some(f => f.isBug !== null || f.consistent === false))
        return 'reject';
    if (hasRegionFailure(stepRegions))
        return null;
    if (findings.length > 0 && findings.every(isFindingJustified))
        return 'accept';
    return null;
}
/**
 * Carries out `action` and reports how many steps it actually resolved. `resolveStep`'s own
 * propagation can resolve several steps in one call (the reference step plus every
 * `samediffas`-confirmed target), all with the same action — so the count is however many steps
 * this call really touched, never a flat 1. Every one of them is credited here, to the originating
 * step being analyzed, rather than to the propagated-to step's own scope: the originating step is
 * by definition inside the current traversal, so nothing can go uncounted in a scope the traversal
 * never visits, and nothing can be counted twice either (a propagated-to step visited later
 * independently has no diff left to find, the region/resolution already being applied to it).
 *
 * An `action` of `null` never calls `resolveStep` at all, so `unresolved` is always exactly 1.
 *
 * A successful call is additionally traced via `log`, labeled with `resolveStep.name` (read off
 * the function itself, not a hand-typed string): the action sent in and the `ResolvedStep[]` it
 * got back — purely a debugging aid, never read back by this flow.
 */
async function resolveStepForAction(params) {
    const { sessionUrl, stepIndex, action, keys, deps = defaultPhaseTrackerDeps } = params;
    if (action === null)
        return { accepted: 0, rejected: 0, unresolved: 1 };
    const resolved = await resolveStep(sessionUrl, stepIndex, action, keys);
    log(sessionScopeId(sessionUrl), resolveStep.name, { input: { sessionUrl, stepIndex, action }, output: resolved }, deps);
    const count = resolved.length;
    return action === 'accept'
        ? { accepted: count, rejected: 0, unresolved: 0 }
        : { accepted: 0, rejected: count, unresolved: 0 };
}
/** The prose a `step_end` response states for each outcome — plainly, so a reader never has to infer it from the counts. */
function describeStepOutcome(action, resolution) {
    if (action === 'accept') {
        return `This step's diffs were accepted (${resolution.accepted} step${resolution.accepted === 1 ? '' : 's'} resolved, propagation included).`;
    }
    if (action === 'reject') {
        return `This step's diffs were rejected (${resolution.rejected} step${resolution.rejected === 1 ? '' : 's'} resolved, propagation included).`;
    }
    return "This step's diffs were left unresolved for human review.";
}
// ---------------------------------------------------------------------------
// §7 — transparently promoting a cached inspect-mode subtree to resolve, in place, with no
// further model interaction: the findings are already fully known (recorded by the original
// inspect-mode calls), so this replays them through exactly the same resolve-mode primitives
// above (`applyRegionMasking`, `decideStepAction`/`resolveStepForAction`, `consolidateRollup`)
// instead of re-deciding anything from scratch.
// ---------------------------------------------------------------------------
/**
 * This changed area's own region total — merged across every finding reported for it, through the
 * same consolidation every level above uses, so the arithmetic is identical at every hop.
 */
function mergeFindingRegions(findings) {
    return mergeRegionChangeCounts(findings.map(f => f.regions));
}
/**
 * The step accept/reject decision, credited instead of re-run whenever this step already has a
 * live resolution — most likely via `samediffas` propagation triggered by resolving a different
 * step, possibly in a different session, whose own decision this step happened to share (confirmed
 * live: `samediffas` ignores the `matchSettings` sent alongside a candidate step and matches purely
 * against whatever diff was recorded when the test itself ran, so a step can end up resolved with
 * no `resolveStep` call of its own). Never calls `decideStepAction`/`resolveStepForAction` — the
 * existing decision is credited as-is, exactly as recorded, never re-decided or re-posted. Shared
 * by `step_end`'s own finalize and `promoteSubtreeToResolve`'s step branch below, which is where
 * this exact check originated.
 */
async function decideOrCreditStepAction(params) {
    const { sessionUrl, stepIndex, session, findings, stepRegions, keys, deps } = params;
    const live = session.steps[stepIndex].resolution;
    if (live !== 'none') {
        return {
            action: live === 'accepted' ? 'accept' : 'reject',
            resolution: { accepted: live === 'accepted' ? 1 : 0, rejected: live === 'rejected' ? 1 : 0, unresolved: 0 },
        };
    }
    const action = decideStepAction(findings, stepRegions);
    const resolution = await resolveStepForAction({ sessionUrl, stepIndex, action, keys, deps });
    return { action, resolution };
}
/**
 * Promotes the cached inspect-mode subtree rooted at (rootLevel, ctx) to resolve, node by node,
 * bottom-up (`walkSubtree`'s own post-order guarantee — a step's decision needs its diffs'
 * already-promoted region rollup). Each node no-ops immediately once its own recorded mode is no
 * longer `'inspect'` (already promoted, or never cached at all), so calling this redundantly, or
 * on a subtree that's only partially cached, is always safe.
 *
 * - A **diff** node re-runs `applyRegionMasking` on its own already-recorded findings — nothing
 *   to re-investigate, `dynamic.mask` is already fully specified.
 * - A **step** node's diffs are, by the point this runs, already promoted; it then defers to
 *   `decideOrCreditStepAction` above, which credits an already-live resolution instead of
 *   re-deciding it. Only a still-`'none'` step actually runs `decideStepAction`/`resolveStepForAction`.
 * - A **session/scenario/batch** node never decides anything itself — its `findings` are
 *   model-authored summary prose from whenever `_end` first recorded them, never regenerated —
 *   this only re-consolidates its rollup now that its children are promoted.
 *
 * Every node, the walk's root included, pushes up to its parent exactly as the live `_end` calls
 * do — `rootScope` bounds `next`, never where findings are recorded.
 */
function promoteSubtreeToResolve(rootLevel, ctx, keys, deps) {
    return walkSubtree(rootLevel, ctx, async (level, nodeCtx, scopeId) => {
        if (getScopeMode(scopeId, deps) !== 'inspect')
            return;
        if (level === 'diff') {
            const findings = getCompletion(scopeId, deps).payload;
            const promoted = await applyRegionMasking({
                sessionUrl: nodeCtx.sessionUrl,
                stepIndex: nodeCtx.stepIndex,
                findings,
                keys,
                deps,
            });
            recordCompletion(scopeId, promoted, deps);
            const parentScopeId = stepScopeId(nodeCtx.sessionUrl, nodeCtx.stepIndex);
            appendChildFinding(parentScopeId, diffChildKey(nodeCtx.areaRect), promoted, deps);
            reportRollup(parentScopeId, diffChildKey(nodeCtx.areaRect), { resolution: { accepted: 0, rejected: 0, unresolved: 0 }, regions: mergeFindingRegions(promoted) }, deps);
        }
        else if (level === 'step') {
            const session = await fetchSteps(nodeCtx.sessionUrl, keys);
            const findings = getCompletion(scopeId, deps).payload;
            const rollup = childRollupTotal(scopeId, deps);
            const { resolution } = await decideOrCreditStepAction({
                sessionUrl: nodeCtx.sessionUrl,
                stepIndex: nodeCtx.stepIndex,
                session,
                findings,
                stepRegions: rollup.regions,
                keys,
                deps,
            });
            recordCompletion(scopeId, findings, deps);
            const parentScopeId = sessionScopeId(nodeCtx.sessionUrl);
            appendChildFinding(parentScopeId, stepChildKey(nodeCtx.stepIndex), findings, deps);
            reportRollup(parentScopeId, stepChildKey(nodeCtx.stepIndex), { resolution, regions: rollup.regions }, deps);
        }
        else {
            const findings = getCompletion(scopeId, deps).payload;
            const { rollup } = consolidateRollup(scopeId, findings, 'resolve', deps);
            recordCompletion(scopeId, findings, deps);
            if (level === 'scenario') {
                appendChildFinding(batchScopeId(nodeCtx.batchUrl), scenarioChildKey(nodeCtx.scenarioName), findings, deps);
                reportRollup(batchScopeId(nodeCtx.batchUrl), scenarioChildKey(nodeCtx.scenarioName), rollup, deps);
            }
            else if (level === 'session') {
                const session = await fetchSteps(nodeCtx.sessionUrl, keys);
                const parentScopeId = scenarioScopeIdForSession(nodeCtx.sessionUrl, session.sessionName);
                appendChildFinding(parentScopeId, sessionChildKey(nodeCtx.sessionUrl), findings, deps);
                reportRollup(parentScopeId, sessionChildKey(nodeCtx.sessionUrl), rollup, deps);
            }
        }
        recordScopeMode(scopeId, 'resolve', deps);
    }, deps);
}

/**
 * Every session in the batch that's currently `Running`, plus — of the rest — only those with at
 * least one step this investigation could actually act on (`filterSessions`' own `"mismatching"`:
 * not matching, or missing/new). Deliberately **not** filtered by overall resolution status: a
 * session already fully resolved (e.g. via `samediffas` propagation triggered elsewhere, or a
 * decision made entirely outside this review) can still have non-matching steps this review has
 * never actually visited — never gathered diff-level findings for, never applied a region mask to
 * — and visiting one already decided is always safe (`decideOrCreditStepAction` credits it instead
 * of re-resolving). A session with every step genuinely matching, however, has nothing for any
 * level of this review to do, so descending into it would only cost a wasted round-trip.
 * `Running` is applied before the mismatching filter, not instead of it: a session mid-run may not
 * have captured any steps yet and so would never pass `"mismatching"`, but there is still
 * genuinely nothing to fetch or investigate from it either way — it's surfaced (see
 * `recordUnreadyChildren`) unconditionally, not because it looks mismatching right now.
 */
async function fetchReviewableSessions(batchUrl, keys) {
    const simplified = await fetchSimplifiedBatchSessions(batchUrl, keys);
    const { baseUrl, batchId, accountId } = await parseBatchUrlVerified(batchUrl, keys);
    const toEntry = (s) => ({
        sessionUrl: buildSessionUrl({ baseUrl, batchId, accountId, sessionId: s.sessionId }),
        sessionName: s.sessionName,
    });
    const running = simplified.filter(s => s.status === 'Running');
    const notRunning = simplified.filter(s => s.status !== 'Running');
    return {
        sessions: filterSessions(notRunning, 'mismatching').map(toEntry),
        runningSessions: running.map(toEntry),
    };
}
/**
 * The structural steps' indices only (see `resolution.ts`'s `classifyStructuralSteps`) — pure and
 * read-only, unlike `preResolveStructuralSteps`, which additionally mutates (rejects an aborted
 * trailing step) and so needs write access. Used to keep discovery itself read-only; the mutation
 * still happens, idempotently, wherever a session is genuinely visited in `mode: 'resolve'`
 * (`sessionStepChildren` below). Only excluded in `mode: 'resolve'` — matching that function's own,
 * unchanged behavior: in `mode: 'inspect'` a structural step is still offered, since nothing here
 * is ever going to mutate it either way.
 */
function structuralExcludedIndices(session, mode) {
    return mode === 'resolve' ? new Set(classifyStructuralSteps(session).map(s => s.stepIndex)) : new Set();
}
// Every fetcher below takes the caller's already-resolved `rootScope`/`mode` and threads them straight
// into each child's `nextCall` — there is no other way to obtain a `NextCall` (see `nextCall`'s own
// doc comment), so a child descriptor can never end up carrying a call that omits either.
/**
 * The batch-wide session list, shared by `batchChildren` and every `scenarioChildren` call nested
 * under it, cached at the batch's own scope id — the fix for the design flaw where every level
 * (batch, then each scenario independently) re-fetched and re-filtered the same batch-wide list on
 * its own exhaustion, scaling with scenario count on top of the dominant, unavoidable cost of
 * fetching every relevant session's own steps. Only the investigation's own true root is ever
 * allowed to force a refresh (`forceRefresh: true`) — everything nested underneath always reads
 * whatever the root last discovered, never re-fetching on its own. When nothing has been cached
 * yet (this batch has never been queried at all, by any scope), a fetch happens regardless of
 * `forceRefresh`, so a caller that jumps straight into a nested scope without ever visiting the
 * root still gets a real answer instead of an empty cache. This is what makes "the root discovers
 * every child, everything gets reviewed, then the root discovers whatever's new and reviews again"
 * the actual, enforced shape of a batch-wide investigation: rediscovery only ever happens where
 * `batchChildren` (or, for a scenario-rooted investigation, `scenarioChildren` itself) decides its
 * own queue is exhausted — never at any scope nested underneath it.
 */
async function reviewableSessionsSnapshot(batchUrl, keys, deps, forceRefresh) {
    const scopeId = batchScopeId(batchUrl);
    if (!forceRefresh) {
        const cached = getDiscoveredChildren(scopeId, deps);
        if (cached)
            return cached;
    }
    const fresh = await fetchReviewableSessions(batchUrl, keys);
    recordDiscoveredChildren(scopeId, fresh, deps);
    return fresh;
}
/**
 * Cascades eagerly into every discovered scenario's own `scenarioChildren` — which itself cascades
 * into every session's own steps — the moment the batch's own scenario queue is freshly
 * established (empty or just-exhausted). This is what closes the race the lazy,
 * one-level-at-a-time alternative leaves open: a session two scenarios away is only ever visited
 * lazily, at which point resolving an *earlier* step elsewhere (propagated via `samediffas`,
 * possibly to a completely different session sharing the same scenario) may have already touched
 * it — silently excluding some of its steps from that session's own step-queue the first time
 * it's finally computed, even though the session was already known to be part of this exact
 * investigation. Snapshotting every session's own steps atomically, before anything in this
 * investigation has resolved anything, means every genuinely investigable step gets queued (and
 * thus visited exactly once, per Part C/D) regardless of what happens to it afterward. Read-only
 * throughout — every fetch this cascade makes, down through `scenarioChildren`/`sessionStepChildren`,
 * only ever needs read access, never a mutation — so it never touches anything itself. As the
 * batch's own top-level scope, this is the one place allowed to force a fresh session-list fetch
 * (see `reviewableSessionsSnapshot`); every scenario it cascades into just reads that same
 * snapshot. Also records this batch's own `Running` snapshot (see `fetchReviewableSessions`) at
 * its own scope id, overwriting whatever was recorded on any earlier round — so `batch_end`'s own
 * `doneMessage`, once this is genuinely the investigation's root, can tell the model exactly which
 * sessions to ask the user to wait on (or abort) and re-run for.
 */
async function batchChildren(batchUrl, keys, rootScope, mode, deps) {
    return resolveScopedChildren(batchScopeId(batchUrl), async () => {
        const reviewableSessions = await reviewableSessionsSnapshot(batchUrl, keys, deps, true);
        const { sessions, runningSessions } = reviewableSessions;
        recordUnreadyChildren(batchScopeId(batchUrl), runningSessions.map(s => s.sessionUrl), deps);
        const scenarioNames = [...new Set(sessions.map(s => s.sessionName))].sort();
        await Promise.all(scenarioNames.map(name => scenarioChildren(batchUrl, name, keys, rootScope, mode, deps)));
        return scenarioNames;
    }, scenarioName => ({
        key: scenarioChildKey(scenarioName),
        scopeId: scenarioScopeId(batchUrl, scenarioName),
    }), deps);
}
/**
 * See `batchChildren`'s own doc comment for why this eagerly, read-only-ly cascades into every
 * discovered session's own step-queue right away (and records its own `Running` snapshot), rather
 * than leaving each one to be established lazily. Always reads the shared session-list snapshot
 * (`reviewableSessionsSnapshot`) rather than fetching independently — it only forces that snapshot
 * to refresh when this scenario is itself the investigation's true root (`rootScope: 'scenario'`, no
 * batch above it to defer to); nested under a batch-wide investigation, a scenario whose own
 * session queue is exhausted simply reports nothing new until the batch's own root-level
 * `batchChildren` call decides to refresh and re-cascades a fresh snapshot down to every scenario.
 */
async function scenarioChildren(batchUrl, scenarioName, keys, rootScope, mode, deps) {
    return resolveScopedChildren(scenarioScopeId(batchUrl, scenarioName), async () => {
        const all = await reviewableSessionsSnapshot(batchUrl, keys, deps, hasReachedRootScope('scenario', rootScope));
        const sessions = all.sessions.filter(s => s.sessionName === scenarioName);
        const runningSessions = all.runningSessions.filter(s => s.sessionName === scenarioName);
        recordUnreadyChildren(scenarioScopeId(batchUrl, scenarioName), runningSessions.map(s => s.sessionUrl), deps);
        // A session that's gone by the time this eager cascade reaches it (see Part D below) must
        // not let one missing session's fetch failure take out every other session's own snapshot
        // in this same Promise.all — it self-completes right here, exactly as sessionProgress/
        // sessionEnd would if they'd reached it directly instead.
        await Promise.all(sessions.map(async (s) => {
            let session;
            try {
                session = await fetchSteps(s.sessionUrl, keys);
            }
            catch (error) {
                if (!isMissingSessionError(error))
                    throw error;
                recordCompletion(sessionScopeId(s.sessionUrl), [missingSessionFinding(s.sessionUrl)], deps);
                return;
            }
            // Queues this session's own eligible steps directly — deliberately not through
            // sessionStepChildren, which would also try to mutate structural steps (needs write
            // access, and doesn't belong in a read-only discovery cascade). That mutation still runs,
            // idempotently, whenever this session is genuinely visited with write access.
            const stepKeys = stepChildDescriptors(s.sessionUrl, session, structuralExcludedIndices(session, mode)).map(d => d.key);
            queueChildKeys(sessionScopeId(s.sessionUrl), stepKeys, deps);
        }));
        return sessions.map(s => sessionChildKey(s.sessionUrl));
    }, sessionUrl => ({
        key: sessionChildKey(sessionUrl),
        scopeId: sessionScopeId(sessionUrl),
    }), deps);
}
function stepChildDescriptors(sessionUrl, session, excluded) {
    var _a;
    return ((_a = session.steps) !== null && _a !== void 0 ? _a : [])
        .map((step, stepIndex) => ({ step, stepIndex }))
        .filter(({ step, stepIndex }) => !step.isMatching && !excluded.has(stepIndex))
        .map(({ stepIndex }) => ({
        key: stepChildKey(stepIndex),
        scopeId: stepScopeId(sessionUrl, stepIndex),
    }));
}
/**
 * A session's live children — its non-matching steps, minus the structural ones §5 decides on its
 * own (see `classifyStructuralSteps`/`preResolveStructuralSteps`). Every caller that needs a
 * session's children goes through here, not just `session_progress`: the exclusion has to be
 * identical everywhere, or a session's own completeness gate would sit waiting on a step the
 * model was never given to investigate. The structural steps' own accept/reject *mutation* runs
 * every time this is called in `mode: 'resolve'`, independent of whether this session's queue is
 * being freshly established or was already pre-populated by an eager cascade (`scenarioChildren`)
 * — it's idempotent (each one checks `isCompleted` first), so gating it behind "establishing a
 * fresh queue" would otherwise skip it entirely whenever the queue arrived pre-populated.
 */
async function sessionStepChildren(params) {
    const { sessionUrl, session, mode, keys, deps } = params;
    if (mode === 'resolve') {
        await preResolveStructuralSteps({ sessionUrl, session, keys, deps });
    }
    return resolveScopedChildren(sessionScopeId(sessionUrl), async () => stepChildDescriptors(sessionUrl, session, structuralExcludedIndices(session, mode)).map(d => d.key), key => ({
        key,
        scopeId: stepScopeId(sessionUrl, parseStepChildKey(key)),
    }), deps);
}
async function sessionChildren(params) {
    const session = await fetchSteps(params.sessionUrl, params.keys);
    return sessionStepChildren({ ...params, session });
}
function toRect(area) {
    return { left: area.left, top: area.top, width: area.width, height: area.height };
}
async function stepChildren(sessionUrl, stepIndex, keys, deps) {
    return resolveScopedChildren(stepScopeId(sessionUrl, stepIndex), async () => {
        const { areas } = await fetchChangedAreas(sessionUrl, stepIndex, keys);
        return areas.map(area => diffChildKey(toRect(area)));
    }, key => ({
        key,
        scopeId: diffScopeId(sessionUrl, stepIndex, parseDiffChildKey(key)),
    }), deps);
}
// Path compression — see the traversal gotcha in llm-docs/OVERVIEW.md.
/** Only these two have no `verifyInvocation` gate and no mutating decision, so skipping one needs no synthetic invocation record. */
const COMPRESSIBLE_LEVELS = new Set(['scenario', 'session']);
/** Carries the full ancestry down (unlike `review-core`'s `childContextFor`), which the ascent needs to name a parent. */
function childWalkNode(level, ctx, childKey, rootScope, mode) {
    switch (level) {
        case 'batch':
            return {
                level: 'scenario',
                scopeId: scenarioScopeId(ctx.batchUrl, childKey),
                ctx: { ...ctx, scenarioName: childKey },
                key: childKey,
                call: reviewProgressCall('scenario', { batchUrl: ctx.batchUrl, scenarioName: childKey }, rootScope, mode),
            };
        case 'scenario':
            return {
                level: 'session',
                scopeId: sessionScopeId(childKey),
                ctx: { ...ctx, sessionUrl: childKey },
                key: childKey,
                call: reviewProgressCall('session', { sessionUrl: childKey }, rootScope, mode),
            };
        case 'session': {
            const stepIndex = parseStepChildKey(childKey);
            return {
                level: 'step',
                scopeId: stepScopeId(ctx.sessionUrl, stepIndex),
                ctx: { ...ctx, stepIndex },
                key: childKey,
                call: reviewProgressCall('step', { sessionUrl: ctx.sessionUrl, stepIndex }, rootScope, mode),
            };
        }
        case 'step': {
            const areaRect = parseDiffChildKey(childKey);
            return {
                level: 'diff',
                scopeId: diffScopeId(ctx.sessionUrl, ctx.stepIndex, areaRect),
                ctx: { ...ctx, areaRect },
                key: childKey,
                call: nextCall(EYES_REVIEW_TOOLS.diffReport, { sessionUrl: ctx.sessionUrl, stepIndex: ctx.stepIndex, reports: [{ areaRect }] }, rootScope, mode),
            };
        }
        case 'diff':
            throw new Error('diff has no children'); // unreachable — no caller descends past the leaf
    }
}
function queuedChildNodes(node, rootScope, mode, deps) {
    return getQueuedChildKeys(node.scopeId, deps).map(key => childWalkNode(node.level, node.ctx, key, rootScope, mode));
}
/** The `recordScopeMode` write is load-bearing: `checkModeAgreesWithParent` reads an unrecorded mode as "nothing to disagree with", disarming the gate below. */
function chainDown(child, rootScope, mode, deps) {
    let node = child;
    for (;;) {
        if (!COMPRESSIBLE_LEVELS.has(node.level))
            return node;
        const incomplete = queuedChildNodes(node, rootScope, mode, deps).filter(c => !isCompleted(c.scopeId, deps));
        if (incomplete.length !== 1)
            return node;
        recordScopeMode(node.scopeId, mode, deps);
        recordScopeRoot(node.scopeId, rootScope, deps);
        node = incomplete[0];
    }
}
function descentTarget(parentLevel, parentCtx, childKey, rootScope, mode, deps) {
    return chainDown(childWalkNode(parentLevel, parentCtx, childKey, rootScope, mode), rootScope, mode, deps);
}
/** Counts entries, not queued children: a step that was never queued still reports one (`preResolveStructuralSteps`), and would be compressed away. */
function compressibleOnAscent(level, scopeId, deps) {
    if (!COMPRESSIBLE_LEVELS.has(level))
        return false;
    const entries = orderedChildFindingEntries(scopeId, deps);
    if (entries.length !== 1)
        return false;
    return level === 'scenario' || entries[0][1].length === 1;
}
/** An identity copy: `origin` accumulates rather than replaces, so a finding carried past both a session and a scenario still names the step it came from. */
function forwardFindings(findings, origin) {
    return findings.map(finding => {
        const existing = finding.origin;
        return { ...finding, origin: { ...existing, ...origin } };
    });
}
function originContribution(level, childKey) {
    switch (level.level) {
        case 'session':
            return { sessionUrl: level.ctx.sessionUrl, stepIndex: parseStepChildKey(childKey) };
        case 'scenario':
            return { scenarioName: level.ctx.scenarioName, sessionUrl: childKey };
        default:
            throw new Error(`a ${level.level} is never compressed, so it never forwards findings`);
    }
}
/** Every write is keyed by child key and overwriting, so two siblings racing into the same ancestor is safe. */
async function deriveClose(level, rootScope, mode, deps) {
    const [childKey, childFindings] = orderedChildFindingEntries(level.scopeId, deps)[0];
    const { findings: forwarded, rollup } = consolidateRollup(level.scopeId, forwardFindings(childFindings, originContribution(level, childKey)), mode, deps);
    const parent = await level.up.parent();
    recordCompletion(level.scopeId, forwarded, deps);
    appendChildFinding(parent.scopeId, level.up.key, forwarded, deps);
    reportRollup(parent.scopeId, level.up.key, rollup, deps);
    recordScopeMode(level.scopeId, mode, deps);
    recordScopeRoot(level.scopeId, rootScope, deps);
    log(level.scopeId, 'derived-close', { input: { scopeId: level.scopeId } }, deps);
    return parent;
}
/** Stops at the first ancestor that consolidates — or sooner, at the first with an unreviewed branch, which it deep-links into rather than re-asking for its progress. */
async function chainUp(parent, rootScope, mode, deps) {
    let level = parent;
    for (;;) {
        if (!level.up || !compressibleOnAscent(level.level, level.scopeId, deps))
            return { kind: 'end', level };
        const grandParent = await deriveClose(level, rootScope, mode, deps);
        const unreviewed = queuedChildNodes(grandParent, rootScope, mode, deps).find(child => child.scopeId !== level.scopeId && !isCompleted(child.scopeId, deps));
        if (unreviewed) {
            const target = chainDown(unreviewed, rootScope, mode, deps);
            return { kind: 'call', call: target.call, level: target.level };
        }
        level = grandParent;
    }
}
async function runProgress(params) {
    const { level, rootScope, mode, scopeId, children, descend, endCall, parentProgressCall, buildFindings, deps } = params;
    const completed = computeCompleted(scopeId, children.map(c => c.scopeId), deps);
    const nextChild = completed === null ? children.find(c => !isCompleted(c.scopeId, deps)) : undefined;
    const descentCall = nextChild && descend(nextChild);
    const hasChildFindings = completed === null && !descentCall && flattenChildFindings(scopeId, deps).length > 0;
    const next = buildProgressNext({
        level,
        rootScope,
        completed,
        descentCall,
        endCall,
        hasChildFindings,
        parentProgressCall,
    });
    const stillInvestigating = completed === null && descentCall !== undefined;
    // Each branch below builds its own complete literal, keys already in the order they must
    // serialize in — `next` last, however many of findings/resolution/regions precede it — rather
    // than mutating one object, so `next`'s position can never drift from a future edit here.
    if (stillInvestigating)
        return { completed, next };
    const findings = buildFindings();
    const clusters = sourceClustersFor(scopeId, deps);
    if (mode !== 'resolve')
        return { completed, findings, clusters, next };
    const rollup = childRollupTotal(scopeId, deps);
    recordToolTelemetry({ resolve_decisions: rollup.resolution });
    return { completed, findings, clusters, resolution: rollup.resolution, regions: rollup.regions, next };
}
/** Below batch only; `undefined` when nothing recorded on the parent suggests an enclosing walk. */
function inferEnclosingReview(parent, parentScopeId, deps) {
    // A stored root narrower than the parent, or not a scope at all, would make `widen` a call
    // the schema or the walk rejects.
    const stored = getScopeRoot(parentScopeId, deps);
    const root = isScopeType(stored) && isAtOrAbove(stored, parent) ? stored : undefined;
    if (!root && !getScopeMode(parentScopeId, deps))
        return undefined;
    return {
        scope: parent,
        rootScope: root !== null && root !== void 0 ? root : parent,
        state: getCompletion(parentScopeId, deps) ? 'closed-earlier' : 'in-progress',
    };
}
function enclosingWarning(level, enclosing) {
    return enclosing.state === 'in-progress'
        ? `This call omitted rootScope, so the review closed here at scope "${level}" — but the enclosing ${enclosing.scope} is mid-review, rooted at "${enclosing.rootScope}". If you are continuing that review, call the tool named in review.widen.tool with review.widen.args unchanged; this ${level}'s findings are already recorded for it.`
        : `The enclosing ${enclosing.scope}'s summary predates this ${level}'s new findings; to refresh it, call the tool named in review.widen.tool with review.widen.args unchanged.`;
}
async function runEnd(params) {
    var _a;
    const { level, toolName, rootScope, rootScopeOmitted, scopeId, ownChildren, progressCall, pushUpTo, finalize, getSiblings, descend, parentProgressCall, ascent, mode, doneMessage, deps, } = params;
    const stillIncomplete = ownChildren.some(c => !isCompleted(c.scopeId, deps));
    if (stillIncomplete) {
        const instruction = `Not every ${childLevelLabel(level)} of this ${level} was reviewed yet. This submission was discarded — call ${progressCall.tool} for this ${level} again to see what remains, then call this again once it reports being fully reviewed.`;
        countGateRejection();
        log(scopeId, toolName, { input: { scopeId }, error: instruction }, deps);
        return {
            persisted: false,
            next: { instruction: `${instruction} ${rootReminder(rootScope)}`, calls: [progressCall] },
            reachedRoot: false,
        };
    }
    const { findings, rollup } = await finalize();
    const count = Array.isArray(findings) ? findings.length : undefined;
    recordToolTelemetry({
        ...(level === 'diff' ? { diffs_reported: count } : { findings_summarized: count }),
        resolve_decisions: rollup.resolution,
    });
    recordCompletion(scopeId, findings, deps);
    if (pushUpTo) {
        appendChildFinding(pushUpTo.parentScopeId, pushUpTo.childKey, findings, deps);
        reportRollup(pushUpTo.parentScopeId, pushUpTo.childKey, rollup, deps);
    }
    const reachedRoot = hasReachedRootScope(level, rootScope);
    const siblings = await getSiblings();
    const incompleteSibling = siblings.find(s => !isCompleted(s.scopeId, deps));
    // No incomplete sibling means the parent's `_progress` could only answer "call `_end`", which is already known here.
    let target;
    if (incompleteSibling) {
        if (descend)
            target = { kind: 'call', ...descend(incompleteSibling) };
    }
    else if (ascent && !reachedRoot) {
        target = await chainUp(ascent(), rootScope, mode, deps);
    }
    const next = buildEndNext({
        level,
        rootScope,
        siblingCall: (target === null || target === void 0 ? void 0 : target.kind) === 'call' ? { call: target.call, level: target.level } : undefined,
        parentClose: (target === null || target === void 0 ? void 0 : target.kind) === 'end'
            ? {
                level: target.level.level,
                endCall: target.level.endCall,
                nextLevel: {
                    scope: target.level.scope,
                    findings: target.level.findings(),
                    clusters: target.level.clusters(),
                },
                hasChildFindings: flattenChildFindings(target.level.scopeId, deps).length > 0,
            }
            : undefined,
        parentProgressCall,
        doneMessage,
    });
    if (!reachedRoot || !parentProgressCall || !pushUpTo)
        return { persisted: true, next, findings, rollup, reachedRoot };
    const parent = parentProgressCall.args.scope;
    const enclosing = rootScopeOmitted ? inferEnclosingReview(parent, pushUpTo.parentScopeId, deps) : undefined;
    const widen = { ...parentProgressCall, args: { ...parentProgressCall.args, rootScope: (_a = enclosing === null || enclosing === void 0 ? void 0 : enclosing.rootScope) !== null && _a !== void 0 ? _a : parent } };
    const instruction = enclosing ? `${next.instruction} ${enclosingWarning(level, enclosing)}` : next.instruction;
    return { persisted: true, next: { ...next, instruction }, findings, rollup, reachedRoot, widen, enclosing };
}
/**
 * At `reachedRoot` the model only paraphrases `summary` into the user's report, so the link must live inside it;
 * below the root the next level still consolidates from a separate `example`.
 */
function foldExampleIntoSummary(findings) {
    if (!Array.isArray(findings))
        return findings;
    return findings.map(finding => {
        if (!finding || typeof finding !== 'object' || !('example' in finding))
            return finding;
        const { summary, example, ...rest } = finding;
        return { ...rest, summary: `${summary} ([view](${example}))` };
    });
}
/** `review` is internal: it carries the root-only data to `tools.ts`, whose `withReviewField` merges it into the leading `review` field. */
function endResponse(result, mode) {
    // `next` is assigned last so it always serializes as this response's final key, however many
    // of findings/resolution/regions precede it.
    const response = {};
    if (result.reachedRoot) {
        response.review = {
            reachedRoot: true,
            ...(result.widen && { widen: result.widen }),
            ...(result.enclosing && { enclosing: result.enclosing }),
        };
    }
    if (result.persisted)
        response.findings = result.reachedRoot ? foldExampleIntoSummary(result.findings) : result.findings;
    if (result.persisted && mode === 'resolve' && result.rollup) {
        response.resolution = result.rollup.resolution;
        response.regions = result.rollup.regions;
    }
    response.next = result.next;
    return response;
}
/**
 * `runEnd`'s own `finalize` for batch/scenario/session: verify the submitted findings' sources
 * against this scope's own children, then fold them into this scope's rollup. Shared verbatim by
 * those three levels — step and diff each do meaningfully more (region/checkpoint mutation) inside
 * their own `finalize`, so they build it inline instead.
 */
function verifyAndConsolidate(scopeId, logScopeId, logInput, findings, mode, deps) {
    return async () => {
        const childFindings = flattenChildFindings(scopeId, deps);
        await withGateLog(EYES_REVIEW_TOOLS.end, logScopeId, logInput, deps, () => verifySourcedFindings(expandSourceCitations(findings, sourceClustersFor(scopeId, deps)), childFindings));
        return consolidateRollup(scopeId, stripSources(findings), mode, deps);
    };
}
// ---------------------------------------------------------------------------
// The mode-consistency gate — every non-root level's _progress/_end/diff_report call checks its
// immediate parent's recorded mode (see recordScopeMode below) before doing anything else, and
// redirects back to itself — same tool, same args, `mode` corrected to the parent's actual one —
// if the two disagree. Under normal traversal this can never trigger — every next.calls entry is
// built via nextCall() from the same in-scope `mode` its own call received, so mode is threaded
// unchanged from parent to child — but a caller that jumps into the middle of an investigation
// with a self-chosen `mode` (rather than following `next`) could otherwise silently start
// resolving (or merely inspecting) a scope its parent already committed to reviewing the other
// way.
// ---------------------------------------------------------------------------
/**
 * Whether `mode` (the mode this call itself received) disagrees with `parentScopeId`'s own
 * recorded mode. Returns `null` — not a mismatch — when nothing is recorded for the parent yet:
 * that means no call has reached this branch of the investigation through the parent at all, so
 * there is nothing yet to disagree with (the current call is free to establish the mode itself,
 * via `recordScopeMode`, once past this check). `retryCall` is this same call — same tool, same
 * args — built by the caller via `nextCall()` from its own (mismatched) `mode`; on a mismatch,
 * only its `mode` is overridden before it's handed back as the redirect.
 */
function checkModeAgreesWithParent(params) {
    const { parentScopeId, mode, retryCall, deps } = params;
    const parentMode = getScopeMode(parentScopeId, deps);
    if (!parentMode || parentMode === mode)
        return null;
    const instruction = `This call passed mode "${mode}", but its parent scope is already being reviewed in mode "${parentMode}". ` +
        `Call ${retryCall.tool} again with mode: "${parentMode}" — every level of one investigation must share the same mode. ` +
        rootReminder(retryCall.args.rootScope);
    countGateRejection();
    log(parentScopeId, retryCall.tool, { input: { parentScopeId, mode }, error: instruction }, deps);
    return { instruction, calls: [{ ...retryCall, args: { ...retryCall.args, mode: parentMode } }] };
}
/**
 * Every non-root level's own mode-agreement check, run identically at the top of its
 * _progress/_end/diff_report call: skipped entirely once this call has already reached its own
 * investigation's rootScope (there's no parent left to disagree with).
 */
function checkParentModeMismatch(level, rootScope, parentScopeId, mode, retryCall, deps) {
    return hasReachedRootScope(level, rootScope)
        ? null
        : checkModeAgreesWithParent({ parentScopeId, mode, retryCall, deps });
}
/** Nearest first: the call's own scope, its session (step level only), its batch. */
function midWalkCandidates(own, scopeId, sessionUrl) {
    const session = own === 'step' ? [{ scope: 'session', scopeId: sessionScopeId(sessionUrl) }] : [];
    return [{ scope: own, scopeId }, ...session, { scope: 'batch', scopeId: rootScopeId(scopeId) }];
}
/** Reads `roots` only; a mid-walk rootless call is redirected before anything is discarded or written. */
function checkRootlessMidWalk(params) {
    const { level, scopeId, sessionUrl, rootScopeOmitted, retryCall, restart, deps } = params;
    if (!rootScopeOmitted)
        return null;
    const own = resolveRootScope(level, undefined);
    const root = midWalkCandidates(own, scopeId, sessionUrl)
        .map(candidate => {
        const stored = getScopeRoot(candidate.scopeId, deps);
        const open = isScopeType(stored) &&
            isAtOrAbove(stored, candidate.scope) &&
            !isAtOrAbove(own, stored) &&
            getCompletion(candidate.scopeId, deps) === undefined;
        return open ? stored : undefined;
    })
        .find(stored => stored !== undefined);
    if (!root)
        return null;
    const instruction = `This call omitted rootScope, but this ${own} belongs to a review that is still in progress and rooted at "${root}"; without rootScope it would be narrowed to this ${own} alone. Nothing was recorded. ` +
        `Call ${retryCall.tool} again with rootScope: "${root}" and every other argument unchanged — next.calls holds exactly that call. ` +
        `To review this ${own} on its own instead, pass rootScope: "${own}" explicitly. ${rootReminder(root)}`;
    countGateRejection();
    log(scopeId, retryCall.tool, { input: { scopeId, rootScopeOmitted: true }, error: instruction }, deps);
    return {
        instruction,
        calls: [{ ...retryCall, args: { ...retryCall.args, rootScope: root, ...(restart ? { restart: true } : {}) } }],
    };
}
// ---------------------------------------------------------------------------
// `restart` — discards every cached record for a scope and everything beneath it, so a caller
// that wants to independently re-review something already reviewed (by this investigation or a
// separate one) starts from a clean slate rather than reusing stale data. Never automatic — see
// `RestartShape`'s own description for why the caller must always opt in explicitly.
// ---------------------------------------------------------------------------
/** Discards the cached subtree rooted at (level, ctx) — a thin `visit` callback over `walkSubtree`. */
function discardSubtree(level, ctx, deps) {
    return walkSubtree(level, ctx, async (_level, _ctx, scopeId) => {
        clearCompletion(scopeId, deps);
        clearChildFindings(scopeId, deps);
        clearChildFindings(rollupScopeId(scopeId), deps);
        clearScopeMode(scopeId, deps);
        clearScopeRoot(scopeId, deps);
        clearQueuedChildKeys(scopeId, deps);
        clearUnreadyChildren(scopeId, deps);
        clearDiscoveredChildren(scopeId, deps);
    }, deps);
}
/** `if (restart) await discardSubtree(...)` — every level's own restart check, ahead of it. */
async function maybeDiscard(restart, level, ctx, deps) {
    if (restart)
        await discardSubtree(level, ctx, deps);
}
// ---------------------------------------------------------------------------
// Transparent inspect→resolve promotion (see `resolution.ts`'s own §7 doc comment for the full
// mechanics) — triggered here, at the top of every command function, whenever this exact call's
// own scope is already fully cached under `mode: 'inspect'` but `mode: 'resolve'` is now wanted.
// A `restart` call never promotes — it just discarded this rootScope, so there's nothing cached left
// to promote.
// ---------------------------------------------------------------------------
async function promoteIfNeeded(params) {
    const { level, scopeId, ctx, mode, restart, keys, deps } = params;
    if (restart || mode !== 'resolve' || !isCompleted(scopeId, deps) || getScopeMode(scopeId, deps) !== 'inspect')
        return;
    await promoteSubtreeToResolve(level, ctx, keys, deps);
}
/** `promoteIfNeeded` followed by `recordScopeMode`/`recordScopeRoot` — every level's own sequence, in this same order. */
async function promoteAndRecordMode(params) {
    await promoteIfNeeded(params);
    recordScopeMode(params.scopeId, params.mode, params.deps);
    recordScopeRoot(params.scopeId, params.rootScope, params.deps);
}
// ---------------------------------------------------------------------------
// diff_report's hard gates — verifies eyes_inspect_image_diff and both baseline/checkpoint
// eyes_inspect_image calls actually happened for this exact areaRect, that every
// dynamic.justification:"History" finding names a node eyes_inspect_history was actually called
// for, that every dynamic finding (its `mask` is required) actually looked at the step's current
// regions first, and — independent of what the model logged calling — that the mask itself checks
// out against live data (`verifyMasksAgainstRegions`): `before` names a region genuinely in effect
// right now, and `after` genuinely covers the finding's own area. When `sameAs` is given, a
// cheaper branch applies instead — see `verifySameAsEligibility`.
// ---------------------------------------------------------------------------
/**
 * Verifies a `sameAs` reference is eligible to fast-track against: not a self-reference,
 * resolves to an existing `eyes_review_diff_report` completion, and is within the same
 * scenario as the current call. Deliberately does not check whether the referenced completion
 * was itself recorded via `sameAs` — chaining is allowed (every occurrence, chained or not, still
 * independently requires its own dom_diff call, checkpoint review, and restated findings, so
 * per-occurrence diligence doesn't shrink with chain depth).
 */
async function verifySameAsEligibility(sessionUrl, stepIndex, areaRect, sameAs, currentSessionName, keys, deps) {
    const ownScopeId = diffScopeId(sessionUrl, stepIndex, areaRect);
    const refScopeId = diffScopeId(sameAs.sessionUrl, sameAs.stepIndex, sameAs.areaRect);
    if (refScopeId === ownScopeId) {
        throw new Error('sameAs must reference a different, already-recorded changed area — it names this exact session, step, and areaRect.');
    }
    if (!isCompleted(refScopeId, deps)) {
        throw new Error(`sameAs names session ${sameAs.sessionUrl} step ${sameAs.stepIndex} areaRect ${JSON.stringify(sameAs.areaRect)}, ` +
            `but no eyes_review_diff_report has been recorded for it yet. Fully verify that occurrence first ` +
            `(or drop sameAs and verify this one directly with eyes_inspect_image_diff and both baseline/checkpoint images).`);
    }
    const refSessionName = sameAs.sessionUrl === sessionUrl ? currentSessionName : (await fetchSteps(sameAs.sessionUrl, keys)).sessionName;
    if (scenarioScopeIdForSession(sessionUrl, currentSessionName) !==
        scenarioScopeIdForSession(sameAs.sessionUrl, refSessionName)) {
        throw new Error(`sameAs names a changed area from a different scenario ("${refSessionName}" vs. this session's "${currentSessionName}") ` +
            `— only occurrences within the same scenario can be fast-tracked against each other.`);
    }
}
/** Whether the record is a diff the agent examined rather than a placeholder for a step that has none — tagged `unobtainable` by `stepProgress`, `status` by the tool handler. */
function isExaminedDomDiff(args) {
    const record = args;
    return record.status === undefined && record.unobtainable === undefined;
}
async function verifyDiffReportHardGate(sessionUrl, stepIndex, areaRect, findings, sameAs, keys, deps) {
    var _a, _b;
    const stepScope = stepScopeId(sessionUrl, stepIndex);
    const rectMatches = (loggedRect) => loggedRect === undefined || rectsIntersect(loggedRect, areaRect);
    // Both the bundled call and the raw per-image calls are agent-initiated, so either satisfies the gate.
    const evidenceCovers = (label) => verifyInvocation(stepScope, EYES_INSPECT_TOOLS.evidence, args => { var _a; return rectMatches(args.areaRect) && ((_a = args.images) === null || _a === void 0 ? void 0 : _a.includes(label)) === true; }, deps);
    const session = await fetchSteps(sessionUrl, keys);
    const step = (_a = session.steps) === null || _a === void 0 ? void 0 : _a[stepIndex];
    if (!step)
        throw new Error(`Step index ${stepIndex} is out of range for this session.`);
    if (sameAs) {
        if (!verifyInvocation(stepScope, EYES_INSPECT_TOOLS.domDiff, isExaminedDomDiff, deps)) {
            throw new Error('No examined dom diff is on record for this step. A sameAs shortcut is only valid once ' +
                "you've actually examined this step's own dom diff and confirmed it shows the same structural " +
                'change — call eyes_inspect_dom_diff first. A step that structurally has no dom diff cannot ' +
                'use this shortcut at all: report it the full way, with its own image diff and both images.');
        }
        const checkpoint = plannedEvidence(step, areaRect).find(request => request.label === 'checkpoint');
        if (checkpoint &&
            !evidenceCovers('checkpoint') &&
            !verifyInvocation(sessionScopeId(sessionUrl), EYES_INSPECT_TOOLS.image, args => args.imageId === checkpoint.imageId && rectMatches(args.rect), deps)) {
            throw new Error(`This step's checkpoint image has not been fetched for this areaRect yet. Even with sameAs, you must ` +
                `fetch and review it before calling eyes_review_diff_report — call eyes_inspect_evidence with this areaRect in its areaRects.`);
        }
        await verifySameAsEligibility(sessionUrl, stepIndex, areaRect, sameAs, session.sessionName, keys, deps);
        return; // the per-finding gates below are not re-checked on this branch — see the reasoning above.
    }
    // Exactly what `eyes_inspect_evidence` would gather and no more: demanding a side the bundle refuses to fetch would leave the step unclosable.
    const planned = plannedEvidence(step, areaRect);
    if (planned.length === 0) {
        // Otherwise the loop below would demand nothing and pass vacuously on an invented rect.
        throw new Error(`areaRect ${JSON.stringify(areaRect)} lies outside every image of this step, so there is no evidence to review it by. Report a changed area that eyes_inspect_changed_areas or eyes_review_progress actually named.`);
    }
    for (const request of planned) {
        if (evidenceCovers(request.label))
            continue;
        const fetchedRaw = request.label === 'diff'
            ? verifyInvocation(stepScope, EYES_INSPECT_TOOLS.imageDiff, args => rectMatches(args.rect), deps)
            : verifyInvocation(sessionScopeId(sessionUrl), EYES_INSPECT_TOOLS.image, args => args.imageId === request.imageId && rectMatches(args.rect), deps);
        if (!fetchedRaw) {
            const what = request.label === 'diff' ? 'The image diff' : `This step's ${request.label} image`;
            throw new Error(`${what} has not been fetched for this areaRect yet. Call eyes_inspect_evidence with this areaRect in its areaRects — batch every other unreviewed area of this step into the same call — before calling eyes_review_diff_report.`);
        }
    }
    for (const finding of findings) {
        if (((_b = finding.dynamic) === null || _b === void 0 ? void 0 : _b.justification) !== 'History')
            continue;
        const nodeId = typeof finding.area === 'string' ? finding.area : undefined;
        if (!nodeId)
            continue; // no node id to check history against — a rect-located finding can't be verified this way
        if (!verifyInvocation(stepScope, EYES_INSPECT_TOOLS.history, args => { var _a; return (_a = args.nodeIds) === null || _a === void 0 ? void 0 : _a.includes(nodeId); }, deps)) {
            throw new Error(`A finding claims dynamic.justification:"History" for node ${nodeId}, but eyes_inspect_history was never called for it. Call it first to gather the actual historical evidence.`);
        }
    }
    if (findings.some(finding => finding.dynamic)) {
        if (!verifyInvocation(stepScope, EYES_INSPECT_TOOLS.regions, () => true, deps)) {
            throw new Error('A finding proposes a dynamic.mask region fix, but eyes_inspect_regions was never called for this step. ' +
                'Call it first to see which regions are already in effect — a from-scratch mask could otherwise duplicate ' +
                "or nest inside one that's already there, and a replacement has to name the real stale region as its " +
                '`before`, not a guess at one.');
        }
        const maskFailure = await verifyMasksAgainstRegions({ sessionUrl, stepIndex, findings, keys });
        if (maskFailure) {
            const failing = findings[maskFailure.findingIndex];
            throw new Error(`Finding ${maskFailure.findingIndex} (area ${JSON.stringify(failing.area)}) proposes an invalid mask: ${maskFailure.reason}.`);
        }
    }
}
/**
 * Runs `fn` (a hard gate check — throws on rejection, resolves on success) and, only if it
 * throws, traces the rejection to `scopeId`'s own debug log before letting the same error
 * propagate unchanged: `toolName` as `label`, this call's own args as `input`, the thrown message
 * as `error`. A gate that passes logs nothing — this is a record of rejections, not every check.
 * `scopeId` can be whatever's natural to the caller (a batch id, a session id, anything below
 * it) — `log` (`review-core.js`) normalizes it down to the investigation's own root itself, so
 * every gate rejection anywhere within one investigation still consolidates into that
 * investigation's own single debug log rather than scattering across a file per level.
 */
async function withGateLog(toolName, scopeId, input, deps, fn) {
    try {
        return await fn();
    }
    catch (error) {
        countGateRejection();
        log(scopeId, toolName, { input, error: error instanceof Error ? error.message : String(error) }, deps);
        throw error;
    }
}
// ---------------------------------------------------------------------------
// The "no further action" doneMessage for each level's own _end — reached whenever that level
// is the last one for the current investigation (its own `rootScope`, or `batch_end` since it has
// no parent). Whichever _end call this happens to be is the final one for this investigation,
// so it's the point to have the calling model report to the user rather than just record data.
// ---------------------------------------------------------------------------
const ASK_TO_RESOLVE = ' Unless you are already resolving this investigation, ask the user whether to proceed to resolve the differences found.';
function finalDoneMessage(params) {
    const { rootScope, where, findingsCount, hasExampleLink, mentionEnvironment, runningSessionCount = 0, debugLogPath, } = params;
    const opener = `The review the user started at scope "${rootScope}" (${where}) is complete`;
    const parent = parentLevelOf(rootScope);
    const widenClause = parent
        ? ` Nothing further is needed unless the user wants a wider review; to widen it, call the tool named in review.widen.tool with review.widen.args unchanged (${EYES_REVIEW_TOOLS.progress} at scope "${parent}").`
        : ' This is the widest scope; nothing further is needed.';
    const runningClause = runningSessionCount > 0
        ? ` ${runningSessionCount} session(s) are still running and could not be reviewed. Mention this to the user and suggest re-running this review once those sessions complete, or are aborted manually, to review them too.`
        : '';
    const debugLogClause = ` This investigation's debug log is at ${debugLogPath}, for troubleshooting only — never mention it in ` +
        `the report above; reveal it only if the user explicitly asks where the log is.`;
    if (findingsCount === 0) {
        return `${opener} — no differences were found. Report this to the user.${widenClause}${runningClause}${debugLogClause}`;
    }
    const exampleClause = hasExampleLink
        ? ', each with its example link already folded into the summary text — reproduce it exactly, never strip it out,'
        : ',';
    const environmentClause = mentionEnvironment
        ? ' Call out any finding that occurs in one environment (browser/OS/viewport) but not others.'
        : '';
    return (`${opener}: ${findingsCount} finding${findingsCount === 1 ? '' : 's'}. Produce a report for the user, ordered: known bugs first (most severe first), then unexpected changes, then ` +
        `expected changes last — a finding that's both a known bug and an expected change is still a bug, so order it with the bugs. One entry per ` +
        `distinct diff (skip duplicates)${exampleClause} noting whether it's expected or a bug.${environmentClause}${ASK_TO_RESOLVE}${widenClause}${runningClause}${debugLogClause}`);
}
// ---------------------------------------------------------------------------
// One exported command function per (tool, scope) pair — `tools.ts` dispatches on `scope`
// and calls exactly one of these per handler, after resolving `rootScope`/`mode`/`keys`, and
// JSON-serializes whatever it returns.
// ---------------------------------------------------------------------------
/** Each level's indexed child findings — the block its `_end` validates `sources` against, read by its own `_progress` and by its last child's `_end`. */
const findingsBlock = {
    batch: (scopeId, deps) => attachFindingIndices(orderedChildFindingEntries(scopeId, deps)).map(([scenarioName, findings]) => ({ scenarioName, findings })),
    scenario: (scopeId, deps) => attachFindingIndices(orderedChildFindingEntries(scopeId, deps)).map(([sessionUrl, findings]) => ({ sessionUrl, findings })),
    session: (scopeId, deps) => attachFindingIndices(orderedChildFindingEntries(scopeId, deps)).map(([stepKey, findings]) => ({
        stepIndex: parseStepChildKey(stepKey),
        findings,
    })),
    step: (scopeId, deps) => attachFindingIndices(orderedChildFindingEntries(scopeId, deps)).map(([rectKey, findings]) => ({
        areaRect: parseDiffChildKey(rectKey),
        findings,
    })),
};
/** Parent links are thunks so a walk that compresses nothing resolves nothing — at the step edge, naming the parent costs a fetch. */
function batchAscent(batchUrl, rootScope, mode, deps) {
    const scopeId = batchScopeId(batchUrl);
    return {
        level: 'batch',
        scope: 'batch',
        scopeId,
        ctx: { batchUrl },
        endCall: reviewEndCall('batch', { batchUrl }, rootScope, mode),
        findings: () => findingsBlock.batch(scopeId, deps),
        clusters: () => sourceClustersFor(scopeId, deps),
    };
}
function scenarioAscent(batchUrl, scenarioName, rootScope, mode, deps) {
    const scopeId = scenarioScopeId(batchUrl, scenarioName);
    return {
        level: 'scenario',
        scope: 'scenario',
        scopeId,
        ctx: { batchUrl, scenarioName },
        endCall: reviewEndCall('scenario', { batchUrl, scenarioName }, rootScope, mode),
        findings: () => findingsBlock.scenario(scopeId, deps),
        clusters: () => sourceClustersFor(scopeId, deps),
        ...(hasReachedRootScope('scenario', rootScope)
            ? {}
            : {
                up: {
                    key: scenarioChildKey(scenarioName),
                    parent: async () => batchAscent(batchUrl, rootScope, mode, deps),
                },
            }),
    };
}
function sessionAscent(params) {
    const { sessionUrl, scenario, rootScope, mode, deps } = params;
    const scopeId = sessionScopeId(sessionUrl);
    return {
        level: 'session',
        scope: 'session',
        scopeId,
        ctx: { sessionUrl },
        endCall: reviewEndCall('session', { sessionUrl }, rootScope, mode),
        findings: () => findingsBlock.session(scopeId, deps),
        clusters: () => sourceClustersFor(scopeId, deps),
        ...(hasReachedRootScope('session', rootScope) ? {} : { up: { key: sessionChildKey(sessionUrl), parent: scenario } }),
    };
}
/** No `up` link on purpose: a step is never compressed, so the ascent stops here. */
function stepAscent(sessionUrl, stepIndex, rootScope, mode, deps) {
    const scopeId = stepScopeId(sessionUrl, stepIndex);
    return {
        level: 'step',
        scope: 'step',
        scopeId,
        ctx: { sessionUrl, stepIndex },
        endCall: reviewEndCall('step', { sessionUrl, stepIndex }, rootScope, mode),
        findings: () => findingsBlock.step(scopeId, deps),
        clusters: () => sourceClustersFor(scopeId, deps),
    };
}
function sourceClustersFor(scopeId, deps) {
    return buildSourceClusters(orderedChildFindingEntries(scopeId, deps));
}
async function batchProgress(params) {
    const { batchUrl, keys, rootScope, mode, restart, deps } = params;
    const scopeId = batchScopeId(batchUrl);
    await maybeDiscard(restart, 'batch', { batchUrl }, deps);
    await promoteAndRecordMode({ level: 'batch', scopeId, ctx: { batchUrl }, rootScope, mode, restart, keys, deps });
    const children = await batchChildren(batchUrl, keys, rootScope, mode, deps);
    return runProgress({
        level: 'batch',
        scopeId,
        rootScope,
        mode,
        children,
        descend: child => descentTarget('batch', { batchUrl }, child.key, rootScope, mode, deps).call,
        endCall: reviewEndCall('batch', { batchUrl }, rootScope, mode),
        buildFindings: () => findingsBlock.batch(scopeId, deps),
        deps,
    });
}
async function batchEnd(params) {
    const { batchUrl, findings, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = batchScopeId(batchUrl);
    await maybeDiscard(restart, 'batch', { batchUrl }, deps);
    await promoteAndRecordMode({ level: 'batch', scopeId, ctx: { batchUrl }, rootScope, mode, restart, keys, deps });
    const children = await batchChildren(batchUrl, keys, rootScope, mode, deps);
    const doneMessage = finalDoneMessage({
        rootScope: 'batch',
        where: `batch ${batchUrl}`,
        findingsCount: findings.length,
        hasExampleLink: true,
        mentionEnvironment: true,
        runningSessionCount: getUnreadyChildren(scopeId, deps).length,
        debugLogPath: debugLogPath(scopeId, deps),
    });
    const result = await runEnd({
        level: 'batch',
        toolName: EYES_REVIEW_TOOLS.end,
        scopeId,
        rootScope,
        rootScopeOmitted,
        ownChildren: children,
        finalize: verifyAndConsolidate(scopeId, batchScopeId(batchUrl), { batchUrl, findings }, findings, mode, deps),
        progressCall: reviewProgressCall('batch', { batchUrl }, rootScope, mode),
        getSiblings: async () => [],
        mode,
        doneMessage,
        deps,
    });
    return endResponse(result, mode);
}
async function scenarioProgress(params) {
    const { batchUrl, scenarioName, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = scenarioScopeId(batchUrl, scenarioName);
    const retryCall = reviewProgressCall('scenario', { batchUrl, scenarioName }, rootScope, mode);
    const midWalk = checkRootlessMidWalk({ level: 'scenario', scopeId, rootScopeOmitted, retryCall, restart, deps });
    if (midWalk)
        return { completed: null, next: midWalk };
    await maybeDiscard(restart, 'scenario', { batchUrl, scenarioName }, deps);
    const mismatch = checkParentModeMismatch('scenario', rootScope, batchScopeId(batchUrl), mode, retryCall, deps);
    if (mismatch)
        return { completed: null, next: mismatch };
    await promoteAndRecordMode({
        level: 'scenario',
        scopeId,
        ctx: { batchUrl, scenarioName },
        rootScope,
        mode,
        restart,
        keys,
        deps,
    });
    const children = await scenarioChildren(batchUrl, scenarioName, keys, rootScope, mode, deps);
    return runProgress({
        level: 'scenario',
        scopeId,
        rootScope,
        mode,
        children,
        descend: child => descentTarget('scenario', { batchUrl, scenarioName }, child.key, rootScope, mode, deps).call,
        endCall: reviewEndCall('scenario', { batchUrl, scenarioName }, rootScope, mode),
        buildFindings: () => findingsBlock.scenario(scopeId, deps),
        deps,
    });
}
async function scenarioEnd(params) {
    const { batchUrl, scenarioName, findings, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = scenarioScopeId(batchUrl, scenarioName);
    const retryCall = reviewEndCall('scenario', { batchUrl, scenarioName, findings }, rootScope, mode);
    const midWalk = checkRootlessMidWalk({ level: 'scenario', scopeId, rootScopeOmitted, retryCall, restart, deps });
    if (midWalk)
        return { next: midWalk };
    await maybeDiscard(restart, 'scenario', { batchUrl, scenarioName }, deps);
    const mismatch = checkParentModeMismatch('scenario', rootScope, batchScopeId(batchUrl), mode, retryCall, deps);
    if (mismatch)
        return { next: mismatch };
    await promoteAndRecordMode({
        level: 'scenario',
        scopeId,
        ctx: { batchUrl, scenarioName },
        rootScope,
        mode,
        restart,
        keys,
        deps,
    });
    const children = await scenarioChildren(batchUrl, scenarioName, keys, rootScope, mode, deps);
    const doneMessage = finalDoneMessage({
        rootScope: 'scenario',
        where: `scenario "${scenarioName}"`,
        findingsCount: findings.length,
        hasExampleLink: true,
        mentionEnvironment: true,
        runningSessionCount: getUnreadyChildren(scopeId, deps).length,
        debugLogPath: debugLogPath(scopeId, deps),
    });
    const result = await runEnd({
        level: 'scenario',
        toolName: EYES_REVIEW_TOOLS.end,
        scopeId,
        rootScope,
        rootScopeOmitted,
        ownChildren: children,
        finalize: verifyAndConsolidate(scopeId, batchScopeId(batchUrl), { batchUrl, scenarioName, findings }, findings, mode, deps),
        progressCall: reviewProgressCall('scenario', { batchUrl, scenarioName }, rootScope, mode),
        pushUpTo: { parentScopeId: batchScopeId(batchUrl), childKey: scenarioChildKey(scenarioName) },
        getSiblings: async () => (await batchChildren(batchUrl, keys, rootScope, mode, deps)).filter(s => s.scopeId !== scopeId),
        descend: sibling => descentTarget('batch', { batchUrl }, sibling.key, rootScope, mode, deps),
        parentProgressCall: reviewProgressCall('batch', { batchUrl }, rootScope, mode),
        ascent: () => batchAscent(batchUrl, rootScope, mode, deps),
        mode,
        doneMessage,
        deps,
    });
    return endResponse(result, mode);
}
// ---------------------------------------------------------------------------
// A queued session whose entity has genuinely stopped existing (deleted, merged, otherwise
// unfetchable) self-completes with a synthetic finding instead of leaving its parent scope's own
// completeness stuck forever on a child that can never succeed. Scoped to sessions only — the one
// level whose child is an independently-fetchable, independently-deletable real entity; a step is
// never independently missing (it's just an index into its still-fetchable session's own `steps`
// array), a scenario has no existence of its own to lose, and a changed area has no "does this
// still exist" signal distinct from its own eligibility check. Recording the completion at exactly
// the scope id the parent's own queue entry already points at (computable from the URL alone, no
// fetch required) is what makes this quiet: there's no parent to notify and nothing to look up,
// since the parent's existing `isCompleted` check on that exact id is already the only thing
// standing between it and completing.
// ---------------------------------------------------------------------------
function isMissingSessionError(error) {
    return error instanceof Error && /\b404\b/.test(error.message);
}
function missingSessionFinding(sessionUrl) {
    return {
        summary: `Session ${sessionUrl} could not be found — likely deleted, merged, or moved. Skipped.`,
        isExpected: null,
        isBug: null,
        example: sessionUrl,
    };
}
async function sessionProgress(params) {
    const { sessionUrl, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = sessionScopeId(sessionUrl);
    const retryCall = reviewProgressCall('session', { sessionUrl }, rootScope, mode);
    const midWalk = checkRootlessMidWalk({ level: 'session', scopeId, rootScopeOmitted, retryCall, restart, deps });
    if (midWalk)
        return { completed: null, next: midWalk };
    await maybeDiscard(restart, 'session', { sessionUrl }, deps);
    // Fetched before computing children (rather than going through the sessionChildren wrapper,
    // which would fetch it again) so the mode gate below can run — and, on a mismatch, exit —
    // before sessionStepChildren gets a chance to resolve any structural step as a side effect.
    let session;
    try {
        session = await fetchSteps(sessionUrl, keys);
    }
    catch (error) {
        if (!isMissingSessionError(error))
            throw error;
        const findings = [missingSessionFinding(sessionUrl)];
        const completion = recordCompletion(scopeId, findings, deps);
        return {
            completed: completion.completedAt,
            findings,
            next: {
                instruction: `Session ${sessionUrl} could not be found — likely deleted, merged, or moved. Report this to the user; nothing further to do here.`,
            },
        };
    }
    const mismatch = checkParentModeMismatch('session', rootScope, scenarioScopeIdForSession(sessionUrl, session.sessionName), mode, retryCall, deps);
    if (mismatch)
        return { completed: null, next: mismatch };
    await promoteAndRecordMode({ level: 'session', scopeId, ctx: { sessionUrl }, rootScope, mode, restart, keys, deps });
    const children = await sessionStepChildren({ sessionUrl, session, mode, keys, deps });
    return runProgress({
        level: 'session',
        scopeId,
        rootScope,
        mode,
        children,
        descend: child => descentTarget('session', { sessionUrl }, child.key, rootScope, mode, deps).call,
        endCall: reviewEndCall('session', { sessionUrl }, rootScope, mode),
        buildFindings: () => findingsBlock.session(scopeId, deps),
        deps,
    });
}
async function sessionEnd(params) {
    const { sessionUrl, findings, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = sessionScopeId(sessionUrl);
    const retryCall = reviewEndCall('session', { sessionUrl, findings }, rootScope, mode);
    const midWalk = checkRootlessMidWalk({ level: 'session', scopeId, rootScopeOmitted, retryCall, restart, deps });
    if (midWalk)
        return { next: midWalk };
    await maybeDiscard(restart, 'session', { sessionUrl }, deps);
    let session;
    try {
        session = await fetchSteps(sessionUrl, keys);
    }
    catch (error) {
        if (!isMissingSessionError(error))
            throw error;
        const missingFindings = [missingSessionFinding(sessionUrl)];
        recordCompletion(scopeId, missingFindings, deps);
        return {
            findings: missingFindings,
            next: {
                instruction: `Session ${sessionUrl} could not be found — likely deleted, merged, or moved. Report this to the user; nothing further to do here.`,
            },
        };
    }
    const { baseUrl, batchId, accountId } = await parseSessionUrlVerified(sessionUrl, keys);
    const batchUrl = buildBatchUrl({ baseUrl, batchId, accountId });
    const mismatch = checkParentModeMismatch('session', rootScope, scenarioScopeIdForSession(sessionUrl, session.sessionName), mode, retryCall, deps);
    if (mismatch)
        return { next: mismatch };
    await promoteAndRecordMode({ level: 'session', scopeId, ctx: { sessionUrl }, rootScope, mode, restart, keys, deps });
    const children = await sessionStepChildren({ sessionUrl, session, mode, keys, deps });
    const doneMessage = finalDoneMessage({
        rootScope: 'session',
        where: `session ${sessionUrl}`,
        findingsCount: findings.length,
        hasExampleLink: true,
        mentionEnvironment: false,
        debugLogPath: debugLogPath(scopeId, deps),
    });
    const result = await runEnd({
        level: 'session',
        toolName: EYES_REVIEW_TOOLS.end,
        scopeId,
        rootScope,
        rootScopeOmitted,
        ownChildren: children,
        finalize: verifyAndConsolidate(scopeId, sessionScopeId(sessionUrl), { sessionUrl, findings }, findings, mode, deps),
        progressCall: reviewProgressCall('session', { sessionUrl }, rootScope, mode),
        pushUpTo: {
            parentScopeId: scenarioScopeIdForSession(sessionUrl, session.sessionName),
            childKey: sessionChildKey(sessionUrl),
        },
        getSiblings: async () => (await scenarioChildren(batchUrl, session.sessionName, keys, rootScope, mode, deps)).filter(s => s.scopeId !== scopeId),
        descend: sibling => descentTarget('scenario', { batchUrl, scenarioName: session.sessionName }, sibling.key, rootScope, mode, deps),
        parentProgressCall: reviewProgressCall('scenario', { batchUrl, scenarioName: session.sessionName }, rootScope, mode),
        ascent: () => scenarioAscent(batchUrl, session.sessionName, rootScope, mode, deps),
        mode,
        doneMessage,
        deps,
    });
    return endResponse(result, mode);
}
const DOM_DIFF_OBTAINABLE_RECORD = 'stepProgress:domDiffObtainable';
/** Why this step can never yield a DOM diff, decided from session data ahead of any call; `fetchVisibleDomDiff`'s third case, `no-dom-data`, is only knowable from the server. */
function domDiffUnobtainableReason(step) {
    if (!step)
        return null;
    if (!step.baseline.domId)
        return 'it has no baseline DOM capture';
    if (!step.checkpoint.domId)
        return 'it has no checkpoint DOM capture';
    return null;
}
async function stepProgress(params) {
    var _a, _b;
    const { sessionUrl, stepIndex, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = stepScopeId(sessionUrl, stepIndex);
    const retryCall = reviewProgressCall('step', { sessionUrl, stepIndex }, rootScope, mode);
    const midWalk = checkRootlessMidWalk({ level: 'step', scopeId, sessionUrl, rootScopeOmitted, retryCall, restart, deps });
    if (midWalk)
        return { completed: null, next: midWalk };
    await maybeDiscard(restart, 'step', { sessionUrl, stepIndex }, deps);
    const mismatch = checkParentModeMismatch('step', rootScope, sessionScopeId(sessionUrl), mode, retryCall, deps);
    if (mismatch)
        return { completed: null, next: mismatch };
    await promoteAndRecordMode({
        level: 'step',
        scopeId,
        ctx: { sessionUrl, stepIndex },
        rootScope,
        mode,
        restart,
        keys,
        deps,
    });
    const children = await stepChildren(sessionUrl, stepIndex, keys, deps);
    const result = await runProgress({
        level: 'step',
        scopeId,
        rootScope,
        mode,
        children,
        descend: child => descentTarget('step', { sessionUrl, stepIndex }, child.key, rootScope, mode, deps).call,
        endCall: reviewEndCall('step', { sessionUrl, stepIndex }, rootScope, mode),
        buildFindings: () => findingsBlock.step(scopeId, deps),
        deps,
    });
    if (result.completed === null) {
        let unobtainable = null;
        if (!verifyInvocation(scopeId, EYES_INSPECT_TOOLS.domDiff, isExaminedDomDiff, deps)) {
            const alreadyLogged = verifyInvocation(scopeId, EYES_INSPECT_TOOLS.domDiff, args => {
                const reason = args.unobtainable;
                if (typeof reason !== 'string')
                    return false;
                unobtainable = reason;
                return true;
            }, deps);
            if (!alreadyLogged && !verifyInvocation(scopeId, DOM_DIFF_OBTAINABLE_RECORD, () => true, deps)) {
                unobtainable = domDiffUnobtainableReason((_a = (await fetchSteps(sessionUrl, keys)).steps) === null || _a === void 0 ? void 0 : _a[stepIndex]);
                if (unobtainable)
                    logInvocation(scopeId, EYES_INSPECT_TOOLS.domDiff, { unobtainable }, deps);
                else
                    logInvocation(scopeId, DOM_DIFF_OBTAINABLE_RECORD, {}, deps);
            }
        }
        if (unobtainable) {
            result.next.instruction += ` Do NOT call eyes_inspect_dom_diff for this step — ${unobtainable}, so no structural comparison is available. Review from the images alone, and record that the structural comparison was unavailable rather than that no structural change was found.`;
        }
        const calls = result.next.calls;
        if (((_b = calls === null || calls === void 0 ? void 0 : calls[0]) === null || _b === void 0 ? void 0 : _b.tool) === EYES_REVIEW_TOOLS.diffReport) {
            // Not a review tool, so it carries no rootScope/mode and is not built through `nextCall`.
            const unreviewed = incompleteAreaRects(children, deps);
            const evidence = evidenceRoundCall(sessionUrl, stepIndex, unreviewed);
            const batched = evidence.args.areaRects;
            calls[0].args.reports = batched.map(areaRect => ({ areaRect }));
            calls.unshift(evidence);
            result.next.instruction += ` Call ${EYES_INSPECT_TOOLS.evidence} ONCE, with the ${batched.length} areaRects the first call in next.calls already carries — not once per area, and do NOT pad them yourself; it returns the image diff and both baseline/checkpoint images for every area together, already padded and cropped.`;
            if (!unobtainable) {
                result.next.instruction += ` That same response carries this step's structural DOM diff and the match regions currently in effect, so ${EYES_INSPECT_TOOLS.domDiff} and ${EYES_INSPECT_TOOLS.regions} need no calls of their own here. Read the DOM diff regardless of how small or scattered the changed areas look — a visual crop comparison can miss small displacement it catches directly — and if its \`domDiff\` field reports anything other than a diff, follow that field's own \`next\` before reporting.`;
            }
            if (unreviewed.length > batched.length) {
                result.next.instruction += ` This step has ${unreviewed.length} unreviewed areas, more than one call can carry: review these ${batched.length} first, then call ${EYES_INSPECT_TOOLS.evidence} again for the rest.`;
            }
            result.next.instruction += ` Then report all ${batched.length} in ONE ${EYES_REVIEW_TOOLS.diffReport} call, not one call per area — the last call in next.calls already carries a \`reports\` entry per area, so fill in each entry's own findings. Per area: count the pink regions in its image diff, and if there is more than one, add an entry for each with its own smaller rect BEFORE that area's own full-areaRect entry — at most ${ENTRIES_PER_AREA - 1} such sub-rect entries per area, with any further pink regions reported as extra findings (each with its own \`area\`) inside the full-areaRect entry, which is what marks the area reviewed. Kept to that, a full round always fits one call; if a call would still pass ${MAX_DIFF_REPORT_BATCH} entries, split it at a full-areaRect boundary — every sub-rect entry stays in the same call as, and before, its own full-areaRect entry; areas deferred this way come back in the next response's \`reports\` on their own.`;
            // Masks are applied here, so the level rule has to arrive as a result the model reads now, not only as schema text.
            if (mode === 'resolve')
                result.next.instruction += ` ${MASK_LEVEL_RULE}`;
            // sameAs buys its way past the image gates with an examined dom diff, so a step with none can't use it.
            if (!unobtainable) {
                result.next.instruction +=
                    " Shortcut: if that response's DOM diff shows this exact structural change was recorded earlier in this scenario (another step of this session, or a sibling session in another browser/environment/viewport), set sameAs: {sessionUrl, stepIndex, areaRect} on that area's own reports entry, pointing at that prior call, and report from this step's own evidence without re-analysing the whole change.";
            }
        }
        else if (!unobtainable) {
            result.next.instruction += ` Call ${EYES_INSPECT_TOOLS.domDiff} for this step before ${EYES_REVIEW_TOOLS.end} — every area here is already reviewed, so no ${EYES_INSPECT_TOOLS.evidence} call is left to carry this step's structural DOM diff, and the step does not close until that diff is on record. Read it regardless of how small or scattered the changed areas look — a visual crop comparison can miss small displacement it catches directly.`;
        }
    }
    return result;
}
/** One evidence round: as many unreviewed areas as a single call can inline. A step with more is reviewed a round at a time, so no area is ever judged from paths alone. */
function evidenceRoundCall(sessionUrl, stepIndex, unreviewed) {
    return {
        tool: EYES_INSPECT_TOOLS.evidence,
        args: { sessionUrl, stepIndex, areaRects: unreviewed.slice(0, MAX_EVIDENCE_BATCH) },
    };
}
function hasEvidence(sessionUrl, stepIndex, areaRect, deps) {
    return verifyInvocation(stepScopeId(sessionUrl, stepIndex), EYES_INSPECT_TOOLS.evidence, args => rectsIntersect(args.areaRect, areaRect), deps);
}
/** Re-opens evidence for every area of the next round no earlier round covered — a half-reported round leaves seen and unseen areas side by side, and any unseen one would stall the step at its gate. */
function prependEvidenceRound(next, params) {
    const { sessionUrl, stepIndex, remaining, deps } = params;
    const unseen = remaining.filter(areaRect => !hasEvidence(sessionUrl, stepIndex, areaRect, deps));
    if (unseen.length === 0)
        return;
    next.calls.unshift(evidenceRoundCall(sessionUrl, stepIndex, unseen));
    next.instruction += ` ${unseen.length} of the ${remaining.length} areas left have no evidence yet: call ${EYES_INSPECT_TOOLS.evidence} ONCE with exactly the areaRects the first call in next.calls already carries — the other areas left already have theirs on record — then report all ${remaining.length} in the one ${EYES_REVIEW_TOOLS.diffReport} call.`;
}
async function stepEnd(params) {
    const { sessionUrl, stepIndex, findings, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = stepScopeId(sessionUrl, stepIndex);
    const retryCall = reviewEndCall('step', { sessionUrl, stepIndex, findings }, rootScope, mode);
    const midWalk = checkRootlessMidWalk({ level: 'step', scopeId, sessionUrl, rootScopeOmitted, retryCall, restart, deps });
    if (midWalk)
        return { next: midWalk };
    await maybeDiscard(restart, 'step', { sessionUrl, stepIndex }, deps);
    const mismatch = checkParentModeMismatch('step', rootScope, sessionScopeId(sessionUrl), mode, retryCall, deps);
    if (mismatch)
        return { next: mismatch };
    await promoteAndRecordMode({
        level: 'step',
        scopeId,
        ctx: { sessionUrl, stepIndex },
        rootScope,
        mode,
        restart,
        keys,
        deps,
    });
    await withGateLog(EYES_REVIEW_TOOLS.end, sessionScopeId(sessionUrl), { sessionUrl, stepIndex, findings, rootScope, mode }, deps, () => {
        if (!verifyInvocation(scopeId, EYES_INSPECT_TOOLS.domDiff, () => true, deps)) {
            throw new Error('eyes_inspect_dom_diff has not been called for this session+step yet. Call it before eyes_review_end for this step — it may reveal the diff is caused by element displacement rather than independent content changes.');
        }
    });
    const children = await stepChildren(sessionUrl, stepIndex, keys, deps);
    // Whatever this call decides is captured here so the response can state the outcome plainly
    // — `finalize` only runs when the call genuinely persists, so on the discarded path these
    // stay untouched and nothing is resolved.
    let action = null;
    let resolution = emptyRollup().resolution;
    const doneMessage = finalDoneMessage({
        rootScope: 'step',
        where: `stepIndex ${stepIndex} of session ${sessionUrl}`,
        findingsCount: findings.length,
        hasExampleLink: true,
        mentionEnvironment: false,
        debugLogPath: debugLogPath(scopeId, deps),
    });
    const result = await runEnd({
        level: 'step',
        toolName: EYES_REVIEW_TOOLS.end,
        scopeId,
        rootScope,
        rootScopeOmitted,
        ownChildren: children,
        finalize: async () => {
            const childFindings = flattenChildFindings(scopeId, deps);
            await withGateLog(EYES_REVIEW_TOOLS.end, sessionScopeId(sessionUrl), { sessionUrl, stepIndex, findings, rootScope, mode }, deps, () => verifySourcedFindings(expandSourceCitations(findings, sourceClustersFor(scopeId, deps)), childFindings));
            const cleanFindings = stripSources(findings);
            // Computed here rather than asked of the model (unlike the session/scenario/batch
            // levels' model-supplied `example`): sessionUrl/stepIndex are this call's own args and
            // areaRect is each finding's own field, so there's no representative instance to pick
            // and nothing for a model to transcribe wrong. `regions` likewise comes from what this
            // step's own diff-level reports actually did, per changed area.
            const { baseUrl, batchId, sessionId, accountId } = await parseSessionUrlVerified(sessionUrl, keys);
            const perArea = childRollups(scopeId, deps);
            const rollup = childRollupTotal(scopeId, deps);
            const findingsWithExamples = cleanFindings.map(finding => {
                var _a, _b;
                return ({
                    ...finding,
                    ...(mode === 'resolve' ? { regions: (_b = (_a = perArea[diffChildKey(finding.areaRect)]) === null || _a === void 0 ? void 0 : _a.regions) !== null && _b !== void 0 ? _b : [] } : {}),
                    example: buildDiffUrl({ baseUrl, batchId, sessionId, accountId, stepIndex, areaRect: finding.areaRect }),
                });
            });
            if (mode !== 'resolve') {
                return { findings: findingsWithExamples, rollup: { resolution: emptyRollup().resolution, regions: rollup.regions } };
            }
            const session = await fetchSteps(sessionUrl, keys);
            ({ action, resolution } = await decideOrCreditStepAction({
                sessionUrl,
                stepIndex,
                session,
                findings: cleanFindings,
                stepRegions: rollup.regions,
                keys,
                deps,
            }));
            return { findings: findingsWithExamples, rollup: { resolution, regions: rollup.regions } };
        },
        progressCall: reviewProgressCall('step', { sessionUrl, stepIndex }, rootScope, mode),
        pushUpTo: { parentScopeId: sessionScopeId(sessionUrl), childKey: stepChildKey(stepIndex) },
        getSiblings: async () => (await sessionChildren({ sessionUrl, keys, mode, deps })).filter(s => s.scopeId !== scopeId),
        descend: sibling => descentTarget('session', { sessionUrl }, sibling.key, rootScope, mode, deps),
        parentProgressCall: reviewProgressCall('session', { sessionUrl }, rootScope, mode),
        ascent: () => sessionAscent({
            sessionUrl,
            rootScope,
            mode,
            deps,
            scenario: async () => {
                const { sessionName } = await fetchSteps(sessionUrl, keys);
                const { baseUrl, batchId, accountId } = await parseSessionUrlVerified(sessionUrl, keys);
                return scenarioAscent(buildBatchUrl({ baseUrl, batchId, accountId }), sessionName, rootScope, mode, deps);
            },
        }),
        mode,
        doneMessage,
        deps,
    });
    if (result.persisted && mode === 'resolve') {
        result.next.instruction += ` ${describeStepOutcome(action, resolution)}`;
    }
    return endResponse(result, mode);
}
async function diffReport(params) {
    const { sessionUrl, stepIndex, areaRect, findings, sameAs, keys, rootScope, mode, restart, groupIndex, deps } = params;
    const scopeId = diffScopeId(sessionUrl, stepIndex, areaRect);
    await maybeDiscard(restart, 'diff', { sessionUrl, stepIndex, areaRect }, deps);
    const mismatch = checkParentModeMismatch('diff', rootScope, stepScopeId(sessionUrl, stepIndex), mode, nextCall(EYES_REVIEW_TOOLS.diffReport, { sessionUrl, stepIndex, reports: [{ areaRect, findings, sameAs }] }, rootScope, mode), deps);
    if (mismatch)
        return { next: mismatch };
    await promoteIfNeeded({
        level: 'diff',
        scopeId,
        ctx: { sessionUrl, stepIndex, areaRect },
        mode,
        restart,
        keys,
        deps,
    });
    // Recorded (unlike other leaf-adjacent bookkeeping) purely so a later promotion pass — reached
    // via this diff's parent step/session/etc. — can tell this scope was cached under `inspect`;
    // nothing else ever reads a diff's own mode as a "parent" the way every other level's children do.
    recordScopeMode(scopeId, mode, deps);
    await withGateLog(EYES_REVIEW_TOOLS.diffReport, sessionScopeId(sessionUrl), { sessionUrl, stepIndex, areaRect, findings, sameAs, rootScope, mode, groupIndex }, deps, () => verifyDiffReportHardGate(sessionUrl, stepIndex, areaRect, findings, sameAs, keys, deps));
    const result = await runEnd({
        // `diff` is a leaf with no completeness gate of its own (ownChildren is always empty,
        // so runEnd's soft-redirect path — the only place progressCall would surface — never
        // triggers here); it's still given a real, callable tool for type-shape consistency
        // with every other level's runEnd call.
        level: 'diff',
        toolName: EYES_REVIEW_TOOLS.diffReport,
        scopeId,
        rootScope,
        ownChildren: [],
        finalize: async () => {
            // §4 — the region work happens here, before anything is recorded, so a finding's own
            // `regions` always reflects what genuinely happened to the step's match regions.
            // In `mode: 'inspect'` the findings are recorded exactly as submitted — no region can
            // have changed, so there is no `regions` to report either.
            const reported = mode === 'resolve' ? await applyRegionMasking({ sessionUrl, stepIndex, findings, keys, deps }) : findings;
            // Recorded (and pushed up to the parent step), not returned as a separate field: a
            // durable breadcrumb so a later reader of the raw findings can tell this one was
            // fast-tracked. step_end's own description instructs stripping it back out once
            // findings are consolidated into a summary, so it never reaches the user-facing report.
            const withSameAsNote = sameAs
                ? reported.map(f => ({
                    ...f,
                    description: `${f.description} (sameAs: session ${sameAs.sessionUrl}, step ${sameAs.stepIndex}, area ${JSON.stringify(sameAs.areaRect)})`,
                }))
                : reported;
            return {
                findings: withSameAsNote,
                rollup: { resolution: emptyRollup().resolution, regions: mergeFindingRegions(withSameAsNote) },
            };
        },
        progressCall: reviewProgressCall('step', { sessionUrl, stepIndex }, rootScope, mode),
        pushUpTo: { parentScopeId: stepScopeId(sessionUrl, stepIndex), childKey: diffChildKey(areaRect) },
        getSiblings: async () => (await stepChildren(sessionUrl, stepIndex, keys, deps)).filter(s => s.scopeId !== scopeId),
        descend: sibling => descentTarget('step', { sessionUrl, stepIndex }, sibling.key, rootScope, mode, deps),
        parentProgressCall: reviewProgressCall('step', { sessionUrl, stepIndex }, rootScope, mode),
        ascent: () => stepAscent(sessionUrl, stepIndex, rootScope, mode, deps),
        mode,
        doneMessage: 'This changed area is recorded.',
        deps,
    });
    return { findings: result.findings, next: result.next };
}
// Sequential, not verify-all-then-apply-all: an entry may `sameAs` an area an earlier entry of this same call recorded, and in resolve mode its mask gate re-reads the regions earlier entries applied.
async function diffReportBatch(params) {
    var _a, _b;
    const { sessionUrl, stepIndex, reports, keys, rootScope, rootScopeOmitted, mode, restart, deps } = params;
    const scopeId = stepScopeId(sessionUrl, stepIndex);
    const midWalk = checkRootlessMidWalk({
        level: 'diff',
        scopeId,
        sessionUrl,
        rootScopeOmitted,
        retryCall: nextCall(EYES_REVIEW_TOOLS.diffReport, { sessionUrl, stepIndex, reports }, rootScope, mode),
        restart,
        deps,
    });
    if (midWalk)
        return { groups: [], next: midWalk };
    const groups = [];
    let last;
    for (const [groupIndex, report] of reports.entries()) {
        try {
            last = await diffReport({
                sessionUrl,
                stepIndex,
                areaRect: report.areaRect,
                findings: report.findings,
                sameAs: report.sameAs,
                keys,
                rootScope,
                mode,
                restart,
                groupIndex,
                deps,
            });
        }
        catch (error) {
            throw new Error(await batchStopMessage({
                sessionUrl,
                stepIndex,
                reports,
                groupIndex,
                reason: error instanceof Error ? error.message : String(error),
                mode,
                keys,
                deps,
            }));
        }
        // A mode-mismatch redirect persisted nothing and re-routes the whole call, so the entries after it are not this call's to process either.
        if (last.findings === undefined) {
            const next = last.next;
            for (const call of (_b = (_a = next.calls) === null || _a === void 0 ? void 0 : _a.filter(c => c.tool === EYES_REVIEW_TOOLS.diffReport)) !== null && _b !== void 0 ? _b : []) {
                call.args.reports = reports.slice(groupIndex);
            }
            return { groups, next };
        }
        groups.push({ areaRect: report.areaRect, findings: last.findings });
    }
    const next = last.next;
    await widenToRemainingAreas(next, { sessionUrl, stepIndex, keys, deps });
    return { groups, next };
}
/** The changed areas of a step still unreviewed — the only list a `next` or a retry instruction may name. */
function incompleteAreaRects(children, deps) {
    return children.filter(child => !isCompleted(child.scopeId, deps)).map(child => parseDiffChildKey(child.key));
}
// Re-derived from the phase tracker, never by subtracting what the model just submitted, so an area dropped from one round's `reports` resurfaces in the next.
async function widenToRemainingAreas(next, params) {
    var _a, _b;
    const { sessionUrl, stepIndex, keys, deps } = params;
    const calls = (_b = (_a = next.calls) === null || _a === void 0 ? void 0 : _a.filter(call => call.tool === EYES_REVIEW_TOOLS.diffReport)) !== null && _b !== void 0 ? _b : [];
    if (calls.length === 0)
        return;
    const children = await stepChildren(sessionUrl, stepIndex, keys, deps);
    const remaining = incompleteAreaRects(children, deps).slice(0, MAX_EVIDENCE_BATCH);
    const reports = remaining.map(areaRect => ({ areaRect }));
    for (const call of calls)
        call.args.reports = reports;
    prependEvidenceRound(next, { sessionUrl, stepIndex, remaining, deps });
}
/** The one accounting a stopped batch owes the model: what stuck, what failed and why, and what to send back. */
async function batchStopMessage(params) {
    const { sessionUrl, stepIndex, reports, groupIndex, reason, mode, keys, deps } = params;
    const children = await stepChildren(sessionUrl, stepIndex, keys, deps);
    const remaining = incompleteAreaRects(children, deps).slice(0, MAX_EVIDENCE_BATCH);
    const recorded = groupIndex > 0 ? ` reports[0..${groupIndex - 1}] are recorded and stay recorded — do NOT send them again.` : '';
    const applied = groupIndex > 0 && mode === 'resolve'
        ? " Their region changes are already applied — and propagated to this session's other steps and to this scenario's sibling sessions — exactly as each recorded finding's `regions` says; nothing reaches the baseline before eyes_resolve_save."
        : '';
    const unprocessed = groupIndex + 1 < reports.length ? ` reports[${groupIndex + 1}..${reports.length - 1}] were not processed.` : '';
    return (`reports[${groupIndex}] (areaRect ${JSON.stringify(reports[groupIndex].areaRect)}) was rejected: ${reason}${recorded}${applied}${unprocessed}` +
        ` Call ${EYES_REVIEW_TOOLS.diffReport} again with one entry for each of these still-unreviewed areas, and no others: ` +
        `${JSON.stringify(remaining)}. That list is this step's live state — use it rather than reconstructing one from what you just sent.`);
}

// The review tools — `eyes_review_progress`/`eyes_review_end`, each parametric over `scope`
// ∈ batch/scenario/session/step, plus `eyes_review_diff_report` for each of a step's changed areas
// — tracking and verifying progress through a batch review on top of the `eyes_inspect_*` data
// tools, and (in `mode: 'resolve'`) acting on what it finds. `eyes_review_progress` recomputes
// completeness live on every call; `eyes_review_end` persists findings once complete, pushing them
// up into its parent's own accumulated record so they survive a child later dropping out of its
// parent's live-children set; `rootScope` bounds how far `next` ever escalates, so a request scoped to
// one entity never leads the model into its siblings or ancestors — it never decides whether findings
// are pushed up; `mode` decides whether the traversal also resolves what it reports.
//
// This is a thin registration layer over `commands.ts`, in the same shape as
// `eyes-inspect/tools.ts`/`eyes-resolve/tools.ts`: Zod schemas, descriptions, and handlers that
// resolve `keys`/`rootScope`/`mode`, then dispatch on `scope` to exactly one `commands.ts`
// function. `reviewApiKeyProvider` only ever resolves a write key when `mode` resolves to
// `'resolve'` — a caller using `mode: 'inspect'` throughout never needs `APPLITOOLS_WRITE_KEY`
// configured at all.
const NO_EARLY_REPORT = " Do not report findings or conclusions to the user before this review's own eyes_review_end call reports completion.";
const RESOLVE_MODE_NOTE = ' In mode "resolve" this additionally acts on what it finds: dynamic content is masked with a match region as each ' +
    'diff is reported, and each step is accepted/rejected/left-unresolved deterministically from its own findings — the ' +
    "response's top-level `resolution` and `regions` tallies, plus each finding's own `regions` detail, report exactly " +
    'what happened.';
const PROGRESS_DESC = 'Tracks progress investigating whatever `scope` names — see its own description for what each one investigates ' +
    'and which arguments it takes. ALWAYS call this to initiate test results inspection at that level, and ALWAYS ' +
    `follow its \`next\` field for what to call next.${NO_EARLY_REPORT}${RESOLVE_MODE_NOTE}`;
const END_DESC = 'Records the deduplicated findings summary for whatever `scope` names, once eyes_review_progress for that same ' +
    "scope reports every one of its children reviewed — see `scope`'s own description for what each one " +
    'records, and `findings` for the shape each one takes. Discarded (not an error) if called too early. Always follow ' +
    'the returned `next` field — it tells you exactly what to do, whether that means retrying via eyes_review_progress, ' +
    'reviewing another entity at this same level, moving up to the level above, or the investigation is now fully ' +
    'reviewed.';
/** The ids each `scope` requires, for the rejection message when one is missing. */
const REQUIRED_IDS = {
    batch: 'batchUrl',
    scenario: 'batchUrl and scenarioName',
    session: 'sessionUrl',
    step: 'sessionUrl and stepIndex',
};
function requireId(value, name, scope) {
    if (value === undefined) {
        countGateRejection();
        throw new Error(`scope "${scope}" requires ${REQUIRED_IDS[scope]} — ${name} is missing. Call again with it.`);
    }
    return value;
}
/** Which of the two findings shapes each `scope` takes, for the rejection message below. */
const REQUIRED_FINDINGS = {
    batch: 'one summary per finding, each with its own example link',
    scenario: 'one summary per finding, each with its own example link',
    session: 'one summary per finding, each with its own example link',
    step: 'one consolidated summary per changed area, each with its own areaRect',
};
/**
 * Re-validates `eyes_review_end`'s `findings` against the one shape this call's own `scope`
 * takes — the input schema can only say "one of the two shapes" (see `ReviewEndFindingsShape`), so
 * submitting the other level's shape has to be caught here rather than by the schema.
 */
function findingsFor(shape, findings, scope) {
    const parsed = shape.safeParse(findings);
    if (!parsed.success) {
        countGateRejection();
        throw new Error(`findings must be the ${REQUIRED_FINDINGS[scope]} — see findings' own description for both shapes. ` +
            `What was submitted does not match it: ${formatZodIssues(parsed.error)}.`);
    }
    return parsed.data;
}
function formatZodIssues(error) {
    return error.issues.map(issue => `${issue.path.join('.') || 'value'}: ${issue.message}`).join('; ');
}
/**
 * Validates an argument already resolved from JsonFileArgShape (inline value or file contents)
 * against the one shape it must take — unlike `findingsFor`, there's no scope-dependent branching here.
 */
function parseResolvedArg(shape, value, argName) {
    const parsed = shape.safeParse(value);
    if (!parsed.success) {
        countGateRejection();
        throw new Error(`${argName} does not match the expected shape: ${formatZodIssues(parsed.error)}.`);
    }
    return parsed.data;
}
/** Resolves a JsonFileArgShape-eligible argument: reads and parses it if the model sent a file path instead of the array inline. */
async function resolveJsonArg(raw, argName) {
    if (typeof raw !== 'string')
        return raw;
    let contents;
    try {
        contents = await promises.readFile(raw, 'utf-8');
    }
    catch (err) {
        throw new Error(`${argName} named a file path ("${raw}") that could not be read: ${err.message}`);
    }
    try {
        return JSON.parse(contents);
    }
    catch (err) {
        throw new Error(`${argName}'s file ("${raw}") is not valid JSON: ${err.message}`);
    }
}
function recordReviewCall(scopeType, mode) {
    recordToolTelemetry({ chain_source: 'review', scope_type: scopeType, mode });
}
/** The args every scope's own arm passes identically, once its own id(s) are resolved. */
function commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps) {
    return { keys: reviewApiKeyProvider(url, mode), rootScope, rootScopeOmitted, mode, restart, deps };
}
/** `review` leads every review-family response so `next` stays the last key; an `_end` at its root supplies `reachedRoot`/`widen`/`enclosing`. */
function withReviewField(result, scope, rootScope, mode) {
    const { review: atRoot, ...rest } = result;
    const review = { rootScope, mode, scope, reachedRoot: false, ...atRoot };
    return { review, ...rest };
}
function registerReviewTools(server, deps = defaultPhaseTrackerDeps) {
    server.registerTool(EYES_REVIEW_TOOLS.progress, {
        description: PROGRESS_DESC,
        inputSchema: {
            scope: ProgressScopeShape,
            ...REVIEW_SCOPE_ID_SHAPES,
            rootScope: RootScopeShape,
            mode: ModeShape,
            restart: RestartShape,
        },
    }, async ({ scope, batchUrl, scenarioName, sessionUrl, stepIndex, rootScope: rawRootScope, mode: rawMode, restart }) => {
        const rootScope = resolveRootScope(scope, rawRootScope);
        const rootScopeOmitted = rawRootScope === undefined;
        const mode = resolveMode(rawMode);
        recordReviewCall(scope, mode);
        const result = await (async () => {
            switch (scope) {
                case 'batch': {
                    const url = requireId(batchUrl, 'batchUrl', scope);
                    return batchProgress({ batchUrl: url, ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps) });
                }
                case 'scenario': {
                    const url = requireId(batchUrl, 'batchUrl', scope);
                    const name = requireId(scenarioName, 'scenarioName', scope);
                    return scenarioProgress({
                        batchUrl: url,
                        scenarioName: name,
                        ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps),
                    });
                }
                case 'session': {
                    const url = requireId(sessionUrl, 'sessionUrl', scope);
                    return sessionProgress({
                        sessionUrl: url,
                        ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps),
                    });
                }
                case 'step': {
                    const url = requireId(sessionUrl, 'sessionUrl', scope);
                    const index = requireId(stepIndex, 'stepIndex', scope);
                    return stepProgress({
                        sessionUrl: url,
                        stepIndex: index,
                        ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps),
                    });
                }
            }
        })();
        return textResult(JSON.stringify(withReviewField(result, scope, rootScope, mode), null, 2));
    });
    server.registerTool(EYES_REVIEW_TOOLS.end, {
        description: END_DESC,
        inputSchema: {
            scope: EndScopeShape,
            ...REVIEW_SCOPE_ID_SHAPES,
            findings: zod.z.union([ReviewEndFindingsShape, JsonFileArgShape]),
            rootScope: RootScopeShape,
            mode: ModeShape,
            restart: RestartShape,
        },
    }, async ({ scope, batchUrl, scenarioName, sessionUrl, stepIndex, findings: rawFindingsArg, rootScope: rawRootScope, mode: rawMode, restart, }) => {
        const rootScope = resolveRootScope(scope, rawRootScope);
        const rootScopeOmitted = rawRootScope === undefined;
        const mode = resolveMode(rawMode);
        recordReviewCall(scope, mode);
        const rawFindings = await resolveJsonArg(rawFindingsArg, 'findings');
        const summaryFindings = () => findingsFor(SummaryExampleShape, rawFindings, scope);
        const result = await (async () => {
            switch (scope) {
                case 'batch': {
                    const url = requireId(batchUrl, 'batchUrl', scope);
                    return batchEnd({
                        batchUrl: url,
                        findings: summaryFindings(),
                        ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps),
                    });
                }
                case 'scenario': {
                    const url = requireId(batchUrl, 'batchUrl', scope);
                    const name = requireId(scenarioName, 'scenarioName', scope);
                    return scenarioEnd({
                        batchUrl: url,
                        scenarioName: name,
                        findings: summaryFindings(),
                        ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps),
                    });
                }
                case 'session': {
                    const url = requireId(sessionUrl, 'sessionUrl', scope);
                    return sessionEnd({
                        sessionUrl: url,
                        findings: summaryFindings(),
                        ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps),
                    });
                }
                case 'step': {
                    const url = requireId(sessionUrl, 'sessionUrl', scope);
                    const index = requireId(stepIndex, 'stepIndex', scope);
                    const stepFindings = findingsFor(StepEndFindingsShape, rawFindings, scope);
                    return stepEnd({
                        sessionUrl: url,
                        stepIndex: index,
                        findings: stepFindings,
                        ...commonArgs(url, rootScope, rootScopeOmitted, mode, restart, deps),
                    });
                }
            }
        })();
        return textResult(JSON.stringify(withReviewField(result, scope, rootScope, mode), null, 2));
    });
    // --- Diff (leaf) -------------------------------------------------------------
    server.registerTool(EYES_REVIEW_TOOLS.diffReport, {
        description: "Records the rich per-diff evidence for the changed areas of one step — one `reports` entry per area, every unreviewed area of the step in a single call, and every finding fully specified for its claimed category. Each entry is verified on its own, against its own areaRect: it hard-throws if eyes_inspect_evidence wasn't actually fetched for that areaRect, a finding claims dynamic.justification:\"History\" with no matching eyes_inspect_history call, a finding proposes a dynamic.mask fix with no eyes_inspect_regions call for this step, its mask's `before` doesn't match a region actually in effect right now, or its mask's `after` doesn't cover the finding's own area. Entries are processed in order and stop at the first rejection — the ones before it stay recorded, and the error names exactly which areas to send back. If an area is the exact same underlying change as an area already recorded in the same scenario, set its entry's `sameAs` instead of redoing the full trio — see its own description. In mode \"resolve\" each finding's `dynamic.mask` is turned into an actual checkpoint match-region change right here — `mask.after.area`, if left null/omitted, defaults to the finding's own `area` — and the response reports per finding what was added/adjusted (or why it could not be), on `regions` and appended to `description`. Always follow the returned `next` field — it tells you exactly what to do next, whether that's reporting more changed areas or moving up to the step level.",
        inputSchema: {
            sessionUrl: zod.z.string().describe(SESSION_URL_DESC),
            stepIndex: zod.z.number().int().nonnegative().describe(STEP_INDEX_DESC),
            reports: zod.z.union([DiffReportsShape, JsonFileArgShape]),
            rootScope: RootScopeShape,
            mode: ModeShape,
            restart: RestartShape,
        },
    }, async ({ sessionUrl, stepIndex, reports: rawReportsArg, rootScope: rawRootScope, mode: rawMode, restart }) => {
        const rootScope = resolveRootScope('diff', rawRootScope);
        const rootScopeOmitted = rawRootScope === undefined;
        const mode = resolveMode(rawMode);
        recordReviewCall('diff', mode);
        const keys = reviewApiKeyProvider(sessionUrl, mode);
        const rawReports = await resolveJsonArg(rawReportsArg, 'reports');
        const reports = parseResolvedArg(DiffReportsShape, rawReports, 'reports');
        const result = await diffReportBatch({
            sessionUrl,
            stepIndex,
            reports,
            keys,
            rootScope,
            rootScopeOmitted,
            mode,
            restart,
            deps,
        });
        return textResult(JSON.stringify(withReviewField(result, 'diff', rootScope, mode), null, 2));
    });
}

/** Derived from the family name maps — not hand-copied — so a newly added family tool can't be missed. */
const FAMILY_TOOL_NAMES = [EYES_INSPECT_TOOLS, EYES_RESOLVE_TOOLS, EYES_REVIEW_TOOLS].flatMap(family => Object.values(family));
/** Tools registered only in experimental mode (`EXPERIMENTAL_ENV`). Add a name here to ship a tool behind the flag. */
const EXPERIMENTAL_TOOLS = [];
function skippedToolNames(experimental) {
    return new Set(experimental ? [] : EXPERIMENTAL_TOOLS);
}
function filteredRegistrar(inner, skipped) {
    const registerTool = (name, config, handler) => {
        if (skipped.has(name))
            return;
        return inner.registerTool(name, config, handler);
    };
    return { registerTool };
}
/**
 * Registers the server's tool set for the mode chosen at process start: the native tools plus the
 * three tool families, minus whatever `skippedToolNames` hides in this mode.
 */
function registerAllTools(server, experimental) {
    const skipped = skippedToolNames(experimental);
    Object.values(ALL_TOOLS).forEach(tool => {
        if (skipped.has(tool.name))
            return;
        server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputSchema }, tool.handler);
    });
    // The families register themselves; the instrumented registrar gives their handlers the same
    // createToolHandler wrapping as the tools above, and the filter drops the skipped names.
    const registrar = filteredRegistrar(instrumentedRegistrar(server), skipped);
    registerEyesInspectDataTools(registrar);
    registerEyesResolveTools(registrar);
    registerReviewTools(registrar);
    registerEyesInspectResources(server);
}
/** Derived from the same name sources as registration, so the startup log can't drift. */
function registeredToolNames(experimental) {
    const skipped = skippedToolNames(experimental);
    return [...Object.values(TOOL_NAMES), ...FAMILY_TOOL_NAMES].filter(name => !skipped.has(name));
}

async function startServer() {
    loadEnvOnce(process.cwd(), 'server startup');
    const experimental = parseExperimental(process.env);
    const server = new mcp_js.McpServer({
        name: 'applitools-mcp',
        version: packageJson.version,
        description: 'Applitools MCP server for AI coding assistants - provides visual testing capabilities',
        websiteUrl: 'https://applitools.com',
        icons: [
            {
                src: '../assets/applitools-icon-logo-light.png',
                mimeType: 'image/png',
                sizes: ['128x128'],
                theme: 'light',
            },
            {
                src: '../assets/applitools-icon-logo-dark.png',
                mimeType: 'image/png',
                sizes: ['128x128'],
                theme: 'dark',
            },
        ],
    }, {
        capabilities: {
            tools: {
                listChanged: true,
            },
            resources: {
                subscribe: false,
                listChanged: false,
            },
        },
    });
    server.server.oninitialized = () => {
        var _a;
        const clientInfo = server.server.getClientVersion();
        setClientInfo(clientInfo);
        setIDE(parseIDE(process.env, process.argv));
        log$2('info', '[MCP Server] Client connected:', {
            name: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.name) || 'unknown',
            version: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.version) || 'unknown',
            description: clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.description,
            websiteUrl: clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.websiteUrl,
        });
        externalLog('mcp_client_connected', {
            client_name: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.name) || 'unknown',
            client_version: (clientInfo === null || clientInfo === void 0 ? void 0 : clientInfo.version) || 'unknown',
            transport_mode: TRANSPORT_MODE,
        }).catch(error => {
            throw error;
        });
        // The server's cwd is rarely the user's project (IDEs launch it via bare `npx`), so ask the
        // client for its workspace roots and pick up the project's `.env` from there.
        if ((_a = server.server.getClientCapabilities()) === null || _a === void 0 ? void 0 : _a.roots) {
            server.server
                .listRoots()
                .then(({ roots }) => {
                const root = roots.find(r => r.uri.startsWith('file://'));
                if (root)
                    loadEnvOnce(node_url.fileURLToPath(root.uri), 'client roots');
            })
                .catch(error => log$2('debug', '[MCP Server] roots/list failed:', error));
        }
    };
    registerAllTools(server, experimental);
    server.registerResource('documentation', RESOURCE_URIS.DOCUMENTATION_README, {
        title: RESOURCE_METADATA.DOCUMENTATION_README.title,
        description: RESOURCE_METADATA.DOCUMENTATION_README.description,
        mimeType: RESOURCE_METADATA.DOCUMENTATION_README.mimeType,
    }, async (uri) => {
        try {
            const result = await readDocumentationResource(uri.href);
            return result;
        }
        catch (error) {
            log$2('error', '[MCP Server] Resource documentation read failed:', error);
            throw error;
        }
    });
    log$2('info', '[MCP Server] Registered resources: documentation');
    const credentialsLoaded = loadAndStoreCredentials();
    if (credentialsLoaded) {
        log$2('info', '[MCP Server] Credentials loaded from config/environment for stdio mode');
    }
    const transport = new stdio_js.StdioServerTransport();
    await server.connect(transport);
    log$2('info', '[MCP Server] Applitools MCP Server started successfully (Stdio Mode)');
    log$2('info', `[MCP Server] Experimental tools ${experimental ? 'enabled' : 'disabled'}`);
    log$2('info', `[MCP Server] Available tools: ${registeredToolNames(experimental).join(', ')}`);
    log$2('info', `[MCP Server] Available resources: documentation (${RESOURCE_URIS.DOCUMENTATION_README})`);
}
process.on('SIGINT', () => {
    log$2('info', '[MCP Server] Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    log$2('info', '[MCP Server] Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
const REJECTION_LOG_THROTTLE_MS = 1000;
/** Exported for unit testing — allows injecting a spy in place of the real log function. */
function makeThrottledRejectionHandler(logFn, throttleMs = REJECTION_LOG_THROTTLE_MS) {
    let lastLogTime = 0;
    let suppressedCount = 0;
    return (reason) => {
        const now = Date.now();
        if (now - lastLogTime >= throttleMs) {
            if (suppressedCount > 0) {
                logFn(`[MCP Server] ${suppressedCount} unhandled rejections suppressed`);
                suppressedCount = 0;
            }
            logFn('[MCP Server] Unhandled rejection:', reason);
            lastLogTime = now;
        }
        else {
            suppressedCount++;
        }
    };
}
process.on('unhandledRejection', makeThrottledRejectionHandler((...args) => log$2('error', ...args)));
process.on('uncaughtException', error => {
    if (error.code === 'EPIPE') {
        process.stderr.write('[MCP Server] Client disconnected (EPIPE), shutting down gracefully...\n');
        process.exit(0);
    }
    log$2('error', '[MCP Server] Uncaught Exception:', error);
});

startServer().catch(error => {
    log$2('error', '[MCP Server] Failed to start Applitools Eyes MCP server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
