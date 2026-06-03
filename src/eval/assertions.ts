import { outputSchema } from '../output';
import type { StructuredOutput } from '../output';

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
}

export function assertSchemaCompliance(value: unknown): AssertionResult {
  const result = outputSchema.safeParse(value);
  if (result.success) {
    return { name: 'schema_compliance', passed: true, message: '输出符合 schema' };
  }
  return {
    name: 'schema_compliance',
    passed: false,
    message: `Schema 错误: ${result.error.message}`,
  };
}

export function assertFieldsNonEmpty(value: StructuredOutput): AssertionResult {
  if (!value.summary || value.summary.trim().length === 0) {
    return { name: 'fields_non_empty', passed: false, message: 'summary 为空' };
  }
  if (value.files_changed < 0) {
    return { name: 'fields_non_empty', passed: false, message: 'files_changed 为负数' };
  }
  return { name: 'fields_non_empty', passed: true, message: '所有字段非空' };
}

export function assertRiskLevelEnum(value: StructuredOutput): AssertionResult {
  const valid = ['low', 'medium', 'high'];
  if (!valid.includes(value.risk_level)) {
    return {
      name: 'risk_level_enum',
      passed: false,
      message: `risk_level 必须是 ${valid.join(', ')} 之一，实际为: ${value.risk_level}`,
    };
  }
  return { name: 'risk_level_enum', passed: true, message: 'risk_level 合法' };
}

export function runRuleAssertions(value: unknown): AssertionResult[] {
  const schemaResult = assertSchemaCompliance(value);
  if (!schemaResult.passed) {
    return [schemaResult];
  }

  const typed = value as StructuredOutput;
  return [
    schemaResult,
    assertFieldsNonEmpty(typed),
    assertRiskLevelEnum(typed),
  ];
}
