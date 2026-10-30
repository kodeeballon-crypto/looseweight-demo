import { getT } from './index';

type Params = Record<string, string | number>;

/**
 * 带错误码的本地化错误：message 在抛出时按当前界面语言生成，
 * code 供测试和程序判断使用，避免依赖具体文案。
 */
export class LocalizedError extends Error {
  readonly code: string;
  readonly params?: Params;

  constructor(code: string, params?: Params) {
    super(getT()(code, params));
    this.name = 'LocalizedError';
    this.code = code;
    this.params = params;
  }
}

