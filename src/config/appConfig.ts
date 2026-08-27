export interface AppConfig {
  // Kept in step with package.json and deno.json, the updater compares against it.
  readonly version: string;
  readonly pageSize: number;
  readonly maxPageSize: number;
  readonly previewLength: number;
  readonly snippetPadding: number;
  readonly maxSearchResults: number;
  readonly maxMatchesPerFile: number;
}

export const appConfig: AppConfig = {
  version: '0.1.0',
  pageSize: 120,
  maxPageSize: 400,
  previewLength: 140,
  snippetPadding: 90,
  maxSearchResults: 200,
  maxMatchesPerFile: 4,
};
