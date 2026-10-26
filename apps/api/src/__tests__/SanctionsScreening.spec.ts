// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { GetChainConfig, GetPublicClient } from '../modules/chains/Chain';
import { IsSimulatedSettlement } from '../modules/chains/Settlement';
import { SanctionsScreeningModule } from '../modules/SanctionsScreening';
import { Logger } from '../utils/Logger';

jest.mock('../modules/chains/Chain', () => ({
  GetChainConfig: jest.fn(),
  GetPublicClient: jest.fn(),
  IsDeploylessMulticall: jest.fn(() => false),
}));
jest.mock('../modules/chains/Settlement', () => ({
  IsSimulatedSettlement: jest.fn(),
}));
jest.mock('../utils/Logger', () => ({
  Logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const ORACLE = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';
const CLEAN = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const FLAGGED = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

describe('SanctionsScreeningModule', () => {
  const multicall = jest.fn();
  const screening = new SanctionsScreeningModule();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(IsSimulatedSettlement).mockReturnValue(false);
    jest.mocked(GetChainConfig).mockReturnValue({
      sanctionsOracle: ORACLE,
    } as unknown as ReturnType<typeof GetChainConfig>);
    jest.mocked(GetPublicClient).mockReturnValue({
      multicall,
    } as unknown as ReturnType<typeof GetPublicClient>);
  });

  it('asks the chain’s sanctions oracle about each address in one multicall', async () => {
    multicall.mockResolvedValue([false, true]);

    await expect(
      screening.CheckWalletAddresses([CLEAN, FLAGGED.toLowerCase()])
    ).resolves.toEqual([FLAGGED]);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(multicall.mock.calls[0][0].contracts).toEqual([
      expect.objectContaining({
        address: ORACLE,
        functionName: 'isSanctioned',
        args: [CLEAN],
      }),
      expect.objectContaining({ args: [FLAGGED] }),
    ]);
  });

  it('reports a single address through CheckWalletAddress', async () => {
    multicall.mockResolvedValue([true]);

    await expect(screening.CheckWalletAddress(FLAGGED)).resolves.toEqual({
      isSanctioned: true,
      source: 'OFAC SDN List',
    });
  });

  it('does not block when the oracle cannot be reached', async () => {
    multicall.mockRejectedValue(new Error('rpc down'));

    await expect(screening.CheckWalletAddresses([FLAGGED])).resolves.toEqual(
      []
    );
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Sanctions oracle check failed'),
      { error: 'rpc down' }
    );
  });

  it('skips the oracle on the simulated rail', async () => {
    jest.mocked(IsSimulatedSettlement).mockReturnValue(true);

    await expect(screening.CheckWalletAddresses([FLAGGED])).resolves.toEqual(
      []
    );
    expect(multicall).not.toHaveBeenCalled();
  });

  it('skips the oracle when the chain has none configured', async () => {
    jest.mocked(GetChainConfig).mockReturnValue({
      sanctionsOracle: null,
    } as unknown as ReturnType<typeof GetChainConfig>);

    await expect(screening.CheckWalletAddresses([FLAGGED])).resolves.toEqual(
      []
    );
    expect(multicall).not.toHaveBeenCalled();
  });
});
