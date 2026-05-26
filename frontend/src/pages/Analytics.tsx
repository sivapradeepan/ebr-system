import { Card, Row, Col, Typography, Statistic, Progress, Tag, Space, Skeleton, Empty } from 'antd';
import {
  ExperimentOutlined, CheckCircleOutlined, WarningOutlined,
  BarChartOutlined, LineChartOutlined, PieChartOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { reportsApi } from '../api/reports';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  INITIATED:    '#94a3b8',
  IN_PROGRESS:  '#3b82f6',
  COMPLETED:    '#f59e0b',
  UNDER_REVIEW: '#a855f7',
  APPROVED:     '#22c55e',
  REJECTED:     '#ef4444',
};

const SEV_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  MAJOR:    '#f97316',
  MINOR:    '#facc15',
};

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Space style={{ marginBottom: 12 }}>
      <span style={{ color: '#1677ff', fontSize: 16 }}>{icon}</span>
      <Title level={5} style={{ margin: 0 }}>{title}</Title>
    </Space>
  );
}

export default function Analytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: reportsApi.analytics,
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div>
        <Title level={4}>Analytics & Trends</Title>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map(k => (
            <Col xs={24} sm={12} lg={6} key={k}><Card><Skeleton active /></Card></Col>
          ))}
        </Row>
      </div>
    );
  }

  if (!data) return <Empty description="No analytics data available" />;

  const ipqcPassRate = data.ipqc.pass_rate ?? 0;
  const paramPassRate = data.parameters.pass_rate ?? 0;

  // KPI cards
  const kpis = [
    {
      title: 'IPQC Pass Rate',
      value: data.ipqc.total > 0 ? `${ipqcPassRate}%` : '—',
      icon: <CheckCircleOutlined />,
      color: ipqcPassRate >= 95 ? '#22c55e' : ipqcPassRate >= 85 ? '#f59e0b' : '#ef4444',
      sub: `${data.ipqc.passed} passed / ${data.ipqc.failed} failed`,
    },
    {
      title: 'Parameter Compliance',
      value: data.parameters.total > 0 ? `${paramPassRate}%` : '—',
      icon: <ExperimentOutlined />,
      color: paramPassRate >= 98 ? '#22c55e' : paramPassRate >= 90 ? '#f59e0b' : '#ef4444',
      sub: `${data.parameters.out_of_range} out-of-range`,
    },
    {
      title: 'Total Batches',
      value: data.status_breakdown.reduce((s, r) => s + r.count, 0),
      icon: <BarChartOutlined />,
      color: '#1677ff',
      sub: `${data.status_breakdown.find(r => r.status === 'APPROVED')?.count ?? 0} released`,
    },
    {
      title: 'Open Deviations',
      value: data.deviations_by_severity.reduce((s, r) => s + r.open, 0),
      icon: <WarningOutlined />,
      color: data.deviations_by_severity.reduce((s, r) => s + r.open, 0) > 0 ? '#ef4444' : '#22c55e',
      sub: `${data.deviations_by_severity.find(r => r.severity === 'CRITICAL')?.open ?? 0} critical`,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Analytics & Trends</Title>
        <Text type="secondary">Quality metrics and batch performance overview</Text>
      </div>

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {kpis.map(kpi => (
          <Col xs={24} sm={12} lg={6} key={kpi.title}>
            <Card>
              <Statistic
                title={kpi.title}
                value={kpi.value}
                prefix={<span style={{ color: kpi.color }}>{kpi.icon}</span>}
                valueStyle={{ color: kpi.color, fontSize: 22 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>{kpi.sub}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Yield Trend */}
        <Col xs={24} lg={16}>
          <Card>
            <SectionTitle icon={<LineChartOutlined />} title="Yield Trend — Last 20 Batches" />
            {data.yield_trend.length === 0 ? (
              <Empty description="No completed batches yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.yield_trend} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="batch_number" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis domain={[80, 105]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: any) => [`${v}%`, 'Yield']}
                    labelFormatter={(label) => {
                      const row = data.yield_trend.find(r => r.batch_number === label);
                      return `${label} — ${row?.product_name ?? ''}`;
                    }}
                  />
                  <ReferenceLine y={98} stroke="#22c55e" strokeDasharray="4 2"
                    label={{ value: 'Target 98%', fill: '#22c55e', fontSize: 10 }} />
                  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 2"
                    label={{ value: 'Min 90%', fill: '#ef4444', fontSize: 10 }} />
                  <Line
                    type="monotone" dataKey="yield_percentage" name="Yield %"
                    stroke="#1677ff" strokeWidth={2} dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* Status Breakdown */}
        <Col xs={24} lg={8}>
          <Card style={{ height: '100%' }}>
            <SectionTitle icon={<PieChartOutlined />} title="Batch Status Breakdown" />
            {data.status_breakdown.length === 0 ? (
              <Empty description="No batches yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.status_breakdown}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ label, count }) => `${label}: ${count}`}
                      labelLine={false}
                    >
                      {data.status_breakdown.map(entry => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {data.status_breakdown.map(r => (
                    <Tag key={r.status}
                      style={{ background: STATUS_COLORS[r.status] + '20',
                               borderColor: STATUS_COLORS[r.status],
                               color: STATUS_COLORS[r.status] }}>
                      {r.label}: {r.count}
                    </Tag>
                  ))}
                </div>
              </>
            )}
          </Card>
        </Col>

        {/* Monthly Throughput */}
        <Col xs={24} lg={14}>
          <Card>
            <SectionTitle icon={<BarChartOutlined />} title="Monthly Batch Throughput (Last 6 Months)" />
            {data.monthly_throughput.length === 0 ? (
              <Empty description="No data for the period" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={data.monthly_throughput} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="initiated" name="Initiated" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="released" name="Released"  fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* Quality Metrics */}
        <Col xs={24} lg={10}>
          <Card style={{ height: '100%' }}>
            <SectionTitle icon={<CheckCircleOutlined />} title="Quality Metrics" />

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13 }}>IPQC Pass Rate</Text>
                <Text strong style={{ color: ipqcPassRate >= 95 ? '#22c55e' : '#f59e0b' }}>
                  {data.ipqc.total > 0 ? `${ipqcPassRate}%` : 'N/A'}
                </Text>
              </div>
              <Progress
                percent={ipqcPassRate}
                strokeColor={ipqcPassRate >= 95 ? '#22c55e' : ipqcPassRate >= 85 ? '#f59e0b' : '#ef4444'}
                showInfo={false}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {data.ipqc.passed} passed · {data.ipqc.failed} failed · {data.ipqc.pending} pending
              </Text>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13 }}>Parameter Compliance</Text>
                <Text strong style={{ color: paramPassRate >= 98 ? '#22c55e' : '#f59e0b' }}>
                  {data.parameters.total > 0 ? `${paramPassRate}%` : 'N/A'}
                </Text>
              </div>
              <Progress
                percent={paramPassRate}
                strokeColor={paramPassRate >= 98 ? '#22c55e' : paramPassRate >= 90 ? '#f59e0b' : '#ef4444'}
                showInfo={false}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {data.parameters.in_range} in-range · {data.parameters.out_of_range} out-of-range
              </Text>
            </div>

            <div>
              <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Deviations by Severity
              </Text>
              {data.deviations_by_severity.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>No deviations recorded</Text>
              ) : (
                data.deviations_by_severity.map(d => (
                  <div key={d.severity} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Tag color={SEV_COLORS[d.severity]} style={{ width: 64, textAlign: 'center', margin: 0 }}>
                      {d.severity}
                    </Tag>
                    <div style={{ flex: 1 }}>
                      <Progress
                        percent={d.total > 0 ? Math.round(d.closed / d.total * 100) : 0}
                        size="small"
                        strokeColor={SEV_COLORS[d.severity]}
                        showInfo={false}
                      />
                    </div>
                    <Text style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {d.open} open / {d.total} total
                    </Text>
                  </div>
                ))
              )}
            </div>
          </Card>
        </Col>

        {/* Top Products */}
        <Col xs={24}>
          <Card>
            <SectionTitle icon={<ExperimentOutlined />} title="Top Products by Batch Count" />
            {data.top_products.length === 0 ? (
              <Empty description="No batches yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={data.top_products}
                  layout="vertical"
                  margin={{ left: 20, right: 40, top: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="product" width={180} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [v, 'Batches']} />
                  <Bar dataKey="batches" name="Batches" fill="#1677ff" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 11, fill: '#64748b' }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
