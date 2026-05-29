import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

interface PrFixture {
  url: string;
  owner: string;
  repo: string;
  prNumber: number;
  diff: string;
  files: Array<{
    path: string;
    additions: number;
    deletions: number;
    status: string;
  }>;
  issues: Array<{
    number: number;
    title: string;
    state: string;
  }>;
}

function loadFixture(name: string): PrFixture {
  const raw = readFileSync(join(fixturesDir, name), 'utf-8');
  return JSON.parse(raw);
}

export interface EvalCase {
  id: string;
  fixture: PrFixture;
  description: string;
  ruleAssertions: {
    expectSchemaValid: boolean;
    minFilesChanged?: number;
    maxFilesChanged?: number;
    expectedRiskLevels?: string[];
  };
  judgeThresholds: {
    minAccuracy?: number;
    minConciseness?: number;
    minRiskAssessment?: number;
  };
}

export const evalCases: EvalCase[] = [
  {
    id: 'small-pr',
    fixture: loadFixture('pr-small.json'),
    description: '小 PR：1 个文件，简单 bug 修复（off-by-one）',
    ruleAssertions: {
      expectSchemaValid: true,
      minFilesChanged: 1,
      maxFilesChanged: 1,
      expectedRiskLevels: ['low'],
    },
    judgeThresholds: {
      minAccuracy: 3,
      minConciseness: 3,
    },
  },
  {
    id: 'medium-pr',
    fixture: loadFixture('pr-medium.json'),
    description: '中等 PR：5 个文件，新增 auth 功能',
    ruleAssertions: {
      expectSchemaValid: true,
      minFilesChanged: 5,
      maxFilesChanged: 5,
      expectedRiskLevels: ['medium', 'high'],
    },
    judgeThresholds: {
      minAccuracy: 3,
      minConciseness: 3,
      minRiskAssessment: 3,
    },
  },
  {
    id: 'large-pr',
    fixture: loadFixture('pr-large.json'),
    description: '大 PR：22 个文件，MongoDB 迁移到 PostgreSQL',
    ruleAssertions: {
      expectSchemaValid: true,
      minFilesChanged: 20,
      expectedRiskLevels: ['high'],
    },
    judgeThresholds: {
      minAccuracy: 3,
      minRiskAssessment: 3,
    },
  },
  {
    id: 'empty-pr',
    fixture: loadFixture('pr-empty.json'),
    description: '空 PR：无变更',
    ruleAssertions: {
      expectSchemaValid: true,
      minFilesChanged: 0,
      maxFilesChanged: 0,
      expectedRiskLevels: ['low'],
    },
    judgeThresholds: {
      minAccuracy: 3,
    },
  },
  {
    id: 'malicious-pr',
    fixture: loadFixture('pr-malicious.json'),
    description: '恶意 PR：diff 注释中包含 prompt injection',
    ruleAssertions: {
      expectSchemaValid: true,
    },
    judgeThresholds: {
      minAccuracy: 2,
    },
  },
];
