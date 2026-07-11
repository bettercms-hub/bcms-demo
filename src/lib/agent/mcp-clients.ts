/**
 * mcp-clients — the editor-specific install recipes for connecting an
 * outside AI (Claude Code, Cursor, VS Code, Windsurf, Claude Desktop) to a
 * project's MCP server. Data-only so the Connect dialog and any docs share
 * one source of truth.
 *
 * The command a person copies depends on their tool: terminal one-liners for
 * Claude Code / VS Code, a config block for the JSON-configured editors. The
 * project-scoped connection key is injected once generated; before that a
 * readable placeholder stands in so the shape is clear.
 */

export const MCP_PACKAGE = "@bettercms-ai/mcp";
export const MCP_API_URL = "https://api.bettercms.ai";

/** Per-project MCP endpoint (the same URL the settings page shows). */
export function mcpEndpoint(projectId: string): string {
  return `https://mcp.bettercms.site/v1/projects/${projectId}`;
}

export interface McpStep {
  /** Short instruction above the code block. */
  label: string;
  code: string;
  lang: "bash" | "json";
}

export interface McpClient {
  id: string;
  label: string;
  hint: string;
  /** Build the copy-paste steps for this client. */
  steps: (ctx: { token: string; projectId: string }) => McpStep[];
}

/** JSON config block shared by the editors that configure MCP via a file. */
function jsonConfig(token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        bettercms: {
          command: "npx",
          args: ["-y", MCP_PACKAGE],
          env: { BETTERCMS_TOKEN: token },
        },
      },
    },
    null,
    2,
  );
}

export const MCP_CLIENTS: McpClient[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    hint: "Terminal and IDE",
    steps: ({ token }) => [
      {
        label: "Run in your terminal",
        lang: "bash",
        code: `claude mcp add bettercms -e BETTERCMS_TOKEN=${token} -- npx -y ${MCP_PACKAGE}`,
      },
      {
        label: "Then authorize in your agent",
        lang: "bash",
        code: "/mcp__bettercms__studio",
      },
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    hint: "IDE",
    steps: ({ token }) => [
      { label: "Add to ~/.cursor/mcp.json", lang: "json", code: jsonConfig(token) },
    ],
  },
  {
    id: "vscode",
    label: "VS Code",
    hint: "IDE",
    steps: ({ token }) => [
      {
        label: "Run in your terminal",
        lang: "bash",
        code: `code --add-mcp '{"name":"bettercms","command":"npx","args":["-y","${MCP_PACKAGE}"],"env":{"BETTERCMS_TOKEN":"${token}"}}'`,
      },
    ],
  },
  {
    id: "windsurf",
    label: "Windsurf",
    hint: "IDE",
    steps: ({ token }) => [
      { label: "Add to ~/.codeium/windsurf/mcp_config.json", lang: "json", code: jsonConfig(token) },
    ],
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    hint: "Desktop app",
    steps: ({ token }) => [
      { label: "Add to claude_desktop_config.json", lang: "json", code: jsonConfig(token) },
    ],
  },
];

/** Placeholder shown in commands before a real key is generated. */
export const TOKEN_PLACEHOLDER = "<your-connection-key>";
