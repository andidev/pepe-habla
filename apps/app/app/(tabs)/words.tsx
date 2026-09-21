import { Text, View } from 'react-native';
import { Pepe } from '../../components/Pepe';
import { colour, font, space } from '../../theme';

export default function Words() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }}>
      <Pepe pose="sleeping" motion="breathe" size={150} />
      <Text style={{ fontFamily: font.display, fontSize: 22, color: colour.ink }}>Pronto</Text>
      <Text style={{ fontFamily: font.body, fontSize: 14, color: colour.muted, textAlign: 'center' }}>
        Aquí verás todas tus palabras y qué tan bien las sabes.
      </Text>
    </View>
  );
}
