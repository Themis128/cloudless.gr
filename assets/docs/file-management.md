# File Management System

The File Management System provides comprehensive file operations including loading, viewing, uploading, and processing files within the application for code generation and analysis workflows.

## Overview

The system provides:

- **File Loading**: Load and display file contents from the project
- **File Viewer**: Interactive file browser and content viewer
- **File Processing**: Support for various file types and formats
- **Integration**: Seamless integration with LLM for code analysis
- **Security**: Secure file access with proper validation

## Core Components

### 1. File Loader Composable

**Location**: `composables/useLLMAndFileViewer.ts`

Provides unified file loading and viewing capabilities:

```typescript
export function useLLMAndFileViewer(
  llmOptions: LLMOptions = {},
  defaultFilePath = 'components/CodegenWidget.vue'
) {
  // File viewer state
  const filePath = ref(defaultFilePath);
  const fileContent = ref('');
  const fileLoading = ref(false);
  const fileError = ref('');

  // Load file content
  async function loadFile(path?: string) {
    fileLoading.value = true;
    fileError.value = '';
    fileContent.value = '';

    if (path) filePath.value = path;

    try {
      const res = await fetch(`/api/load-file?path=${encodeURIComponent(filePath.value)}`);
      const data = await res.json();

      if (data.error) {
        fileError.value = data.error;
      } else {
        fileContent.value = data;
      }
    } catch (e) {
      fileError.value = 'Failed to load file.';
    } finally {
      fileLoading.value = false;
    }
  }

  return {
    // File operations
    filePath,
    fileContent,
    fileLoading,
    fileError,
    loadFile,
    // LLM integration
    // ... (LLM methods)
  };
}
```

### 2. File Loading API

**Location**: `server/api/load-file.ts`

Server-side file loading with security validation:

```typescript
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const filePath = query.path as string;

  if (!filePath) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File path is required',
    });
  }

  // Security: Validate file path
  if (!isValidFilePath(filePath)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access to this file is not allowed',
    });
  }

  try {
    const fullPath = path.join(process.cwd(), filePath);
    const content = await readFile(fullPath, 'utf-8');

    return {
      content,
      path: filePath,
      size: content.length,
      lastModified: (await stat(fullPath)).mtime,
    };
  } catch (error) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File not found',
    });
  }
});

function isValidFilePath(filePath: string): boolean {
  // Security checks
  const allowedExtensions = ['.vue', '.ts', '.js', '.json', '.md', '.css'];
  const deniedPaths = ['.env', 'node_modules', '.git', 'dist', '.output'];

  // Check file extension
  const hasValidExtension = allowedExtensions.some((ext) => filePath.toLowerCase().endsWith(ext));

  // Check denied paths
  const isInDeniedPath = deniedPaths.some((denied) => filePath.includes(denied));

  // Prevent path traversal
  const hasPathTraversal = filePath.includes('..');

  return hasValidExtension && !isInDeniedPath && !hasPathTraversal;
}
```

### 3. File List API

**Location**: `server/api/list-files.ts`

List available files with filtering:

```typescript
import { readdir, stat } from 'fs/promises';
import path from 'path';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const directory = (query.directory as string) || '';
  const extension = query.extension as string;

  try {
    const fullPath = path.join(process.cwd(), directory);
    const files = await getFileList(fullPath, extension);

    return {
      files,
      directory,
      total: files.length,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list files',
    });
  }
});

async function getFileList(dirPath: string, extensionFilter?: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const items = await readdir(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = await stat(itemPath);
    const relativePath = path.relative(process.cwd(), itemPath);

    // Skip system directories
    if (item.startsWith('.') || item === 'node_modules') {
      continue;
    }

    if (stats.isFile()) {
      // Apply extension filter
      if (extensionFilter && !item.endsWith(extensionFilter)) {
        continue;
      }

      files.push({
        name: item,
        path: relativePath,
        size: stats.size,
        modified: stats.mtime,
        type: 'file',
        extension: path.extname(item),
      });
    } else if (stats.isDirectory()) {
      // Recursively get files from subdirectories
      const subFiles = await getFileList(itemPath, extensionFilter);
      files.push(...subFiles);
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: Date;
  type: 'file' | 'directory';
  extension: string;
}
```

## File Types Support

### Supported File Types

```typescript
const SUPPORTED_FILE_TYPES = {
  // Web Technologies
  '.vue': { language: 'vue', category: 'component' },
  '.ts': { language: 'typescript', category: 'script' },
  '.js': { language: 'javascript', category: 'script' },
  '.jsx': { language: 'javascript', category: 'component' },
  '.tsx': { language: 'typescript', category: 'component' },

  // Styling
  '.css': { language: 'css', category: 'style' },
  '.scss': { language: 'scss', category: 'style' },
  '.sass': { language: 'sass', category: 'style' },
  '.less': { language: 'less', category: 'style' },

  // Configuration
  '.json': { language: 'json', category: 'config' },
  '.yaml': { language: 'yaml', category: 'config' },
  '.yml': { language: 'yaml', category: 'config' },
  '.toml': { language: 'toml', category: 'config' },

  // Documentation
  '.md': { language: 'markdown', category: 'docs' },
  '.txt': { language: 'plaintext', category: 'docs' },

  // Templates
  '.hbs': { language: 'handlebars', category: 'template' },
  '.ejs': { language: 'ejs', category: 'template' },
};
```

### File Processing

```typescript
// utils/file-processor.ts
export class FileProcessor {
  static async processFile(filePath: string, content: string): Promise<ProcessedFile> {
    const extension = path.extname(filePath);
    const fileType = SUPPORTED_FILE_TYPES[extension];

    if (!fileType) {
      throw new Error(`Unsupported file type: ${extension}`);
    }

    return {
      path: filePath,
      content,
      language: fileType.language,
      category: fileType.category,
      lineCount: content.split('\n').length,
      size: content.length,
      hasTypeErrors: await this.checkTypeErrors(content, fileType.language),
      dependencies: this.extractDependencies(content, fileType.language),
    };
  }

  static async checkTypeErrors(content: string, language: string): Promise<boolean> {
    if (language === 'typescript' || language === 'vue') {
      // Simplified TypeScript error checking
      return content.includes('any') || content.includes('// @ts-ignore');
    }
    return false;
  }

  static extractDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];

    // Extract imports
    const importRegex = /import.*from ['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    // Extract require statements
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }
}

interface ProcessedFile {
  path: string;
  content: string;
  language: string;
  category: string;
  lineCount: number;
  size: number;
  hasTypeErrors: boolean;
  dependencies: string[];
}
```

## File Viewer Components

### Basic File Viewer

```vue
<template>
  <div class="file-viewer">
    <div class="file-header">
      <h3>{{ fileName }}</h3>
      <div class="file-info">
        <span>{{ formatFileSize(fileSize) }}</span>
        <span>{{ lineCount }} lines</span>
        <span>{{ language }}</span>
      </div>
    </div>

    <div class="file-actions">
      <button @click="loadFile" :disabled="fileLoading">
        {{ fileLoading ? 'Loading...' : 'Reload' }}
      </button>
      <button @click="analyzeWithLLM" :disabled="!fileContent">Analyze with AI</button>
    </div>

    <div v-if="fileError" class="error">
      {{ fileError }}
    </div>

    <div v-else-if="fileContent" class="file-content">
      <pre><code :class="`language-${language}`">{{ fileContent }}</code></pre>
    </div>

    <div v-else-if="fileLoading" class="loading">Loading file...</div>
  </div>
</template>

<script setup>
const props = defineProps<{
  filePath: string;
}>();

const {
  fileContent,
  fileLoading,
  fileError,
  loadFile,
  sendPrompt
} = useLLMAndFileViewer();

const fileName = computed(() => path.basename(props.filePath));
const language = computed(() => getFileLanguage(props.filePath));
const lineCount = computed(() => fileContent.value.split('\n').length);
const fileSize = computed(() => fileContent.value.length);

const analyzeWithLLM = async () => {
  const prompt = `Analyze this ${language.value} file and suggest improvements:\n\n${fileContent.value}`;
  await sendPrompt(prompt);
};

onMounted(() => {
  loadFile(props.filePath);
});
</script>
```

### File Browser Component

```vue
<template>
  <div class="file-browser">
    <div class="browser-header">
      <input v-model="searchQuery" placeholder="Search files..." class="search-input" />
      <select v-model="extensionFilter" class="filter-select">
        <option value="">All Files</option>
        <option value=".vue">Vue Components</option>
        <option value=".ts">TypeScript</option>
        <option value=".js">JavaScript</option>
        <option value=".css">CSS</option>
        <option value=".md">Markdown</option>
      </select>
    </div>

    <div class="file-tree">
      <div
        v-for="file in filteredFiles"
        :key="file.path"
        class="file-item"
        :class="{ active: selectedFile === file.path }"
        @click="selectFile(file.path)"
      >
        <div class="file-icon">
          <component :is="getFileIcon(file.extension)" />
        </div>
        <div class="file-details">
          <div class="file-name">{{ file.name }}</div>
          <div class="file-meta">
            {{ formatFileSize(file.size) }} •
            {{ formatDate(file.modified) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits<{
  fileSelected: [filePath: string];
}>();

const files = ref<FileInfo[]>([]);
const searchQuery = ref('');
const extensionFilter = ref('');
const selectedFile = ref('');

const filteredFiles = computed(() => {
  let filtered = files.value;

  // Filter by extension
  if (extensionFilter.value) {
    filtered = filtered.filter(file =>
      file.extension === extensionFilter.value
    );
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(file =>
      file.name.toLowerCase().includes(query) ||
      file.path.toLowerCase().includes(query)
    );
  }

  return filtered;
});

const selectFile = (filePath: string) => {
  selectedFile.value = filePath;
  emit('fileSelected', filePath);
};

const loadFiles = async () => {
  try {
    const response = await $fetch('/api/list-files', {
      query: { extension: extensionFilter.value }
    });
    files.value = response.files;
  } catch (error) {
    console.error('Failed to load files:', error);
  }
};

onMounted(() => {
  loadFiles();
});

watch(extensionFilter, () => {
  loadFiles();
});
</script>
```

## Integration with LLM

### Code Analysis

```typescript
// File analysis with LLM integration
export class FileAnalyzer {
  static async analyzeFile(filePath: string, content: string): Promise<FileAnalysis> {
    const processedFile = await FileProcessor.processFile(filePath, content);

    // Generate analysis prompt
    const prompt = this.generateAnalysisPrompt(processedFile);

    // Get LLM analysis
    const analysis = await generateLLMResponse(prompt);

    return {
      ...processedFile,
      llmAnalysis: analysis,
      suggestions: this.extractSuggestions(analysis),
      issues: this.extractIssues(analysis),
    };
  }

  private static generateAnalysisPrompt(file: ProcessedFile): string {
    return `
Analyze this ${file.language} file: ${file.path}

File Statistics:
- Lines: ${file.lineCount}
- Size: ${file.size} bytes
- Dependencies: ${file.dependencies.join(', ')}

Code:
\`\`\`${file.language}
${file.content}
\`\`\`

Please provide:
1. Code quality assessment
2. Performance optimization suggestions
3. Security considerations
4. Best practice recommendations
5. Potential bugs or issues
    `.trim();
  }

  private static extractSuggestions(analysis: string): string[] {
    // Extract suggestions from LLM response
    const suggestionRegex = /(?:suggestion|recommend|should|consider):\s*(.+)/gi;
    const matches = [...analysis.matchAll(suggestionRegex)];
    return matches.map((match) => match[1].trim());
  }

  private static extractIssues(analysis: string): string[] {
    // Extract issues from LLM response
    const issueRegex = /(?:issue|problem|bug|error):\s*(.+)/gi;
    const matches = [...analysis.matchAll(issueRegex)];
    return matches.map((match) => match[1].trim());
  }
}

interface FileAnalysis extends ProcessedFile {
  llmAnalysis: string;
  suggestions: string[];
  issues: string[];
}
```

### Code Generation with File Context

```typescript
export class ContextualCodeGenerator {
  static async generateWithFileContext(prompt: string, contextFiles: string[]): Promise<string> {
    // Load context files
    const contextContent = await Promise.all(
      contextFiles.map(async (filePath) => {
        const response = await $fetch('/api/load-file', {
          query: { path: filePath },
        });
        return `File: ${filePath}\n\`\`\`\n${response.content}\n\`\`\``;
      })
    );

    // Build contextual prompt
    const contextualPrompt = `
Context Files:
${contextContent.join('\n\n')}

Request: ${prompt}

Please generate code that is consistent with the existing codebase style and patterns shown in the context files.
    `.trim();

    return await generateLLMResponse(contextualPrompt);
  }
}
```

## Security & Validation

### File Access Security

```typescript
// Security utilities
export class FileSecurityValidator {
  private static readonly ALLOWED_EXTENSIONS = [
    '.vue',
    '.ts',
    '.js',
    '.jsx',
    '.tsx',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.json',
    '.yaml',
    '.yml',
    '.md',
    '.txt',
  ];

  private static readonly BLOCKED_PATHS = [
    '.env',
    '.git',
    'node_modules',
    'dist',
    '.output',
    'coverage',
    '.nyc_output',
  ];

  static validateFilePath(filePath: string): boolean {
    // Normalize path
    const normalizedPath = path.normalize(filePath);

    // Check for path traversal
    if (normalizedPath.includes('..')) {
      return false;
    }

    // Check blocked paths
    if (this.BLOCKED_PATHS.some((blocked) => normalizedPath.includes(blocked))) {
      return false;
    }

    // Check allowed extensions
    const extension = path.extname(normalizedPath);
    if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
      return false;
    }

    return true;
  }

  static sanitizeFilePath(filePath: string): string {
    // Remove dangerous characters
    return filePath
      .replace(/[<>:"|?*]/g, '')
      .replace(/\.\./g, '')
      .replace(/^\//, '');
  }
}
```

### File Size Limits

```typescript
const FILE_SIZE_LIMITS = {
  '.vue': 50 * 1024, // 50KB for Vue components
  '.ts': 100 * 1024, // 100KB for TypeScript files
  '.js': 100 * 1024, // 100KB for JavaScript files
  '.json': 10 * 1024, // 10KB for JSON files
  '.md': 100 * 1024, // 100KB for Markdown files
  default: 50 * 1024, // 50KB default limit
};

export function validateFileSize(filePath: string, content: string): boolean {
  const extension = path.extname(filePath);
  const limit = FILE_SIZE_LIMITS[extension] || FILE_SIZE_LIMITS.default;

  return content.length <= limit;
}
```

## Error Handling

### File Operation Errors

```typescript
export enum FileError {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_PATH = 'INVALID_PATH',
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class FileOperationError extends Error {
  constructor(
    public code: FileError,
    message: string,
    public filePath?: string
  ) {
    super(message);
    this.name = 'FileOperationError';
  }
}

// Error handling in file operations
export async function safeLoadFile(filePath: string): Promise<string> {
  try {
    const response = await $fetch('/api/load-file', {
      query: { path: filePath },
    });
    return response.content;
  } catch (error: any) {
    if (error.status === 404) {
      throw new FileOperationError(
        FileError.FILE_NOT_FOUND,
        `File not found: ${filePath}`,
        filePath
      );
    } else if (error.status === 403) {
      throw new FileOperationError(FileError.ACCESS_DENIED, `Access denied: ${filePath}`, filePath);
    } else {
      throw new FileOperationError(
        FileError.NETWORK_ERROR,
        `Failed to load file: ${error.message}`,
        filePath
      );
    }
  }
}
```

## Performance Optimization

### File Caching

```typescript
// File content caching
class FileCache {
  private cache = new Map<string, CachedFile>();
  private maxCacheSize = 100;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  set(filePath: string, content: string) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(filePath, {
      content,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  get(filePath: string): string | null {
    const cached = this.cache.get(filePath);

    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(filePath);
      return null;
    }

    // Update access count and timestamp
    cached.accessCount++;
    cached.timestamp = Date.now();

    return cached.content;
  }

  clear() {
    this.cache.clear();
  }
}

interface CachedFile {
  content: string;
  timestamp: number;
  accessCount: number;
}

export const fileCache = new FileCache();
```

### Lazy Loading

```vue
<template>
  <div class="file-list">
    <div v-for="file in visibleFiles" :key="file.path" ref="fileItems">
      <FileItem :file="file" />
    </div>
    <div v-if="hasMore" ref="loadMoreTrigger">Loading more files...</div>
  </div>
</template>

<script setup>
const files = ref<FileInfo[]>([]);
const visibleFiles = ref<FileInfo[]>([]);
const batchSize = 20;
const currentIndex = ref(0);

const hasMore = computed(() => currentIndex.value < files.value.length);

const loadMoreFiles = () => {
  const nextBatch = files.value.slice(
    currentIndex.value,
    currentIndex.value + batchSize
  );

  visibleFiles.value.push(...nextBatch);
  currentIndex.value += batchSize;
};

// Intersection Observer for infinite scrolling
const loadMoreTrigger = ref(null);

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore.value) {
      loadMoreFiles();
    }
  });

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value);
  }

  // Load initial batch
  loadMoreFiles();
});
</script>
```

## Related Documentation

- [Code Generation Feature](codegen-feature.md) - Using files with LLM
- [LLM Integration Guide](llm-integration.md) - AI-powered file analysis
- [API Reference](api-reference.md) - File management endpoints

---

**Last Updated**: December 2024
