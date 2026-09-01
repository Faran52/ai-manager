export type {
  UpdateConfig,
  UpdatePlatform,
  UpdateStage,
  UpdateState,
} from './types';
export {
  checkForUpdate,
  resetUpdateState,
  updateState,
} from './updateService';
export {
  helperScriptFor,
  installCommandFor,
} from './utils/installUtils';
export { updateConfigFromEnv } from './utils/updateConfigUtils';
