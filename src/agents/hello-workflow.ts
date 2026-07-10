import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

/**
 * Hello World Workflow - A simple workflow example that can be extended
 * for more complex use cases.
 *
 * This workflow demonstrates basic workflow patterns:
 * - Running steps in sequence
 * - Reporting progress
 * - Handling approval waits
 * - Error handling
 */
export interface Params {
  name: string;
  delaySeconds?: number;
  steps?: number;
}

export interface Progress {
  step: string;
  status: "running" | "complete" | "error";
  percent?: number;
  message?: string;
}

export class HelloWorkflow extends WorkflowEntrypoint<Record<string, never>, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { name, delaySeconds = 1, steps = 3 } = event.payload;

    try {
      // Step 1: Initialize
      await step.sleep(`init-${Date.now()}`, delaySeconds);
      await this.reportProgress({
        step: "initialize",
        status: "running",
        percent: 0,
        message: `Initializing workflow for ${name}`,
      });

      // Step 2: Process
      await step.sleep(`process-${Date.now()}`, delaySeconds);
      await this.reportProgress({
        step: "process",
        status: "running",
        percent: 0.5,
        message: `Processing workflow for ${name}`,
      });

      // Step 3: Complete
      await step.sleep(`complete-${Date.now()}`, delaySeconds);
      await this.reportProgress({
        step: "complete",
        status: "complete",
        percent: 1,
        message: `Workflow completed successfully for ${name}`,
      });

      return {
        ok: true,
        name,
        steps,
        message: `Hello ${name}! Workflow completed ${steps} steps.`,
      };
    } catch (error) {
      await this.reportProgress({
        step: "error",
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Report progress to workflow tracking
   */
  protected async reportProgress(progress: Progress): Promise<void> {
    // In a real workflow, this would send to a Durable Object or external service
    console.log(`[Workflow Progress]`, progress);
  }
}
