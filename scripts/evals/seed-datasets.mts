/**
 * Idempotent dataset seeder.
 * Creates datasets in LangSmith if they don't already exist.
 *
 * Run:
 *   LANGSMITH_API_KEY=lsv2_pt_... pnpm tsx scripts/evals/seed-datasets.mts
 */

import { Client } from "langsmith";

const client = new Client();

const DATASETS: Array<{
  name: string;
  description: string;
  examples: Array<{ inputs: Record<string, unknown>; outputs: Record<string, unknown> }>;
}> = [
  {
    name: "ds-advanced-kayak-81",
    description: "General knowledge Q&A — geography and science basics.",
    examples: [
      {
        inputs: { question: "Which country is Mount Kilimanjaro located in?" },
        outputs: { answer: "Mount Kilimanjaro is located in Tanzania." },
      },
      {
        inputs: { question: "What is Earth's lowest point?" },
        outputs: { answer: "Earth's lowest point is The Dead Sea." },
      },
    ],
  },
  {
    name: "cloudless-gr-product-qa",
    description: "cloudless.gr product and service Q&A for evaluating the assistant.",
    examples: [
      {
        inputs: { question: "What is cloudless.gr?" },
        outputs: {
          answer:
            "cloudless.gr is a Greek cloud hosting and managed services provider offering infrastructure, DevOps, and digital transformation solutions.",
        },
      },
      {
        inputs: { question: "What cloud services does cloudless.gr offer?" },
        outputs: {
          answer:
            "cloudless.gr offers managed Kubernetes, cloud infrastructure, CI/CD pipelines, monitoring, and digital transformation consulting.",
        },
      },
      {
        inputs: { question: "Is cloudless.gr based in Greece?" },
        outputs: { answer: "Yes, cloudless.gr is based in Greece." },
      },
    ],
  },
];

async function seedDatasets() {
  for (const ds of DATASETS) {
    let datasetId: string;

    try {
      const existing = await client.readDataset({ datasetName: ds.name });
      datasetId = existing.id;
      console.log(`✓ Dataset already exists: ${ds.name} (${datasetId})`);
    } catch {
      const created = await client.createDataset(ds.name, {
        description: ds.description,
      });
      datasetId = created.id;
      await client.createExamples(
        ds.examples.map((ex) => ({ ...ex, dataset_id: datasetId }))
      );
      console.log(`✓ Created dataset: ${ds.name} (${datasetId}) with ${ds.examples.length} examples`);
    }
  }

  console.log("\nAll datasets ready.");
}

seedDatasets().catch(console.error);
