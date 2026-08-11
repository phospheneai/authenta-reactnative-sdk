/**
 * Limits, colours, and the one stylesheet both modals share.
 */

import { StyleSheet } from 'react-native';

// ─── Limits ───────────────────────────────────────────────────────────────────

export const MAX_RETRIES = 3;
export const VIDEO_MAX_DURATION_MS = 10_000;
export const VIDEO_SIZE_LIMIT_BYTES = 6 * 1024 * 1024; // 6 MB

// ─── Colours ──────────────────────────────────────────────────────────────────

export const ACCENT = '#6366f1';
export const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** [background, foreground] pairs for status pills and the outcome icon. */
export const TONES = {
  ok:      ['#d1fae5', '#047857'],
  bad:     ['#fee2e2', '#b91c1c'],
  pending: ['#fef3c7', '#b45309'],
} as const;

export type Tone = keyof typeof TONES;

// ─── Styles ───────────────────────────────────────────────────────────────────

export const s = StyleSheet.create({
  // Layout
  safe:    { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24, paddingBottom: 48 },
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Header + text
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title:      { fontSize: 22, fontWeight: '700', color: '#111827', flex: 1 },
  subtitle:   { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 24 },
  hint:       { fontSize: 12, color: '#9ca3af', marginBottom: 16, lineHeight: 18 },
  mono:       { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  spinnerText:{ marginTop: 18, fontSize: 15, color: '#6b7280', fontWeight: '500' },
  closeBtn:     { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#9ca3af', fontWeight: '600' },

  // Buttons
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  secondaryBtnText: { color: ACCENT, fontSize: 17, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },

  // Outcome icon
  icon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, alignSelf: 'center',
  },
  iconText: { fontSize: 28, fontWeight: '700' },

  // Cards, rows, key/value pairs
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardPad:  { padding: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  rowBorder:{ borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rowThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#e5e7eb' },
  rowIcon:  { fontSize: 26, width: 34, textAlign: 'center' },
  rowText:  { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowMeta:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rowError: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  kvRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  kvLabel:  { fontSize: 13, color: '#6b7280' },
  kvValue:  { fontSize: 13, fontWeight: '600', color: '#111827' },

  // Status pill
  badge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  // Image preview + picker grid
  preview: { alignItems: 'center', marginBottom: 20 },
  thumb: {
    width: 160, height: 160,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#e5e7eb',
  },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tile:     { width: 96, height: 96, borderRadius: 12, backgroundColor: '#e5e7eb' },
  tileWrap: { position: 'relative' },
  tileX: {
    position: 'absolute', top: -6, right: -6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
  },
  tileXText: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  slot: {
    width: 96, height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  slotText: { fontSize: 24, color: '#9ca3af' },

  // Search results
  rank:      { width: 26, height: 26, borderRadius: 13, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  rankText:  { fontSize: 12, fontWeight: '700', color: ACCENT },
  score:     { fontSize: 15, fontWeight: '700', color: '#111827' },
  empty:     { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21 },

  // Error message box
  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, marginVertical: 16 },
  errorText: { fontSize: 13, color: '#b91c1c', lineHeight: 20 },

  // ─── Camera overlays (CameraScreen) ─────────────────────────────────────────
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  cameraTopOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cameraBackBtn:     { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cameraBackBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cameraModeBadge:   { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  cameraModeBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cameraFlipBtn:         { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, alignItems: 'center' },
  cameraFlipBtnDisabled: { opacity: 0.35 },
  cameraFlipBtnText:     { fontSize: 18, color: '#fff' },
  cameraFlipBtnLabel:    { fontSize: 10, color: '#fff', fontWeight: '600', marginTop: 1 },
  cameraBottomOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingBottom: 40,
    paddingTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraHint:        { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 20, textAlign: 'center', paddingHorizontal: 24 },
  cameraControls:    { flexDirection: 'row', gap: 32, marginBottom: 12 },
  captureBtnWrapper: { alignItems: 'center', gap: 6 },
  captureBtnLabel:   { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  cameraAttempts:    { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnDisabled: { opacity: 0.45 },
  captureBtnDot:  { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  recordBtn:      { borderColor: '#ef4444' },
  recordBtnDot:   { backgroundColor: '#ef4444' },
  stopBtn:        { borderColor: '#ef4444' },
  stopBtnSquare:  { width: 28, height: 28, borderRadius: 4, backgroundColor: '#ef4444' },
});
