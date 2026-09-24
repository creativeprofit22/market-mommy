# Local developer interfaces (fixture-only)

`gg-coder-mcp.json` is **one MCPServerConfig example object**, not an installed host configuration. It is disabled and every path is deliberately nonfunctional until edited. On Windows use absolute drive paths (for example `E:/...`); on POSIX use absolute `/...` paths. Select the existing pinned Node 24.21.0 executable. Keep `shared: false`. No host registration has been performed or authorized by this example. Do not copy a real credential or inherited environment into it.

After `npm run build`, invoke with absolute executable, compiled script and local store paths, independently of cwd:

```text
/absolute/node-24.21.0/bin/node /absolute/market-mommy/dist/src/interfaces/cli.js --store /absolute/fixtures.sqlite
/absolute/node-24.21.0/bin/node /absolute/market-mommy/dist/src/interfaces/mcp.js --store /absolute/fixtures.sqlite --capabilities read
```

From this package under the pinned runtime, convenience equivalents are `npm run --silent cli -- --store /absolute/fixtures.sqlite` and `npm run --silent mcp -- --store /absolute/fixtures.sqlite`. For host STDIO configuration prefer the direct executable/script command, not npm (which may emit its own diagnostics). The launcher resolves the compiled script relative to itself. Build first; it does not compile at launch.

The only startup flags are required `--store ABSOLUTE_LOCAL_PATH` and optional `--capabilities COMMA_SEPARATED_LIST`. The default is `read`. Explicit allowed grants are `read`, `fixture-write`, `fixture-run`, and `cancel`; a supplied list replaces the default. Example trusted fixture scope: `--capabilities read,fixture-write,fixture-run,cancel`. These are OS-owner launch decisions, never request/tool arguments. Read-only means domain authorization, not a SQLite read-only connection: normal open/migrations can create or migrate the selected database.

CLI consumes one JSON command document from stdin, ending at EOF. It caps received bytes at 256 KiB before parsing, with a fixed five-second total input wait (TTY and slow trickles included). Example read command: `{"action":"resumeJourney","journeyId":"journey-1"}`. It writes exactly one shared result envelope and newline to stdout, with exit 0 for success and 1 for errors. Output backpressure also has a five-second ceiling. Malformed/oversize input uses fixed safe domain errors, never raw exceptions.

MCP uses the installed SDK's STDIO transport and initialization/tool protocol. `tools/list` derives strict schemas from the shared command union with `action` removed. Tool names are those action names; `tools/call` arguments contain the remaining command fields. Its text content is the same JSON result envelope as CLI, with `isError` for domain errors. Unavailable actions retain shared typed policy/unavailable results; tools do not invent advice. Tool arguments cannot supply `action`, a store path, capability scope, credentials, destinations or administrative commands.

The SDK read-buffer ceiling is explicitly 256 KiB, checked before SDK JSON parsing; a coalesced chunk plus pending partial frame over that ceiling is also rejected, even if individual frames would fit. There are at most 16 outstanding protocol requests, 16 queued application dispatches, and 8 MiB outstanding serialized output. Slow output is terminated after five seconds. Protocol/limit failures close the session with a fixed stderr diagnostic, never raw errors. STDOUT is JSON-RPC only. Idle MCP sessions may wait for requests; CLI input may not wait indefinitely.

Both interfaces serialize dispatch through the **same `SqliteStorage.dispatch`**, including shared schema, authorization, receipts, reference validation and transactions. SIGINT/SIGTERM close storage; MCP EOF closes the transport and drains accepted dispatches before storage shutdown. No framework child is started by either adapter. `enqueueJob` only preserves a shared durable queue; `cancelJob` is scoped. To execute fixtures, a separately trusted application must explicitly call the existing `runNextFixture(storage, { signal })` API from `dist/src/adapters/ggframework/runner.js` using its owned storage. There is no autoexecute, runner flag or retry/reconcile/delete/restore tool.

Local test seams: `createApplication({ storePath, capabilities })` in `dist/src/composition.js` returns only async `dispatch(json)` and `close()`. `createMcpServer(app)` and `callDomainTool(app, name, args)` in `dist/src/interfaces/mcp.js` use that facade. Compare persisted receipt replays or alternate adapters against the same store; there is no request-supplied clock/deadline override.

Verification boundary: actual CLI subprocess and MCP SDK protocol tests pass for parity, hostile input, scope enforcement and lifecycle cleanup on Windows. See [current verification](../docs/foundation-verification.md) for evidence and remaining gates. No GG Coder host connection, live provider, beginner UI or Linux execution is claimed here.
