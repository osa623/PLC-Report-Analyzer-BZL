import { View } from 'react-native';
import { ConfidenceRing } from '@/charts/ConfidenceRing';
import { GlassCard } from '@/components/GlassCard';
import { TText } from '@/components/Themed';
import { PatternSignal } from '@/types/finance';
import { useAppTheme } from '@/store/useThemeStore';

export function PatternMatrixCard({ pattern }: { pattern: PatternSignal }) {
  const theme = useAppTheme();
  const detected = pattern.status === 'detected';
  const severityColor =
    pattern.severity === 'critical' ? theme.danger :
    pattern.severity === 'medium' ? theme.warning :
    theme.success;

  return (
    <GlassCard
      style={{
        marginBottom: 8,
        borderLeftWidth: 2.5,
        borderLeftColor: detected ? theme.danger : theme.success,
      }}
      highlight={detected ? `${theme.danger}20` : `${theme.success}15`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          {/* Status badge */}
          <View
            style={{
              alignSelf: 'flex-start',
              borderRadius: 4,
              paddingHorizontal: 8,
              paddingVertical: 2.5,
              backgroundColor: detected ? `${theme.danger}15` : `${theme.success}15`,
              marginBottom: 6,
            }}
          >
            <TText
              className="text-[8px] font-bold tracking-widest uppercase"
              style={{ color: detected ? theme.danger : theme.success }}
            >
              {detected ? '● DETECTED' : '● CLEAR'}
            </TText>
          </View>

          {/* Title */}
          <TText className="text-sm font-semibold" numberOfLines={2}>
            {pattern.title}
          </TText>

          {/* Summary */}
          <TText className="mt-1 text-[10px] font-light leading-4 opacity-60" numberOfLines={2}>
            {pattern.summary}
          </TText>
        </View>

        {/* Confidence ring */}
        <View style={{ alignItems: 'center' }}>
          <ConfidenceRing
            value={pattern.confidence}
            size={62}
            label=""
            danger={detected}
          />
          <TText
            className="mt-0.5 text-[8px] font-medium tracking-wide opacity-50"
          >
            Confidence
          </TText>
        </View>
      </View>
    </GlassCard>
  );
}
