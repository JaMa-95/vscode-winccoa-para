import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const log = vscode.window.createOutputChannel('WinCC OA PARA', { log: true });

export interface McpClientConfig {
  url: string;
  token: string;
}

export class McpClient {
  private config: McpClientConfig | null = null;

  /** Auto-detect MCP server config from project's javascript/mcpServer/.env */
  configure(projectPath: string): boolean {
    const envPath = path.join(projectPath, 'javascript', 'mcpServer', '.env');
    log.info(`[MCP] Looking for .env at: ${envPath}`);

    if (fs.existsSync(envPath)) {
      const env = parseEnvFile(envPath);
      const port = env['MCP_HTTP_PORT'] || '3001';
      const host = env['MCP_HTTP_HOST'] || 'localhost';
      const token = env['MCP_API_TOKEN'] || '';

      this.config = {
        url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
        token,
      };
      log.info(`[MCP] Configured: ${this.config.url} (token: ${token ? 'set' : 'missing'})`);
      return true;
    }

    log.warn('[MCP] No .env found, MCP client not configured (values will be read-only)');
    return false;
  }

  get isConfigured(): boolean {
    return this.config !== null;
  }

  /** Check if the MCP HTTP server is reachable */
  async checkHealth(): Promise<boolean> {
    if (!this.config) return false;
    try {
      const response = await fetch(`${this.config.url}/health`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json() as { status?: string };
        log.info(`[MCP] Health check OK: ${JSON.stringify(data)}`);
        return data.status === 'ok';
      }
    } catch (err) {
      log.warn(`[MCP] Health check failed: ${err}`);
    }
    return false;
  }

  /** Set a datapoint value via the MCP HTTP server (goes through WinCC OA event manager) */
  async dpSet(dpeName: string, value: unknown): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'MCP client not configured. Is the MCP HTTP server running?' };
    }

    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'dp-set',
        arguments: {
          datapoints: { dpeName, value },
        },
      },
    };

    log.info(`[MCP] dpSet: ${dpeName} = ${JSON.stringify(value)}`);

    try {
      const response = await fetch(`${this.config.url}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${this.config.token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errText = await response.text();
        log.error(`[MCP] HTTP ${response.status}: ${errText}`);
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const text = await response.text();
      log.info(`[MCP] Response: ${text.substring(0, 200)}`);

      // Parse SSE response: "event: message\ndata: {...}\n"
      const dataMatch = text.match(/^data: (.+)$/m);
      if (dataMatch) {
        const result = JSON.parse(dataMatch[1]);
        const content = result.result?.content?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.success) {
            log.info(`[MCP] dpSet success for ${dpeName}`);
            return { success: true };
          }
          log.error(`[MCP] dpSet failed: ${JSON.stringify(parsed)}`);
          return { success: false, error: parsed.data?.[dpeName]?.error || 'dpSet returned failure' };
        }
      }

      return { success: false, error: 'Unexpected MCP response format' };
    } catch (err) {
      log.error(`[MCP] dpSet error: ${err}`);
      return { success: false, error: String(err) };
    }
  }
}

function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
  return env;
}
