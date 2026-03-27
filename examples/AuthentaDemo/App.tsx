/**
 * Authenta Demo App
 *
 * This is the ONLY file a client developer needs to write.
 *
 * Steps:
 *  1. Create an AuthentaClient with your credentials.
 *  2. Toggle which checks you want to run.
 *  3. Tap "Start Detection" — AuthentaCapture opens the camera,
 *     captures the image/video, uploads it, polls for the result,
 *     and returns the finished ProcessedMedia object.
 *  4. Display whatever you want from the result.
 *
 * The SDK handles: camera permission, VisionCamera, capture/record,
 * reference image picker, upload, S3, polling, retries, error UI.
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Import ONLY these two things from the SDK ──────────────────────────────
import { AuthentaClient } from '@authenta/core';
import type { ProcessedMedia } from '@authenta/core';
import {AuthentaCapture} from "@authenta/react-native";

// ─── 1. Create the client once (typically in a context or singleton) ─────────

const client = new AuthentaClient({
  baseUrl: 'https://platform.authenta.ai',
  clientId: '<CLIENT_ID>',
  clientSecret: '<CLIENT_SECRET>',
});

// ─── 2. Your screen ──────────────────────────────────────────────────────────

export default function App() {
  // Which checks to run — client app owns only this decision
  const [livenessCheck, setLivenessCheck]         = useState(false);
  const [faceswapCheck, setFaceswapCheck]         = useState(false);
  const [faceSimilarityCheck, setFaceSimilarityCheck] = useState(false);

  // Modal visibility
  const [captureOpen, setCaptureOpen] = useState(false);

  // Result / error from AuthentaCapture
  const [result, setResult] = useState<ProcessedMedia | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const atLeastOneEnabled = livenessCheck || faceswapCheck || faceSimilarityCheck;

  function handleResult(res: ProcessedMedia) {
    // The SDK finished everything — just display what you need
    setResult(res);
    setError(null);
  }

  function handleError(err: Error) {
    setError(err.message);
    setResult(null);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <Text style={s.heading}>Authenta Demo</Text>
        <Text style={s.subheading}>
          Toggle the checks you want, then tap Start.{'\n'}
          The SDK opens the camera and returns the result.
        </Text>

        {/* ── Toggles — the ONLY input the client app provides ──── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Detection Checks</Text>

          <ToggleRow
            label="Liveness Check"
            hint="Photo — is this a real live face?"
            value={livenessCheck}
            onValueChange={(v) => {
              setLivenessCheck(v);
              setResult(null);
            }}
          />

          <ToggleRow
            label="Faceswap Check"
            hint="Video (10 s) — detect AI face-swap"
            value={faceswapCheck}
            onValueChange={(v) => {
              setFaceswapCheck(v);
              // faceswap and faceSimilarity conflict — auto-clear
              if (v) setFaceSimilarityCheck(false);
              setResult(null);
            }}
          />

          <ToggleRow
            label="Face Similarity Check"
            hint="Photo — compare face to reference image"
            value={faceSimilarityCheck}
            onValueChange={(v) => {
              setFaceSimilarityCheck(v);
              // similarity and faceswap conflict — auto-clear
              if (v) setFaceswapCheck(false);
              setResult(null);
            }}
            last
          />
        </View>

        {/* ── Active checks summary ────────────────────────────── */}
        {atLeastOneEnabled && (
          <View style={s.summaryBox}>
            <Text style={s.summaryLabel}>Will run:</Text>
            {livenessCheck      && <Text style={s.summaryItem}>• Liveness check (photo)</Text>}
            {faceswapCheck      && <Text style={s.summaryItem}>• Faceswap check (video, 10 s)</Text>}
            {faceSimilarityCheck && <Text style={s.summaryItem}>• Face similarity (photo + reference image)</Text>}
          </View>
        )}

        {/* ── Start button ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.startBtn, !atLeastOneEnabled && s.startBtnDisabled]}
          onPress={() => {
            setResult(null);
            setError(null);
            setCaptureOpen(true);
          }}
          disabled={!atLeastOneEnabled}
        >
          <Text style={s.startBtnText}>
            {atLeastOneEnabled ? 'Start Detection' : 'Enable at least one check'}
          </Text>
        </TouchableOpacity>

        {/* ── Result display ────────────────────────────────────── */}
        {result && (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>Result</Text>

            <ResultRow label="Status"  value={result.status} />
            <ResultRow label="Model"   value={result.modelType} />
            <ResultRow label="Media ID" value={result.mid} />

            {result.result && (
              <>
                <View style={s.divider} />
                <ResultRow label="Is Liveness"      value={result.result.isLiveness} />
                <ResultRow label="Is Deepfake"      value={result.result.isDeepFake} />
                <ResultRow label="Is Similar"       value={result.result.isSimilar} />
                <ResultRow label="Similarity Score" value={result.result.similarityScore} />
              </>
            )}
          </View>
        )}

        {/* ── Error display ─────────────────────────────────────── */}
        {error && (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Error</Text>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

      </ScrollView>

      {/* ── 3. AuthentaCapture — client app passes checks, SDK does the rest ─ */}
      <AuthentaCapture
        client={client}
        modelType="FI-1"
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        livenessCheck={livenessCheck}
        faceswapCheck={faceswapCheck}
        faceSimilarityCheck={faceSimilarityCheck}
        onResult={(res) => {
          setCaptureOpen(false);
          handleResult(res);
        }}
        onError={(err) => {
          setCaptureOpen(false);
          handleError(err);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Small shared components ──────────────────────────────────────────────────

function ToggleRow({
  label, hint, value, onValueChange, last = false,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.toggleRow, !last && s.toggleRowBorder]}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.7}
    >
      <View style={s.toggleTextBlock}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: '#6366f1' }}
        thumbColor="#ffffff"
      />
    </TouchableOpacity>
  );
}

function ResultRow({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null) return null;
  return (
    <View style={s.resultRow}>
      <Text style={s.resultRowLabel}>{label}</Text>
      <Text style={s.resultRowValue}>{String(value)}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ACCENT = '#6366f1';

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, paddingBottom: 60 },

  heading:    { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subheading: { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 24 },

  // Card / toggles
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  toggleTextBlock: { flex: 1, marginRight: 12 },
  toggleLabel:     { fontSize: 15, fontWeight: '600', color: '#111827' },
  toggleHint:      { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  // Summary
  summaryBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: '#3730a3', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryItem:  { fontSize: 13, color: '#1e40af', lineHeight: 22 },

  // Start button
  startBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  startBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },

  // Result card
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 12, fontWeight: '700', color: '#059669',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  resultRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  resultRowLabel: { fontSize: 13, color: '#6b7280' },
  resultRowValue: { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1, textAlign: 'right' },
  divider:        { height: StyleSheet.hairlineWidth, backgroundColor: '#f3f4f6', marginVertical: 8 },

  // Error card
  errorCard:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorTitle: { fontSize: 12, fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  errorText:  { fontSize: 13, color: '#b91c1c', lineHeight: 20 },
});
