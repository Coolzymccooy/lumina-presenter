/**
 * ndiAudioCapture.cjs — NDI audio tap, invoked from the preload script.
 *
 * Runs inside the offscreen Lumina-Program BrowserWindow renderer process and
 * uses ipcRenderer directly so offscreen/context-isolated windows do not rely
 * on contextBridge timing.
 */

const BATCH_SAMPLES = 960; // 20ms @ 48kHz

const WORKLET_SOURCE = [
  'class NdiAudioWorklet extends AudioWorkletProcessor {',
  '  constructor(options) {',
  '    super();',
  '    this.batch = (options && options.processorOptions && options.processorOptions.batch) || 960;',
  '    this.offset = 0;',
  '    this.left = new Float32Array(this.batch);',
  '    this.right = new Float32Array(this.batch);',
  '  }',
  '  process(inputs, outputs) {',
  '    var input = inputs[0];',
  '    var output = outputs[0];',
  '    if (!input || !input.length || !input[0]) {',
  '      if (output && output.length) {',
  '        for (var z = 0; z < output.length; z++) output[z].fill(0);',
  '      }',
  '      return true;',
  '    }',
  '    var l = input[0];',
  '    var r = input.length > 1 ? input[1] : input[0];',
  '    if (output && output.length) {',
  '      var outL = output[0];',
  '      var outR = output.length > 1 ? output[1] : output[0];',
  '      for (var k = 0; k < l.length; k++) {',
  '        outL[k] = l[k];',
  '        outR[k] = r[k];',
  '      }',
  '    }',
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
  'registerProcessor("ndi-audio-worklet", NdiAudioWorklet);',
].join('\n');

const IFRAME_MEDIA_HOSTS = [
  'youtube.com', 'youtu.be', 'youtube-nocookie.com',
  'vimeo.com', 'player.vimeo.com',
  'soundcloud.com', 'w.soundcloud.com',
];

async function installNdiAudioCapture({ ipcRenderer }) {
  if (typeof window === 'undefined') return;
  if (window.__luminaNdiAudioTap) return;
  window.__luminaNdiAudioTap = true;

  const log = (msg) => {
    try { ipcRenderer.send('ndi:audio-debug', { message: msg }); } catch (_) { /* ignore */ }
    try { console.log('[NDI-AUDIO] ' + msg); } catch (_) { /* ignore */ }
  };

  log('installing (preload path, ipcRenderer=' + typeof ipcRenderer + ')');

  if (typeof window.AudioContext !== 'function' && typeof window.webkitAudioContext !== 'function') {
    log('AudioContext unavailable — cannot embed audio on NDI.');
    return;
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const resumeContext = async (reason) => {
    try {
      await ctx.resume();
      log('audio context state=' + ctx.state + ' via ' + reason);
    } catch (err) {
      log('audio context resume failed via ' + reason + ': ' + (err && err.message ? err.message : String(err)));
    }
  };
  try {
    ctx.onstatechange = () => log('audio context statechange -> ' + ctx.state);
  } catch (_) { /* ignore */ }
  await resumeContext('init');

  const mixer = ctx.createGain();
  mixer.gain.value = 1.0;

  try {
    const blob = new Blob([WORKLET_SOURCE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
  } catch (err) {
    log('worklet load failed: ' + (err && err.message ? err.message : String(err)));
    return;
  }

  const worklet = new AudioWorkletNode(ctx, 'ndi-audio-worklet', {
    processorOptions: { batch: BATCH_SAMPLES },
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  });
  mixer.connect(worklet);
  const silentSink = ctx.createGain();
  silentSink.gain.value = 0;
  worklet.connect(silentSink);
  silentSink.connect(ctx.destination);
  worklet.onprocessorerror = () => log('audio worklet processor error');

  let dropCount = 0;
  let frameCount = 0;
  worklet.port.onmessage = (event) => {
    const msg = event && event.data;
    if (!msg || !msg.pcm) return;
    try {
      ipcRenderer.send('ndi:audio-frame', {
        pcm: msg.pcm,
        sampleRate: ctx.sampleRate,
        channels: 2,
        samples: msg.samples,
      });
      frameCount++;
      if (frameCount === 1) log('first audio frame sent to main');
    } catch (err) {
      dropCount++;
      if (dropCount <= 3) {
        log('ipc send failed: ' + (err && err.message ? err.message : String(err)));
      }
    }
  };

  const attachElement = (el) => {
    if (el.__luminaNdiTapped) return;
    try {
      const src = ctx.createMediaElementSource(el);
      src.connect(mixer);
      el.__luminaNdiTapped = true;
      try {
        ipcRenderer.send('ndi:audio-warning', {
          code: 'capturable-media',
          src: String(el.currentSrc || el.src || '').slice(0, 200),
        });
      } catch (_) { /* ignore */ }
      const resumeOnMediaActivity = () => { void resumeContext('media-' + (el.tagName || 'media').toLowerCase()); };
      el.addEventListener('play', resumeOnMediaActivity);
      el.addEventListener('playing', resumeOnMediaActivity);
      log('tapped ' + (el.tagName || 'media') + ' src=' + (el.currentSrc || '').slice(0, 120));
    } catch (err) {
      log('tap failed: ' + (err && err.message ? err.message : String(err)));
    }
  };

  const scanAndAttach = () => {
    const nodes = document.querySelectorAll('video,audio');
    for (let i = 0; i < nodes.length; i++) attachElement(nodes[i]);
  };
  scanAndAttach();
  const mo = new MutationObserver(scanAndAttach);
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

  let currentMuted = false;
  const syncMute = () => {
    try {
      const raw = localStorage.getItem('lumina_session_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const nextMuted = !!(parsed && parsed.outputMuted);
      if (nextMuted !== currentMuted) {
        currentMuted = nextMuted;
        mixer.gain.setTargetAtTime(nextMuted ? 0 : 1, ctx.currentTime, 0.01);
        log('mute sync: ' + (nextMuted ? 'silenced' : 'live'));
      }
    } catch (_) { /* ignore */ }
  };
  syncMute();
  setInterval(syncMute, 400);

  let warnedForIframes = false;
  const checkIframes = () => {
    if (warnedForIframes) return;
    const frames = document.querySelectorAll('iframe');
    for (let i = 0; i < frames.length; i++) {
      const src = (frames[i].src || '').toLowerCase();
      if (!src) continue;
      for (let h = 0; h < IFRAME_MEDIA_HOSTS.length; h++) {
        if (src.indexOf(IFRAME_MEDIA_HOSTS[h]) !== -1) {
          warnedForIframes = true;
          log('cross-origin iframe detected: ' + src.slice(0, 120));
          try {
            ipcRenderer.send('ndi:audio-warning', { code: 'iframe-media', src });
            log('iframe warning IPC sent');
          } catch (err) {
            log('iframe warning IPC threw: ' + (err && err.message ? err.message : String(err)));
          }
          return;
        }
      }
    }
  };
  checkIframes();
  setInterval(checkIframes, 1500);

  window.__luminaNdiAudioTapState = { ctx, mixer, worklet, silentSink, mo };
  log('audio tap active @ ' + ctx.sampleRate + 'Hz stereo');
}

module.exports = { installNdiAudioCapture };
