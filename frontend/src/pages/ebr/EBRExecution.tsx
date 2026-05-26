import {
  Card, Button, Space, Typography, Progress, Tag, Badge, Tabs,
  Table, Input, InputNumber, Switch, Form, Modal, Descriptions,
  Alert, Divider, Row, Col, Statistic, message, Tooltip, DatePicker,
} from 'antd';
import {
  PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
  WarningOutlined, SendOutlined, CheckOutlined, CloseOutlined,
  ArrowLeftOutlined, SaveOutlined, ExperimentOutlined,
  FilePdfOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ebrApi } from '../../api/ebr';
import { reportsApi, triggerDownload } from '../../api/reports';
import { useAuthStore } from '../../store/authStore';
import ESignatureModal from '../../components/ESignatureModal';
import SignatureList from '../../components/SignatureList';
import type { EBRStep, EBRParameterResult, EBRIPQCResult, EBRMaterialDispensing, EBRStatus } from '../../types/ebr';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_CFG: Record<EBRStatus, { color: string; label: string }> = {
  INITIATED:    { color: 'default',    label: 'Initiated' },
  IN_PROGRESS:  { color: 'processing', label: 'In Progress' },
  COMPLETED:    { color: 'warning',    label: 'Completed' },
  UNDER_REVIEW: { color: 'warning',    label: 'Under Review' },
  APPROVED:     { color: 'success',    label: 'Released' },
  REJECTED:     { color: 'error',      label: 'Rejected' },
};

// ── Step Sidebar Item ─────────────────────────────────────────────────────
function StepItem({ step, selected, onClick }: { step: EBRStep; selected: boolean; onClick: () => void }) {
  const icon =
    step.status === 'COMPLETED' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
    step.status === 'IN_PROGRESS' ? <PlayCircleOutlined style={{ color: '#1677ff' }} /> :
    <ClockCircleOutlined style={{ color: '#ccc' }} />;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 16px', cursor: 'pointer', borderRadius: 6, marginBottom: 4,
        background: selected ? '#e6f4ff' : 'transparent',
        border: selected ? '1px solid #91caff' : '1px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <Space>
        {icon}
        <div>
          <div style={{ fontSize: 12, color: '#888' }}>Step {step.step_number}</div>
          <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: step.status === 'PENDING' ? '#aaa' : undefined }}>
            {step.title}
          </div>
          {step.is_critical && <Tag color="red" style={{ fontSize: 10, marginTop: 2 }}>Critical</Tag>}
        </div>
      </Space>
    </div>
  );
}

// ── Parameter Entry Row ───────────────────────────────────────────────────
function ParameterRow({ param, onChange }: {
  param: EBRParameterResult & { _actual?: string; _notes?: string };
  onChange: (val: string, notes: string) => void;
}) {
  const [val, setVal] = useState(param.actual_value || '');
  const [notes, setNotes] = useState(param.notes || '');

  const inRange = (() => {
    if (!val) return null;
    try {
      const v = parseFloat(val);
      if (param.min_value && v < parseFloat(param.min_value)) return false;
      if (param.max_value && v > parseFloat(param.max_value)) return false;
      return true;
    } catch { return null; }
  })();

  const rangeColor = inRange === null ? undefined : inRange ? '#52c41a' : '#ff4d4f';

  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td style={{ padding: '8px 12px' }}>
        <Space>
          <span style={{ fontWeight: 500 }}>{param.parameter_name}</span>
          {param.is_critical && <Tag color="orange" style={{ fontSize: 10 }}>CPP</Tag>}
        </Space>
      </td>
      <td style={{ padding: '8px 12px', color: '#888', fontSize: 12 }}>{param.unit || '—'}</td>
      <td style={{ padding: '8px 12px', fontSize: 12 }}>
        <Space direction="vertical" size={0}>
          {param.target_value && <span>Target: <b>{param.target_value}</b></span>}
          {(param.min_value || param.max_value) && (
            <span style={{ color: '#888' }}>Range: {param.min_value || '—'} – {param.max_value || '—'}</span>
          )}
        </Space>
      </td>
      <td style={{ padding: '8px 12px', width: 140 }}>
        <Input
          value={val}
          onChange={e => { setVal(e.target.value); onChange(e.target.value, notes); }}
          style={{ borderColor: rangeColor }}
          placeholder="Enter value"
          suffix={inRange !== null ? (inRange ? '✓' : '⚠') : undefined}
        />
        {inRange === false && <div style={{ color: '#ff4d4f', fontSize: 11, marginTop: 2 }}>Out of range!</div>}
      </td>
      <td style={{ padding: '8px 12px', width: 160 }}>
        <Input value={notes} onChange={e => { setNotes(e.target.value); onChange(val, e.target.value); }}
          placeholder="Notes (optional)" size="small" />
      </td>
    </tr>
  );
}

// ── IPQC Entry Row ────────────────────────────────────────────────────────
function IPQCRow({ ipqc, onChange }: {
  ipqc: EBRIPQCResult;
  onChange: (result: string, passed: boolean | undefined, notes: string) => void;
}) {
  const [result, setResult] = useState(ipqc.actual_result || '');
  const [passed, setPassed] = useState<boolean | undefined>(ipqc.passed);
  const [notes, setNotes] = useState(ipqc.notes || '');

  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{ipqc.test_name}</td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#888' }}>{ipqc.acceptance_criteria}</td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#888' }}>{ipqc.frequency || '—'}</td>
      <td style={{ padding: '8px 12px', width: 160 }}>
        <Input value={result} onChange={e => { setResult(e.target.value); onChange(e.target.value, passed, notes); }}
          placeholder="Actual result" />
      </td>
      <td style={{ padding: '8px 12px', width: 120, textAlign: 'center' }}>
        <Space>
          <Button size="small" type={passed === true ? 'primary' : 'default'}
            style={{ background: passed === true ? '#52c41a' : undefined, border: passed === true ? '1px solid #52c41a' : undefined }}
            onClick={() => { setPassed(true); onChange(result, true, notes); }}>Pass</Button>
          <Button size="small" danger={passed === false} type={passed === false ? 'primary' : 'default'}
            onClick={() => { setPassed(false); onChange(result, false, notes); }}>Fail</Button>
        </Space>
      </td>
      <td style={{ padding: '8px 12px', width: 160 }}>
        <Input value={notes} onChange={e => { setNotes(e.target.value); onChange(result, passed, e.target.value); }}
          placeholder="Notes" size="small" />
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function EBRExecution() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('steps');
  const [signConfig, setSignConfig] = useState<{
    action: string; actionLabel: string; meanings: string[];
    isDanger?: boolean; requireComments?: boolean;
  } | null>(null);
  const [actionModal, setActionModal] = useState<'finalize' | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'cert' | null>(null);

  const handleDownloadPdf = async () => {
    setDownloading('pdf');
    try {
      const blob = await reportsApi.downloadEbrPdf(id!);
      triggerDownload(blob, `EBR_${ebr?.batch_number}.pdf`);
    } catch { message.error('Failed to generate PDF'); }
    finally { setDownloading(null); }
  };

  const handleDownloadCert = async () => {
    setDownloading('cert');
    try {
      const blob = await reportsApi.downloadCertificate(id!);
      triggerDownload(blob, `Certificate_${ebr?.batch_number}.pdf`);
    } catch { message.error('Certificate only available for released batches'); }
    finally { setDownloading(null); }
  };
  const [actionForm] = Form.useForm();
  const [finalizeForm] = Form.useForm();

  // Per-step editable state: { [stepId]: { params: {[paramId]: {val, notes}}, ipqcs: {...}, yield, notes } }
  const [stepData, setStepData] = useState<Record<string, any>>({});

  const { data: ebr, isLoading } = useQuery({
    queryKey: ['ebr', id],
    queryFn: () => ebrApi.get(id!),
    enabled: !!id,
    refetchInterval: 10000, // poll every 10s during execution
  });

  // Auto-select first non-completed step
  useEffect(() => {
    if (ebr && !selectedStepId) {
      const active = ebr.steps.find(s => s.status !== 'COMPLETED') || ebr.steps[0];
      if (active) setSelectedStepId(active.id);
    }
  }, [ebr?.id]);

  // Initialise local step state from loaded data
  useEffect(() => {
    if (!ebr) return;
    const init: Record<string, any> = {};
    ebr.steps.forEach(s => {
      if (!stepData[s.id]) {
        init[s.id] = {
          params: Object.fromEntries(s.parameter_results.map(p => [p.id, { val: p.actual_value || '', notes: p.notes || '' }])),
          ipqcs: Object.fromEntries(s.ipqc_results.map(i => [i.id, { result: i.actual_result || '', passed: i.passed, notes: i.notes || '' }])),
          yield: s.actual_yield ?? '',
          notes: s.execution_notes || '',
        };
      }
    });
    if (Object.keys(init).length) setStepData(prev => ({ ...init, ...prev }));
  }, [ebr]);

  const startMutation = useMutation({
    mutationFn: (stepId: string) => ebrApi.startStep(id!, stepId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ebr', id] }); message.success('Step started'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed'),
  });

  const saveMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: any }) => ebrApi.saveStep(id!, stepId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ebr', id] }); message.success('Progress saved'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed'),
  });

  const completeMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: any }) => ebrApi.completeStep(id!, stepId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ebr', id] });
      if (result.out_of_range_params?.length || result.failed_ipqcs?.length) {
        message.warning(`Step signed off with issues: ${[...result.out_of_range_params, ...result.failed_ipqcs].join(', ')}`);
      } else {
        message.success('Step completed and signed off');
      }
      // Auto-advance to next step
      if (!result.all_steps_done && ebr) {
        const currentIdx = ebr.steps.findIndex(s => s.id === selectedStepId);
        const next = ebr.steps[currentIdx + 1];
        if (next) setSelectedStepId(next.id);
      }
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed'),
  });

  const dispenseMutation = useMutation({
    mutationFn: ({ materialId, data }: { materialId: string; data: any }) => ebrApi.dispenseMaterial(id!, materialId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ebr', id] }); message.success('Material dispensed'); },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed'),
  });

  const finalizeMutation = useMutation({
    mutationFn: (data: any) => ebrApi.finalize(id!, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['ebr', id] });
      setActionModal(null);
      message.success(`Batch finalized — yield ${res.yield_percentage?.toFixed(1) ?? '—'}%`);
    },
    onError: (err: any) => message.error(err.response?.data?.detail || 'Failed'),
  });

  const handleSignSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['ebr', id] });
    queryClient.invalidateQueries({ queryKey: ['esignatures', 'ebr', id] });
    message.success('Signature recorded — batch record updated');
    setSignConfig(null);
  };

  if (isLoading || !ebr) return <Card loading />;

  const completedSteps = ebr.steps.filter(s => s.status === 'COMPLETED').length;
  const totalSteps = ebr.steps.length;
  const progress = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const selectedStep = ebr.steps.find(s => s.id === selectedStepId);
  const dispensedCount = ebr.materials.filter(m => m.is_dispensed).length;
  const statusCfg = STATUS_CFG[ebr.status];

  // Build payload for current step
  const buildStepPayload = (stepId: string) => {
    const sd = stepData[stepId] || {};
    const step = ebr.steps.find(s => s.id === stepId)!;
    return {
      actual_yield: sd.yield || undefined,
      execution_notes: sd.notes || undefined,
      parameters: step.parameter_results.map(p => ({
        id: p.id,
        actual_value: sd.params?.[p.id]?.val || undefined,
        notes: sd.params?.[p.id]?.notes || undefined,
      })),
      ipqcs: step.ipqc_results.map(i => ({
        id: i.id,
        actual_result: sd.ipqcs?.[i.id]?.result || undefined,
        passed: sd.ipqcs?.[i.id]?.passed,
        notes: sd.ipqcs?.[i.id]?.notes || undefined,
      })),
    };
  };

  const handleAction = (values: any) => { /* finalize only */ };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top Header */}
      <div style={{ background: '#fff', padding: '16px 24px', borderRadius: 8, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Space direction="vertical" size={4}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/ebr')}>Batches</Button>
            </Space>
            <Space align="center">
              <Title level={4} style={{ margin: 0 }}>{ebr.batch_number}</Title>
              <Tag style={{ fontSize: 12 }}>{ebr.ebr_number}</Tag>
              <Badge status={statusCfg.color as any} text={statusCfg.label} />
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {ebr.product_name} · {ebr.product_code}{ebr.strength && ` · ${ebr.strength}`}
              {' · '}MBR: {ebr.mbr_number} v{ebr.mbr_version}
            </Text>
          </Space>

          <Space wrap>
            <Button
              icon={<FilePdfOutlined />}
              loading={downloading === 'pdf'}
              onClick={handleDownloadPdf}
            >
              Batch Record PDF
            </Button>
            {ebr.status === 'APPROVED' && (
              <Button
                icon={<SafetyCertificateOutlined />}
                loading={downloading === 'cert'}
                onClick={handleDownloadCert}
                type="primary"
                ghost
              >
                Release Certificate
              </Button>
            )}
            {hasPermission('ebr:execute') && ebr.status === 'COMPLETED' && (
              <Button icon={<SendOutlined />} type="primary" ghost onClick={() => setSignConfig({
                action: 'submit', actionLabel: 'Submit & Sign',
                meanings: ['Submitted for QA Review — Operator Confirmation'],
              })}>
                Submit for QA Review
              </Button>
            )}
            {hasPermission('ebr:approve') && ebr.status === 'UNDER_REVIEW' && (
              <>
                <Button icon={<CloseOutlined />} danger onClick={() => setSignConfig({
                  action: 'reject', actionLabel: 'Reject & Sign',
                  meanings: ['Rejected — Out-of-Specification Results', 'Rejected — Documentation Incomplete', 'Rejected — See Deviation Report'],
                  isDanger: true, requireComments: true,
                })}>Reject</Button>
                <Button icon={<CheckOutlined />} type="primary" onClick={() => setSignConfig({
                  action: 'approve', actionLabel: 'Release Batch & Sign',
                  meanings: ['Released for Distribution', 'Approved — Meets All Quality Specifications', 'QA Released — Batch Disposition Complete'],
                })}>Release Batch</Button>
              </>
            )}
          </Space>
        </div>

        {/* Progress bar */}
        <Row gutter={24} style={{ marginTop: 16 }}>
          <Col span={12}>
            <div style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 12 }}>Execution Progress: {completedSteps}/{totalSteps} steps</Text>
            </div>
            <Progress percent={progress} strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }} />
          </Col>
          <Col span={4}>
            <Statistic title="Materials Dispensed" value={`${dispensedCount}/${ebr.materials.length}`} valueStyle={{ fontSize: 18 }} />
          </Col>
          <Col span={4}>
            <Statistic title="Batch Size" value={ebr.planned_batch_size ? `${ebr.planned_batch_size} ${ebr.batch_unit || ''}` : '—'} valueStyle={{ fontSize: 18 }} />
          </Col>
          <Col span={4}>
            <Statistic title="Yield" value={ebr.yield_percentage != null ? `${ebr.yield_percentage.toFixed(1)}%` : '—'}
              valueStyle={{ fontSize: 18, color: ebr.yield_percentage && ebr.yield_percentage >= 98 ? '#52c41a' : undefined }} />
          </Col>
        </Row>
      </div>

      {/* Alerts */}
      {ebr.status === 'UNDER_REVIEW' && (
        <Alert type="warning" showIcon message="This batch is submitted for QA review — no further edits allowed." style={{ marginBottom: 16 }} />
      )}
      {ebr.status === 'APPROVED' && (
        <Alert type="success" showIcon message="Batch released. All records are locked." style={{ marginBottom: 16 }} />
      )}
      {ebr.status === 'REJECTED' && (
        <Alert type="error" showIcon message="Batch was rejected by QA." style={{ marginBottom: 16 }} />
      )}

      {/* Main Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        // ── Tab: Steps ──
        {
          key: 'steps',
          label: `Manufacturing Steps (${completedSteps}/${totalSteps})`,
          children: (
            <div style={{ display: 'flex', gap: 16 }}>
              {/* Left: Step list */}
              <div style={{ width: 280, flexShrink: 0 }}>
                <Card size="small" title="Steps" bodyStyle={{ padding: '8px' }}>
                  {ebr.steps.map(s => (
                    <StepItem key={s.id} step={s} selected={s.id === selectedStepId} onClick={() => setSelectedStepId(s.id)} />
                  ))}
                </Card>
              </div>

              {/* Right: Step detail */}
              <div style={{ flex: 1 }}>
                {!selectedStep ? (
                  <Card><Text type="secondary">Select a step from the left to begin.</Text></Card>
                ) : (
                  <Card
                    title={
                      <Space>
                        <Tag color="blue">Step {selectedStep.step_number}</Tag>
                        <span>{selectedStep.title}</span>
                        {selectedStep.is_critical && <Tag color="red">Critical</Tag>}
                        <Badge
                          status={selectedStep.status === 'COMPLETED' ? 'success' : selectedStep.status === 'IN_PROGRESS' ? 'processing' : 'default'}
                          text={selectedStep.status}
                        />
                      </Space>
                    }
                    extra={
                      <Space>
                        {selectedStep.expected_duration_minutes && (
                          <Tag icon={<ClockCircleOutlined />}>{selectedStep.expected_duration_minutes} min</Tag>
                        )}
                        {selectedStep.started_at && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Started: {new Date(selectedStep.started_at).toLocaleTimeString()}
                          </Text>
                        )}
                      </Space>
                    }
                  >
                    {/* PENDING: just show start button */}
                    {selectedStep.status === 'PENDING' && (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        {selectedStep.description && (
                          <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'left', maxWidth: 600, margin: '0 auto 24px' }}>
                            <Text>{selectedStep.description}</Text>
                          </div>
                        )}
                        {ebr.status !== 'UNDER_REVIEW' && ebr.status !== 'APPROVED' && hasPermission('ebr:execute') && (
                          <Button type="primary" size="large" icon={<PlayCircleOutlined />}
                            loading={startMutation.isPending}
                            onClick={() => startMutation.mutate(selectedStep.id)}>
                            Start Step {selectedStep.step_number}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* IN_PROGRESS: show execution form */}
                    {selectedStep.status === 'IN_PROGRESS' && (
                      <div>
                        {selectedStep.description && (
                          <Alert type="info" message={selectedStep.description} style={{ marginBottom: 16 }} />
                        )}
                        {selectedStep.notes_template && (
                          <Alert type="warning" message={`Note: ${selectedStep.notes_template}`} style={{ marginBottom: 16 }} />
                        )}

                        {/* Process Parameters */}
                        {selectedStep.parameter_results.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                              Process Parameters
                              {selectedStep.parameter_results.some(p => p.is_critical) && (
                                <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>Contains Critical Parameters</Tag>
                              )}
                            </div>
                            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: '#fafafa', fontSize: 12 }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Parameter</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Unit</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Specification</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Actual Value</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedStep.parameter_results.map(p => (
                                    <ParameterRow key={p.id} param={p}
                                      onChange={(val, notes) => setStepData(prev => ({
                                        ...prev,
                                        [selectedStep.id]: {
                                          ...prev[selectedStep.id],
                                          params: { ...prev[selectedStep.id]?.params, [p.id]: { val, notes } }
                                        }
                                      }))}
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                        {/* IPQC Checks */}
                        {selectedStep.ipqc_results.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>In-Process Quality Controls (IPQC)</div>
                            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: '#fafafa', fontSize: 12 }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Test</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Acceptance Criteria</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Frequency</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Actual Result</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Pass/Fail</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedStep.ipqc_results.map(i => (
                                    <IPQCRow key={i.id} ipqc={i}
                                      onChange={(result, passed, notes) => setStepData(prev => ({
                                        ...prev,
                                        [selectedStep.id]: {
                                          ...prev[selectedStep.id],
                                          ipqcs: { ...prev[selectedStep.id]?.ipqcs, [i.id]: { result, passed, notes } }
                                        }
                                      }))}
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                        {/* Yield + Notes */}
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          <Col span={8}>
                            <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
                              Actual Yield {selectedStep.yield_unit && `(${selectedStep.yield_unit})`}
                            </div>
                            <InputNumber
                              style={{ width: '100%' }}
                              value={stepData[selectedStep.id]?.yield || undefined}
                              onChange={v => setStepData(prev => ({ ...prev, [selectedStep.id]: { ...prev[selectedStep.id], yield: v } }))}
                              placeholder={selectedStep.expected_yield ? `Expected: ${selectedStep.expected_yield}` : 'Optional'}
                              min={0}
                            />
                          </Col>
                          <Col span={16}>
                            <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Step Notes</div>
                            <Input.TextArea
                              rows={2}
                              value={stepData[selectedStep.id]?.notes || ''}
                              onChange={e => setStepData(prev => ({ ...prev, [selectedStep.id]: { ...prev[selectedStep.id], notes: e.target.value } }))}
                              placeholder="Record any observations, deviations, or notes for this step..."
                            />
                          </Col>
                        </Row>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                          <Button icon={<SaveOutlined />} onClick={() => saveMutation.mutate({ stepId: selectedStep.id, data: buildStepPayload(selectedStep.id) })}
                            loading={saveMutation.isPending}>
                            Save Progress
                          </Button>
                          <Button type="primary" icon={<CheckCircleOutlined />}
                            loading={completeMutation.isPending}
                            onClick={() => completeMutation.mutate({ stepId: selectedStep.id, data: buildStepPayload(selectedStep.id) })}>
                            Complete & Sign Off Step {selectedStep.step_number}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* COMPLETED: read-only view */}
                    {selectedStep.status === 'COMPLETED' && (
                      <div>
                        <Alert type="success" showIcon
                          message={`Completed by ${selectedStep.operator?.full_name || '—'} at ${selectedStep.completed_at ? new Date(selectedStep.completed_at).toLocaleString() : '—'}`}
                          style={{ marginBottom: 16 }} />

                        {selectedStep.parameter_results.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Process Parameters — Recorded Values</div>
                            <Table
                              dataSource={selectedStep.parameter_results}
                              rowKey="id"
                              size="small"
                              pagination={false}
                              style={{ marginBottom: 16 }}
                              columns={[
                                { title: 'Parameter', dataIndex: 'parameter_name', render: (v, r: any) => <Space>{v}{r.is_critical && <Tag color="orange" style={{ fontSize: 10 }}>CPP</Tag>}</Space> },
                                { title: 'Unit', dataIndex: 'unit', render: v => v || '—' },
                                { title: 'Target', dataIndex: 'target_value', render: v => v || '—' },
                                { title: 'Range', render: (_, r: any) => `${r.min_value || '—'} – ${r.max_value || '—'}` },
                                { title: 'Actual', dataIndex: 'actual_value', render: (v, r: any) => (
                                  <Space>
                                    <span style={{ fontWeight: 700, color: r.is_in_range === false ? '#ff4d4f' : r.is_in_range ? '#52c41a' : undefined }}>{v || '—'}</span>
                                    {r.is_in_range === false && <WarningOutlined style={{ color: '#ff4d4f' }} />}
                                  </Space>
                                )},
                                { title: 'Status', render: (_, r: any) => r.is_in_range === null || r.is_in_range === undefined ? '—' : r.is_in_range ? <Tag color="success">In Range</Tag> : <Tag color="error">Out of Range</Tag> },
                              ]}
                            />
                          </>
                        )}

                        {selectedStep.ipqc_results.length > 0 && (
                          <>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>IPQC Results</div>
                            <Table
                              dataSource={selectedStep.ipqc_results}
                              rowKey="id"
                              size="small"
                              pagination={false}
                              style={{ marginBottom: 16 }}
                              columns={[
                                { title: 'Test', dataIndex: 'test_name' },
                                { title: 'Acceptance Criteria', dataIndex: 'acceptance_criteria' },
                                { title: 'Actual Result', dataIndex: 'actual_result', render: v => v || '—' },
                                { title: 'Outcome', dataIndex: 'passed', render: v => v === true ? <Tag color="success">Pass</Tag> : v === false ? <Tag color="error">Fail</Tag> : <Tag>—</Tag> },
                              ]}
                            />
                          </>
                        )}

                        {selectedStep.actual_yield && (
                          <div>
                            <Text strong>Actual Yield: </Text>
                            <Text>{selectedStep.actual_yield} {selectedStep.yield_unit || ''}</Text>
                          </div>
                        )}
                        {selectedStep.execution_notes && (
                          <div style={{ marginTop: 8 }}>
                            <Text strong>Notes: </Text>
                            <Text>{selectedStep.execution_notes}</Text>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          ),
        },

        // ── Tab: Materials ──
        {
          key: 'materials',
          label: `Materials (${dispensedCount}/${ebr.materials.length} dispensed)`,
          children: (
            <MaterialsTab
              materials={ebr.materials}
              readOnly={ebr.status !== 'INITIATED' && ebr.status !== 'IN_PROGRESS'}
              canEdit={hasPermission('ebr:execute')}
              onDispense={(materialId, data) => dispenseMutation.mutate({ materialId, data })}
              isLoading={dispenseMutation.isPending}
            />
          ),
        },

        // ── Tab: Finalize ──
        {
          key: 'finalize',
          label: 'Finalize Batch',
          children: (
            <Card title="Batch Finalization">
              {ebr.status === 'INITIATED' || ebr.status === 'IN_PROGRESS' ? (
                <div>
                  <Alert type="info" showIcon style={{ marginBottom: 16 }}
                    message={`${totalSteps - completedSteps} step(s) remaining before batch can be finalized.`} />
                </div>
              ) : ebr.status === 'COMPLETED' || ebr.status === 'UNDER_REVIEW' || ebr.status === 'APPROVED' ? (
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="Batch Number">{ebr.batch_number}</Descriptions.Item>
                  <Descriptions.Item label="EBR Number">{ebr.ebr_number}</Descriptions.Item>
                  <Descriptions.Item label="Product">{ebr.product_name}</Descriptions.Item>
                  <Descriptions.Item label="MBR Reference">{ebr.mbr_number} v{ebr.mbr_version}</Descriptions.Item>
                  <Descriptions.Item label="Planned Size">{ebr.planned_batch_size || '—'} {ebr.batch_unit || ''}</Descriptions.Item>
                  <Descriptions.Item label="Actual Yield">{ebr.actual_yield || '—'} {ebr.actual_yield_unit || ''}</Descriptions.Item>
                  <Descriptions.Item label="Yield %">{ebr.yield_percentage != null ? `${ebr.yield_percentage.toFixed(2)}%` : '—'}</Descriptions.Item>
                  <Descriptions.Item label="Completed At">{ebr.completed_at ? new Date(ebr.completed_at).toLocaleString() : '—'}</Descriptions.Item>
                  {ebr.approved_by && (
                    <>
                      <Descriptions.Item label="Released By">{ebr.approved_by.full_name}</Descriptions.Item>
                      <Descriptions.Item label="Release Date">{ebr.approved_at ? new Date(ebr.approved_at).toLocaleString() : '—'}</Descriptions.Item>
                    </>
                  )}
                </Descriptions>
              ) : null}

              {/* Finalize button */}
              {ebr.status === 'COMPLETED' && completedSteps === totalSteps && hasPermission('ebr:execute') && !ebr.actual_yield && (
                <div style={{ marginTop: 24 }}>
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setActionModal('finalize')}>
                    Enter Final Yield & Close Batch
                  </Button>
                </div>
              )}
            </Card>
          ),
        },
      ]} />

      {/* Finalize Modal */}
      <Modal
        title="Finalize Batch — Enter Yield"
        open={actionModal === 'finalize'}
        onCancel={() => { setActionModal(null); finalizeForm.resetFields(); }}
        onOk={() => finalizeForm.submit()}
        confirmLoading={finalizeMutation.isPending}
        okText="Finalize"
        width={480}
        destroyOnClose
      >
        <Form form={finalizeForm} layout="vertical" onFinish={v => finalizeMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="actual_yield" label="Actual Yield">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 97.5" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_yield_unit" label="Unit">
                <Input placeholder="kg / L / units" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Finalization Notes">
            <Input.TextArea rows={2} placeholder="Any final batch notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* E-Signature Modal */}
      {signConfig && ebr && (
        <ESignatureModal
          open={!!signConfig}
          onClose={() => setSignConfig(null)}
          onSuccess={handleSignSuccess}
          resourceType="ebr"
          resourceId={id!}
          resourceLabel={`${ebr.ebr_number} — Batch ${ebr.batch_number}`}
          action={signConfig.action}
          actionLabel={signConfig.actionLabel}
          meanings={signConfig.meanings}
          isDanger={signConfig.isDanger}
          requireComments={signConfig.requireComments}
        />
      )}

      {/* Signature History */}
      {id && <SignatureList resourceType="ebr" resourceId={id} />}
    </div>
  );
}

// ── Materials Tab ─────────────────────────────────────────────────────────
function MaterialsTab({ materials, readOnly, canEdit, onDispense, isLoading }: {
  materials: EBRMaterialDispensing[];
  readOnly: boolean;
  canEdit: boolean;
  onDispense: (id: string, data: any) => void;
  isLoading: boolean;
}) {
  const [dispensingId, setDispensingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const dispensedCount = materials.filter(m => m.is_dispensed).length;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Progress percent={Math.round((dispensedCount / Math.max(materials.length, 1)) * 100)}
          format={() => `${dispensedCount}/${materials.length} dispensed`} />
      </div>
      <Table
        dataSource={materials}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: '#', key: 'i', width: 40, render: (_: any, _r: any, i: number) => i + 1 },
          { title: 'Material', key: 'mat', render: (_: any, r: EBRMaterialDispensing) => (
            <Space>{r.material_name}{r.is_active_ingredient && <Tag color="red" style={{ fontSize: 10 }}>API</Tag>}</Space>
          )},
          { title: 'Code', dataIndex: 'material_code', render: v => v || '—' },
          { title: 'Required Qty', key: 'req', render: (_: any, r: EBRMaterialDispensing) => `${r.required_quantity} ${r.unit}` },
          { title: 'Actual Qty', key: 'actual', render: (_: any, r: EBRMaterialDispensing) => r.actual_quantity ? `${r.actual_quantity} ${r.unit}` : <span style={{ color: '#ccc' }}>—</span> },
          { title: 'Lot Number', dataIndex: 'lot_number', render: v => v ? <Tag>{v}</Tag> : <span style={{ color: '#ccc' }}>—</span> },
          { title: 'Expiry', dataIndex: 'expiry_date', render: v => v || '—' },
          { title: 'Status', key: 'status', render: (_: any, r: EBRMaterialDispensing) =>
            r.is_dispensed ? <Badge status="success" text="Dispensed" /> : <Badge status="default" text="Pending" />
          },
          {
            title: 'Action', key: 'action',
            render: (_: any, r: EBRMaterialDispensing) => !readOnly && canEdit && !r.is_dispensed ? (
              <Button size="small" type="primary" ghost onClick={() => { setDispensingId(r.id); form.resetFields(); }}>
                Dispense
              </Button>
            ) : r.is_dispensed ? (
              <Text type="secondary" style={{ fontSize: 12 }}>✓ by {r.dispensed_by?.full_name || '—'}</Text>
            ) : null,
          },
        ]}
      />

      {/* Dispense modal */}
      <Modal
        title={`Dispense: ${materials.find(m => m.id === dispensingId)?.material_name || ''}`}
        open={!!dispensingId}
        onCancel={() => setDispensingId(null)}
        onOk={() => form.submit()}
        confirmLoading={isLoading}
        destroyOnClose
      >
        {dispensingId && (() => {
          const mat = materials.find(m => m.id === dispensingId)!;
          return (
            <Form form={form} layout="vertical" onFinish={v => { onDispense(dispensingId, { ...v, expiry_date: v.expiry_date ? v.expiry_date.format('YYYY-MM-DD') : undefined }); setDispensingId(null); }} style={{ marginTop: 16 }}>
              <Alert type="info" style={{ marginBottom: 12 }}
                message={`Required: ${mat.required_quantity} ${mat.unit}${mat.grade ? ` · ${mat.grade}` : ''}`} />
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="actual_quantity" label={`Actual Quantity (${mat.unit})`} rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="lot_number" label="Lot Number" rules={[{ required: true }]}>
                    <Input placeholder="LOT-YYYYNNNNN" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="expiry_date" label="Expiry Date">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="notes" label="Notes">
                    <Input placeholder="Optional notes" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          );
        })()}
      </Modal>
    </div>
  );
}
