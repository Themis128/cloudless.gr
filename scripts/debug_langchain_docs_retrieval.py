from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

PERSIST_DIR = ".deepagents/langchain_docs_chroma"
COLLECTION_NAME = "langchain_docs"

embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5",
    encode_kwargs={"normalize_embeddings": True},
)

db = Chroma(
    persist_directory=PERSIST_DIR,
    embedding_function=embeddings,
    collection_name=COLLECTION_NAME,
)

queries = [
    "What are Deep Agents in LangChain?",
    "How do I create a Deep Agent with create_deep_agent?",
    "How do I enable LangSmith tracing?",
    "How does LangChain create_agent use tools?",
    "How do I deploy a Managed Deep Agent with deepagents deploy?",
]

for query in queries:
    print("\n" + "=" * 100)
    print(f"QUERY: {query}")
    print("=" * 100)

    results = db.similarity_search_with_score(query, k=8)

    for i, (doc, score) in enumerate(results, start=1):
        print(f"\n[{i}] score={score:.4f}")
        print(f"    title:  {doc.metadata.get('title')}")
        print(f"    source: {doc.metadata.get('source')}")
        preview = doc.page_content.replace("\n", " ")[:650]
        print(f"    text:   {preview}")
