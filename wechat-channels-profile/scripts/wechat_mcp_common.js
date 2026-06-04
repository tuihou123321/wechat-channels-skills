const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_MCP_URL = "https://mcp.tikhub.io/wechat/mcp";
const RESOLVE_IPS = ["104.26.2.227", "104.26.3.227", "172.67.75.115"];

function readWechatMcpConfig() {
  const envToken = process.env.TIKHUB_WECHAT_MCP_TOKEN || process.env.TIKHUB_MCP_TOKEN || "";
  if (envToken.trim()) {
    return {
      token: envToken.replace(/^Bearer\s+/i, "").trim(),
      url: process.env.TIKHUB_WECHAT_MCP_URL || DEFAULT_MCP_URL,
    };
  }

  const configPath = path.join(os.homedir(), ".codex", "config.toml");
  if (!fs.existsSync(configPath)) {
    throw new Error("Missing TikHub token. Set TIKHUB_WECHAT_MCP_TOKEN or configure [mcp_servers.tikhub-wechat] in ~/.codex/config.toml");
  }
  const text = fs.readFileSync(configPath, "utf8");
  const block = text.match(/\[mcp_servers\.tikhub-wechat\][\s\S]*?(?=\n\[mcp_servers\.|$)/);
  if (!block) throw new Error(`Missing TikHub token. Set TIKHUB_WECHAT_MCP_TOKEN or add [mcp_servers.tikhub-wechat] in ${configPath}`);
  const auth = block[0].match(/Authorization: Bearer ([^"\]]+)/);
  if (!auth) throw new Error("Missing tikhub-wechat Authorization bearer token in Codex config");
  const url = block[0].match(/https:\/\/mcp\.tikhub\.io\/wechat\/mcp/);
  return { token: auth[1], url: url ? url[0] : DEFAULT_MCP_URL };
}

function tmpFile(prefix) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wechat-channels-")), prefix);
}

function curl(args, opts = {}) {
  const result = spawnSync("curl", args, {
    encoding: opts.encoding || "utf8",
    maxBuffer: opts.maxBuffer || 1024 * 1024 * 40,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`curl failed (${result.status}): ${err}`);
  }
  return result;
}

function curlWithResolve(baseArgs, opts = {}) {
  const errors = [];
  for (const ip of RESOLVE_IPS) {
    try {
      return curl(["--resolve", `mcp.tikhub.io:443:${ip}`, ...baseArgs], opts);
    } catch (error) {
      errors.push(error.message);
    }
  }
  try {
    return curl(baseArgs, opts);
  } catch (error) {
    errors.push(error.message);
  }
  throw new Error(errors.join("\n"));
}

function parseHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function parseJsonRpcBody(text) {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));
  return JSON.parse(dataLines.length ? dataLines.join("\n") : text);
}

function mcpPost(config, sessionId, body, options = {}) {
  const headerFile = tmpFile("headers.txt");
  const bodyFile = tmpFile("body.txt");
  const args = [
    "--connect-timeout", "10",
    "--max-time", String(options.maxTime || 90),
    "-sS",
    "-D", headerFile,
    "-o", bodyFile,
    "-X", "POST",
    config.url,
    "-H", `Authorization: Bearer ${config.token}`,
    "-H", "Content-Type: application/json",
    "-H", "Accept: application/json, text/event-stream",
    "--data", JSON.stringify(body),
  ];
  if (sessionId) args.splice(args.indexOf("--data"), 0, "-H", `mcp-session-id: ${sessionId}`);
  curlWithResolve(args);
  const headers = parseHeaders(fs.readFileSync(headerFile, "utf8"));
  const text = fs.readFileSync(bodyFile, "utf8");
  try {
    fs.rmSync(path.dirname(headerFile), { recursive: true, force: true });
  } catch {}
  try {
    fs.rmSync(path.dirname(bodyFile), { recursive: true, force: true });
  } catch {}
  return { headers, text };
}

function initializeMcp(config) {
  const init = mcpPost(config, "", {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "codex-wechat-channels-toolkit", version: "1.0.0" },
    },
  }, { maxTime: 60 });
  const sessionId = init.headers["mcp-session-id"];
  if (!sessionId) throw new Error("MCP initialize response did not include mcp-session-id");
  mcpPost(config, sessionId, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  }, { maxTime: 30 });
  return sessionId;
}

function callTool(name, toolArgs) {
  const config = readWechatMcpConfig();
  const sessionId = initializeMcp(config);
  const response = mcpPost(config, sessionId, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: toolArgs },
  }, { maxTime: 120 });
  const rpc = parseJsonRpcBody(response.text);
  if (rpc.error) throw new Error(`MCP tool error: ${JSON.stringify(rpc.error)}`);
  const text = rpc.result?.structuredContent?.result || rpc.result?.content?.[0]?.text;
  if (!text) throw new Error("MCP tool returned no text result");
  const payload = JSON.parse(text);
  if (payload.error) throw new Error(`TikHub API error: ${payload.error}`);
  if (payload.code && payload.code !== 200) throw new Error(`TikHub API error ${payload.code}: ${payload.message || payload.message_zh || ""}`);
  return payload;
}

function stripTags(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function baseTitle(text) {
  return stripTags(text).replace(/\s*#.*$/s, "").trim();
}

module.exports = { callTool, stripTags, baseTitle };
