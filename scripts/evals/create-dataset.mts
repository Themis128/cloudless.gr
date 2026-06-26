import { Client } from "langsmith";

const client = new Client();

const dataset = await client.createDataset("ds-advanced-kayak-81", {
  description: "A sample dataset in LangSmith.",
});

const examples = [
  {
    inputs: { question: "Which country is Mount Kilimanjaro located in?" },
    outputs: { answer: "Mount Kilimanjaro is located in Tanzania." },
    dataset_id: dataset.id,
  },
  {
    inputs: { question: "What is Earth's lowest point?" },
    outputs: { answer: "Earth's lowest point is The Dead Sea." },
    dataset_id: dataset.id,
  },
];

await client.createExamples(examples);
console.log("Dataset created:", dataset.name, "id:", dataset.id);
