/**
 * Authenta Demo App — the ONLY file a client developer needs to write.
 *
 * One client, one component, four toggles:
 *
 *   Detection      liveness / faceswap / similarity → AuthentaCapture opens the
 *                  camera (photo, video, or both per the toggles), uploads,
 *                  polls, and returns the finished ProcessedMedia.
 *
 *   Face indexing  imageIndexing → the same component switches to enrol/search:
 *                  add photos of a person, or match a face against them.
 *
 * The two are mutually exclusive — face indexing runs no detection model.
 * The SDK handles permissions, capture, compression, upload, polling, and
 * error UI. You just read the result.
 */

import React, { useState } from 'react';
import {
  Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import { AuthentaClient } from '@authenta/core';
import type { EnrollResponse, ProcessedMedia, SearchResponse } from '@authenta/core';
import { AuthentaCapture } from '@authenta/react-native';

// ─── One client for both features — your domain and API key ──────────────────

const client = new AuthentaClient({
  baseUrl: 'https://platform-dev.authenta.ai',
  api_key: 'api_d5bf8bb1716d1ff64c5669709946d6afd578ab3b98e9cf41a40196c408f3cd08',
  auth_enabled: true,
});

const CHECKS = [
  { key: 'liveness',   label: 'Liveness Check',        hint: 'Photo — is this a real live face?' },
  { key: 'faceswap',   label: 'Faceswap Check',        hint: 'Video (10 s) — detect AI face-swap' },
  { key: 'similarity', label: 'Face Similarity Check', hint: 'Photo — compare face to a reference' },
] as const;

type CheckKey = typeof CHECKS[number]['key'];

export default function App() {
  // The only input this app provides: which checks to run.
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    liveness: false, faceswap: false, similarity: false,
  });
  const [indexing, setIndexing] = useState(false);
  const [open, setOpen] = useState(false);

  // Whatever the SDK hands back.
  const [result, setResult]     = useState<ProcessedMedia | null>(null);
  const [enrolled, setEnrolled] = useState<EnrollResponse | null>(null);
  const [matches, setMatches]   = useState<SearchResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const anyCheck = Object.values(checks).some(Boolean);
  const canStart = indexing || anyCheck;

  const clear = () => { setResult(null); setEnrolled(null); setMatches(null); setError(null); };

  // Face indexing runs no detection model, so turning it on clears the checks.
  function toggleIndexing(value: boolean) {
    setIndexing(value);
    if (value) setChecks({ liveness: false, faceswap: false, similarity: false });
    clear();
  }

  function toggle(key: CheckKey, value: boolean) {
    if (indexing) return; // no detection model may run while indexing is on
    // faceswap and similarity conflict — enabling one clears the other.
    setChecks(c => ({
      ...c,
      [key]: value,
      ...(value && key === 'faceswap'   ? { similarity: false } : {}),
      ...(value && key === 'similarity' ? { faceswap: false }   : {}),
    }));
    clear();
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.heading}>Authenta Demo</Text>
        <Text style={s.sub}>
          Pick what you want, then tap Start. The SDK opens the camera and
          returns the result.
        </Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Face Indexing</Text>
          <Toggle
            label="Image Indexing"
            hint="Index a person's photos, then search for that face"
            value={indexing}
            onChange={toggleIndexing}
            last
          />
        </View>

        <View style={[s.card, indexing && s.muted]}>
          <Text style={s.cardTitle}>
            Detection Checks{indexing ? ' — unavailable while indexing' : ''}
          </Text>
          {CHECKS.map((check, i) => (
            <Toggle
              key={check.key}
              label={check.label}
              hint={check.hint}
              value={checks[check.key]}
              onChange={(v) => toggle(check.key, v)}
              last={i === CHECKS.length - 1}
              disabled={indexing}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[s.start, !canStart && s.startOff]}
          onPress={() => { clear(); setOpen(true); }}
          disabled={!canStart}
        >
          <Text style={s.startText}>
            {indexing ? 'Start Face Indexing'
              : anyCheck ? 'Start Detection' : 'Enable at least one check'}
          </Text>
        </TouchableOpacity>

        {/* ── Results — this is what your platform does with them ──────────── */}
        {result && (
          <Card title="Detection Result">
            <Line label="Status" value={result.status} />
            <Line label="Task"   value={result.taskTypeId} />
            <Line label="Job ID" value={result.id} />
            {result.result && <>
              <View style={s.divider} />
              <Line label="Is Spoof"         value={result.result.isSpoof} />
              <Line label="Is Deepfake"      value={result.result.isDeepFake} />
              <Line label="Is Similar"       value={result.result.isSimilar} />
              <Line label="Similarity Score" value={result.result.similarityScore} />
            </>}
          </Card>
        )}

        {enrolled && (
          <Card title="Faces Indexed">
            <Line label="Subject ID" value={enrolled.subject_id} />
            <Line label="Status"     value={enrolled.status} />
            <Line label="Photos"     value={enrolled.faces.length} />
            <View style={s.divider} />
            {enrolled.faces.map(face => (
              <Line key={face.face_id} label={face.face_id.slice(0, 8) + '…'} value={face.status} />
            ))}
          </Card>
        )}

        {matches && (
          <Card title={`Search Matches (${matches.count})`}>
            {matches.count === 0
              ? <Text style={s.empty}>No indexed face matched that photo.</Text>
              : matches.results.map(match => (
                  <View key={match.face_id} style={s.match}>
                    <Image source={{ uri: match.image_url }} style={s.matchThumb} />
                    <View style={s.matchText}>
                      <Text style={s.matchName} numberOfLines={1}>#{match.rank} · {match.name}</Text>
                      <Text style={s.matchSub} numberOfLines={1}>Subject {match.subject_id.slice(0, 8)}…</Text>
                    </View>
                    <Text style={s.matchScore}>{(match.similarity_score * 100).toFixed(1)}%</Text>
                  </View>
                ))}
          </Card>
        )}

        {error && (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Error</Text>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── The SDK — one component, driven by the four toggles ───────────── */}
      <AuthentaCapture
        client={client}
        visible={open}
        onClose={() => setOpen(false)}

        livenessCheck={checks.liveness}
        faceswapCheck={checks.faceswap}
        faceSimilarityCheck={checks.similarity}
        faceIndexing={indexing}

        onResult={(res) => { setOpen(false); setResult(res); setError(null); }}
        // Indexing keeps the modal open so the user can enrol or search again.
        onEnrolled={(res) => { setEnrolled(res); setError(null); }}
        onSearchResult={(res) => { setMatches(res); setError(null); }}
        onError={(err) => setError(err.message)}
      />
    </SafeAreaView>
  );
}

// ─── Small shared pieces ──────────────────────────────────────────────────────

function Toggle({ label, hint, value, onChange, last = false, disabled = false }: {
  label: string; hint: string; value: boolean;
  onChange: (v: boolean) => void; last?: boolean; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.row, !last && s.rowBorder]}
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#d1d5db', true: ACCENT }}
        thumbColor="#fff"
      />
    </TouchableOpacity>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[s.card, s.cardPad]}>
      <Text style={s.resultTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Line({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null) return null;
  return (
    <View style={s.line}>
      <Text style={s.lineLabel} numberOfLines={1}>{label}</Text>
      <Text style={s.lineValue}>{String(value)}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ACCENT = '#6366f1';

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, paddingBottom: 60 },

  heading: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6 },
  sub:     { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 24 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb',
    marginBottom: 16, overflow: 'hidden',
  },
  cardPad: { padding: 16 },
  muted:   { opacity: 0.45 },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.8,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },

  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },
  rowText:   { flex: 1, marginRight: 12 },
  rowLabel:  { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowHint:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  start: {
    backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginBottom: 24,
  },
  startOff:  { backgroundColor: '#d1d5db' },
  startText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  resultTitle: {
    fontSize: 12, fontWeight: '700', color: '#059669',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  line:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 12 },
  lineLabel: { fontSize: 13, color: '#6b7280', flexShrink: 1 },
  lineValue: { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1, textAlign: 'right' },
  divider:   { height: StyleSheet.hairlineWidth, backgroundColor: '#f3f4f6', marginVertical: 8 },
  empty:     { fontSize: 13, color: '#6b7280', lineHeight: 20 },

  match:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  matchThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#e5e7eb' },
  matchText:  { flex: 1 },
  matchName:  { fontSize: 14, fontWeight: '600', color: '#111827' },
  matchSub:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  matchScore: { fontSize: 15, fontWeight: '700', color: ACCENT },

  errorCard:  { backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorTitle: { fontSize: 12, fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  errorText:  { fontSize: 13, color: '#b91c1c', lineHeight: 20 },
});
