import { describe, it, expect } from 'vitest';
import { outputSchema } from '../output';

describe('outputSchema', () => {
  it('接受合法输出 (low risk)', () => {
    const result = outputSchema.safeParse({
      summary: '修复了分页的 off-by-one 错误',
      files_changed: 3,
      risk_level: 'low',
    });
    expect(result.success).toBe(true);
  });

  it('接受合法输出 (medium risk)', () => {
    const result = outputSchema.safeParse({
      summary: '添加了新的 auth 中间件',
      files_changed: 8,
      risk_level: 'medium',
    });
    expect(result.success).toBe(true);
  });

  it('接受合法输出 (high risk)', () => {
    const result = outputSchema.safeParse({
      summary: '重写了数据库 schema',
      files_changed: 25,
      risk_level: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('拒绝缺少 summary', () => {
    const result = outputSchema.safeParse({
      files_changed: 3,
      risk_level: 'low',
    });
    expect(result.success).toBe(false);
  });

  it('拒绝缺少 files_changed', () => {
    const result = outputSchema.safeParse({
      summary: 'test',
      risk_level: 'low',
    });
    expect(result.success).toBe(false);
  });

  it('拒绝非法 risk_level', () => {
    const result = outputSchema.safeParse({
      summary: 'test',
      files_changed: 3,
      risk_level: 'critical',
    });
    expect(result.success).toBe(false);
  });

  it('拒绝负数 files_changed', () => {
    const result = outputSchema.safeParse({
      summary: 'test',
      files_changed: -1,
      risk_level: 'low',
    });
    expect(result.success).toBe(false);
  });

  it('拒绝额外字段', () => {
    const result = outputSchema.safeParse({
      summary: 'test',
      files_changed: 3,
      risk_level: 'low',
      extra: 'field',
    });
    expect(result.success).toBe(false);
  });
});
