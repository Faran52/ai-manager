export interface AppConfig {
  readonly pageSize: number;
  readonly maxPageSize: number;
  readonly previewLength: number;
  readonly snippetPadding: number;
  readonly maxSearchResults: number;
  readonly maxMatchesPerFile: number;
}

export const appConfig: AppConfig = {
  pageSize: 120,
  maxPageSize: 400,
  previewLength: 140,
  snippetPadding: 90,
  maxSearchResults: 200,
  maxMatchesPerFile: 4,
};
