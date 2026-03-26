const React = require('react');

const View             = (props) => null;
const Text             = (props) => null;
const TouchableOpacity = (props) => null;
const Switch           = (props) => null;
const Modal            = (props) => null;
const SafeAreaView     = (props) => null;
const ScrollView       = (props) => null;
const ActivityIndicator = (props) => null;
const Image            = (props) => null;
const StyleSheet = {
  create: (styles) => styles,
  absoluteFill: {},
  flatten: (style) => style,
};
const Alert = { alert: jest.fn() };
const Platform = { OS: 'android', select: (obj) => obj.android ?? obj.default };

module.exports = {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
  Platform,
};
