/**
 * Ambient type declarations for LangChain v1.0 modules
 *
 * These declarations help TypeScript resolve LangChain modules when using
 * classic "node" module resolution (required for NestJS CommonJS compatibility).
 *
 * LangChain v1.0 uses modern package.json exports which aren't fully supported
 * by the legacy "node" resolution strategy, but work fine at runtime.
 */

// Core modules
declare module "@langchain/core/documents" {
  export * from "@langchain/core/dist/documents";
}

declare module "@langchain/core/prompts" {
  export * from "@langchain/core/dist/prompts/index";
}

declare module "@langchain/core/embeddings" {
  export * from "@langchain/core/dist/embeddings";
}

declare module "@langchain/core/language_models/chat_models" {
  export * from "@langchain/core/dist/language_models/chat_models";
}

declare module "@langchain/core/output_parsers" {
  export * from "@langchain/core/dist/output_parsers/index";
}

declare module "@langchain/core/messages" {
  export * from "@langchain/core/dist/messages/index";
}

declare module "@langchain/core/document_loaders/base" {
  export * from "@langchain/core/dist/document_loaders/base";
}

// Community modules
declare module "@langchain/community/document_loaders/web/recursive_url" {
  export * from "@langchain/community/dist/document_loaders/web/recursive_url";
}

declare module "@langchain/community/document_loaders/fs/csv" {
  export * from "@langchain/community/dist/document_loaders/fs/csv";
}

declare module "@langchain/community/document_loaders/fs/docx" {
  export * from "@langchain/community/dist/document_loaders/fs/docx";
}

// Text splitters
declare module "@langchain/textsplitters" {
  export * from "@langchain/textsplitters/dist/index";
}
