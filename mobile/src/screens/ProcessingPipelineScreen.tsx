import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GlassCard } from '@/components/GlassCard';
import { IconGlyph } from '@/components/IconGlyph';
import { PremiumBackground } from '@/components/PremiumBackground';
import { TText } from '@/components/Themed';
import { samplePipelineStages, sampleThreads } from '@/constants/extractionData';
import { useAppTheme } from '@/store/useThemeStore';
import type { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function PipelineNode({
  title,
  status,
  isLast,
}: {
  title: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  isLast?: boolean;
}) {
  const theme = useAppTheme();

  const nodeColor =
    status === 'completed' ? theme.success
    : status === 'running' ? theme.royal
    : status === 'failed' ? theme.danger
    : theme.textTertiary;

  const bgOpacity =
    status === 'completed' ? '25'
    : status === 'running' ? '25'
    : status === 'failed' ? '25'
    : '10';

  const lineColor =
    status === 'completed' ? theme.success
    : status === 'running' ? theme.royal
    : `${theme.textTertiary}50`;

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      {/* Node circle */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: `${nodeColor}${bgOpacity}`,
          borderWidth: status === 'pending' ? 1 : 1.5,
          borderColor: nodeColor,
          alignItems: 'center',
          justifyContent: 'center',
          ...(status === 'completed' || status === 'running'
            ? {
                shadowColor: nodeColor,
                shadowOpacity: 0.5,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }
            : {}),
        }}
      >
        {status === 'completed' ? (
          <IconGlyph name="check" color={nodeColor} size={16} />
        ) : status === 'running' ? (
          <IconGlyph name="activity" color={nodeColor} size={14} />
        ) : status === 'failed' ? (
          <IconGlyph name="warning" color={nodeColor} size={14} />
        ) : (
          <IconGlyph name="clock" color={nodeColor} size={12} />
        )}
      </View>

      {/* Label */}
      <TText
        className="text-[8px] font-semibold mt-0.5 text-center"
        style={{
          color: status === 'pending' ? theme.textTertiary : theme.text,
          opacity: status === 'pending' ? 0.5 : 0.85,
        }}
        numberOfLines={2}
      >
        {title}
      </TText>
      <TText
        className="text-[7px] font-medium text-center"
        style={{ color: nodeColor, opacity: 0.7 }}
      >
        {status === 'completed'
          ? 'Completed'
          : status === 'running'
          ? 'In Progress'
          : status === 'failed'
          ? 'Failed'
          : 'Pending'}
      </TText>
    </View>
  );
}

function StatusFilterPill({
  label,
  count,
  active,
  color,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 6,
        backgroundColor: active
          ? color
          : theme.mode === 'dark'
          ? 'rgba(11,33,64,0.6)'
          : theme.surfaceSoft,
        borderWidth: 0.5,
        borderColor: active ? color : theme.borderLight,
      }}
    >
      <TText
        className="text-[10px] font-bold tracking-wide uppercase"
        style={{ color: active ? theme.white : color }}
      >
        {label} ({count})
      </TText>
    </Pressable>
  );
}

function ThreadCard({
  thread,
  onPress,
}: {
  thread: (typeof sampleThreads)[number];
  onPress: () => void;
}) {
  const theme = useAppTheme();

  const statusColor =
    thread.status === 'completed' ? theme.success
    : thread.status === 'running' ? theme.royal
    : thread.status === 'failed' ? theme.danger
    : theme.warning;

  const statusLabel =
    thread.status === 'completed' ? 'COMPLETED'
    : thread.status === 'running' ? 'RUNNING'
    : thread.status === 'failed' ? 'FAILED'
    : 'QUEUED';

  return (
    <Pressable onPress={onPress}>
      <GlassCard compact style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* PDF Icon */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: `${theme.danger}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <IconGlyph name="document" color={theme.danger} size={18} />
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TText className="text-[11px] font-bold" style={{ flex: 1 }} numberOfLines={1}>
                {thread.filename}
              </TText>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: `${statusColor}18`,
                  marginLeft: 8,
                }}
              >
                <TText className="text-[8px] font-bold tracking-wider" style={{ color: statusColor }}>
                  {statusLabel}
                </TText>
              </View>
            </View>

            {/* Progress bar */}
            <View
              style={{
                marginTop: 6,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${thread.progress}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: statusColor,
                }}
              />
            </View>

            {/* Meta row */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 5,
              }}
            >
              <TText className="text-[9px] font-medium opacity-50">
                {thread.status === 'running'
                  ? `Processing... ${thread.currentStage || ''}`
                  : thread.status === 'completed'
                  ? `Completed in ${thread.duration}`
                  : thread.status === 'failed'
                  ? 'Processing failed'
                  : 'Waiting in queue'}
              </TText>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TText className="text-[9px] font-medium opacity-50 mr-2">{thread.progress}%</TText>
                <TText className="text-[8px] font-medium opacity-35">
                  {thread.uploadedAt.split(' ').slice(-2).join(' ')}
                </TText>
              </View>
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

export function ProcessingPipelineScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<NavProp>();

  const completedCount = sampleThreads.filter((t) => t.status === 'completed').length;
  const overallProgress = Math.round(
    (sampleThreads.reduce((s, t) => s + t.progress, 0) / (sampleThreads.length * 100)) * 100,
  );

  // Pipeline connecting line between rows
  const pipelineRow1 = samplePipelineStages.slice(0, 5);
  const pipelineRow2 = samplePipelineStages.slice(5);

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 10,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={{ width: 36 }}
          >
            <IconGlyph name="back" color={theme.text} size={20} />
          </Pressable>
          <TText className="text-sm font-bold tracking-wide">Processing Pipeline</TText>
          <Pressable style={{ width: 36, alignItems: 'flex-end' }}>
            <IconGlyph name="refresh" color={theme.textSecondary} size={18} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Overall Progress ─── */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <TText className="text-sm font-bold">Overall Progress</TText>
            <TText className="text-[10px] font-medium opacity-50">
              {completedCount}/{sampleThreads.length} Completed
            </TText>
          </View>

          {/* Progress bar */}
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              overflow: 'hidden',
              marginBottom: 4,
            }}
          >
            <View
              style={{
                width: `${overallProgress}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: theme.success,
                shadowColor: theme.success,
                shadowOpacity: 0.5,
                shadowRadius: 6,
              }}
            />
          </View>
          <TText className="text-[10px] font-bold text-right mb-1" style={{ color: theme.success }}>
            {overallProgress}%
          </TText>

          {/* ─── Pipeline Visualization ─── */}
          <GlassCard style={{ marginBottom: 12 }}>
            {/* Row 1 — first 5 stages */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
              {pipelineRow1.map((stage, i) => (
                <View key={stage.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <PipelineNode
                    title={stage.title}
                    status={stage.status}
                    isLast={i === pipelineRow1.length - 1}
                  />
                  {i < pipelineRow1.length - 1 && (
                    <View
                      style={{
                        position: 'absolute',
                        right: -4,
                        top: 14,
                        width: 8,
                        height: 2,
                        backgroundColor:
                          stage.status === 'completed' ? theme.success
                          : stage.status === 'running' ? theme.royal
                          : `${theme.textTertiary}30`,
                        borderRadius: 1,
                      }}
                    />
                  )}
                </View>
              ))}
            </View>

            {/* Connecting dashed visual */}
            <View
              style={{
                height: 1,
                backgroundColor: `${theme.textTertiary}15`,
                marginVertical: 8,
              }}
            />

            {/* Row 2 — remaining stages */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {pipelineRow2.map((stage, i) => (
                <View key={stage.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <PipelineNode
                    title={stage.title}
                    status={stage.status}
                    isLast={i === pipelineRow2.length - 1}
                  />
                  {i < pipelineRow2.length - 1 && (
                    <View
                      style={{
                        position: 'absolute',
                        right: -4,
                        top: 14,
                        width: 8,
                        height: 2,
                        backgroundColor:
                          stage.status === 'completed' ? theme.success
                          : stage.status === 'running' ? theme.royal
                          : `${theme.textTertiary}30`,
                        borderRadius: 1,
                      }}
                    />
                  )}
                </View>
              ))}
            </View>
          </GlassCard>

          {/* ─── Document Processing Threads ─── */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <TText className="text-sm font-bold">Document Processing Threads</TText>
            <TText className="text-[9px] font-medium opacity-40">
              {completedCount}/{sampleThreads.length} completed
            </TText>
          </View>

          {/* Filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
          >
            <StatusFilterPill label="ALL" count={sampleThreads.length} active color={theme.royal} onPress={() => {}} />
            <StatusFilterPill
              label="RUNNING"
              count={sampleThreads.filter((t) => t.status === 'running').length}
              active={false}
              color={theme.royal}
              onPress={() => {}}
            />
            <StatusFilterPill
              label="COMPLETED"
              count={sampleThreads.filter((t) => t.status === 'completed').length}
              active={false}
              color={theme.success}
              onPress={() => {}}
            />
            <StatusFilterPill
              label="FAILED"
              count={sampleThreads.filter((t) => t.status === 'failed').length}
              active={false}
              color={theme.danger}
              onPress={() => {}}
            />
          </ScrollView>

          {/* Thread cards */}
          {sampleThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onPress={() => navigation.navigate('DocumentProcessing', { reportId: thread.id })}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
