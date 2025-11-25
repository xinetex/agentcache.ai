/**
 * Dynamic View Schema Definition
 * 
 * Safe, declarative JSON schema for rendering interactive UIs
 * Inspired by Google's Dynamic View generative UI concept
 */

// ========== Core Types ==========

export type ComponentType = 
  // Layout
  | 'container' | 'row' | 'column' | 'grid'
  // Interactive
  | 'button' | 'input' | 'slider' | 'toggle' | 'select'
  // Display
  | 'text' | 'heading' | 'badge' | 'metric' | 'card'
  // Data Viz
  | 'chart' | 'progress' | 'sparkline'
  // Pipeline Specific
  | 'node-card' | 'connection-flow' | 'pipeline-diagram';

export interface ComponentStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
  width?: string;
  height?: string;
  className?: string;
}

export interface BaseComponent {
  id: string;
  type: ComponentType;
  style?: ComponentStyle;
  hidden?: boolean;
}

// ========== Layout Components ==========

export interface ContainerComponent extends BaseComponent {
  type: 'container';
  children: DynamicViewComponent[];
  layout?: 'vertical' | 'horizontal';
}

export interface RowComponent extends BaseComponent {
  type: 'row';
  children: DynamicViewComponent[];
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface ColumnComponent extends BaseComponent {
  type: 'column';
  children: DynamicViewComponent[];
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export interface GridComponent extends BaseComponent {
  type: 'grid';
  children: DynamicViewComponent[];
  columns?: number;
  gap?: number;
}

// ========== Interactive Components ==========

export interface ButtonComponent extends BaseComponent {
  type: 'button';
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: string; // Event handler ID (sanitized)
  disabled?: boolean;
}

export interface InputComponent extends BaseComponent {
  type: 'input';
  label?: string;
  placeholder?: string;
  value?: string;
  inputType?: 'text' | 'number' | 'email';
  onChange?: string; // Event handler ID
}

export interface SliderComponent extends BaseComponent {
  type: 'slider';
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange?: string;
}

export interface ToggleComponent extends BaseComponent {
  type: 'toggle';
  label?: string;
  checked: boolean;
  onChange?: string;
}

export interface SelectComponent extends BaseComponent {
  type: 'select';
  label?: string;
  options: Array<{ label: string; value: string }>;
  value?: string;
  onChange?: string;
}

// ========== Display Components ==========

export interface TextComponent extends BaseComponent {
  type: 'text';
  content: string;
  size?: 'sm' | 'md' | 'lg';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export interface HeadingComponent extends BaseComponent {
  type: 'heading';
  content: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface BadgeComponent extends BaseComponent {
  type: 'badge';
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  icon?: string;
}

export interface MetricComponent extends BaseComponent {
  type: 'metric';
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export interface CardComponent extends BaseComponent {
  type: 'card';
  title?: string;
  children: DynamicViewComponent[];
  variant?: 'default' | 'outlined' | 'elevated';
}

// ========== Data Visualization Components ==========

export interface ChartComponent extends BaseComponent {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'donut';
  data: Array<{ label: string; value: number }>;
  title?: string;
  showLegend?: boolean;
}

export interface ProgressComponent extends BaseComponent {
  type: 'progress';
  label?: string;
  value: number; // 0-100
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export interface SparklineComponent extends BaseComponent {
  type: 'sparkline';
  data: number[];
  variant?: 'line' | 'bar';
}

// ========== Pipeline-Specific Components ==========

export interface NodeCardComponent extends BaseComponent {
  type: 'node-card';
  nodeType: string;
  label: string;
  icon?: string;
  metadata?: Record<string, string | number>;
  status?: 'active' | 'inactive' | 'error';
}

export interface ConnectionFlowComponent extends BaseComponent {
  type: 'connection-flow';
  from: string;
  to: string;
  label?: string;
  active?: boolean;
}

export interface PipelineDiagramComponent extends BaseComponent {
  type: 'pipeline-diagram';
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    position?: { x: number; y: number };
  }>;
  connections: Array<{
    from: string;
    to: string;
  }>;
}

// ========== Union Type ==========

export type DynamicViewComponent = 
  | ContainerComponent
  | RowComponent
  | ColumnComponent
  | GridComponent
  | ButtonComponent
  | InputComponent
  | SliderComponent
  | ToggleComponent
  | SelectComponent
  | TextComponent
  | HeadingComponent
  | BadgeComponent
  | MetricComponent
  | CardComponent
  | ChartComponent
  | ProgressComponent
  | SparklineComponent
  | NodeCardComponent
  | ConnectionFlowComponent
  | PipelineDiagramComponent;

// ========== Root Schema ==========

export interface DynamicViewSchema {
  version: string; // e.g., "1.0"
  id: string;
  title: string;
  description?: string;
  root: DynamicViewComponent;
  metadata?: {
    generatedBy?: 'latent-manipulator' | 'llm' | 'template';
    generatedAt?: number;
    promptHash?: string;
    cached?: boolean;
    freshness?: 'fresh' | 'stale' | 'expired';
  };
}

// ========== Validation ==========

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const SAFETY_LIMITS = {
  MAX_DEPTH: 10,
  MAX_CHILDREN: 50,
  MAX_STRING_LENGTH: 1000,
  MAX_DATA_POINTS: 1000,
  ALLOWED_EVENT_HANDLERS: ['onClick', 'onChange', 'onSubmit'],
  SANITIZE_HTML: true,
};

export function validateSchema(schema: DynamicViewSchema): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate version
  if (!schema.version || !/^\d+\.\d+$/.test(schema.version)) {
    errors.push('Invalid or missing version');
  }

  // Validate basic structure
  if (!schema.id || typeof schema.id !== 'string') {
    errors.push('Missing or invalid schema ID');
  }

  if (!schema.title || typeof schema.title !== 'string') {
    errors.push('Missing or invalid schema title');
  }

  if (!schema.root) {
    errors.push('Missing root component');
  }

  // Recursive validation
  if (schema.root) {
    validateComponent(schema.root, errors, warnings, 0);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateComponent(
  component: DynamicViewComponent,
  errors: string[],
  warnings: string[],
  depth: number
): void {
  // Check depth limit
  if (depth > SAFETY_LIMITS.MAX_DEPTH) {
    errors.push(`Component depth exceeds maximum (${SAFETY_LIMITS.MAX_DEPTH})`);
    return;
  }

  // Validate ID
  if (!component.id || typeof component.id !== 'string') {
    errors.push('Component missing valid ID');
  }

  // Validate type
  if (!component.type) {
    errors.push('Component missing type');
  }

  // Validate string lengths
  const validateString = (str: any, field: string) => {
    if (typeof str === 'string' && str.length > SAFETY_LIMITS.MAX_STRING_LENGTH) {
      warnings.push(`${field} exceeds max length (${SAFETY_LIMITS.MAX_STRING_LENGTH})`);
    }
  };

  // Type-specific validation
  switch (component.type) {
    case 'container':
    case 'row':
    case 'column':
    case 'grid':
    case 'card': {
      const container = component as ContainerComponent | RowComponent | ColumnComponent | GridComponent | CardComponent;
      if (container.children) {
        if (container.children.length > SAFETY_LIMITS.MAX_CHILDREN) {
          errors.push(`Container has too many children (${container.children.length} > ${SAFETY_LIMITS.MAX_CHILDREN})`);
        }
        container.children.forEach(child => validateComponent(child, errors, warnings, depth + 1));
      }
      break;
    }

    case 'text':
    case 'heading': {
      const textComp = component as TextComponent | HeadingComponent;
      validateString(textComp.content, 'content');
      break;
    }

    case 'button': {
      const btn = component as ButtonComponent;
      validateString(btn.label, 'label');
      if (btn.onClick && !SAFETY_LIMITS.ALLOWED_EVENT_HANDLERS.includes('onClick')) {
        errors.push('onClick handler not allowed');
      }
      break;
    }

    case 'chart': {
      const chart = component as ChartComponent;
      if (chart.data && chart.data.length > SAFETY_LIMITS.MAX_DATA_POINTS) {
        warnings.push(`Chart data exceeds max data points (${SAFETY_LIMITS.MAX_DATA_POINTS})`);
      }
      break;
    }

    case 'slider': {
      const slider = component as SliderComponent;
      if (slider.min >= slider.max) {
        errors.push('Slider min must be less than max');
      }
      break;
    }
  }
}

export function sanitizeComponent(component: DynamicViewComponent): DynamicViewComponent {
  // Remove potentially dangerous properties
  const sanitized = { ...component };

  // Sanitize strings
  const sanitizeString = (str: string): string => {
    if (!str) return str;
    return str
      .substring(0, SAFETY_LIMITS.MAX_STRING_LENGTH)
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  };

  // Recursively sanitize children
  if ('children' in sanitized && Array.isArray(sanitized.children)) {
    (sanitized as any).children = sanitized.children
      .slice(0, SAFETY_LIMITS.MAX_CHILDREN)
      .map(child => sanitizeComponent(child));
  }

  // Sanitize content fields
  if ('content' in sanitized && typeof sanitized.content === 'string') {
    (sanitized as any).content = sanitizeString(sanitized.content);
  }

  if ('label' in sanitized && typeof sanitized.label === 'string') {
    (sanitized as any).label = sanitizeString(sanitized.label);
  }

  return sanitized;
}
