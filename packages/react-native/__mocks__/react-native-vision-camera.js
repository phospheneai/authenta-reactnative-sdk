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

const usePhotoOutput = () => ({
  capturePhotoToFile: jest.fn().mockResolvedValue({ filePath: '/tmp/mock-photo.jpg' }),
});

const useVideoOutput = () => ({
  createRecorder: jest.fn().mockResolvedValue({
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    cancelRecording: jest.fn().mockResolvedValue(undefined),
    filePath: '/tmp/mock-video.mp4',
    isRecording: false,
    isPaused: false,
    recordedDuration: 0,
    recordedFileSize: 0,
  }),
});

module.exports = {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
};
