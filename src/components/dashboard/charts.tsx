"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ==========================================
// Types
// ==========================================

interface DataPoint {
  label: string;
  [key: string]: string | number;
}

interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

interface BaseChartProps {
  title?: string;
  description?: string;
  data: DataPoint[];
  series: SeriesConfig[];
  height?: number;
  className?: string;
  loading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number, name: string) => string;
}

// ==========================================
// Color palette
// ==========================================

export const CHART_COLORS = [
  "hsl(217, 91%, 60%)",  // blue
  "hsl(142, 71%, 45%)",  // green
  "hsl(38, 92%, 50%)",   // amber
  "hsl(0, 84%, 60%)",    // red
  "hsl(262, 83%, 58%)",  // purple
  "hsl(186, 73%, 46%)",  // cyan
  "hsl(330, 81%, 60%)",  // pink
  "hsl(24, 95%, 53%)",   // orange
];

// ==========================================
// Custom Tooltip
// ==========================================

function CustomTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  formatValue?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {formatValue
              ? formatValue(entry.value, entry.name)
              : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// Chart wrapper with card
// ==========================================

function ChartWrapper({
  title,
  description,
  height = 300,
  loading,
  className,
  children,
}: {
  title?: string;
  description?: string;
  height: number;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(className)}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent className="pt-2">
        {loading ? (
          <div
            className="w-full bg-muted/50 animate-pulse rounded"
            style={{ height }}
          />
        ) : (
          <div style={{ width: "100%", height }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// LineChart component
// ==========================================

export function TimeSeriesChart({
  title,
  description,
  data,
  series,
  height = 300,
  className,
  loading,
  showGrid = true,
  showLegend = true,
  formatYAxis,
  formatTooltip,
}: BaseChartProps) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      height={height}
      loading={loading}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            width={50}
          />
          <Tooltip
            content={<CustomTooltip formatValue={formatTooltip} />}
          />
          {showLegend && <Legend iconType="circle" iconSize={8} />}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// ==========================================
// AreaChart component
// ==========================================

export function AreaSeriesChart({
  title,
  description,
  data,
  series,
  height = 300,
  className,
  loading,
  showGrid = true,
  showLegend = false,
  formatYAxis,
  formatTooltip,
}: BaseChartProps & { stacked?: boolean }) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      height={height}
      loading={loading}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            width={50}
          />
          <Tooltip
            content={<CustomTooltip formatValue={formatTooltip} />}
          />
          {showLegend && <Legend iconType="circle" iconSize={8} />}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// ==========================================
// BarChart component
// ==========================================

export function BarSeriesChart({
  title,
  description,
  data,
  series,
  height = 300,
  className,
  loading,
  showGrid = true,
  showLegend = true,
  formatYAxis,
  formatTooltip,
  stacked = false,
}: BaseChartProps & { stacked?: boolean }) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      height={height}
      loading={loading}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            width={50}
          />
          <Tooltip
            content={<CustomTooltip formatValue={formatTooltip} />}
          />
          {showLegend && <Legend iconType="circle" iconSize={8} />}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// ==========================================
// DonutChart component
// ==========================================

interface DonutChartProps {
  title?: string;
  description?: string;
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  className?: string;
  loading?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

export function DonutChart({
  title,
  description,
  data,
  height = 250,
  className,
  loading,
  innerRadius = 60,
  outerRadius = 90,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  return (
    <ChartWrapper
      title={title}
      description={description}
      height={height}
      loading={loading}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0];
              return (
                <div className="rounded-lg border bg-background p-3 shadow-md">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {Number(item.value).toLocaleString()} (
                    {((Number(item.value) / total) * 100).toFixed(1)}%)
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// ==========================================
// Sparkline — tiny inline chart
// ==========================================

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 30,
  color = "hsl(217, 91%, 60%)",
  className,
}: SparklineProps) {
  const chartData = data.map((value, i) => ({ i, value }));

  return (
    <div className={cn("inline-block", className)}>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ==========================================
// Formatter helpers (exported for reuse)
// ==========================================

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
