export interface RawUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_creation_input_tokens?: number;
  readonly cache_read_input_tokens?: number;
}

export interface RawTextBlock {
  readonly type: 'text';
  readonly text?: string | undefined;
}

export interface RawThinkingBlock {
  readonly type: 'thinking';
  readonly thinking?: string | undefined;
  readonly signature?: string | undefined;
}

export interface RawRedactedThinkingBlock {
  readonly type: 'redacted_thinking';
  readonly data?: string | undefined;
}

export interface RawTodoItem {
  readonly content?: string | undefined;
  readonly status?: string | undefined;
  readonly activeForm?: string | undefined;
}

export interface RawSingleEdit {
  readonly old_string?: string;
  readonly new_string?: string;
  readonly replace_all?: boolean;
}

export interface RawToolInput {
  readonly command?: string | undefined;
  readonly description?: string | undefined;
  readonly file_path?: string;
  readonly path?: string | undefined;
  readonly pattern?: string | undefined;
  readonly glob?: string | undefined;
  readonly query?: string | undefined;
  readonly url?: string | undefined;
  readonly prompt?: string | undefined;
  readonly old_string?: string;
  readonly new_string?: string;
  readonly replace_all?: boolean;
  readonly content?: string | undefined;
  readonly skill?: string | undefined;
  readonly subagent_type?: string;
  readonly todos?: readonly RawTodoItem[] | undefined;
  readonly edits?: readonly RawSingleEdit[] | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface RawToolUseBlock {
  readonly type: 'tool_use';
  readonly id?: string | undefined;
  readonly name?: string | undefined;
  readonly input?: RawToolInput | undefined;
}

export interface RawImageSource {
  readonly type?: string | undefined;
  readonly media_type?: string;
  readonly data?: string | undefined;
  readonly url?: string | undefined;
}

export interface RawImageBlock {
  readonly type: 'image';
  readonly source?: RawImageSource | undefined;
}

export interface RawResultPart {
  readonly type?: string | undefined;
  readonly text?: string | undefined;
  readonly source?: RawImageSource | undefined;
}

export interface RawToolResultBlock {
  readonly type: 'tool_result';
  readonly tool_use_id?: string;
  readonly content?: string | readonly RawResultPart[] | undefined;
  readonly is_error?: boolean;
}

export type RawContentBlock
  = | RawTextBlock
    | RawThinkingBlock
    | RawRedactedThinkingBlock
    | RawToolUseBlock
    | RawToolResultBlock
    | RawImageBlock;

export interface RawMessagePayload {
  readonly role?: string | undefined;
  readonly content?: string | readonly RawContentBlock[] | undefined;
  readonly model?: string | undefined;
  readonly stop_reason?: string;
  readonly usage?: RawUsage | undefined;
}

export interface RawPatchHunk {
  readonly oldStart?: number | undefined;
  readonly oldLines?: number | undefined;
  readonly newStart?: number | undefined;
  readonly newLines?: number | undefined;
  readonly lines?: readonly string[] | undefined;
}

export interface RawToolUseResult {
  readonly type?: string | undefined;
  readonly filePath?: string | undefined;
  readonly content?: string | undefined;
  readonly originalFile?: string | undefined;
  readonly oldString?: string | undefined;
  readonly newString?: string | undefined;
  readonly replaceAll?: boolean | undefined;
  readonly userModified?: boolean | undefined;
  readonly structuredPatch?: readonly RawPatchHunk[] | undefined;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
  readonly interrupted?: boolean | undefined;
  readonly isImage?: boolean | undefined;
  readonly noOutputExpected?: boolean | undefined;
  readonly query?: string | undefined;
  readonly matches?: readonly string[] | undefined;
}

export interface RawHistoryLine {
  readonly type?: string | undefined;
  readonly uuid?: string | undefined;
  readonly parentUuid?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly timestamp?: string | undefined;
  readonly isSidechain?: boolean | undefined;
  readonly isMeta?: boolean | undefined;
  readonly message?: RawMessagePayload | undefined;
  readonly toolUseResult?: string | RawToolUseResult | undefined;
  readonly summary?: string | undefined;
  readonly leafUuid?: string | undefined;
  readonly subtype?: string | undefined;
  readonly level?: string | undefined;
  readonly content?: string | undefined;
  readonly customTitle?: string | undefined;
  readonly title?: string | undefined;
  readonly operation?: string | undefined;
  readonly mode?: string | undefined;
  readonly costUSD?: number | undefined;
  readonly durationMs?: number | undefined;
  readonly cwd?: string | undefined;
  readonly version?: string | undefined;
  readonly gitBranch?: string | undefined;
  readonly entrypoint?: string | undefined;
}
