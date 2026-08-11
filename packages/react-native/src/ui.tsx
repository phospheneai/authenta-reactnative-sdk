/**
 * Shared building blocks for both modals: the chrome every screen repeats,
 * plus the modal flow state both containers need.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AuthentaError } from '@authenta/core';

import { ACCENT, HIT_SLOP, MAX_RETRIES, TONES, s } from './theme';
import type { Tone } from './theme';

// ─── Chrome ───────────────────────────────────────────────────────────────────

/** Modal shell — every screen renders inside this. */
export function Sheet({
  visible, onRequestClose, children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onRequestClose}
    >
      <SafeAreaView style={s.safe}>{children}</SafeAreaView>
    </Modal>
  );
}

/** Scrollable page body with a title, optional subtitle, and close button. */
export function Page({
  title, subtitle, onClose, scroll = true, children,
}: {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  scroll?: boolean;
  children: React.ReactNode;
}) {
  const body = (
    <>
      {(title || onClose) && (
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={HIT_SLOP}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {children}
    </>
  );

  return scroll
    ? <ScrollView contentContainerStyle={s.content}>{body}</ScrollView>
    : <View style={s.content}>{body}</View>;
}

export function Button({
  label, onPress, kind = 'primary', disabled = false,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const primary = kind === 'primary';
  return (
    <TouchableOpacity
      style={[primary ? s.primaryBtn : s.secondaryBtn, disabled && s.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={primary ? s.primaryBtnText : s.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Spinner({ message }: { message: string }) {
  return (
    <View style={s.centeredContent}>
      <ActivityIndicator size="large" color={ACCENT} />
      <Text style={s.spinnerText}>{message}</Text>
    </View>
  );
}

/** Big ✓/✕ circle above an outcome title. */
export function Outcome({ ok }: { ok: boolean }) {
  const [bg, fg] = TONES[ok ? 'ok' : 'bad'];
  return (
    <View style={[s.icon, { backgroundColor: bg }]}>
      <Text style={[s.iconText, { color: fg }]}>{ok ? '✓' : '✕'}</Text>
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** One line of a detail card. Renders nothing when the value is missing. */
export function KeyValue({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null) return null;
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>{String(value)}</Text>
    </View>
  );
}

/**
 * List row used for enrolled faces, search matches, and the source picker.
 * Supply a thumbnail URL or an emoji as the leading element.
 */
export function Row({
  thumb, icon, lead, title, meta, error, right, first = false, onPress,
}: {
  thumb?: string;
  icon?: string;
  lead?: React.ReactNode;
  title: string;
  meta?: string;
  error?: string | null;
  right?: React.ReactNode;
  first?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      {lead}
      {icon && <Text style={s.rowIcon}>{icon}</Text>}
      {thumb !== undefined && (
        thumb
          ? <Image source={{ uri: thumb }} style={s.rowThumb} resizeMode="cover" />
          : <View style={s.rowThumb} />
      )}
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {error
          ? <Text style={s.rowError}>{error}</Text>
          : meta ? <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {right}
    </>
  );

  const style = [s.row, !first && s.rowBorder];
  return onPress
    ? <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.7}>{body}</TouchableOpacity>
    : <View style={style}>{body}</View>;
}

/** Failure screen. Omit `attempts` to hide the counter and always allow retry. */
export function ErrorView({
  error, attempts, onRetry, onClose, closeLabel = 'Cancel',
}: {
  error?: Error;
  attempts?: number;
  onRetry?: () => void;
  onClose: () => void;
  closeLabel?: string;
}) {
  const counted = attempts !== undefined;
  const canRetry = !!onRetry && (!counted || attempts < MAX_RETRIES);

  return (
    <Page
      scroll={false}
      title="Something Went Wrong"
      subtitle={counted
        ? (attempts >= MAX_RETRIES
            ? `Failed after ${MAX_RETRIES} attempts.`
            : `Attempt ${attempts} of ${MAX_RETRIES}`)
        : undefined}
    >
      <Outcome ok={false} />
      <View style={s.errorBox}>
        <Text style={s.errorText}>{error?.message ?? 'An unknown error occurred.'}</Text>
      </View>
      {canRetry && <Button label="Try Again" onPress={onRetry!} />}
      <Button label={closeLabel} kind="secondary" onPress={onClose} />
    </Page>
  );
}

// ─── Flow state ───────────────────────────────────────────────────────────────

const toError = (e: unknown): Error =>
  e instanceof Error ? e : new AuthentaError(String(e));

/**
 * State both modals share: current step, last error, attempt count, and a
 * reset-on-open cycle. `S` must include an 'error' member.
 */
export function useModalFlow<S extends string>({
  visible, initial, onClose, onError, clear,
}: {
  visible: boolean;
  initial: S;
  onClose: () => void;
  onError?: (error: Error) => void;
  /** Extra state to clear whenever the modal opens or closes. */
  clear?: () => void;
}) {
  const [step, setStep] = useState<S>(initial);
  const [error, setError] = useState<Error | undefined>();
  const [busy, setBusy] = useState('Working…');
  const attempts = useRef(0);
  const isOpen = useRef(false);

  // Held in a ref so the open effect always sees this render's closure.
  const clearRef = useRef(clear);
  clearRef.current = clear;

  const reset = useCallback(() => {
    setStep(initial);
    setError(undefined);
    attempts.current = 0;
    clearRef.current?.();
  }, [initial]);

  // Runs before any effect the container declares, so a container that starts
  // work on open always does so against freshly cleared state.
  useEffect(() => {
    isOpen.current = visible;
    if (visible) reset();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Records a failure and switches to the error step. */
  const fail = useCallback((e: unknown) => {
    const err = toError(e);
    if (!isOpen.current) return;
    attempts.current += 1;
    setError(err);
    setStep('error' as S);
    onError?.(err);
  }, [onError]);

  const close = useCallback(() => {
    isOpen.current = false;
    reset();
    onClose();
  }, [reset, onClose]);

  /** Runs async work on the busy screen, routing failures to the error step. */
  const run = useCallback(async (message: string, work: () => Promise<void>) => {
    setBusy(message);
    setStep('busy' as S);
    try {
      await work();
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  return { step, setStep, error, busy, setBusy, attempts, isOpen, fail, close, run };
}
