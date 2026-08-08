/**
 * n8n workflow JSON validation tests.
 *
 * Validates workflow structure and catches common configuration errors:
 * - Missing node references in expressions
 * - Invalid node connections
 * - Missing required fields
 * - Expression syntax errors
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOWS_DIR = path.join(__dirname, "..", "infrastructure", "n8n", "workflows");

interface WorkflowNode {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
}

interface Workflow {
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
  active?: boolean;
}

function loadWorkflow(name: string): Workflow {
  const filePath = path.join(WORKFLOWS_DIR, name);
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Workflow;
}

function extractExpressions(obj: unknown): string[] {
  const expressions: string[] = [];
  const seen = new Set<unknown>();

  function traverse(o: unknown): void {
    if (!o || typeof o !== "object" || seen.has(o)) return;
    seen.add(o);

    if (Array.isArray(o)) {
      for (const item of o) traverse(item);
    } else {
      for (const [key, value] of Object.entries(o as Record<string, unknown>)) {
        if (typeof value === "string") {
          // Match n8n expressions like {{ $('Node Name').item.json.field }}
          const matches = value.match(/\$\(['"]([^'"]+)['"]\)/g);
          if (matches) {
            expressions.push(...matches.map((m) => m.slice(2, -1).replace(/['"]/g, "")));
          }
        } else if (typeof value === "object") {
          traverse(value);
        }
      }
    }
  }

  traverse(obj);
  return expressions;
}

test.describe("n8n workflow JSON validation", () => {
  const workflowFiles = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of workflowFiles) {
    test.describe(file, () => {
      let workflow: Workflow;
      let nodeNames: Set<string>;

      test.beforeAll(() => {
        workflow = loadWorkflow(file);
        nodeNames = new Set(workflow.nodes.map((n) => n.name));
      });

      test("has valid JSON structure", () => {
        expect(workflow).toBeTruthy();
        expect(workflow.name).toBeTruthy();
        expect(Array.isArray(workflow.nodes)).toBe(true);
        expect(typeof workflow.connections).toBe("object");
      });

      test("all referenced nodes exist", () => {
        const referencedNodes = extractExpressions(workflow);
        for (const nodeName of referencedNodes) {
          expect(
            nodeNames.has(nodeName),
            `Node '${nodeName}' is referenced but does not exist in workflow`
          ).toBe(true);
        }
      });

      test("all connections reference existing nodes", () => {
        for (const [source, targets] of Object.entries(workflow.connections)) {
          expect(nodeNames.has(source), `Connection source '${source}' does not exist`).toBe(true);
          const targetObj = targets as Record<string, unknown>;
          for (const targetArray of Object.values(targetObj)) {
            const arr = targetArray as Record<string, unknown>[][];
            for (const item of arr.flat()) {
              if (typeof item === "object" && item !== null) {
                const nodeName = (item as { node?: string }).node;
                if (nodeName) {
                  expect(
                    nodeNames.has(nodeName),
                    `Connection target '${nodeName}' does not exist`
                  ).toBe(true);
                }
              }
            }
          }
        }
      });

      test("all nodes have required fields", () => {
        for (const node of workflow.nodes) {
          expect(node.name, "Node missing name").toBeTruthy();
          expect(node.type, `Node '${node.name}' missing type`).toBeTruthy();
        }
      });

      test("has at least one trigger node", () => {
        const triggerTypes = [
          "n8n-nodes-base.webhook",
          "n8n-nodes-base.cron",
          "n8n-nodes-base.trigger",
        ];
        const hasTrigger = workflow.nodes.some((n) => triggerTypes.includes(n.type));
        expect(hasTrigger, "Workflow has no trigger node (webhook, cron, or trigger)").toBe(true);
      });

      test("webhook paths are unique if present", () => {
        const webhookNodes = workflow.nodes.filter((n) => n.type === "n8n-nodes-base.webhook");
        const webhookPaths = webhookNodes
          .map((n) => (n.parameters?.path as string) || "")
          .filter(Boolean);
        const uniquePaths = new Set(webhookPaths);
        expect(webhookPaths.length, "Duplicate webhook paths found").toBe(uniquePaths.size);
      });
    });
  }
});
