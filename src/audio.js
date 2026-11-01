// All sounds are synthesized locally, after a user gesture.
export function createAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let context, output, muted = false;

  function unlock() {
    if (!AudioContext) return;
    try {
      if (!context) {
        context = new AudioContext();
        output = context.createGain(); output.gain.value = muted ? 0 : 0.18;
        output.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Sound is optional when the browser blocks audio. */ }
  }

  function tone(frequency, duration, delay = 0, endFrequency = frequency) {
    if (!context || context.state !== 'running' || muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.6, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(envelope); envelope.connect(output);
    oscillator.start(start); oscillator.stop(start + duration);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  function splash() {
    if (!context || context.state !== 'running' || muted) return;
    const duration = 0.22, buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2;
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 1400;
    source.connect(filter); filter.connect(output); source.start();
    source.onended = () => { source.disconnect(); filter.disconnect(); };
  }

  return {
    supported: Boolean(AudioContext), unlock, splash,
    bite: () => tone(520, 0.16, 0, 130),
    catch: () => [523.25, 659.25, 783.99].forEach((frequency, i) => tone(frequency, 0.2, i * 0.11)),
    toggleMute() {
      muted = !muted; unlock();
      if (output) output.gain.setValueAtTime(muted ? 0 : 0.18, context.currentTime);
      return muted;
    }
  };
}
