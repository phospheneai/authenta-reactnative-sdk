const React = require('react');

const Camera = React.forwardRef((props, ref) => null);
Camera.getAvailableCameraDevices = () => [];

const useCameraDevice = () => ({
  id: 'mock-device',
  position: 'front',
  name: 'Mock Camera',
  hasFlash: false,
  hasTorch: false,
  isMultiCam: false,
  minZoom: 1,
  maxZoom: 1,
  neutralZoom: 1,
  formats: [],
  supportsDepthCapture: false,
  supportsRawCapture: false,
  supportsFocus: false,
});

const useCameraPermission = () => ({
  hasPermission: true,
  requestPermission: jest.fn().mockResolvedValue(true),
});

const useMicrophonePermission = () => ({
  hasPermission: true,
  requestPermission: jest.fn().mockResolvedValue(true),
});

module.exports = {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
};
