import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/GlassCard';
import { IconGlyph } from '@/components/IconGlyph';
import { PremiumBackground } from '@/components/PremiumBackground';
import { TText } from '@/components/Themed';
import { useAppTheme } from '@/store/useThemeStore';
import type { RootStackParamList } from '@/navigation/types';
import { reportService } from '@/services/reportService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function PipelineNode({
  title,
  status,
}: {
  title: string;
  status: 'completed' | 'running' | 'pending' | 'failed' | 'skipped';
}) {
  const theme = useAppTheme();

  const nodeColor =
    status === 'completed' ? theme.success
    : status === 'running' ? theme.royal
    : status === 'failed' ? theme.danger
    : status === 'skipped' ? theme.warning
    : theme.textTertiary;

  const bgOpacity =
    status === 'completed' ? '25'
    : status === 'running' ? '25'
    : status === 'failed' ? '25'
    : status === 'skipped' ? '25'
    : '10';

  return (
    <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 2 }}>
      {/* Node circle */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${nodeColor}${bgOpacity}`,
          borderWidth: status === 'pending' ? 1 : 1.5,
          borderColor: nodeColor,
          alignItems: 'center',
          justifyContent: 'center',
          ...(status === 'completed' || status === 'running'
            ? {
                shadowColor: nodeColor,
                shadowOpacity: 0.4,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }
            : {}),
        }}
      >
        {status === 'completed' ? (
          <IconGlyph name="check" color={nodeColor} size={14} />
        ) : status === 'running' ? (
          <IconGlyph name="activity" color={nodeColor} size={12} />
        ) : status === 'failed' ? (
          <IconGlyph name="warning" color={nodeColor} size={12} />
        ) : status === 'skipped' ? (
          <IconGlyph name="clock" color={nodeColor} size={12} />
        ) : (
          <IconGlyph name="clock" color={nodeColor} size={10} />
        )}
      </View>

      {/* Label */}
      <TText
        className="text-[7.5px] font-bold mt-1 text-center"
        style={{
          color: status === 'pending' ? theme.textTertiary : theme.text,
          opacity: status === 'pending' ? 0.5 : 0.95,
        }}
        numberOfLines={2}
      >
        {title}
      </TText>
      <TText
        className="text-[6.5px] font-medium text-center"
        style={{ color: nodeColor, opacity: 0.7 }}
      >
        {status === 'completed'
          ? 'Done'
          : status === 'running'
          ? 'Active'
          : status === 'failed'
          ? 'Failed'
          : status === 'skipped'
          ? 'Skipped'
          : 'Pending'}
      </TText>
    </View>
  );
}

function DocumentThreadRow({ doc, onPress }: { doc: any; onPress: () => void }) {
  const theme = useAppTheme();

  const statusColor =
    doc.status === 'completed' ? theme.success
    : doc.status === 'running' ? theme.royal
    : doc.status === 'failed' ? theme.danger
    : theme.warning;

  return (
    <Pressable onPress={onPress}>
      <GlassCard compact style={{ marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: `${theme.danger}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <IconGlyph name="document" color={theme.danger} size={16} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TText className="text-[10px] font-bold" style={{ flex: 1 }} numberOfLines={1}>
                {doc.filename || 'Report PDF'}
              </TText>
              <TText className="text-[7.5px] font-bold" style={{ color: statusColor }}>
                {String(doc.status || 'queued').toUpperCase()}
              </TText>
            </View>
            <TText className="text-[8.5px] font-light opacity-50 mt-0.5">
              Pages: {doc.pages_processed || 0} / {doc.total_pages || '?'} · Stage: {doc.stage || 'Ingest'}
            </TText>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

export function ProcessingPipelineScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<any>();
  const reportId = route.params?.reportId;

  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');

  // Query live pipeline stages
  const { data: pipelineData, isLoading: isPipelineLoading, refetch } = useQuery({
    queryKey: ['pipeline-stages', reportId],
    queryFn: () => reportService.getPipelineStages(reportId),
    refetchInterval: (query) => {
      const state = query.state.data as any;
      if (
        state?.workflow_state === 'COMPLETED' ||
        state?.workflow_state === 'FAILED' ||
        state?.workflow_state === 'EXTRACTION_FAILED'
      ) {
        return false;
      }
      return 2000;
    },
    enabled: !!reportId,
  });

  // Query document processing statuses
  const { data: documentData } = useQuery({
    queryKey: ['pipeline-documents', reportId],
    queryFn: () => reportService.getDocumentStatuses(reportId),
    refetchInterval: (query) => {
      const state = pipelineData as any;
      if (
        state?.workflow_state === 'COMPLETED' ||
        state?.workflow_state === 'FAILED' ||
        state?.workflow_state === 'EXTRACTION_FAILED'
      ) {
        return false;
      }
      return 2000;
    },
    enabled: !!reportId,
  });

  const stages = pipelineData?.stages || [];
  const workflowState = pipelineData?.workflow_state || 'PENDING';
  const pipelineStatus = pipelineData?.pipeline_status || 'PROCESSING';
  
  const completedCount = stages.filter((s: any) => s.status === 'completed').length;
  const overallProgress = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  const mapStageTitle = (backendStage: string) => {
    const map: Record<string, string> = {
      DOCUMENT_INGESTION: 'Ingestion',
      PAGE_CLASSIFICATION: 'Parsing',
      STATEMENT_DETECTION: 'Structure',
      MULTI_EXTRACTOR_EXECUTION: 'Extraction',
      CROSS_EXTRACTOR_RECONCILIATION: 'Merge',
      ACCOUNTING_VALIDATION: 'Validate',
      COVERAGE_SCORING_GATE: 'Gating',
      FINANCIAL_ANALYSIS: 'Analyze',
      REPORT_GENERATION: 'Report Gen',
    };
    return map[backendStage] || backendStage;
  };

  const formattedStages = stages.map((s: any, idx: number) => ({
    id: String(idx + 1),
    title: mapStageTitle(s.stage),
    status: s.status,
  }));

  const pipelineRow1 = formattedStages.slice(0, 5);
  const pipelineRow2 = formattedStages.slice(5);

  const docs = documentData?.documents || [];
  const filteredDocs = docs.filter((doc: any) => {
    if (filter === 'all') return true;
    return doc.status === filter;
  });

  const counts = documentData?.counts || { total: 0, running: 0, completed: 0, failed: 0 };

  const isFinished =
    workflowState === 'COMPLETED' ||
    workflowState === 'FAILED' ||
    workflowState === 'EXTRACTION_FAILED';

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
          <Pressable onPress={() => navigation.goBack()} style={{ width: 36 }}>
            <IconGlyph name="back" color={theme.text} size={20} />
          </Pressable>
          <TText className="text-sm font-bold tracking-wide">Processing Pipeline</TText>
          <Pressable onPress={() => refetch()} style={{ width: 36, alignItems: 'flex-end' }}>
            <IconGlyph name="refresh" color={theme.textSecondary} size={18} />
          </Pressable>
        </View>

        {isPipelineLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.royal} />
            <TText className="text-xs opacity-50 mt-2">Connecting to pipeline...</TText>
          </View>
        ) : (
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
              <TText className="text-sm font-bold">Pipeline Status: {workflowState}</TText>
              <TText className="text-[10px] font-medium opacity-50">
                {completedCount}/{stages.length} Stages
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
                  backgroundColor: pipelineStatus === 'FAILED' || workflowState === 'FAILED' ? theme.danger : theme.success,
                  shadowColor: pipelineStatus === 'FAILED' ? theme.danger : theme.success,
                  shadowOpacity: 0.5,
                  shadowRadius: 6,
                }}
              />
            </View>
            <TText
              className="text-[10px] font-bold text-right mb-1"
              style={{ color: pipelineStatus === 'FAILED' || workflowState === 'FAILED' ? theme.danger : theme.success }}
            >
              {overallProgress}%
            </TText>

            {/* ─── Pipeline Grid ─── */}
            <GlassCard style={{ marginBottom: 12 }}>
              {/* Row 1 */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                {pipelineRow1.map((stage: any) => (
                  <PipelineNode key={stage.id} title={stage.title} status={stage.status} />
                ))}
              </View>

              <View style={{ height: 0.5, backgroundColor: `${theme.textTertiary}15`, marginVertical: 6 }} />

              {/* Row 2 */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {pipelineRow2.map((stage: any) => (
                  <PipelineNode key={stage.id} title={stage.title} status={stage.status} />
                ))}
              </View>
            </GlassCard>

            {/* ─── Active Threads ─── */}
            {docs.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <TText className="text-sm font-bold">Document Threads</TText>
                  <TText className="text-[9px] font-medium opacity-40">
                    {counts.completed}/{counts.total} completed
                  </TText>
                </View>

                {/* Filter Pills */}
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <Pressable
                    onPress={() => setFilter('all')}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: filter === 'all' ? theme.royal : theme.surfaceInset,
                      marginRight: 6,
                    }}
                  >
                    <TText className="text-[8px] font-bold" style={{ color: filter === 'all' ? theme.white : theme.text }}>
                      ALL ({counts.total})
                    </TText>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilter('running')}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: filter === 'running' ? theme.royal : theme.surfaceInset,
                      marginRight: 6,
                    }}
                  >
                    <TText className="text-[8px] font-bold" style={{ color: filter === 'running' ? theme.white : theme.text }}>
                      ACTIVE ({counts.running})
                    </TText>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilter('completed')}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: filter === 'completed' ? theme.success : theme.surfaceInset,
                      marginRight: 6,
                    }}
                  >
                    <TText className="text-[8px] font-bold" style={{ color: filter === 'completed' ? theme.white : theme.text }}>
                      COMPLETED ({counts.completed})
                    </TText>
                  </Pressable>
                </View>

                {filteredDocs.map((doc: any, index: number) => (
                  <DocumentThreadRow
                    key={doc.id || index}
                    doc={doc}
                    onPress={() => navigation.navigate('DocumentProcessing', { reportId })}
                  />
                ))}
              </>
            )}

            {/* Finished actions */}
            {isFinished && (
              <View style={{ marginTop: 16 }}>
                {workflowState === 'COMPLETED' ? (
                  <Pressable
                    onPress={() => {
                      navigation.navigate('AnalyzerTabs', { companyId: reportId });
                    }}
                    style={{
                      borderRadius: 10,
                      paddingVertical: 12,
                      backgroundColor: theme.success,
                      alignItems: 'center',
                      shadowColor: theme.success,
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 4 },
                    }}
                  >
                    <TText className="text-xs font-semibold" style={{ color: theme.white }}>
                      View Intelligence Snapshot →
                    </TText>
                  </Pressable>
                ) : (
                  <GlassCard style={{ borderColor: theme.danger, borderWidth: 1 }}>
                    <TText className="text-xs font-bold" style={{ color: theme.danger }}>
                      Processing Pipeline Failed
                    </TText>
                    <TText className="text-[10px] opacity-60 mt-1">
                      The extraction validation gate did not pass. Basic balance sheet identity or mandatory figures could not be resolved from the uploaded report.
                    </TText>
                  </GlassCard>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </PremiumBackground>
  );
}
