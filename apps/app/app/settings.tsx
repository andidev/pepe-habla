import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pepe } from '../components/Pepe';
import { PressableCard } from '../components/PressableCard';
import { Screen } from '../components/Screen';
import { cue, effectsOn, isMuted, saveEffects, saveMuted } from '../feedback';
import { useLanguage } from '../i18n/language';
import { LANGUAGE_CHOICES } from '../i18n/strings';
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

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Scrolls because it has to: five cards plus Pepe overflow a small
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
                  onPress={() => { cue('tap'); setLanguage(choice.id); }}
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
