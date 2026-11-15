import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedback, setSoundEnabled, soundEnabled } from './sounds';

describe('scan sounds and vibration', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('are on by default and can be turned off on this phone', () => {
    expect(soundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(soundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(soundEnabled()).toBe(true);
  });

  it('play tones and vibrate when on; stay silent when off', () => {
    const started: number[] = [];
    class FakeAudio {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume() {}
      createGain() {
        const ramp = () => {};
        return { gain: { setValueAtTime: ramp, exponentialRampToValueAtTime: ramp }, connect: (n: unknown) => n };
      }
      createOscillator() {
        const ramp = () => {};
        return { type: 'sine', frequency: { setValueAtTime: ramp, exponentialRampToValueAtTime: ramp }, connect: (n: unknown) => n, start: (t: number) => started.push(t), stop: () => {} };
      }
    }
    vi.stubGlobal('AudioContext', FakeAudio);
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, vibrate });

    feedback('scan');
    expect(started.length).toBe(2);
    expect(vibrate).toHaveBeenCalledWith(35);
    feedback('done');
    expect(started.length).toBe(5); // two-tone chime + shimmer
    setSoundEnabled(false);
    feedback('error');
    expect(started.length).toBe(5);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('do nothing (and never throw) where the browser has no audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => feedback('scan')).not.toThrow();
  });
});
