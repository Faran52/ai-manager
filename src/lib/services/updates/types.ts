export type UpdateStage
  = | 'available'
    | 'downloaded'
    | 'idle'
    | 'unsupported';

export type UpdatePlatform = 'darwin' | 'linux' | 'windows';

export interface UpdateArtifact {
  readonly name: string;
  readonly sha256: string;
}

export interface UpdateManifest {
  readonly artifacts: Readonly<Record<string, UpdateArtifact>>;
  readonly notes?: string | undefined;
  readonly version: string;
}

export interface UpdateState {
  readonly artifactPath?: string | undefined;
  readonly notes?: string | undefined;
  readonly reason?: string | undefined;
  readonly stage: UpdateStage;
  readonly version?: string | undefined;
}

export interface InstallCommand {
  readonly args: readonly string[];
  readonly command: string;
}

export interface UpdateConfig {
  readonly baseUrl: string;
  readonly currentVersion: string;
  readonly publicKey?: string | undefined;
}
