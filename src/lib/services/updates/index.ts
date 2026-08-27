export type {
  UpdateConfig,
  UpdatePlatform,
  UpdateStage,
  UpdateState,
} from './types';
export { updateConfigFromEnv } from './updateConfig';
export {
  checkForUpdate,
  resetUpdateState,
  updateState,
} from './updateService';
export {
  helperScriptFor,
  installCommandFor,
} from './utils/installUtils';
