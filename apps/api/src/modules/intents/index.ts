import { GetNearIntentsConfig } from '../AppConfig';
import { AppError } from '../../utils/AppError';
import { NearIntents, type NearIntentsClient } from './NearIntents';
import { SimulatedNearIntents } from './SimulatedNearIntents';

export * from './NearIntents';

export function IsNearIntentsSimulated(): boolean {
  return GetNearIntentsConfig().mode === 'simulated';
}

/** The client for the configured mode; throws when cross-chain is off. */
export function GetNearIntents(): NearIntentsClient {
  const { mode, apiKey, baseUrl } = GetNearIntentsConfig();
  if (mode === 'off') {
    throw new AppError(
      'Cross-chain payments are not enabled',
      400,
      'invalid_request_error'
    );
  }
  return mode === 'simulated'
    ? new SimulatedNearIntents()
    : new NearIntents({ apiKey, baseUrl });
}
