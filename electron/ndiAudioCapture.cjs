/**
 * ndiAudioCapture.cjs — returns a JS string that main.cjs injects into the
 * Lumina-Program offscreen BrowserWindow after the page finishes loading.
 *
 * The injected script:
 *   1. Builds a shared AudioContext.
 *   2. Watches the DOM for <video> / <audio> elements and routes each into
 *      a MediaElementAudioSourceNode → shared mixer node.
 *   3. Loads a tiny AudioWorklet that batches interleaved Float32 stereo
 *      PCM into 20ms chunks (960 samples @ 48kHz) and postMessages them
 *      to the main thread.
 *   4. Forwards every chunk to the Electron main process via
 *      window.electron.ndi.sendAudioFrame, which routes to the Program
 *      NDI sender.
 *
 * The worklet source is embedded as a Blob URL so we don't need to publish
 * a separate asset; this keeps the capture self-contained.
 *
 * Limitations (documented for Phase 5b follow-up):
 *   - Cross-origin iframes (e.g. YouTube embeds) can't be tapped via
 *     MediaElementAudioSourceNode — their audio won't appear on NDI.
 *   - Sample rate is whatever AudioContext negotiates with the device
 *     (usually 48kHz on Windows, sometimes 44.1kHz). Receivers resample
 *     if needed; Phase 5b will do explicit 48kHz resampling.
 */

function buildCaptureScript() {
  return `
(function () {
  if (window.__luminaNdiAudioTap) return;
  window.__luminaNdiAudioTap = true;

  var BATCH_SAMPLES = 960;   // 20ms @ 48kHz
  var MAX_INFLIGHT_LOG = 3;

  var workletSource = [
    'class NdiAudioWorklet extends AudioWorkletProcessor {',
    '  constructor(options) {',
    '    super();',
    '    this.batch = (options && options.processorOptions && options.processorOptions.batch) || 960;',
    '    this.offset = 0;',
    '    this.left = new Float32Array(this.batch);',
    '    this.right = new Float32Array(this.batch);',
    '  }',
    '  process(inputs) {',
    '    var input = inputs[0];',
    '    if (!input || !input.length || !input[0]) return true;',
    '    var l = input[0];',
    '    var r = input.length > 1 ? input[1] : input[0];',
    '    var n = l.length;',
    '    for (var i = 0; i < n; i++) {',
    '      this.left[this.offset] = l[i];',
    '      this.right[this.offset] = r[i];',
    '      this.offset++;',
    '      if (this.offset >= this.batch) {',
    '        var interleaved = new Float32Array(this.batch * 2);',
    '        for (var j = 0; j < this.batch; j++) {',
    '          interleaved[j * 2] = this.left[j];',
    '          interleaved[j * 2 + 1] = this.right[j];',
    '        }',
    '        this.port.postMessage({ pcm: interleaved.buffer, samples: this.batch }, [interleaved.buffer]);',
    '        this.offset = 0;',
    '      }',
    '    }',
    '    return true;',
    '  }',
    '}',
    'registerProcessor("ndi-audio-worklet", NdiAudioWorklet);'
  ].join('\\n');

  function safeLog(msg) {
    try { console.log('[NDI-AUDIO] ' + msg); } catch (_) {}
  }

  function attachElement(el, ctx, mixer) {
    if (el.__luminaNdiTapped) return;
    try {
      var src = ctx.createMediaElementSource(el);
      src.connect(mixer);
      el.__luminaNdiTapped = true;
      safeLog('tapped ' + (el.tagName || 'media') + ' src=' + (el.currentSrc || '').slice(0, 120));
    } catch (err) {
      // Cross-origin media, already-tapped elements, detached frames, etc.
      safeLog('tap failed: ' + (err && err.message ? err.message : String(err)));
    }
  }

  function scanAndAttach(ctx, mixer) {
    var nodes = document.querySelectorAll('video,audio');
    for (var i = 0; i < nodes.length; i++) attachElement(nodes[i], ctx, mixer);
  }

  async function bootstrap() {
    if (typeof window.AudioContext !== 'function' && typeof window.webkitAudioContext !== 'function') {
      safeLog('AudioContext unavailable — cannot embed audio on NDI.');
      return;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx();
    // Resume on any user gesture — offscreen windows won't get one, but
    // Electron's autoplayPolicy usually allows playback anyway.
    try { await ctx.resume(); } catch (_) {}

    var mixer = ctx.createGain();
    mixer.gain.value = 1.0;

    try {
      var blob = new Blob([workletSource], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
    } catch (err) {
      safeLog('worklet load failed: ' + (err && err.message ? err.message : String(err)));
      return;
    }

    var worklet = new AudioWorkletNode(ctx, 'ndi-audio-worklet', {
      processorOptions: { batch: BATCH_SAMPLES },
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    mixer.connect(worklet);

    var dropCount = 0;
    worklet.port.onmessage = function (event) {
      var msg = event && event.data;
      if (!msg || !msg.pcm) return;
      try {
        var api = window.electron && window.electron.ndi && window.electron.ndi.sendAudioFrame;
        if (typeof api !== 'function') return;
        api({
          pcm: msg.pcm,
          sampleRate: ctx.sampleRate,
          channels: 2,
          samples: msg.samples,
        });
      } catch (err) {
        dropCount++;
        if (dropCount <= MAX_INFLIGHT_LOG) {
          safeLog('ipc send failed: ' + (err && err.message ? err.message : String(err)));
        }
      }
    };

    scanAndAttach(ctx, mixer);
    var mo = new MutationObserver(function () { scanAndAttach(ctx, mixer); });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

    safeLog('audio tap active @ ' + ctx.sampleRate + 'Hz stereo');
  }

  bootstrap().catch(function (err) {
    safeLog('bootstrap error: ' + (err && err.message ? err.message : String(err)));
  });
})();
`;
}

module.exports = { buildCaptureScript };
