import { describe, it, expect } from 'vitest';
import { classifyDevice, rankDevices, suggestCaptureMode } from './devicePicker';

function mockDevice(label: string, deviceId = 'test-id'): MediaDeviceInfo {
  return {
    deviceId,
    groupId: 'group-1',
    kind: 'audioinput',
    label,
    toJSON: () => ({}),
  };
}

describe('classifyDevice', () => {
  it('detects mixer/interface devices', () => {
    expect(classifyDevice('Focusrite Scarlett 2i2')).toBe('mixer');
    expect(classifyDevice('Behringer UMC202HD')).toBe('mixer');
    expect(classifyDevice('Yamaha AG06')).toBe('mixer');
    expect(classifyDevice('Allen & Heath SQ-5')).toBe('mixer');
    expect(classifyDevice('Midas M32')).toBe('mixer');
    expect(classifyDevice('USB Audio Interface')).toBe('mixer');
  });

  it('detects USB microphones', () => {
    expect(classifyDevice('Yeti USB Microphone')).toBe('usb-mic');
    expect(classifyDevice('Blue Snowball iCE')).toBe('usb-mic');
    expect(classifyDevice('Shure MV7')).toBe('usb-mic');
    expect(classifyDevice('Rode NT-USB')).toBe('usb-mic');
    expect(classifyDevice('Samson Q2U')).toBe('usb-mic');
  });

  it('detects webcam microphones', () => {
    expect(classifyDevice('Logitech C920 Microphone')).toBe('webcam-mic');
    expect(classifyDevice('Brio 4K Stream')).toBe('webcam-mic');
    expect(classifyDevice('Webcam Audio')).toBe('webcam-mic');
  });

  it('detects camera/capture devices', () => {
    expect(classifyDevice('Elgato HD60 S+')).toBe('camera');
    expect(classifyDevice('HDMI Capture Audio')).toBe('camera');
    expect(classifyDevice('Decklink Mini Recorder')).toBe('camera');
  });

  it('detects virtual audio devices', () => {
    expect(classifyDevice('VB-Audio Virtual Cable')).toBe('virtual');
    expect(classifyDevice('BlackHole 2ch')).toBe('virtual');
    expect(classifyDevice('OBS Virtual Audio')).toBe('virtual');
    expect(classifyDevice('NDI Audio')).toBe('virtual');
  });

  it('detects laptop/built-in mics', () => {
    expect(classifyDevice('Microphone Array (Realtek)')).toBe('laptop-mic');
    expect(classifyDevice('Internal Microphone')).toBe('laptop-mic');
    expect(classifyDevice('Built-in Audio')).toBe('laptop-mic');
  });

  it('detects phone audio', () => {
    expect(classifyDevice('iPhone Microphone')).toBe('phone');
    expect(classifyDevice('Continuity Microphone')).toBe('phone');
  });

  it('returns unknown for unrecognized labels', () => {
    expect(classifyDevice('Some Random Device')).toBe('unknown');
    expect(classifyDevice('')).toBe('unknown');
  });
});

describe('suggestCaptureMode', () => {
  it('maps mixer to church-mixer', () => {
    expect(suggestCaptureMode('mixer')).toBe('church-mixer');
  });

  it('maps camera/virtual to camera-ndi', () => {
    expect(suggestCaptureMode('camera')).toBe('camera-ndi');
    expect(suggestCaptureMode('virtual')).toBe('camera-ndi');
  });

  it('maps laptop-mic/webcam-mic to laptop-rescue', () => {
    expect(suggestCaptureMode('laptop-mic')).toBe('laptop-rescue');
    expect(suggestCaptureMode('webcam-mic')).toBe('laptop-rescue');
  });

  it('maps usb-mic/unknown to basic-clean', () => {
    expect(suggestCaptureMode('usb-mic')).toBe('basic-clean');
    expect(suggestCaptureMode('unknown')).toBe('basic-clean');
  });
});

describe('rankDevices', () => {
  it('ranks mixer above laptop mic', () => {
    const devices = [
      mockDevice('Microphone Array (Realtek)', 'laptop'),
      mockDevice('Focusrite Scarlett 2i2', 'mixer'),
    ];
    const ranked = rankDevices(devices);
    expect(ranked[0].kind).toBe('mixer');
    expect(ranked[0].recommended).toBe(true);
    expect(ranked[1].kind).toBe('laptop-mic');
    expect(ranked[1].recommended).toBe(false);
  });

  it('ranks usb-mic above webcam-mic', () => {
    const devices = [
      mockDevice('Logitech C920 Mic', 'webcam'),
      mockDevice('Blue Yeti', 'yeti'),
    ];
    const ranked = rankDevices(devices);
    expect(ranked[0].kind).toBe('usb-mic');
    expect(ranked[1].kind).toBe('webcam-mic');
  });

  it('marks exactly one device as recommended', () => {
    const devices = [
      mockDevice('Device A'),
      mockDevice('Device B'),
      mockDevice('Focusrite Scarlett', 'scarlett'),
    ];
    const ranked = rankDevices(devices);
    const recommended = ranked.filter((r) => r.recommended);
    expect(recommended).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(rankDevices([])).toEqual([]);
  });

  it('every ranked device has a hint string', () => {
    const devices = [mockDevice('Yeti USB'), mockDevice('Internal Mic')];
    const ranked = rankDevices(devices);
    for (const r of ranked) {
      expect(r.hint.length).toBeGreaterThan(0);
    }
  });
});
