/**
 * Noise Gate AudioWorklet processor.
 *
 * A simple RMS-driven gate that attenuates samples below the threshold.
 * Parameters are set once at construction via processorOptions.
 */
class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    this._thresholdLinear = Math.pow(10, (opts.thresholdDb ?? -55) / 20);
    this._ratio = opts.ratio ?? 2;
    this._releaseMs = opts.releaseMs ?? 250;
    this._releaseSamples = Math.round((this._releaseMs / 1000) * sampleRate);
    this._holdCounter = 0;
    this._currentGain = 1.0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    for (let ch = 0; ch < input.length; ch++) {
      const inCh = input[ch];
      const outCh = output[ch];

      let rms = 0;
      for (let i = 0; i < inCh.length; i++) {
        rms += inCh[i] * inCh[i];
      }
      rms = Math.sqrt(rms / inCh.length);

      if (rms >= this._thresholdLinear) {
        this._currentGain = 1.0;
        this._holdCounter = this._releaseSamples;
      } else if (this._holdCounter > 0) {
        this._holdCounter -= inCh.length;
      } else {
        const targetGain = 1.0 / this._ratio;
        this._currentGain += (targetGain - this._currentGain) * 0.05;
      }

      for (let i = 0; i < inCh.length; i++) {
        outCh[i] = inCh[i] * this._currentGain;
      }
    }
    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
