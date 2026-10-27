// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  recoverTypedDataAddress,
  toBytes,
  type Address,
  type Hex,
  type Log,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  BuildTransferAuthorization,
  BuildTransferAuthorizationTypedData,
  SessionNonce,
  SplitSignature,
  VerifyCheckoutReceipt,
  type UsdcDomain,
} from '../modules/chains/CheckoutAuthorization';
import { USDC_ABI } from '../modules/chains/abi/Usdc';

/** Anvil account #2 (the buyer; a public test key). */
const BUYER_KEY: Hex =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const BUYER = privateKeyToAccount(BUYER_KEY).address;
const MERCHANT: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER: Address = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const USDC: Address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const FAKE_TOKEN: Address = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const DOMAIN: UsdcDomain = {
  name: 'USD Coin',
  version: '2',
  chainId: 31337,
  verifyingContract: USDC,
};
const SESSION = 'cs_z_1';
const EXPECTED = {
  usdc: USDC,
  merchant: MERCHANT,
  amountCents: 1234,
  sessionId: SESSION,
};

describe('CheckoutAuthorization', () => {
  describe('SessionNonce', () => {
    it('is keccak256 of the UTF-8 session id', () => {
      expect(SessionNonce('cs_z_1')).toBe(keccak256(toBytes('cs_z_1')));
      expect(SessionNonce('cs_z_2')).not.toBe(SessionNonce('cs_z_1'));
    });
  });

  describe('BuildTransferAuthorization', () => {
    it('pays the merchant amount × 10_000 until the session expires, bound to the session', () => {
      expect(
        BuildTransferAuthorization({
          payer: BUYER.toLowerCase(),
          merchant: MERCHANT.toLowerCase(),
          amountCents: 1234,
          sessionId: SESSION,
          expiresAt: 1_700_086_400,
        })
      ).toEqual({
        from: BUYER,
        to: MERCHANT,
        value: '12340000',
        valid_after: 0,
        valid_before: 1_700_086_400,
        nonce: SessionNonce(SESSION),
      });
    });
  });

  describe('BuildTransferAuthorizationTypedData', () => {
    const authorization = BuildTransferAuthorization({
      payer: BUYER,
      merchant: MERCHANT,
      amountCents: 1234,
      sessionId: SESSION,
      expiresAt: 1_700_086_400,
    });
    const typedData = BuildTransferAuthorizationTypedData(
      DOMAIN,
      authorization
    );

    it('is a TransferWithAuthorization in the USDC domain', () => {
      expect(typedData.primaryType).toBe('TransferWithAuthorization');
      expect(typedData.domain).toEqual({
        name: 'USD Coin',
        version: '2',
        chainId: 31337,
        verifyingContract: USDC,
      });
      expect(typedData.types.TransferWithAuthorization).toEqual([
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ]);
      // eth_signTypedData_v4 hashes the domain with these field types.
      expect(typedData.types.EIP712Domain).toEqual([
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ]);
    });

    it('carries the value as a decimal string of amount × 10_000', () => {
      expect(typedData.message).toEqual({
        from: BUYER,
        to: MERCHANT,
        value: '12340000',
        validAfter: 0,
        validBefore: 1_700_086_400,
        nonce: SessionNonce(SESSION),
      });
    });

    it('survives JSON and recovers to the signer', async () => {
      const wire = JSON.parse(JSON.stringify(typedData));
      const signature = await privateKeyToAccount(BUYER_KEY).signTypedData(
        wire
      );

      await expect(
        recoverTypedDataAddress({ ...wire, signature })
      ).resolves.toBe(BUYER);
    });
  });

  describe('SplitSignature', () => {
    const r = `0x${'11'.repeat(32)}` as Hex;
    const s = `0x${'22'.repeat(32)}` as Hex;

    it.each([
      ['1b', 27],
      ['1c', 28],
      ['00', 27],
      ['01', 28],
    ])('splits a 65-byte signature ending in %s', (suffix, v) => {
      expect(SplitSignature(`${r}${s.slice(2)}${suffix}`)).toEqual({
        v,
        r,
        s,
      });
    });

    it.each([
      ['a short signature', `${r}${s.slice(2)}`],
      ['non-hex characters', `0x${'zz'.repeat(65)}`],
      ['a simulated reference', 'sim_sig:cs_z_1:0xabc'],
      ['an invalid recovery byte', `${r}${s.slice(2)}05`],
    ])('rejects %s with a 400', (_label, signature) => {
      expect(() => SplitSignature(signature)).toThrow(
        expect.objectContaining({
          statusCode: 400,
          type: 'invalid_request_error',
        })
      );
    });
  });

  describe('VerifyCheckoutReceipt', () => {
    let logIndex = 0;

    beforeEach(() => {
      logIndex = 0;
    });

    function AuthorizationUsed(
      nonce: Hex = SessionNonce(SESSION),
      authorizer: Address = BUYER,
      address: Address = USDC
    ): Log {
      return BuildLog(
        address,
        encodeEventTopics({
          abi: USDC_ABI,
          eventName: 'AuthorizationUsed',
          args: { authorizer, nonce },
        }),
        '0x'
      );
    }

    function Transfer(
      to: Address,
      value: bigint,
      from: Address = BUYER,
      address: Address = USDC
    ): Log {
      return BuildLog(
        address,
        encodeEventTopics({
          abi: USDC_ABI,
          eventName: 'Transfer',
          args: { from, to },
        }),
        encodeAbiParameters([{ type: 'uint256' }], [value])
      );
    }

    function BuildLog(address: Address, topics: unknown[], data: Hex): Log {
      return {
        address,
        topics: topics as Log['topics'],
        data,
        blockHash: `0x${'cc'.repeat(32)}`,
        blockNumber: 20n,
        logIndex: logIndex++,
        transactionHash: `0x${'aa'.repeat(32)}`,
        transactionIndex: 0,
        removed: false,
      };
    }

    function Receipt(
      logs: Log[],
      status: TransactionReceipt['status'] = 'success'
    ): TransactionReceipt {
      return {
        status,
        logs,
        transactionHash: `0x${'aa'.repeat(32)}`,
        blockNumber: 20n,
      } as unknown as TransactionReceipt;
    }

    it('accepts the session authorization paying the merchant and reads the payer from Transfer.from', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([AuthorizationUsed(), Transfer(MERCHANT, 12_340_000n)]),
          { ...EXPECTED, merchant: MERCHANT.toLowerCase() }
        )
      ).toEqual({
        status: 'verified',
        amount_cents: 1234,
        payer_address: BUYER,
      });
    });

    it('accepts a transfer above the amount due', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([AuthorizationUsed(), Transfer(MERCHANT, 12_350_000n)]),
          EXPECTED
        )
      ).toMatchObject({ status: 'verified', amount_cents: 1235 });
    });

    it('rejects an authorization whose nonce is not keccak256(session.id), even when the merchant got the right amount', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([
            AuthorizationUsed(SessionNonce('cs_z_other')),
            Transfer(MERCHANT, 12_340_000n),
          ]),
          EXPECTED
        )
      ).toMatchObject({
        status: 'failed',
        failure_reason: expect.stringMatching(/authorization/),
      });
    });

    it('rejects the session authorization when its transfer does not pay the merchant', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([AuthorizationUsed(), Transfer(OTHER, 12_340_000n)]),
          EXPECTED
        )
      ).toMatchObject({
        status: 'failed',
        failure_reason: expect.stringMatching(/merchant/),
      });
    });

    it('rejects the session authorization paying someone else beside a plain transfer to the merchant', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([
            AuthorizationUsed(),
            Transfer(OTHER, 12_340_000n),
            Transfer(MERCHANT, 12_340_000n),
          ]),
          EXPECTED
        )
      ).toMatchObject({ status: 'failed' });
    });

    it('rejects a transfer below the amount due', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([AuthorizationUsed(), Transfer(MERCHANT, 12_339_999n)]),
          EXPECTED
        )
      ).toMatchObject({
        status: 'failed',
        failure_reason: expect.stringMatching(/amount/),
      });
    });

    it('rejects a transfer from someone other than the authorizer', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([
            AuthorizationUsed(),
            Transfer(MERCHANT, 12_340_000n, OTHER),
          ]),
          EXPECTED
        )
      ).toMatchObject({ status: 'failed' });
    });

    it('rejects the same events emitted by another contract', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([
            AuthorizationUsed(undefined, undefined, FAKE_TOKEN),
            Transfer(MERCHANT, 12_340_000n, BUYER, FAKE_TOKEN),
          ]),
          EXPECTED
        )
      ).toMatchObject({ status: 'failed' });
    });

    it('rejects a reverted transaction', () => {
      expect(
        VerifyCheckoutReceipt(Receipt([], 'reverted'), EXPECTED)
      ).toMatchObject({
        status: 'failed',
        failure_reason: expect.stringMatching(/reverted/),
      });
    });

    it('accepts a second authorizer that pays when the first does not', () => {
      expect(
        VerifyCheckoutReceipt(
          Receipt([
            AuthorizationUsed(undefined, OTHER),
            Transfer(OTHER, 12_340_000n, OTHER),
            AuthorizationUsed(),
            Transfer(MERCHANT, 12_340_000n),
          ]),
          EXPECTED
        )
      ).toEqual({
        status: 'verified',
        amount_cents: 1234,
        payer_address: BUYER,
      });
    });
  });
});
