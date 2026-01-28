import "reflect-metadata";
import { vi } from "vitest";

// Mock NestJS Logger to suppress output during tests
vi.mock("@nestjs/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nestjs/common")>();
  return {
    ...actual,
    Logger: class MockLogger {
      static log = vi.fn();
      static error = vi.fn();
      static warn = vi.fn();
      static debug = vi.fn();
      static verbose = vi.fn();
      log = vi.fn();
      error = vi.fn();
      warn = vi.fn();
      debug = vi.fn();
      verbose = vi.fn();
    },
  };
});
