import { describe, it, expect, vi } from 'vitest';
import { withBackoff } from './retry.js';

describe('withBackoff exponential backoff and retry', () => {
  it('succeeds after 2 failures with 503 (3 calls total)', async () => {
    const error503 = Object.assign(new Error('Service Unavailable'), { status: 503 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error503)
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce('success');
    const sleep = vi.fn();

    const result = await withBackoff(fn, { sleep });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after max retries and throws the last error', async () => {
    const error500 = Object.assign(new Error('Server Error'), { status: 500 });
    const fn = vi.fn().mockRejectedValue(error500);
    const sleep = vi.fn();

    await expect(withBackoff(fn, { retries: 3, sleep })).rejects.toThrow('Server Error');
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 400 or 401 (1 call)', async () => {
    const sleep = vi.fn();

    const error400 = Object.assign(new Error('Bad Request'), { status: 400 });
    const fn400 = vi.fn().mockRejectedValue(error400);
    await expect(withBackoff(fn400, { sleep })).rejects.toThrow('Bad Request');
    expect(fn400).toHaveBeenCalledTimes(1);

    const error401 = Object.assign(new Error('Unauthorized'), { status: 401 });
    const fn401 = vi.fn().mockRejectedValue(error401);
    await expect(withBackoff(fn401, { sleep })).rejects.toThrow('Unauthorized');
    expect(fn401).toHaveBeenCalledTimes(1);

    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries on 429 and honours retryAfterMs', async () => {
    const error429 = Object.assign(new Error('Rate Limited'), {
      status: 429,
      retryAfterMs: 5000
    });
    const fn = vi.fn().mockRejectedValueOnce(error429).mockResolvedValueOnce('ok');
    const sleep = vi.fn();

    const result = await withBackoff(fn, { baseMs: 1000, random: () => 0, sleep });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it('retries on an error with retryable = true', async () => {
    const netErr = Object.assign(new Error('ECONNRESET'), { retryable: true });
    const fn = vi.fn().mockRejectedValueOnce(netErr).mockResolvedValueOnce('ok');
    const sleep = vi.fn();

    const result = await withBackoff(fn, { sleep });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry a plain Error with no status and no retryable flag', async () => {
    const plainErr = new Error('Missing environment variable');
    const fn = vi.fn().mockRejectedValue(plainErr);
    const sleep = vi.fn();

    await expect(withBackoff(fn, { sleep })).rejects.toThrow('Missing environment variable');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('delay grows exponentially (check sleep arguments with random = () => 0)', async () => {
    const error503 = Object.assign(new Error('503'), { status: 503 });
    const fn = vi.fn().mockRejectedValue(error503);
    const sleep = vi.fn();

    await expect(
      withBackoff(fn, { retries: 3, baseMs: 1000, maxMs: 10000, random: () => 0, sleep })
    ).rejects.toThrow();

    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    expect(sleep).toHaveBeenNthCalledWith(3, 4000);
  });
});
