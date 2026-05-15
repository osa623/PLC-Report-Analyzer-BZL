import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GlassCard } from '@/components/GlassCard';
import { IconGlyph } from '@/components/IconGlyph';
import { PremiumBackground } from '@/components/PremiumBackground';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TText } from '@/components/Themed';
import { sampleThreads } from '@/constants/extractionData';
import { useAppTheme } from '@/store/useThemeStore';
import type { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'DocumentProcessing'>;

function MiniPipelineNode({
  title,
  status,
}: {
  title: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
}) {
  const theme = useAppTheme();
  const nodeColor =
    status === 'completed' ? theme.success
    : status === 'running' ? theme.royal
    : status === 'failed' ? theme.danger
    : theme.textTertiary;

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: `${nodeColor}20`,
          borderWidth: status === 'pending' ? 0.8 : 1.2,
          borderColor: nodeColor,
          alignItems: 'center',
          justifyContent: 'center',
          ...(status === 'completed' || status === 'running'
            ? {
                shadowColor: nodeColor,
                shadowOpacity: 0.4,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 1 },
              }
            : {}),
        }}
      >
        {status === 'completed' ? (
          <IconGlyph name="check" color={nodeColor} size={12} />
        ) : status === 'running' ? (
          <IconGlyph name="activity" color={nodeColor} size={10} />
        ) : status === 'failed' ? (
          <IconGlyph name="warning" color={nodeColor} size={10} />
        ) : (
          <IconGlyph name="clock" color={nodeColor} size={9} />
        )}
      </View>
      <TText
        className="text-[7px] font-semibold mt-0.5 text-center"
        style={{
          color: status === 'pending' ? theme.textTertiary : theme.text,
          opacity: status === 'pending' ? 0.45 : 0.8,
        }}
        numberOfLines={2}
      >
        {title}
      </TText>
      <TText
        className="text-[6px] font-medium text-center"
        style={{ color: nodeColor, opacity: 0.6 }}
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

function StatCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: string;
}) {
  const theme = useAppTheme();
  return (
    <GlassCard compact style={{ flex: 1 }}>
      <TText className="text-[9px] font-semibold tracking-wider opacity-50 uppercase">
        {label}
      </TText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
        <TText
          className="text-2xl font-extrabold tracking-tight"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </TText>
        {suffix && (
          <TText className="text-[10px] font-semibold opacity-50 ml-1">{suffix}</TText>
        )}
      </View>
    </GlassCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.separator,
      }}
    >
      <TText className="text-[11px] font-medium opacity-50">{label}</TText>
      <TText className="text-[11px] font-bold">{value}</TText>
    </View>
  );
}

export function DocumentProcessingScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const [activeTab, setActiveTab] = useState(0);

  const report = sampleThreads.find((t) => t.id === route.params.reportId) || sampleThreads[0];

  const statusColor =
    report.status === 'completed' ? theme.success
    : report.status === 'running' ? theme.royal
    : report.status === 'failed' ? theme.danger
    : theme.warning;

  const statusLabel =
    report.status === 'completed' ? 'COMPLETED'
    : report.status === 'running' ? 'RUNNING'
    : report.status === 'failed' ? 'FAILED'
    : 'QUEUED';

  // Split stages into two rows
  const stagesRow1 = report.stages.slice(0, 4);
  const stagesRow2 = report.stages.slice(4);

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
          <TText className="text-sm font-bold tracking-wide">Document Processing</TText>
          <Pressable style={{ width: 36, alignItems: 'flex-end' }}>
            <IconGlyph name="share" color={theme.textSecondary} size={18} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Report Header Card ─── */}
          <GlassCard style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: `${theme.danger}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <IconGlyph name="document" color={theme.danger} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <TText className="text-[12px] font-bold" numberOfLines={1}>
                  {report.filename}
                </TText>
                <TText className="text-[9px] font-medium opacity-50 mt-0.5">
                  {report.fileSize} · Uploaded on {report.uploadedAt}
                </TText>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: `${statusColor}18`,
                }}
              >
                <TText className="text-[8px] font-bold tracking-wider" style={{ color: statusColor }}>
                  {statusLabel}
                </TText>
              </View>
            </View>
          </GlassCard>

          {/* ─── Pipeline Progress ─── */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <TText className="text-sm font-bold">Pipeline Progress</TText>
            {report.duration && (
              <TText className="text-[9px] font-semibold" style={{ color: theme.success }}>
                Completed in {report.duration}
              </TText>
            )}
          </View>

          <GlassCard style={{ marginBottom: 12 }}>
            {/* Row 1 */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
              {stagesRow1.map((stage, i) => (
                <View key={stage.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <MiniPipelineNode title={stage.title} status={stage.status} />
                  {i < stagesRow1.length - 1 && (
                    <View
                      style={{
                        position: 'absolute',
                        right: -3,
                        top: 10,
                        width: 6,
                        height: 1.5,
                        backgroundColor:
                          stage.status === 'completed' ? theme.success
                          : stage.status === 'running' ? theme.royal
                          : `${theme.textTertiary}25`,
                        borderRadius: 1,
                      }}
                    />
                  )}
                </View>
              ))}
            </View>

            <View
              style={{
                height: 0.5,
                backgroundColor: `${theme.textTertiary}12`,
                marginVertical: 6,
              }}
            />

            {/* Row 2 */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {stagesRow2.map((stage, i) => (
                <View key={stage.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <MiniPipelineNode title={stage.title} status={stage.status} />
                  {i < stagesRow2.length - 1 && (
                    <View
                      style={{
                        position: 'absolute',
                        right: -3,
                        top: 10,
                        width: 6,
                        height: 1.5,
                        backgroundColor:
                          stage.status === 'completed' ? theme.success
                          : stage.status === 'running' ? theme.royal
                          : `${theme.textTertiary}25`,
                        borderRadius: 1,
                      }}
                    />
                  )}
                </View>
              ))}
            </View>
          </GlassCard>

          {/* ─── Detail Tabs ─── */}
          <SegmentedTabs
            tabs={['Overview', 'Extracted Data', 'Analytics', 'Logs']}
            activeIndex={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === 0 && (
            <>
              {/* Analytics Stats */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <StatCard label="Pages Processed" value={report.pagesProcessed} suffix="100%" />
                <StatCard label="Tables Extracted" value={report.tablesExtracted} suffix="100%" />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <StatCard label="Data Points" value={report.dataPoints.toLocaleString()} suffix="100%" />
                <StatCard
                  label="Issues Found"
                  value={report.issues}
                  suffix="100%"
                  accent={report.issues > 0 ? theme.danger : theme.success}
                />
              </View>

              {/* Processing Summary */}
              <TText className="text-sm font-bold mb-1">Processing Summary</TText>
              <GlassCard style={{ marginBottom: 12 }}>
                <SummaryRow label="File Type" value="PDF Document" />
                <SummaryRow label="File Size" value={report.fileSize} />
                <SummaryRow label="Pages" value={String(report.pages)} />
                <SummaryRow label="Uploaded By" value={report.uploadedBy} />
                <SummaryRow label="Upload Time" value={report.uploadedAt} />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                  }}
                >
                  <TText className="text-[11px] font-medium opacity-50">Completed Time</TText>
                  <TText className="text-[11px] font-bold">{report.uploadedAt}</TText>
                </View>
              </GlassCard>

              {/* Extracted Sections */}
              {report.extractedSections.length > 0 && (
                <>
                  <TText className="text-sm font-bold mb-1">Extracted Sections</TText>
                  <GlassCard style={{ marginBottom: 12 }}>
                    {report.extractedSections.map((section, i) => (
                      <View
                        key={section}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 6,
                          borderBottomWidth: i < report.extractedSections.length - 1 ? 0.5 : 0,
                          borderBottomColor: theme.separator,
                        }}
                      >
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            backgroundColor: `${theme.success}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                          }}
                        >
                          <IconGlyph name="check" color={theme.success} size={10} />
                        </View>
                        <TText className="text-[11px] font-medium">{section}</TText>
                      </View>
                    ))}
                  </GlassCard>
                </>
              )}

              {/* Confidence & Validation */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <GlassCard compact style={{ flex: 1, alignItems: 'center' }}>
                  <TText className="text-[9px] font-semibold tracking-wider opacity-50 uppercase">
                    Confidence
                  </TText>
                  <TText
                    className="text-xl font-extrabold tracking-tight mt-0.5"
                    style={{ color: report.confidenceScore > 90 ? theme.success : theme.warning }}
                  >
                    {report.confidenceScore}%
                  </TText>
                </GlassCard>
                <GlassCard compact style={{ flex: 1, alignItems: 'center' }}>
                  <TText className="text-[9px] font-semibold tracking-wider opacity-50 uppercase">
                    Validation
                  </TText>
                  <TText
                    className="text-xl font-extrabold tracking-tight mt-0.5"
                    style={{ color: report.validationAccuracy > 95 ? theme.success : theme.warning }}
                  >
                    {report.validationAccuracy}%
                  </TText>
                </GlassCard>
              </View>
            </>
          )}

          {activeTab === 1 && (
            <GlassCard>
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <IconGlyph name="database" color={theme.textTertiary} size={32} />
                <TText className="text-sm font-bold mt-2 opacity-50">Extracted Data</TText>
                <TText className="text-[10px] font-medium opacity-35 mt-0.5 text-center">
                  Financial tables and data points{'\n'}extracted from this report
                </TText>
              </View>
            </GlassCard>
          )}

          {activeTab === 2 && (
            <GlassCard>
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <IconGlyph name="analytics" color={theme.textTertiary} size={32} />
                <TText className="text-sm font-bold mt-2 opacity-50">Analytics</TText>
                <TText className="text-[10px] font-medium opacity-35 mt-0.5 text-center">
                  AI-generated analytics and{'\n'}processing intelligence
                </TText>
              </View>
            </GlassCard>
          )}

          {activeTab === 3 && (
            <GlassCard>
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <IconGlyph name="list" color={theme.textTertiary} size={32} />
                <TText className="text-sm font-bold mt-2 opacity-50">Processing Logs</TText>
                <TText className="text-[10px] font-medium opacity-35 mt-0.5 text-center">
                  Detailed extraction pipeline{'\n'}event logs
                </TText>
              </View>
            </GlassCard>
          )}

          {/* ─── Bottom Actions ─── */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: theme.mode === 'dark' ? theme.surfaceElevated : theme.surfaceSoft,
                borderWidth: 0.5,
                borderColor: theme.borderLight,
              }}
            >
              <TText className="text-[11px] font-bold">Reprocess</TText>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: theme.royal,
                shadowColor: theme.royal,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconGlyph name="eye" color={theme.white} size={14} />
                <TText className="text-[11px] font-bold ml-1" style={{ color: theme.white }}>
                  View Report
                </TText>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
