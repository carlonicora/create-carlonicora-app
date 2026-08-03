/**
 * Type definitions for the File System Access API
 * Augments existing TypeScript DOM types with missing methods
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(
    data:
      | BufferSource
      | Blob
      | string
      | { type: "write" | "seek" | "truncate"; data?: BufferSource | Blob | string; position?: number; size?: number },
  ): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

// Augment the existing FileSystemDirectoryHandle with missing iterator methods
interface FileSystemDirectoryHandle {
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}

// Augment FileSystemFileHandle with createWritable
interface FileSystemFileHandle {
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};
