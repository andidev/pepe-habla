import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  defaultReminderSettings, REMINDER_TIMES, reminderTimeLabel, type ReminderSettings,
} from '@pepe/core';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { Screen } from '../components/Screen';
import { cue, effectsOn, isMuted, saveEffects, saveMuted } from '../feedback';
import { useLanguage } from '../i18n/language';
import { LANGUAGE_CHOICES } from '../i18n/strings';
import {
  askPermission, openSystemSettings, permissionState, refreshReminders, watchPermission,
  type PermissionState,
} from '../notifications';
import { loadReminderSettings, saveReminderSettings } from '../storage/reminderStore';
import { WORDS } from '../storage/vocabulary';
import { colour, font, outline, radius, space } from '../theme';

const card = {
  backgroundColor: colour.surface, borderRadius: radius.card, padding: space.lg, ...outline,
} as const;

export default function Settings() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [effects, setEffects] = useState(effectsOn());
  const [reminder, setReminder] = useState<ReminderSettings>(defaultReminderSettings());
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const timeScrollRef = useRef<ScrollView>(null);
  const pillsVisible = reminder.enabled && permission === 'granted';
  const selectedTimeIndex = REMINDER_TIMES.findIndex(
    (time) => time.hour === reminder.hour && time.minute === reminder.minute,
  );

  // The row mounts scrolled to offset 0, and the default time, 08:00, sits at
  // index 6 -- off the right edge of the card on an ordinary phone. A row of
  // grey pills with no green one in view reads as "nothing is selected", which
  // is exactly wrong on the card that exists to show the learner their choice.
  // Re-scroll whenever the row appears or the selection changes; the pill the
  // learner just tapped is already under their finger, so this never fights
  // their own scrolling.
  useEffect(() => {
    if (!pillsVisible || selectedTimeIndex < 0) return;
    timeScrollRef.current?.scrollTo({ x: Math.max(0, selectedTimeIndex * 80 - 40), animated: false });
  }, [pillsVisible, selectedTimeIndex]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [stored, state] = await Promise.all([loadReminderSettings(), permissionState()]);
      if (!alive) return;
      setReminder(stored);
      setPermission(state);
    })();
    return () => { alive = false; };
  }, []);

  // A grant made in the phone's own Settings app comes back to a screen that
  // was only backgrounded, not remounted -- so the denied card needs its own
  // way to notice the return.
  useEffect(() => watchPermission(setPermission), []);

  const applyReminder = async (next: ReminderSettings) => {
    setReminder(next);
    await saveReminderSettings(next);
    await refreshReminders();
  };

  const toggleReminder = async (on: boolean) => {
    if (!on) { await applyReminder({ ...reminder, enabled: false }); return; }
    // Asking here, and nowhere else, is the whole permission strategy: this is
    // the only moment the learner has said they want to be reminded.
    const state = permission === 'granted' ? 'granted' : await askPermission();
    setPermission(state);
    if (state !== 'granted') { setReminder({ ...reminder, enabled: false }); return; }
    cue('tap');
    await applyReminder({ ...reminder, enabled: true });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Scrolls because it has to: six cards plus Pepe overflow a small
          phone, and without this the Back button falls off the bottom with
          only the iOS edge swipe left as a way out -- which a child will not
          know about. flexGrow keeps Pepe centred in the space left over when
          the content does fit. */}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: space.xl, gap: space.md }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: font.displayHeavy, fontSize: 32, color: colour.ink }}>
          {t.settings.title}
        </Text>

        <View style={card}>
          <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{t.settings.language}</Text>
          <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
            {t.settings.languageHint}
          </Text>
          <View accessibilityRole="radiogroup" style={{ marginTop: space.sm }}>
            {LANGUAGE_CHOICES.map((choice, i) => {
              const on = choice.id === language;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => { cue('tap'); setLanguage(choice.id); void refreshReminders(choice.id); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${choice.name}. ${choice.detail}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52,
                    borderTopWidth: i === 0 ? 0 : 1.5, borderTopColor: colour.ground,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bodyHeavy, fontSize: 16, color: colour.ink }}>{choice.name}</Text>
                    <Text style={{ fontFamily: font.body, fontSize: 12, color: colour.muted }}>{choice.detail}</Text>
                  </View>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12, ...outline,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colour.cactus }} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>{t.settings.sound}</Text>
              <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
                {t.settings.soundHint}
              </Text>
            </View>
            <Switch
              value={soundOn}
              onValueChange={(on) => {
                setSoundOn(on);
                void saveMuted(!on);
                if (on) cue('tap');
              }}
              accessibilityLabel={t.settings.sound}
              trackColor={{ false: colour.muted, true: colour.cactus }}
            />
          </View>

          {/* Only meaningful while there is sound to separate from the voice. */}
          {soundOn && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: space.md,
              marginTop: space.md, paddingTop: space.md, borderTopWidth: 1.5, borderTopColor: colour.ground,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.ink }}>{t.settings.effects}</Text>
                <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
                  {t.settings.effectsHint}
                </Text>
              </View>
              <Switch
                value={effects}
                onValueChange={(on) => {
                  setEffects(on);
                  void saveEffects(on);
                  if (on) cue('tap');
                }}
                accessibilityLabel={t.settings.effects}
                trackColor={{ false: colour.muted, true: colour.cactus }}
              />
            </View>
          )}
        </View>

        {/* Hidden entirely on web, which has no notification queue. */}
        {permission !== 'unsupported' && (
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>
                  {t.settings.reminder}
                </Text>
                <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 2 }}>
                  {t.settings.reminderHint}
                </Text>
              </View>
              <Switch
                value={reminder.enabled && permission === 'granted'}
                onValueChange={(on) => { void toggleReminder(on); }}
                disabled={permission === 'denied'}
                accessibilityLabel={t.settings.reminder}
                trackColor={{ false: colour.muted, true: colour.cactus }}
              />
            </View>

            {/* A learner who declined is not in an error state. No red, no
                warning, and nothing about it anywhere else in the app -- just
                the one door back, which the OS is the only one who can open. */}
            {permission === 'denied' && (
              <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1.5, borderTopColor: colour.ground }}>
                <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, lineHeight: 19 }}>
                  {t.settings.reminderDenied}
                </Text>
                <Pressable
                  onPress={() => { cue('tap'); void openSystemSettings(); }}
                  accessibilityRole="button"
                  accessibilityLabel={t.settings.reminderOpenSettings}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: font.bodyHeavy, fontSize: 15, color: colour.cactus }}>
                    {t.settings.reminderOpenSettings}
                  </Text>
                </Pressable>
              </View>
            )}

            {pillsVisible && (
              <ScrollView
                ref={timeScrollRef}
                horizontal
                accessibilityRole="radiogroup"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm, paddingRight: space.lg }}
                style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1.5, borderTopColor: colour.ground }}
              >
                {REMINDER_TIMES.map((time) => {
                  const on = time.hour === reminder.hour && time.minute === reminder.minute;
                  const label = reminderTimeLabel(time);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => {
                        cue('tap');
                        void applyReminder({ ...reminder, hour: time.hour, minute: time.minute });
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={label}
                      style={{
                        minHeight: 44, minWidth: 72, paddingHorizontal: space.md,
                        alignItems: 'center', justifyContent: 'center',
                        borderRadius: radius.pill, ...outline,
                        backgroundColor: on ? colour.cactus : colour.surface,
                      }}
                    >
                      <Text style={{
                        fontFamily: font.bodyHeavy, fontSize: 15,
                        color: on ? colour.surface : colour.ink,
                      }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        <View style={card}>
          <Text style={{ fontFamily: font.display, fontSize: 17, color: colour.ink }}>Pepe Habla</Text>
          <Text style={{ fontFamily: font.body, fontSize: 13, color: colour.muted, marginTop: 4, lineHeight: 19 }}>
            {t.settings.about(WORDS.length)}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pepe pose="idle" motion="breathe" size={110} />
        </View>

        <PressableCard label={t.settings.back} onPress={() => { cue('tap'); router.back(); }}>
          <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: colour.ink }}>{t.settings.back}</Text>
          </View>
        </PressableCard>
      </ScrollView>
    </Screen>
  );
}
