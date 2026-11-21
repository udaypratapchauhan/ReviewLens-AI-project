import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createCache } from './cache.js';

describe('createCache file caching', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewlens-cache-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const sampleAnalysis = {
    sentiment: 'positive',
    topics: ['quality'],
    summary: 'Great quality bedsheet.',
    needs_reply: false
  };

  it('set, save, then a new createCache on the same file returns the value', () => {
    const cachePath = path.join(tempDir, 'analysis.json');
    const cache1 = createCache(cachePath);

    cache1.set('hash123', sampleAnalysis);
    cache1.save();

    const cache2 = createCache(cachePath);
    expect(cache2.get('hash123')).toEqual(sampleAnalysis);
  });

  it('missing file, empty file and corrupt JSON all give an empty cache without throwing', () => {
    const missingPath = path.join(tempDir, 'missing.json');
    expect(() => {
      const cacheMissing = createCache(missingPath);
      expect(cacheMissing.get('any_hash')).toBeUndefined();
    }).not.toThrow();

    const emptyPath = path.join(tempDir, 'empty.json');
    fs.writeFileSync(emptyPath, '   ');
    expect(() => {
      const cacheEmpty = createCache(emptyPath);
      expect(cacheEmpty.get('any_hash')).toBeUndefined();
    }).not.toThrow();

    const corruptPath = path.join(tempDir, 'corrupt.json');
    fs.writeFileSync(corruptPath, '{ corrupt json invalid: 123');
    expect(() => {
      const cacheCorrupt = createCache(corruptPath);
      expect(cacheCorrupt.get('any_hash')).toBeUndefined();
    }).not.toThrow();
  });

  it('a leftover .tmp file does not break loading', () => {
    const cachePath = path.join(tempDir, 'analysis.json');
    const tmpPath = `${cachePath}.tmp`;

    // Valid cache file
    fs.writeFileSync(cachePath, JSON.stringify({ hash456: sampleAnalysis }));
    // Leftover .tmp file with corrupt content
    fs.writeFileSync(tmpPath, 'corrupted leftover content');

    const cache = createCache(cachePath);
    expect(cache.get('hash456')).toEqual(sampleAnalysis);

    // Also test when main file does not exist, but .tmp file exists
    const cachePathOnlyTmp = path.join(tempDir, 'only_tmp.json');
    fs.writeFileSync(`${cachePathOnlyTmp}.tmp`, 'some old data');
    const cacheOnlyTmp = createCache(cachePathOnlyTmp);
    expect(cacheOnlyTmp.get('hash456')).toBeUndefined();
  });
});
