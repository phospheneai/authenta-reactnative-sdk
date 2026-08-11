/**
 * Authenta Demo App — the ONLY file a client developer needs to write.
 *
 * A. Detection (Authenta platform)
 *    Configure AuthentaClient with your domain + key, toggle which checks to
 *    run, and tap Start. AuthentaCapture opens the camera, captures a photo or
 *    video (whichever the checks require), compresses and uploads it, polls,
 *    and returns the finished ProcessedMedia.
 *
 * B. Face indexing (FaceSim server — separate host, tenant ID only)
 *    Turn on "Image Indexing" and tap Start. AuthentaFaceIndex uploads photos,
 *    waits for the embeddings, and searches a face from camera or library.
 *
 * Either way the SDK handles permissions, capture, compression, upload, S3,
 * polling, retries, and error UI. You just read the result.
 */

import React, { useMemo, useState } from 'react';
import {
  Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import { AuthentaClient, FaceIndexClient } from '@authenta/core';
import type { EnrollmentResult, ProcessedMedia, SearchResponse } from '@authenta/core';
import { AuthentaCapture, AuthentaFaceIndex } from '@authenta/react-native';

// ─── 1. Detection client — your domain and API key ───────────────────────────

const client = new AuthentaClient({
  baseUrl: '',
  api_key: '',
  auth_enabled: true,
});

// ─── 2. Face indexing server — your own host, no API key ─────────────────────
// On a device, 127.0.0.1 is the phone itself: use your machine's LAN IP (and
// allow cleartext traffic for that host on Android/iOS).

const FACE_INDEX_BASE_URL  = '';
const FACE_INDEX_TENANT_ID = '';

const CHECKS = [
  { key: 'liveness',   label: 'Liveness Check',        hint: 'Photo — is this a real live face?' },
  { key: 'faceswap',   label: 'Faceswap Check',        hint: 'Video (10 s) — detect AI face-swap' },
  { key: 'similarity', label: 'Face Similarity Check', hint: 'Photo — compare face to reference image' },
] as const;

type CheckKey = typeof CHECKS[number]['key'];

export default function App() {
  // The only input this app provides: which checks to run.
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    liveness: false, faceswap: false, similarity: false,
  });
  const [indexing, setIndexing] = useState(false);

  const [openModal, setOpenModal] = useState<'capture' | 'index' | null>(null);

  // Whatever the SDK hands back.
  const [result, setResult]         = useState<ProcessedMedia | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentResult | null>(null);
  const [matches, setMatches]       = useState<SearchResponse | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // The constructor validates the tenant UUID, so keep a bad config visible
  // instead of crashing at startup.
  const faceClient = useMemo(() => {
    try {
      return new FaceIndexClient({ baseUrl: FACE_INDEX_BASE_URL, tenantId: FACE_INDEX_TENANT_ID });
    } catch {
      return null;
    }
  }, []);

  const anyCheck = Object.values(checks).some(Boolean);
  const canStart = indexing ? !!faceClient : anyCheck;

  const clear = () => { setResult(null); setEnrollment(null); setMatches(null); setError(null); };

  // Face indexing is a different server and runs no detection model, so the two
  // are mutually exclusive: turning it on clears every check.
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

        {/* Face indexing runs against a different server, so it is its own mode */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Face Indexing</Text>
          <Toggle
            label="Image Indexing"
            hint="Upload photos to index a face, then search for it"
            value={indexing}
            onChange={toggleIndexing}
            last
          />
        </View>

        {indexing && !faceClient && (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Face indexing not configured</Text>
            <Text style={s.errorText}>
              FACE_INDEX_TENANT_ID must be a valid UUID and FACE_INDEX_BASE_URL
              must point at your FaceSim server.
            </Text>
          </View>
        )}

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
          onPress={() => { clear(); setOpenModal(indexing ? 'index' : 'capture'); }}
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

        {enrollment && (
          <Card title="Indexed Faces">
            <Line label="Subject ID" value={enrollment.subject_id} />
            <Line label="Indexed"    value={`${enrollment.processedCount} of ${enrollment.faces.length}`} />
            <View style={s.divider} />
            {enrollment.faces.map(face => (
              <Line key={face.face_id} label={face.name} value={face.error ?? face.status} />
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

      {/* ── 3. The SDK modals ─────────────────────────────────────────────── */}
      <AuthentaCapture
        client={client}
        modelType="FI-1"
        visible={openModal === 'capture'}
        livenessCheck={checks.liveness}
        faceswapCheck={checks.faceswap}
        faceSimilarityCheck={checks.similarity}
        onClose={() => setOpenModal(null)}
        onResult={(res) => { setOpenModal(null); setResult(res); setError(null); }}
        onError={(err) => { setOpenModal(null); setError(err.message); }}
      />

      {faceClient && (
        <AuthentaFaceIndex
          client={faceClient}
          visible={openModal === 'index'}
          maxImages={3}
          onClose={() => setOpenModal(null)}
          // The modal stays open so the user can keep searching — these just
          // mirror the data into this screen.
          onEnrolled={(res) => { setEnrollment(res); setError(null); }}
          onSearchResult={(res) => { setMatches(res); setError(null); }}
          onError={(err) => setError(err.message)}
        />
      )}
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
