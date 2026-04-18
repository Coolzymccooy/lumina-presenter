export type DeviceKind =
  | 'mixer'
  | 'camera'
  | 'webcam-mic'
  | 'usb-mic'
  | 'laptop-mic'
  | 'virtual'
  | 'phone'
  | 'unknown';

export interface RankedDevice {
  device: MediaDeviceInfo;
  kind: DeviceKind;
  score: number;
  recommended: boolean;
  hint: string;
}

const MATCHERS: [DeviceKind, RegExp][] = [
  ['mixer', /mixer|interface|focusrite|behringer|presonus|yamaha|allen|midas|x32|m32|scarlett|audient/i],
  ['virtual', /virtual|cable|vb-audio|loopback|blackhole|ndi|obs/i],
  ['usb-mic', /usb|yeti|snowball|shure|rode|samson|at2020|blue/i],
  ['webcam-mic', /webcam|c920|c922|c930|brio|logi|facecam/i],
  ['camera', /camera|camcorder|hdmi|capture card|elgato|decklink/i],
  ['phone', /iphone|android|continuity|galaxy|pixel/i],
  ['laptop-mic', /internal|built-in|microphone array|realtek|integrated/i],
];

const KIND_SCORES: Record<DeviceKind, number> = {
  mixer: 1.0,
  'usb-mic': 0.85,
  'webcam-mic': 0.7,
  camera: 0.6,
  virtual: 0.5,
  'laptop-mic': 0.3,
  unknown: 0.2,
  phone: 0.1,
};

const KIND_HINTS: Record<DeviceKind, string> = {
  mixer: 'Likely best — mixer/interface feed',
  'usb-mic': 'Good — dedicated USB microphone',
  'webcam-mic': 'Decent — webcam microphone',
  camera: 'Camera audio — may need cleanup',
  virtual: 'Virtual audio device',
  'laptop-mic': 'Built-in mic — expect room noise',
  unknown: 'Unknown device',
  phone: 'Phone microphone — not ideal',
};

export function classifyDevice(label: string): DeviceKind {
  for (const [kind, re] of MATCHERS) {
    if (re.test(label)) return kind;
  }
  return 'unknown';
}

export function suggestCaptureMode(kind: DeviceKind): import('./capturePresets').CaptureModeId {
  switch (kind) {
    case 'mixer': return 'church-mixer';
    case 'camera':
    case 'virtual': return 'camera-ndi';
    case 'laptop-mic':
    case 'webcam-mic': return 'laptop-rescue';
    default: return 'basic-clean';
  }
}

export function rankDevices(devices: MediaDeviceInfo[]): RankedDevice[] {
  const ranked = devices.map((device) => {
    const kind = classifyDevice(device.label);
    return {
      device,
      kind,
      score: KIND_SCORES[kind],
      recommended: false,
      hint: KIND_HINTS[kind],
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  if (ranked.length > 0) {
    ranked[0].recommended = true;
  }

  return ranked;
}
