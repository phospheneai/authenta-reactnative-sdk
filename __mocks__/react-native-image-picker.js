const launchImageLibrary = jest.fn((options, callback) => {
  if (callback) {
    callback({ didCancel: true });
  }
  return Promise.resolve({ didCancel: true });
});

const launchCamera = jest.fn((options, callback) => {
  if (callback) {
    callback({ didCancel: true });
  }
  return Promise.resolve({ didCancel: true });
});

module.exports = {
  launchImageLibrary,
  launchCamera,
};
