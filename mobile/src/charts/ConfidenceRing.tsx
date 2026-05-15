import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '@/store/useThemeStore';

type Props = {
  value: number;
  size?: number;
  label?: string;
  danger?: boolean;
};

export function ConfidenceRing({ value, size = 132, label = 'High Reliability', danger }: Props) {
  const theme = useAppTheme();
  const stroke = size < 70 ? 6 : size < 100 ? 8 : 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - Math.min(value, 100) / 100);
  const color = danger ? theme.danger : theme.royal;
  const gradId = `ring-${size}-${danger ? 'd' : 'n'}`;

  // Dynamic font sizing
  const valueFontSize = size < 70 ? 16 : size < 100 ? 20 : 26;
  const labelFontSize = size < 70 ? 7 : size < 100 ? 8 : 9;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={danger ? theme.warning : theme.cyan} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.borderLight}
          strokeWidth={stroke}
          fill="none"
          opacity={0.5}
        />

        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />

        {/* Gold accent arc — small decorative segment */}
        {size >= 90 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.gold}
            strokeWidth={stroke * 0.6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.12} ${circumference}`}
            strokeDashoffset={-circumference * 0.02}
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
            opacity={0.7}
          />
        )}

        {/* Value text */}
        <SvgText
          x="50%"
          y={label ? '46%' : '52%'}
          textAnchor="middle"
          fill={theme.text}
          fontSize={valueFontSize}
          fontWeight="700"
        >
          {value}
        </SvgText>

        {/* Label text */}
        {label ? (
          <SvgText
            x="50%"
            y="64%"
            textAnchor="middle"
            fill={theme.textTertiary}
            fontSize={labelFontSize}
            fontWeight="400"
            letterSpacing={0.5}
          >
            {label}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
