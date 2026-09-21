import Svg, { Line, Path } from 'react-native-svg';
import { colour } from '../theme';

const FILLS = [colour.chile, colour.cactus, colour.marigold];

/** Papel picado across the top of the home screen. */
export function Bunting({ width = 350 }: { width?: number }) {
  const flags = Math.floor(width / 50);
  return (
    <Svg width={width} height={26} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={0} y1={2} x2={width} y2={2} stroke={colour.ink} strokeWidth={2} />
      {Array.from({ length: flags }, (_, i) => {
        const x = i * 50 + 2;
        return (
          <Path
            key={i}
            d={`M${x} 2 h44 l-22 22 z`}
            fill={FILLS[i % FILLS.length]}
            stroke={colour.ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
}
